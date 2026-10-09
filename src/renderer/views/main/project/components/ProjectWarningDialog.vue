<template>
  <div class="project-warning-dialog" v-show="modelValue">
    <div class="project-warning-mask" v-if="webshare">
      <div class="project-warning-text">
        <img src="@renderer/assets/image/project-warning.svg" alt="">
        <div class="text-wrapper">
          <p v-for="text in warningTexts" :key="text">{{ text }}</p>
        </div>
      </div>
    </div>
    <el-dialog v-else :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :show-close="false" :close-on-click-modal="false" width="350px"
      :close-on-press-escape="false" center align-center ref="dialogRef">
      <template #header>
        <div class="title">{{ $t("projectWarningDialog.dialogTitle") }}</div>
      </template>
      <div class="content">
        <span class="warning-icon"><img src="@renderer/assets/image/main/project-warning.svg"></span>
        <span class="text">{{ warningTexts.join("，") || $t("projectWarningDialog.projectExpiredTip")}}</span>
      </div>
      <template #footer>
        <el-button type="primary" @click.stop="handleClose">{{ $t("projectWarningDialog.exitProject") }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import i18next from 'i18next';
import { ref, computed } from 'vue';

const props = defineProps<{
  modelValue: boolean,
  warningText?: string | string[],
  webshare?: boolean
}>();
const emit = defineEmits<{
  (event: 'closed'),
  (event: 'update:modelValue', value: boolean),
}>();
const dialogRef = ref();
const handleClose = () => {
  dialogRef.value.visible = false;
  emit('closed');
}


const warningTexts = computed(() => {
  if (!props.warningText) return [i18next.t("projectWarningDialog.projectExpiredTip")];
  else if (typeof (props.warningText) === 'string') {
    return [props.warningText];
  }
  return props.warningText;
});

</script>

<style lang="scss" scoped>
.project-warning-dialog {
  :deep(.el-overlay) {
    .el-dialog__header {
      height: 40px;
      padding: 0;
      margin: 0;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      color: #ccc;
      font-size: 18px;
      user-select: none;
    }
    .el-dialog__body {
      display: flex;
      height: 120px;
      padding-bottom: 25px;
      justify-content: center;
      align-items: center;
    }
    .content {
      user-select: none;
      display: flex;
      align-items: center;
      span {
        vertical-align: middle;
        font-size: 12px;
        color: #fff;
        &.warning-icon {
          margin-right: 5px;
        }

        &.text {
          line-height: 18px;
        }
      }
    }
    .el-dialog__footer {
      padding-top: 0;
      padding-bottom: 30px;
      .el-button {
        width: 200px;
        height: 30px;
        line-height: 30px;
        &:hover, &:focus, &:active {
          background-color: #59B2FF;
        }
      }
    }
  }
  .project-warning-mask {
    position: fixed;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    background-color: rgba(0,0,0,0.8);
    .project-warning-text {
      position: absolute;
      display: flex;
      width: 100%;
      height: 100px;
      margin: auto;
      top: 0;
      bottom: 0;
      background-color: rgba(0,0,0, 0.8);
      font-size: 28px;
      letter-spacing: 3px;
      justify-content: center;
      align-items: center;
      color: #fff;
      img {
        --size: v-bind("warningTexts.length > 1 ? '50px': '36px'");
        width: var(--size);
        height: var(--size);
        margin-right: v-bind("warningTexts.length > 1 ? '32px': '18px'");
      }

      .text-wrapper {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        row-gap: 8px;

        p {
          white-space: nowrap;
        }
      }
    }
  }
}
</style>