<template>
  <el-popover
    v-if="visible && referenceElement"
    :visible="visible"
    :virtual-ref="referenceElement"
    trigger="click"
    placement="bottom-start"
    :width="188"
    :offset="10"
    :show-arrow="false"
    :teleported="true"
    :popper-style="{
      background: '#fff',
      padding: '0px'
    }"
    popper-class="signature-qr-popper"
  >
    <div
      class="signature-qr-panel"
      :data-signature-qr-panel="widget.uid"
      @mousedown.stop
    >
      <div v-if="loading" class="signature-qr-loading">{{ $t("sessionLoading") }}</div>

      <template v-else-if="session">
        <div class="signature-qr-wrapper">
          <qrcode-vue
            v-if="session.deepLink"
            render-as="svg"
            :value="session.deepLink"
            :size="148"
            level="M"
            :margin="1"
          />
        </div>

        <div class="signature-qr-tip">{{ $t("scanQrShortTip") }}</div>
        <div class="signature-qr-status">{{ statusText }}</div>

        <div v-if="!session.serverReady" class="signature-qr-warning">
          {{ $t("sessionUnavailable") }}
        </div>

      </template>

      <div v-else class="signature-qr-warning">
        {{ i18next.t("sessionUnavailable") }}
      </div>
    </div>
  </el-popover>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import i18next, { $t } from "@renderer/widgets/i18next";
import type { HandwrittenSignature } from "./handwrittenSignature";
import QrcodeVue from "./vendor/qrcode.vue.esm.js";
import {
  cancelSignatureSession,
  createSignatureSession,
  getSignatureSessionStatus,
  type SignatureSession
} from "./signatureService";

const props = defineProps<{
  visible: boolean;
  widget: HandwrittenSignature;
  referenceElement?: HTMLElement | null;
}>();

const emit = defineEmits<{
  (event: "update:visible", value: boolean): void;
  (event: "signed", value: { signatureUrl: string; saveForReuse: boolean }): void;
}>();

const loading = ref(false);
const session = ref<SignatureSession | null>(null);
const sessionState = ref("pending");
let pollingTimer: number | null = null;
const statusText = computed(() => {
  if (sessionState.value === "signed") {
    return i18next.t("sessionSigned");
  }
  if (sessionState.value === "expired") {
    return i18next.t("sessionExpired");
  }
  if (sessionState.value === "canceled") {
    return i18next.t("sessionCanceled");
  }
  return i18next.t("sessionWaiting");
});

async function refreshStatus() {
  if (!session.value?.serverReady) {
    return;
  }

  try {
    const result = await getSignatureSessionStatus(props.widget, session.value.sessionId);
    sessionState.value = result.status;

    if (result.status === "signed" && result.signatureUrl) {
      stopPolling();
      emit("signed", {
        signatureUrl: result.signatureUrl,
        saveForReuse: !!result.saveForReuse
      });
      emit("update:visible", false);
      return;
    }

    if (result.status === "expired" || result.status === "canceled") {
      stopPolling();
    }
  } catch (_error) {
  }
}

function startPolling() {
  stopPolling();
  if (!session.value?.serverReady) {
    return;
  }

  pollingTimer = window.setInterval(() => {
    refreshStatus();
  }, 2000);
}

function stopPolling() {
  if (pollingTimer) {
    window.clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

async function initSession() {
  loading.value = true;
  sessionState.value = "pending";
  try {
    session.value = await createSignatureSession(props.widget);
  } catch (_error) {
    session.value = null;
  }
  loading.value = false;
  if (session.value) {
    startPolling();
  }
}

watch(
  () => props.visible,
  async (value) => {
    if (!value || loading.value) {
      return;
    }

    if (session.value?.serverReady && sessionState.value === "pending") {
      return;
    }

    await initSession();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopPolling();
  if (session.value?.serverReady && sessionState.value === "pending") {
    cancelSignatureSession(props.widget, session.value.sessionId);
  }
});
</script>

<style lang="scss">
.signature-qr-popper.el-popper {
  padding: 0 !important;
  border: none !important;
  background: #fff !important;
  box-shadow: none !important;
}

.signature-qr-panel {
  width: 188px;
  max-width: 100%;
  padding: 10px 10px 8px;
  border: 1px solid #e5e6eb;
  border-radius: 2px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
}

.signature-qr-wrapper {
  width: 160px;
  height: 160px;
  padding: 6px;
  border: 1px solid #f2f3f5;
  border-radius: 2px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.signature-qr-tip,
.signature-qr-status {
  text-align: center;
}

.signature-qr-tip {
  font-size: 12px;
  color: #86909c;
  line-height: 1.2;
}

.signature-qr-status {
  font-size: 12px;
  color: #4e5969;
}

.signature-qr-warning {
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(255, 125, 0, 0.08);
  color: #b54708;
  font-size: 12px;
}

.signature-qr-loading {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86909c;
  font-size: 12px;
}
</style>
