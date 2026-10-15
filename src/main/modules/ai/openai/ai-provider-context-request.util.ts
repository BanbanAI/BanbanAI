export const resolveAiProviderRequestWithProjectedMessages = <TRequest extends { messages: unknown[] }>(
  request: TRequest,
  projectedMessages: TRequest['messages'],
  projectionChanged: boolean,
): TRequest => (
  projectionChanged
    ? { ...request, messages: projectedMessages }
    : request
)
