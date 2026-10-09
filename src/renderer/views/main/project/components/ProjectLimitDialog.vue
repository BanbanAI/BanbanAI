<template>
  <div class="project-limit-dialog">
    <el-dialog draggable :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :title="$t('projectLimitDialog.projectCountLimitTitle')" :append-to-body="true" width="400px"
      @before-close="handleCloseDialog" :destroy-on-close="true" ref="dialogRef">
      <div class="limit-notice">
        <div class="reminder-icon">
          <i class="fs fs-reminder"></i>
        </div>
        <div class="notice-info">
          {{ $t("projectLimitDialog.projectCountLimitTip", {projectLimit: projectLimitOption.max, projectCount: projectLimitOption.current}) }}
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="handleCloseDialog">{{ $t("projectLimitDialog.confirmLabel") }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue';

defineProps<{
  modelValue: boolean,
}>();

const emit = defineEmits<{
  (event: 'closed'): void,
  (event: 'update:modelValue', value: boolean),
}>();

const projectLimitOption = reactive<any>({
  current: 0,
  max: 0
})

const dialogRef = ref();

const handleCloseDialog = () => {
  dialogRef.value.visible = false;
  emit('closed');
}

defineExpose({
  init(option: any) {
    Object.assign(projectLimitOption, option);
  }
})

</script>

<style scoped lang="scss">
.limit-notice {
  width: 100%;
  display: flex;
  justify-content: space-between;

  .reminder-icon {
    i {
      font-size: 50px;
      color: #f5ba00;
    }
  }

  .notice-info {
    width: 270px;
    line-height: 20px;
    font-size: 14px;
  }
}
</style>