import { ref } from "vue";

export type WorkbenchAiAppOption = {
  id: string;
  name: string;
};

export type AccessibleAppItem = {
  id?: string;
  name?: string;
  meta?: {
    id?: string;
    name?: string;
  };
};

export type HandoffPreferredApp = {
  id?: string;
  name?: string;
};

export type HandoffTargetAppRecommendation = {
  key: string;
  id?: string;
  name: string;
  available: boolean;
};

export type HandoffTargetAppSections = {
  autoSelectedAppId: string;
  recommendedOptions: HandoffTargetAppRecommendation[];
  remainingOptions: WorkbenchAiAppOption[];
};

type LoadAppOptionsOptions = {
  force?: boolean;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const buildAppMatchKey = (app: Pick<WorkbenchAiAppOption, "id" | "name">) => {
  const id = normalizeText(app.id);
  const name = normalizeText(app.name);
  return `${id}::${name}`;
};

export const normalizeAccessibleAppOptions = (value: unknown): WorkbenchAiAppOption[] => {
  return (Array.isArray(value) ? value : [])
    .map((item: AccessibleAppItem) => ({
      id: normalizeText(item?.id || item?.meta?.id),
      name: normalizeText(item?.name || item?.meta?.name),
    }))
    .filter(item => item.id)
    .map(item => ({
      ...item,
      name: item.name || item.id,
    }));
};

export const buildHandoffTargetAppSections = (payload: {
  appOptions: WorkbenchAiAppOption[];
  preferredApps?: HandoffPreferredApp[] | null;
}): HandoffTargetAppSections => {
  const preferredApps = Array.isArray(payload.preferredApps) ? payload.preferredApps : [];
  const appOptions = Array.isArray(payload.appOptions) ? payload.appOptions : [];
  const matchedKeys = new Set<string>();
  const recommendedOptions: HandoffTargetAppRecommendation[] = [];

  preferredApps.forEach(preferredApp => {
    const preferredId = normalizeText(preferredApp.id);
    const preferredName = normalizeText(preferredApp.name);
    if (!preferredId && !preferredName) {
      return;
    }

    const matchedApp = appOptions.find(app => (
      (preferredId && app.id === preferredId)
      || (preferredName && app.name === preferredName)
    ));

    if (matchedApp) {
      const matchedKey = buildAppMatchKey(matchedApp);
      if (matchedKeys.has(matchedKey)) {
        return;
      }

      matchedKeys.add(matchedKey);
      recommendedOptions.push({
        key: `app:${matchedApp.id}`,
        id: matchedApp.id,
        name: matchedApp.name,
        available: true,
      });
      return;
    }

    if (!preferredName) {
      return;
    }

    const missingKey = `missing:${preferredName}`;
    if (recommendedOptions.some(option => option.key === missingKey)) {
      return;
    }

    recommendedOptions.push({
      key: missingKey,
      name: preferredName,
      available: false,
    });
  });

  const remainingOptions = appOptions.filter(app => !matchedKeys.has(buildAppMatchKey(app)));
  const hasUnavailableRecommendedApp = recommendedOptions.some(option => !option.available);
  const availableRecommendedApps = recommendedOptions.filter(option => option.available && option.id);
  const autoSelectedAppId = (
    availableRecommendedApps.length === 1
    && !hasUnavailableRecommendedApp
  )
    ? String(availableRecommendedApps[0].id)
    : "";

  return {
    autoSelectedAppId,
    recommendedOptions,
    remainingOptions,
  };
};

export const createAccessibleAppOptionsLoader = (
  fetchAccessibleApps: () => Promise<unknown>,
) => {
  const appOptions = ref<WorkbenchAiAppOption[]>([]);
  const appOptionsLoaded = ref(false);
  const appOptionsLoading = ref(false);
  const appOptionsLoadFailed = ref(false);
  let pendingLoad: Promise<void> | null = null;

  const runLoad = async () => {
    appOptionsLoading.value = true;
    try {
      const data = await fetchAccessibleApps();
      appOptions.value = normalizeAccessibleAppOptions(data);
      appOptionsLoaded.value = true;
      appOptionsLoadFailed.value = false;
    } catch (error) {
      appOptionsLoadFailed.value = true;
      throw error;
    } finally {
      appOptionsLoading.value = false;
      pendingLoad = null;
    }
  };

  const loadAppOptions = async (options: LoadAppOptionsOptions = {}) => {
    if (pendingLoad) {
      return pendingLoad;
    }

    if (appOptionsLoaded.value && !options.force) {
      return;
    }

    pendingLoad = runLoad();
    return pendingLoad;
  };

  const ensureAppOptionsLoaded = async () => {
    await loadAppOptions({
      force: appOptionsLoadFailed.value || !appOptionsLoaded.value,
    });
  };

  return {
    appOptions,
    appOptionsLoaded,
    appOptionsLoading,
    appOptionsLoadFailed,
    ensureAppOptionsLoaded,
    loadAppOptions,
  };
};
