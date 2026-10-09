import i18next from 'i18next';

export type DeleteResultMessageInput = {
  successCount?: unknown;
  failedCount?: unknown;
  permissionDeniedCount?: unknown;
};

const normalizeCount = (value: unknown) => {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
};

export const hasDeleteFailures = (result: DeleteResultMessageInput | null | undefined) => {
  return normalizeCount(result?.permissionDeniedCount) > 0 || normalizeCount(result?.failedCount) > 0;
};

export const getDeleteResultMessage = (
  result: DeleteResultMessageInput | null | undefined,
  successText: string,
) => {
  const successCount = normalizeCount(result?.successCount);
  const permissionDeniedCount = normalizeCount(result?.permissionDeniedCount);
  const failedCount = normalizeCount(result?.failedCount);
  const otherFailedCount = Math.max(failedCount - permissionDeniedCount, 0);

  if (permissionDeniedCount > 0 && otherFailedCount > 0) {
    return i18next.t('deleteResultMessage.permissionAndOtherFailed', {
      successCount,
      permissionDeniedCount,
      otherFailedCount,
    });
  }
  if (permissionDeniedCount > 0) {
    return i18next.t('deleteResultMessage.permissionFailed', {
      successCount,
      permissionDeniedCount,
    });
  }
  if (failedCount > 0) {
    return i18next.t('deleteResultMessage.failed', {
      successCount,
      failedCount,
    });
  }
  return successText;
};
