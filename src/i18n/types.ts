import type { zhCN } from "./locales/zh-CN.js";
export type DeepLocaleShape = {
  [K in keyof typeof zhCN]: { [P in keyof (typeof zhCN)[K]]: string };
};
