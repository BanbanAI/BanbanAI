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
        <div class="table">
          <el-table :data="subForm.tableData" empty-text="" row-key="uid"
            :tree-props="{ children: 'none', hasChildren: 'none' }">
            <el-table-column type="selection" width="60" v-if="false" :resizable="false" />
            <el-table-column type="index" label="" :align="'center'" width="60" :resizable="false" />
            <template v-for="(child, index) in subForm.children" :key="child.uid">
              <el-table-column v-if="child.isCreateField() || !child.isReadonly" :label="child.title"
                :resizable="false" :align="'left'" :width="child.widthInSubForm">
                <template #default="{ row, column }">
                  <x-widget v-if="!subForm.isReadonly" :widget="row.children[index]" :style="{padding: '0px'}"></x-widget>
                </template>
              </el-table-column>
            </template>
            <el-table-column className="control-column" :label="i18next.t('operation')" :align="'center'"
              :resizable="false" width="100">
              <template #default="scope">
                <el-button class="control-btn" type="danger" size="small" link
                  @click="subForm.deleteRow(scope.$index)">{{ i18next.t('delete') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
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
import { ref } from 'vue';
import IEpPlus from "~icons/ep/plus";
import i18next, { $t } from "@renderer/widgets/i18next";

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
  subForm.value.inputValue = processingRows;
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

const onOpen = async () => {
  await initSubform();
  initData();
}

const onClosed = async () => {
  subForm.value.detach();
  subForm.value.destroy();
  subForm.value = undefined
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

      .el-table {

        .el-table__body {
          border-bottom: 1px solid rgb(220, 223, 230);

          .el-table__row {
            cursor: pointer;

            .el-table__cell {
              padding: 0;

              .el-radio__label,
              .el-checkbox__label {
                display: none;
              }
            }
          }
        }
      }

      .el-scrollbar {
        .el-scrollbar__view {
          padding-bottom: 15px;
        }

        .el-scrollbar__bar {
          margin-bottom: 4px;
        }
        .el-scrollbar__thumb {
          height: 10px;
        }
      }
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

    .table {
      display: flex;
      width: 100%;
    }

    .el-table {
      --el-table-header-text-color: #000;
      --el-table-header-bg-color: #F7F7FA;
      --el-table-tr-bg-color: #fff;
      --el-table-border-color: var(--el-border-color);

      width: unset;
      height: unset;
      max-height: 500px;
      border: var(--el-table-border);
      border-radius: 4px;

      :deep(.el-table__header) {
        height: 36px;
      }

      :deep(.el-table__empty-block) {
        display: none;
      }

      .required {
        color: #eb5050;
        font-size: 14px;
        margin-right: 4px;
        font-family: "Segoe UI";
      }

      :deep(thead) {
        th {
          font-weight: 100;
        }
      }

      :deep(.el-table__inner-wrapper::before) {
        display: none;
      }

      :deep(.el-table__row:last-of-type) {
        .el-table__cell {
          border-bottom: none;
        }
      }

      :deep(.el-table__cell) {
        border-right: var(--el-table-border);

        &:last-of-type {
          border-right: none;
        }

        padding: 0px;

        .cell {
          padding: 4px;
        }
      }
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
