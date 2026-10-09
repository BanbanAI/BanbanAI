import { defineStore } from "pinia";
import { computed, ComputedRef, reactive, ref } from "vue";
import { useDialogStore } from "./dialog";
import { widgetManagerDialogArgs } from "@renderer/b2/types";
import { RechargeChannelDialogArgs } from "@renderer/types/base";

// 项目中用的弹窗
let dialogState: ReturnType<typeof useDialogStore>;


const createStorage = () => {
  type StateKey = keyof typeof state;
  type BaseStateArgs = {
    [key in StateKey]: any;
  };
  interface StateArgs extends BaseStateArgs {
    widgetManagerDialogVisible: widgetManagerDialogArgs,
    rechargeChannelVisible: RechargeChannelDialogArgs,
    importDialogVisible: string,
  }
  const stateArgs = reactive<Partial<StateArgs>>({

  });
  const state = {
    dataConditionDialogVisible: false,
    projectRenameDialogVisible: false,
    confirmDeleteDialogVisible: false,
    projectSettingDialogVisible: false,
    projectWarningDialogVisible: false,
    groupMergeDialogVisible: false,
    widgetManagerDialogVisible: false,
    optionRoleMenuVisible: false,   // option选项菜单
    sampleCodeVisible: false,       // 示例代码弹出框
    sampleDataVisible: false,       // 示例数据弹出框
    widgetContextMenuVisible: false,  // 组件右键菜单
    projectMoveDialogVisible: false, // 项目移动弹出框
    deployNavDialogVisible: false, // 项目部署弹窗
    nocodeProjectReleaseDialogVisible: false, // nocode项目发布弹窗
    saveAsDialogVisible: false, // 另存为弹窗
    loadingDialogVisible: false, // loading弹窗
    importDialogVisible: false, // 导入窗口
    rechargeChannelVisible: false,  // 充值界面

    loginDialogVisible: computed({
      get() {
        return dialogState?.loginDialogVisible;
      },
      set(value) {
        if (value) {
          dialogState.show('loginDialogVisible', stateArgs.loginDialogVisible);
        } else {
          dialogState.hide('loginDialogVisible');
        }
      }
    }),
    projectResourceCheckDialogVisible: false,
  }
  return reactive({
    ...state,
    show<T extends StateKey = StateKey>(key: T, args?: typeof stateArgs[T]) {
      if (args) {
        stateArgs[key] = args;
      }
      this[key] = true;
    },
    hide(key: StateKey) {
      this[key] = false;
    },
    hasVisible() {
      for (const key in this) {
        if(typeof this[key] === 'function') continue;
        if (this[key]  && key !== 'loadingDialogVisible') {
          return true;
        }
      }
      return false;
    },
    getArgs<T extends StateKey = StateKey>(key: T) {
      return stateArgs[key];
    }
  })
}

export type StorageType = ReturnType<typeof createStorage>;

export const useProjectDialogStore = defineStore("projectDialog", () => {
  
  type GetStorageType = ComputedRef<() => typeof getStorage>

  dialogState = useDialogStore();

  const storages = ref<Record<string, StorageType>>({

  })

  const getStorage = (projectId: string) => {
    return storages.value[projectId]
  }

  const initStorage = (projectId: string) => {
    const storage = createStorage();
    storages.value[projectId] = storage;
    return storage;
  }

  const removeStorage = (projectId: string) => {
    delete storages.value[projectId];
  }

  return {
    storages,
    getStorage: computed(() => getStorage) as unknown as GetStorageType,
    initStorage,
    removeStorage,
  }
});
