import { AiActionResult, AiChatRequest } from '../ai.types'

export type NocodeEditorOutlineBlueprintRoundGuard =
  | 'outline-already-staged'
  | 'outline-already-read'
  | 'blueprint-already-read'

export const shouldAutoFinishAfterBlueprintStaged = (_options: {
  request: AiChatRequest
  results: AiActionResult[]
}) => false

export const resolveOutlineBlueprintRoundGuard = (_options: {
  request: AiChatRequest
  results: AiActionResult[]
  callName: string
}): NocodeEditorOutlineBlueprintRoundGuard | null => null
