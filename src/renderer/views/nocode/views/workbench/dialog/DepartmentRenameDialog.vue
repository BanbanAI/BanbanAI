
<template>
  <div class="department-rename-dialog">
    <el-dialog :modelValue="modelValue" width="360px"
    :title="title" @update:modelValue="emit('update:modelValue', $event)" align-center draggable :close-on-click-modal="false" destroy-on-close @opened="inputRef?.focus()" @closed="formRef?.resetFields()">
      <div class="dialog-body">
        <el-form  class="dialog-content" label-position="top"  ref="formRef" :model="inputInfo" :rules="rules">
          <el-form-item  prop="content" :label="label">
            <el-input class="content" v-model="inputInfo.content" @keydown.stop.enter.prevent="confirm" ref="inputRef"></el-input>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button type="primary" class="confirm" @click="confirm">{{ $t('DepartmentRenameDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>


<script setup lang='ts'>
import { FormInstance } from 'element-plus';
import { ref, onMounted, computed, reactive, watch } from 'vue';
import i18next from 'i18next';

const props = defineProps<{
  modelValue: boolean;
  title: string;
  label: string;
  info: any;
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)  
  (event: 'confirm', value: string)
}>();

const inputRef = ref(null);
const editRef = ref({
  name:'',
});
watch(()=>props.info,()=>{
  if(props.info){
    inputInfo.content = props.info.name;
    editRef.value.name = props.info.name;
  }
})
const rules = reactive({
  content: [{
    validator: (rule, value, callback) => value
      ? callback()
      : callback(new Error(i18next.t('DepartmentRenameDialog.inputNotEmpty'))),
    trigger: 'blur',
  }]
})
const formRef = ref<FormInstance>(null)
const inputInfo = reactive({
  content: ''
});
const confirm = ()=> {
  formRef.value.validate((valid) => {
    if (valid) {
      emit('confirm', inputInfo.content);
      emit('update:modelValue', false);
    } else {
      console.log(i18next.t('DepartmentRenameDialog.validateFail'));
    }
  });
}
const handleDialogOpened = () => {

}

const handleClosed = () => {

}
</script>
<style scoped lang='scss'>
.department-rename-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    --el-dialog-padding-primary: 0;

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        height: 40px;
        width: 40px;
        line-height: 46px;
        font-size: 16px;
        border-top-right-radius: 4px;
        top: 0;

        &:hover {
          background-color: var(--color-danger);

          .el-dialog__close {
            color: var(--color-white);
          }
        }

        .el-dialog__close {
          font-size: 18px;
        }

      }
    }

    .el-dialog__body {
      padding: 16px;

      .dialog-body {
        padding: 8px 0;
        position: relative;

        .el-form-item {
          margin-bottom: 0;

          .el-input__wrapper {
            border-radius: 4px;
            background-color: var(--bg-color-overlay);
            box-shadow: unset;

            &:hover {
              box-shadow: 0 0 0 1px var(--border-color) inset;
            }

            &.is-focus {
              box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
            }

            .el-input__inner {
              font-size: 14px;
              height: 32px;

              &::placeholder {
                font-size: 14px;
              }
            }
          }
        }
      }
    }

    .el-dialog__footer {
      padding: 8px 16px 16px 16px;

      .el-button {
        height: 32px;
        width: 64px;
        border-radius: 4px;
      }
    }
  }
}
</style>
