<template>
  <div class="table-option-input" :class="{ over: isOver }" @dragover.prevent.stop="handleDragOver"
    @dragenter.prevent.stop="handleDragEnter" @dragleave.prevent.stop="handleDragLeave" @drop.prevent="handleDrop">
    <span class="table-option-placeholder" v-if="!tables?.length">{{ $t("tableOption.axisPlaceholder") }}</span>
    <template v-else>
      <template v-for="(table, index) in tables" :key="table.uid[1]">
        <div :class="{ dropzone: true, active: index === drop_index }"></div>
        <div class="table" :class="{
          dragging: dragging_index === index,
          error: tableErrorMessages[index]?.type === 'error' || activeElement.getTableAlias(table.uid) === '',
          warning: tableErrorMessages[index]?.type === 'warning',
        }" draggable="true" @dragstart.stop="handleTableDragStart($event, index)" @dragend="handleTableDragEnd">
          <div :class="['table-name', { lost: !activeElement.getTableAlias(table.uid) }]" :title="tableErrorMessages[index]?.message ?? ''">{{ activeElement.getTableAlias(table.uid) || $t('FieldOption.dataSourceLost') }}</div>
            <i class="fs fs-remove" @click="handleRemove(table, index)"></i>
      </div>
      </template>
      <div :class="{ dropzone: true, active: drop_index >= tables.length }"></div>
    </template>
  </div>
</template>


<script lang="ts" setup>
import { ref, inject, computed, watch, toRaw, onUnmounted, onMounted } from 'vue';
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { ACTIVE_ELEMENT, ACTIVE_FIELD_OPTION, DELETED_TABLES_UID, FIELD_OPTION_CONTEXTS } from '@renderer/types';
import { OptionTableUID } from '@common/types/project';
import { DefinedOptionWithParsedType, OptionTableValue } from '../types';
import { ElMessage } from 'element-plus';
import { Table } from '@common/types/project';
import { equals } from '@common/utils/object';
import { ComputedRef } from 'vue';
import i18next from 'i18next';

type TableErrorMessage = {
  message: string,
  type: "warning" | "error",
};

const props = defineProps<{
  option: DefinedOptionWithParsedType,
  paths: string[],
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const activeTableOption = inject(ACTIVE_FIELD_OPTION);
const tableOptionContexts = inject(FIELD_OPTION_CONTEXTS);
const deletedTablesUid = inject(DELETED_TABLES_UID);
const activeElement = inject(ACTIVE_ELEMENT);


let contextId;
let drop_index = ref(-1);
const isOver = ref(false);
const dragging_index = ref(-1);  // 内部field在拖拽时的 index
const dragFromOutside = computed(() => dragging_index.value === -1);

// 删除使用的数据字段
const handleRemove = (table: OptionTableValue, index: number) => {
  const _tables = toRaw(tables.value).filter((item, i) => !(item.uid[1] == table.uid[1] && index === i))
  updateOption(_tables);
  removeError();
}


// 判断当前field是否达到上限
const isUpperLimit = () => {
  if (props.option.args) {
    const max = Number(props.option.args?.max) ?? Infinity;
    if (max <= tables.value.length) {
      return true;
    }
  }
  return false;
}

const addTable = (uid: OptionTableUID, table: Table) => {
  let tableOptions: OptionTableValue[] = getOptionValue() || [];
  if (isUpperLimit()) {
    ElMessage.warning(i18next.t("tableOption.fieldsTypeLimit"));
    restoreDefault();
    return false;
  }
  
  tableOptions.push({ uid, __opt_type: 'table' });
  updateOption(tableOptions);
  return true;
}

const removeTable = (uid: OptionTableUID) => {
  let tableOptions = tables.value || [];
  const index = tableOptions.findIndex(item => item.uid[1] === uid[1]);
  tableOptions.splice(index, 1);
  updateOption(tableOptions);
  removeError();
  return true;
}

// 拖拽进入
const handleDragEnter = (ev) => {
  if (ev.fromElement?.classList?.contains("dragging") && ev.target.classList.contains("field-option-input")
    || ev.fromElement?.classList?.contains("field-option-input") && ev.target.classList.contains("dragging")
  ) {
    return;
  }
  isOver.value = true;
  drop_index.value = -1;
  activeTableOption.value = tableOptionContexts.value[contextId];
}


// 拖拽离开
const handleDragLeave = (ev) => {
  if (ev.fromElement?.classList?.contains("dragging") && ev.target.classList.contains("field-option-input")
    || ev.fromElement?.classList?.contains("field-option-input") && ev.target.classList.contains("dragging")
  ) {
    return;
  }
  if (dragFromOutside.value) {
    isOver.value = false;
  }
  drop_index.value = -1;
  activeTableOption.value = {};
}

const handleDragOver = (ev: DragEvent) => {
  drop_index.value = parseInt((ev.layerY / 25).toString());
}

const handleDrop = (ev: DragEvent) => {
  const dragType = ev.dataTransfer.getData("drag-table-type");
  if (dragType === "TableOptionDrag") {
    let _tables = tables.value || [];
    if (dragFromOutside.value) {
      // 从一个 TableOption 拖拽到另外一个 TableOption
      try {
        const dragTable = JSON.parse(ev.dataTransfer.getData("drag-data") ?? "{}").table;
        addTable(dragTable.uid, dragTable);
      } catch (error) {
        console.error(error);
        return;
      }
      
    } else {
      // 在同一个 TableOption 中拖拽
      const dragTable = _tables[dragging_index.value];
      _tables.splice(drop_index.value, 0, dragTable);
      if (dragging_index.value > drop_index.value) {
        _tables.splice(dragging_index.value + 1, 1);
      } else {
        _tables.splice(dragging_index.value, 1);
      }
      updateOption(toRaw(_tables));
    }
    restoreDefault();
  } else if (dragType === "ProjectDataDragTable") {
    try {
      const tableData = JSON.parse(ev.dataTransfer.getData("drag-table-data") ?? "{}");
      if (!tableData?.table) {
        ElMessage.error(i18next.t('tableOption.pleaseDragTable'));
        return restoreDefault()
      }
      addTable(tableData.tableUID, tableData.table);
    } catch (error) {
      console.error(error);
      return;
    }
    restoreDefault();
  }
}

// 开始跨 TableOption 组件拖拽
const handleTableDragStart = (ev: DragEvent, index: number) => {
  ev.dataTransfer.setData("drag-table-type", "TableOptionDrag");
  ev.dataTransfer.setData("drag-data", JSON.stringify({ table: tables.value[index] }));
  dragging_index.value = index;
  isOver.value = true;
}

const handleTableDragEnd = (ev: DragEvent) => {
  // 如果是跨 TableOption 组件拖拽并且字段被拖到了外面，则在 DragEnd 回调中删除它
  if (!dragFromOutside.value && drop_index.value < 0) {
    removeTable(tables.value[dragging_index.value].uid);
  }
}

// 恢复默认
const restoreDefault = () => {
  drop_index.value = -1;
  isOver.value = false;
  dragging_index.value = -1;
  activeTableOption.value = {};
}

const tables = computed<OptionTableValue[]>(() => {
  return getOptionValue() || [];
});

const tableErrorMessages: ComputedRef<TableErrorMessage[]> = computed(() => {
  const errorMessages: TableErrorMessage[] = []
  for (const table of tables.value) {
    let errorMessage: TableErrorMessage;
    if (deletedTablesUid.value.includes(tables.value[0].uid[1])) {
      errorMessage = {
        message: i18next.t("axisNotFound"),
        type: "error",
      };
    } else {
      errorMessage = checkMultiFiledError(table.uid);
    }
    if (errorMessage) {
      errorMessages.push(errorMessage);
    }
  }
  return errorMessages;
});

const checkMultiFiledError = (uid: OptionTableUID): TableErrorMessage => {
  if (!activeElement.value.status.error.data) {
    return;
  }
  const errorInfos = activeElement.value.status.error.data.filter(val => {
    return val.type === "multi-filed-error";
  });
  if (errorInfos.length === 0) {
    return;
  }
  let pathKey = props.paths.slice(0,props.paths.length-1).join();
  let errorInfo = errorInfos.find(val => {
    return val.key === pathKey;
  });
  if (!errorInfo) {
    //未根据pathKey找到的，走默认key
    errorInfo = errorInfos.find(val => {
      return val.key === undefined;
    });
  }
  if (!errorInfo) {
    return;
  }
  const errorDataTableUIDs = errorInfo.data;
  const tableUID = [uid[0], uid[1]];
  const firstErrorTableUID = [errorDataTableUIDs[0][0], errorDataTableUIDs[0][1]];
  const isFirst = equals(tableUID, firstErrorTableUID);
  return {
    type: isFirst ? "warning" : "error",
    message: i18next.t("axisMultiFiledTitle"),
  };
}

const removeError = () => {
  if(!activeElement.value.status.error.data) return;
  const errorInfos = activeElement.value.status.error.data.filter(val => {
    return val.type === "multi-filed-error";
  });
  if(errorInfos.length === 0) return;
  const pathKey = props.paths.slice(0,props.paths.length-1).join();
  let index = errorInfos.findIndex(val => {
    return val.key === pathKey;
  });
  if(index === -1){
    //未根据pathKey找到的，走默认key
    index = errorInfos.findIndex(val => {
      return val.key === undefined;
    });
  }
  if(index > -1){
    activeElement.value.status.error.data.splice(index, 1);
  }
}

watch(() => tables.value.length, () => {
  restoreDefault();
});

const getTables = () => tables.value;

onMounted(() => {
  contextId = Object.values(tableOptionContexts.value).length;
  tableOptionContexts.value[contextId] = {
    getTables,
    addTable,
    removeTable,
  }
});

onUnmounted(() => {
  delete tableOptionContexts.value[contextId];
})
</script>

<style lang="scss" scoped>
.option-group-item {
  .table-option-input {
    border: 1px dashed var(--border-color);
    border-radius: 2px;
    min-height: 25px;
    position: relative;
    padding: 3px 5px;
    flex: 1;
    border: 1px var(--el-border-color) solid;

    .dropzone {
      width: 100%;
      height: 1px;
      background-color: transparent;
      margin: 1px 0;

      &.active {
        background-color: #0089ff;
      }
    }

    &.over {
      border: 1px dashed #0089ff;

      * {
        pointer-events: none;
      }
    }

    .table-option-placeholder {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      color: #ccc;
      line-height: 25px;
      text-indent: 10px;
      pointer-events: none;
    }

    .table {
      height: 25px;
      line-height: 25px;
      background-color: var(--bg-color-overlay);
      border: 1px solid var(--border-color);
      border-radius: 5px;
      margin-top: 1px;
      text-indent: 5px;
      display: flex;
      position: relative;
      padding-right: 4px;
      color: var(--text-color-regular);

      &.dragging {
        pointer-events: all;
      }

      &.error {
        border: 1px solid var(--color-danger);
      }
      &.warning {
        border: 1px solid var(--el-color-warning);
      }

      .table-name {
        max-width: 148px;
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        
        &.lost {
          color: red;
        }
      }


      :deep(.el-dropdown) {
        display: flex;
        align-items: center;
        cursor: pointer;
      }

      .fs-remove {
        font-size: 12px;
        cursor: pointer;
        margin-left: 2px;
      }
    }
  }
}
</style>
