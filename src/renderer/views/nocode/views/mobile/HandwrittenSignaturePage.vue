<template>
  <div class="signature-page">
    <div class="signature-shell" :class="{ landscape }">
      <template v-if="submitted">
        <div class="signature-result">
          <div class="signature-result__icon">{{ $t("HandwrittenSignaturePage.resultIcon") }}</div>
          <div class="signature-result__title">{{ $t("HandwrittenSignaturePage.submitSuccessTitle") }}</div>
          <div class="signature-result__desc">
            {{ isExternal ? $t("HandwrittenSignaturePage.externalSubmittedDesc") : $t("HandwrittenSignaturePage.internalSubmittedDesc") }}
          </div>
          <button v-if="isExternal" class="result-button" type="button" @click="goToLogin">
            {{ $t("HandwrittenSignaturePage.goLogin") }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="signature-layout" :class="{ landscape }">
          <div class="signature-hint">{{ $t("HandwrittenSignaturePage.hintLandscape") }}</div>

          <section class="signature-stage" :class="{ landscape }">
            <div class="signature-board">
              <canvas
                ref="canvasRef"
                class="signature-canvas"
                @pointerdown="handlePointerDown"
                @pointermove="handlePointerMove"
                @pointerup="handlePointerUp"
                @pointercancel="handlePointerUp"
                @pointerleave="handlePointerUp"
              ></canvas>

              <div v-if="!hasDrawing" class="signature-placeholder"></div>
            </div>

          </section>
          <button class="rotate-fab" type="button" :title="$t('HandwrittenSignaturePage.rotateTitle')" @click="toggleOrientation">
            <el-icon><i-ven-phone-rotate /></el-icon>
          </button>

          <div class="signature-spacer"></div>

          <div class="signature-bottom" :class="{ landscape }">
            <div class="signature-meta">
              <label class="reuse-option">
                <input v-model="saveForReuse" type="checkbox" />
                <span>{{ $t("HandwrittenSignaturePage.saveForReuse") }}</span>
              </label>

              <button v-if="hasDrawing" class="rewrite-link" type="button" @click="handleRewrite">
                <el-icon><Delete /></el-icon>
                <span>{{ $t("HandwrittenSignaturePage.rewrite") }}</span>
              </button>
            </div>

            <footer class="signature-footer" :class="{ landscape }">
              <button class="footer-button footer-button--cancel" type="button" @click="handleCancel">
                {{ $t("HandwrittenSignaturePage.cancel") }}
              </button>
              <button class="footer-button footer-button--confirm" type="button" :disabled="submitting" @click="handleConfirm">
                {{ submitting ? $t("HandwrittenSignaturePage.submitting") : $t("HandwrittenSignaturePage.confirm") }}
              </button>
            </footer>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { Delete } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import i18next from "i18next";
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const RESULT_PREFIX = "handwritten-signature-result:";
const canvasRef = ref<HTMLCanvasElement | null>(null);
const landscape = ref(false);
const drawing = ref(false);
const hasDrawing = ref(false);
const submitting = ref(false);
const submitted = ref(false);
const saveForReuse = ref(false);

let context: CanvasRenderingContext2D | null = null;

const nocodeId = String(route.query.nocodeId || "");
const signatureFieldUid = String(route.query.signatureFieldUid || "");
const sessionId = String(route.query.signatureSessionId || route.query.sessionId || "");
const requestId = String(route.query.requestId || "");
function resolveReturnUrl() {
  const raw = Array.isArray(route.query.returnUrl) ? route.query.returnUrl[0] : route.query.returnUrl;
  if (!raw) {
    return "";
  }

  const textValue = String(raw);
  try {
    return decodeURIComponent(textValue);
  } catch (_error) {
    return textValue;
  }
}
const returnUrl = resolveReturnUrl();
const isExternal = route.query.external === "1";
function getApiBase() {
  return "/signature";
}

function getResultStorageKey() {
  return `${RESULT_PREFIX}${requestId}`;
}

function getReusableStorageKey() {
  if (!nocodeId || !signatureFieldUid) {
    return "";
  }

  return `handwritten-signature-reuse:${nocodeId}:${signatureFieldUid}`;
}

function updateBodyLock(locked: boolean) {
  document.body.style.overflow = locked ? "hidden" : "";
}

async function lockScreenOrientation(nextLandscape: boolean) {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
    await window.screen?.orientation?.lock?.(nextLandscape ? "landscape" : "portrait");
  } catch (_error) {
  }
}

function unlockScreenOrientation() {
  try {
    window.screen?.orientation?.unlock?.();
  } catch (_error) {
  }

  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen();
    }
  } catch (_error) {
  }
}

function getLoginUrl() {
  return `${window.location.origin}${window.location.pathname}#/login`;
}

function goToLogin() {
  window.location.replace(getLoginUrl());
}

async function completeSession(signatureUrl: string) {
  if (!sessionId) {
    return;
  }

  await axios.post(`${getApiBase()}/session/complete`, {
    sessionId,
    signatureUrl,
    saveForReuse: saveForReuse.value
  });
}

async function fetchSessionStatus() {
  if (!sessionId) {
    return null;
  }

  return axios
    .get(`${getApiBase()}/session/status`, {
      params: {
        sessionId
      }
    })
    .then(({ data }) => data?.data || data || null)
    .catch(() => null);
}

async function cancelSession() {
  if (!sessionId) {
    return;
  }

  await axios
    .post(`${getApiBase()}/session/cancel`, {
      sessionId
    })
    .catch(() => {});
}

async function uploadSignatureFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", file.name);
  formData.append("projectId", "");
  formData.append("nocodeId", nocodeId);

  const response = await axios.post("/uploader/uploadFile", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  const payload = response.data?.data || response.data || {};
  const url = payload.url || payload?.data?.url;

  if (!url) {
    throw new Error(i18next.t("HandwrittenSignaturePage.uploadFailedRetry"));
  }

  return url;
}

function getCanvasPoint(event: PointerEvent) {
  const canvas = canvasRef.value;
  if (!canvas) {
    return { x: 0, y: 0 };
  }

  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function getCanvasSnapshot() {
  const canvas = canvasRef.value;
  if (!canvas || !hasDrawing.value) {
    return "";
  }

  return canvas.toDataURL("image/png");
}

function initCanvas(snapshot = "") {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));

  context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(ratio, ratio);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3;
  context.strokeStyle = "#1d2129";
  context.clearRect(0, 0, rect.width, rect.height);

  if (!snapshot) {
    return;
  }

  const image = new Image();
  image.onload = () => {
    context?.clearRect(0, 0, rect.width, rect.height);
    context?.drawImage(image, 0, 0, rect.width, rect.height);
    hasDrawing.value = true;
  };
  image.src = snapshot;
}

function resetCanvas() {
  const canvas = canvasRef.value;
  if (!canvas || !context) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  context.clearRect(0, 0, rect.width, rect.height);
  hasDrawing.value = false;
}

function handlePointerDown(event: PointerEvent) {
  if (!context) {
    return;
  }

  const { x, y } = getCanvasPoint(event);
  drawing.value = true;
  hasDrawing.value = true;
  canvasRef.value?.setPointerCapture?.(event.pointerId);
  context.beginPath();
  context.moveTo(x, y);
}

function handlePointerMove(event: PointerEvent) {
  if (!drawing.value || !context) {
    return;
  }

  const { x, y } = getCanvasPoint(event);
  context.lineTo(x, y);
  context.stroke();
}

function handlePointerUp(event?: PointerEvent) {
  drawing.value = false;
  if (event) {
    canvasRef.value?.releasePointerCapture?.(event.pointerId);
  }
}

function handleRewrite() {
  resetCanvas();
}

async function toggleOrientation() {
  const snapshot = getCanvasSnapshot();
  const nextLandscape = !landscape.value;
  await lockScreenOrientation(nextLandscape);
  landscape.value = nextLandscape;
  await nextTick();
  initCanvas(snapshot);
}

function canvasToBlob() {
  return new Promise<Blob | null>((resolve) => {
    canvasRef.value?.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function goBackWithResult(signatureUrl: string) {
  if (requestId) {
    window.localStorage.setItem(
      getResultStorageKey(),
      JSON.stringify({
        signatureUrl,
        saveForReuse: saveForReuse.value,
        updatedAt: Date.now()
      })
    );
  }

  if (returnUrl) {
    window.location.replace(returnUrl);
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  submitted.value = true;
}

function saveReusableSignatureLocally(signatureUrl: string) {
  const storageKey = getReusableStorageKey();
  if (!storageKey || !signatureUrl || !saveForReuse.value) {
    return;
  }

  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      signatureUrl,
      updatedAt: Date.now()
    })
  );
}

async function handleConfirm() {
  if (!hasDrawing.value) {
    ElMessage.warning(i18next.t("HandwrittenSignaturePage.signatureEmpty"));
    return;
  }

  const blob = await canvasToBlob();
  if (!blob) {
    ElMessage.warning(i18next.t("HandwrittenSignaturePage.signatureEmpty"));
    return;
  }

  submitting.value = true;

  try {
    const file = new File([blob], `signature-${Date.now()}.png`, {
      type: "image/png"
    });
    const signatureUrl = await uploadSignatureFile(file);

    if (sessionId) {
      await completeSession(signatureUrl);
    }

    saveReusableSignatureLocally(signatureUrl);
    ElMessage.success(saveForReuse.value
      ? i18next.t("HandwrittenSignaturePage.saveSuccess")
      : i18next.t("HandwrittenSignaturePage.submitSuccess"));
    await goBackWithResult(signatureUrl);
  } catch (_error) {
    ElMessage.error(i18next.t("HandwrittenSignaturePage.submitFailed"));
  } finally {
    submitting.value = false;
  }
}

async function handleCancel() {
  await cancelSession();

  if (returnUrl) {
    window.location.href = returnUrl;
    return;
  }

  if (isExternal) {
    goToLogin();
    return;
  }

  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.replace("/");
}

async function handleResize() {
  const snapshot = getCanvasSnapshot();
  await nextTick();
  initCanvas(snapshot);
}

onMounted(async () => {
  updateBodyLock(true);
  await lockScreenOrientation(false);

  const sessionStatus = await fetchSessionStatus();
  if (sessionStatus?.status === "signed") {
    submitted.value = true;
    return;
  }

  await nextTick();
  initCanvas();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  unlockScreenOrientation();
  updateBodyLock(false);
});
</script>

<style scoped lang="scss">
.signature-page {
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: #ffffff;
}

.signature-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
}

.signature-layout {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100%;
  padding: calc(20px + env(safe-area-inset-top, 0px)) 20px calc(18px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

.signature-hint {
  flex: 0 0 auto;
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 20px;
  color: #99a2b0;
}

.signature-stage {
  position: relative;
  flex: 0 0 auto;
  z-index: 1;
}

.signature-board {
  position: relative;
  width: 100%;
  height: 268px;
  background: #fbfcfe;
  border: 1px dashed #edf1f5;
  border-radius: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.signature-canvas {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}

.signature-placeholder {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: transparent;
}

.rotate-fab {
  position: absolute;
  right: 22px;
  bottom: calc(98px + env(safe-area-inset-bottom, 0px));
  z-index: 2;
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 50%;
  background: #1f6fff;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(31, 111, 255, 0.24);
}

.rotate-fab :deep(.el-icon) {
  font-size: 22px;
}

.signature-spacer {
  display: none;
}

.signature-bottom {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 16px;
}

.signature-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
}

.reuse-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #5f6877;
}

.reuse-option input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #1f6fff;
}

.rewrite-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: #5f6877;
  font-size: 13px;
  white-space: nowrap;
  padding: 0;
}

.rewrite-link :deep(.el-icon) {
  font-size: 14px;
}

.signature-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: auto;
  flex: 0 0 auto;
}

.footer-button {
  height: 42px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
}

.footer-button--cancel {
  background: #f2f4f7;
  color: #667085;
}

.footer-button--confirm {
  background: #1f6fff;
  color: #ffffff;
}

.footer-button--confirm:disabled {
  opacity: 0.7;
}

.signature-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px 24px;
  text-align: center;
}

.signature-result__icon {
  width: 72px;
  height: 72px;
  border-radius: 24px;
  background: linear-gradient(135deg, #4096ff, #7cc4ff);
  color: #ffffff;
  font-size: 32px;
  font-weight: 700;
  line-height: 72px;
}

.signature-result__title {
  font-size: 22px;
  font-weight: 600;
  color: #1d2129;
}

.signature-result__desc {
  max-width: 280px;
  font-size: 14px;
  line-height: 1.6;
  color: #4e5969;
}

.result-button {
  min-width: 160px;
  height: 44px;
  border: none;
  border-radius: 999px;
  background: #1f6fff;
  color: #ffffff;
  font-size: 16px;
}

.signature-layout.landscape {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 8px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
  height: 100%;
  overflow: hidden;
}

.signature-layout.landscape .signature-hint {
  margin-bottom: 0;
  font-size: 13px;
}

.signature-layout.landscape .signature-stage {
  flex: 1 1 auto;
  min-height: 0;
  z-index: 1;
}

.signature-layout.landscape .signature-board {
  height: 100%;
  min-height: 0;
}

.signature-layout.landscape .rotate-fab {
  top: 8px;
  right: 16px;
  bottom: auto;
}

.signature-layout.landscape .signature-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  margin-top: 0;
  padding-top: 14px;
  border-top: 1px solid #eaecf0;
  flex: 0 0 auto;
  background: #ffffff;
  position: relative;
  z-index: 4;
  pointer-events: auto;
}

.signature-layout.landscape .signature-meta {
  min-width: 0;
  flex-wrap: nowrap;
}

.signature-layout.landscape .signature-bottom button,
.signature-layout.landscape .signature-bottom input,
.signature-layout.landscape .signature-bottom label {
  position: relative;
  z-index: 5;
  pointer-events: auto;
}

.signature-layout.landscape .signature-footer {
  margin-top: 0;
  grid-template-columns: 88px 88px;
  gap: 14px;
  justify-content: end;
}

.signature-layout.landscape .footer-button {
  height: 38px;
  border-radius: 8px;
  font-size: 14px;
}

@media (max-width: 420px) {
  .signature-board {
    height: 236px;
  }
}
</style>
