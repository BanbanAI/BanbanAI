<template>
  <div class="data-form-core">
    <div class="left">
      <div class="form-container">
        <div class="header" v-if="isViewing">
          <form-display-fields
            v-if="showDisplayFields"
            :preHiddenColumnIds="preHiddenColumnIds"
            @update:hiddenColumnIds="emit('updateHiddenColumns', $event)"
          ></form-display-fields>
          <div class="icon-wrap" v-if="shareActionVisible" @click="emit('share')">
            <el-icon size="16">
              <i-ven-share />
            </el-icon>
          </div>
          <div class="division" v-if="showDivision"></div>
          <el-popover v-if="showPrint" placement="bottom" :teleported="false" append-to=".data-form-container">
            <template #reference>
              <div class="icon-wrap">
                <el-icon size="16">
                  <i-ep-printer />
                </el-icon><span>{{ $t('DataFormCore.print') }}</span>
              </div>
            </template>
            <ul class="print-menu">
              <li @click="emit('print')">{{ $t('DataFormCore.systemPrint') }}</li>
              <li v-for="item in printTemplates" @click="emit('print', item)">{{ item.name }}</li>
            </ul>
          </el-popover>
          <div class="icon-wrap" @click="emit('copy')" v-if="showCopy && tableProps.isAddDataAble">
            <el-icon size="16">
              <i-ep-copy-document />
            </el-icon><span>{{ $t('DataFormCore.copy') }}</span>
          </div>
          <div class="icon-wrap" @click="emit('delete')" v-if="showDelete && resolvedIsDeleteDataAble">
            <el-icon size="16">
              <i-ep-delete />
            </el-icon><span>{{ $t('DataFormCore.delete') }}</span>
          </div>
          <div class="icon-wrap" :class="{ 'active': !isViewing }" @click="emit('edit')"
            v-if="showEdit && resolvedIsEditDataAble">
            <el-icon size="16">
              <i-ep-edit />
            </el-icon><span>{{ $t('DataFormCore.edit') }}</span>
          </div>
          <slot name="header-actions"></slot>
          <div class="toolbar-right" v-if="slots['toolbar-right'] || (showProcessFlowToggle && processInfoFolded)">
            <slot name="toolbar-right"></slot>
            <div
              class="icon-wrap process-toggle"
              @click="emit('openProcessInfo')"
              v-if="showProcessFlowToggle && processInfoFolded"
            >
              <el-icon size="16">
                <i-ven-icon-double-left-arrow />
              </el-icon>
            </div>
          </div>
        </div>
        <div :class="['form-wrap', { viewing: isViewing }]">
          <related-sub-form-stack :row="row" :isViewing="isViewing" v-loading="!formReady" element-loading-custom-class="detail-loading-mask" :element-loading-text="$t('NocodeForm.loading')">
            <slot name="form"></slot>
          </related-sub-form-stack>
        </div>
        <div class="footer" v-if="!isViewing">
          <div class="footer-left">
            <el-tooltip :content="$t('DataFormCore.formLoadingTip')" :disabled="formReady" placement="top">
              <span class="form-action-tooltip-trigger">
                <el-button type="primary" @click="emit('submit', isSubmitContinuous, isSaveCurrentContent)"
                  :loading="loading" :disabled="!formReady">{{
                    $t('DataFormCore.submit')
                  }}</el-button>
              </span>
            </el-tooltip>
            <el-tooltip v-if="formMode !== FormMode.Edit" :content="$t('DataFormCore.formLoadingTip')"
              :disabled="formReady" placement="top">
              <span class="form-action-tooltip-trigger">
                <el-button @click="emit('submitDraft')" :loading="loading" :disabled="!formReady">{{
                  $t('DataFormCore.saveDraft') }}</el-button>
              </span>
            </el-tooltip>
            <el-button v-if="formMode === FormMode.Edit" @click="emit('cancel')">{{ $t('DataFormCore.cancel')
            }}</el-button>
            <el-tooltip v-if="showStashButton" :content="$t('DataFormCore.formLoadingTip')" :disabled="formReady"
              placement="top">
              <span class="form-action-tooltip-trigger">
                <el-button @click="emit('stash')" :loading="loading" :disabled="!formReady">{{
                  $t('DataFormCore.stash') }}</el-button>
              </span>
            </el-tooltip>
          </div>
          <div class="footer-right" v-if="formMode !== FormMode.Edit">
            <el-checkbox v-model="isSubmitContinuous">{{ $t('DataFormCore.continuousSubmit') }}</el-checkbox>
            <el-checkbox v-show="isSubmitContinuous" v-model="isSaveCurrentContent">{{
              $t('DataFormCore.saveCurrentContent')
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
import { computed, ref, useSlots } from 'vue';
import { useTable, useTableProps } from '../hooks';
import { PrintTemplate } from '@common/types/nocode';
import { Row } from '@common/types/project';
import { FormMode } from '../types';
import { getUUIDSystemField } from '@common/utils';


const props = withDefaults(defineProps<{
  row: Row,
  isViewing: boolean,
  preHiddenColumnIds?: string[],
  printTemplates: PrintTemplate[],
  loading: boolean,
  formReady: boolean,
  formMode: FormMode,
  showProcessFlowToggle: boolean,
  processInfoFolded: boolean,
  showStashButton?: boolean,
  isEditDataAble?: boolean,
  isDeleteDataAble?: boolean,
  showDisplayFields?: boolean,
  showShare?: boolean,
  showPrint?: boolean,
  showCopy?: boolean,
  showDelete?: boolean,
  showEdit?: boolean,
}>(), {
  showPrint: true,
})

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
  (event: "stash"),
  (event: "cancel"),
}>();

const table = useTable();
const tableProps = useTableProps()
const slots = useSlots();

const isSubmitContinuous = ref(false)
const isSaveCurrentContent = ref(false)
const showDisplayFields = computed(() => props.showDisplayFields !== false);
const showPrint = computed(() => props.showPrint !== false);
const showCopy = computed(() => props.showCopy !== false);
const showDelete = computed(() => props.showDelete !== false);
const showEdit = computed(() => props.showEdit !== false);
const rowShareVisible = computed(() => {
  const currentTable = table?.table;
  const uuidField = getUUIDSystemField(currentTable?.fields || []);
  return !!(
    props.isViewing
    && currentTable?.publish?.rowShareEnabled
    && uuidField
    && props.row?.[uuidField.uid]
  );
});
const shareActionVisible = computed(() => {
  if (props.showShare === false) return false;
  if (props.showShare === true) return true;
  return rowShareVisible.value;
});
const resolvedIsEditDataAble = computed(() => props.isEditDataAble ?? tableProps.isEditDataAble);
const resolvedIsDeleteDataAble = computed(() => props.isDeleteDataAble ?? tableProps.isDeleteDataAble);
const showDivision = computed(() => {
  if (!(showDisplayFields.value || shareActionVisible.value)) {
    return false;
  }
  return showPrint.value
    || (showCopy.value && tableProps.isAddDataAble)
    || (showDelete.value && resolvedIsDeleteDataAble.value)
    || (showEdit.value && resolvedIsEditDataAble.value);
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
        padding: 0 16px;
        border-bottom: 1px solid var(--border-color);

        .toolbar-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

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
        overflow-y: auto;
        overflow-x: hidden;
        width: 100%;

      }

      .form-wrap.viewing {
        // padding-top: 16px;
        
        &::-webkit-scrollbar {
          width: 4px;
        }

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
          .form-action-tooltip-trigger {
            display: inline-flex;
          }

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
