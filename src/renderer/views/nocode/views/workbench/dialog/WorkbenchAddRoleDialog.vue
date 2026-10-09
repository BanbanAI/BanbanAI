<template>
  <div class="workbench-add-role-dialog">
    <el-dialog :modelValue="modelValue" width="360px" :title="$t('WorkbenchAddRoleDialog.createNewRole')"
    @update:modelValue="emit('update:modelValue', $event)" align-center draggable :close-on-click-modal="false"  destroy-on-close @closed="onClosed">
      <div class="dialog-body">
        <el-form :model="roleInfo" label-position="top" ref="formRef" :rules="rules">
          <el-form-item :label="$t('WorkbenchAddRoleDialog.nameLabel')" prop="role">
            <el-input v-model="roleInfo.role" :placeholder="$t('WorkbenchAddRoleDialog.inputRoleNameTips')"></el-input>
          </el-form-item>
          <el-form-item :label="$t('WorkbenchAddRoleDialog.memberLabel')" prop="group">
            <select-users v-model:userIds="userIds" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button class="cancel" @click="emit('update:modelValue', false)">{{ $t('WorkbenchAddRoleDialog.cancel') }}</el-button>
        <el-button type="primary" class="confirm"  @click="handleConfirm">{{ $t('WorkbenchAddRoleDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import { ref,  watch, onMounted, reactive } from "vue";
import i18next from "i18next";
interface Team {
  label: string,
  value:string
}
const props = defineProps<{
  activeGroup: string;
  modelValue: boolean;
  roleTeam: Team[];
}>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)
  (event: 'confirm', value: { name: string, parent: string, userIds: string[] })
}>();
const formRef = ref(null)
const roleInfo = ref({
  role:'',
  group:''
})
const userIds = ref<string[]>([]);
const rules = reactive({
  role: [{
    validator: (rule, value, callback) => value
      ? callback()
      : callback(new Error(i18next.t('WorkbenchAddRoleDialog.roleNameRequired'))),
    trigger: 'blur',
  }]
})
const handleConfirm = () => {
  if (!formRef.value) return;
  formRef.value.validate((valid) => {
    if (valid) {
      emit('confirm', {
        name: roleInfo.value.role,
        parent: roleInfo.value.group,
        userIds: [ ...userIds.value ],
      });
      emit('update:modelValue', false);
    }
  })
};

const onClosed = () => {
  roleInfo.value.role = '';
  userIds.value = [];
}

watch(()=>props.activeGroup, (value)=>{
  roleInfo.value.group = value;
}, { immediate: true });
onMounted(()=>{
  if (props.roleTeam.length > 0) {
    roleInfo.value.group = props.roleTeam[0].value;
  }
})
</script>

<style lang="scss" scoped>
.workbench-add-role-dialog {
  :deep(.el-dialog) {
    --el-dialog-bg-color: var(--bg-color-page);
    border-radius: 4px;
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

        .el-form-item:last-child {
          margin-bottom: 0;
        }
      }
    }

    .el-dialog__footer {
      height: 60px;
      padding: 8px 16px 16px;

      .el-button {
        height: 32px;
        width: 64px;
        border-radius: 4px;
      }
    }
  }
}
</style>
