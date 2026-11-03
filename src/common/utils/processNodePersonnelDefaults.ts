import {
  ApproverSameAsSubmitter,
  ApproverType,
  OwnerEmptyHandle,
} from '@common/types/project'

// 手动在设计器新增人工节点时写入的默认人员设置。
// AI 生成流程必须复用同一份默认值，否则生成结果与手动新增节点的行为不一致。
export const APPROVAL_NODE_PERSONNEL_DEFAULTS = {
  /** 多人审批时采用的审批方式 */
  approverType: ApproverType.AND,
  /** 审批人为空时 */
  approverEmpty: OwnerEmptyHandle.AUTO_APPROVE,
  /** 审批人与提交人为同一人时 */
  approverSameAsSubmitter: ApproverSameAsSubmitter.SELF,
} as const

export const TRANSACT_NODE_PERSONNEL_DEFAULTS = {
  /** 多人办理时采用的办理方式 */
  transactorType: ApproverType.OR,
  /** 办理人为空时 */
  transactorEmpty: OwnerEmptyHandle.ADMIN,
} as const

export const REPORT_DATA_NODE_PERSONNEL_DEFAULTS = {
  /** 填报人为空时 */
  reporterEmpty: OwnerEmptyHandle.ASSIGNEE,
} as const
