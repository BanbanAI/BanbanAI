export type NocodeEditorProviderRetryCopyKey =
  | 'nocodeEditorAiPanel.streamRetrying'
  | 'nocodeEditorAiPanel.streamRetryingWithoutCompaction'

// 只有 total 超时才真正压缩上下文；首包超时是原样重发，文案不能宣称压缩。
export const resolveNocodeEditorProviderRetryCopyKey = (
  retryReason: unknown,
): NocodeEditorProviderRetryCopyKey => (
  String(retryReason || '').trim() === 'total_timeout_compact'
    ? 'nocodeEditorAiPanel.streamRetrying'
    : 'nocodeEditorAiPanel.streamRetryingWithoutCompaction'
)
