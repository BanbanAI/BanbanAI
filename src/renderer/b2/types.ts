import { inject, Ref, UnwrapRef, StyleValue, Component, DeepReadonly, UnwrapNestedRefs } from "vue";
import type { 
  OptionValue, Soul, Options,
  ConnectionData, DataCondition, GroupStatus, ProjectParams, Bucket, FieldUID, Connection,
  QueryOptions,
  ConnectionFrom,
  OptionFieldUID,
  OptionTableUID,
  Row,
  WhereCondition,
} from "@common/types/project";
import { Widget, BaseWidget } from "./controllers/widget";
import { Element } from "./controllers/element";
import { Board } from "./controllers/board";
import type { ColorValue } from "./color";
import { isObject } from "@vue/shared";
import { ACTIVE_WIDGET } from "@renderer/types/inject";
import { Account, Department } from "@common/types/account";
import { FilterRule, FormCondition, FormTableRuntime, NocodeBody, RuleFunc } from "@common/types/nocode";
import { FormMode } from "@renderer/types/base";
export type ParsedRef<T = any> = Ref<UnwrapRef<T>>;
export type Readonly<T = any> = DeepReadonly<UnwrapNestedRefs<T>>;

export enum SummaryType {
  MAX = "max",
  SUM = "sum",
  MIN = "min",
  MEAN = "mean",
  COUNT = "count",
  YEAR = "year",
  YEAR_QUARTER = "year-quarter",
  YEAR_MONTH = "year-month",
  YEAR_WEEK = "year-week",
  YEAR_MONTH_DAY = "year-month-day",
  NONE = "none",
}
export enum SummaryYearFormat {
  YYYY_Y = "YYYY_Y",
  YYYY = "YYYY",
  YY_Y = "YY_Y",
  YY = "YY",
}
export enum SummaryYearQuarterFormat {
  YYYY_Q = "YYYY_Q",
  "YYYY/Q" = "YYYY/Q",
  "YY/Q" = "YY/Q",
}

export enum SummaryYearMonthFormat {
  YYYY_Y_MM_M = "YYYY_Y_MM_M",
  "YYYY/MM_M" = "YYYY/MM_M",
  "YYYY/MM" = "YYYY/MM",
  "YY/MM" = "YY/MM",
}

export enum SummaryYearWeekFormat {
  YYYY_Y_WW_W = "YYYY_Y_WW_W",
  "YYYY/WW_W" = "YYYY/WW_W",
  "YY/WW_W" = "YY/WW_W",
}

export enum SummaryYearMonthDayFormat {
  YYYY_Y_MM_M_DD_D = "YYYY_Y_MM_M_DD_D",
  "YYYY/MM/DD" = "YYYY/MM/DD",
  "YY/MM/DD" = "YY/MM/DD",
  MM_M_DD_D = "MM_M_DD_D",
  "MM/DD" = "MM/DD",
}

export type SummaryDataFormat = SummaryYearFormat | SummaryYearQuarterFormat | SummaryYearMonthFormat | SummaryYearWeekFormat | SummaryYearMonthDayFormat;
export type FieldMultiValueMode = "split" | "join";

export type SelectChoice = {
  value: string | number,
  label: string,
  type?: 'replace',
  disabled?: boolean,
  unUse?: boolean,
  tip?: string,
  legacyValue?: string | number,
  children?: SelectChoice[],
}

export type Selects = SelectChoice[][];

export type SelectTreeChoice = SelectChoice & {
  children?: SelectTreeChoice[],
}
export type SelectTree = SelectTreeChoice[];


export type ParamLog = {
  type: "param",
  params: ProjectParams,
}

export type UpdateDataResult = {
  success: boolean,
  message?: string,
  data?: any,
}

export type ProjectContext = {
  typography: "board" | "page",
  inNocodeForm?: boolean,
  projectId: string,
  nocodeId?: string,
  projectName: string,
  pagePermissionContext?: {
    nocodeBody?: NocodeBody,
    getPermissionBody?: (tableId?: string) => Pick<NocodeBody, "permissions"> | NocodeBody | undefined,
    departments?: Department[],
    account?: Account,
    skipDataPermission?: boolean,
  },
  runtime?: FormTableRuntime,
  formMode?: FormMode,
  connectionData: Readonly<ConnectionData>,
  mergedConnectionData: Readonly<ConnectionData>,
  widthRatio?: number,
  getElementByUID: (uid: string[]) => Element;
  getBoards: () => Board[];
  getConnections: () => Connection[];
  getDataConditions?: () => DataCondition[];
  getNocodeBodyData?: () => Pick<NocodeBody, "formData" | "otherDataSources">;
  openRelatedDetail?: (payload: {
    relatedTableUID: OptionTableUID;
    uuid: string;
    row?: Row | null;
    fieldUID?: string;
    sourceContext?: {
      nocodeId: string;
      tableUID?: OptionTableUID;
      formData?: NocodeBody['formData'];
      otherDataSources?: NocodeBody['otherDataSources'];
    };
  }) => void;
  appendFormFieldChoice?: (payload: {
    tableUID: string;
    rootTableUID?: string;
    fieldId: string;
    widgetUID: string;
    choice: {
      id?: string;
      label: string;
      value: string;
      color?: string;
    };
    sign?: string;
    targetSign?: string;
  }) => Promise<any>;
  queueFormFieldChoiceAppend?: (payload: {
    tableUID: string;
    rootTableUID?: string;
    fieldId: string;
    widgetUID: string;
    choice: {
      id?: string;
      label: string;
      value: string;
      color?: string;
    };
  }) => void;
  setActiveBoardById: (boardUID:string) => void;
  refreshConnectionData: () => Promise<void> | void;
  ensureConnectionBucket: (optionTableUID: OptionTableUID) => Promise<Bucket | undefined>;
  readDataByOptions: (optionTableUID: OptionTableUID, options: QueryOptions) => Promise<Bucket | undefined>;
  updateToConnection: (tableUID: OptionTableUID, rows: object[], keys?:OptionFieldUID[]) => Promise<UpdateDataResult>;
  addToConnection: (tableUID: OptionTableUID, rows: object[]) => Promise<UpdateDataResult>;
  removeFromConnection: (tableUID: OptionTableUID, rows: object[], keys?: OptionFieldUID[]) => Promise<UpdateDataResult>;
  /**
   * 数据编辑相关方法 -- end
   */

  clone: (widget: Element, name: string, options: Options) => Promise<Widget>;
  addProjectLog?: (log: ParamLog) => void;
  selectWidgets?: (widgets: Widget[]) => void;
  saveFormData?: () => void;
}

export function isBoard(element: Element): element is Board {
  return element.primitiveType === "board";
}
export function isWidget(element: Element): element is Widget {
  return element.primitiveType === "widget";
}

export type AllBoard = {
  foreBoard?: Board,
  backBoard?: Board,
  boards?: {[key: string]: Board}
}

export type OptionMenuRole = {
  role: string,
  label?: string,
  icon?: Component | string,
  visible?: boolean | (() => boolean),
  disabled?: boolean,
  callback?: (element?: Element, paths?: string[], value?: OptionValue) => void,
}
export type MousePosition = {
  left: number,
  top: number 
}
export enum DynamicValueGetterType {
  value = "value",
  formula = "formula",
  fromCurrentValue = "fromCurrentValue",
}
export type DynamicValueGetterValue = {
  value: string,
  type: (DynamicValueGetterType)[],    // 下拉选项值
}
export type DynamicValueGetter = DynamicValueGetterValue[]; 
export interface DefinedOption<T = Element> {
  name: string,
  type?: "number" | "boolean" | "select" | string,
  alias?: string,
  tip?: string,
  default?: OptionValue | ((element: T, paths?: string[]) => OptionValue),
  summary?: SummaryType[],
  selectChoices?: SelectChoice[] | Selects | SelectTree | ((element: T) => (SelectChoice[] | Selects | SelectTree)),
  unknownOptionText?: string,
  keys?: string[] | SelectChoice[] | ((element: T) => string[] | SelectChoice[]),
  visible?: boolean | ((element: T, paths?: string[]) => boolean),
  actionVisible?: boolean | ((element: T, paths?: string[]) => boolean),
  disabled?: boolean | ((element: T) => boolean),
  disabledHelperText?: string | ((element: T, paths?: string[]) => string),
  clearable?: boolean | ((element: T) => boolean),
  menu?: OptionMenuRole[],
  valueGetterType?: "static" | "dynamic",
  valueGetter?: DynamicValueGetter,
  imageSource?: (element: T, paths?: string[]) => OptionRenderFileValue,
  placeholder?: string,
  mask?: string | ((element: T, paths?: string[]) => string),
  dialog?: {
    component: Component | string,
    buttonText?: string | ((element: T, paths?: string[]) => string),
    buttonStyle?: StyleValue | ((element: T, paths?: string[]) => StyleValue),
    componentProps?: Record<string, any> | ((element: T, paths?: string[]) => Record<string, any>),
  },
  drawer?: {
    component: Component | string,
    buttonText?: string | ((element: T, paths?: string[]) => string),
    buttonStyle?: StyleValue | ((element: T, paths?: string[]) => StyleValue),
    title?: string | ((element: T, paths?: string[]) => string),
    componentProps?: Record<string, any> | ((element: T, paths?: string[]) => Record<string, any>),
  }
  maskClick?: (element: T) => void,
  buttonClick?: (element?: T, paths?: string[]) => void,
  click?: (element: T, ...args: any[]) => void,
  buttonText?: string | ((element: T, paths?: string[]) => string),
  buttonStyle?: StyleValue | ((element: T, paths?: string[]) => StyleValue),
  valueType?: string | ((element: T, paths?: string[]) => string),
  beforeChange?: (element: T, value: any, paths?: string[]) => boolean | Promise<boolean>,
}

export type ColoredArrayOptionValue = {
  checkValue?: string | string[];
  isColored?: boolean;
  options: Array<{
    id: string;
    value: string;
    label?: string;
    color?: string | ColorValue;
  }>;
  otherOptions?: {
    id: string;
    value: string;
  };
}

export type MenuItem = {
  label: string;
  id: string;
  value: string;
  color?: string;
};

export type MenuItemOptions = Omit<ColoredArrayOptionValue, 'options'> & { options: MenuItem[] };

export type FormChildrenArrayOptionValue = {
  options: Array<{
    uid: string;
    type: string;
    name: string;
    copyFrom?: string;
  }>;
}


export type TabsArrayOptionValue = {
  checkValue?: string | string[];
  isColored?: boolean;
  options: Array<{
    id: string;
    value: string;
    color?: string | ColorValue;
  }>;
  otherOptions?: {
    id: string;
    value: string;
  };
}
export type NinePatch = {
  top: number,
  right: number,
  bottom: number,
  left: number,
}

export type OptionGenerics = { [name: string]: string };
export type OptionArgs = { [name: string]: string };
export type DefinedOptionWithParsedType<T = Element> = DefinedOption<T> & {
  parsedType: string,
  generics: OptionGenerics,
  args: OptionArgs,
};
export const isCallableVisible = <T = Element>(visible: DefinedOption<T>["visible"]): visible is ((element: T, paths?: string[]) => boolean) => {
  return typeof visible === "function";
};
export const isCallableDisabled = <T = Element>(disabled: DefinedOption<T>["disabled"]): disabled is ((element: T) => boolean) => {
  return typeof disabled === "function";
};
export const useActiveWidget = () => {
  return inject(ACTIVE_WIDGET)
}
export type ClusterPaths = (string | {
  key: string,
  index?: number,
})[]
export type ClusterEntry = {
  name: string;
  alias: string;
}
export type DefinedOptionCluster = {
  name: string,
  alias: string,
  tip?: string,
  /** cluster类型，map无序，array有序 */
  cluster: "map" | "array",
  /** cluster是否可排序，只针对array */
  sortable: boolean,
  /** cluster默认显示方式：选项卡 | 列表 */
  show?: "tab" | "list",
  /** 是否可编辑，不可编辑不会显示新增和删除按钮 */
  editable?: boolean,
  /** 是否可添加，仅在可编辑时生效 */
  addable?: boolean,
  /** 是否可复制，仅在可编辑时生效 */
  copyable?: boolean,
  /** 是否可删除，仅在可编辑时生效 */
  deleteable?: boolean,
  /** 定义array cluster的固定项 */
  items?: (element: Element) => string[],
  itemsHint?: string,
  /** 自定义array cluster每一项的标题（alias） */
  customAlias?: (element: Element, paths: string[]) => string[],
  /** 定义map cluster的entry */
  entries?: ClusterEntry[] | ((element: Element) => ClusterEntry[]),
  fold?: "fold" | "unfold" | "always-unfold",
  visible?: boolean | ((element: Element, paths?: string[]) => boolean),
  /** array cluster至少要保留几项，影响是否可以删除 */
  least?: number,
  children: (DefinedOption | DefinedOptionSubgroup | DefinedOptionCluster)[],
}
export const isCallableEntries = (entries: DefinedOptionCluster["entries"]): entries is (element: Element) => ClusterEntry[] => {
  return typeof entries === "function";
};
export type DefinedOptionGroup = {
  alias?: string,
  type?: "boolean",
  tip?: string,
  default?: boolean,
  locked?:  boolean | "locked" | "unLocked" | "always-locked",
  fold?: "fold" | "unfold" | "always-unfold",
  before?: string,
  after?: string,
  visible?: boolean | ((element: Element, paths?: string[]) => boolean),
  children?: (DefinedOption | DefinedOptionSubgroup | DefinedOptionCluster)[],
  hideTitle?: boolean,
}
export type DefinedOptionSubgroup = {
  name: string,
  alias?: string,
  tip?: string,
  /** 显示为选项卡还是列表 */
  show?: "tab" | "list",
  fold?: "fold" | "unfold" | "always-unfold",
  visible?: boolean | ((element: Element, paths?: string[]) => boolean),
  children?: (DefinedOption | DefinedOptionSubgroup | DefinedOptionCluster)[],
};
export const isOptionCluster = (item: DefinedOption | DefinedOptionSubgroup | DefinedOptionCluster): item is DefinedOptionCluster => {
  return (item as DefinedOptionCluster).cluster ? true : false;
};
export const isOptionSubgroup = (item: DefinedOption | DefinedOptionSubgroup | DefinedOptionCluster): item is DefinedOptionSubgroup => {
  return !isOptionCluster(item) && !!(item as DefinedOptionSubgroup).children;
};
export const isOption = (item: DefinedOption | DefinedOptionSubgroup | DefinedOptionCluster): item is DefinedOption => {
  return !isOptionCluster(item) && !isOptionSubgroup(item);
};
export const isBlueprintCluster = (item: BlueprintValue | BlueprintCluster): item is BlueprintCluster => {
  return (item as BlueprintCluster)?.cluster ? true : false;
};
export type DefinedOptionGroups = {
  [key: string]: DefinedOptionGroup,
}
export type DefinedOptions = {
  data?: DefinedOptionGroups,
  style?: DefinedOptionGroups,
  code?: DefinedOptionGroups,
}
export type ParsedOptionGroups = (DefinedOptionGroup & {
  group: string,
})[]
export type ParsedOption = {
  data?: ParsedOptionGroups,
  style?: ParsedOptionGroups,
  code?:ParsedOptionGroups,
}
export type BlueprintValue = {
  alias: string,
  type: string,
  default: OptionValue | ((element: Element, paths?: string[]) => OptionValue),
  group: string,
  before?: string,
  after?: string,
  hideTitle?: boolean,
  groupStatus?: GroupStatus,
  selectChoices?: SelectChoice[] | Selects | ((element: Element) => SelectChoice[] | Selects),
}
export type BlueprintCluster = {
  cluster: "map" | "array",
  items?: (element: Element) => string[],
  entries?: ClusterEntry[] | ((element: Element) => ClusterEntry[]),
  blueprintOptions: BlueprintOptions,
}
export type BlueprintOptions = {
  [key: string]: BlueprintValue | BlueprintCluster,
}

export type WidgetConstructor<T> = {
  new(soul: Soul): T
}

export function useWidget<T extends BaseWidget>(): T {
  return inject<T>("widget");
}

export type DataEncode = "json" | "array";

export type DataFormat = "row" | "column" | "object";

export type OptionType = "file" | "folder" | "field" | "table" | "element";
export type UsageTableInfo = Record<string, Record<string, string[]>>; 

export type ConnectionStack = {
  uid: string,
  name: string,
  connection?: Connection,
  from?: ConnectionFrom,
  icon?: string,
  componentType?: string,
  projectId?: Ref<string>,
}

type ConnectionStatus = {
  status?: 'refreshing' | 'resetting' | 'editting'
}

export  type ConnectionsStatus = {
  [uid: string]: ConnectionStatus,
}

export function isOptionFileValue(value): value is OptionFileValue {
  if (typeof value === "object") {
    return value?.["__opt_type"] === "file";
  }
  return false;
}
export function isOptionFileArrayValue(value): value is OptionFileValue[] {
  if (Array.isArray(value)) {
    return isOptionFileValue(value[0]);
  }
  return false;
}

export function isOptionElementValue(value): value is OptionElementValue {
  if (typeof value === "object") {
    return value?.["__opt_type"] === "element";
  }
  return false;
}
export function isOptionElementArrayValue(value): value is OptionElementValue[] {
  if (Array.isArray(value)) {
    return isOptionElementValue(value[0]);
  }
  return false;
}

export function isOptionFieldValue(value): value is OptionFieldValue[] {
  if (Array.isArray(value)) {
    if (typeof value[0] === "object") {
      return value[0]?.["__opt_type"] === "field";
    }
  }
  return false;
}

export type OptionFileValue = {
  relativePath?: string,
  relativeDir?: string,
  url?: string,
  __opt_type?: OptionType,
  exportFolder?: boolean,
}

export type OptionRenderFileValue = OptionFileValue & { isLink: boolean, uid: string };

export type OptionFieldValue = {
  summary: SummaryType,
  dataFormat?: SummaryDataFormat,
  multiValueMode?: FieldMultiValueMode,
  showMissingTime?: boolean,
  uid: OptionFieldUID,
  __opt_type: OptionType,
}
export type OptionTableValue = {
  uid: OptionTableUID,
  __opt_type: OptionType,
}

export type OptionElementValue = {
  elementPath?: string[],
  __opt_type?: OptionType,
}

export type OptionFontValue = {
  family: string,
  size: number,
  color: OptionColorValue,
  bold: boolean,
  italic: boolean,
  underline?: boolean,
  "line-through"?: boolean
}

export type OptionColorValue = string | ColorValue;

export type LinkageValue = string | number | string[] | number[] | {
  operator: "$eq" | "$contains" | "$ne",
  value: string | number | string[] | number[],
} | {
  operator: "$and",
  value: LinkageValue[]
} | {
  operator: "$time-gte" | "$time-lte" | "$gt" | "$gte" | "$lt" | "$lte",
  value: number
} | {
  operator: "$in" | "$nin",
  value: (string | number)[]
}

export function Eq (value: string | number | string[] | number[]):LinkageValue  {
  return {
    operator: "$eq",
    value
  }
}

export function In (value: number[] | string[]):LinkageValue  {
  return {
    operator: "$in",
    value: Array.isArray(value) ? value : [value]
  };
}

export function Contains (value: number[] | string[]):LinkageValue  {
  return {
    operator: "$contains",
    value: Array.isArray(value) ? value : [value]
  };
}

export function Gt (value: number):LinkageValue  {
  if (Array.isArray(value)) {
    value = value[0]
  }
  if (typeof value === 'string') {
    value = Number(value)
  }
  return {
    operator: "$gt",
    value
  }
}

export function Gte (value: number):LinkageValue  {
  if (Array.isArray(value)) {
    value = value[0]
  }
  if (typeof value === 'string') {
    value = Number(value)
  }
  return {
    operator: "$gte",
    value
  }
}

export function Lt (value: number):LinkageValue  {
  if (Array.isArray(value)) {
    value = value[0]
  }
  if (typeof value === 'string') {
    value = Number(value)
  }
  return {
    operator: "$lt",
    value
  }
}

export function Lte (value: number):LinkageValue  {
  if (Array.isArray(value)) {
    value = value[0]
  }
  if (typeof value === 'string') {
    value = Number(value)
  }
  return {
    operator: "$lte",
    value
  }
}

export function Ne (value: string | number | string[] | number[]):LinkageValue  {
  return {
    operator: "$ne",
    value
  }
}

export function Nin (value: string[] | number[]):LinkageValue  {
  return {
    operator: "$nin",
    value: Array.isArray(value) ? value : [value]
  }
}

export function And (value: LinkageValue[]): LinkageValue {
  return {
    operator: "$and",
    value: Array.isArray(value) ? value : [value]
  }
}

export const TimeGte = (value: number): LinkageValue => {
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (typeof value === 'string') {
    value = Number(value);
  }
  return {
    operator: "$time-gte",
    value: value,
  }
}

export const TimeLte = (value: number): LinkageValue => {
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (typeof value === 'string') {
    value = Number(value);
  }
  return {
    operator: "$time-lte",
    value: value,
  }
}

export type Linkage = {
  uid: OptionFieldUID,
  name?: string,
  value: LinkageValue
}

export type WidgetMeta = {
  name: string,
  version: string,
  displayName: string,
  browser?: string,
  super?: string,
  icon?: string,
  cover?: string,
  show?: boolean,
  virtualPath: string,
  dir: string,
}

type StatusErrorData = {
  key: string,
  type: string,
  msg?: string,
  data?: OptionFieldUID[],
}
type StatusErrorStyle = {
  key: string,
  type: string,
  msg?: string,
}
export type ElementStatus = {
  /** 是否显示 */
  isVisible?: boolean,
  /** 是否active */
  isActive?: boolean,
  /** 是否在视口出现过 */
  hasEnteredView?: boolean,
  /** 鼠标按下时间 */
  pointDwonTime?: number,
  /** 现在不区分hover的是组件还是catalog */
  isHover?: boolean,
  /** 是否是新创建的 */
  isNew?: boolean;
  /** 状态变化时间 */
  stateChangeTime?: number,
  /** 记录错误信息 */
  error?: {
    data?: StatusErrorData[],
    style?: StatusErrorStyle[],
  },
  /** 是否允许编辑子组件 */
  canEditorChild?: boolean,
}
export type BoardStatus = ElementStatus & {
  /** 是否可编辑  */
  isEditable?: boolean,
  /** 是否正在播放 */
  isPlaying?: boolean,
  /** 项目是否已经加载完毕 */
  isProjectReady?: boolean,
  /** 前景看板是否加载完毕 */
  isForeBoardReady?: boolean,
  /** 背景看板是否加载完毕 */
  isBackBoardReady?: boolean,
  /** 是否处于表单模式 */
  isFormMode?: boolean,
  /** 当前的缩放值 */
  scaling?: {
    x: number,
    y: number,
  },
  /** 数据源是否发生变化 */
  connectionChangeTime?: Record<string, number>,
  /** 数据变化结束时的时间戳 */
  connectionChangeOverTime?: number,
  /** 全屏播放时看板入场 */
  boardEnterTime?: number,
  /** 数据源是否初始化 */
  isConnectionInited?: boolean,
  /** mock所属widgetUid */
  mockOwner?: string,
}
export type WidgetStatus = ElementStatus & {
  /** 是否被选中 */
  isSelected?: boolean,
  /** 是否挂载 */
  isMounted?: boolean,
  /** inputVlaue是否发生改变 */
  lastChangeTime?: number;
}

export type CloneParams = {
  isSnap?: boolean,
};

export type SoulUIDMapping = {
  [key: string]: string,
}

export const isStatusStyle = (value: ElementDescriptionStyle): value is ElementDescriptionStatusStyle => {
  return isObject(value) && ('warning' in value || 'error' in value);
}

export type ElementDescriptionStatus = 'warning' | 'error';

export type ElementDescriptionStatusStyle = {
  [key in ElementDescriptionStatus]: StyleValue
}

export type ElementDescriptionStyle = ElementDescriptionStatusStyle | StyleValue;

export type ElementDescriptionGroup = {
  name: string,
  alias?: string,
  fold?: "fold" | "unfold",
  children: ElementDescription[],
  visible?: boolean | (() => boolean),
}

export type ElementDescription = {
  name: string,
  label?: string,
  value?: any,
  type?: 'string' | 'tag' | 'text' | 'json',
  visible?: boolean | (() => boolean),
  /** 是否是内部员工可见 */
  staff?: boolean,
  style?: ElementDescriptionStyle | (() => ElementDescriptionStyle),
  status?: ElementDescriptionStatus | (() => ElementDescriptionStatus),
}

export const SNAPSHOT_IGNORE_CLASS = "snapshot-ignore";
export const ALLOW_REALM_ELEMENT_CLASS = "allow-realm-element";
export const inCloudHost = () => window.inCloudHost();

export type WidgetMenuContext = {
  newAddPanelWidget?: boolean,
  renameWidgetCallback?: (widget: Widget) => void,
  showWidgetMenu?: (widget: Widget, isFromCatalog: boolean, mousePosition: MousePosition) => void,
  setWidgetCatalogStatus?: (type: 'fold' | 'expand') => void;
}

export type EditorRightStackTab = 'style' | 'data' | 'code' | 'more';

// #region 用来导出所有vue中 defineExpose的对象类型、命名规范：组件名 + Instance

export type OptionRoleMenuInstance = {
  virtualRef: HTMLElement,
  visible: boolean,
  show: (targetElement: HTMLElement, menus: OptionMenuRole[], element?: Element, paths?: string[]) => void,
}


// #endregion

export type DeployNavDialogArgs = {
  projectId: string,
  action: "share" | "export",
}

export type ProjectLog = {
  currentTime: string,
} & ParamLog

export type LogsObj = {
  projectLogs: ProjectLog[]
}

export type widgetManagerDialogArgs = 'move' | 'copy'

export type GetOptionOptions = {
  skipDefault?: boolean,
  skipTransition?: boolean,
  skipInherit?: boolean,
};

export enum LogicalOperator {
  AND = "AND",
  OR = "OR",
}

export enum VisibleType {
  SHOW = "show",
  HIDE = "hide",
}

export type FieldSelectOption = {
  label: string,
  value: string | number,
  disabled?: boolean,
}

export type FormSelectOption = {
  label: string,
  value: string,
  disabled?: boolean,
}

export type FormSelectGroupOption = {
  label: string,
  options?: (FormSelectOption | FormTreeOption)[],
  disabled?: boolean,
  tip?: string,
}

export type FormTreeOption = {
  label: string,
  value: string,
  alias?: string,
  disabled?: boolean,
  keepDisabledTextColor?: boolean,
  children?: FormTreeOption[],
}

export type FormVisibleRule = {
  id: string,
  logic: LogicalOperator,
  conditions: FormCondition[],
  widgetIds: string[],
  visibleType: VisibleType,
}

export enum FormFieldTypeOption {
  CURRENT_FIELD = "currentField",
  LINKAGE_FIELD = "linkageField"
}

export enum SelectIdOfForm {
  CURRENT = "current",
  LINKAGE = "linkage",
}

export type FormLinkageCondition = FormCondition & {
  id?: string,
  comparisonUid?: string, // 筛选弹窗中关联的表单字段的uid
  comparisonOfForm?: SelectIdOfForm, // 筛选弹窗中关联表单与当前表单值比较还是关联表单值比较
}

// 联动填充的筛选需要选填的属性，筛选弹窗组件则不需要
export type FormLinkageRule = {
  id?: string,
  linkageTable?: OptionTableUID,
  logic: LogicalOperator,
  conditions: FormLinkageCondition[],
  fillWidgets?: {
    fillWidget: string,
    linkageField: string,
    linkageSubFields?: {
      fillWidget?: string,
      linkageField?: string,
    }[],
  }[],
  subTableSetting?: {
    logic: LogicalOperator,
    conditions: FormLinkageCondition[],
  }
}

export type DataSourceFilterCondition = {
  linkageWidgets: string[],
  linkageFields: Record<FieldUID | `${FieldUID}.${FieldUID}`, string[]>,
  func: RuleFunc
  value: string
}

export type DataSourceFilterRule = Record<string, DataSourceFilterCondition[]>;

export type Filter = Pick<DataSourceFilterCondition, "linkageFields" | "func" | "value">;

export type WidgetMetaData = Partial<{
  axisValue: OptionFieldValue[],
}>

export type DataCollectionOptions = QueryOptions & {
  preConditions?: FilterRule,
  conditions?: FormCondition[],
  query?: WhereCondition,
}

export interface ChartClickState {
  /** 上一次选中的系列索引 */
  lastseriesIndex: number;
  /** 上一次选中的数据索引 */
  lastDataIndex: number;
  /** 上一次需要执行取消选中操作的索引，用于柱状图的切换 */
  lastUnselectIndex?: number;
  /** 上一次选中的顶部图形索引，用于柱状图的高亮状态 */
  lastTopshapeIndex?: number;
}
