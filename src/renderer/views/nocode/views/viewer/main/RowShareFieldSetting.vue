<template>
  <div class="row-share-field-setting">
    <div class="field-header">
      <div class="field-name">{{ $t('RowShareFieldSetting.fieldLabel') }}</div>
      <div class="field-auth field-auth-head">
        <el-checkbox v-model="allVisible" :disabled="!fieldPermissionTableData.length" />
        <span class="field-auth-text">{{ $t('RowShareFieldSetting.visible') }}</span>
      </div>
      <div class="field-auth field-auth-head">
        <el-checkbox v-model="allEditable" :disabled="!editableRows.length" />
        <span class="field-auth-text">{{ $t('RowShareFieldSetting.editable') }}</span>
      </div>
    </div>

    <div v-if="fieldPermissionTableData.length" class="field-body">
      <div v-for="row in fieldPermissionTableData" :key="row.uid" class="field-row">
        <div class="field-name" :style="{ paddingLeft: Math.min(row.path.length + 1, 4) * 16 + 'px' }">
          {{ row.name }}
        </div>
        <div class="field-auth field-auth-cell">
          <el-checkbox
            v-model="row.visible"
            @change="(val: boolean) => handleVisibleChange(val, row)"
          />
        </div>
        <div class="field-auth field-auth-cell">
          <el-checkbox
            v-show="row.allowEdit"
            v-model="row.editable"
            @change="(val: boolean) => handleEditableChange(val, row)"
          />
        </div>
      </div>
    </div>

    <el-empty v-else :description="$t('RowShareFieldSetting.empty')" />
  </div>
</template>

<script setup lang="ts">
import { FieldAuthValue } from '@common/types/nocode';
import { getFormElementsInfo, isSystemField } from '@common/utils';
import { computed, ref, watch } from 'vue';
import type { Nocode } from '@common/types/nocode';
import type { Field, Table } from '@common/types/project';

type RowPermissionItem = {
  uid: string,
  name: string,
  path: string[],
  visible: boolean,
  editable: boolean,
  allowEdit: boolean,
  selfInfo?: Field,
}

const props = defineProps<{
  table: Table,
  nocode: Nocode,
}>();

const fieldPermissionTableData = ref<RowPermissionItem[]>([]);

const ensurePublish = () => {
  props.table.publish = props.table.publish || {};
  return props.table.publish;
};

const formElementsInfo = computed(() => {
  return getFormElementsInfo(props.nocode?.body?.formData?.formOptions?.[props.table.uid]?.widget?.widgets || []);
});

const getFieldByUID = (uid: string) => {
  return props.table.fields.find(field => field.meta?.uid === uid || field.uid === uid);
};

const canEditField = (field?: Field) => {
  return !field || !isSystemField(field);
};

const getDefaultFieldsAuth = () => {
  return formElementsInfo.value.reduce<Record<string, FieldAuthValue>>((prev, item) => {
    prev[item.uid] = FieldAuthValue.VISIBLE;
    return prev;
  }, {});
};

const getCurrentFieldsAuth = () => {
  const publish = ensurePublish();
  const defaultFieldsAuth = getDefaultFieldsAuth();
  const fieldsAuth = publish.rowShareFieldsAuth;
  if (!fieldsAuth) {
    return defaultFieldsAuth;
  }
  return Object.keys(defaultFieldsAuth).reduce<Record<string, FieldAuthValue>>((prev, fieldUID) => {
    const auth = fieldsAuth[fieldUID];
    prev[fieldUID] = [FieldAuthValue.HIDDEN, FieldAuthValue.VISIBLE, FieldAuthValue.VISIBLE_EDITABLE].includes(auth)
      ? auth
      : defaultFieldsAuth[fieldUID];
    return prev;
  }, {});
};

const initTableData = () => {
  const fieldsAuth = getCurrentFieldsAuth();
  fieldPermissionTableData.value = formElementsInfo.value.map(item => {
    const auth = fieldsAuth[item.uid];
    const selfInfo = getFieldByUID(item.uid);
    const allowEdit = canEditField(selfInfo);
    return {
      uid: item.uid,
      name: item.name || selfInfo?.alias || '',
      path: item.path || [],
      visible: auth !== FieldAuthValue.HIDDEN,
      editable: allowEdit && auth === FieldAuthValue.VISIBLE_EDITABLE,
      allowEdit,
      selfInfo,
    };
  });
};

const syncFieldsAuth = () => {
  ensurePublish().rowShareFieldsAuth = fieldPermissionTableData.value.reduce<Record<string, FieldAuthValue>>((prev, item) => {
    if (item.visible && item.editable) {
      prev[item.uid] = FieldAuthValue.VISIBLE_EDITABLE;
    } else if (item.visible) {
      prev[item.uid] = FieldAuthValue.VISIBLE;
    } else {
      prev[item.uid] = FieldAuthValue.HIDDEN;
    }
    return prev;
  }, {});
};

watch(() => [props.table.uid, props.table.publish?.rowShareFieldsAuth, formElementsInfo.value], () => {
  initTableData();
}, { immediate: true, deep: true });

const editableRows = computed(() => {
  return fieldPermissionTableData.value.filter(item => (item.selfInfo && !isSystemField(item.selfInfo)) || !item.selfInfo);
});

const allVisible = computed<boolean>({
  get: () => {
    if (!fieldPermissionTableData.value.length) return false;
    return fieldPermissionTableData.value.every(item => item.visible);
  },
  set: (value) => {
    fieldPermissionTableData.value.forEach(item => {
      item.visible = value;
      if (!value) {
        item.editable = false;
      }
    });
    syncFieldsAuth();
  },
});

const allEditable = computed<boolean>({
  get: () => {
    if (!editableRows.value.length) return false;
    return editableRows.value.every(item => item.editable);
  },
  set: (value) => {
    editableRows.value.forEach(item => {
      item.editable = value;
      if (value) {
        item.visible = true;
      }
    });
    if (value) {
      fieldPermissionTableData.value.forEach(item => {
        item.visible = true;
      });
    }
    syncFieldsAuth();
  },
});

const handleVisibleChange = (value: boolean, row: RowPermissionItem, isParent = false) => {
  const parent = row.path?.length ? row.path[row.path.length - 1] : null;
  if (!isParent) {
    if (!value) {
      row.editable = false;
    }
    for (const item of fieldPermissionTableData.value) {
      if (item.path?.includes(row.uid)) {
        item.visible = value;
        if (!value) {
          item.editable = false;
        }
      }
    }
  }

  if (parent) {
    const parentField = fieldPermissionTableData.value.find(item => item.uid === parent);
    if (!parentField) return;
    if (value) {
      parentField.visible = true;
    } else {
      const childFields = fieldPermissionTableData.value.filter(item => item.path?.[item.path.length - 1] === parent);
      if (childFields.every(item => !item.visible)) {
        parentField.visible = false;
      }
      if (childFields.every(item => !item.editable)) {
        parentField.editable = false;
      }
    }
    handleVisibleChange(value, parentField, true);
  }

  syncFieldsAuth();
};

const handleEditableChange = (value: boolean, row: RowPermissionItem, isParent = false) => {
  const parent = row.path?.length ? row.path[row.path.length - 1] : null;
  if (!isParent) {
    if (value) {
      row.visible = true;
    }
    for (const item of editableRows.value) {
      if (item.path?.includes(row.uid)) {
        item.editable = value;
        if (value) {
          item.visible = true;
        }
      }
    }
  }

  if (parent) {
    const parentField = editableRows.value.find(item => item.uid === parent);
    if (!parentField) return;
    if (value) {
      parentField.editable = true;
      parentField.visible = true;
    } else {
      const childFields = editableRows.value.filter(item => item.path?.[item.path.length - 1] === parent);
      if (childFields.every(item => !item.editable)) {
        parentField.editable = false;
      }
    }
    handleEditableChange(value, parentField, true);
  }

  syncFieldsAuth();
};
</script>

<style lang="scss" scoped>
.row-share-field-setting {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-white);

  .field-header,
  .field-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 136px 136px;
    align-items: center;
    min-height: 42px;
  }

  .field-header {
    background-color: #f7f8fb;
    border-bottom: 1px solid var(--border-color);
    font-size: 14px;
    color: var(--text-color-regular);
  }

  .field-name {
    padding: 0 16px;
    font-size: 14px;
    color: var(--text-color-regular);
    line-height: 20px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .field-auth {
    display: flex;
    align-items: center;
    min-height: 42px;
    box-sizing: border-box;
    padding: 0 24px;
    color: var(--text-color-regular);
    font-size: 14px;
    line-height: 20px;

    :deep(.el-checkbox) {
      margin-right: 0;
      height: 16px;
    }

    :deep(.el-checkbox__input) {
      display: flex;
      align-items: center;
    }

    :deep(.el-checkbox__label) {
      display: none;
    }
  }

  .field-auth-head {
    gap: 8px;
  }

  .field-auth-cell {
    justify-content: flex-start;
  }

  .field-auth-text {
    white-space: nowrap;
  }

  .field-body {
    padding: 0;
  }

  .field-row {
    min-height: 42px;
    border-bottom: 1px solid #f0f2f5;

    &:last-child {
      border-bottom: none;
    }
  }
}
</style>
