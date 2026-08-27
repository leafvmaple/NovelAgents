import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { NovelAgent } from "./agent.js";
import { createProvider, loadConfig } from "./config.js";
import { AppError } from "./errors/app-error.js";
import {
  formatAgentEvent,
  formatError,
  translate,
  type UiLocale,
} from "./i18n/index.js";
import { NovelStore } from "./storage.js";
import type { NovelState } from "./domain.js";

const demoRequest =
  "写一部都市悬疑奇幻短篇：档案修复师收到来自明天的照片，为寻找失踪的妹妹调查一座会筛选未来的钟楼。语言克制、有潮湿的港城氛围，不要依靠巧合解决冲突。";

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printPlan(
  state: Awaited<ReturnType<NovelAgent["prepare"]>>["state"],
  locale: UiLocale,
) {
  if (!state.spec || !state.blueprint) return;
  const t = (
    key: Parameters<typeof translate>[1],
    params: Parameters<typeof translate>[2] = {},
  ) => translate(locale, key, params);
  console.log(`\n=== ${t("cli.specHeading")} ===`);
  console.log(t("cli.title", { value: state.blueprint.title }));
  console.log(t("cli.genre", { value: state.spec.genre }));
  console.log(t("cli.tone", { value: state.spec.tone }));
  console.log(t("cli.pov", { value: state.spec.pointOfView }));
  console.log(
    t("cli.chapters", {
      count: state.spec.chapterCount,
      words: state.spec.targetWordsPerChapter,
    }),
  );
  console.log(t("cli.logline", { value: state.blueprint.logline }));
  console.log(`\n=== ${t("cli.planHeading")} ===`);
  for (const chapter of state.blueprint.chapters) {
    console.log(`${chapter.number}. ${chapter.title} —— ${chapter.purpose}`);
  }
}

async function chatLoop(
  agent: NovelAgent,
  initialState: NovelState,
  store: NovelStore,
  cli: ReturnType<typeof createInterface>,
  t: (
    key: Parameters<typeof translate>[1],
    params?: Parameters<typeof translate>[2],
  ) => string,
) {
  let state = initialState;
  console.log(`\n${t("cli.chatHelp")}`);
  while (true) {
    const message = (await cli.question(t("cli.chatPrompt"))).trim();
    if (!message) continue;
    if (/^\/(?:exit|quit|退出)$/iu.test(message)) {
      console.log(t("cli.chatExit"));
      return state;
    }
    const result = await agent.handleUserMessage(state, store, message);
    state = result.state;
    console.log(t("cli.agentReply", { message: result.response }));
  }
}

async function main() {
  const demo = process.argv.includes("--demo");
  const yes = process.argv.includes("--yes");
  const config = loadConfig(demo);
  const t = (
    key: Parameters<typeof translate>[1],
    params: Parameters<typeof translate>[2] = {},
  ) => translate(config.uiLocale, key, params);
  const provider = createProvider(config);
  const cli = createInterface({ input, output });

  try {
    console.log(`\nProvider: ${provider.name}`);
    if (provider.name === "mock" && !demo) {
      console.log(`${t("cli.mockNotice")}\n`);
    }

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
        const message = formatAgentEvent(config.uiLocale, event);
        if (message) console.log(`[Agent] ${message}`);
      },
    );
    const resumePath = argumentValue("--resume");
    if (resumePath) {
      const resumed = await NovelStore.open(resumePath, {
        traceContent: config.traceContent,
      });
      if (!resumed.state.spec || !resumed.state.blueprint) {
        throw new AppError("RESUME_PLAN_REQUIRED");
      }
      console.log(
        `\n${t("cli.resumedFrom", { path: resumed.store.statePath })}`,
      );
      printPlan(resumed.state, config.uiLocale);
      const completed = yes
        ? await agent.execute(resumed.state, resumed.store)
        : await chatLoop(agent, resumed.state, resumed.store, cli, t);
      console.log(
        `\n=== ${t(completed.status === "complete" ? "cli.completeHeading" : "cli.sessionHeading")} ===`,
      );
      console.log(t("cli.chapterCount", { count: completed.chapters.length }));
      console.log(t("cli.novelPath", { path: resumed.store.novelPath }));
      console.log(t("cli.statePath", { path: resumed.store.statePath }));
      console.log(t("cli.tracePath", { path: resumed.store.tracePath }));
      return;
    }

    let request = argumentValue("--request");
    if (!request) {
      request = demo
        ? demoRequest
        : await cli.question(t("cli.requestQuestion"));
    }
    if (!request.trim()) throw new AppError("NOVEL_REQUEST_REQUIRED");

    const prepared = await agent.prepare(request);
    printPlan(prepared.state, config.uiLocale);
    console.log(`\n${t("cli.planSaved", { path: prepared.store.statePath })}`);

    if (!yes) {
      const answer = await cli.question(`\n${t("cli.confirm")}`);
      if (answer.trim() && !/^y(?:es)?$/iu.test(answer.trim())) {
        console.log(t("cli.stopped"));
        return;
      }
    }

    const completed = yes
      ? await agent.execute(prepared.state, prepared.store)
      : await chatLoop(agent, prepared.state, prepared.store, cli, t);
    console.log(
      `\n=== ${t(completed.status === "complete" ? "cli.completeHeading" : "cli.sessionHeading")} ===`,
    );
    console.log(t("cli.chapterCount", { count: completed.chapters.length }));
    console.log(t("cli.novelPath", { path: prepared.store.novelPath }));
    console.log(t("cli.statePath", { path: prepared.store.statePath }));
    console.log(t("cli.tracePath", { path: prepared.store.tracePath }));
  } finally {
    cli.close();
  }
}

main().catch((error: unknown) => {
  const locale =
    process.env.NOVEL_AGENT_UI_LOCALE === "en-US" ? "en-US" : "zh-CN";
  console.error(
    `\n${translate(locale, "cli.failed", { message: formatError(locale, error) })}`,
  );
  process.exitCode = 1;
});
