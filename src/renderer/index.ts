import { measureStart } from "@renderer/b2/utils/measure";
measureStart("loading");
import { createApp, defineAsyncComponent, nextTick } from "vue";
import { waitForBootReadySignal } from "./boot/bootReady";
import {
  clearBootDynamicImportRecoveryBudget,
  shouldAutoRecoverFromBootFailure,
} from "./boot/bootFailureRecovery";
import { initApp } from "./hooks/common";
import { normalizeAxiosRequestConfig } from "./hooks/request";

import App from "./App.vue";
import router from "./router";

import axios, { AxiosResponse } from "axios";
import i18next from "i18next";
import I18NextVue from "i18next-vue";
import { ElMessage } from "element-plus";
import { bootLanguageStore } from '@renderer/utils/storage';

const BOOT_REQUEST_TIMEOUT = 60000;
const BOOT_RETRY_DELAY = 1500;
const BOOT_SPLASH_SLOW_TIMEOUT = 12000;
const BOOT_MAX_WAIT_MS = 30000;
const BOOT_RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const BOOT_RETRYABLE_ERROR_CODES = new Set(["ERR_NETWORK", "ECONNABORTED", "ECONNREFUSED"]);

type BootClientInfo = {
  lang?: string;
  clientUUID?: string;
};

type BootPreferences = Record<string, any>;

type BootLangResources = Record<string, any>;

type BootSplashState = "loading" | "retrying" | "error";

type BootSplashUpdate = {
  lang?: string;
  state?: BootSplashState;
};

declare global {
  interface Window {
    __updateBootSplash?: (payload: BootSplashUpdate) => void;
  }
}


// 添加请求拦截器
axios.interceptors.request.use(async function (config) {
  return await normalizeAxiosRequestConfig(config);
}, function (error) {
  return Promise.reject(error);
});

// 添加响应拦截器
axios.interceptors.response.use(function (response) {
  return response;
}, function (error) {
  if (error.response?.status === 403) {
    const silentForbidden = Boolean((error.config as any)?.silentForbidden);
    if (!silentForbidden) {
      ElMessage.error(error.response.data.message);
    }
  }
  return Promise.reject(error);
});

const app = createApp(App);

app.component("ProjectEditor", defineAsyncComponent(() =>
  import('./views/main/project/ProjectEditor.vue')
));
app.component("ProjectViewer", defineAsyncComponent(() =>
  import('./views/main/project/ProjectViewer.vue')
));
app.component("NocodeEditor", defineAsyncComponent(() =>
  import('./views/nocode/views/editor/NocodeEditor.vue')
));

app.use(router);

let bootSplashSettled = false;
let bootSplashSlowTimer = 0;

const updateBootSplash = (payload: BootSplashUpdate) => {
  window.__updateBootSplash?.(payload);
};

const clearBootSplashSlowTimer = () => {
  if (!bootSplashSlowTimer) return;
  window.clearTimeout(bootSplashSlowTimer);
  bootSplashSlowTimer = 0;
}

const markBootReady = () => {
  if (bootSplashSettled) return;
  bootSplashSettled = true;
  clearBootSplashSlowTimer();
  clearBootDynamicImportRecoveryBudget(window.sessionStorage);
  const html = document.documentElement;
  const splash = document.querySelector(".boot-splash");
  html.setAttribute("data-app-ready", "true");
  if (!splash) return;
  window.setTimeout(() => {
    splash.remove();
  }, 220);
}

const markBootFailed = () => {
  if (bootSplashSettled) return;
  bootSplashSettled = true;
  clearBootSplashSlowTimer();
  updateBootSplash({ state: "error" });
}

const hideBootSplashWhenReady = async () => {
  await router.isReady();
  await nextTick();
  await waitForBootReadySignal({
    requestAnimationFrame: typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : undefined,
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    visibilityState: document.visibilityState,
  });
  markBootReady();
}

const scheduleBootSplashSlowState = () => {
  clearBootSplashSlowTimer();
  bootSplashSlowTimer = window.setTimeout(() => {
    if (bootSplashSettled) return;
    console.warn("boot splash slow start");
    updateBootSplash({ state: "retrying" });
  }, BOOT_SPLASH_SLOW_TIMEOUT);
}

const sleep = (ms: number) => {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const getBootResponseData = <T>(response: AxiosResponse<T> | null, label: string) => {
  if (response) {
    return response.data;
  }
  throw new Error(`${label} response is empty`);
}

const isRetryableBootError = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  if (status !== undefined) {
    return BOOT_RETRYABLE_STATUS_CODES.has(status);
  }
  if (error.code && BOOT_RETRYABLE_ERROR_CODES.has(error.code)) {
    return true;
  }
  return !!error.request && !error.response;
}

const loadBootData = async () => {
  const language = navigator.language || "zh-CN";
  const requestConfig = { timeout: BOOT_REQUEST_TIMEOUT };
  const [clientInfoResponse, langsResponse, preferencesResponse] = await Promise.all([
    axios.post(`/user/client-info`, { lang: language }, requestConfig),
    axios.get(`/locales/lang.json`, requestConfig),
    axios.get(`/locales/preferences.json`, requestConfig),
  ]);

  return {
    clientInfo: getBootResponseData<BootClientInfo>(clientInfoResponse, "client info"),
    langs: getBootResponseData<BootLangResources>(langsResponse, "langs"),
    preferences: getBootResponseData<BootPreferences>(preferencesResponse, "preferences"),
  };
}

const waitForBootData = async () => {
  const startedAt = Date.now();
  let attempt = 0;
  let lastError: unknown;
  while (true) {
    try {
      return await loadBootData();
    } catch (err) {
      if (!isRetryableBootError(err)) {
        throw err;
      }
      lastError = err;
      attempt += 1;
      const elapsedMs = Date.now() - startedAt;
      console.log(`load boot data err, retry #${attempt}, elapsed ${elapsedMs}ms`, err);
      updateBootSplash({ state: "retrying" });
      if (elapsedMs >= BOOT_MAX_WAIT_MS) {
        console.error(`load boot data timeout after ${elapsedMs}ms and ${attempt} retries`, err);
        break;
      }
      await sleep(BOOT_RETRY_DELAY);
    }
  }
  throw lastError ?? new Error(`boot data load timeout after ${BOOT_MAX_WAIT_MS}ms`);
}

const initI18nPlugin = async (lang: string, resources: BootLangResources) => {
  await new Promise<void>((resolve) => {
    i18next.init({
      lng: lang,
      fallbackLng: "zh-CN",
      resources,
    }, () => {
      app.use(I18NextVue, { i18next });
      resolve();
    });
  });
}

const initPreferenceBridge = (preferences: BootPreferences) => {
  const $p = (key: string) => {
    return preferences[key];
  }
  app.config.globalProperties.$p = $p;
  window.$p = $p;
}

const bootstrapApp = async () => {
  const initialBootLanguage = bootLanguageStore.get() || navigator.language || 'zh-CN';
  updateBootSplash({ lang: initialBootLanguage, state: 'loading' });
  scheduleBootSplashSlowState();
  try {
    const { clientInfo, langs, preferences } = await waitForBootData();
    const bootLanguage = bootLanguageStore.get() || navigator.language || 'zh-CN';
    const language = clientInfo.lang || bootLanguage;
    updateBootSplash({ lang: language, state: 'loading' });
    bootLanguageStore.set(language);
    await initI18nPlugin(language, langs);
    initPreferenceBridge(preferences);
    initApp(app);
    await hideBootSplashWhenReady();
  } catch(err) {
    console.log("init app err ", err);
    if (shouldAutoRecoverFromBootFailure(err, window.sessionStorage)) {
      console.warn('boot dynamic import failed, reload once for recovery', err);
      window.location.reload();
      return;
    }
    markBootFailed();
  }
}

void bootstrapApp();
