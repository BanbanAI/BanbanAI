import { SaasPlan } from "@common/types/user";
import i18next from "i18next";
import { themeStore } from "./storage";
import { ClientTheme } from "@renderer/types/base";
import { inject, provide, ref } from 'vue';
import { FormTableRuntime, MemberShowInfo, OrganizeData, MemberShowField } from "@common/types/nocode";
import { Account } from "@common/types/account";
import { FormDataDistinctOptions, DistinctCountResult, useFormDataDistinctCacheStore } from "@renderer/stores/formDataDistinctCache";

type DisplayUser = Pick<Account,
  'realname' | 'user' | 'staffNo' | 'phone' | 'email'
> & {
  departments?: string[],
  roles?: string[],
}

export const destroy3D = () => {
  const allCanvas = document.querySelectorAll('canvas');
  for (const canvas of allCanvas) {
    const webgl2 = canvas.getContext('webgl2');
    if(!webgl2) continue;
    webgl2.getExtension('WEBGL_lose_context').loseContext();
  }
}

const theme = ref<ClientTheme>(ClientTheme.Dark);
export const useTheme = () => {
  const setTheme = (value: ClientTheme) => {
    theme.value = value
    if (value === ClientTheme.Light) {
      document.documentElement.classList.remove("dark")
    } else {
      document.documentElement.classList.add("dark")
    }
    themeStore.set(value);
  }

  const initTheme = () => {
    theme.value = themeStore.get();
    if (!theme.value) {
      // @ts-ignore
      theme.value = ClientTheme.Light;
      themeStore.set(theme.value);
    }
  }

  initTheme();

  return {
    theme,
    setTheme,
  }
}

export type FormDataDistinctHost = {
  distinct: (payload: FormDataDistinctOptions) => Promise<any[] | null>;
  distinctCount: (payload: FormDataDistinctOptions) => Promise<DistinctCountResult[] | null>;
  markDistinctDirty: () => void;
}

let currentFormDataDistinctHost: FormDataDistinctHost | null = null;

export const createFormDataDistinctHost = (): FormDataDistinctHost => {
  const store = useFormDataDistinctCacheStore();
  return {
    distinct: async (payload) => await store.getDistinct(payload),
    distinctCount: async (payload) => await store.getDistinctCount(payload),
    markDistinctDirty: () => store.markAllDirty(),
  };
}

export const provideFormDataDistinctHost = (host: FormDataDistinctHost = createFormDataDistinctHost()) => {
  currentFormDataDistinctHost = host;
  (globalThis as any).__formDataDistinctHost = host;
  provide("__form_data_distinct_host__", host);
}

export const getFormDataDistinctHost = (): FormDataDistinctHost | null => {
  return currentFormDataDistinctHost || (globalThis as any).__formDataDistinctHost || null;
}

export const useFormDataDistinctHost = (): FormDataDistinctHost | null => {
  return inject("__form_data_distinct_host__", getFormDataDistinctHost());
}

export const provideRuntime = (runtime: FormTableRuntime) => {
  provide("__runtime__", runtime);
  provideFormDataDistinctHost();
}

export const useRuntime = (): FormTableRuntime => {
  return inject("__runtime__");
}

export const useSaasPlanText = (plan: SaasPlan) => {
  if (plan === SaasPlan.ENTERPRISE) return i18next.t("ENTERPRISE");
  else if (plan === SaasPlan.BUSINESS) return i18next.t("BUSINESS");
  else if (plan === SaasPlan.PROFESSIONAL) return i18next.t("PROFESSIONAL");
  else if (plan === SaasPlan.PREMIUM) return i18next.t("PREMIUM");
  else return i18next.t("FREE");
}

export const getUserBaseName = (
  user?: DisplayUser | null,
  fallback = i18next.t('other.unknowMember'),
) => {
  return user?.realname || user?.user || fallback;
}

export const getUserDisplayName = (
  user?: DisplayUser | null,
  fallback = i18next.t('other.unknowMember'),
) => {
  if (!user) {
    return fallback;
  }
  const userName = getUserBaseName(user, fallback);
  return userName;
}

const getExistingUserDisplayName = (user?: DisplayUser | null) => {
  if (!user) {
    return "";
  }
  const userName = getUserBaseName(user, "");
  if (!userName) {
    return "";
  }
  return userName;
}

const pushUniqueValues = (target: string[], values: Array<string | undefined>) => {
  values.forEach(value => {
    if (value && !target.includes(value)) {
      target.push(value);
    }
  });
}

const getUserDisplaySegments = (
  user?: DisplayUser | null,
  organize?: Partial<Pick<OrganizeData, "departments" | "roles">>,
  showInfo: MemberShowInfo = [],
  options: {
    includeName?: boolean,
    fallback?: string,
  } = {},
) => {
  if (!user) {
    return [];
  }

  const segments: string[] = [];
  const deptMap = new Map((organize?.departments || []).map(d => [d.id, d.name]));
  const roleMap = new Map((organize?.roles || []).map(r => [r.id, r.name]));
  const fields = showInfo.length
    ? showInfo
    : (options.includeName ? [MemberShowField.NAME] : []);

  fields.forEach(field => {
    switch (field) {
    case MemberShowField.NAME:
      pushUniqueValues(segments, [getExistingUserDisplayName(user)]);
      break;
    case MemberShowField.STAFF_NO:
      pushUniqueValues(segments, [user.staffNo]);
      break;
    case MemberShowField.PHONE:
      pushUniqueValues(segments, [user.phone]);
      break;
    case MemberShowField.EMAIL:
      pushUniqueValues(segments, [user.email]);
      break;
    case MemberShowField.DEPARTMENT:
      pushUniqueValues(segments, (user.departments || []).map(id => deptMap.get(id)));
      break;
    case MemberShowField.ROLE:
      pushUniqueValues(segments, (user.roles || []).map(id => roleMap.get(id)));
      break;
    default:
      break;
    }
  });

  return segments;
}

export const displayUserInfoByUser = (
  user?: DisplayUser | null,
  organize?: Partial<Pick<OrganizeData, "departments" | "roles">>,
  showInfo: MemberShowInfo = [],
  fallback = i18next.t('other.unknowMember'),
): string => {
  if (!user) return fallback;
  const parts: string[] = [getUserDisplayName(user, fallback)];
  const extras = getUserDisplaySegments(
    user,
    organize,
    showInfo.filter(field => field !== MemberShowField.NAME),
    { fallback },
  );

  if (extras.length > 0) {
    parts.push(`(${extras.join(", ")})`);
  }

  return parts.join(" ");
}

export const displayUserInfo = (userId: string, organize: OrganizeData, showInfo: MemberShowInfo): string => {
  const user = organize.users.find(item => item.id === userId);
  return displayUserInfoByUser(user, organize, showInfo);
}

export const displayUserInfoByUserFlat = (
  user?: DisplayUser | null,
  organize?: Partial<Pick<OrganizeData, "departments" | "roles">>,
  showInfo: MemberShowInfo = [],
  fallback = i18next.t('other.unknowMember'),
): string => {
  if (!user) return fallback;
  const segments = getUserDisplaySegments(user, organize, showInfo, {
    includeName: true,
    fallback,
  });
  return segments.length ? segments.join(" - ") : "";
}

export const displayUserInfoFlat = (
  userId: string,
  organize: OrganizeData,
  showInfo: MemberShowInfo,
): string => {
  const user = organize.users.find(item => item.id === userId);
  return displayUserInfoByUserFlat(user, organize, showInfo);
}
