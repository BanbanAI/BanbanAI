<template>
  <div class="workbench-market">
    <section class="workbench-market-stage">
      <el-main class="workbench-market-page-main">
        <div
          v-loading="isIframeLoading || isInstallingApp"
          :element-loading-text="isInstallingApp ? $t('WorkbenchMarket.installing') : $t('WorkbenchMarket.loading')"
          element-loading-background="rgba(255, 255, 255, 0.88)"
          class="workbench-market-frame-shell"
        >
          <div v-if="iframeLoadState === 'error'" class="workbench-market-frame-error">
            <el-result
              icon="warning"
              :title="iframeErrorTitle"
              :sub-title="iframeErrorDescription"
            >
              <template #extra>
                <el-button type="primary" @click="retryLoadIframe">
                  {{ $t("WorkbenchMarket.retryLoad") }}
                </el-button>
                <el-button @click="openMarketInBrowser">
                  {{ $t("WorkbenchMarket.openInBrowser") }}
                </el-button>
              </template>
            </el-result>
          </div>
          <iframe
            v-if="iframeSrc"
            ref="iframeRef"
            :key="`${iframeSrc}:${iframeReloadKey}`"
            class="workbench-market-frame"
            :src="iframeSrc"
            frameborder="0"
            @load="handleIframeLoad"
            @error="handleIframeError"
          ></iframe>
        </div>
      </el-main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePassportStore } from "@renderer/stores";
import axios from "axios";
import i18next from "i18next";
import { ElMessage } from "element-plus";
import { ImportNocodeResult } from "@common/types/nocode";
import { useLocalizedDocumentTitle } from "@renderer/hooks/useLocalizedDocumentTitle";

type WorkbenchMarketMessage = {
  source: string;
  type: string;
  payload?: unknown;
  timestamp: number;
};

type WorkbenchMarketLoadAppPayload = {
  templateId?: string;
  [key: string]: unknown;
};

const WORKBENCH_MARKET_MESSAGE_EVENT = "workbench-market:message";
const WORKBENCH_MARKET_READY_EVENT = "workbench-market:ready";
const LOCAL_MARKET_IFRAME_SRC = "http://127.0.0.1:4200/market";
const REMOTE_MARKET_IFRAME_SRC = "https://www.banban.work/market";
const DEFAULT_MARKET_IFRAME_SRC = REMOTE_MARKET_IFRAME_SRC;
const IFRAME_LOAD_TIMEOUT = 12000;
const IFRAME_READY_FALLBACK_DELAY = 1500;

type WorkbenchMarketIframeState = "loading" | "ready" | "error";
type WorkbenchMarketIframeErrorType = "timeout" | "unavailable";

const route = useRoute();
const router = useRouter();
const passportState = usePassportStore();

passportState.init();
useLocalizedDocumentTitle(() => `${i18next.t("WorkbenchHomeHeader.workbench")} - ${i18next.t("WorkbenchMarket.title")}`);

const iframeRef = ref<HTMLIFrameElement | null>(null);
const isIframeLoading = ref(true);
const isInstallingApp = ref(false);
const iframeLoadState = ref<WorkbenchMarketIframeState>("loading");
const iframeErrorType = ref<WorkbenchMarketIframeErrorType>("timeout");
const iframeReloadKey = ref(0);
const lastReceivedMessage = ref<WorkbenchMarketMessage | null>(null);
const defaultMarketIframeSrc = ref(DEFAULT_MARKET_IFRAME_SRC);
let iframeLoadTimeoutTimer = 0;
let iframeReadyFallbackTimer = 0;
let iframeSessionId = 0;

const resolveValidIframeUrl = (urlValue: unknown) => {
  if (typeof urlValue !== "string" || !urlValue.trim()) {
    return "";
  }

  try {
    const url = new URL(urlValue.trim(), window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

const isSameIframeUrl = (urlValue: string, targetUrl: string) => {
  const normalizedUrl = resolveValidIframeUrl(urlValue);
  const normalizedTargetUrl = resolveValidIframeUrl(targetUrl);
  if (!normalizedUrl || !normalizedTargetUrl) {
    return false;
  }

  try {
    const url = new URL(normalizedUrl);
    const target = new URL(normalizedTargetUrl);
    return url.origin === target.origin && url.pathname.replace(/\/$/, "") === target.pathname.replace(/\/$/, "");
  } catch {
    return false;
  }
};

const queryIframeUrl = computed(() => resolveValidIframeUrl(route.query.iframeUrl));

const iframeSrc = computed(() => {
  if (queryIframeUrl.value) {
    return queryIframeUrl.value;
  }
  if (route.query.iframeUrl) {
    console.warn("Invalid workbench market iframe url:", route.query.iframeUrl);
  }
  return defaultMarketIframeSrc.value;
});

const iframeOrigin = computed(() => {
  try {
    const url = new URL(iframeSrc.value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : "";
  } catch {
    return "";
  }
});

const iframeErrorTitle = computed(() => {
  return i18next.t(
    iframeErrorType.value === "timeout"
      ? "WorkbenchMarket.loadTimeoutTitle"
      : "WorkbenchMarket.loadFailedTitle",
  );
});

const iframeErrorDescription = computed(() => {
  return i18next.t(
    iframeErrorType.value === "timeout"
      ? "WorkbenchMarket.loadTimeoutDescription"
      : "WorkbenchMarket.loadFailedDescription",
  );
});

const resolveTargetOrigin = () => {
  return iframeOrigin.value || "*";
};

const shouldFallbackToRemoteMarket = () => {
  return import.meta.env.DEV
    && !queryIframeUrl.value
    && isSameIframeUrl(defaultMarketIframeSrc.value, LOCAL_MARKET_IFRAME_SRC);
};

const switchToRemoteMarketIframeSrc = (reason: string) => {
  if (!shouldFallbackToRemoteMarket()) {
    return false;
  }

  clearIframeTimers();
  console.warn(`Switch workbench market iframe src to remote: ${reason}`);
  defaultMarketIframeSrc.value = REMOTE_MARKET_IFRAME_SRC;
  return true;
};

const buildMessage = (type: string, payload?: unknown): WorkbenchMarketMessage => ({
  source: "workbench-market-host",
  type,
  payload,
  timestamp: Date.now(),
});

const isWorkbenchMarketMessage = (data: unknown): data is WorkbenchMarketMessage => {
  if (!data || typeof data !== "object") return false;

  const message = data as Partial<WorkbenchMarketMessage>;
  return typeof message.source === "string" && typeof message.type === "string";
};

const postMessageToMarket = (type: string, payload?: unknown) => {
  const frameWindow = iframeRef.value?.contentWindow;
  if (!frameWindow) return false;

  frameWindow.postMessage(buildMessage(type, payload), resolveTargetOrigin());
  return true;
};

const clearIframeLoadTimeout = () => {
  if (!iframeLoadTimeoutTimer) return;
  window.clearTimeout(iframeLoadTimeoutTimer);
  iframeLoadTimeoutTimer = 0;
};

const clearIframeReadyFallback = () => {
  if (!iframeReadyFallbackTimer) return;
  window.clearTimeout(iframeReadyFallbackTimer);
  iframeReadyFallbackTimer = 0;
};

const clearIframeTimers = () => {
  clearIframeLoadTimeout();
  clearIframeReadyFallback();
};

const markIframeReady = (sessionId = iframeSessionId) => {
  if (sessionId !== iframeSessionId) return;
  clearIframeTimers();
  iframeLoadState.value = "ready";
  isIframeLoading.value = false;
};

const markIframeError = (type: WorkbenchMarketIframeErrorType, sessionId = iframeSessionId) => {
  if (sessionId !== iframeSessionId) return;
  if (switchToRemoteMarketIframeSrc(type)) {
    return;
  }
  clearIframeTimers();
  iframeLoadState.value = "error";
  iframeErrorType.value = type;
  isIframeLoading.value = false;
};

const startIframeLoadSession = () => {
  iframeSessionId += 1;
  clearIframeTimers();
  iframeLoadState.value = "loading";
  iframeErrorType.value = "timeout";
  isIframeLoading.value = true;

  const sessionId = iframeSessionId;
  iframeLoadTimeoutTimer = window.setTimeout(() => {
    markIframeError("timeout", sessionId);
  }, IFRAME_LOAD_TIMEOUT);
};

const scheduleLegacyReadyFallback = (sessionId = iframeSessionId) => {
  if (sessionId !== iframeSessionId) return;
  clearIframeLoadTimeout();
  clearIframeReadyFallback();
  iframeReadyFallbackTimer = window.setTimeout(() => {
    if (sessionId !== iframeSessionId) return;
    markIframeReady(sessionId);
  }, IFRAME_READY_FALLBACK_DELAY);
};

const retryLoadIframe = () => {
  iframeReloadKey.value += 1;
  startIframeLoadSession();
};

const openMarketInBrowser = () => {
  window.open(iframeSrc.value, "_blank");
};

const handleIframeLoad = () => {
  clearIframeLoadTimeout();
  if (iframeLoadState.value === "ready") {
    return;
  }
  scheduleLegacyReadyFallback();
};

const handleIframeError = () => {
  markIframeError("unavailable");
};

const resolveLoadAppTemplateId = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const messagePayload = payload as WorkbenchMarketLoadAppPayload;
  return typeof messagePayload.templateId === "string" && messagePayload.templateId.trim()
    ? messagePayload.templateId.trim()
    : "";
};

const resolveErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Install template app failed";
};

const installTemplateApp = async (templateId: string) => {
  if (!templateId || isInstallingApp.value) {
    return;
  }

  isInstallingApp.value = true;
  try {
    const { data } = await axios.post<ImportNocodeResult>("/market/install-template-app", {
      templateId,
    });
    const nocodeId = data?.meta?.id;
    if (!nocodeId) {
      throw new Error(data?.reason || "Install template app failed");
    }
    await router.push(`/app/${nocodeId}/`);
  } catch (error) {
    ElMessage.error(resolveErrorMessage(error));
  } finally {
    isInstallingApp.value = false;
  }
};

const handleMarketMessage = async (message: WorkbenchMarketMessage) => {
  markIframeReady();
  lastReceivedMessage.value = message;

  if (message.type === WORKBENCH_MARKET_READY_EVENT) {
    return;
  }

  if (message.type === "banban:load-app") {
    const templateId = resolveLoadAppTemplateId(message.payload);
    if (!templateId) {
      return;
    }
    await installTemplateApp(templateId);
  }
};

const handleWindowMessage = (event: MessageEvent<WorkbenchMarketMessage | null>) => {
  if (event.source !== iframeRef.value?.contentWindow) return;
  if (iframeOrigin.value && event.origin !== iframeOrigin.value) {
    return;
  }
  const data = event.data;
  if (!isWorkbenchMarketMessage(data) || data.source !== "workbench-market-iframe") {
    return;
  }

  void handleMarketMessage(data);
};

defineExpose({
  postMessageToMarket,
  lastReceivedMessage,
  workbenchMarketMessageEvent: WORKBENCH_MARKET_MESSAGE_EVENT,
});

onMounted(() => {
  window.addEventListener("message", handleWindowMessage);
});

watch(() => iframeSrc.value, (value) => {
  if (!value) {
    clearIframeTimers();
    iframeLoadState.value = "loading";
    iframeErrorType.value = "timeout";
    isIframeLoading.value = true;
    return;
  }
  startIframeLoadSession();
}, { immediate: true });

onBeforeUnmount(() => {
  clearIframeTimers();
  window.removeEventListener("message", handleWindowMessage);
});
</script>

<style scoped lang="scss">
.workbench-market {
  width: 100%;
  height: 100%;
  min-width: 1040px;
  background-color: #f2f3f5;
  overflow: hidden;

  .workbench-market-stage {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #f2f3f5;
  }

  .workbench-market-page-main {
    flex: 1;
    min-height: 0;
    padding: 0 !important;
  }

  .workbench-market-frame-shell {
    position: relative;
    width: 100%;
    height: 100%;
    background-color: #fff;
  }

  .workbench-market-frame-error {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background-color: rgba(255, 255, 255, 0.96);
  }

  .workbench-market-frame {
    display: block;
    width: 100%;
    height: 100%;
    background-color: #fff;
  }
}
</style>
