<template>
  <b2-form-element>
    <sub-form-editor v-if="widget.isEditable" :sub-form="widget"></sub-form-editor>
    <mobile-sub-form-viewer v-else-if="isMobile()" :sub-form="widget" @importExcel="handleImport"></mobile-sub-form-viewer>
    <sub-form-viewer v-else :sub-form="widget" @importExcel="handleImport" @quickFill="handleQuickFill"></sub-form-viewer>

    <import-excel-dialog
      v-model:dialogVisible="excelDialogVisible"
      :subForm="widget"
      contentSource="tableHeaderValue"
      @closeDialog="handleCloseDialog"
    />
    <teleport to="body">
      <quick-fill-dialog
        v-model="quickFillDialogVisible"
        :subForm="widget"
      />
    </teleport>
    <teleport to="body">
      <el-dialog
        :title="$t('switchPromptTitle')"
        v-model="warningDialogVisible"
        width="360px"
        class="sub-form-data-origin-warning-dialog"
        :show-close="false"
        align-center="true"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
      >
        <div>
          <el-icon>
            <WarnTriangleFilled/>
          </el-icon>
        </div>
        <div>
          {{ $t('switchMultipleFillModeWarning') }}
        </div>
        <template #footer>
          <el-button @click="handleCancel">{{ $t('cancel') }}</el-button>
          <el-button type="primary" @click="handleSwitchMode">{{ $t('confirm') }}</el-button>
        </template>
      </el-dialog>
    </teleport>

  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { SubForm } from "./subForm";
import SubFormEditor from "./SubFormEditor.vue";
import SubFormViewer from "./SubFormViewer.vue";
import MobileSubFormViewer from "./MobileSubFormViewer.vue";
import ImportExcelDialog from "./ImportExcelDialog.vue";
import QuickFillDialog from "./QuickFillDialog.vue";
import { ref, watch } from "vue";
import { WarnTriangleFilled } from '@element-plus/icons-vue'
import i18next, { $t } from "@renderer/widgets/i18next";

const widget = useWidget<SubForm>();

// 从Excel导入数据
const excelDialogVisible = ref<boolean>(false);
const quickFillDialogVisible = ref<boolean>(false);

const warningDialogVisible = ref<boolean>(false);

function handleImport() {
  excelDialogVisible.value = true;
}
function handleCloseDialog() {
  excelDialogVisible.value = false;
}

function handleQuickFill() {
  quickFillDialogVisible.value = true;
}

watch(() => widget.dataOrigin, (newVal, oldVal) => {
  if (newVal === 'multiple' && newVal !== oldVal) {
    warningDialogVisible.value = true;
  }
  if (newVal === 'single' && oldVal === 'multiple') {
    clearSubFormDataFillRule();
  }
})

const clearSubFormDataFillRule = () => {
  widget.setOption('data-fill-rules', {});
};

const deleteSubFormRule = () => {
  const rules = widget.topForm.getOption('fields-filling') as any[];

  const result = (rules || []).filter(rule => {
    const hasSubFormCondition = (rule.conditions || []).some(c => c.value?.split('.')?.[0] === widget.uid);
    const hasSubFormFillWidget = (rule.fillWidgets || []).some(f => f.fillWidget === widget.uid);
    return !hasSubFormCondition && !hasSubFormFillWidget;
  });

  widget.topForm.setOption('fields-filling', result);
};

const handleCancel = () => {
  widget.dataOrigin = 'single';
  warningDialogVisible.value = false
}

const handleSwitchMode = () => {
  warningDialogVisible.value = false
  deleteSubFormRule()
}
</script>

<style lang="scss">
.sub-form-data-origin-warning-dialog {
  border-radius: 4px;
  background-color: #fff;
  padding: 0px;

  .el-dialog__header {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px 0px;
    border-bottom: 1px solid var(--border-color);

    .el-dialog__title {
      font-weight: 400;
      font-size: 14px;
      text-align: center;
    }
  }

  .el-dialog__body {
    padding: 16px 16px 24px;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;

    .el-icon {
      font-size: 32px;
      color: #FAAD14;
    }
  }

  .el-dialog__footer {
    padding: 0px 16px 16px;

    .el-button {
      width: 60px;
      height: 32px;
      border-radius: 4px;
    }
  }
}
</style>
