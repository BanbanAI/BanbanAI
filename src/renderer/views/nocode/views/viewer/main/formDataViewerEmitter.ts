// https://www.npmjs.com/package/mitt

export const Events = {
  DRAWER_OPEN: "drawer:open",
  DRAWER_OTHERCLOSE: "drawer:other-close",
} as const;

// 定义所有事件的类型结构
export type EventBusEvents = {
  [Events.DRAWER_OPEN]: void;
  [Events.DRAWER_OTHERCLOSE]: void;
};
