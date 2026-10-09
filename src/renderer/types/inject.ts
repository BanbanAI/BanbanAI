import { ComputedRef, InjectionKey, Ref, ShallowRef, WritableComputedRef } from "vue";
import { Element } from "@renderer/b2/controllers/element";
import { AllBoard, OptionMenuRole, MousePosition, WidgetMenuContext, EditorRightStackTab, OptionRoleMenuInstance, LogsObj, SoulUIDMapping } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { ProjectBody } from "@common/types/project";
import { ParsedRef, FieldOptionContext, ContextMenuContext, ClientTheme } from "./index";
import { DataCondition, CoEditingAccount, ProjectParams, WidgetSoul, WidgetTemplateList, WidgetTemplateLibraryList, Table, FolderMeta } from "@common/types/project";
import { Board } from "@renderer/b2/controllers/board";
import { FormViewConfig, Nocode, NocodeFormData, NocodeMeta, NocodeStructure } from "@common/types/nocode";
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import ViewDrawer from "@renderer/views/nocode/views/viewer/dialog/components/ViewDrawer.vue";
import { Emitter } from "mitt";
import { EventBusEvents } from '../views/nocode/views/viewer/main/formDataViewerEmitter'
import { BaseWidget } from "@renderer/b2/controllers/widget";

//用于推导 InjectionKey 指向的类型
export type GetInjectionType<T> = T extends InjectionKey<(infer U)> ? U : never;
export type PublicQueryDisplayMap = {
  accounts: Record<string, {
    id: string,
    realname?: string,
    user?: string,
    phone?: string,
    departmentName?: string,
  }>,
  departments: Record<string, {
    id: string,
    name?: string,
    parentNames?: string[],
  }>,
  nodes: Record<string, {
    id: string,
    name?: string,
  }>,
};

export const OPEN_PROJECT: InjectionKey<(projectId: string, autoFullScreen?:boolean, shareInEditor?: boolean) => void> = Symbol();
export const CLOSE_PROJECT: InjectionKey<(projectId: string, shareInEditor?: boolean) => void> = Symbol();
export const CLOSE_NOCODE: InjectionKey<(nocodeId?: string) => void> = Symbol();
export const HANDLE_PROJECT_RENAMED: InjectionKey<(projectId: string, newName: string) => void> = Symbol();
export const HANDLE_NOCODE_RENAMED: InjectionKey<(id: string, name: string) => void> = Symbol();
export const PROJECT_TABLE_DRAGGING: InjectionKey<Ref<boolean>> = Symbol();
export const DROP_SUCCESS: InjectionKey<Ref<boolean>> = Symbol();
export const SELECTED_WIDGETS: InjectionKey<Ref<BaseWidget[]>> = Symbol();
export const ACTIVE_BOARD: InjectionKey<ComputedRef<Board>> = Symbol();
export const ACTIVE_WIDGET: InjectionKey<ComputedRef<BaseWidget>> = Symbol();
export const ACTIVE_CONTAINER: InjectionKey<ComputedRef<Widget | Board>> = Symbol();
export const HANDLE_PASTED_WIDGETS: InjectionKey<(widgetSouls: WidgetSoul[], projectId: string, activeBoardId: string, originalBoardId?: string, originalProjectId?: string) => Promise<{ pastedWidgetSouls: { widgetSoul: WidgetSoul; oldUID: string; }[], pastedWidgetsUIDMap: SoulUIDMapping }>> = Symbol();
export const CLONE_WIDGET: InjectionKey<(widget: WidgetSoul, oldUid: string, parent?: Widget | Board, isSameProject?: boolean) => Promise<Widget>> = Symbol();
export const HANDLE_WIDGET_TO_TOP: InjectionKey<() => void> = Symbol();
export const HANDLE_WIDGET_TO_BOTTOM: InjectionKey<() => void> = Symbol();
export const HANDLE_WIDGET_MOVE_UP: InjectionKey<() => void> = Symbol();
export const HANDLE_WIDGET_MOVE_DOWN: InjectionKey<() => void> = Symbol();
export const COPY_STYLES: InjectionKey<() => Promise<void>> = Symbol();
export const NOT_USING_INPUT: InjectionKey<ComputedRef<boolean>> = Symbol();
export const HAS_NO_DIALOG_VISIBLE: InjectionKey<ComputedRef<boolean>> = Symbol();
export const ACTIVE_SETTING_NAME: InjectionKey<Ref<string>> = Symbol();
export const UPDATE_OPENING_PROJECT_LIST: InjectionKey<(type: 'open' | 'close', projectId: string) => void> = Symbol();
export const DO_COPY: InjectionKey<(test: string) => Promise<void>> = Symbol();
export const HANDLE_INTO_FIELD_RECYCLE_BIN_KEY: InjectionKey<(widget: WidgetSoul, table: Table) => void> = Symbol();
export const OPEN_FORM_DESIGNER_PROPERTY_PANEL: InjectionKey<() => void> = Symbol();
export const FORM_DESIGNER_BLUEPRINT_APPLYING_READONLY: InjectionKey<Ref<boolean>> = Symbol();
export const FORM_DESIGNER_OPTION_CHANGED: InjectionKey<() => void> = Symbol();
export const FORM_DESIGNER_ACTIVE_ISSUE_HIGHLIGHT: InjectionKey<Ref<null | {
  widgetId: string
  optionPath?: string[]
  groupKey?: string
  token: number
}>> = Symbol();

export const ACTIVE_ELEMENT: InjectionKey<ComputedRef<Element>> = Symbol();
export const ACTIVE_ELEMENT_LOCKED: InjectionKey<Ref<boolean>> = Symbol();
export const HOVER_WIDGET: InjectionKey<ShallowRef<Widget>> = Symbol();
export const CLEAN_TEMPORARY_WIDGET: InjectionKey<Ref<{ form: boolean; subForm: boolean }>> = Symbol();
export const IS_DRAGGING_WIDGET: InjectionKey<Ref<boolean>> = Symbol();
export const WIDGET_CATALOG_REF: InjectionKey<Ref<HTMLElement & { expandWidgetParent: (widget: Widget) => void }>> = Symbol();
export const IS_MOBILE_FULLSCREEN: InjectionKey<Ref<boolean>> = Symbol();
export const NOCODE_LIST: InjectionKey<ParsedRef<NocodeMeta[]>> = Symbol();
export const PROJECT_ID:InjectionKey<string> = Symbol();
export const REPORT_ID:InjectionKey<string> = Symbol();
export const NOCODE_ID:InjectionKey<string> = Symbol();
export const GET_LIST: InjectionKey<(parentId?: string) => Promise<void>> = Symbol();
export const GET_DELETE_LIST: InjectionKey<() => Promise<void>> = Symbol();
export const HANDLE_PROJECT_SNAPSHOTTED: InjectionKey<(projectId: string) => void> = Symbol();
export const FORE_BACK_ZOOM_X_Y: InjectionKey<Ref<{ zoom: number, x: number, y: number }>> = Symbol();
export const PROJECT_CHANGED: InjectionKey<Ref<boolean>> = Symbol();
export const SWITCH_CATALOG_TAB: InjectionKey<(tabName: string) => void> = Symbol();
export const SHOW_SAMPLE_CODE: InjectionKey<(_path: string[], _value: any, _reference: HTMLElement) => void> = Symbol();
export const OPTION_ROLE_MENU_INSTANCE: InjectionKey<Ref<OptionRoleMenuInstance>> = Symbol();
export const WIDGET_TEMPLATE_LIBRARY_LIST: InjectionKey<Ref<WidgetTemplateLibraryList>> = Symbol();
export const GET_WIDGET_TEMPLATE_LIST: InjectionKey<() => Promise<void>> = Symbol();
export const ORGANIZE_UTIL: InjectionKey<OrganizeUtil> = Symbol();
export const PUBLIC_QUERY_DISPLAY_MAP: InjectionKey<ComputedRef<PublicQueryDisplayMap>> = Symbol();
export const NOCODE_THEME: InjectionKey<Ref<ClientTheme>> = Symbol();
export const NOCODE_THEME_COLOR: InjectionKey<Ref<string>> = Symbol();
export const IS_PICKING_ELEMENT: InjectionKey<Ref<boolean>> = Symbol();
export const PICKED_ELEMENT: InjectionKey<Ref<Element>> = Symbol();
export const VIEW_SETTING_DRAWER_SLOT: InjectionKey<Ref<HTMLElement>>  = Symbol();
export const VIEW_SETTING_DRAWER_REF: InjectionKey<Ref<typeof ViewDrawer>> = Symbol()
export const VIEW_SETTING_DRAWER_CLOSE_GUARD: InjectionKey<Ref<null | (() => Promise<boolean>)>> = Symbol()
export const VIEW_SETTING_DRAWER_PANEL_STATE: InjectionKey<Ref<{ visible: boolean; activeMenu: string | null; actionDetailVisible: boolean }>> = Symbol()

export const PROJECT: InjectionKey<ParsedRef<ProjectBody>> = Symbol();
export const IS_PROJECT_READY: InjectionKey<Ref<boolean>> = Symbol();
export const SAVE_PROJECT: InjectionKey<(ignoreSnap?: boolean, autoSave?: boolean, noMessage?: boolean) => Promise<void>> = Symbol();
export const HAS_WIDGET_MOUNTED: InjectionKey<Ref<boolean>> = Symbol();
export const ALL_BOARD: InjectionKey<AllBoard> = Symbol();
export const ALL_BOARD_DOM: InjectionKey<Ref<{ [key: string]: HTMLElement }>> = Symbol();
export const MODIFY_DATA_CONDITIONS: InjectionKey<(dataConditions: DataCondition[])=>void> = Symbol();
export const PROJECT_PARAMS: InjectionKey<ComputedRef<ProjectParams>> = Symbol();
export const VISIBLE: InjectionKey<ComputedRef<boolean>> = Symbol();
export const IS_EDITABLE: InjectionKey<ComputedRef<boolean>> = Symbol();
export const CLOSE_POPUP: InjectionKey<() => void> = Symbol();
export const CLOSE_MOCKBOARD: InjectionKey<(teleportId: string, remove: boolean) => void> = Symbol();
export const CANCEL_MERGE_WIDGETS: InjectionKey<() => void> = Symbol();
export const ACTIVE_BOARD_ID: InjectionKey<ParsedRef<string>> = Symbol();
export const CO_EDITING_ACCOUNTS: InjectionKey<Ref<CoEditingAccount[]>> = Symbol();
export const CUR_CO_EDITING_ACCOUNT: InjectionKey<Ref<CoEditingAccount>> = Symbol();
export const EDIT_PROJECT_MODULE: InjectionKey<()=> Promise<boolean>> = Symbol();
export const EDIT_BOARD_MODULE: InjectionKey<(boardId?: string)=> Promise<boolean>> = Symbol();
export const INPUT_ENTER_BLUR: InjectionKey<(event: KeyboardEvent) => void> = Symbol();
export const PARENT_ID: InjectionKey<Ref<string>> = Symbol();
export const LAYERS_CLICK_TIME: InjectionKey<Ref<number>> = Symbol();
export const PRESENTER_INFO: InjectionKey<Ref<string>> = Symbol();
export const WIDGET_MENU_CONTEXT: InjectionKey<WidgetMenuContext> = Symbol();
export const IS_WEB_SHARE: InjectionKey<boolean> = Symbol();
export const LOCAL_MODEL_CHANGE_TIME: InjectionKey<Ref<number>> = Symbol();
export const SHOW_DATA_CONDITION_DIALOG: InjectionKey<() => Promise<void>> = Symbol();
export const HANDLE_SYNC_FORM_TABLE: InjectionKey<(
  formData: NocodeFormData,
  table: Table,
  isSave?: boolean,
  options?: { preserveAiDraftState?: boolean; beforeWrite?: () => void }
) => Promise<NocodeFormData | undefined>> = Symbol();
export const HANDLE_DELETE_TABLE: InjectionKey<(table: Table, options?: { beforeWrite?: () => void }) => Promise<void>> = Symbol();
export const CLOSE_NOCODE_LAYER: InjectionKey<(projectId: string) => void> = Symbol();
export const PREVIEW_NOCODE_LAYER: InjectionKey<() => void> = Symbol();
export const SYNC_FORM_DATA: InjectionKey<(connection: NocodeFormData) => Promise<void>> = Symbol();
export const NOCODE_SIGN_IS_LATEST: InjectionKey<Ref<boolean>> = Symbol();
export const UPDATE_NOCODE_SIGN: InjectionKey<(sign: string) => void> = Symbol();

// ProjectSheet.vue provide
export const ACTIVE_FIELD_OPTION: InjectionKey<Ref<FieldOptionContext>> = Symbol();
export const DRAG_WIDGET:InjectionKey<ParsedRef<BaseWidget>> = Symbol();
export const MOUSE_POSITION: InjectionKey<ParsedRef<MousePosition>> = Symbol();

export const FIELD_OPTION_CONTEXTS: InjectionKey<Ref<Record<string, FieldOptionContext>>> = Symbol();
export const DELETED_TABLES_UID: InjectionKey<ComputedRef<string[]>> = Symbol('deletedTablesUid');
export const EDITOR_RIGHT_SWITCH_TAB: InjectionKey<(paths: [EditorRightStackTab]) => void> = Symbol();

export const MOVE_WIDGETS_FUN: InjectionKey<(widgets: BaseWidget[], panelUID: string|BaseWidget, options?: any) => void> = Symbol();
export const MERGE_WIDGETS_FUN: InjectionKey<(widgets: BaseWidget[], panelUID?: string|BaseWidget, options?: any) => void> = Symbol();

export const NOCODE: InjectionKey<Ref<Nocode>> = Symbol();
export const FORM_DATA_VIEWER_EMITTER: InjectionKey<Emitter<EventBusEvents>> = Symbol()
export const VIEW_ACTIVE_UID: InjectionKey<Ref<string>> = Symbol()
export const FORM_VIEW_CONFIG: InjectionKey<ComputedRef<FormViewConfig | undefined>> = Symbol()
export const ALL_FIELD_OPTION_CONTEXTS: InjectionKey<Ref<Record<string, Record<string, FieldOptionContext>>>> = Symbol();

export const LOGS_INFO_OBJ: InjectionKey<LogsObj> = Symbol();
