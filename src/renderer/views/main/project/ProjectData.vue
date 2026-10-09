<template>
  <div :class="['project-data']">
    <div class="project-data-body">
      <div class="empty-content" v-if="!availableTables.length">
        <slot name="empty" />
      </div>
      <template v-else>
        <vn-stack v-model="activeTableName">
          <div class="tabsTitle">
            <vn-stack-tab name="data"><span>{{ $t("projectData.data") }}</span></vn-stack-tab>
            <vn-stack-tab name="field"><span>{{ $t("projectData.field") }}</span></vn-stack-tab>
          </div>
          <vn-stack-layer name="data">
            <vn-stack class="project-data-stack" v-model="activeTableId" style="height: '100%';">
              <div :class="['project-data-slider', { 'no-wrap': true }]">         
                <div v-for="(table, index) in availableTables" class="table-container">
                  <vn-stack-tab 
                    :draggable="true" 
                    @dragstart="handleDragStart($event, table)" 
                    @dragend="handleDragEnd($event)"
                    @contextmenu.prevent="handleTableContextMenuShow(table, $event)" 
                    ref="inputRef" 
                    @click="handleSwitchTable(table)" 
                    :key="table.uid" 
                    :name="table.uid"
                  >
                    <template v-if="true">
                      <div class="table-name" :ref="(el) => handleRef(el as HTMLDivElement, table.uid)" :title="formatTitle(table.alias, table.meta?.name)">
                        <el-icon :size="14"><i-ep-memo /></el-icon>
                        <span>{{ getTableLabel(table) }}{{ $t("projectData.data") }}</span>
                      </div>
                    </template>
                  </vn-stack-tab>
                </div>
              </div>
              <!-- <div class="project-data-content">
                <vn-stack-layer v-for="table in formData.tables" :key="table.uid" :name="table.uid">
                  <div v-for="field in table.fields" :key="field.uid"
                    :class="{ field: true, selected: selectedFields[field.uid], editing: reNameId == field.uid, hide: !isShowField(field)}"
                    @contextmenu.prevent="handleFieldContextMenuShow($event, table, field)"
                    @dragstart.stop="handleFieldDragStart($event, [formData.uid, table.uid, field.uid], field)">
                    <label class="field-alias" :draggable="props.useData"
                      @click="handleSelectField(table, field, selectedFields[field.uid] > 0)">
                      <input ref="inputRef" v-model="field.alias" @blur="changeFieldAlias(formData.uid, table.uid)" @keyup.enter="changeFieldAlias(formData.uid, table.uid)" v-if="reNameId == field.uid">
                      <span v-else :title="formatTitle(field.alias, field.meta?.name)" :class="{ active: isSearchResultField(field.alias) }">
                        {{ field.alias }}
                      </span>
                      <i
                        :class="{ fs: true, 'field-icon': true, [fieldTypeIcon[field.revisedType || field.type]]: true }"></i>
                    </label>
                  </div>
    
                </vn-stack-layer>
              </div> -->
            </vn-stack>
          </vn-stack-layer>

          <vn-stack-layer name="field">
            <div class="fields-container">
              <div class="current-fields">
                <div class="left">
                  <el-icon>
                    <i-ep-memo />
                  </el-icon>
                  <span>{{ getTableLabel(showTable) }}</span>
                </div>
                <div class="right">
                  <el-button class="detail-btn" text :title="$t('projectData.viewData')" @click="emit('dataSourceViewer', showTableConnection, showTable)">
                    <el-icon :size="16"><i-table-file-search /></el-icon>
                  </el-button>
                  <el-button class="switch-btn" text :title="$t('projectData.switchDataSource')" @click="isShowSwitchFiled = !isShowSwitchFiled">
                    <el-icon :size="16"><i-table-switch /></el-icon>
                  </el-button>
                </div>
              </div>

              <ul>
                <li  
                  :class="{selected: selectedFields[item.uid]}" 
                  v-for="item in showTableFields" :key="item.uid"
                  @click="handleSelectField(showTableConnection, showTable, item, selectedFields[item.uid] > 0)"
                  @dragstart.stop="handleFieldDragStart($event, [showTableConnection?.uid || formData.uid, showTable.uid, item.uid], item)"
                  :draggable="props.useData"
                >
                  <el-icon>
                    <i-ven-project-data-text></i-ven-project-data-text>
                  </el-icon>
                  <span>
                    {{ item.alias }}
                  </span>
                </li>
              </ul>

              <div class="switch-fields-container" v-if="isShowSwitchFiled" v-click-outside="clickOutSide">
                <div class="input-container">
                  <el-icon class="el-input__icon"><i-ep-search /></el-icon>
                  <input type="text" v-model="fieldSearch" :placeholder="$t('projectData.searchKey')">
                  <el-icon class="delete" @click="fieldSearch = ''" v-if="fieldSearch != ''">
                    <i-ep-circle-close-filled />
                  </el-icon>
                </div>
                <el-scrollbar class="switch-fields-item-container">
                  <div class="switch-fields-item" v-for="(item) in allTablesForDisplay" @click="handleSwitchFiled(item)">
                    <el-icon>
                      <i-ep-memo />
                    </el-icon>
                    <span>{{ getTableLabel(item) }}</span>
                  </div>
                </el-scrollbar>
              </div>
            </div>
          </vn-stack-layer>
        </vn-stack>
        
      </template>
    </div>
    <project-data-context-menu :type="contextMenuType" :currentData="currentData"
      :event="event" :visible="contentMenuVisible" 
      @contextClick="handleContextClick"
      @childContextClick="handleChildContextClick" 
      :isEmbedded="true"
      :isShowExpand="false"
    >
    </project-data-context-menu>
    <el-popover
      placement="right"
      trigger="click"
      :width="160"
      :visible="isShowFieldsPopover"
      :virtual-ref="virtualRef"
      virtual-triggering
      popper-class="nocode-project-data-fields-popover"
      ref="popoverRef"
    >
      <div class="fields">
        <p class="empty" v-if="!showTableFields.length">{{ $t('projectData.noField') }}</p>
        <div v-for="field in showTableFields || []" :key="field.uid" v-else
          :class="{ field: true, selected: selectedFields[field.uid], editing: reNameId == field.uid }"
          @contextmenu.prevent="handleFieldContextMenuShow($event, showTable, field)"
          @dragstart.stop="handleFieldDragStart($event, [showTableConnection?.uid || formData.uid, showTable.uid, field.uid], field)">
          <label 
            class="field-alias" 
            :draggable="props.useData"
            @click="handleSelectField(showTableConnection, showTable, field, selectedFields[field.uid] > 0)"
          >
            <input ref="inputRef" v-model="field.alias" @blur="changeFieldAlias(formData.uid, showTable.uid)" @keyup.enter="changeFieldAlias(formData.uid, showTable.uid)" v-if="reNameId == field.uid">
            <span v-else :title="formatTitle(field.alias, field.meta?.name)" :class="{ active: isSearchResultField(field.alias) }">
              {{ field.alias }}
            </span>
            <i :class="{ fs: true, 'field-icon': true, [fieldTypeIcon[field.revisedType || field.type]]: true }"></i>
          </label>
        </div>
      </div>
    </el-popover>
  </div>
</template>


<script setup lang="ts">
import { Connection, ConnectionData, ConnectionUID, Field, OptionFieldUID, PrivateDataConnectionUID, Table, TableUID } from '@common/types/project';
import { FIELD_OPTION_CONTEXTS, PROJECT_CHANGED, ProjectDataContextMenuType, FieldOptionContext, ParsedRef, PROJECT_TABLE_DRAGGING, EDIT_PROJECT_MODULE, NOCODE } from '@renderer/types';
import { isEmpty } from '@common/utils/object';
import { ElMessage, ClickOutside as vClickOutside } from 'element-plus';
import { ref, inject, computed, watch, nextTick, Ref } from 'vue';
import i18next from "i18next";
import { AggregateTable, Nocode, NocodeFormData } from '@common/types/nocode';
import { isEntityField, isSystemField, SystemField } from '@common/utils';
import { getNocodeDataSourceConnections, populateNocodeDataSourceTableSubFields, type NocodeDataSourceConnection } from '@common/utils/connection';
import { buildBoardConnectionsWithAggregateTables } from '@renderer/utils/aggregateTable';
import { extendConnectionsWithTableAggregateFields } from '@renderer/utils/tableAggregateField';

const fieldOptionContexts = inject(FIELD_OPTION_CONTEXTS) || ref<Record<string, FieldOptionContext>>({});
const editProjectModule = inject(EDIT_PROJECT_MODULE);
const projectChanged = inject(PROJECT_CHANGED) || ref(false);
const nocode = inject<Ref<Nocode>>(NOCODE, null);

const props = withDefaults(defineProps<{
  formData: NocodeFormData,
  useData?: boolean,
}>(), {
  useData: true,
});

const emit = defineEmits<{
  (event: "formCreate", table: Table),
  (event: "copyTable", table: Table),
  (event: "deleteTable", table: Table),
  (event: "dataSourceViewer", connection: NocodeDataSourceConnection, table: Table),
}>();


const activeTableName = ref("field");
const activeTabRef = ref<HTMLDivElement>();
const handleRef = (el: HTMLDivElement, tableUID: string) => {
  if (tableUID === activeTableId.value) {
    activeTabRef.value = el;
  }
}


const formatTitle = (curName: string, oriName: string) => {
  if (oriName === curName || !oriName) return curName;
  return `${curName}（${oriName}）`;
}

// 折叠面板双向绑定数据值
const openCollapses = ref([])
// 视口宽度
const clientWidth = document.documentElement.clientWidth
// 需要进行重命名的数据uid
const reNameId = ref()
// 当前选中展开右键对象数据
const currentData = ref()
// 当前选中展开右键对象数据表所在的数据表列表
// 当前选中右侧field时
const currentTable = ref<Table>()
// 右键面板类型
const contextMenuType = ref<ProjectDataContextMenuType>(null)
// 右键时的event
const event = ref<MouseEvent>();
// 右键菜单显示状态控制
const contentMenuVisible = ref(false)

const activeTableId = ref();
const activeFormId = ref();
const isShowFieldsPopover = ref(false);
const virtualRef = ref();
const popoverRef = ref()
let delayTimer: number;
const selectTableUID = ref("");
const fieldSearch =ref('')
const isShowSwitchFiled = ref(false);

const currentNocodeBody = computed(() => {
  return nocode?.value?.body || ({ formData: props.formData } as any);
})

const dataSourceConnections = computed<NocodeDataSourceConnection[]>(() => {
  if (!nocode?.value?.body) {
    return [props.formData as NocodeDataSourceConnection];
  }
  return getNocodeDataSourceConnections(nocode.value.body, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
  });
})

const displayDataSourceConnections = computed<NocodeDataSourceConnection[]>(() => {
  const connectionsWithAggregateTable = buildBoardConnectionsWithAggregateTables(
    dataSourceConnections.value as unknown as Connection[],
    dataSourceConnections.value,
  ) as unknown as NocodeDataSourceConnection[];
  return extendConnectionsWithTableAggregateFields(
    connectionsWithAggregateTable as unknown as Connection[],
    dataSourceConnections.value,
  ) as unknown as NocodeDataSourceConnection[];
})

const connectionUIDMapping = computed<Record<string, string>>(() => {
  return displayDataSourceConnections.value.reduce((prev, connection) => {
    connection.tables?.forEach(table => {
      prev[table.uid] = connection.uid;
    });
    return prev;
  }, {});
})

const getTableConnection = (table?: Table) => {
  if (!table?.uid) return null;
  const connectionUID = connectionUIDMapping.value[table.uid];
  return displayDataSourceConnections.value.find(item => item.uid === connectionUID) || null;
}

const getTableLabel = (table?: Table) => {
  if (!table) return '';
  const connection = getTableConnection(table);
  if (!connection || connection.uid === props.formData.uid || !connection.name) {
    return table.alias;
  }
  return `${connection.name}-${table.alias}`;
}

const availableTables = computed(() => {
  return displayDataSourceConnections.value.flatMap(connection => {
    return (connection.tables || []).filter(table => !table.meta?.extra?.primaryTable);
  });
})

const getDisplayTableSourceByUID = (tableUID?: TableUID) => {
  if (!tableUID) return undefined;

  for (const connection of displayDataSourceConnections.value) {
    const table = connection.tables?.find(item => item.uid === tableUID);
    if (!table) continue;

    return {
      connection,
      table: populateNocodeDataSourceTableSubFields(table, connection),
    };
  }

  return undefined;
}

const getAggregateTableConfig = (table?: Table) => {
  if (!table?.uid) return null;
  const connection = getTableConnection(table) as (NocodeDataSourceConnection & { aggregateTables?: AggregateTable[] }) | null;
  return connection?.aggregateTables?.find(item => item.uid === table.uid) || null;
}

const isEmptyFields = (fields: Field[]) => {
  if (isEmpty(fields)) return true;
  return fields.filter(field => !isSystemField(field) || field.meta.name === '_uuid').length === 0;
}

const onClickOutside = (ev) => {
  if (!isShowFieldsPopover.value) return;
  const target: HTMLElement = ev.target;
  const popover = document.querySelector(".nocode-project-data-fields-popover");
  if (popover && popover.contains(target)) return;
  isShowFieldsPopover.value = false;
  contentMenuVisible.value = false;
}
document.addEventListener('click', onClickOutside, true);

const handleSwitchTable = (table: Table) => {
  const connection = getTableConnection(table);
  if (!connection) return;
  if (!table.meta?.extra?.primaryTable) {
    clearTimeout(delayTimer);
    isShowFieldsPopover.value = false;
    activeFormId.value = table.uid;
    emit("dataSourceViewer", connection, table)
  }
}

const getActiveTab = () => {
  const fieldContexts = Object.values(fieldOptionContexts.value);
  for (const context of fieldContexts) {
    if (!context?.getFields) continue;
    const fieldOptions = context.getFields();
    //自有数据时忽略
    if (!isEmpty(fieldOptions) && fieldOptions[0].uid[0] !== PrivateDataConnectionUID) {
      return fieldOptions[0].uid[1];
    }
  }
  return availableTables.value?.[0]?.uid;
}


/**
 * 在选中不同的组件时，activeTab也需要变化
 */
watch(() => fieldOptionContexts.value, () => {
  activeTableId.value = getActiveTab();
  nextTick(() => {
    activeTabRef.value?.scrollIntoView({ block: "center" });
  })
}, {
  immediate: true,
  deep: true
})

/**
 * @author: Dong
 * @函数说明: '监听全局点击事件,点击右键菜单外时关闭右键菜单'
 */
document.addEventListener("click", () => {
  contentMenuVisible.value = false
}, true);

/**
 * @author: Dong
 * @函数说明: '监听折叠面板改变事件并实时刷新绑定值'
 * @param {string[]} activeNames 当前激活折叠面板uid数组
 */
const collapseChange = function (activeNames: string[]) {
  openCollapses.value = activeNames
}

// 修改字段名
const changeFieldAlias = async (connectionId: ConnectionUID, tableId: TableUID) => {
  reNameId.value = '';
  projectChanged.value = true;
}

/**
 * @author: Dong
 * @函数说明: '右键数据表菜单打开事件'
 * @param {*} table 选中的数据表的数据对象
 */
const handleTableContextMenuShow = function (table: Table, ev: MouseEvent) {
  return
  // event.value = ev;
  // currentData.value = table
  // contextMenuType.value = 'table';
  // contentMenuVisible.value = true;
}

/**
 * @author: Dong
 * @函数说明: '右键数据项菜单打开事件'
 * @param event 
 * @param field 
 */
const handleFieldContextMenuShow = function (ev: MouseEvent, table: Table, field: Field) {
  event.value = ev;
  currentTable.value = table;
  currentData.value = field
  contextMenuType.value = 'field'
  contentMenuVisible.value = true
}

const inputRef = ref<any>([]);
const handleContextClick = async function (value: string) {
  if (!(await editProjectModule())) return;
  switch (contextMenuType.value) {
    case 'table':
      switch (value) {
        case "foldAll":
          openCollapses.value = []
          break;
        case "expandAll":
          openCollapses.value = [props.formData.uid];
          break;
        case "rename":
          reNameId.value = currentData.value.uid
          await nextTick()
          inputRef.value[inputRef.value.length - 1].focus()
          inputRef.value[inputRef.value.length - 1].select()
          break;
        case "deleteTable":
          emit("deleteTable", currentData.value)
          break;
        case "formCreate":
          emit("formCreate", currentData.value)
          break;
        case "copyTable":
          emit("copyTable", currentData.value)
          break;
        default:
          break;
      }
      break;

    case 'field':
      switch (value) {
        case "rename":
          reNameId.value = currentData.value.uid
          await nextTick()
          inputRef.value[inputRef.value.length - 1].focus()
          inputRef.value[inputRef.value.length - 1].select()
          break;
        default:
          break;
      }
      break;
  }
}

const handleChildContextClick = async function (childName: string) {
  if (!(await editProjectModule())) return;
  switch (childName) {
    case "string":
      if (currentData.value.revisedType === 'string') {
        return;
      }
      currentData.value.revisedType = 'string'
      projectChanged.value = true
      break;
    case "number":
      if (currentData.value.revisedType === 'number') {
        return;
      }
      currentData.value.revisedType = 'number'
      projectChanged.value = true
      break;
    case "array":
      if (currentData.value.revisedType === 'array') {
        return;
      }
      currentData.value.revisedType = 'array'
      projectChanged.value = true
      break;
    default:
      return;
  }

  // 更新connectionData中的数据
}

const handleFieldDragStart = (ev: DragEvent, fieldUID: OptionFieldUID, field: Field) => {
  ev.dataTransfer.setData("drag-type", "ProjectDataDrag");
  console.log('dskfjlkdsf', fieldUID, field)
  ev.dataTransfer.setData("drag-data", JSON.stringify({ fieldUID, field }));
}

const fieldTypeIcon = {
  string: 'fs-dimension-string',
  number: 'fs-dimension-number',
  array: 'fs-dimension-array'
}

const searchValue = ref('');

const isSearchResultField = computed(() => (fieldName: string) => {
  if (searchValue.value === '') {
    return false;
  }
  return fieldName.includes(searchValue.value);
})
const forcedCalculation = ref(1);

const selectedFields = computed(() => {
  const fieldContexts = Object.values(fieldOptionContexts.value);

  let results = {};
  for (const context of fieldContexts) {
    if (!context?.getFields) continue;
    const fields = context.getFields();
    if (Array.isArray(fields)) {
      for (const { uid } of fields) {
        results[uid[2]] ? results[uid[2]] += 1 : results[uid[2]] = 1;
      }
    }
  }
  return results;
});

const handleSelectField = (connection: NocodeDataSourceConnection, table: Table, field: Field, isSelected: boolean) => {
  if (!props.useData) return;
  if(reNameId.value == field.uid) return;
  const fieldContexts = Object.values(fieldOptionContexts.value);

  if (isSelected) { // 已经选中，那就取消这个组件所有用了这个的 field
    for (const context of fieldContexts) {
      const fields = context.getFields();
      const index = fields.findIndex((item) => item.uid[2] === field.uid);
      if (index >= 0) {
        context.removeField([connection?.uid || props.formData.uid, table.uid, field.uid]);
        return;
      }
    }

  } else {
    if (isEmpty(fieldContexts)) {
      ElMessage({
        type: 'warning',
        message: i18next.t("projectData.selectWidgetFirstTip")
      });
      return;
    }

    const addFieldFn = getRecommend(field);
    if (typeof addFieldFn !== 'function') return;
    addFieldFn([connection?.uid || props.formData.uid, table.uid, field.uid]);
  }
}

const getRecommend = (field: Field) => {
  const fieldContexts = Object.values(fieldOptionContexts.value);
  const result = {};
  let errorType: 'quantityLimit' | 'typeError';
  for (const context of fieldContexts) {
    const score = context.computeFieldScore(field);
    if (typeof score === 'number') {
      result[score] = context.addField;
    } else {
      errorType = score;
    }
  }
  if (!isEmpty(result)) {
    const commendKey = Math.max(...Object.keys(result) as unknown as number[]);
    return result[commendKey];
  } else {
    if (errorType === 'typeError') {
      ElMessage({
        type: 'warning',
        message: i18next.t("fieldOption.fieldsTypeError")
      });
    } else {
      ElMessage({
        type: 'warning',
        message: i18next.t("fieldOption.fieldsTypeLimit")
      });
    }
  }
}

const projectTableDragging = inject(PROJECT_TABLE_DRAGGING);

const handleDragStart = (ev: DragEvent, table: Table)=>{
  const connection = getTableConnection(table);
  projectTableDragging.value = true;
  const tableUID = [connection?.uid || props.formData.uid, table.uid];
  ev.dataTransfer.setData("drag-type", "ProjectTableDrag");
  ev.dataTransfer.setData("drag-table-type", "ProjectDataDragTable");
  ev.dataTransfer.setData("drag-data", JSON.stringify(tableUID));
  ev.dataTransfer.setData("drag-table-data", JSON.stringify({
    tableUID,
    table,
  }));
  ev.dataTransfer.setData("connection-type", "embedded");
}
const handleDragEnd = (ev)=>{
  projectTableDragging.value = false;
}

defineExpose({
  get activeConnectionId() {
    return connectionUIDMapping.value[activeTableId.value] || props.formData?.uid;
  },
  refresh() {
    forcedCalculation.value ++;
  },
  activity(table: Table) {
    activeFormId.value = table.uid;
  },
  removeActive() {
    activeFormId.value = '';
  }
})

const clickOutSide = () => {
  isShowSwitchFiled.value = false;
}

const handleSwitchFiled = (table: Table) => {
  selectTableUID.value = table.uid;
  isShowSwitchFiled.value = false;
}

const isShowSystemField = (field: Field) => {
  return [SystemField.CREATE_OWNER, SystemField.DATA_OWNER, SystemField.CREATE_TIME, SystemField.UPDATE_TIME].includes(field.meta.name as any);
}
// const isShowField = (field: Field) => {
//   if (isSystemField(field)) {
//     return isShowSystemField(field);
//   }
//   return true;
// }

const selectedTableUID = computed(() => {
  return selectTableUID.value || activeTableId.value || availableTables.value?.[0]?.uid;
})

const showTableSource = computed(() => {
  return getDisplayTableSourceByUID(selectedTableUID.value);
})

const showTable = computed(() => {
  return showTableSource.value?.table || availableTables.value?.[0];
})

const showTableConnection = computed(() => {
  return showTableSource.value?.connection || getTableConnection(showTable.value);
})

const showTableFields = computed(() => {
  if (!showTable.value) return [];
  const aggregateTable = getAggregateTableConfig(showTable.value);
  const metricFields: Field[] = (aggregateTable?.metrics || [])
    .filter(metric => !showTable.value.fields.some(field => field.uid === metric.uid))
    .map(metric => {
      const format = metric.format || {};
      return {
        uid: metric.uid as any,
        alias: metric.name,
        type: 'number',
        meta: {
          uid: metric.uid,
          name: metric.name,
          subType: 'number',
          extra: {
            widgetType: 'widget.form.numberInput',
            isAggregateMetric: true,
            isPercent: format.isPercent ?? false,
            completeZero: format.completeZero ?? false,
            decimalPlaces: format.decimalPlaces ?? 0,
            thousandSeparator: format.thousandSeparator || "",
            decimalSeparator: format.decimalSeparator || ".",
          },
        },
      };
    });
  const tableFields = [...showTable.value.fields, ...metricFields];
  const fields = tableFields.filter(item => !isSystemField(item));
  const systemFields = tableFields.filter(item => isShowSystemField(item));
  const _fields = fields.reduce((prev, item) => {
    const processField = (field: any) => {
      if (isEntityField(field)) {
        const idField = {
          ...field,
          alias: `${field.alias}(ID)`
        };

        const entityField = {
          ...field,
          uid: `${field.uid}_entity`
        };

        prev.push(idField, entityField);
      } else {
        prev.push(field);
      }
    };

    if (item.meta.subType === "subForm") {
      const subTableUID = item.meta.extra.subTableUID;
      const subTable = showTableConnection.value?.tables?.find(table => table.uid === subTableUID[1]);
      if (subTable) {
        const subFields = subTable.fields.filter(field => !isSystemField(field)).map(field => {
          return {
            ...field,
            uid: `${item.uid}.${field.uid}`,
            alias: `${item.alias}.${field.alias}`
          }
        })
        subFields.forEach(processField);
      }
    } else {
      processField(item);
    }
    return prev;
  }, []);
  return [..._fields, ...systemFields];
})

const allTables = computed(() => {
  const fTable = props.formData?.tables?.filter(table => !table.meta?.extra?.primaryTable) // 过滤掉子表单
  if (fieldSearch.value === '') {
    return fTable;
  }
  return fTable.filter(table => table.alias.includes(fieldSearch.value))
})
const allTablesForDisplay = computed(() => {
  const fTable = availableTables.value
  if (fieldSearch.value === '') {
    return fTable;
  }
  return fTable.filter(table => getTableLabel(table).includes(fieldSearch.value))
})
</script>

<style scoped lang="scss">
.project-data {
  width: 100%;
  height: 100%;
  max-height: 300%;
  display: flex;
  flex-direction: column;


  .project-data-body {
    height: 100%;
    // height: calc(100% - 35px);
    position: relative;

    .search-input {
      display: flex;
      padding: 4px;
      background-color: var(--bg-color);
      align-items: center;
      justify-content: space-between;

      :deep(.el-input) {
        .el-input__wrapper {
          padding: 3px 7px;
          height: 35px;
          .el-icon.el-input__icon{
            font-size: 12px;
            margin-right: 0;
          }
        }
  
        input {
          padding: 0 20px 0 5px;
  
          &::-webkit-input-placeholder {
            font-size: 10px;
          }
        }
      }

      :deep(.el-button) {
        width: 34px;
        height: 34px;
        margin-left: 5px;
      }
    }

    .empty-content {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      color: #aba8a8;


      .add-project-data {
        cursor: pointer;
  
        &:hover {
          color: #d5d5d6;
        }
  
        i {
          font-size: 12px;
        }
      }
    }

    .tabsTitle {
      display: flex;
      padding-top: 6px;
      height: 36px;

      span {
        cursor: pointer;
        color: var(--text-color-secondary);
      }

      .vn-stack-tab {
        height: 28px;
        padding: 0;
        margin-right: 8px;
      }

      .active {
        border-bottom: 1px solid var(--color-primary);
        span {
          color: var(--color-primary);
        }
      }
    }

    .fields-container {

      position: relative;
      

      .current-fields {
        padding: 0px 9px 0px 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 32px;
        color: var(--text-color-regular);

        span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .el-icon {
          font-size: 16px;
        }

        .left {
          display: flex;
          align-items: center;
          max-width: calc(100% - 64px);
        }

        .right {
          display: flex;
          align-items: center;
          .el-button {
            width: 20px;
            height: 24px;
            margin: 0;
            border-radius: 4px;
          }
          .detail-btn {
            margin-right: 4px;
          }
        }
      }

      ul {
        li {
          display: flex;
          height: 32px;
          padding-left: 28px;
          align-items: center;
          cursor: pointer;
          transition: all 0.3s ease;
          border-radius: 4px;

          span {
            width: 170px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          &.hide {
            display: none !important;
          }

          &.selected {
            &::before {
              content: "\e677";
              transform: rotate(-360deg);
              transition: transform .3s ease-in-out;
            }

            background-color: var(--color-primary-light-9);
            color: var(--color-primary);

            .el-icon {
              color: var(--color-primary);
            }
          }

          .el-icon {
            font-size: 14px;
            color: var(--text-color-regular);
            transition: all 0.3s ease;
          }

          &:hover:not(.selected) {
            background-color: #f2f3f5;
          }

          &::before {
            display: inline-block;
            font-style: normal;
            font-variant: normal;
            text-rendering: auto;
            -webkit-font-smoothing: antialiased;
            font-family: "fs";
            font-weight: 900;
            font-size: 12px;
            padding: 2px 6px 2px 2px;
            content: "\e799";
            transition: transform .3s ease-in-out;
          }
        }
      }

      .switch-fields-container {
        position: absolute;
        height: 240px;
        width: 240px;
        top: 33px;
        left: 4px;
        border: 1px solid var(--border-color);
        background-color: var(--color-white);
        border-radius: 4px;
        box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.08);
        display: flex;
        flex-direction: column;
        padding: 8px;

        .input-container {
          height: 32px;
          padding-left: 6px;
          font-size: 12px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          display: flex;
          align-items: center;
          background-color: var(--bg-color-overlay);
          margin-bottom: 4px;

          .el-icon {
            margin-right: 8px;
            font-size: 16px;
            
            &.delete {
              color: var(--text-color-inactive);
              cursor: pointer;
              opacity: 0;
              transition: all 0.2s ease;
            }
          }

          &:hover {
            .delete {
              opacity: 1;
            }
          }
        }

        .switch-fields-item-container {
          flex: 1;
          overflow: auto;
          .switch-fields-item {
            font-size: 12px;
            height: 32px;
            display: flex;
            align-items: center;
            padding-left: 6px;
            cursor: pointer;
            transition: all 0.3s ease;

            &:hover {
              background-color: var(--bg-color-hover);
            }

            .el-icon {
              font-size: 16px;
            }

            span {
              max-width: 200px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }
        }
      }
    }

  }

  .project-data-stack {
    width: 100%;
    height: calc(100% - 43px);
    display: flex;
    :deep(.project-data-slider) {
      width: 100%;
      padding-top: 8px;

      &.no-wrap .el-collapse-item__header {
        display: none;
      }
      .table-container {
        display: flex;
        cursor: var(--cursor-pointer);
        padding: 0px 8px;
        transition: all 0.3s ease;
        height: 32px;
        border-radius: 4px;

        &:hover {
          background-color: #f2f3f5;
        }
        &.activity {
          background-color: var(--el-color-primary-light-9);
          color: var(--color-primary);
        }
        .show-fields-button {
          width: 30px;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: all 0.3s ease;
          color: var(--el-text-color-regular);

          &:hover {
            color: var(--el-color-primary);
            background-color: var(--el-color-primary-light-8);
          }
        }

        input {
          height: 35px;
        }
      }
      .vn-stack-tab {
        display: flex;
        flex: auto;
        padding-right: 8px;
        color: unset;
        &.active {
          background-color: unset;
          color: unset;
        }


        .table-name {
          margin-left: 0 !important;
          display: flex;
          align-items: center;
          column-gap: 2px;
          width: 100%;
          overflow: hidden;
          
          span {
            width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }
    }
    .project-data-content {
      display: none;
    }

    .vn-stack-layer {
      flex: auto;
      width: 100%;
    }

    .project-data-slider,
    .project-data-content {
      height: 100%;
      overflow-y: scroll;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .project-data-slider {
      background-color: var(--bg-color-page);
      :deep(.el-collapse) {
        // --el-collapse-content-bg-color:var(--bg-color-overlay);
        --el-collapse-header-bg-color:var(--bg-color-overlay);
        --el-collapse-content-font-size: 12px;
        border-top: none;
        border-bottom: none;
        .el-collapse-item__header {
          height: 30px;
          padding-left: 17px;

          .connection-name {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            width: 100%;
            user-select: none;
          }
        }
        .el-collapse-item__wrap {
          border-bottom: none;
        }

        .el-collapse-item__content {
          padding-bottom: 0;

          .vn-stack-tab {
            line-height: 35px;
            cursor: pointer;
            padding-left: 17px;

            .table-name {
              height: 100%;
              margin-left: 20px;
              user-select: none;
              white-space: nowrap;
              text-overflow: ellipsis;
              overflow: hidden;
            }
            &.active{
              background-color: var(--el-color-primary-light-9);
              color: var(--color-primary);
            }
            &:hover {
              background-color: var(--bg-color-hover);
            }
          }
        }
      }
    }

    .project-data-content {
      background-color: var(--bg-color-page);

      .field {
        height: 29px;
        line-height: 29px;
        cursor: pointer;
        transition: 0.3s;
        user-select: none;
        color: var(--text-color-regular);
        border-bottom: 1px solid var(--border-color);

        &:hover {
          background-color: var(--field-item-hover-bg-color);
        }

        &.selected .field-alias {
          color:var(--color-white);
          background-color: var(--color-primary);
          transition: all .2s;

          span::before {
            content: "\e677";
            transform: rotate(-360deg);
            transition: transform .3s ease-in-out;
          }
        }
        &.editing .field-alias{
          background-color: var(--bg-color-overlay);
        }

        .field-alias {
          width: 100%;
          height: 100%;
          // color: var(--text-color-active);
          white-space: nowrap;
          user-select: none;
          transition: all .2s;
          cursor: var(--cursor-pointer);
          margin: 0;
          padding: 0 5px 0 20px;
          font-weight: normal;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;

          span {
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
            width: 100px;

            &.active {
              color: #0089ff;
            }

            &::before {
              display: inline-block;
              font-style: normal;
              font-variant: normal;
              text-rendering: auto;
              -webkit-font-smoothing: antialiased;
              font-family: "fs";
              font-weight: 900;
              font-size: 12px;
              padding: 2px 6px 2px 2px;
              content: "\e799";
              transition: transform .3s ease-in-out;
            }

          }
        }

        &.hide {
          display: none !important;
        }
      }
    }
  }

  input {
    background-color: transparent;
    height: 100%;
    width: 100%;
  }
}
</style>
<style lang="scss">
.nocode-project-data-fields-popover {
  padding: 0 !important;
  .fields {
    padding: var(--el-popover-padding);
    .empty {
      text-align: center;
    }
    .field {
      height: 29px;
      line-height: 29px;
      cursor: pointer;
      transition: 0.3s;
      user-select: none;
      color: var(--text-color-regular);

      &:hover {
        background-color: var(--bg-color-hover);
      }

      &.selected .field-alias {
        color:var(--color-white);
        background-color: var(--color-primary);
        transition: all .2s;

        span::before {
          content: "\e677";
          transform: rotate(-360deg);
          transition: transform .3s ease-in-out;
        }
      }
      &.editing .field-alias{
        background-color: #333333;
      }

      .field-alias {
        width: 100%;
        height: 100%;
        // color: var(--text-color-active);
        white-space: nowrap;
        user-select: none;
        transition: all .2s;
        cursor: var(--cursor-pointer);
        margin: 0;
        padding: 0 5px 0 10px;
        font-weight: normal;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;

        span {
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          width: 100px;

          &.active {
            color: #0089ff;
          }

          &::before {
            display: inline-block;
            font-style: normal;
            font-variant: normal;
            text-rendering: auto;
            -webkit-font-smoothing: antialiased;
            font-family: "fs";
            font-weight: 900;
            font-size: 12px;
            padding: 2px 6px 2px 2px;
            content: "\e799";
            transition: transform .3s ease-in-out;
          }

        }
      }

      &.hide {
        display: none !important;
      }
    }
  }
}
</style>
