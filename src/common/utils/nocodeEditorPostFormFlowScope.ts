import type { NocodeEditorPlanningScope } from './nocodeEditorPlanningScope'

const NOCODE_EDITOR_PLANNING_SCOPES = new Set<NocodeEditorPlanningScope>([
  'app',
  'form',
  'board',
  'local',
  'unknown',
])

export const normalizeNocodeEditorPlanningScopeValue = (
  value: unknown,
): NocodeEditorPlanningScope => {
  const normalized = String(value || '').trim() as NocodeEditorPlanningScope
  return NOCODE_EDITOR_PLANNING_SCOPES.has(normalized) ? normalized : 'unknown'
}

export const isNocodeEditorPostFormFlowEnabledForScope = (
  value: unknown,
) => normalizeNocodeEditorPlanningScopeValue(value) === 'form'
