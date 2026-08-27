import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { resolve } from "node:path";
import { z } from "zod";
import { NovelAgent } from "./agent.js";
import { createProvider, type loadConfig } from "./config.js";
import type { NovelState } from "./domain.js";
import { RunEventHub } from "./event-hub.js";
import { formatError } from "./i18n/index.js";
import type { ModelProvider } from "./provider.js";
import type { NovelStore } from "./storage.js";

type AppConfig = ReturnType<typeof loadConfig>;
type RunContext = { agent: NovelAgent; store: NovelStore; state: NovelState };

const CreateRunSchema = z
  .object({ request: z.string().trim().min(1).max(8000) })
  .strict();
const MessageSchema = z
  .object({ message: z.string().trim().min(1).max(8000) })
  .strict();
const RunParamsSchema = z.object({ runId: z.string().uuid() }).strict();

export function buildWebApp(
  config: AppConfig,
  provider: ModelProvider = createProvider(config),
) {
  const app = Fastify({ logger: false });
  const hub = new RunEventHub();
  const runs = new Map<string, RunContext>();

  void app.register(fastifyStatic, {
    root: resolve(process.cwd(), "web"),
    prefix: "/",
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error instanceof z.ZodError ? 400 : 500;
    void reply
      .status(statusCode)
      .send({ error: formatError(config.uiLocale, error) });
  });

  app.post("/api/runs", async (request) => {
    const body = CreateRunSchema.parse(request.body);
    let runId: string | null = null;
    const bufferedEvents: unknown[] = [];
    const agent = new NovelAgent(
      provider,
      {
        outputRoot: config.outputRoot,
        maxRevisions: config.maxRevisions,
        maxProviderRetries: config.maxProviderRetries,
        uiLocale: config.uiLocale,
        promptLocale: config.promptLocale,
        outputLanguage: config.outputLanguage,
        traceContent: config.traceContent,
      },
      (event) => {
        if (runId) hub.publish(runId, event);
        else bufferedEvents.push(event);
      },
    );
    const prepared = await agent.prepare(body.request);
    runId = prepared.state.id;
    runs.set(runId, { agent, store: prepared.store, state: prepared.state });
    return { state: prepared.state, events: bufferedEvents };
  });

  app.get("/api/runs/:runId", async (request, reply) => {
    const { runId } = RunParamsSchema.parse(request.params);
    const context = runs.get(runId);
    if (!context) return reply.status(404).send({ error: "RUN_NOT_FOUND" });
    context.state = await context.store.loadState();
    return { state: context.state };
  });

  app.post("/api/runs/:runId/messages", async (request, reply) => {
    const { runId } = RunParamsSchema.parse(request.params);
    const body = MessageSchema.parse(request.body);
    const context = runs.get(runId);
    if (!context) return reply.status(404).send({ error: "RUN_NOT_FOUND" });
    const result = await context.agent.handleUserMessage(
      context.state,
      context.store,
      body.message,
    );
    context.state = result.state;
    return result;
  });

  app.post("/api/runs/:runId/cancel", (request, reply) => {
    const { runId } = RunParamsSchema.parse(request.params);
    const context = runs.get(runId);
    if (!context) return reply.status(404).send({ error: "RUN_NOT_FOUND" });
    return { cancelled: context.agent.cancelActiveRun() };
  });

  app.get("/api/runs/:runId/events", (request, reply) => {
    const { runId } = RunParamsSchema.parse(request.params);
    if (!runs.has(runId))
      return reply.status(404).send({ error: "RUN_NOT_FOUND" });
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    reply.raw.write(": connected\n\n");
    const unsubscribe = hub.subscribe(runId, (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(
      () => reply.raw.write(": heartbeat\n\n"),
      15_000,
    );
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
    return reply;
  });

  return app;
}
