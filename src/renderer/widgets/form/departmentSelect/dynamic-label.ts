import i18next from "@renderer/widgets/i18next";
const CURRENT_USER = "currentUser";
const CURRENT_DEPARTMENT = "currentDepartment";

const wrapAccountName = (label: string, accountName?: string) => {
  const normalizedName = accountName?.trim();
  if (!normalizedName) {
    return label;
  }
  return `${label}（${normalizedName}）`;
};

export const formatDynamicOrganizeLabel = (value: string, accountName?: string) => {
  if (value === CURRENT_DEPARTMENT) {
    return wrapAccountName(i18next.t("currentMemberDepartment"), accountName);
  }
  if (value === CURRENT_USER) {
    return wrapAccountName(i18next.t("currentMember"), accountName);
  }
  return value;
};
