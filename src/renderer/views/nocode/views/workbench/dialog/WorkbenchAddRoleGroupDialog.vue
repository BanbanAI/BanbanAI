<template>
  <div class="workbench-add-group-dialog">
    <el-dialog :modelValue="modelValue" 
    :title="$t('WorkbenchAddRoleGroupDialog.createNewRoleGroup')"
    @update:modelValue="emit('update:modelValue', $event)" align-center draggable :close-on-click-modal="false" :append-to-body="false"
     destroy-on-close>
      <div class="dialog-body">
        <el-form label-position="top" :rules="rules">
          <el-form-item :label="$t('WorkbenchAddRoleGroupDialog.nameLabel')" prop="group">
            <el-input v-model="groupInfo" :placeholder="$t('WorkbenchAddRoleGroupDialog.inputRoleGroupNameTips')"></el-input>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button class="cancel" @click="emit('update:modelValue', false)">{{ $t('WorkbenchAddRoleGroupDialog.cancel') }}</el-button>
        <el-button type="primary" class="confirm" @click="handleConfirm">{{ $t('WorkbenchAddRoleGroupDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import { ref, reactive } from "vue";
import i18next from "i18next";

defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)  
  (event: 'confirm',groupInfo?:string)
}>();
const groupInfo =ref('');

const rules = reactive({
  role: [{
    validator: (rule, value, callback) => value
      ? callback()
      : callback(new Error(i18next.t('WorkbenchAddRoleGroupDialog.roleGroupNameRequired'))),
    trigger: 'blur',
  }]
})

const handleConfirm = () => {
  emit('confirm',groupInfo.value);
  emit('update:modelValue', false);
}
</script>

<style lang="scss" scoped>
.workbench-add-group-dialog {
  :deep(.el-dialog) {
    width: 360px;
    .el-dialog__footer {
    }
  }}
</style>
