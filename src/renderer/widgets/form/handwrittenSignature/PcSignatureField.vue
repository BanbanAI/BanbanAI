<template>
  <div ref="rootRef" class="signature-field" :class="{ 'in-table': widget.isInTable }">
    <div
      class="signature-box"
      :class="{ filled: hasValue, hovered, expanded: showDialog || showReuseDialog }"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
      @mousedown.stop
      @click.stop="handleBoxClick"
    >
      <div v-if="hasValue" class="signature-preview">
        <img class="signature-image" :src="widget.inputValue" :alt="$t('defaultName')" />
      </div>
      <div v-else class="signature-empty">
        <el-icon class="signature-icon"><EditPen /></el-icon>
        <span>{{ $t("addSignature") }}</span>
      </div>

      <button
        v-if="hasValue"
        class="action-button qr-button"
        type="button"
        :title="$t('showQrCode')"
        @click.stop="openQrDialog"
      >
        <el-icon><Grid /></el-icon>
      </button>

      <button
        v-if="hasValue"
        class="action-button delete-button"
        type="button"
        :title="$t('deleteSignature')"
        @click.stop="handleDelete"
      >
        <el-icon><Delete /></el-icon>
      </button>
    </div>

    <signature-qr-dialog
      v-if="qrDialogMounted"
      :visible="showDialog"
      :widget="widget"
      :reference-element="rootRef"
      @update:visible="showDialog = $event"
      @signed="handleSigned"
    />

    <teleport v-if="showReuseDialog && popupHost" :to="popupHost">
      <div
        class="reuse-panel"
        :style="popupStyle"
        :data-signature-reuse-panel="widget.uid"
        @mousedown.stop
      >
        <div class="reuse-panel__title">{{ $t("reuseDialogTitle") }}</div>
        <div class="reuse-panel__preview">
          <img :src="savedSignatureUrl" :alt="$t('defaultName')" />
        </div>
        <div class="reuse-panel__actions">
          <button class="reuse-panel__button reuse-panel__button--secondary" type="button" @click="handleRewriteSignature">
            {{ $t("reuseDialogRewrite") }}
          </button>
          <button class="reuse-panel__button reuse-panel__button--primary" type="button" @click="handleUseSavedSignature">
            {{ $t("reuseDialogUse") }}
          </button>
        </div>
      </div>
    </teleport>

    <el-image-viewer
      v-if="showPreview && hasValue"
      :url-list="[widget.inputValue]"
      @close="showPreview = false"
      teleported
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Delete, EditPen, Grid } from "@element-plus/icons-vue";
import i18next, { $t } from "@renderer/widgets/i18next";
import type { HandwrittenSignature } from "./handwrittenSignature";
import SignatureQrDialog from "./SignatureQrDialog.vue";
import {
  clearReusableSignature,
  loadReusableSignature,
  saveReusableSignature
} from "./signatureService";

const props = defineProps<{
  widget: HandwrittenSignature;
}>();

const hovered = ref(false);
const showDialog = ref(false);
const qrDialogMounted = ref(false);
const showPreview = ref(false);
const showReuseDialog = ref(false);
const savedSignatureUrl = ref("");
const rootRef = ref<HTMLElement | null>(null);
const hasValue = computed(() => !!props.widget.inputValue);
const popupStyle = ref<Record<string, string | number>>({});
const popupHost = ref<HTMLElement | null>(null);
const popupHostPosition = ref("");
async function refreshReusableSignature() {
  savedSignatureUrl.value = await loadReusableSignature(props.widget).catch(() => "");
}

function resolvePopupHost() {
  const rootElement = rootRef.value;
  if (!rootElement) {
    popupHost.value = null;
    return;
  }

  popupHost.value =
    (rootElement.closest(".nocode-form") as HTMLElement | null) ||
    (rootElement.closest(".form-share-viewer") as HTMLElement | null) ||
    (rootElement.closest(".b2-board") as HTMLElement | null) ||
    (rootElement.closest(".board") as HTMLElement | null) ||
    rootElement.parentElement;

  if (popupHost.value) {
    popupHostPosition.value = popupHost.value.style.position;
    const computedPosition = window.getComputedStyle(popupHost.value).position;
    if (computedPosition === "static") {
      popupHost.value.style.position = "relative";
    }
  }
}

function restorePopupHost() {
  if (popupHost.value) {
    popupHost.value.style.position = popupHostPosition.value;
  }
}

function updatePopupPosition() {
  const rootElement = rootRef.value;
  const hostElement = popupHost.value;
  if (!rootElement || !hostElement || !showReuseDialog.value) {
    return;
  }

  const rect = rootElement.getBoundingClientRect();
  const hostRect = hostElement.getBoundingClientRect();
  const popupWidth = 188;
  const popupHeight = 252;
  const gap = 10;
  const hostWidth = hostElement.clientWidth || window.innerWidth;
  const hostHeight = hostElement.clientHeight || window.innerHeight;

  let left = rect.left - hostRect.left;
  let top = rect.bottom - hostRect.top + gap;

  if (left + popupWidth > hostWidth - 12) {
    left = Math.max(12, hostWidth - popupWidth - 12);
  }

  if (top + popupHeight > hostHeight - 12) {
    top = Math.max(12, rect.top - hostRect.top - popupHeight - gap);
  }

  popupStyle.value = {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 3000
  };
}

function handleDocumentClick(event: Event) {
  if (!showDialog.value && !showReuseDialog.value) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target && rootRef.value?.contains(target)) {
    return;
  }
  if (target?.closest?.(`[data-signature-qr-panel="${props.widget.uid}"]`)) {
    return;
  }
  if (target?.closest?.(`[data-signature-reuse-panel="${props.widget.uid}"]`)) {
    return;
  }
  showDialog.value = false;
  showReuseDialog.value = false;
}

async function handleBoxClick() {
  if (hasValue.value) {
    showPreview.value = true;
    return;
  }

  await refreshReusableSignature();
  if (savedSignatureUrl.value) {
    showReuseDialog.value = true;
    return;
  }

  openQrDialog();
}

function openQrDialog() {
  showReuseDialog.value = false;
  qrDialogMounted.value = true;
  showDialog.value = true;
}

function handleDelete() {
  props.widget.clearValue();
  props.widget.validate();
}

async function handleSigned(payload: { signatureUrl: string; saveForReuse: boolean }) {
  props.widget.inputValue = payload.signatureUrl;
  props.widget.validate();
  if (payload.saveForReuse) {
    await saveReusableSignature(props.widget, payload.signatureUrl);
    savedSignatureUrl.value = payload.signatureUrl;
  }
  showDialog.value = false;
}

function handleUseSavedSignature() {
  props.widget.inputValue = savedSignatureUrl.value;
  props.widget.validate();
  showReuseDialog.value = false;
}

async function handleRewriteSignature() {
  await clearReusableSignature(props.widget);
  savedSignatureUrl.value = "";
  showReuseDialog.value = false;
  await nextTick();
  openQrDialog();
}

watch(
  () => showReuseDialog.value,
  async (value) => {
    if (!value) {
      restorePopupHost();
      return;
    }

    resolvePopupHost();
    await nextTick();
    updatePopupPosition();
  }
);

onMounted(async () => {
  await refreshReusableSignature();
  document.addEventListener("pointerdown", handleDocumentClick, true);
  window.addEventListener("resize", updatePopupPosition);
  window.addEventListener("scroll", updatePopupPosition, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentClick, true);
  window.removeEventListener("resize", updatePopupPosition);
  window.removeEventListener("scroll", updatePopupPosition, true);
  restorePopupHost();
});
</script>

<style lang="scss" scoped>
.signature-field {
  position: relative;
}

.signature-box {
  position: relative;
  width: 100%;
  min-height: 88px;
  box-sizing: border-box;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--fill-color-blank);
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
  overflow: hidden;

  &:hover,
  &.hovered,
  &.expanded {
    border-color: var(--color-primary);
    background: var(--el-fill-color-light);
    box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.08);
  }
}

.signature-empty,
.signature-preview {
  min-height: 88px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.signature-field.in-table {
  height: var(--table-row-height, 32px);
}

.signature-field.in-table .signature-box,
.signature-field.in-table .signature-empty,
.signature-field.in-table .signature-preview {
  min-height: 100%;
  height: 100%;
}

.signature-empty {
  gap: 8px;
  color: var(--text-color-regular);
}

.signature-icon {
  font-size: 16px;
}

.signature-image {
  display: block;
  max-width: calc(100% - 84px);
  max-height: 72px;
  object-fit: contain;
}

.signature-field.in-table .signature-image {
  max-height: calc(100% - 16px);
}

.action-button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  cursor: pointer;
}

.qr-button {
  right: 46px;
  color: var(--color-primary);
}

.delete-button {
  right: 12px;
  color: var(--el-color-danger);
}

.signature-box:hover .action-button,
.signature-box.hovered .action-button {
  opacity: 1;
  pointer-events: auto;
}

.reuse-panel {
  width: 188px;
  max-width: 100%;
  padding: 10px 10px 8px;
  border: 1px solid #e5e6eb;
  border-radius: 2px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reuse-panel__title {
  font-size: 12px;
  line-height: 1.5;
  color: #4e5969;
}

.reuse-panel__preview {
  height: 96px;
  padding: 6px;
  border: 1px solid #f2f3f5;
  border-radius: 2px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.reuse-panel__preview img {
  max-width: calc(100% - 24px);
  max-height: calc(100% - 24px);
  object-fit: contain;
}

.reuse-panel__actions {
  display: flex;
  gap: 8px;
}

.reuse-panel__button {
  flex: 1;
  height: 30px;
  border-radius: 4px;
  border: 1px solid #c8d7f8;
  font-size: 12px;
  cursor: pointer;
}

.reuse-panel__button--secondary {
  background: #ffffff;
  color: #1d2129;
}

.reuse-panel__button--primary {
  border-color: #1f6fff;
  background: #1f6fff;
  color: #ffffff;
}
</style>
