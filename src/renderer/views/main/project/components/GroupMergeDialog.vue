<template>
  <div>
    <!-- 合并到分组弹窗 -->
    <el-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" class="merge-group-panel" width="21%"
      :top="'25vh'" center @closed="handleClosed" :title="isMerging ? $t('groupMergeDialog.mergeIntoPanel'): $t('groupMergeDialog.moveToPanel')">
      <el-form label-width="80px" label-position="left">
        <el-form-item :label="isMerging ? $t('groupMergeDialog.merge'):$t('groupMergeDialog.move')">
          <el-input v-model="mergeWidgetName" disabled />
        </el-form-item>
        <el-form-item :label="$t('groupMergeDialog.to')" class="merge-panel-select">
          <el-select v-model="panelUID" :placeholder="$t('groupMergeDialog.selectPanelPlaceholder')" filterable :teleported="false">
            <el-option v-for="panel in allPanel" :key="panel" :label="panel.name" :value="panel.uid" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="handleClick">{{ $t("groupMergeDialog.confirmLabel") }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { Widget } from '@renderer/b2/controllers/widget';
import { ACTIVE_BOARD, SELECTED_WIDGETS, MERGE_WIDGETS_FUN, MOVE_WIDGETS_FUN, PROJECT_ID } from '@renderer/types/inject.js';
import { ElMessage } from 'element-plus';
import { inject, ref, unref, watch, watchEffect, computed } from 'vue';
import { useProjectDialogStore } from "@renderer/stores";
import i18next from "i18next";
import { BaseWidget } from '@renderer/b2/controllers/widget';

const props = defineProps<{
  modelValue: boolean
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean)
}>();

const mergeWidgetsFun =  inject(MERGE_WIDGETS_FUN);
const moveWidgetsFun =  inject(MOVE_WIDGETS_FUN);
const selectedWidgets = inject(SELECTED_WIDGETS);
const activeBoard = inject(ACTIVE_BOARD);
const projectId = inject(PROJECT_ID);

const operate = ref('merge');
const isMerging = computed(()=>{
  return operate.value === 'merge';
})

const projectDialogState = useProjectDialogStore();
const dialogStorage = projectDialogState.getStorage(projectId);
watchEffect(() => {
  if (dialogStorage.groupMergeDialogVisible) {
    const args = dialogStorage.getArgs('groupMergeDialogVisible');
    if(!args) {
      operate.value = 'merge';
    }else{
      operate.value = args;
    }
  }
});

/* 合并到分组开始 */
const mergeWidgetName = ref(""); //合并的组件
const panelUID = ref<string>();  //要合并到的分组面板
watch(() => props.modelValue, (val) => {
  if (val) {
    const widgets = selectedWidgets.value;
    if (widgets.length > 1) {
      mergeWidgetName.value = i18next.t("groupMergeDialog.widgetCountDescribe", {widgetName: widgets[0].name, widgetCount: widgets.length});
    } else {
      mergeWidgetName.value = widgets[0]?.name;
    }
    findAllPanel(unref(activeBoard.value.container.widgets));
    //排除所选组件自己就是分组面板
    const selectedPanel = selectedWidgets.value.filter(widget => {
      return widget.type == "widget.group.panel"
    })
    allPanel.value = allPanel.value.concat(selectedPanel).filter((widget, index, arr) => {
      return arr.indexOf(widget) === arr.lastIndexOf(widget);
    })
    panelUID.value = allPanel.value[0].uid;
  } else {
    allPanel.value = [];
    mergeWidgetName.value = "";
    panelUID.value = null;
  }
})
const allPanel = ref([]); //所有的分组面板
const findAllPanel = (widgets: BaseWidget[]) => {
  widgets.forEach(item => {
    if (item.type === "widget.group.panel") {
      allPanel.value.push(item);
      findAllPanel(item.container.widgets);
    }
  })
}

//合并到分组确定按钮点击后执行
const handleClick = ()=>{
  if(isMerging.value){
    if (!panelUID.value) return ElMessage.warning(i18next.t("groupMergeDialog.panelNameEmptyTip"));
    mergeWidgetsFun(selectedWidgets.value, panelUID.value);
  }else{
    if (!panelUID.value) return ElMessage.warning(i18next.t("groupMergeDialog.panelSelectTip"));
    moveWidgetsFun(selectedWidgets.value, panelUID.value);
  }
  dialogStorage.hide('groupMergeDialogVisible');
}

const handleClosed = () => {
  panelUID.value = null;
  allPanel.value = [];
}

/* 合并到分组结束 */
</script>

<style lang="scss" scoped>
:deep() .el-dialog {
  .el-dialog__header {
    border-bottom: 1px solid var(--border-color);
    margin: 0px;
    padding: 0px;

    .el-dialog__title {
      display: inline-block;
      color: #c1c1c1;
      height: 40px;
      line-height: 40px;
      font-size: 12px;
    }

    .el-dialog__headerbtn {
      top: 0;
      width: 46px;
      height: 40px;
    }
  }

  .el-dialog__body {
    padding-bottom: 0;
  }

  .el-dialog__footer {
    text-align: right;
    padding-right: 25px;
    .el-button {
      width: 80px;
    }
  }

  .is-disabled {
    .el-input__wrapper {
      background-color: #292a2e;
    }
  }

  .merge-panel-select {
    .el-select {
      width: 100%;
    }

    .el-select__popper {
      background-color: #292a2e;

      .el-select-dropdown {
        background-color: #292a2e;
      }

      .el-select-dropdown__list {
        margin-top: 0px !important;
        margin-bottom: 0px !important;
      }

      .el-select-dropdown__item {
        background-color: #292a2e;
        font-weight: 400;
        color: #fff;

        &:hover {
          background-color: #1e90ff;
          color: #fff !important;
        }
        &.selected {
          color: #0089ff;
        }
      }

      .el-popper__arrow::before {
        background-color: #292a2e !important;
      }
    }
  }
}
</style>