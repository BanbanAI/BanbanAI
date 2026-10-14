<template>
  <div class="subform-default-valkue-dialog">
    <el-dialog
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      :title="$t('defaultValue')"
      width="680"
      align-center
      :close-on-click-modal="false"
      @open="onOpen"
      @closed="onClosed"
    >
      <el-container v-if="subForm">
        <SubFormGrid
          v-if="subForm.hasRuntime && subForm.runtimeStore"
          class="default-value-grid"
          :store="subForm.runtimeStore"
          :columns="gridColumns"
          :height="500"
          :row-height="gridRowHeight"
          :action-width="60"
          :trailing-action-width="80"
          stretch-columns
          :option-service="subForm.runtimeOptionService"
          :related-data-service="subForm.runtimeRelatedDataService"
        >
          <template #trailing-action-header>{{ i18next.t('operation') }}</template>
          <template #trailing-action="{ index }">
            <el-button class="control-btn" type="danger" size="small" link
              @click="handleDeleteRow(index)">{{ i18next.t('delete') }}</el-button>
          </template>
        </SubFormGrid>
        <div class="btn-list">
          <span @click="subForm.addRow()">
            <el-icon class="add-icon">
              <i-ep-plus/>
            </el-icon>
            {{ i18next.t('addItem') }}
          </span>
        </div>
      </el-container>
      <template #footer>
        <el-button type="default" @click="emit('update:modelValue', false)">{{ i18next.t('cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ i18next.t('confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { deepClone } from '@common/utils/object';
import { SubForm } from './subForm';
import { unique } from '@common/utils/unique';
import { computed, ref } from 'vue';
import IEpPlus from "~icons/ep/plus";
import i18next, { $t } from "@renderer/widgets/i18next";
import SubFormGrid from "./grid/SubFormGrid.vue";

type UID = string

const props = defineProps<{
  modelValue: boolean,
  value?: Record<UID, any>[];
  widget: SubForm;
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "update", value: object[]): void;
}>();

const subForm = ref<SubForm>()
const uidMap = ref<Record<UID, UID>>({}); // <拷贝新建UID, 原子表单UID>
const gridColumns = computed(() => (subForm.value?.runtimeColumns || []).filter(
  column => (column.schema as Record<string, unknown>)?.isReadonly !== true,
));
const gridRowHeight = computed(() => (
  gridColumns.value.some(column => column.type === "widget.form.textarea") ? 100 : 36
));

const initSubform = async () => {
  const soul = deepClone(props.widget.getSoul());
  for (const widget of soul.widgets) {
    const oldUID = widget.uid;
    widget.uid = unique();
    uidMap.value[widget.uid] = oldUID;
  }

  const res = await props.widget.getBoard().container.addWidget({
    ...soul,
    uid: unique(),
    enabled: false
  },
    20
  ) as SubForm;
  subForm.value = res;
  subForm.value.children.forEach((c) => { 
    c.bindField({
      ...c.field,
      uid: c.uid
    })
  });
  subForm.value.isEditingDefaultValue = true;
  subForm.value.watchRows();
};

const initData = async () => {
  if (!subForm.value) return;

  const oldRows = deepClone(props.value || [{}]);
  const processingRows = [];
  for (const row of oldRows) {
    const newUIDRow = {};
    for (const widget of subForm.value.children) {
      if (uidMap.value[widget.uid]) newUIDRow[widget.uid] = row[uidMap.value[widget.uid]] || widget.inputValue;
    }
    processingRows.push(newUIDRow);
  }
  await subForm.value.batchReplaceRows(processingRows, "default");
}

const handleConfirm = () => {
  emit('update:modelValue', false);
  const rows = [];
  for (const row of subForm.value.inputValue) {
    const oldUIDRow = {};
    for (const [newUID, value] of Object.entries(row)) {
      const oldUID = uidMap.value[newUID];
      if (oldUID) oldUIDRow[oldUID] = value;
    }
    rows.push(oldUIDRow);
  }
  emit("update", rows);
}

const handleDeleteRow = (index: number) => {
  subForm.value?.deleteRow(index);
}

const onOpen = async () => {
  if (subForm.value) {
    subForm.value.destroy();
    subForm.value = undefined;
  }
  await initSubform();
  await initData();
}

const onClosed = async () => {
  subForm.value?.detach?.();
  subForm.value?.destroy?.();
  subForm.value = undefined;
}
</script>

<style lang='scss' scoped>
.subform-default-valkue-dialog {
  :deep(.el-dialog) {
    padding: 0px;
    background-color: var(--color-white);
    border-radius: 4px;

    .el-dialog__header {
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--border-color);

      span {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
        text-align: center;
      }
    }

    .el-dialog__body {
      padding: 16px;
    }

    .el-dialog__footer {
      padding: 8px 16px 16px;

      .el-button {
        border-radius: 4px;
        width: 60px;
        height: 32px;

        .el-button--primary {
          background-color: var(--color-primary);
          color: var(--color-white);
        }
      }
    }
  }

  .el-container {
    display: flex;
    width: 100%;
    flex-wrap: wrap;

    .default-value-grid {
      width: 100%;
      --el-table-tr-bg-color: #fff;

      :deep(.subform-grid__row:hover),
      :deep(.subform-grid__row:focus-within) {
        background: #fff;
      }

      :deep(.subform-grid__row:hover .subform-grid__action-cell--trailing),
      :deep(.subform-grid__row:focus-within .subform-grid__action-cell--trailing) {
        background: #fff;
      }
    }

    .control-btn {
      padding: 0;
      height: auto;
      min-height: 0;
    }

    .btn-list {
      margin-top: 16px;
      cursor: pointer;

      span {
        color: var(--color-primary);
        display: flex;
        align-items: center;
        justify-self: center;
        gap: 3px;
      }

      .el-button {
        border-radius: 2px;
      }
    }
  }
}
</style>
