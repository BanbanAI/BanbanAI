import type { FormLinkageRule } from "@renderer/b2/types";

type LinkageConnectionLike = {
  uid?: string;
  tables?: Array<{ uid?: string }> | null;
}

type LinkageBoardLike = {
  getConnections?: () => LinkageConnectionLike[] | null | undefined;
}

type LinkageWidgetLike = {
  getBoard?: () => LinkageBoardLike | null | undefined;
}

export const findLinkageTable = (
  rule: Pick<FormLinkageRule, "linkageTable"> | null | undefined,
  widget: LinkageWidgetLike | null | undefined,
) => {
  const [connectionUID, tableUID] = rule?.linkageTable || [];
  if (!connectionUID || !tableUID) return undefined;

  const connections = widget?.getBoard?.()?.getConnections?.() || [];
  const connection = connections.find(item => item?.uid === connectionUID);
  return connection?.tables?.find(item => item?.uid === tableUID);
}

export const isMissingLinkageTable = (
  rule: Pick<FormLinkageRule, "linkageTable"> | null | undefined,
  widget: LinkageWidgetLike | null | undefined,
) => {
  if (!rule?.linkageTable?.length) return false;
  return !findLinkageTable(rule, widget);
}

export const hasInvalidMultipleSubFormRule = (
  rule: Pick<FormLinkageRule, "conditions" | "fillWidgets">,
  currentSubFormUID: string | undefined,
  isMultipleSubFormById: (elementUID?: string) => boolean,
) => {
  const isInvalidMultipleSubForm = (elementUID?: string) => {
    return elementUID !== currentSubFormUID && isMultipleSubFormById(elementUID);
  };
  const hasInvalidCondition = rule.conditions.some(item => {
    const ids = typeof item.value === "string" ? item.value.split(".") : [];
    return ids.length > 1 && isInvalidMultipleSubForm(ids[0]);
  });
  const hasInvalidFillWidget = (rule.fillWidgets || [])
    .some(item => isInvalidMultipleSubForm(item.fillWidget));

  return hasInvalidCondition || hasInvalidFillWidget;
}
