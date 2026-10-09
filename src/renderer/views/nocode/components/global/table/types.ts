import { FilterRule, FormSortField, FormTableCarouselSettings, FormTableColumnOrder, FormTableOperationSettings, FormTablePermissionMode, FormTableRowHeight, FormTableRuntime, FormTableViewMeta, NocodeBody, ViewAction } from "@common/types/nocode";
import { FieldUID, FormDataStageWhereCondition, Row, TableUID } from "@common/types/project";
import { OrganizeUtil } from "@renderer/views/nocode/utils";

export enum SortType {
  ASC = 1,
  DESC = -1,
}

export { FormMode } from "@renderer/types/base";

export type TableContext = {
  runtime: FormTableRuntime,
  nocodeBody: NocodeBody,
  organizeUtil: OrganizeUtil,
  meta: FormTableViewMeta
}

export type TableAssignOwnerDialogOptions = {
  rows?: Row[],
  initialOwnerId?: string,
  onSubmit?: (rows: Row[], ownerId: string) => Promise<void> | void,
}

export type TableProps = {
  nocodeId: string,
  widgetNocodeId?: string,
  tableUID: TableUID,
  viewId?: string,
  actions?: ViewAction[],
  tableViewMeta?: FormTableViewMeta,
  uid?: string,
  /** 系统字段是否受应用设置中的字段权限影响显示 */
  applyAppFieldPermissionToSystemFields?: boolean,
  /** 是否允许添加数据 */
  isAddDataAble?: boolean,
  /** 是否允许导入数据 */
  isImportDataAble?: boolean,
  /** 是否允许导出数据 */
  isExportDataAble?: boolean,
  isPrintDataAble?: boolean,
  /** 是否允许删除数据 */
  isDeleteDataAble?: boolean,
  /** 是否显示更多按钮 */
  isShowMoreMenu?: boolean,
  /** 是否允许修改数据 */
  isEditDataAble?: boolean,
  /** 是否可搜索 */
  searchable?: boolean,
  /** 是否可筛选 */
  filterable?: boolean,
  /** 是否可以改变筛选列表的显示模式 */
  isChangeFilterDisplayMode?: boolean,
  /** 是否可以进行单元格编辑 */
  isTableCellEditable?: boolean,
  /** 是否可排序 */
  sortable?: boolean,
  /** 是否可调整显示字段 */
  hideColumnsAble?: boolean,
  /** 是否可调整行高 */
  changeRowHeightAble?: boolean,
  isShowAggregateFieldButton?: boolean,
  aggregateFieldActive?: boolean,
  /** 是否显示表头 */
  isShowHeader?: boolean,
  /** 是否显示表头按钮 */
  isShowTableHeaderMenu?: boolean,
  /** 是否允许更新列数据 */
  updateColumnDataAble?: boolean,
  /** 是否显示选框列 */
  isShowCheck?: boolean,
  /** 是否显示独立序号列 */
  isShowIndex?: boolean,
  showSelectionSequence?: boolean,
  /** 选框列是否是多选 */
  isMultiple?: boolean,
  /** 点击行是否显示详情 */
  clickRowShowDetail?: boolean,
  /** 行详情打开方式 */
  rowDetailTrigger?: 'click' | 'dblclick',
  /** 点击行时是否选中 */
  clickRowChecked?: boolean,
  /** 是否显示表底 */
  isShowFooter?: boolean,
  /** 是否显示聚和行 */
  isShowAggregateRow?: boolean
  /** 是否显示分页 */
  isShowPagination?: boolean,

  /** 是否是画册模式 */
  isAlbum?: boolean,
  /** 预筛选条件  */
  preFilterRule?: FilterRule,
  /** 预筛选条件列表 */
  preViewFilterRules?: FilterRule[],
  /** 预隐藏字段信息 */
  preHiddenColumns?: FieldUID[],
  /** 预设置字段顺序信息 */
  preColumnOrders?: FormTableColumnOrder,
  /** 预排序字段 */
  preSortFields?: FormSortField[],
  /** 预分页大小 */
  prePageSize?: number,

  /** 添加时表单的预填充数据 */
  addNewRowData?: Row,

  /** 表头设置项显示模式 */
  headerOptionsShowMode?: 'default' | 'right-compact',
  /** right-compact模式下，外部显示的选项个数 (不含"更多"按钮) */
  headerVisibleOptionCount?: number,
  /** 表头菜单模式 */
  headerMenuMode?: 'full' | 'sort-root-only',
  /** 表头菜单是否显示筛选面板 */
  enableHeaderFilterPanel?: boolean,
  /** 表头展示变体 */
  headerVariant?: 'default' | 'recycle',
  /** 是否显示数据回收站入口 */
  showRecycleBinEntry?: boolean,
  
  /** 筛选条件为空值时是否过滤 */
  isFilterEmptyValue?: boolean,
  /** 当前表格查询的默认阶段 */
  queryStage?: FormDataStageWhereCondition,
  /** 当前是否全屏 */
  fullscreen?: boolean,
  skipOrganizeLoad?: boolean,
  permissionMode?: 'page' | 'data',
  dataPermissionMode?: FormTablePermissionMode,
  operationSettings?: FormTableOperationSettings,
  topLimit?: number,
  fixedColumnCount?: 0 | 1 | 2 | 3 | 4,
  carouselSettings?: FormTableCarouselSettings,
  openAssignOwnerDialog?: (options?: TableAssignOwnerDialogOptions) => void,
}
