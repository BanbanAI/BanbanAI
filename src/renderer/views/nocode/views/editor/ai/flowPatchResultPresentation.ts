import type { AiAssistantFlowPatchResultBlock } from '@common/types/ai'
import { groupAiAssistantFlowPatchResultOperations } from '@common/utils/aiFlowPatchResultPresentation'

export const buildFlowPatchResultPresentation = (block: AiAssistantFlowPatchResultBlock) => ({
  title: `已更新流程草稿 V${block.draftVersion}`,
  statusText: block.createdDraftVersion ? `由 V${block.sourceVersion} 创建` : '当前草稿已更新',
  groups: groupAiAssistantFlowPatchResultOperations(block.operations),
  activeVersionText: block.activeVersionUnchanged && block.activeVersion
    ? `当前启用版本 V${block.activeVersion} 未受影响`
    : '未自动启用此草稿',
  viewTarget: { formId: block.formId, draftVersion: block.draftVersion },
})
