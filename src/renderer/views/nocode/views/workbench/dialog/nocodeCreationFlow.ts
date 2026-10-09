import axios from "axios";

export type BlankNocodeCreationBehavior = {
  shouldAutoNavigate: boolean;
  shouldRefreshWorkbench: boolean;
  shouldKeepDialogVisibleWhileSubmitting: boolean;
};

export const createEmptyNocodeShell = async (payload: {
  name: string
  description?: string
  groupId?: string
}) => {
  const { data } = await axios.post('/project/nocode-create', {
    name: payload.name,
    description: payload.description || '',
    groupId: payload.groupId || '',
  })
  return data
}

export const resolveBlankNocodeCreationBehavior = (options: {
  autoOpen?: boolean;
}): BlankNocodeCreationBehavior => {
  const shouldAutoNavigate = options.autoOpen !== false;

  return {
    shouldAutoNavigate,
    shouldRefreshWorkbench: !shouldAutoNavigate,
    shouldKeepDialogVisibleWhileSubmitting: shouldAutoNavigate,
  };
};
