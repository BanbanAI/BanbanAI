import { ProcessNodeStatus } from "@common/types/project";

export const canShowProcessSubmitButton = (
  todo: { status?: ProcessNodeStatus } | null | undefined,
  editable: boolean,
  transferOnly: boolean,
) => {
  return Boolean(editable)
    && !transferOnly
    && todo?.status !== ProcessNodeStatus.REJECTED;
};
