<template>
  <transition name="signature-page">
    <div v-if="visible" class="signature-page" @click.stop>
      <div class="signature-shell" :class="{ landscape }">
        <div class="signature-layout" :class="{ landscape }">
          <div class="signature-hint">
            {{ $t("portraitTip") }}
          </div>

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

              <img
                v-if="selectedSavedSignatureUrl && !hasDrawing"
                class="saved-signature-preview"
                :src="selectedSavedSignatureUrl"
                :alt="$t('defaultName')"
              />

              <div v-if="!hasDrawing && !selectedSavedSignatureUrl" class="signature-placeholder"></div>
            </div>
          </section>

          <button class="rotate-fab" type="button" :title="$t('rotateOrientation')" @click="toggleOrientation">
            <el-icon><i-ven-icon-widget-form-handwritten-signature-phone-rotate fill="#fff" /></el-icon>
          </button>

          <div class="signature-spacer"></div>

          <div class="signature-bottom" :class="{ landscape }">
            <div class="signature-meta">
              <label v-if="allowReuse" class="reuse-option">
                <input v-model="saveForReuse" type="checkbox" />
                <span>{{ $t("saveForReuse") }}</span>
              </label>
              <div v-else class="reuse-blocked-text">{{ $t("reuseBlocked") }}</div>

              <button v-if="canRewrite" class="rewrite-link" type="button" @click="handleRewrite">
                <el-icon><Delete /></el-icon>
                <span>{{ $t("rewrite") }}</span>
              </button>
            </div>

            <footer class="signature-footer" :class="{ landscape }">
              <button class="footer-button footer-button--cancel" type="button" @click="handleCancel">
                {{ $t("cancel") }}
              </button>
              <button
                class="footer-button footer-button--confirm"
                type="button"
                :disabled="submitting"
                @click="handleConfirm"
              >
                {{ submitting ? $t("submittingSignature") : $t("confirm") }}
              </button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Delete } from "@element-plus/icons-vue";
import IVenIconPhoneRotate from '~icons/ven-icon/widget-form-handwritten-signature-phone-rotate';
import i18next, { $t } from "@renderer/widgets/i18next";
import type { HandwrittenSignature } from "./handwrittenSignature";
import {
  saveReusableSignature,
  uploadSignatureFile,
  useSignatureProjectId
} from "./signatureService";

const props = defineProps<{
  visible: boolean;
  widget: HandwrittenSignature;
  sessionId: string;
  savedSignatureUrl: string;
  allowReuse: boolean;
}>();

const emit = defineEmits<{
  (event: "update:visible", value: boolean): void;
  (event: "confirmed", value: string): void;
  (event: "opened"): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const landscape = ref(false);
const drawing = ref(false);
const hasDrawing = ref(false);
const submitting = ref(false);
const saveForReuse = ref(false);
const selectedSavedSignatureUrl = ref("");
const projectId = useSignatureProjectId();
const canRewrite = computed(() => hasDrawing.value || !!selectedSavedSignatureUrl.value);
const activePointerId = ref<number | null>(null);
const lastPoint = ref<{ x: number; y: number } | null>(null);

let context: CanvasRenderingContext2D | null = null;
let syncCanvasRaf = 0;
function updateBodyLock(locked: boolean) {
  document.body.style.overflow = locked ? "hidden" : "";
}

function waitForFrames(frameCount = 2) {
  return new Promise<void>((resolve) => {
    const step = (count: number) => {
      if (count <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => step(count - 1));
    };
    step(frameCount);
  });
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

function getCanvasSizeInfo() {
  const canvas = canvasRef.value;
  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  return {
    canvas,
    rect,
    ratio,
    nextWidth: Math.max(1, Math.floor(rect.width * ratio)),
    nextHeight: Math.max(1, Math.floor(rect.height * ratio))
  };
}

function initCanvas(snapshot?: string) {
  const sizeInfo = getCanvasSizeInfo();
  if (!sizeInfo) {
    return;
  }
  const { canvas, rect, ratio, nextWidth, nextHeight } = sizeInfo;

  canvas.width = nextWidth;
  canvas.height = nextHeight;

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

function syncCanvasSize(snapshot?: string) {
  const sizeInfo = getCanvasSizeInfo();
  if (!sizeInfo) {
    return;
  }

  const { canvas, nextWidth, nextHeight } = sizeInfo;
  if (canvas.width === nextWidth && canvas.height === nextHeight) {
    return;
  }

  initCanvas(snapshot);
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
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  const snapshot = getCanvasSnapshot();
  syncCanvasSize(snapshot);
  if (!context) {
    return;
  }

  if (selectedSavedSignatureUrl.value) {
    selectedSavedSignatureUrl.value = "";
    resetCanvas();
  }

  const { x, y } = getCanvasPoint(event);
  drawing.value = true;
  hasDrawing.value = true;
  activePointerId.value = event.pointerId;
  lastPoint.value = { x, y };
  canvasRef.value?.setPointerCapture?.(event.pointerId);
  context.beginPath();
  context.moveTo(x, y);
  event.preventDefault();
}

function handlePointerMove(event: PointerEvent) {
  if (!drawing.value || !context) {
    return;
  }
  if (activePointerId.value !== null && event.pointerId !== activePointerId.value) {
    return;
  }

  const { x, y } = getCanvasPoint(event);
  const previous = lastPoint.value;
  const rect = canvasRef.value?.getBoundingClientRect();
  const jumpLimit = rect ? Math.max(rect.width, rect.height) * 0.25 : 120;
  if (previous) {
    const distance = Math.hypot(x - previous.x, y - previous.y);
    if (distance > jumpLimit) {
      context.beginPath();
      context.moveTo(x, y);
      lastPoint.value = { x, y };
      event.preventDefault();
      return;
    }
  }

  context.lineTo(x, y);
  context.stroke();
  lastPoint.value = { x, y };
  event.preventDefault();
}

function handlePointerUp(event?: PointerEvent) {
  if (event && activePointerId.value !== null && event.pointerId !== activePointerId.value) {
    return;
  }
  drawing.value = false;
  activePointerId.value = null;
  lastPoint.value = null;
  if (event) {
    canvasRef.value?.releasePointerCapture?.(event.pointerId);
  }
}

function handleRewrite() {
  selectedSavedSignatureUrl.value = "";
  resetCanvas();
}

async function toggleOrientation() {
  const snapshot = getCanvasSnapshot();
  const nextLandscape = !landscape.value;
  await lockScreenOrientation(nextLandscape);
  landscape.value = nextLandscape;
  await nextTick();
  await waitForFrames(2);
  initCanvas(snapshot);
}

function canvasToBlob() {
  return new Promise<Blob | null>((resolve) => {
    canvasRef.value?.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function handleConfirm() {
  let signatureUrl = selectedSavedSignatureUrl.value;

  if (!signatureUrl) {
    if (!hasDrawing.value) {
      ElMessage.warning(i18next.t("signatureEmpty"));
      return;
    }

    const blob = await canvasToBlob();
    if (!blob) {
      ElMessage.warning(i18next.t("signatureEmpty"));
      return;
    }

    submitting.value = true;
    try {
      const file = new File([blob], `signature-${Date.now()}.png`, {
        type: "image/png"
      });
      signatureUrl = await uploadSignatureFile(props.widget, file, projectId);
    } catch (_error) {
      ElMessage.error(i18next.t("signatureUploadFailed"));
      submitting.value = false;
      return;
    }
  }

  if (props.allowReuse && saveForReuse.value && signatureUrl) {
    await saveReusableSignature(props.widget, signatureUrl);
    ElMessage.success(i18next.t("signatureSaved"));
  }

  submitting.value = false;
  emit("confirmed", signatureUrl);
}

function handleCancel() {
  emit("update:visible", false);
}

function scheduleSyncCanvas() {
  if (!props.visible) {
    return;
  }
  const snapshot = getCanvasSnapshot();
  if (syncCanvasRaf) {
    cancelAnimationFrame(syncCanvasRaf);
  }
  syncCanvasRaf = requestAnimationFrame(() => {
    syncCanvasRaf = 0;
    syncCanvasSize(snapshot);
  });
}

watch(
  () => props.visible,
  async (value) => {
    if (!value) {
      drawing.value = false;
      hasDrawing.value = false;
      activePointerId.value = null;
      lastPoint.value = null;
      saveForReuse.value = false;
      landscape.value = false;
      selectedSavedSignatureUrl.value = "";
      unlockScreenOrientation();
      updateBodyLock(false);
      return;
    }

    emit("opened");
    updateBodyLock(true);
    selectedSavedSignatureUrl.value = props.savedSignatureUrl || "";
    hasDrawing.value = false;
    await nextTick();
    await waitForFrames(2);
    initCanvas();
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener("resize", scheduleSyncCanvas);
  window.visualViewport?.addEventListener("resize", scheduleSyncCanvas);
  window.addEventListener("pointerup", handlePointerUp, true);
  window.addEventListener("pointercancel", handlePointerUp, true);
});

onBeforeUnmount(() => {
  drawing.value = false;
  activePointerId.value = null;
  lastPoint.value = null;
  if (syncCanvasRaf) {
    cancelAnimationFrame(syncCanvasRaf);
    syncCanvasRaf = 0;
  }
  window.removeEventListener("resize", scheduleSyncCanvas);
  window.visualViewport?.removeEventListener("resize", scheduleSyncCanvas);
  window.removeEventListener("pointerup", handlePointerUp, true);
  window.removeEventListener("pointercancel", handlePointerUp, true);
  unlockScreenOrientation();
  updateBodyLock(false);
});
</script>

<style lang="scss" scoped>
.signature-page {
  position: fixed;
  inset: 0;
  z-index: 100010;
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

.saved-signature-preview {
  position: absolute;
  inset: 12px;
  width: calc(100% - 24px);
  height: calc(100% - 24px);
  object-fit: contain;
  pointer-events: none;
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

.reuse-blocked-text {
  font-size: 13px;
  color: #99a2b0;
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

.signature-layout.landscape {
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
  height: 100%;
  overflow: hidden;
}

.signature-layout.landscape .signature-hint {
  margin-bottom: 8px;
  font-size: 13px;
}

.signature-layout.landscape .signature-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  padding-bottom: calc(68px + env(safe-area-inset-bottom, 0px));
  z-index: 2;
}

.signature-layout.landscape .signature-board {
  height: 100%;
  min-height: 0;
}

.signature-layout.landscape .rotate-fab {
  top: 8px;
  right: 16px;
  bottom: auto;
  z-index: 8;
}

.signature-layout.landscape .signature-bottom {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  margin-top: 0;
  padding-top: 14px;
  border-top: 1px solid #eaecf0;
  flex: 0 0 auto;
  background: #ffffff;
  z-index: 6;
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
  z-index: 7;
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

.signature-page-enter-active,
.signature-page-leave-active {
  transition: opacity 0.2s ease;
}

.signature-page-enter-from,
.signature-page-leave-to {
  opacity: 0;
}
</style>
