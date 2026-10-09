
export type AgentAppScope = {
  appIds: string[],
}
export type Agent = {
  id: string,
  accountId: string,
  name: string,
  appScope?: AgentAppScope,
  pinned?: boolean,
  pinTime?: number,
  sharing?: boolean,
  shareTime?: number,
  deleted?: boolean,
  createTime?: number,
  updateTime?: number,
  deleteTime?: number,
}