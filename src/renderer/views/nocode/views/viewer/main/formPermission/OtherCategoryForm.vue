<template>
  <div class="other-category-form">
    <div class="view-container" v-if="!editState">
      <div class="head-button-box">
        <el-button type="default" @click="handleEdit">{{ $t('OtherCategoryForm.edit') }}</el-button>
        <el-button type="default" @click="handleCopy">{{ $t('OtherCategoryForm.copy') }}</el-button>
        <el-button type="default" @click="handleDelete">{{ $t('OtherCategoryForm.delete') }}</el-button>
      </div>

      <div class="view-form-item title">{{ formComp.title || '-' }}</div>
      <div class="view-form-item description">{{ formComp.description || '-' }}</div>

      <el-divider />

      <div class="view-form-item memberRange">
        <div class="label">{{ $t('OtherCategoryForm.authMember') }}</div>
        <div class="content" v-if="formComp.memberRange.rangeType === PermissionRangeType.ALL">
          <el-tag type="info">{{ $t('OtherCategoryForm.allViewMember') }}</el-tag>
        </div>
        <div v-else class="content">
          <el-tag v-for="tag in formComp.memberRange.range.departments" type="info">
            {{organizeUtil.departments.find(item => item.id === tag).name}}
          </el-tag>
          <el-tag v-for="tag in formComp.memberRange.range.roles" type="info">
            {{organizeUtil.roles.find(item => item.id === tag).name}}
          </el-tag>
          <el-tag v-for="tag in formComp.memberRange.range.users" type="info">
            {{ getUserName(tag) }}
          </el-tag>
        </div>
      </div>
      
      <div class="view-form-item dataRange">
        <div class="label">{{ $t('OtherCategoryForm.dataRange') }}</div>
        <div class="content">
          <span v-for="(val, key) in formComp.dataRange" :key="key + val" 
            v-show="val === true || (val as DataPermissionDataRange['customDepartment'])?.enabled === true"
          >
            {{ dataRangeLabelMap[key] }}
          </span>
        </div>
      </div>

      <div class="view-form-item dataRange">
        <div class="label">{{ $t('OtherCategoryForm.dataStatus') }}</div>
        <div class="content">
          <span v-for="(val, key) in formComp.dataStatus" :key="key + val"
          v-show="val"
          >
            {{ dataStatusLabelMap[key] }}
          </span>
        </div>
      </div>

      <div class="view-form-item handleRange">
        <div class="label">{{ $t('OtherCategoryForm.operAuth') }}</div>
        <div class="content">
          <span v-for="(val, key) in formComp.handleRange" :key="val + key" v-show="val">
            {{ handleRangeLabelMap[key] }}
          </span>
        </div>
      </div>
    </div>

    <el-form v-else ref="elFormRef" :model="formComp" label-position="left" class="permission-form edit-container"
      label-width="auto">
      <el-form-item :label="$t('OtherCategoryForm.name')" prop="title">
        <el-input v-model="formComp.title" class="noborder-input" style="width: 406px;" :placeholder="$t('OtherCategoryForm.plsInputName')" />
      </el-form-item>

      <el-form-item :label="$t('OtherCategoryForm.desc')" prop="description">
        <el-input v-model="formComp.description" class="noborder-input" style="width: 406px;" :placeholder="$t('OtherCategoryForm.plsInputDesc')" />
      </el-form-item>

      <el-divider />

      <el-form-item :label="$t('OtherCategoryForm.authMember')" prop="memberRange">
        <form-view-member-range v-model:data="formComp.memberRange"></form-view-member-range>
      </el-form-item>

      <el-form-item :label="$t('OtherCategoryForm.dataRange')" prop="dataRange" class="data-range">
        <div>
          <el-checkbox v-model="formComp.dataRange.all" :label="dataRangeLabelMap.all" />
        </div>
        <div>
          <el-checkbox v-model="formComp.dataRange.self" :label="dataRangeLabelMap.self" />
          <el-checkbox v-model="formComp.dataRange.currentDepartment" :label="dataRangeLabelMap.currentDepartment" />
          <el-checkbox v-model="formComp.dataRange.siblingDepartment" :label="dataRangeLabelMap.siblingDepartment" />
          <el-checkbox v-model="formComp.dataRange.subDepartment" :label="dataRangeLabelMap.subDepartment" />
        </div>
        <div>
          <el-checkbox v-model="formComp.dataRange.anonymous" :label="dataRangeLabelMap.anonymous" />
        </div>
        <div class="custom-department">
          <el-checkbox v-model="formComp.dataRange.customDepartment.enabled" :label="dataRangeLabelMap.customDepartment" />
          <div class="line"></div>
          <span @click="handleClickAdd">{{$t('OtherCategoryForm.setDept')}}({{ formComp.dataRange.customDepartment.departments.length }}) </span>
        </div>
        <div class="from-form-field">
          <el-checkbox v-model="formComp.dataRange.fromFormField.enabled" :label="dataRangeLabelMap.fromFormField" />
          <el-tooltip placement="top" effect="light">
            <template #content>
              <div style="max-width: 400px;">{{ $t('OtherCategoryForm.dataRangeDesc') }}</div>
            </template>
            <div class="tip-icon" @click.stop>
              <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
            </div>
          </el-tooltip>
          <div class="line"></div>
          <el-select
            v-model="selectedFromFormFieldIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            tag-type="primary"
            :placeholder="$t('OtherCategoryForm.selectMemberDeptField')"
          >
            <template #label="{ label, value }">
              <span :style="{ color: isDeletedFromFormField(value) ? 'var(--color-danger)' : 'inherit' }">
                {{ isDeletedFromFormField(value) ? $t('OtherCategoryForm.fieldDeletedReSelect') : label }}
              </span>
            </template>
            <el-option
              v-for="field in displayFromFormFieldOptions"
              :key="field.value"
              :label="field.label"
              :value="field.value"
            />
          </el-select>
        </div>
      </el-form-item>

      <el-form-item :label="$t('OtherCategoryForm.dataStatus')" prop="dataStatus" class="data-status">
        <div>
          <el-checkbox v-model="formComp.dataStatus.processing" :label="dataStatusLabelMap.processing" />
          <el-checkbox v-model="formComp.dataStatus.finished" :label="dataStatusLabelMap.finished" />
          <el-checkbox v-model="formComp.dataStatus.noProcess" :label="dataStatusLabelMap.noProcess" />
        </div>
      </el-form-item>

      <el-form-item :label="$t('OtherCategoryForm.operAuth')" prop="handleRange">
        <el-checkbox v-model="formComp.handleRange[PermissionCategory.GET]" :label="handleRangeLabelMap[PermissionCategory.GET]" disabled />
        <el-checkbox v-model="formComp.handleRange[PermissionCategory.UPDATE]" :label="handleRangeLabelMap[PermissionCategory.UPDATE]" />
        <el-checkbox v-model="formComp.handleRange[PermissionCategory.DELETE]" :label="handleRangeLabelMap[PermissionCategory.DELETE]" />
      </el-form-item>

      <div class="foot-button-box">
        <el-button type="default" @click="handleCancel">{{ $t('OtherCategoryForm.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave">{{ $t('OtherCategoryForm.save') }}</el-button>
      </div>
    </el-form>

    <nocode-user-select-dialog ref="userSelectRef" @save="handleDepSave" :onlyDepart="true"></nocode-user-select-dialog>
  </div>
</template>

<script setup lang="ts">
import { DataPermissionDataRange, DataPermissionOther, PermissionCategory, PermissionRange, PermissionRangeType } from '@common/types/nocode';
import { normalizeDataPermissionStatus } from '@common/utils';
import { ORGANIZE_UTIL } from '@renderer/types';
import { deepClone } from '@common/utils/object';
import { computed, inject, ref, shallowRef, toRaw, watch } from 'vue';
import { dataRangeLabelMap, dataStatusLabelMap, handleRangeLabelMap } from './utils';
import { ElMessage, ElMessageBox } from 'element-plus';
import i18next from 'i18next';
import { FieldUID } from '@common/types/project';
import { getUserDisplayName } from '@renderer/utils/other';

const organizeUtil = inject(ORGANIZE_UTIL);

const props = defineProps<{
  form: DataPermissionOther,
  fromFormField: {
    value: string,
    label: string
  }[]
}>();

const emit = defineEmits(['save', 'delete', 'copy']);

const formComp = ref<DataPermissionOther>();
const userSelectRef = shallowRef(null);

const editState = ref(false);
const originForm = ref<DataPermissionOther>();

function normalizeFromFormFieldIds(field: DataPermissionDataRange['fromFormField']['field']): FieldUID[] {
  const values = Array.isArray(field) ? field : field ? [field] : [];
  return Array.from(new Set(values.filter(Boolean)));
}

function getDeletedFieldLabel() {
  return `${i18next.t('OtherCategoryForm.fieldDeletedReSelect')}`;
}

const getUserName = (id: string) => {
  return getUserDisplayName(organizeUtil.findUserById(id), id);
}

function isDeletedFromFormField(fieldId?: string) {
  if (!fieldId) return false;
  return !props.fromFormField.some((field) => field.value === fieldId);
}

function normalizeForm(value: DataPermissionOther) {
  const normalizedValue = deepClone(value);
  normalizedValue.dataStatus = normalizeDataPermissionStatus(normalizedValue.dataStatus);
  if (!normalizedValue.dataRange?.fromFormField) {
    normalizedValue.dataRange.fromFormField = {
      enabled: false,
      field: [],
    };
  }
  normalizedValue.dataRange.fromFormField.field = normalizeFromFormFieldIds(normalizedValue.dataRange.fromFormField.field);
  return normalizedValue;
}

const selectedFromFormFieldIds = computed<FieldUID[]>({
  get: () => normalizeFromFormFieldIds(formComp.value?.dataRange?.fromFormField?.field),
  set: (value) => {
    if (!formComp.value) return;
    formComp.value.dataRange.fromFormField.field = normalizeFromFormFieldIds(value);
  }
});

const displayFromFormFieldOptions = computed(() => {
  const selectedIds = selectedFromFormFieldIds.value;
  const optionMap = new Map(props.fromFormField.map((field) => [field.value, field]));
  const deletedOptions = selectedIds
    .filter((fieldId) => !optionMap.has(fieldId))
    .map((fieldId) => ({
      value: fieldId,
      label: getDeletedFieldLabel(),
    }));
  return [...props.fromFormField, ...deletedOptions];
});

watch(() => editState.value, () => {
  if (editState.value) {
    originForm.value = normalizeForm(toRaw(props.form));
  }
}, { immediate: true });

function handleEdit() {
  editState.value = true;
}
function handleCopy() {
  emit('copy');
}
function handleDelete() {
  ElMessageBox.confirm(i18next.t('OtherCategoryForm.confirmDelAuthGroup'), {
    title: i18next.t('OtherCategoryForm.tips'),
    confirmButtonText: i18next.t('OtherCategoryForm.delete'),
    cancelButtonText: i18next.t('OtherCategoryForm.cancel'),
    type: 'warning',
    appendTo: '.view-tab-content'
  }).then(() => {
    emit('delete');
  }).catch(() => { });
}

function handleClickAdd() {
  const departments = deepClone(formComp.value.dataRange.customDepartment.departments);
  let data: PermissionRange = { departments, roles: [], users: [] };
  userSelectRef.value.show(i18next.t('OtherCategoryForm.setRange'), data);
}
function handleDepSave(value: PermissionRange) {
  formComp.value.dataRange.customDepartment.departments = deepClone(value.departments);
}

function handleSave() {
  const normalizedFieldIds = normalizeFromFormFieldIds(formComp.value?.dataRange?.fromFormField?.field);
  if (formComp.value.dataRange.fromFormField.enabled && normalizedFieldIds.length === 0) {
    ElMessage.warning(i18next.t('OtherCategoryForm.selectAtLeastOneMemberDeptField'));
    return;
  }
  formComp.value.dataRange.fromFormField.field = normalizedFieldIds;
  emit('save', formComp.value);
  editState.value = false;
}
function handleCancel() {
  emit('save', deepClone(toRaw(originForm.value)));
  originForm.value = null;
  editState.value = false;
}

const init = () => {
  formComp.value = normalizeForm(toRaw(props.form));
}
init();

defineExpose({
  handleEdit,
});

</script>

<style lang="scss" scoped>
.other-category-form {
  border: 1px solid var(--border-color);
  padding: 16px;
  border-radius: 4px;
  position: relative;
  color: var(--text-color-regular);
}

:deep(.el-checkbox) {
  &.is-checked .el-checkbox__label {
    color: var(--text-color-regular);
  }
}

:deep(.el-tag) {
  height: auto;
  padding: 8px;

  &.el-tag--info .el-tag__content {
    color: var(--text-color-regular);
    font-size: 14px;
  }
}

.head-button-box,
.foot-button-box {
  position: absolute;
  right: 16px;
}

.foot-button-box {
  bottom: 16px;
}

.view-container {
  font-size: 14px;

  .view-form-item {
    display: flex;
    align-items: center;

    .label {
      flex-shrink: 0;
      width: auto;
      margin-right: 16px;
    }
  }

  .title {
    margin-top: 0px;
    font-size: 16px;
    color: var(--text-color-primary);
    
    font-style: Bold;
    line-height: 20px;
    letter-spacing: 0%;
  }

  .description {
    color: var(--text-color-secondary);
    
    font-style: Bold;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    margin-top: 10px;
  }

  .memberRange, .dataRange {
    
    font-style: Bold;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;

    .content {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex-wrap: wrap;
      background-color: #fff;
      
      .el-tag {
        border: none;
      }
    }
  }

  .dataRange {
    margin-top: 16px;
  }
  
  .memberRange .content{
    gap: 4px 8px;
  }

  .dataRange .content {
    gap: 4px 16px;

    &>span {
      flex-shrink: 0;
    }
  }
  .handleRange {
    margin-top: 16px;
    
    font-style: Bold;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;


    .content {
      &>span:nth-child(n + 2)::before {
        content: '|';
        margin: 0px 8px;
        color: var(--text-color-placeholder);
      }
    }
  }
}

:deep(.el-form.permission-form) {
  
  font-style: Bold;
  font-size: 14px;
  leading-trim: NONE;
  line-height: 20px;
  letter-spacing: 0%;



  .el-form-item {
    &.data-range .el-form-item__content {
      flex-direction: column;
      align-items: start;

      .custom-department {
        display: flex;
        align-items: center;
        gap: 12px;

        .line {
          width: 1px;
          height: 12px;
          background-color: var(--border-color);
        }

        &>span {
          cursor: pointer;
          color: var(--color-primary);
        }
      }

      .from-form-field {
        display: flex;
        align-items: center;

        .line {
          width: 1px;
          height: 12px;
          background-color: var(--border-color);
          margin-right: 12px;
        }

        .el-select {
          width: 306px;

          .el-select__wrapper {
            background-color: var(--bg-color-overlay);
            box-shadow: none;
            border-radius: 4px;

            .el-tag {
              padding: 3px 8px;
            }
          }
        }

        .tip-icon {
          display: flex;
          align-items: center;
          margin-left: 4px;
          margin-right: 8px;
        }
      }
    }
  }
}

:deep(.el-divider) {
  margin: 10px 0px;
}
</style>
