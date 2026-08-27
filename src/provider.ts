import type { ChatMessage, ModelResult } from "./domain.js";
import { ProviderError } from "./errors/provider-error.js";

export type CompletionRequest = {
  purpose: string;
  messages: ChatMessage[];
  json: boolean;
  outputSchema?: unknown;
  temperature: number;
  maxTokens: number;
};

export interface ModelProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<ModelResult>;
}

type OpenRouterOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

type OpenRouterResponse = {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
  error?: { message?: unknown };
};

function tokenCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export class OpenRouterProvider implements ModelProvider {
  readonly name = "openrouter";

  constructor(private readonly options: OpenRouterOptions) {}

  async complete(request: CompletionRequest): Promise<ModelResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs,
    );
    try {
      const response = await fetch(
        `${this.options.baseUrl.replace(/\/$/u, "")}/chat/completions`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.options.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://localhost/novel-agents",
            "X-Title": "NovelAgents",
          },
          body: JSON.stringify({
            model: this.options.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            ...(request.json
              ? {
                  response_format: { type: "json_object" },
                  provider: { require_parameters: true },
                  reasoning: { exclude: true },
                }
              : {}),
          }),
        },
      );
      const rawBody = await response.text();
      let payload: OpenRouterResponse;
      try {
        payload = JSON.parse(rawBody) as OpenRouterResponse;
      } catch (error) {
        if (!response.ok) {
          throw new ProviderError(
            this.name,
            "HTTP_ERROR",
            [408, 429, 500, 502, 503, 504].includes(response.status),
            response.status,
            rawBody.trim().slice(0, 300) || response.statusText,
            { cause: error },
          );
        }
        throw new ProviderError(
          this.name,
          "INVALID_RESPONSE",
          true,
          response.status,
          "response is not JSON",
          { cause: error },
        );
      }
      if (!response.ok) {
        const message =
          typeof payload.error?.message === "string"
            ? payload.error.message
            : `HTTP ${response.status}`;
        throw new ProviderError(
          this.name,
          "HTTP_ERROR",
          [408, 429, 500, 502, 503, 504].includes(response.status),
          response.status,
          message,
        );
      }
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new ProviderError(
          this.name,
          "EMPTY_RESPONSE",
          true,
          response.status,
        );
      }
      return {
        content: content.trim(),
        model:
          typeof payload.model === "string"
            ? payload.model
            : this.options.model,
        usage: {
          promptTokens: tokenCount(payload.usage?.prompt_tokens),
          completionTokens: tokenCount(payload.usage?.completion_tokens),
          totalTokens: tokenCount(payload.usage?.total_tokens),
        },
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (controller.signal.aborted) {
        throw new ProviderError(
          this.name,
          "TIMEOUT",
          true,
          null,
          "request timed out",
          { cause: error },
        );
      }
      throw new ProviderError(
        this.name,
        "NETWORK_ERROR",
        true,
        null,
        error instanceof Error ? error.message : String(error),
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function demoChapter(number: number) {
  if (number === 1) {
    return [
      "雨在午夜前停了。林澈沿着雾港废弃的高架轨道往北走，鞋底每一次落下，都把铁锈和积水压出细小的脆响。远处的城灯隔着雾，只剩一团团没有边缘的红。",
      "他在第七码头的旧候车室里找到了那封没有寄件人的信。信封上写着他的名字，墨迹却还没有干。更奇怪的是，里面夹着一张明天才会拍摄的报纸照片：照片中的他站在钟楼下，手里握着一把沾血的钥匙。",
      "“你比预计得早。”身后有人说。",
      "林澈转身，看见一名穿灰色雨衣的女人。她没有撑伞，肩上却没有一点水迹。女人把怀表放在长椅上。表盘逆时针转动，每退一格，候车室外的雾便浓一分。",
      "“如果你想知道妹妹为什么失踪，”她说，“明晚之前，不要让照片里的事情发生。”",
      "钟楼在城市另一端敲响十三下。林澈低头时，信封背面多出了一行刚刚浮现的字：第一把钥匙，藏在死者尚未死去的房间里。",
    ].join("\n\n");
  }
  return [
    "第二天黄昏，林澈来到旧城区的白塔公寓。门牌四〇七的住客周鹤仍活着，正坐在窗前修一台早已停产的录音机。",
    "“你来晚了三年。”周鹤没有抬头，“或者说，早了一天。”",
    "林澈把报纸照片放到桌上。周鹤的手停住了。录音机里传出一段倒放的人声，经过齿轮摩擦般的噪音后，竟变成林澈妹妹的声音。她反复说着同一句话：别相信带怀表的人。",
    "走廊骤然响起脚步。灰雨衣女人的影子停在门外，门缝下却没有她的脚。周鹤把一枚铜钥匙塞进林澈掌心，随后推开窗户。",
    "“钟楼不是用来报时的，”他说，“它在决定哪一个明天可以留下。”",
    "门锁开始逆向旋转。林澈握紧钥匙，终于明白照片上的血也许并不属于死者，而属于那个试图改变明天的人。",
  ].join("\n\n");
}

export class MockProvider implements ModelProvider {
  readonly name = "mock";

  complete(request: CompletionRequest): Promise<ModelResult> {
    let content: string;
    if (request.purpose === "analyze-request") {
      content = JSON.stringify({
        workingTitle: "雾港逆时信",
        genre: "都市悬疑奇幻",
        premise:
          "一名档案修复师收到来自明天的照片，为寻找失踪的妹妹卷入一座由钟楼筛选未来的雾城。",
        audience: "成年类型小说读者",
        tone: "克制、潮湿、悬疑感强",
        pointOfView: "third_person_limited",
        language: "zh-CN",
        chapterCount: 2,
        targetWordsPerChapter: 580,
        mustInclude: ["来自未来的线索", "逐步升级的时间谜题"],
        mustAvoid: ["无铺垫的万能能力", "纯粹依靠巧合解决冲突"],
      });
    } else if (request.purpose === "create-blueprint") {
      content = JSON.stringify({
        title: "雾港逆时信",
        logline:
          "档案修复师林澈必须在预言照片成真前找到失踪妹妹，并阻止钟楼删除城市的明天。",
        theme: "人无法控制所有未来，但可以为选择承担代价。",
        setting:
          "常年被海雾覆盖的近现代港城，旧钟楼能从多个可能的未来中保留一个。",
        styleGuide: [
          "第三人称限知，紧贴林澈",
          "以环境细节暗示超自然规则",
          "对话简短并包含潜台词",
        ],
        characters: [
          {
            id: "linche",
            name: "林澈",
            role: "主角，档案修复师",
            goal: "找到失踪的妹妹并阻止照片中的死亡",
            conflict: "越接近真相，越可能亲手促成预言",
            traits: ["谨慎", "固执", "观察细致"],
            secret: "他曾删除妹妹留下的最后一条求救录音",
          },
          {
            id: "graywoman",
            name: "灰衣女人",
            role: "掌握时间规则的引路人",
            goal: "迫使林澈完成一次关键选择",
            conflict: "不能直接透露被删除的未来",
            traits: ["冷静", "含混", "守约"],
            secret: "她来自一个已经被钟楼删除的明天",
          },
        ],
        chapters: [
          {
            number: 1,
            title: "明日照片",
            purpose: "建立来自未来的照片和失踪妹妹之间的联系。",
            povCharacterId: "linche",
            beats: [
              "林澈收到明日照片",
              "灰衣女人提出警告",
              "第一把钥匙的谜语出现",
            ],
            mustReveal: ["钟楼与异常时间有关"],
            endingHook: "死者尚未死去的房间里藏着第一把钥匙。",
          },
          {
            number: 2,
            title: "尚未死去的人",
            purpose: "让林澈获得钥匙并发现灰衣女人可能不可信。",
            povCharacterId: "linche",
            beats: ["林澈找到预言中的死者", "录音出现妹妹警告", "灰衣女人逼近"],
            mustReveal: ["钟楼会筛选未来"],
            endingHook: "林澈意识到自己可能正是照片中的凶手。",
          },
        ],
      });
    } else if (request.purpose.startsWith("draft-chapter-")) {
      const number = Number(request.purpose.slice("draft-chapter-".length));
      content = demoChapter(number);
    } else if (request.purpose.startsWith("review-chapter-")) {
      content = JSON.stringify({
        score: 86,
        approved: true,
        strengths: ["场景氛围明确", "结尾钩子落实", "信息推进清楚"],
        issues: [],
        revisionBrief: "",
      });
    } else if (request.purpose.startsWith("memory-chapter-")) {
      const number = Number(request.purpose.slice("memory-chapter-".length));
      content = JSON.stringify({
        chapterNumber: number,
        summary:
          number === 1
            ? "林澈收到一张来自明天的照片，灰衣女人用妹妹失踪的真相诱导他寻找第一把钥匙。"
            : "林澈找到尚未死亡的周鹤，获得铜钥匙，并得知妹妹警告他不要相信灰衣女人。",
        newFacts:
          number === 1
            ? ["照片展示可能的未来"]
            : ["钟楼会筛选未来", "林澈已取得铜钥匙"],
        characterStates: [
          {
            characterId: "linche",
            location: number === 1 ? "第七码头" : "白塔公寓",
            physicalState: "无明显外伤",
            emotionalState: "警惕且急于确认妹妹线索",
            knowledge:
              number === 1
                ? ["钥匙谜语"]
                : ["灰衣女人可能不可信", "钟楼会筛选未来"],
          },
        ],
        unresolvedThreads: [
          "妹妹在哪里",
          "灰衣女人的真实目的",
          "照片中的死亡如何发生",
        ],
        timelineNotes: [`故事第 ${number} 天`],
      });
    } else if (request.purpose.startsWith("revise-chapter-")) {
      content = demoChapter(
        Number(request.purpose.slice("revise-chapter-".length)),
      );
    } else if (request.purpose === "route-user-message") {
      const source = request.messages.at(-1)?.content ?? "";
      const parsed = JSON.parse(source) as { message?: string };
      const message = parsed.message ?? "";
      const intent = /继续|continue/iu.test(message)
        ? { type: "continue" }
        : /暂停|pause/iu.test(message)
          ? { type: "pause" }
          : /状态|进度|status/iu.test(message)
            ? { type: "status" }
            : /为什么|什么|哪些|吗|？|\?/u.test(message)
              ? { type: "ask", question: message }
              : { type: "feedback", scope: "global", instruction: message };
      content = JSON.stringify({ intent });
    } else if (request.purpose === "answer-user-question") {
      content =
        "这是离线 Mock Provider。对话路由已经生效，但真实的作品问答需要配置模型 Provider。";
    } else {
      throw new Error(`MOCK_PURPOSE_UNSUPPORTED:${request.purpose}`);
    }
    return Promise.resolve({
      content,
      model: "mock-novel-model",
      usage: { promptTokens: null, completionTokens: null, totalTokens: null },
    });
  }
}
