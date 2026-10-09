<template>
  <b2-form-element>
    <div v-if="!widget.isReadonly">
      <mobile-signature-field v-if="isMobileDevice" :widget="widget" />
      <pc-signature-field v-else :widget="widget" />
    </div>

    <div
      v-else
      class="signature-value"
      :class="{ mobile: isMobileDevice, empty: !widget.inputValue }"
    >
      <el-image
        v-if="widget.inputValue"
        class="signature-image"
        :src="widget.inputValue"
        :alt="$t('defaultName')"
        :preview-src-list="[widget.inputValue]"
        preview-teleported
        fit="contain"
      />
      <span v-else>{{ $t("noSignature") }}</span>
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import i18next, { $t } from "@renderer/widgets/i18next";
import { HandwrittenSignature } from "./handwrittenSignature";
import MobileSignatureField from "./MobileSignatureField.vue";
import PcSignatureField from "./PcSignatureField.vue";

const widget = useWidget<HandwrittenSignature>();
const isMobileDevice = isMobile();
</script>

<style lang="scss" scoped>
.signature-value {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--fill-color-blank);
  overflow: hidden;

  &.empty {
    color: var(--text-color-inactive);
  }

  &.mobile {
    min-height: 120px;
    border-radius: 8px;
  }
}

.signature-image {
  display: block;
  max-width: 100%;
  max-height: 86px;
}

.signature-image :deep(.el-image__inner) {
  max-width: 100%;
  max-height: 86px;
  object-fit: contain;
}
</style>
