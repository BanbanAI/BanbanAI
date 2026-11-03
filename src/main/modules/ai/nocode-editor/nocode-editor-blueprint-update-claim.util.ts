type BlueprintStageActionResult = {
  ok?: unknown
  name?: unknown
}

// “完成态标记 + 蓝图对象”的组合判定，替代固定短语枚举：
// 覆盖“已生成/更新好了/蓝图已就绪/已经把它更新到蓝图”等变体表述，减少漏报。
const BLUEPRINT_UPDATE_CLAIM_PATTERN = new RegExp([
  '(?:已|已经)(?:更新|修改|调整|暂存|创建|生成|保存|重做)(?:了|好了|完毕|完成)?的?(?:蓝图|流程设计)',
  '(?:更新|修改|调整|暂存|创建|生成|保存|重做)(?:了|好了|完毕|完成)的?(?:蓝图|流程设计)',
  '(?:蓝图|流程设计)[^。！？!?\\n]{0,6}(?:已|已经|成功)(?:更新|修改|调整|暂存|创建|生成|保存|就绪|可用|准备好)',
  '(?:蓝图|流程设计)[^。！？!?\\n]{0,2}(?:更新|修改|调整|暂存|创建|生成|保存)(?:了|好了|完毕|完成)',
  '(?:已|已经)(?:将|把|对)[^。！？!?\\n]{0,24}(?:更新|修改|调整|暂存|创建|生成|保存|重做)[^。！？!?\\n]{0,12}(?:蓝图|流程设计)',
  '(?:updated|modified|adjusted|created|staged|generated|saved)\\s+(?:the\\s+)?blueprint',
  'blueprint\\s+(?:has\\s+been|is|was|been)?\\s*(?:updated|modified|adjusted|created|staged|generated|saved|ready)',
].join('|'), 'iu')

export const hasUnverifiedBlueprintUpdateClaim = (
  assistantText: unknown,
  actionResults: BlueprintStageActionResult[] = [],
) => {
  const hasSuccessfulBlueprintStage = actionResults.some(result => (
    result?.ok === true && String(result.name || '').trim() === 'editor_stage_app_blueprint'
  ))
  return !hasSuccessfulBlueprintStage
    && BLUEPRINT_UPDATE_CLAIM_PATTERN.test(String(assistantText || ''))
}
