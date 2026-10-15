type BlueprintStageActionResult = {
  ok?: unknown
  name?: unknown
}

const BLUEPRINT_UPDATE_CLAIM_PATTERN = /(?:更新了蓝图|修改了蓝图|调整了蓝图|暂存了蓝图|创建了蓝图|蓝图(?:已|已经|成功)(?:更新|修改|调整|暂存|创建)|已(?:经)?(?:将|把).{0,24}(?:更新|修改|调整).{0,8}蓝图)/i

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
