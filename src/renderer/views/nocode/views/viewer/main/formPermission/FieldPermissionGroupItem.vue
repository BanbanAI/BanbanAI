<template>
  <div class="field-permission-group-item">
    <div class="view-container" v-if="!editState">
      <div class="head-button-box">
        <el-button type="default" @click="handleEdit">{{ $t('FieldPermissionGroupItem.edit') }}</el-button>
        <el-button type="default" @click="handleCopy">{{ $t('FieldPermissionGroupItem.copy') }}</el-button>
        <el-button type="default" @click="handleDelete">{{ $t('FieldPermissionGroupItem.delete') }}</el-button>
      </div>

      <div class="view-form-item title">{{ groupComp.title || '-' }}</div>
      <div class="view-form-item description">{{ groupComp.description || '-' }}</div>

      <el-divider />

      <div class="view-form-item memberRange">
        <div class="label">{{ $t('FieldPermissionGroupItem.orgMember') }}</div>
        <div class="content" v-if="groupComp.memberRange.rangeType === PermissionRangeType.ALL">
          <el-tag type="info">{{ $t('FieldPermissionGroupItem.allViewMember') }}</el-tag>
        </div>
        <div v-else class="content">
          <el-tag v-for="tag in groupComp.memberRange.range.departments" :key="`dep-${tag}`" type="info">
            {{ organizeUtil.departments.find(item => item.id === tag).name }}
          </el-tag>
          <el-tag v-for="tag in groupComp.memberRange.range.roles" :key="`role-${tag}`" type="info">
            {{ organizeUtil.roles.find(item => item.id === tag).name }}
          </el-tag>
          <el-tag v-for="tag in groupComp.memberRange.range.users" :key="`user-${tag}`" type="info">
            {{ getUserName(tag) }}
          </el-tag>
        </div>
      </div>
      <div class="view-form-item externalVisitor">
        <div class="label">{{ $t('FieldPermissionGroupItem.externalVisitor') }}</div>
        <div class="content">
          <el-tag type="info">
            {{ groupComp.externalVisitorEnabled !== false ? $t('FieldPermissionGroupItem.enabled') : $t('FieldPermissionGroupItem.disabled') }}
          </el-tag>
        </div>
      </div>
      <div class="view-form-item fieldRange">
        <div class="label">{{ $t('FieldPermissionGroupItem.fieldRange') }}</div>
        <div class="content" v-if="groupComp.fieldRange.rangeType === PermissionRangeType.ALL">{{ $t('FieldPermissionGroupItem.allField') }}</div>
        <div v-else class="content">{{ $t('FieldPermissionGroupItem.custom') }}</div>
      </div>
    </div>
    <el-form v-else :model="groupComp" label-position="left" class="permission-form edit-container" label-width="auto">
      <el-form-item :label="$t('FieldPermissionGroupItem.name')" prop="title">
        <el-input v-model="groupComp.title" class="noborder-input" style="width: 406px;" :placeholder="$t('FieldPermissionGroupItem.plsInputName')" />
      </el-form-item>

      <el-form-item :label="$t('FieldPermissionGroupItem.desc')" prop="description">
        <el-input v-model="groupComp.description" class="noborder-input" style="width: 406px;" :placeholder="$t('FieldPermissionGroupItem.plsInputDesc')" />
      </el-form-item>

      <el-divider />

      <el-form-item :label="$t('FieldPermissionGroupItem.orgMember')" prop="memberRange">
        <form-view-member-range v-model:data="groupComp.memberRange"></form-view-member-range>
      </el-form-item>

      <el-form-item :label="$t('FieldPermissionGroupItem.externalVisitor')">
        <div class="external-visitor-setting">
          <el-checkbox v-model="groupComp.externalVisitorEnabled"></el-checkbox>
          <el-tooltip effect="light" :offset="8" :content="$t('FieldPermissionGroupItem.externalVisitorTip')" placement="top-start" :show-arrow="false" popper-style="background-color: #fff;">
            <el-icon size="14" color="#86909c"><i-nocode-data-source-form-question/></el-icon>
          </el-tooltip>
        </div>
      </el-form-item>

      <el-form-item :label="$t('FieldPermissionGroupItem.fieldRange')" prop="fieldRange">
        <field-permission-setting v-model:data="groupComp.fieldRange" :activePageId="activePageId"></field-permission-setting>
      </el-form-item>

      <div class="foot-button-box">
        <el-button type="default" @click="handleCancel">{{ $t('FieldPermissionGroupItem.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave">{{ $t('FieldPermissionGroupItem.save') }}</el-button>
      </div>
    </el-form>

    <nocode-user-select-dialog ref="userSelectRef" @save="handleDepSave"></nocode-user-select-dialog>
  </div>
</template>

<script setup lang='ts'>
import { FieldPermissionGroupItemType, PermissionRange, PermissionRangeType } from '@common/types/nocode';
import { ORGANIZE_UTIL } from '@renderer/types';
import { deepClone } from '@common/utils/object';
import { ElMessageBox } from 'element-plus';
import i18next from 'i18next';
import { inject, ref, toRaw, watch } from 'vue';
import { getUserDisplayName } from '@renderer/utils/other';

const userSelectRef = ref(null);
const editState = ref(false);
const originForm = ref<FieldPermissionGroupItemType>();
const groupComp = ref<FieldPermissionGroupItemType>();
const organizeUtil = inject(ORGANIZE_UTIL);

const props = defineProps<{
  group: FieldPermissionGroupItemType,
  activePageId: string,
}>();
const emit = defineEmits(['save', 'delete', 'copy']);

watch(() => editState.value, () => {
  if (editState.value) {
    originForm.value = deepClone(toRaw(props.group));
  }
}, { immediate: true });

function handleEdit() {
  editState.value = true;
}
function handleCopy() {
  emit('copy');
}
function handleDelete() {
  ElMessageBox.confirm(i18next.t('FieldPermissionGroupItem.confirmDelAuthGroup'), {
    title: i18next.t('FieldPermissionGroupItem.tips'),
    confirmButtonText: i18next.t('FieldPermissionGroupItem.delete'),
    cancelButtonText: i18next.t('FieldPermissionGroupItem.cancel'),
    type: 'warning',
    appendTo: '.view-tab-content'
  }).then(() => {
    emit('delete');
  }).catch(() => { });
}

function handleDepSave(value: PermissionRange) {
  groupComp.value.memberRange.range = deepClone(value);
}

const getUserName = (id: string) => {
  return getUserDisplayName(organizeUtil.findUserById(id), id);
}

function handleSave() {
  emit('save', groupComp.value);
  editState.value = false;
}
function handleCancel() {
  emit('save', deepClone(toRaw(originForm.value)));
  originForm.value = null;
  editState.value = false;
}

const init = () => {
  const value = deepClone(toRaw(props.group));
  if (value.externalVisitorEnabled === undefined) {
    value.externalVisitorEnabled = true;
  }
  groupComp.value = value;
}
init();

defineExpose({
  handleEdit,
});
</script>

<style lang="scss" scoped>
.field-permission-group-item {
  border: 1px solid var(--border-color);
  padding: 16px;
  border-radius: 4px;
  position: relative;
  color: var(--text-color-regular);

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

    .memberRange .fieldRange {
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

    .fieldRange {
      margin-top: 16px;
    }

    .externalVisitor {
      margin-top: 16px;

      .content {
        display: flex;
        align-items: center;
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
      width: 100%;
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
}

.external-visitor-setting {
  display: flex;
  align-items: center;
  gap: 4px;
}

:deep(.el-divider) {
  margin: 10px 0px;
}
</style>
