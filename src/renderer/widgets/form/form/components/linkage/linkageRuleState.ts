type LinkageRuleLike = {
  linkageTable?: string[] | null;
}

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
  rule: LinkageRuleLike | null | undefined,
  widget: LinkageWidgetLike | null | undefined,
) => {
  const [connectionUID, tableUID] = rule?.linkageTable || [];
  if (!connectionUID || !tableUID) return undefined;

  const connections = widget?.getBoard?.()?.getConnections?.() || [];
  const connection = connections.find(item => item?.uid === connectionUID);
  return connection?.tables?.find(item => item?.uid === tableUID);
}

export const isMissingLinkageTable = (
  rule: LinkageRuleLike | null | undefined,
  widget: LinkageWidgetLike | null | undefined,
) => {
  if (!rule?.linkageTable?.length) return false;
  return !findLinkageTable(rule, widget);
}
