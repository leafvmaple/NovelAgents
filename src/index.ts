import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { NovelAgent } from "./agent.js";
import { createProvider, loadConfig } from "./config.js";
import { NovelStore } from "./storage.js";

const demoRequest =
  "写一部都市悬疑奇幻短篇：档案修复师收到来自明天的照片，为寻找失踪的妹妹调查一座会筛选未来的钟楼。语言克制、有潮湿的港城氛围，不要依靠巧合解决冲突。";

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printPlan(state: Awaited<ReturnType<NovelAgent["prepare"]>>["state"]) {
  if (!state.spec || !state.blueprint) return;
  console.log("\n=== 小说规格 ===");
  console.log(`书名：${state.blueprint.title}`);
  console.log(`类型：${state.spec.genre}`);
  console.log(`基调：${state.spec.tone}`);
  console.log(`视角：${state.spec.pointOfView}`);
  console.log(`章节：${state.spec.chapterCount} 章，每章约 ${state.spec.targetWordsPerChapter} 字`);
  console.log(`一句话：${state.blueprint.logline}`);
  console.log("\n=== 章节计划 ===");
  for (const chapter of state.blueprint.chapters) {
    console.log(`${chapter.number}. ${chapter.title} —— ${chapter.purpose}`);
  }
}

async function main() {
  const demo = process.argv.includes("--demo");
  const yes = process.argv.includes("--yes");
  const config = loadConfig(demo);
  const provider = createProvider(config);
  const cli = createInterface({ input, output });

  try {
    console.log(`\nProvider: ${provider.name}`);
    if (provider.name === "mock" && !demo) {
      console.log("未检测到 OPENROUTER_API_KEY，当前使用离线演示 Provider。复制 .env.example 为 .env 并填写 Key 可调用真实免费模型。\n");
    }

    const agent = new NovelAgent(
      provider,
      {
        outputRoot: config.outputRoot,
        maxRevisions: config.maxRevisions,
        maxProviderRetries: config.maxProviderRetries,
      },
      (message) => console.log(`[Agent] ${message}`),
    );
    const resumePath = argumentValue("--resume");
    if (resumePath) {
      const resumed = await NovelStore.open(resumePath);
      if (!resumed.state.spec || !resumed.state.blueprint) {
        throw new Error("RESUME_PLAN_REQUIRED");
      }
      console.log(`\n从状态继续：${resumed.store.statePath}`);
      printPlan(resumed.state);
      const completed = await agent.execute(resumed.state, resumed.store);
      console.log("\n=== 生成完成 ===");
      console.log(`章节数：${completed.chapters.length}`);
      console.log(`小说：${resumed.store.novelPath}`);
      console.log(`状态：${resumed.store.statePath}`);
      console.log(`调用轨迹：${resumed.store.tracePath}`);
      return;
    }

    let request = argumentValue("--request");
    if (!request) {
      request = demo
        ? demoRequest
        : await cli.question(
            "请描述你想写的小说（题材、主角、冲突、风格、章节数等，可以只写一句话）：\n> ",
          );
    }
    if (!request.trim()) throw new Error("NOVEL_REQUEST_REQUIRED");

    const prepared = await agent.prepare(request);
    printPlan(prepared.state);
    console.log(`\n规划状态已保存：${prepared.store.statePath}`);

    if (!yes) {
      const answer = await cli.question("\n是否按此计划开始生成？[Y/n] ");
      if (answer.trim() && !/^y(?:es)?$/iu.test(answer.trim())) {
        console.log("已停止。你可以查看 state.json 中的规格和大纲。");
        return;
      }
    }

    const completed = await agent.execute(prepared.state, prepared.store);
    console.log("\n=== 生成完成 ===");
    console.log(`章节数：${completed.chapters.length}`);
    console.log(`小说：${prepared.store.novelPath}`);
    console.log(`状态：${prepared.store.statePath}`);
    console.log(`调用轨迹：${prepared.store.tracePath}`);
  } finally {
    cli.close();
  }
}

main().catch((error: unknown) => {
  console.error("\n生成失败：", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
