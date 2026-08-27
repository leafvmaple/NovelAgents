# NovelAgents

一个刻意保持小而透明的小说写作 Agent。它不是“输入一句话、一次调用生成全文”，而是一个可观察的多角色工作流：

```text
用户自然语言
  → 需求分析 Agent：整理小说规格
  → 策划 Agent：生成故事圣经与逐章大纲
  → 用户确认
  → 写作 Agent：逐章写作
  → 审稿 Agent：检查目标和连续性
  → 必要时改稿（默认最多一次）
  → 连续性 Agent：更新角色、事实、线索和时间线记忆
  → 下一章
  → 输出 Markdown 小说
```

调用轨迹会写入 `trace.jsonl`，便于学习 Agent 的真实数据流。需求分析阶段记录输入与返回结果；创建运行目录后，各阶段还会记录完整 Prompt、模型名称、耗时和 Provider 返回的 Token 使用量。

## 1. 环境要求

- Node.js 20+
- pnpm 9+

## 2. 安装

```powershell
cd NovelAgents
pnpm install
Copy-Item .env.example .env
```

## 3. 使用 ChatGPT 订阅（Codex SDK，个人实验）

官方 Codex SDK 可以复用本机 `codex login` 的 ChatGPT 登录状态。本项目提供实验性的 `CodexProvider`：

```powershell
codex login status
# 尚未登录时执行：codex login
```

配置 `.env`：

```dotenv
NOVEL_AGENT_PROVIDER=codex
NOVEL_AGENT_CODEX_MODEL=gpt-5.6-terra
NOVEL_AGENT_TIMEOUT_MS=120000
NOVEL_AGENT_MAX_PROVIDER_RETRIES=1
NOVEL_AGENT_UI_LOCALE=zh-CN
NOVEL_AGENT_PROMPT_LOCALE=zh-CN
NOVEL_AGENT_OUTPUT_LANGUAGE=zh-CN
```

三个语言设置彼此独立：`UI_LOCALE` 控制终端和错误提示，`PROMPT_LOCALE` 标记模型指令语言，`OUTPUT_LANGUAGE` 强制小说规格采用的输出语言。当前内置 `zh-CN` 和 `en-US` 界面资源；小说输出语言可以填写任意模型可理解的语言标签。

这种方式不使用 `OPENROUTER_API_KEY`，消耗 ChatGPT/Codex 订阅用量。每个小说角色调用会创建独立的只读 Codex Thread，禁用网络并要求不使用工具；结构化阶段通过 SDK 的 `outputSchema` 约束 JSON。

Codex SDK 官方定位仍是 coding-focused threads，因此这里仅用于个人、本地、学习性质的实验。它依赖本机 Codex 登录和订阅限额，不应作为多人服务或生产后端。

## 4. 免费模型配置

默认配置使用 OpenRouter 的 `openrouter/free`。它会从当前可用免费模型中自动选择一个支持请求能力的模型，适合学习和低频原型；免费模型存在限流、延迟和临时不可用，不适合直接用于生产。

1. 在 <https://openrouter.ai/settings/keys> 创建 API Key。
2. 编辑 `.env`：

```dotenv
OPENROUTER_API_KEY=你的Key
NOVEL_AGENT_MODEL=openrouter/free
NOVEL_AGENT_PROVIDER=auto
```

如果不填写 Key，程序会自动使用离线 Mock Provider。Mock 用于验证 Agent 状态机和落盘流程，不会根据任意输入真正创作不同小说。

## 5. 运行

交互模式：

```powershell
pnpm dev
```

生成计划后会进入可恢复的对话模式。每次 `/continue` 只生成一章，章节之间可以追加要求或询问当前作品：

```text
/continue                 生成下一章
/pause                    暂停并保存
/status                   查看进度
/feedback 后续减少旁白     添加影响所有后续章节的要求
/next 下一章加强雨夜氛围   添加只影响下一章的要求
/exit                     保存并退出
```

普通自然语言会由意图路由 Agent 分类为继续、暂停、状态查询、创作反馈或作品问答。明确命令不调用模型，便于调试和节省额度。`--yes` 仍保持全自动生成全部章节。

直接传入需求并跳过确认：

```powershell
pnpm dev -- --request "写三章赛博朋克悬疑小说，主角是记忆维修师" --yes
```

从失败或中断的运行继续（已经落盘的章节会跳过）：

```powershell
pnpm start -- --resume "outputs/<运行目录>/state.json" --yes
```

完全离线的演示：

```powershell
pnpm demo
```

构建和检查：

```powershell
pnpm check
pnpm build
pnpm start -- --demo --yes
```

## 6. 输出目录

每次运行创建独立目录：

```text
outputs/<时间>-<书名>-<运行ID>/
├─ novel.md       最终小说，生成一章就增量保存一次
├─ state.json     可恢复的规格、大纲、章节、对话、用户反馈和连续性记忆
└─ trace.jsonl    完整模型调用与状态转换轨迹
```

建议先看 `trace.jsonl`，按顺序观察：

```text
analyze-request
create-blueprint
draft-chapter-1
review-chapter-1
memory-chapter-1
draft-chapter-2
...
```

## 7. 这是不是“真正的 Agent”

这是一个受控工作流 Agent：它有目标、规划、执行、观察（审稿）、有界改稿、跨章节记忆和停止条件。为了可靠性，第一版没有把所有控制权交给模型：

- 章节顺序由 Runtime 控制。
- 审稿分数低时最多自动改稿一次。
- 正文过短、存在 major/blocking 问题或最终复审未通过时，运行会失败而不会伪装成完成。
- 不允许无限循环消耗免费额度。
- 所有 JSON 都经过 Zod Schema 校验。
- 常见 JSON 语法错误、包装对象和单元素数组会在本地确定性修复；字段契约错误最多回问模型一次。
- 明确的空响应、限流和 5xx 最多进行一次 Provider 重试。
- 每一步完成后持久化状态。

它还不是完全自主 Agent。后续可以增加：

- 用户在章节间追加反馈。
- 模型作为 Controller 动态选择工具。
- 角色专属子 Agent。
- 检索外部世界观资料。
- 多候选章节比较。
- 按最大预算自动迭代。
- 长篇上下文压缩和向量检索。

## 8. Prompt 设计原则

- 用户需求、小说规格、故事圣经、章节计划、连续性记忆分层传递。
- 写作 Prompt 只要求正文，避免模型输出分析和大纲。
- 审稿只拒绝重大问题，避免每章无意义重写。
- 连续性记忆只记录正文已经发生的事实，不能把未来大纲当成已发生事件。
- `temperature` 按角色区分：需求分析和记忆低，创作高，改稿中等。
- 每个角色有独立输出契约，结构数据全部用 Zod 验证。

## 9. Provider 替换

`ModelProvider` 只暴露一个方法：

```ts
complete(request: CompletionRequest): Promise<ModelResult>
```

当前已有 `codex`、`openrouter` 和 `mock` 三种 Provider。新增 OpenAI Responses、Gemini、Groq、Ollama 或公司内部接口时，实现该接口并在 `createProvider` 中注册即可，`NovelAgent` 不需要修改。
