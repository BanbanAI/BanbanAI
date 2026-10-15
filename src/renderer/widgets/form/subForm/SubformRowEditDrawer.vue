<template>
  <div class="subForm-row-edit-drawer-wrapper">
    <teleport to="body">
      <el-drawer
        class="subForm-row-edit-drawer"
        v-model="visible"
        :with-header="false"
        close-on-click-modal
        v-bind="drawerInfo"
        >
        <el-container>
          <el-header>
            <span class="subform-title">{{ subForm.title }}</span>
            <div class="wrap-drawer-controller">
              <div class="pagination">
                <el-button class="btn-previous" link :disabled="indexOfShowRow === 0" @click="indexOfShowRow--">
                  <el-icon><i-ep-arrow-left></i-ep-arrow-left></el-icon>
                </el-button>
                <span class="pagination-index">{{ `${indexOfShowRow + 1}/${rowCount}` }}</span>
                <el-button class="btn-next" link :disabled="indexOfShowRow === rowCount - 1"
                  @click="indexOfShowRow++">
                  <el-icon><i-ep-arrow-right></i-ep-arrow-right></el-icon>
                </el-button>
              </div>

              <el-button class="btn-exit" link @click="visible = false">
                <el-icon><i-ant-design-shrink-outlined></i-ant-design-shrink-outlined></el-icon>
              </el-button>
            </div>
          </el-header>

          <el-main>
            <div v-if="subForm.hasRuntime && runtimeRowId" class="runtime-row-editor">
              <div v-for="column in runtimeColumns" :key="column.id" class="runtime-row-editor__field">
                <span class="runtime-row-editor__label">{{ column.schema.title || column.fieldId }}</span>
                <div class="runtime-row-editor__cell">
                  <CellPresenter
                    :address="{ rowId: runtimeRowId, fieldId: column.fieldId }"
                    :column="column"
                    :store="subForm.runtimeStore"
                    :version="runtimeVersion"
                    :readonly="subForm.isReadonly"
                    :related-data-service="subForm.runtimeRelatedDataService"
                    :option-service="subForm.runtimeOptionService"
                    @commit="handleRuntimeCommit"
                    @action="handleRuntimeAction"
                  />
                </div>
              </div>
            </div>
            <form-real-time-editor v-else-if="subForm?.tableData?.[indexOfShowRow]"
              :form="subForm?.tableData?.[indexOfShowRow]"></form-real-time-editor>
          </el-main>

          <el-footer>
            <el-button class="btn-add" :disabled="!subForm.canAddRows()" @click="handleCreateRow">{{ $t('create') }}</el-button>
            <el-button class="btn-copy" @click="handleCopyRow(indexOfShowRow)">{{ $t('copy') }}</el-button>
            <el-button class="btn-confirm" type="primary" @click="visible = false">{{ $t('complete') }}</el-button>
          </el-footer>
        </el-container>
      </el-drawer>
    </teleport>
  </div>
</template>

<script lang='ts' setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import { SubForm } from './subForm';
import IEpArrowLeft from "~icons/ep/arrow-left";
import IEpArrowRight from "~icons/ep/arrow-right";
import IAntDesignShrinkOutlined from "~icons/ant-design/shrink-outlined";
import FormRealTimeEditor from './FormRealTimeEditor.vue';
import CellPresenter from './grid/CellPresenter.vue';
import type { CellAddress } from './runtime/types';
import { isMobile } from '@renderer/utils/pure';
import { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  subForm: SubForm;
}>();
const emit = defineEmits<{
  (event: "copyRow", rowIndex: number): Promise<void>
  (event: "createRow"): Promise<void>
  (event: "cell-action", payload: { address: CellAddress; anchor?: HTMLElement | null; readonly?: boolean }): void
}>();

const indexOfShowRow = ref(0);
const visible = ref(false);
const isAddRow = ref(false);
const runtimeVersion = ref(0);
let stopRuntimeStoreSubscription: (() => boolean) | undefined;

const rowCount = computed(() => props.subForm.hasRuntime
  ? props.subForm.runtimeTableData.length
  : props.subForm.tableData.length);

const runtimeRowId = computed(() => {
  if (!props.subForm.hasRuntime) return undefined;
  const row = props.subForm.runtimeTableData[indexOfShowRow.value] as Record<string, unknown> | undefined;
  const id = row?.__rowId || row?.__uuid__ || row?.uid;
  return id === undefined || id === null ? undefined : String(id);
});

const runtimeColumns = computed(() => {
  const rowId = runtimeRowId.value;
  const store = props.subForm.runtimeStore;
  if (!rowId || !store) return [];
  const row = store.getRow(rowId);
  if (!row) return [];
  return (props.subForm.runtimeColumns || []).filter(column => column.adapter.isVisible?.({
    address: { rowId, fieldId: column.fieldId },
    row,
    store,
  }) !== false);
});

const handleRuntimeCommit = ({ address, value }: { address: CellAddress; value: unknown }) => {
  const store = props.subForm.runtimeStore;
  const column = runtimeColumns.value.find(item => item.fieldId === address.fieldId);
  const row = store?.getRow(address.rowId);
  if (!column || !store || !row) return;
  const parsedValue = column.adapter.parse(value, {
    address,
    row,
    store,
  });
  props.subForm.batchPatchRuntimeRows([{ rowId: address.rowId, values: {
    [address.fieldId]: parsedValue,
  } }]).then(() => {
    runtimeVersion.value += 1;
  });
};

const handleRuntimeAction = (address: CellAddress, anchor?: HTMLElement | null, readonly?: boolean) => {
  emit('cell-action', { address, anchor, readonly });
};

watch(() => props.subForm.runtimeStore, (store) => {
  stopRuntimeStoreSubscription?.();
  stopRuntimeStoreSubscription = store?.subscribe(() => {
    runtimeVersion.value += 1;
  });
}, { immediate: true });

const drawerInfo = computed(() => {
  if (isMobile()) {
    return {
      size: '100%',
    }
  }
  return {
    size: '40%',
  }
})

const handleCopyRow = async (rowIndex: number) => {
  await emit("copyRow", rowIndex);
  isAddRow.value = true;
}

const handleCreateRow = async () => {
  await emit("createRow");
  isAddRow.value = true;
}

watch(rowCount, () => {
  if (!visible.value && isAddRow.value) return;

  isAddRow.value = false;
  indexOfShowRow.value = Math.max(0, rowCount.value - 1);
});

defineExpose({
  show: (index: number = 0) => {
    indexOfShowRow.value = index;
    visible.value = true;
    isAddRow.value = false;
  },
  hidden: () => {
    visible.value = false;
    isAddRow.value = false;
    indexOfShowRow.value = 0;
  },
});

onBeforeUnmount(() => {
  stopRuntimeStoreSubscription?.();
  stopRuntimeStoreSubscription = undefined;
});
</script>

<style lang='scss'>
.subForm-row-edit-drawer {
  background-color: var(--bg-color-page);

  .el-drawer__body {
    padding: 0;

    .el-container {
      height: 100%;

      .el-header {
        --el-header-height: 40px;

        display: flex;
        justify-content: space-between;
        font-size: 14px;
        padding: 0 20px;
        border-bottom: 1px solid var(--border-color);

        .el-button:not(.is-disabled):hover {
          color: var(--color-primary) !important;
        }

        .subform-title {
          line-height: 40px;
        }

        .wrap-drawer-controller {
          display: flex;
          gap: 8px;
          align-items: center;

          .pagination {
            display: flex;
            gap: 4px;
            align-items: center;
          }
        }
      }

      .el-main {
        flex: 1;
        padding: 10px;

        .runtime-row-editor {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
          overflow: auto;
          padding: 10px;

          &__field {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-height: 36px;
            flex: none;
          }

          &__label {
            color: var(--text-color-primary);
            font-size: 14px;
            font-weight: 700;
            line-height: 20px;
          }

          &__cell {
            position: relative;
            min-height: 36px;
          }
        }
      }

      .el-footer {
        height: 50px;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
        border-top: 1px solid var(--border-color);

        .el-button {
          height: 32px;
          border-radius: 4px;
        }
      }
    }
  }


}
</style>
