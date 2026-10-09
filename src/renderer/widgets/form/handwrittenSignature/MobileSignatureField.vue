<template>
  <div class="signature-field">
    <div
      class="signature-box"
      :class="{ filled: hasValue, expanded: showReuseDialog }"
      @mousedown.stop
      @touchend.stop.prevent="handleBoxTap"
      @click.stop.prevent="handleBoxTap"
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
        class="action-button delete-button"
        type="button"
        :title="$t('deleteSignature')"
        @touchend.stop.prevent="handleDelete"
        @click.stop.prevent="handleDelete"
      >
        <el-icon><Delete /></el-icon>
      </button>
    </div>

    <teleport to="body">
      <mobile-signature-pad
        v-model:visible="showSignaturePad"
        :widget="widget"
        session-id=""
        :saved-signature-url="savedSignatureUrl"
        :allow-reuse="true"
        @confirmed="handlePadConfirmed"
      />
    </teleport>

    <teleport to="body">
      <div
        v-if="showReuseDialog && savedSignatureUrl"
        class="reuse-mask"
        :data-signature-reuse-panel="widget.uid"
        @click.stop="showReuseDialog = false"
      >
        <div class="reuse-panel" @mousedown.stop @click.stop>
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
      </div>

      <div
        v-if="showPreview && hasValue"
        class="preview-mask"
        @click.stop="showPreview = false"
      >
        <div class="preview-panel" @click.stop>
          <img class="preview-panel__image" :src="widget.inputValue" :alt="$t('defaultName')" />
        </div>
      </div>
    </teleport>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref } from "vue";
import { Delete, EditPen } from "@element-plus/icons-vue";
import i18next, { $t } from "@renderer/widgets/i18next";
import type { HandwrittenSignature } from "./handwrittenSignature";
import MobileSignaturePad from "./MobileSignaturePad.vue";
import {
  clearReusableSignature,
  loadReusableSignature
} from "./signatureService";

const props = defineProps<{
  widget: HandwrittenSignature;
}>();

const showPreview = ref(false);
const showReuseDialog = ref(false);
const showSignaturePad = ref(false);
const savedSignatureUrl = ref("");
const hasValue = computed(() => !!props.widget.inputValue);
let lastTapAt = 0;
async function refreshReusableSignature() {
  savedSignatureUrl.value = await loadReusableSignature(props.widget).catch(() => "");
}

async function handleOpenEditor() {
  showReuseDialog.value = false;
  showSignaturePad.value = true;
}

async function handleBoxTap() {
  const now = Date.now();
  if (now - lastTapAt < 320) {
    return;
  }

  lastTapAt = now;
  await handleBoxClick();
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

  void handleOpenEditor();
}

function handleDelete() {
  showPreview.value = false;
  showReuseDialog.value = false;
  showSignaturePad.value = false;
  props.widget.clearValue();
  props.widget.validate();
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
  void handleOpenEditor();
}

async function handlePadConfirmed(signatureUrl: string) {
  if (!signatureUrl) {
    showSignaturePad.value = false;
    return;
  }

  props.widget.inputValue = signatureUrl;
  props.widget.validate();
  showSignaturePad.value = false;
  await refreshReusableSignature();
}

onMounted(async () => {
  await refreshReusableSignature();
});
</script>

<style lang="scss" scoped>
.signature-field {
  position: relative;
}

.signature-box {
  position: relative;
  min-height: 120px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--fill-color-blank);

  &.expanded {
    border-color: var(--color-primary);
    background: var(--el-fill-color-light);
    box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.08);
  }
}

.signature-empty,
.signature-preview {
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.signature-empty {
  gap: 8px;
  color: var(--text-color-regular);
}

.signature-icon {
  font-size: 18px;
}

.signature-image {
  display: block;
  max-width: calc(100% - 84px);
  max-height: 96px;
  object-fit: contain;
}

.action-button {
  position: absolute;
  top: 10px;
  z-index: 4;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  cursor: pointer;
}

.delete-button {
  right: 10px;
  color: var(--el-color-danger);
  pointer-events: auto;
}

.reuse-mask {
  position: fixed;
  inset: 0;
  z-index: 100000;
  background: rgba(15, 23, 42, 0.48);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.reuse-panel {
  position: relative;
  z-index: 1;
  width: 188px;
  max-width: 100%;
  padding: 10px 10px 8px;
  border: 1px solid #e5e6eb;
  border-radius: 2px;
  background: #ffffff;
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
  height: 34px;
  border-radius: 6px;
  border: 1px solid #c8d7f8;
  font-size: 13px;
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

.preview-mask {
  position: fixed;
  inset: 0;
  z-index: 100001;
  background: rgba(15, 23, 42, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.preview-panel {
  width: 100%;
  max-width: 560px;
  max-height: calc(100vh - 48px);
  padding: 20px;
  border-radius: 12px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.preview-panel__image {
  display: block;
  width: 100%;
  max-height: calc(100vh - 88px);
  object-fit: contain;
}
</style>
