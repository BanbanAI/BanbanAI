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
                <span class="pagination-index">{{ `${indexOfShowRow + 1}/${subForm.tableData.length}` }}</span>
                <el-button class="btn-next" link :disabled="indexOfShowRow === subForm.tableData.length - 1"
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
            <form-real-time-editor v-if="subForm?.tableData?.[indexOfShowRow]"
              :form="subForm?.tableData?.[indexOfShowRow]"></form-real-time-editor>
          </el-main>

          <el-footer>
            <el-button class="btn-add" @click="handleCreateRow">{{ $t('create') }}</el-button>
            <el-button class="btn-copy" @click="handleCopyRow(indexOfShowRow)">{{ $t('copy') }}</el-button>
            <el-button class="btn-confirm" type="primary" @click="visible = false">{{ $t('complete') }}</el-button>
          </el-footer>
        </el-container>
      </el-drawer>
    </teleport>
  </div>
</template>

<script lang='ts' setup>
import { ref, watch, computed } from 'vue';
import { SubForm } from './subForm';
import IEpArrowLeft from "~icons/ep/arrow-left";
import IEpArrowRight from "~icons/ep/arrow-right";
import IAntDesignShrinkOutlined from "~icons/ant-design/shrink-outlined";
import FormRealTimeEditor from './FormRealTimeEditor.vue';
import { isMobile } from '@renderer/utils/pure';
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  subForm: SubForm;
}>();
const emit = defineEmits<{
  (event: "copyRow", rowIndex: number): Promise<void>
  (event: "createRow"): Promise<void>
}>();

const indexOfShowRow = ref(0);
const visible = ref(false);
const isAddRow = ref(false);

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

watch(() => props.subForm.tableData.length, () => {
  if (!visible && isAddRow.value) return;

  isAddRow.value = false;
  indexOfShowRow.value = props.subForm.tableData.length - 1;
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
