import {
  buildNocodeEditorAiTaskStorageKey,
  type NocodeEditorAiTaskStoreValue,
} from '@common/utils/nocodeEditorAiTaskSession'

export const storeFactory = <T extends any = any>(key: string, isLocalStorage = true) => {
  const storage = isLocalStorage ? localStorage : sessionStorage
  return {
    get(): T {
      return JSON.parse(storage.getItem(key));
    },
    set<T>(value: T) {
      return storage.setItem(key, JSON.stringify(value));
    },
    remove() {
      return storage.removeItem(key);
    }
  }
}

export const tokenStore = storeFactory('ACCESS_TOKEN');

export const autoSaveStore = storeFactory('AUTO_SAVE');

export const deleteRemindStore = storeFactory("DELETE_REMIND");

export const localFolderPathStore = storeFactory("LOCAL_FOLDER_PATH");

export const marketSearchHistoryStore = storeFactory("HISTORY_KEYWORD_LIST");

export const serverToken = storeFactory('SERVER_TOKEN');

export const themeStore = storeFactory("_THEME");

export const formDataManagerTipStore = storeFactory("DATA_MANAGER_TIP");

export const dataManagerWarnReminderStore = storeFactory("DATA_MANAGER_WARNREMINDER");

export interface FormDesignerPanelState {
  fieldCatalogVisible: boolean;
  propertyPanelVisible: boolean;
  formCatalogPinned: boolean;
  formPropertyPinned: boolean;
  boardDataLayerPanel?: 'data' | 'layer' | null;
  boardPropertyVisible?: boolean;
  boardDataLayerPinned?: boolean;
  boardPropertyPinned?: boolean;
}

export const formDesignerPanelStateStore = storeFactory<FormDesignerPanelState>("FORM_DESIGNER_PANEL_STATE");

export const chatVisitorInfoStore = storeFactory("CHAT_VISITOR_INFO");

export const bootLanguageStore = storeFactory<string>('BOOT_LANGUAGE');

// session

export const temporaryAccessStore = storeFactory("TEMPORARY_ACCESS_STORE", false);

export const visitTokenStore = storeFactory("VISIT_TOKEN_STORE", false);

export const publicQueryVisitTokenStore = storeFactory("PUBLIC_QUERY_VISIT_TOKEN_STORE", false);

export const createNocodeEditorAiTaskStore = (value: {
  accountId?: unknown
  nocodeId?: unknown
}) => {
  const key = buildNocodeEditorAiTaskStorageKey(value)
  return key
    ? storeFactory<NocodeEditorAiTaskStoreValue>(key, false)
    : null
}
