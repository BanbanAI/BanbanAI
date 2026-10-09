<template>
  <div class="clone-widget-wrapper">
    <!-- 复制组件弹窗 -->
    <el-dialog :append-to-body="true" :z-index="100000" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :title="args==='copy' ? $t('widgetManagerDialog.copyDialogTitle') : $t('widgetManagerDialog.moveDialogTitle')" width="21%" :top="'25vh'" center
      class="clone-board-widget-dialog" ref="dialogRef">
      <el-form label-width="85px" label-position="left" size="default">
        <el-form-item :label="args==='copy' ? $t('widgetManagerDialog.labelCopy') : $t('widgetManagerDialog.labelMove')">
          <el-input :model-value="labelCopy" disabled />
        </el-form-item>
        <el-form-item :label="$t('widgetManagerDialog.labelAs')">
          <el-input :modelValue="labelAs" @update:modelValue="(val)=>labelAs = val" :disabled="selectedWidgets.length > 1" />
        </el-form-item>
        <el-form-item :label="args==='copy' ? $t('widgetManagerDialog.labelKanban') : $t('widgetManagerDialog.targetBoard')">
          <el-select v-model="cloneToBoard" :disabled="!isSameBoard" :placeholder="args==='copy' ? $t('widgetManagerDialog.copyToKanbanPlaceholder') : $t('widgetManagerDialog.moveToKanbanPlaceholder')"
          :teleported="false" :no-data-text="$t('widgetManagerDialog.notData')" popper-class="custom-popper-large">
            <el-option v-for="board in selectChoices" :key="board.uid" :label="board.name" :value="board.uid" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <span class="tipInfo" v-if="args==='copy'">{{ $t('widgetManagerDialog.copyTip')}}</span>
          <span class="tipInfo" v-else :class="!isSameBoard ? 'sameBoard' : 'invisible'">{{ $t('widgetManagerDialog.warningTip')}}</span>
          <el-button type="primary" :disabled="!isSameBoard" @click=" args==='copy'? cloneWidgetFn() : moveWidgetFn()">{{ $t("widgetManagerDialog.confirmLabel") }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ACTIVE_BOARD_ID, ALL_BOARD, CLONE_WIDGET, PROJECT, SELECTED_WIDGETS, HANDLE_PASTED_WIDGETS, PROJECT_ID, ACTIVE_BOARD, ACTIVE_WIDGET } from "@renderer/types";
import { inject, ref, watch, computed, toRaw } from "vue";
import { deepClone } from "@common/utils/object";
import i18next from "i18next";
import { handleCopyName } from "@common/utils";
import { useProjectDialogStore } from "@renderer/stores";
import { handleElementOptionsSoul } from "@renderer/utils/cloneWidget";
import { SoulUIDMapping } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";


const props = defineProps<{
  modelValue: boolean
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean)
}>();

const project = inject(PROJECT);
const allBoard = inject(ALL_BOARD);
const selectedWidgets = inject(SELECTED_WIDGETS);
const activeWidget = inject(ACTIVE_WIDGET);
const activeBoardId = inject(ACTIVE_BOARD_ID);


const dialogRef = ref();


const cloneToBoard = ref(null);
const activeWidgetBoard = computed(() => activeWidget?.value?.getBoard());

// 递归调用
//参数：父组件，当前组件，组件名字，是否是手动选中的组件
const cloneWidget = inject(CLONE_WIDGET)
const handlePastedWidget = inject(HANDLE_PASTED_WIDGETS);
const projectId = inject(PROJECT_ID);
const projectDialogState = useProjectDialogStore();
const dialogStorage = projectDialogState.getStorage(projectId);
const args = computed(() => dialogStorage.getArgs('widgetManagerDialogVisible'));




//复制组件确定按钮触发
const cloneWidgetFn = async () => {
  const activeWidgetBoardId = activeWidgetBoard.value.uid
  const selectWidgetsValue = toRaw(selectedWidgets.value);
  const widgetSouls = selectWidgetsValue.map(widget => {
    const widgetSoul = deepClone(widget.getSoul());
    if(selectWidgetsValue.length === 1){
      widgetSoul.name = labelAs.value;
    }
    return widgetSoul
  });
  selectedWidgets.value = [];
  const { pastedWidgetSouls, pastedWidgetsUIDMap } = await handlePastedWidget(widgetSouls, projectId, cloneToBoard.value, activeWidgetBoardId);
  for(const pastedWidgetSoul of pastedWidgetSouls){
    const {widgetSoul, oldUID} = pastedWidgetSoul;
    const currentWidget = selectWidgetsValue.find(widget => widget.uid === oldUID);
    if (cloneToBoard.value === activeWidgetBoardId) {
      selectedWidgets.value.push(await cloneWidget(widgetSoul, oldUID, currentWidget.parent, false));
    } else {
      let targetContainer: Board;
      if (allBoard.boards[cloneToBoard.value]) {
        targetContainer = allBoard.boards[cloneToBoard.value];
      } else if(allBoard.foreBoard?.uid === cloneToBoard.value){
        targetContainer = allBoard.foreBoard;
      } else if (allBoard.backBoard?.uid === cloneToBoard.value) {
        targetContainer = allBoard.backBoard;
      }
      selectedWidgets.value.push(await cloneWidget(widgetSoul, oldUID, targetContainer, false));
    }
  }
  activeBoardId.value = cloneToBoard.value;
  dialogRef.value.visible = false;
  return pastedWidgetsUIDMap;
};

const handleAllWidgetSoul = (soulUIDs: SoulUIDMapping) => {
  if (allBoard.foreBoard) {
    handleElementOptionsSoul(allBoard.foreBoard.getSoul(), soulUIDs);
  }
  if (allBoard.backBoard) {
    handleElementOptionsSoul(allBoard.backBoard.getSoul(), soulUIDs);
  }
  for (const boardId in allBoard.boards) {
    const board = allBoard.boards[boardId];
    handleElementOptionsSoul(board.getSoul(), soulUIDs);
  }
}

//移动组件确定按钮触发
const moveWidgetFn = async () => {
  const selectWidgets = toRaw(selectedWidgets.value);
  const soulUIDs = await cloneWidgetFn();
  handleAllWidgetSoul(soulUIDs);
  selectWidgets.forEach((widget) => {
    widget.remove();
  });
}

const labelCopy = ref('');
const labelAs = ref('');
const isSameBoard = ref(true);
let selectChoices = ref([]);
watch(() => props.modelValue, (val) => {
  if (val) {  
    const firstWidgetBoardUid = selectedWidgets.value[0]?.getBoard()?.uid;
    isSameBoard.value = selectedWidgets.value.every(widget => widget.getBoard()?.uid === firstWidgetBoardUid);

    selectChoices.value = [];
    cloneToBoard.value = null;
    const activeWidgetBoardId = activeWidgetBoard.value.uid
    if(allBoard.foreBoard && (args.value === 'copy' || allBoard.foreBoard.uid !== activeWidgetBoardId )){
      selectChoices.value.push(allBoard.foreBoard);
    }
    for (const uid in allBoard.boards) {
      const board = allBoard.boards[uid];
      if (activeWidgetBoardId == uid && args.value === 'move') continue
      selectChoices.value.push(board);
    }
    if(allBoard.backBoard && (args.value === 'copy' || allBoard.backBoard && allBoard.backBoard.uid !== activeWidgetBoardId)){
      selectChoices.value.push(allBoard.backBoard);
    }
    if(args.value === 'copy') {
      cloneToBoard.value = activeBoardId.value;
    }
    const widgets = selectedWidgets.value;
    let name = '';
    if (widgets.length > 1) {
      name = i18next.t("widgetManagerDialog.widgetCountDescribe", {widgetName: widgets[0].name, widgetCount: widgets.length});
      labelAs.value = name;
    } else {
      name = widgets[0]?.name;
      if(args.value === 'copy') {
        labelAs.value = handleCopyName(name);
      } else {
        labelAs.value = name;
      }
    }
    labelCopy.value = name;
  }
});
</script>

<style lang="scss">
.clone-board-widget-dialog {
  border-radius: 4px;
  background-color: var(--bg-color-page);
  padding: 0;

  .el-dialog__header {
    color: var(--text-color-primary);
    font-size: 16px;
    height: 40px;
    text-align: center;
    border-bottom: 1px solid var(--border-color);
    --el-dialog-title-font-size: 14px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    .el-dialog__headerbtn {
      width: 40px;
      height: 40px;
    }

    .el-dialog__headerbtn {
      top: 0;
      width: 46px;
      height: 40px;
    }
  }

  .is-disabled,
  .el-input--default {
    .el-input__wrapper {}
  }

  .el-dialog__body {
    padding: 24px 20px;

    .el-form-item {
      &:last-child {
        margin-bottom: 0;
      }

      // .el-form-item__label {
      //   justify-content: flex-start;
      // }
      .el-select {
        width: 100%;

        &:has(.is-disabled) {
          cursor: not-allowed;
        }

        .el-select__wrapper {
          width: 100%;
          height: 32px;
          background-color: var(--bg-color-overlay);
          border-radius: 4px;
          box-shadow: 0 0 0 0px var(--border-color) inset;
          font-size: 12px;

          &:hover {
            box-shadow: 0 0 0 1px var(--border-color) inset;
          }

          &.is-focused {
            box-shadow: 0 0 0 1px var(--color-primary) inset !important;
          }
        }
      }

      .el-input {
        .el-input__wrapper {
          border-radius: 4px;
          background-color: var(--bg-color-overlay);
          box-shadow: unset;

          &:hover {
            box-shadow: 0 0 0 1px var(--border-color) inset;
          }

          &.is-focus {
            box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
          }

          .el-input__inner {
            font-size: 12px;
            height: 32px;
            color: var(--text-color-regular);

            &::placeholder {
              font-size: 12px;
            }
          }
        }
      }
    }
  }

  .el-dialog__footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border-color);

    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .el-button {
        width: 52px;
        border-radius: 4px;
      }

      .tipInfo {
        font-size: 12px;
        color: #7A7A7A;

        &.invisible {
          visibility: hidden
        }

        &.sameBoard {
          color: #d71526;
        }
      }
    }
  }

}
</style>