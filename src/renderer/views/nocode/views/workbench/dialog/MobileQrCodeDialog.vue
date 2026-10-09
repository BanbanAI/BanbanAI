<template>
  <el-dialog
    class="mobile-qrcode-dialog"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    width="300px"
    align-center
  >
    <div class="qrcode-container">
      <qrcode-vue :value="saasDomain" :size="200" />
      <div class="tips">{{ $t('MobileQrCodeDialog.scanQrCode') }}</div>
    </div>
  </el-dialog>
</template>

<script lang='ts' setup>
import { computed, watch } from 'vue';
import { useSettingStore } from '@renderer/stores';
import QrcodeVue from 'qrcode.vue'

const props = defineProps<{
  modelValue: boolean,
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean),
}>();

const settingState = useSettingStore();
watch(() => props.modelValue, (visible) => {
  if (visible) void settingState.getDomainPort();
}, { immediate: true });
const saasDomain = computed(() => settingState.saas.domain);
</script>

<style lang="scss" scoped>
.mobile-qrcode-dialog {
  .qrcode-container {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    .tips {
      margin-top: 16px;
    }
  }
}
</style>
