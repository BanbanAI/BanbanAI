<template>
  <div class="mobile-view-data-dialog">
    <el-dialog 
      :modelValue="modelValue" 
      @update:model-value="emit('update:modelValue', $event)" 
      ref="dialogRef"
      :close-on-click-modal="false" 
      :destroy-on-close="true" 
      align-center  
      :show-close="false"
    >
      <template #header>
        <div class="title" @click="handleClose">
          <el-icon class="back-button"><i-ep-arrow-left /></el-icon>
          <span>{{ table.alias }}</span>
        </div>
      </template>
      <div class="dialog-container">
        <nocode-form ref="nocodeFormRef" v-bind="nocodeFormProps" :isViewing="true"></nocode-form>
      </div>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref, inject } from 'vue';
import { DialogInstance } from 'element-plus';
import { Table } from '@common/types/project';
import { FieldAuthValue } from '@common/types/nocode';
import { NOCODE } from '@renderer/types';

const props = defineProps<{
  modelValue: boolean,
  table: Table,
  uuid: string,
  fieldsAuth?: Record<string, FieldAuthValue> | "all",
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void,
}>();

const nocodeFormRef = ref();
const dialogRef = ref<DialogInstance>();

const nocode = inject(NOCODE);
const nocodeFormProps = computed(() => {
  return {
    nocodeId: nocode.value?.meta?.id,
    tableUID: [ "", props.table?.uid],
    uuid: props.uuid,
    fieldsAuth: props.fieldsAuth,
  }
});

const handleClose = async () => {
  dialogRef.value.visible = false;
}
</script>

<style lang='scss' scoped>
.mobile-view-data-dialog {

  :deep(.el-dialog) {
    width: 100%;
    height: 100%;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    // background: #F2F5F7;
    background-color: var(--bg-color-page);

    .el-dialog__header {
      padding: 0 16px;
      padding-bottom: 0;
      margin-top: 24px;
      .title {
        height: 44px;
        display: inline-flex;
        align-items: center;
        padding-right: 12px;
        gap: 8px;

        .back-button {
          color: var(--text-color-regular);
          font-size: 16px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        span {
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          letter-spacing: 0px;
        }
      }
    }

    .el-dialog__body {
      padding: 0 16px;
      max-height: 100%;
      padding-top: 16px;
      padding-bottom: 80px;

      .dialog-container {
        padding: 6px 2px;
        background: #fff;
        border-radius: 8px;
        flex: 1;
      }
    }
  }

  .dialog-container {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    &::-webkit-scrollbar {
      display: none;
    }
    scrollbar-width: none;
    -ms-overflow-style: none;
    
    .header {
      display: flex;
      align-items: center;

      .title {
        font-size: 16px;
        font-weight: 500;
        margin-left: 8px;
      }
    }
  }
}
</style>
