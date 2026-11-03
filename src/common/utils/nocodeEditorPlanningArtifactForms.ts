import { isNocodeEditorPlanningFormArtifact } from './nocodeEditorAppBuilderPlanningLabels'

export type NocodeEditorPlanningFallbackForm = {
  formKey: string
  tableName: string
  description?: string
}

// 只有 type=form 的产物才是蓝图必须复用的表；formKey 按过滤后的顺序生成，
// 避免非表单产物占用 artifact-N 编号后影响范围校验。
export const buildNocodeEditorPlanningFallbackForms = (
  artifacts: readonly unknown[] | null | undefined,
): NocodeEditorPlanningFallbackForm[] => (
  (Array.isArray(artifacts) ? artifacts : [])
    .filter(isNocodeEditorPlanningFormArtifact)
    .map((artifact) => {
      const record = artifact as Record<string, unknown>
      return {
        tableName: String(record?.name || '').trim(),
        description: String(record?.purpose || '').trim() || undefined,
      }
    })
    .filter(form => form.tableName)
    .map((form, index) => ({
      formKey: `artifact-${index + 1}`,
      ...form,
    }))
)
