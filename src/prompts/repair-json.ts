import type { ChatMessage } from "../domain.js";

export function repairJsonMessages(input: {
  originalTaskMessages: ChatMessage[];
  validationErrors: unknown;
  originalJson: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是严格的 JSON 数据修复器。",
        "根据校验错误修正给定 JSON，只修复结构、字段类型和缺失字段，不改变故事含义。",
        "字符串需要变为数组时，将其中并列的语义拆成多个字符串元素。",
        "输出必须是原任务要求的目标对象本身，禁止添加 response、data、result、output 等包装字段。",
        "只输出一个合法 JSON 对象，不要 Markdown，不要解释。",
      ].join("\n"),
    },
    { role: "user", content: JSON.stringify(input) },
  ];
}
