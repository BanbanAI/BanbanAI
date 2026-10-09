import type { NocodeMeta, TODO } from "@common/types/nocode";
import type { DeployNavDialogArgs } from "@renderer/b2/types";
import type { RechargeChannelDialogArgs, SelectFormTableDialogArgs, Theme } from "@renderer/types/base";
import { defineStore } from "pinia";
import { reactive } from "vue";

export const useDialogStore = defineStore("dialog", () => {
  type StateKey = keyof typeof state;
  type BaseStateArgs = {
    [key in StateKey]: any;
  };
  interface StateArgs extends BaseStateArgs {
    projectRenewalImportDialogVisible: string,
    deployNavDialogVisible: DeployNavDialogArgs,
    rechargeChannelVisible: RechargeChannelDialogArgs,
    marketChargeDialogVisible: Theme,
    importDialogVisible: string,
    nocodeReplaceImgDialogVisible: NocodeMeta,
    todoDialogVisible: TODO,
    selectFormTableDialogVisible: SelectFormTableDialogArgs,
  }

  const stateArgs = reactive<Partial<StateArgs>>({

  });
  const state = reactive({
    loginDialogVisible: false,
    recallPasswordDialogVisible: false,
    editPasswordDialogVisible: false,
    occupyDialogVisible: false,
    offlineNoticeDialogVisible: false,
    rechargeChannelVisible: false,
    marketChargeDialogVisible: false,

    projectRenameDialogVisible: false,
    projectLimitDialogVisible: false,
    projectMoveDialogVisible: false,
    creationDialogVisible:false,
    deployNavDialogVisible: false,
    saveAsDialogVisible: false,
    recycleDialogVisible: false,
    importDialogVisible: false,
    groupDialogVisible: false,
    viewerProjectReleaseDialogVisible: false,
    projectRenewalImportDialogVisible: false,
    exitConfirmationDialogVisible: false,
    tourListVisible: false,
    proxySettingDialogVisible: false,
    editProjectParamsDialogVisible: false,
    nocodeReplaceImgDialogVisible: false,
    visitorManagementDialogVisible: false,
    NocodeCreationDialogVisible: false,
    NocodeCreationInfoDialogVisible: false,
    nocodeCreateDataDialogVisible: false,
    connectDialogVisible: false,

    todoDialogVisible: false,
    formDesignerEmptyDialogVisible: false,
    selectFormTableDialogVisible: false,

    // 表单数据管理
    catalogSettingDialogVisible: false  // 表单目录视图设置
  })

  return {
    ...state,
    show<T extends StateKey = StateKey>(key: T, args?: typeof stateArgs[T]){
      this[key] = true;
      if (args) {
        stateArgs[key] = args;
      }
    },
    hide(key: StateKey){
      this[key] = false;
      if (stateArgs[key]) {
        delete stateArgs[key];
      }
    },
    getArgs<T extends StateKey = StateKey>(key: T) {
      return stateArgs[key];
    }
  }
})
