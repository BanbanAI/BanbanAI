<template>
  <div class="workbench-add-department-dialog">
    <el-dialog :modelValue="modelValue" :title="type === 'edit' ? $t('WorkbenchDepartmentDialog.adjustParentDept') : $t('WorkbenchDepartmentDialog.createNewDept')" @update:modelValue="emit('update:modelValue', $event)" align-center width="360"
      draggable :close-on-click-modal="false" destroy-on-close @open="onOpen" @closed="onClosed">
      <div class="dialog-body">
        <el-form :model="departmentInfo" label-position="top" ref="formRef" :rules="rules">
          <el-form-item :label="$t('WorkbenchDepartmentDialog.deptName')" prop="department">
            <el-input v-model="departmentInfo.name" :placeholder="$t('WorkbenchDepartmentDialog.inputDeptNameTips')" :readonly="type === 'edit'"></el-input>
          </el-form-item>
          <el-form-item :label="$t('WorkbenchDepartmentDialog.parentDept')" prop="group">
            <workbench-tree-select v-model="departmentInfo.parent" :data="departmentTree" :placeholder="$t('WorkbenchDepartmentDialog.selectDeptTips')"
              theme="light" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button class="cancel" @click="$emit('update:modelValue', false)">{{ $t('WorkbenchDepartmentDialog.cancel') }}</el-button>
        <el-button type="primary" class="confirm" @click="commitDepartment()">{{ $t('WorkbenchDepartmentDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import { Department } from "@common/types/account";
import { deepClone } from "@common/utils/object";
import { ref, reactive, computed } from "vue";
import i18next from "i18next";


type DepartmentTree = Department & {
 children?: Department[],
 disabled?: boolean,
}

const props = defineProps<{
  modelValue: boolean;
  department?: DepartmentTree;
  departmentList: DepartmentTree[];
}>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)
  (event: 'confirm', value: typeof departmentInfo.value, _type: typeof type.value),
  (event: 'closed')
}>();

const formRef = ref(null)
const departmentTree = ref([]);
const departmentInfo = ref({
  name: '',
  parent: ''
})
const rules = reactive({
  name: [{
    validator: (rule, value, callback) => value
      ? callback()
      : callback(new Error(i18next.t('WorkbenchDepartmentDialog.deptNameRequired'))),
    trigger: 'blur',
  }]
})

const type = computed(() => {
  return props.department ? 'edit' : 'add';
});

const disabledSonItems = (departments: DepartmentTree[], isDisabled = false) => {
  for (const department of departments || []) {
    if (isDisabled) {
      department.disabled = true;
    } else if (department.id === props.department?.id) {
      department.disabled = true;
      isDisabled = true;
      disabledSonItems(department.children, true);
      break;
    }
    disabledSonItems(department.children, isDisabled);
  }
}

const onOpen = () => {
  departmentTree.value = deepClone(props.departmentList);
  if (type.value === 'edit') {
    departmentInfo.value = { 
      name: props.department.name,
      parent: props.department.parent,
     };
     disabledSonItems(departmentTree.value);
  }
}

const onClosed = () => {
  departmentInfo.value = {
    name: '',
    parent: ''
  }
  emit('closed');
}
const commitDepartment = () => {
  if (!formRef.value || !departmentInfo.value.name.trim()) return;
  emit('confirm', departmentInfo.value, type.value);
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.workbench-add-department-dialog {
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

        .el-select__wrapper {
          border-radius: 4px;
          background-color: var(--bg-color-overlay);
          box-shadow: unset;

          &:hover {
            box-shadow: 0 0 0 1px var(--border-color) inset;
          }

          &.is-focused {
            box-shadow: 0 0 0 1px var(--color-primary) inset !important;
          }

          .el-tag {
            border: 1px solid var(--border-color);
          }

          .el-select__inner {
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
