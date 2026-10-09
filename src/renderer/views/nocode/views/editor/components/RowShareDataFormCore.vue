<template>
  <div class="data-form-core">
    <div class="left">
      <div class="form-container">
        <div class="header" v-if="isViewing">
          <form-display-fields
            v-if="displayFieldsVisible"
            @update:hiddenColumnIds="emit('updateHiddenColumns', $event)"
          ></form-display-fields>
          <div class="icon-wrap" v-if="shareActionVisible" @click="emit('share')">
            <el-icon size="16">
              <i-ven-share />
            </el-icon>
          </div>
          <div class="division" v-if="divisionVisible"></div>
          <el-popover
            v-if="printActionVisible"
            placement="bottom"
            :teleported="false"
            append-to=".data-form-container"
          >
            <template #reference>
              <div class="icon-wrap">
                <el-icon size="16">
                  <i-ep-printer />
                </el-icon><span>{{ $t('RowShareDataFormCore.print') }}</span>
              </div>
            </template>
            <ul class="print-menu">
              <li @click="emit('print')">{{ $t('RowShareDataFormCore.systemPrint') }}</li>
              <li v-for="item in printTemplates" @click="emit('print', item)">{{ item.name }}</li>
            </ul>
          </el-popover>
          <div class="icon-wrap" @click="emit('copy')" v-if="copyActionVisible">
            <el-icon size="16">
              <i-ep-copy-document />
            </el-icon><span>{{ $t('RowShareDataFormCore.copy') }}</span>
          </div>
          <div class="icon-wrap" @click="emit('delete')" v-if="deleteActionVisible">
            <el-icon size="16">
              <i-ep-delete />
            </el-icon><span>{{ $t('RowShareDataFormCore.delete') }}</span>
          </div>
          <div class="icon-wrap" :class="{ 'active': !isViewing }" @click="emit('edit')"
            v-if="editActionVisible">
            <el-icon size="16">
              <i-ep-edit />
            </el-icon><span>{{ $t('RowShareDataFormCore.edit') }}</span>
          </div>
          <div
            class="icon-wrap process-toggle"
            @click="emit('openProcessInfo')"
            v-if="showProcessFlowToggle && processInfoFolded"
          >
            <el-icon size="16">
              <i-workbench-horizontal-fold />
            </el-icon>
          </div>
        </div>
        <el-scrollbar>
          <div :class="['form-wrap', { viewing: isViewing }]">
            <related-sub-form-stack :row="row" :isViewing="isViewing" :showRelatedTabs="showRelatedTabs">
              <slot name="form"></slot>
            </related-sub-form-stack>
          </div>
        </el-scrollbar>
        <div class="footer" v-if="!isViewing">
          <div class="footer-left">
            <el-button type="primary" @click="emit('submit', isSubmitContinuous, isSaveCurrentContent)"
              :loading="loading">{{
                $t('RowShareDataFormCore.submit')
              }}</el-button>
            <el-button @click="emit('submitDraft')" v-if="formMode !== FormMode.Edit" :loading="loading">{{
              $t('RowShareDataFormCore.saveDraft') }}</el-button>
            <el-button v-if="formMode === FormMode.Edit" @click="emit('cancel')">{{ $t('RowShareDataFormCore.cancel')
            }}</el-button>
          </div>
          <div class="footer-right" v-if="formMode !== FormMode.Edit">
            <el-checkbox v-model="isSubmitContinuous">{{ $t('RowShareDataFormCore.continuousSubmit') }}</el-checkbox>
            <el-checkbox v-show="isSubmitContinuous" v-model="isSaveCurrentContent">{{
              $t('RowShareDataFormCore.saveCurrentContent')
            }}</el-checkbox>
          </div>
        </div>
      </div>
    </div>
    <slot name="right">

    </slot>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { getUUIDSystemField } from '@common/utils';
import { PrintTemplate } from '@common/types/nocode';
import { Row } from '@common/types/project';
import { useTable, useTableProps } from '@renderer/views/nocode/components/global/table/hooks';
import { FormMode } from '@renderer/views/nocode/components/global/table/types';

const props = defineProps<{
  row: Row,
  isViewing: boolean,
  printTemplates: PrintTemplate[],
  loading: boolean,
  formMode: FormMode,
  showProcessFlowToggle: boolean,
  processInfoFolded: boolean,
  showDisplayFields?: boolean,
  showShare?: boolean,
  showPrint?: boolean,
  showCopy?: boolean,
  showDelete?: boolean,
  showEdit?: boolean,
  showRelatedTabs?: boolean,
}>()

const emit = defineEmits<{
  (event: "updateHiddenColumns", value: string[]),
  (event: "print", template?: PrintTemplate),
  (event: "share"),
  (event: "copy"),
  (event: "delete"),
  (event: "edit"),
  (event: "openProcessInfo"),
  (event: "submit", isSubmitContinuous: boolean, isSaveCurrentContent: boolean),
  (event: "submitDraft"),
  (event: "cancel"),
}>();

const table = useTable();
const tableProps = useTableProps()

const isSubmitContinuous = ref(false)
const isSaveCurrentContent = ref(false)
const displayFieldsVisible = computed(() => props.showDisplayFields !== false);
const printActionVisible = computed(() => props.showPrint !== false);
const copyActionVisible = computed(() => props.showCopy ?? tableProps.isAddDataAble);
const deleteActionVisible = computed(() => props.showDelete ?? tableProps.isDeleteDataAble);
const editActionVisible = computed(() => props.showEdit ?? tableProps.isEditDataAble);
const rowShareVisible = computed(() => {
  const currentTable = table?.table;
  const uuidField = getUUIDSystemField(currentTable?.fields || []);
  return !!(
    props.isViewing
    && currentTable?.publish?.rowShareEnabled
    && uuidField
    && props.row?.[uuidField.uid]
  );
})
const shareActionVisible = computed(() => {
  if (props.showShare === false) return false;
  if (props.showShare === true) return true;
  return rowShareVisible.value;
});
const divisionVisible = computed(() => {
  if (!(displayFieldsVisible.value || shareActionVisible.value)) {
    return false;
  }
  return printActionVisible.value || copyActionVisible.value || deleteActionVisible.value || editActionVisible.value;
});
</script>

<style lang="scss" scoped>
.data-form-core {
  height: 100%;
  display: flex;

  .left {
    min-width: 0px;
    flex: 1;
    height: 100%;

    .form-container {
      height: 100%;
      display: flex;
      width: 100%;
      flex-direction: column;

      .header {
        display: flex;
        align-items: center;
        height: 40px;
        padding-left: 16px;
        border-bottom: 1px solid var(--border-color);

        .icon-wrap {
          padding: 8px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          cursor: var(--cursor-pointer);

          &.active,
          &:hover {

            span,
            i {
              color: var(--color-primary);
            }
          }

          span {
            margin-left: 4px;
            font-size: 14px;
            line-height: 20px;
          }

          &.process-toggle {
            margin-left: auto;
            justify-content: center;
          }
        }

        :deep(.el-popover) {
          padding: 8px 0px;
          background-color: var(--color-white);

          .print-menu {
            display: flex;
            flex-direction: column;
            gap: 4px;

            li {
              cursor: var(--cursor-pointer);
              padding: 4px 8px;
              transition: all 0.3s ease;

              &:hover {
                color: var(--color-primary);
                background-color: var(--bg-color-overlay);
              }
            }
          }
        }

        .division {
          border-left: 1px solid var(--border-color-light);
          margin: 0 5px;
          height: 20px;
        }
      }

      .form-status {
        background-color: var(--bg-color-page);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        height: 72px;
        padding: 8px 24px;
        margin: 16px 16px 0 16px;
        border-radius: 4px;

        .status-item {
          width: 33%;
          height: 16px;
          display: flex;
          align-items: center;
          border-radius: 4px;
          margin: 8px 0;

          span {
            display: inline-block;
            font-size: 12px;
          }

          .item-label {
            width: 76px;
          }

          .item-value {
            flex: 1;
          }
        }
      }

      .form-wrap {
        flex: 1;
        min-height: 0px;
        padding: 0 16px 16px;
        background-color: var(--el-bg-color-page);
        height: 100%;
        min-height: 0px;
        width: 100%;
      }

      .form-wrap.viewing {
        :deep(.process-info-card) {
          margin-bottom: 16px;
        }
      }

      .footer {
        background-color: var(--bg-color-page);
        padding: 10px 24px;
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;

        .el-button {
          margin-right: 8px;
          border-radius: 4px;
        }

        .footer-left {
          .el-button {
            width: 96px;
            height: 32px;
          }
        }

        .footer-right {
          >label {
            margin: 0;

            &::before {
              content: "";
              width: 1px;
              height: 14px;
              background-color: var(--border-color);
              margin: 0 16px;
              display: inline-block;
            }

            &:first-child::before {
              display: none;
            }
          }
        }
      }
    }
  }

  :deep(.right) {
    width: 300px;
    height: 100%;
    border-left: 1px solid var(--border-color);

    :deep(.el-tabs) {
      .el-tabs__nav {
        margin-left: 24px;
      }

      .el-tabs__nav-wrap::after {
        height: 1px;
      }
    }
  }
}
</style>
