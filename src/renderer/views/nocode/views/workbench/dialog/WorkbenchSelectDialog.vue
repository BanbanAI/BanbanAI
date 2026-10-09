
<template>
  <div class="department-select-dialog">
    <el-dialog :modelValue="modelValue" 
    :title="title"
    @update:modelValue="emit('update:modelValue', $event)" align-center draggable :close-on-click-modal="false" :append-to-body="false"
    :close-on-press-escape="false" destroy-on-close>
      <div class="dialog-body">
        <el-form  class="dialog-content" label-position="top"  ref="formRef" :model="inputRef" :rules="rules">
      <el-form-item  prop="content" :label="label">
        <workbench-select v-model="inputRef.content" :options="roleTeam" :placeholder="$t('WorkbenchSelectDialog.selectLinkRole')" :theme="'light'"/>
      </el-form-item>
    </el-form>
      </div>
      <template #footer>
        <el-button type="primary" class="confirm" @click="confirm">{{ $t('WorkbenchSelectDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>


<script setup lang='ts'>
import { ref, onMounted, computed, reactive, watch } from 'vue';
import i18next from 'i18next';
interface Team {
  label: string,
  value:string
}
const props = defineProps<{
  modelValue: boolean;
  title: string;
  label: string;
  info: any;
  roleTeam: Team[];
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)  
  (event: 'confirm', value: string)
}>();

watch(()=>props.info,()=>{
  if(props.info){
    inputRef.content = props.info.parent;
    editRef.value.name = props.info.name;
  }
})

const editRef = ref({
  name:'',
  label:''
});
const rules = reactive({
  content: [{
    validator: (rule, value, callback) => value
      ? callback()
      : callback(new Error(i18next.t('WorkbenchSelectDialog.inputNotEmpty'))),
    trigger: 'blur',
  }]
})
const formRef = ref(null)
const inputRef = reactive({
  content: ''
});
const confirm = ()=> {
  formRef.value.validate((valid) => {
    if (valid) {
      emit('confirm', inputRef.content);
      emit('update:modelValue', false);
    } else {
      console.log('输入为空，校验失败');
    }
  });
}
const handleDialogOpened = () => {

}

const handleClosed = () => {

}
</script>
<style scoped lang='scss'>
.department-select-dialog {
  :deep(.el-dialog) {
    width: 400px;
    .el-dialog__footer {
      .el-button {
        width: 96px;
        height: 40px;
      }
    }
  }
}
</style>
