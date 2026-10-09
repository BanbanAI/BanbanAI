<template>
  <div class="view-operation-permission-group-form">
    <div class="view-container" v-if="!editState">
      <div class="head-button-box">
        <el-button type="default" @click="handleEdit">{{ $t('ViewOperationPermissionGroupForm.edit') }}</el-button>
        <el-button type="default" @click="handleCopy">{{ $t('ViewOperationPermissionGroupForm.copy') }}</el-button>
        <el-button type="default" @click="handleDelete">{{ $t('ViewOperationPermissionGroupForm.delete') }}</el-button>
      </div>

      <div class="view-form-item title">{{ formComp.title || '-' }}</div>
      <div class="view-form-item description">{{ formComp.description || '-' }}</div>

      <el-divider />

      <div class="view-form-item memberRange">
        <div class="label">{{ $t('ViewOperationPermissionGroupForm.authMember') }}</div>
        <div class="content" v-if="formComp.memberRange.rangeType === PermissionRangeType.ALL">
          <el-tag type="info">{{ $t('ViewOperationPermissionGroupForm.allViewMember') }}</el-tag>
        </div>
        <div v-else class="content">
          <el-tag v-for="tag in formComp.memberRange.range.departments" :key="tag" type="info">
            {{ getDepartmentName(tag) }}
          </el-tag>
          <el-tag v-for="tag in formComp.memberRange.range.roles" :key="tag" type="info">
            {{ getRoleName(tag) }}
          </el-tag>
          <el-tag v-for="tag in formComp.memberRange.range.users" :key="tag" type="info">
            {{ getUserName(tag) }}
          </el-tag>
        </div>
      </div>

      <div class="view-form-item handleRange">
        <div class="label">{{ $t('ViewOperationPermissionGroupForm.operAuth') }}</div>
        <div class="content">
          <span v-for="item in selectedOperationLabels" :key="item">
            {{ item }}
          </span>
          <span v-if="!selectedOperationLabels.length">-</span>
        </div>
      </div>
    </div>

    <el-form
      v-else
      :model="formComp"
      label-position="left"
      class="permission-form edit-container"
      label-width="auto"
    >
      <el-form-item :label="$t('ViewOperationPermissionGroupForm.name')" prop="title">
        <el-input
          v-model="formComp.title"
          class="noborder-input"
          style="width: 406px;"
          :placeholder="$t('ViewOperationPermissionGroupForm.plsInputName')"
        />
      </el-form-item>

      <el-form-item :label="$t('ViewOperationPermissionGroupForm.desc')" prop="description">
        <el-input
          v-model="formComp.description"
          class="noborder-input"
          style="width: 406px;"
          :placeholder="$t('ViewOperationPermissionGroupForm.plsInputDesc')"
        />
      </el-form-item>

      <el-divider />

      <el-form-item :label="$t('ViewOperationPermissionGroupForm.authMember')" prop="memberRange">
        <form-view-member-range v-model:data="formComp.memberRange"></form-view-member-range>
      </el-form-item>

      <el-form-item :label="$t('ViewOperationPermissionGroupForm.operAuth')" prop="handleRange">
        <el-checkbox
          v-for="item in operationOptions"
          :key="item.value"
          v-model="formComp.handleRange[item.value]"
          :label="item.label"
        />
      </el-form-item>

      <div class="foot-button-box">
        <el-button type="default" @click="handleCancel">{{ $t('ViewOperationPermissionGroupForm.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave">{{ $t('ViewOperationPermissionGroupForm.save') }}</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, toRaw, watch } from 'vue';
import { PermissionRangeType, ViewOperationPermissionGroup, ViewOperationPermissionKey } from '@common/types/nocode';
import { ORGANIZE_UTIL } from '@renderer/types';
import { deepClone } from '@common/utils/object';
import { ElMessageBox } from 'element-plus';
import i18next from 'i18next';
import { getUserDisplayName } from '@renderer/utils/other';

const organizeUtil = inject(ORGANIZE_UTIL);

const props = defineProps<{
  form: ViewOperationPermissionGroup,
}>();

const emit = defineEmits(['save', 'delete', 'copy']);

const formComp = ref<ViewOperationPermissionGroup>();
const editState = ref(false);
const originForm = ref<ViewOperationPermissionGroup>();

const operationOptions = computed(() => ([
  {
    value: ViewOperationPermissionKey.IMPORT,
    label: i18next.t('ViewOperationPermissionGroupForm.import'),
  },
  {
    value: ViewOperationPermissionKey.EXPORT,
    label: i18next.t('ViewOperationPermissionGroupForm.export'),
  },
  {
    value: ViewOperationPermissionKey.BATCH_PRINT,
    label: i18next.t('ViewOperationPermissionGroupForm.batchPrint'),
  },
  {
    value: ViewOperationPermissionKey.BATCH_UPDATE,
    label: i18next.t('ViewOperationPermissionGroupForm.batchEdit'),
  },
  {
    value: ViewOperationPermissionKey.BATCH_DELETE,
    label: i18next.t('ViewOperationPermissionGroupForm.batchDelete'),
  },
]));

const selectedOperationLabels = computed(() => {
  return operationOptions.value
    .filter(item => formComp.value?.handleRange?.[item.value])
    .map(item => item.label);
});

watch(() => editState.value, () => {
  if (editState.value) {
    originForm.value = deepClone(toRaw(props.form));
  }
}, { immediate: true });

watch(() => props.form, () => {
  init();
}, { deep: true });

function handleEdit() {
  editState.value = true;
}

function handleCopy() {
  emit('copy');
}

function handleDelete() {
  ElMessageBox.confirm(i18next.t('ViewOperationPermissionGroupForm.confirmDelAuthGroup'), {
    title: i18next.t('ViewOperationPermissionGroupForm.tips'),
    confirmButtonText: i18next.t('ViewOperationPermissionGroupForm.delete'),
    cancelButtonText: i18next.t('ViewOperationPermissionGroupForm.cancel'),
    type: 'warning',
    appendTo: '.view-operation-tab-content',
  }).then(() => {
    emit('delete');
  }).catch(() => {});
}

function handleSave() {
  emit('save', formComp.value);
  editState.value = false;
}

function handleCancel() {
  emit('save', deepClone(toRaw(originForm.value)));
  originForm.value = null;
  editState.value = false;
}

function getDepartmentName(id: string) {
  return organizeUtil.departments.find(item => item.id === id)?.name || id;
}

function getRoleName(id: string) {
  return organizeUtil.roles.find(item => item.id === id)?.name || id;
}

function getUserName(id: string) {
  return getUserDisplayName(organizeUtil.findUserById(id), id);
}

function init() {
  formComp.value = deepClone(toRaw(props.form));
}

init();

defineExpose({
  handleEdit,
});
</script>

<style lang="scss" scoped>
.view-operation-permission-group-form {
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

:deep(.el-input.noborder-input) {
  .el-input__wrapper {
    box-shadow: unset;
    background-color: var(--bg-color-overlay);
    border-radius: 4px;
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

  .memberRange,
  .handleRange {
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

  .memberRange {
    margin-top: 16px;

    .content {
      gap: 4px 8px;
    }
  }

  .handleRange {
    margin-top: 16px;

    .content {
      gap: 4px 0;

      & > span:nth-child(n + 2)::before {
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
    margin-bottom: 20px;
  }
}

:deep(.el-divider) {
  margin: 10px 0px;
}
</style>
