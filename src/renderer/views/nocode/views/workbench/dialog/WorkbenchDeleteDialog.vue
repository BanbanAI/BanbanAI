
<template>
  <div class="department-rename-dialog">
    <el-dialog :modelValue="modelValue" 
    :title="title" :width="360"
    @update:modelValue="emit('update:modelValue', $event)" align-center draggable :close-on-click-modal="false" :append-to-body="false"
    :close-on-press-escape="false" destroy-on-close>
      <div class="wrapper-content">
        <div class="icon-warning">
          <el-icon :size="34" color="var(--color-warning)">
            <i-ep-warn-triangle-filled />
          </el-icon>
        </div>
        <div class="wrap-tip">
          <div class="title">{{ `${$t('WorkbenchDeleteDialog.confirmDeletePrefix')}${targetType}？` }}</div>
          <div class="content">{{ `${$t('WorkbenchDeleteDialog.delete')}${targetType}${$t('WorkbenchDeleteDialog.deleteWarnSuffix')}` }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="cancel">{{ $t('WorkbenchDeleteDialog.cancel') }}</el-button>
        <el-button type="danger" class="confirm" @click="confirm">{{ $t('WorkbenchDeleteDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>


<script setup lang='ts'>
import { OrganizeCategory } from "@common/types/project"
import { computed } from "vue";
import i18next from "i18next";
const props = defineProps<{
  modelValue: boolean;
  title: string;
  category: OrganizeCategory
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)  
  (event:'confirm')
}>();

const targetType = computed(() => { 
  return props.category === OrganizeCategory.DEPARTMENT ? i18next.t('WorkbenchDeleteDialog.department') : i18next.t('WorkbenchDeleteDialog.role')
})

const confirm = ()=> {
  emit('confirm')
  emit('update:modelValue', false)
}

const cancel = ()=> {
  emit('update:modelValue', false)
}
</script>
<style scoped lang='scss'>
.department-rename-dialog {
  :deep(.el-dialog) {
    padding: 0;
    border-radius: 4px;
    background-color: var(--bg-color-page);

    .el-dialog__header {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0;
      height: 40px;
      padding: 0;
      border-bottom: 1px solid var(--fill-color-light);

      span {
        font-size: 14px;
        color: var(--text-color-primary);
        font-weight: 500;
      }

      button {
        width: 40px;
        height: 40px;
      }
    }

    .el-dialog__footer {
      padding: 0 24px 24px 24px;

      .el-button {
        border-radius: 4px;
        margin-left: 8px;
      }
    }

    .el-dialog__body {
      padding: 24px;
      color: var(--text-color-regular);
    }
  }

  .wrapper-content {
    display: flex;
    align-items: center;

    .icon-warning {
      margin-right: 14px;

      i {
        font-size: 27px;
      }
    }

    .wrap-tip {
      .title {
        font-size: 14px;
        line-height: 20px;
        margin-bottom: 8px;
      }

      .content {
        font-size: 12px;
        line-height: 16px;
      }
    }
  }
}
</style>