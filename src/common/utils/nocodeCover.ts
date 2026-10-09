import type { NocodeBody, NocodeCoverSummary } from '@common/types/nocode'

export const resolveNocodeCoverSummary = (
  snapshot: NocodeBody['snapshot'] | undefined,
  hasImage: boolean,
): NocodeCoverSummary => {
  if (snapshot) return { type: 'icon' }
  if (hasImage) return { type: 'image' }
  return { type: 'default' }
}
