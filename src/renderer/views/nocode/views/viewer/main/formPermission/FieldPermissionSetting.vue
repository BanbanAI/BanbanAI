<template>
  <div class="field-permission-setting">
    <div class="button-box">
      <el-radio-group v-model="dataComp.rangeType">
        <el-radio :value="PermissionRangeType.ALL" size="small">
          {{ $t('FieldPermissionSetting.allField') }}
          <el-tooltip effect="light" :offset="8" :content=" $t('FieldPermissionSetting.allFieldTip')" placement="top-start" :show-arrow="false" popper-style="background-color: #fff; width: 300px;">
            <el-icon size="14" style="margin-left: 4px;" color="#86909c"><i-nocode-data-source-form-question/></el-icon>
          </el-tooltip>
        </el-radio>
        <el-radio :value="PermissionRangeType.CUSTOM" size="small">{{ $t('FieldPermissionSetting.custom') }} </el-radio>
      </el-radio-group>
      <div class="setting" @click="handleOpenSettingDialog" v-if="dataComp.rangeType === PermissionRangeType.CUSTOM">
        {{ isEmpty(dataComp.range) ? $t('FieldPermissionSetting.setting') : $t('FieldPermissionSetting.set')}}
      </div>
    </div>

    <el-dialog class="field-permission-setting-dialog" v-model="dialogVisible" :width="680" align-center draggable>
      <template #header>
        <div class="title">{{ $t('FieldPermissionSetting.dialogTitle') }}</div>
      </template>

      <template #default>
        <el-table :max-height="380" :data="fieldPermissionTableData" :empty-text="$t('FieldPermissionSetting.noContent')" row-key="uid" default-expand-all>
          <el-table-column prop="uid" :label="$t('FieldPermissionSetting.tableField')">
            <template #default="scope">
              <div :style="{ paddingLeft: Math.min(scope.row.path.length, 4) * 20 + 'px' }">
                {{ scope.row.name }}
                <el-tooltip v-if="scope.row.designHidden" :content="$t('FieldPermissionSetting.designHiddenPermissionTip')" placement="top">
                  <el-icon class="field-design-hidden-warning" color="#e6a23c"><i-ep-warning /></el-icon>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="visible" :width="144">
            <template #header>
              <el-checkbox v-model="allVisible" :disabled="isEmpty(fieldPermissionTableData)">{{ $t('FieldPermissionSetting.fieldVisible') }}</el-checkbox>
            </template>
            <template #default="scope">
              <el-checkbox v-model="scope.row.visible" :disabled="isEmpty(fieldPermissionTableData)" @change="(val) => handleVisibleChange(val, scope.row)"></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column prop="editable" :width="144">
            <template #header>
              <el-checkbox v-model="allEditable" :disabled="isEmpty(fieldPermissionTableData)">{{ $t('FieldPermissionSetting.fieldEditable') }}</el-checkbox>
            </template>
            <template #default="scope">
              <el-checkbox v-show="(scope.row.selfInfo && !isSystemField(scope.row.selfInfo)) || !scope.row.selfInfo" v-model="scope.row.editable" :disabled="isEmpty(fieldPermissionTableData)" @change="(val) => handleEditableChange(val, scope.row)"></el-checkbox>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <template #footer>
        <el-button @click="handleCancel">{{ $t('FieldPermissionSetting.cancel') }}</el-button>
        <el-button type="primary" @click="handleSavePermission">{{ $t('FieldPermissionSetting.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { FieldAuthValue, FieldPermissionRange, FormElementInfo, PermissionRangeType } from '@common/types/nocode';
import { getFormElementsInfo, hasPublishedProcess, isSystemField, SystemField } from '@common/utils';
import { NOCODE } from '@renderer/types';
import { isEmpty } from '@common/utils/object';
import { computed, inject, onMounted, ref } from 'vue';
import { provideFormElementsInfo, useFormOption } from '../../../editor/form/hooks';
import { GET_OPTION_VALUE } from '@renderer/b2/inject';
import FieldOfTablesSelect from '@renderer/views/nocode/components/global/FieldOfTablesSelect.vue';

const props = defineProps<{
  data: FieldPermissionRange,
  activePageId: string,
}>();

const dialogVisible = ref(false);
const nocode = inject(NOCODE)
const emit = defineEmits(['update:data']);
const formElementsInfo = computed(() => getFormElementsInfo(nocode.value.body.formData.formOptions[props.activePageId].widget.widgets || []));
type FormWidgetSoul = {
  uid?: string;
  options?: { 'is-hidden'?: boolean };
  widgets?: FormWidgetSoul[];
};
const hiddenFieldUIDSet = computed(() => {
  const result = new Set<string>();
  const visit = (widgets: FormWidgetSoul[] = []) => {
    for (const widget of widgets) {
      if (widget?.uid && widget.options?.['is-hidden'] === true) result.add(widget.uid);
      visit(widget?.widgets || []);
    }
  };
  visit(nocode.value.body.formData.formOptions[props.activePageId]?.widget?.widgets || []);
  return result;
});
const getOptionValue = inject(GET_OPTION_VALUE);

const dataComp = computed<FieldPermissionRange>({
  get: () => props.data,
  set: (val) => emit('update:data', val),
});

const handleOpenSettingDialog = () => {
  dialogVisible.value = true;
  fieldPermissionTableData.value = initTableData();
}

const showSystemFields: string[] = [
  SystemField.UUID,
  SystemField.DATA_TITLE,
  SystemField.CREATE_OWNER,
  SystemField.DATA_OWNER,
  SystemField.CREATE_TIME,
  SystemField.UPDATE_TIME,
];
const processFields: string[] = [
  SystemField.STATUS,
  SystemField.CURRENT_NODE,
  SystemField.CURRENT_OWNER
]
function isShowProcessFields() {
  const formOptions = nocode.value.body.formData?.formOptions
  if(!formOptions) return false
  const formOption = formOptions[props.activePageId]
  if(hasPublishedProcess(formOption?.process)) {
    return true
  }
  return false
}
const fieldIsVisible = (uid: string) => {
  if (!dataComp.value.range[uid]) return false;
  if (dataComp.value.range[uid] === FieldAuthValue.VISIBLE || dataComp.value.range[uid] === FieldAuthValue.VISIBLE_EDITABLE) {
    return true;
  } else {
    return false;
  }
}
const fieldIsEditable = (uid: string) => {
  if (!dataComp.value.range[uid]) return false;
  if (dataComp.value.range[uid] === FieldAuthValue.VISIBLE_EDITABLE) {
    return true;
  } else {
    return false;
  }
}
const fieldPermissionTableData = ref();

const currentFormData = nocode.value.body.formData.tables.find(item => item.uid === props.activePageId);
const initTableData = () => {
  if (!props.activePageId) return [];
  const data = [];
  const systemColumns = [];
  const systemFields = currentFormData.fields.filter(field => isSystemField(field));
  
  if (!isEmpty(formElementsInfo.value)) {
    for (const info of formElementsInfo.value) {
      const field = currentFormData.fields.find(field => field.meta.uid === info.uid);
      data.push({
        uid: info.uid,
        name: info.name || field?.meta?.name,
        path: info.path,
        visible: fieldIsVisible(info.uid),
        editable: fieldIsEditable(info.uid),
        designHidden: hiddenFieldUIDSet.value.has(info.uid),
        selfInfo: field
      });
    }
  }

  if (!isEmpty(systemFields)) {
    for (const field of systemFields) {
      if (showSystemFields.includes(field.meta.name) || (processFields.includes(field.meta.name) && isShowProcessFields())) {
        systemColumns.push({
          name: field.alias,
          uid: field.meta.uid,
          path: [],
          visible: fieldIsVisible(field.meta.uid),
          editable: false,
          designHidden: false,
          selfInfo: field
        })
      }
    }
  }

  return data;
}

const allVisible = computed<boolean>({
  get: () => {
    if (isEmpty(fieldPermissionTableData.value)) return false;
    return fieldPermissionTableData.value.every(item => item.visible);
  },
  set: (val) => fieldPermissionTableData.value.forEach(item => item.visible = val),
})
const allEditable = computed<boolean>({
  get: () => {
    if (isEmpty(fieldPermissionTableData.value)) return false;
    return fieldPermissionTableData.value.filter(item => ((item.selfInfo && !isSystemField(item.selfInfo)) || !item.selfInfo)).every(item => item.editable);
  },
  set: (val) => {
    fieldPermissionTableData.value.filter(item => ((item.selfInfo && !isSystemField(item.selfInfo)) || !item.selfInfo)).forEach(item => item.editable = val);
    if (val) {
      allVisible.value = true;
    }
  },
})

const handleVisibleChange = (val, row, isParent = false) => {
  const parent = row.path?.length ? row.path?.[row.path.length - 1] : null
  if (!isParent) {
    if (!val) {
      row.editable = false;
    }
    for (const item of fieldPermissionTableData.value) {
      if(item.path?.includes(row.uid)) {
        item.visible = val;
        if (!val) {
          item.editable = false;
        }
      }
    }
  }
  
  if (parent) {
    const parentField = fieldPermissionTableData.value.find(f => f.uid === parent);
    if(val) {
      parentField.visible = val;
    } else {
      const childFields = fieldPermissionTableData.value.filter(f => f.path?.[f.path.length - 1] === parent);
      if(childFields.every(f => !f.visible)) {
        parentField.visible = false;
      }
      if(childFields.every(f => !f.editable)) {
        parentField.editable = false;
      }
    }
    handleVisibleChange(val, parentField, true);
  }
}

const handleEditableChange = (val, row, isParent = false) => {
  const _tableData = fieldPermissionTableData.value.filter(item => ((item.selfInfo && !isSystemField(item.selfInfo)) || !item.selfInfo))
  const parent = row.path?.length ? row.path?.[row.path.length - 1] : null
  if (!isParent) {
    if (val) {
      row.visible = true;
    }
    for (const item of _tableData) {
      if(item.path?.includes(row.uid)) {
        item.editable = val;
        if (val) {
          item.visible = true;
        }
      }
    }
  }
  
  if (parent) {
    const parentField = _tableData.find(f => f.uid === parent);
    if(val) {
      parentField.editable = val;
      parentField.visible = val;
    } else {
      const childFields = _tableData.filter(f => f.path?.[f.path.length - 1] === parent);
      if(childFields.every(f => !f.editable)) {
        parentField.editable = false;
      }
    }
    handleEditableChange(val, parentField, true);
  }
}

const handleCancel = () => {
  dialogVisible.value = false;
  fieldPermissionTableData.value = initTableData();
}

const handleSavePermission = () => {
  for (const item of fieldPermissionTableData.value) {
    if (item.visible && item.editable) {
      dataComp.value.range[item.uid] = FieldAuthValue.VISIBLE_EDITABLE;
    } else if (item.visible) {
      dataComp.value.range[item.uid] = FieldAuthValue.VISIBLE;
    } else {
      dataComp.value.range[item.uid] = null;
    }
  }
  dialogVisible.value = false;
}

// onMounted(() => {
//   fieldPermissionTableData.value = initTableData();
// })
</script>

<style lang="scss" scoped>
.field-permission-setting {
  width: 100%;
  
  .button-box {
    display: flex;
    height: 20px;
    align-items: center;

    :deep(.el-radio__label) {
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
      display: flex;
      align-items: center;
    }
    
    .setting {
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
      color: var(--color-primary);
      margin-left: 8px;
      padding-left: 8px;
      border-left: 1px solid var(--border-color);
      cursor: pointer;
      height: 12px;
      display: flex;
      align-items: center;
    }
  }

  :deep(.field-permission-setting-dialog) {
    padding: 0px;
    border-radius: 8px;
    background-color: var(--color-white);

    .el-dialog__header {
      padding: 0px;
      height: 40px;
      border-bottom: 1px solid var(--border-color);
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
      display: flex;
      justify-content: center;
      align-items: center;

      .el-dialog__headerbtn {
        height: 40px;
      }
    }

    .el-dialog__body {
      display: flex;
      padding: 24px 20px;
      gap: 16px;

      .el-table {
        border-radius: 5px;
        border: 1px solid #e5e6eb;
      }
    }

    .el-dialog__footer {
      border-top: 1px solid var(--border-color);
      height: 64px;
      padding: 0px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 16px;

      .el-button {
        border-radius: 4px;
      }
    }
  }
}

.field-design-hidden-warning {
  margin-left: 4px;
  vertical-align: -2px;
  color: var(--el-color-warning);
}
</style>
