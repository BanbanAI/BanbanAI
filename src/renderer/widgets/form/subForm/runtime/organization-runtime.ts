export const RuntimeDynamic = {
  CURRENT_USER: "currentUser",
  CURRENT_DEPARTMENT: "currentDepartment",
} as const;

type OrganizeEntity = { id?: string };
type AccountLike = OrganizeEntity & { departments?: readonly string[] };
type DepartmentLike = OrganizeEntity;
type RoleLike = OrganizeEntity;

const getOrganizeId = (value: unknown): string | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    const id = item.id ?? item.uid ?? item.value;
    return id === null || id === undefined || id === "" ? undefined : String(id);
  }
  return String(value);
};

export type RuntimeOrganizeType = "member" | "department";

export type RuntimeOrganizeData = {
  users?: readonly AccountLike[];
  departments?: readonly DepartmentLike[];
  roles?: readonly RoleLike[];
  dynamic?: readonly string[];
};

export type RuntimeOrganizeValueOptions = {
  currentType: RuntimeOrganizeType;
  multiple: boolean;
  data: RuntimeOrganizeData | null | undefined;
  currentAccount?: Pick<AccountLike, "id" | "departments"> | null;
};

export const resolveRuntimeOrganizeValue = ({
  currentType,
  multiple,
  data,
  currentAccount,
}: RuntimeOrganizeValueOptions): string[] => {
  const source = currentType === "member" ? data?.users : data?.departments;
  const ids = (source || [])
    .map(item => getOrganizeId(item))
    .filter((id): id is string => Boolean(id));

  if (data?.dynamic?.includes(
    currentType === "member" ? RuntimeDynamic.CURRENT_USER : RuntimeDynamic.CURRENT_DEPARTMENT,
  )) {
    const dynamicIds = currentType === "member"
      ? [currentAccount?.id]
      : (currentAccount?.departments || []).slice(0, multiple ? undefined : 1);
    ids.push(...dynamicIds.filter((id): id is string => Boolean(id)));
  }

  const uniqueIds = [...new Set(ids)];
  return multiple ? uniqueIds : uniqueIds.slice(0, 1);
};

export const normalizeRuntimeOrganizeIds = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(getOrganizeId).filter((id): id is string => Boolean(id));
  const id = getOrganizeId(value);
  return id ? [id] : [];
};
