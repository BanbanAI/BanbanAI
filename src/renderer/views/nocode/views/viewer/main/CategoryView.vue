<template>
  <div class="category-view">
    <el-container style="height: 100%; border: 1px solid #eee;display: flex; justify-content: space-between;">
      <el-aside width="300px">
        <div>
          <div class="aside-header">
            <div class="left">
              <el-icon size="18"><i-uil-list-ui-alt /></el-icon>
              <span>{{ $t('CategoryView.categoryList') }}</span>
            </div>

            <div class="right">
              <el-icon size="16">
                <i-ant-design-menu-unfold-outlined @click="handleExpandAll"/>
              </el-icon>
              <handle-menu
                v-if="rootNode"
                :node="rootNode"
                :treeData="treeData"
                :commandHandles="commandHandles"
                :isCategory="true"
              >
                <el-icon size="16">
                  <i-ep-plus />
                </el-icon>
              </handle-menu>
            </div>
          </div>
          <div class="all-button" :class="{active: isShowAll}" @click="getAllData">
            <div>{{ $t('CategoryView.all') }}</div>
            <div class="node-num">{{ totalNum ?? 0 }}</div>
          </div>
          <div class="aside-tree">
            <el-tree
              v-if="treeVisible"
              class="filter-tree"
              :data="treeData"
              ref="treeRef"
              @node-click="handleNodeClick"
              node-key="id"
              :expand-on-click-node="false"
              highlight-current
              :default-expanded-keys="expandedKeys"
              :draggable="true"
              @node-drag-start="handleDragStart"
              @node-drop="handleNodeDrop"
            >
              <template #default="{ node, data }">
                <div class="custom-tree-node" v-if="data.rename">
                  <el-input
                    v-model="data.label"
                    ref="inputRef"
                    :placeholder="$t('CategoryView.inputContent')"
                    size="small"
                    style="width: 220px;border-radius: 10px;"
                    @blur="(event) => handleRenameBlur(data)"
                    @keydown.enter="(event) => handleRenameBlur(data)"
                  ></el-input>
                </div>
                <span 
                  v-else 
                  class="custom-tree-node"
                >

                  <div class="node-left">
                    <div class="node-label" :title="data.label">{{ data.label }}</div>
                  </div>
                  <div class="node-num">{{ data.num ?? 0}}</div>
                  <div class="node-handle" @click.stop>
                    <handle-menu 
                      :node="node" 
                      :treeData="treeData" 
                      v-model:iconVisible="iconVisible"
                      :commandHandles="commandHandles" 
                      @handleMouseLeave="handleMouseLeave"
                      :isCategory="true"
                    >
                      <el-icon style="transform: rotate(90deg); transform-origin: center; ">
                        <i-ep-more-filled />
                      </el-icon>
                    </handle-menu>
                  </div>
                </span>
              </template>

            </el-tree>
          </div>
        </div>
      </el-aside>
      <el-container>
        <div style="width: 100%; height: 100%; padding: 16px; border-left: 1px solid var(--border-color);">
          <NocodeDataManagementTable
            v-if="isShowTable"
            :active="props.active"
            :nocodeId="nocode.meta?.id"
            :tableUID="table.uid"
            :uid="currentTOC?.uid"
            :viewId="currentTOC?.uid"
            :actions="currentTOC?.actions || []"
            :preFilterRule="preFilterRule"
            :preViewFilterRules="currentViewFilterRules"
            :preHiddenColumns="currentTOC?.hiddenColumns"
            :preColumnOrders="currentTOC?.columnOrders"
            :enableShareLinkColumn="true"
            @changeRows="changeRows"
            @submitted="handleSubmitted"
          />
        </div>
      </el-container>
    </el-container>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, ref, watch, reactive  } from 'vue';
import { CatalogViewSetting, FilterRule, LogicalOperator } from '@common/types/nocode';
import { useFormData, useFormTable, providePreRow } from '../../editor/form/hooks';
import { NOCODE } from '@renderer/types';
import axios from "axios"
import { CommandHandles, CustomNodeData, TreeNode } from './catalogView/type';
import { Bucket, Connection, QueryOptions, Row, Table, TableUID, OptionFieldUID } from '@common/types/project';
import { ElMessage } from 'element-plus';
import { unique } from "@common/utils/unique";
import { isSystemField, SystemField } from '@common/utils/connection';
import { RuleFunc } from '@common/types/nocode';
import { DeleteConfirmContext } from './NocodePageView.vue';
import { FormMode } from '@renderer/views/nocode/components/global/table/types';
import NocodeDataManagementTable from '../../../components/global/table/NocodeDataManagementTable.vue';
import i18next from 'i18next';
import { getNocodeDataSourceTableByUID } from '@common/utils/connection';
import { formDataApi } from '@renderer/utils/api';

type TableInfoResData = {
  bucket: Bucket,
  connection: Connection,
  rows: Row[]
}

type TableInfo = {
  tableId: TableUID,
  table: Table,
  promise: Promise<any>,
  data: TableInfoResData
}

const props = defineProps<{
  active: boolean,
  currentTOC: CatalogViewSetting
}>();

const treeData = ref()
const nocode = inject(NOCODE);
const connection = useFormData();
const table = useFormTable();
const nocodeId = nocode.value.meta.id;
const parentField = table.value.fields.find((field) => field.uid === props.currentTOC.catalogFieldUID);
const catalogTable = getNocodeDataSourceTableByUID(nocode.value.body, parentField.meta.extra.relatedTableUID[1], {
  nocodeId,
}, true)?.table;
const catalogTitleField = catalogTable.fields.find((field) => field.uid === props.currentTOC.catalogTitleFieldUID);
const catalogUuidField = catalogTable.fields.find((field) => field.meta.name === SystemField.UUID);
const catalogSortField = catalogTable.fields.find((field) => field.meta.name === SystemField.SORT);
const catalogParentField = catalogTable.fields.find((field) => field.meta.subType === 'related' && field.meta.extra.relatedTableUID[1] === catalogTable.uid);
const titleField = table.value.fields.find((field) => field.uid === props.currentTOC.titleFieldUID);
const uuidField = table.value.fields.find((field) => field.meta.name === SystemField.UUID);
const sortField = table.value.fields.find((field) => field.meta.name === SystemField.SORT);
const catalogSubFormField = catalogTable.fields.find((field) => field.meta.subType === 'subForm');
const subFormField = table.value.fields.find((field) => field.meta.subType === 'subForm');
const expandedKeys = ref([])
const iconVisible = ref(true)
const treeDraggable = ref<boolean>(true)
const uuid = ref('')
const treeRef = ref(null)
const inputRef = ref(null)
const subFormTable = subFormField ? getNocodeDataSourceTableByUID(nocode.value.body, subFormField.meta.extra.subTableUID[1], {
  nocodeId,
}, true)?.table : null;
const subFormUuidField = subFormTable && subFormTable.fields.find((field) => field.meta.name === SystemField.UUID);
const subFormRelatedDataIdField = subFormTable && subFormTable.fields.find(item => item.meta.name === '_key');
const setDeleteConfirmDialog: Function = inject('setDeleteConfirmDialog')
const rootNode = ref<TreeNode>()
const isShowAll = ref(true)
const totalNum = ref(0)
const preRow = reactive<Row>({});
const isShowTable = ref(false)

const refreshTree = async () => {
  const catalogTableInfo = {
    tableId: catalogTable.uid,
    table: catalogTable,
    promise: null,
    data: null
  };

  const promiseAll = [
    axios.get('nocode/read-form-list', {
      params: {
        nocodeId: nocodeId,
        connectionId: connection.value.uid,
        tableId: catalogTableInfo.tableId,
      }
    }),
    // 总数
    formDataApi.distinctCount({
      nocodeId: nocodeId,
      tableUID: table.value.uid,
      columnId: uuidField.uid,
    }),
    // 分类数量
    formDataApi.distinctCount({
      nocodeId: nocodeId,
      tableUID: table.value.uid,
      columnId: props.currentTOC.catalogFieldUID,
    }),
  ];
  const [catalogRes, totalArr, catelogArr] = await Promise.all(promiseAll);
  totalNum.value = (totalArr ?? []).length;
  const catalogNumMap = (catelogArr ?? []).reduce((map, item) => {
    map[item.value] = item.count;
    return map;
  }, {})
  catalogTableInfo.data = catalogRes.data
  const items = catalogTableInfo.data.rows.map(item => {
    return {
      row: { ...item },
      label: item[catalogTitleField.uid],
      id: item[catalogUuidField.uid],
      parentIds: catalogParentField ? item[catalogParentField.uid] : [],
      sort: item[catalogSortField.uid] || 0,
      tableId: catalogTable.uid,
      type: 'catalog' as 'catalog',
      hover: false,
      rename: false,
      num: catalogNumMap[item[catalogUuidField.uid]] ?? 0,
    }
  })
  treeData.value = buildTree(items)
  // 默认展开所有第一级的菜单
  treeData.value.forEach(item => {
    expandedKeys.value.push(item.id)
  })
}

const sortTree = (nodes) => {
  nodes?.sort((a, b) => a.sort - b.sort);
  nodes?.forEach(node => {
    if (node.children && node.children.length > 0) {
      sortTree(node.children);
    }
  });
}

const buildTree = (items) => {
  const idMap = items.reduce((map, item) => {
    map[item.id] = { ...item, children: [], sort: item.sort || 0 };
    return map;
  }, {});

  const tree = [];
  items.forEach(item => {
    const node = idMap[item.id];
    // todo  ids
    if (item.parentIds[0] === undefined || item.parentIds[0] === null) {
      tree.push(node);
    } else {
      idMap[item.parentIds[0]].children.push(node);
    }
  });
  sortTree(tree);

  return tree;
}

watch(() => props.active, (value) => {
  if (!value) return;
  isShowTable.value = true;
  refreshTree();
}, { immediate: true })

const preFilterRule = reactive<FilterRule>({
  logic: LogicalOperator.AND,
  conditions: []
});
const currentViewFilterRules = computed<FilterRule[] | undefined>(() => {
  const filterRules = props.currentTOC?.viewFilterRules;
  if (!filterRules?.conditions?.length) {
    return undefined;
  }
  return [filterRules];
});

const changeRows = (newVal) => {
  if(!newVal) return
  refreshTree()
}
const handleSubmitted = (value: FormMode) => {
  refreshTree()
}

const handleNodeClick = (node) => {
  preFilterRule.conditions = [
    {
      uid: props.currentTOC.catalogFieldUID,
      func: RuleFunc.EQUAL,
      value: node.id,
    }
  ]
  preRow[props.currentTOC.catalogFieldUID] = [node.id];
  isShowAll.value = false
}

const getAllData = () => {
  preFilterRule.conditions.length = 0;
  treeRef.value.setCurrentKey(null)
  isShowAll.value = true
}

let treeVisible = ref(true)

const handleExpandAll = async () => {
  // 获取所有节点的 key
  if (expandedKeys.value.length === 0) {
    treeVisible.value = false
    await nextTick()
    expandedKeys.value = getAllNodeKeys(treeData.value)
    treeVisible.value = true
  } else {
    treeVisible.value = false;
    await nextTick()
    treeVisible.value = true
    expandedKeys.value = []

  }
}

const getAllNodeKeys = (nodes) => {
  let keys = []
  nodes?.forEach(node => {
    keys.push(node.id)
    if (node.children) {
      keys = keys.concat(getAllNodeKeys(node.children))
    }
  })
  return keys
}

const originalStates = ref({});

const handleDragStart = (draggingNode) => {
  // 获取拖拽节点及其同级节点
  const parentNode = draggingNode.parent;
  const siblings = parentNode ? parentNode.childNodes : [draggingNode];

  // 记录每个节点的原始 sort 和 parentId
  originalStates.value = siblings.reduce((acc, node) => {
    acc[node.data.id] = {
      sort: node.data.sort || 0,
      parentId: node.data.parentIds?.[0] || null
    };
    return acc;
  }, {});
};

const flattenTree = (nodes, parentId = null) => {
  let result = [];

  nodes.forEach(node => {
    const item = {
      ...node
    };

    result.push(item);

    if (node.children && node.children.length > 0) {
      result = result.concat(flattenTree(node.children, node.id));
    }
  });

  return result;
}

const handleNodeDrop = async (draggingNode, dropNode, dropType) => {
  let newParentId;
  if (dropType === 'inner') {
    newParentId = dropNode.data.id;
  } else {
    newParentId = dropNode.data.parentIds?.[0] || null;
  }

  draggingNode.data.parentIds = newParentId ? [newParentId] : [];

  const newParentNode = dropType === 'inner' ? dropNode : dropNode.parent;
  const siblings = newParentNode ? newParentNode.childNodes : [draggingNode];

  const dragIndex = siblings.findIndex(node => node.data.id === draggingNode.data.id);

  const prevNode = siblings[dragIndex - 1]?.data; // 前一个节点
  const nextNode = siblings[dragIndex + 1]?.data; // 后一个节点
  let newDragSort;

  if (!prevNode && !nextNode) {
    newDragSort = draggingNode.data.sort || 0;
  } else if (!prevNode) {
    newDragSort = (nextNode.sort || 0) - 1;
  } else if (!nextNode) {
    newDragSort = (prevNode.sort || 0) + 1;
  } else {
    const prevSort = prevNode.sort || 0;
    const nextSort = nextNode.sort || 0;

    if (prevSort < nextSort) {
      newDragSort = (prevSort + nextSort) / 2;
    } else {
      nextNode.sort = prevSort + 1;
      newDragSort = prevSort + 0.5;
    }
  }

  draggingNode.data.sort = newDragSort;
  const flatNodes = flattenTree(treeData.value);
  const changedNodes = flatNodes.filter(node => {
    const original = originalStates.value[node.id];
    if (!original) return false;
    return (original.parentId !== (node.parentIds?.[0] || null)) ||
      (original.sort !== node.sort);
  });
  const parentTableId = changedNodes.filter(item => item.tableId === catalogTable.uid).map(item => {
    item.row[catalogParentField.uid] = item.parentIds[0] ? item.parentIds : []
    item.row[catalogUuidField.uid] = item.id
    item.row[catalogSortField.uid] = item.sort
    return {
      [catalogParentField.uid]: item.row[catalogParentField.uid],
      [catalogUuidField.uid]: item.row[catalogUuidField.uid],
      [catalogSortField.uid]: item.row[catalogSortField.uid],
    }
  })
  const childrenId = changedNodes.filter(item => item.tableId === table.value.uid).map(item => {
    item.row[parentField.uid] = item.parentIds[0] ? item.parentIds : []
    item.row[uuidField.uid] = item.id
    item.row[sortField.uid] = item.sort
    return {
      [parentField.uid]: item.row[parentField.uid],
      [uuidField.uid]: item.row[uuidField.uid],
      [sortField.uid]: item.row[sortField.uid],
    }
  })
  const parentFormData = {
    nocodeId: nocodeId,
    rows: parentTableId,
    tableUID: catalogTable.uid,
  }

  const childrenFormData = {
    nocodeId: nocodeId,
    rows: childrenId,
    tableUID: table.value.uid,
  }
  try {
    if (parentTableId.length > 0) {
      await axios.post(`form-data/update-sort-data`, {
        ...parentFormData
      });
    }
    if (childrenId.length) {
      await axios.post(`form-data/update-sort-data`, {
        ...childrenFormData
      });
    }
    dropNode.expanded = true;
  } catch (error) {
    console.error(i18next.t('CategoryView.saveFail'), error);
  }
};

const handleMouseLeave = (data) => {
  if (iconVisible.value) {
    data.hover = false
  }
}

const updateFormRow = async(formId: TableUID, rows: Row[]) => {
  const res = await axios.post(`/form-data/form/update/${nocodeId}/${formId}`, { rows }).then(res => {
    ElMessage.success(i18next.t('CategoryView.editSuccess'));
    return res;
  }).catch(err => {
    console.error(err);
    ElMessage.error(i18next.t('CategoryView.saveFail'));
    return err;
  })
  return res;
}

const refreshContentContainer = () => {
  const uuidT = uuid.value;
  uuid.value = '';
  nextTick(() => {
    uuid.value = uuidT;
  })
  return uuidT;
}

const handleRenameBlur = async (data: CustomNodeData) => {
  let originalRow: Row = {};
  const typeUidMap = {
    document: [uuidField.uid, titleField.uid],
    catalog: [catalogUuidField.uid, catalogTitleField.uid]
  }
  originalRow[typeUidMap[data.type][0]] = data.id;
  originalRow[typeUidMap[data.type][1]] = data.label;
  // 重命名保存请求
  const res = await updateFormRow(data.tableId, [originalRow]);
  data.rename = false;
  treeDraggable.value = true;
  data.row = res.data.bucket.rows[0];
  refreshContentContainer();
}

const commandHandles = computed<CommandHandles>(() => ({
  addCatalog
  ,addDocument
  ,copyNode
  ,renameNode
  ,deleteNode
}));

const deleteNode = (data: CustomNodeData, node: TreeNode) => {
  const textMap = {
    document: {
      text: i18next.t('CategoryView.confirmDelDoc'),
      tip: i18next.t('CategoryView.delDocWarn')
    },
    catalog: {
      text: i18next.t('CategoryView.confirmDelCate'),
      tip: i18next.t('CategoryView.delCateWarn')
    }
  }
  const deleteConfirmContext: DeleteConfirmContext = {
    text: textMap[data.type].text,
    tip: textMap[data.type].tip,
    visible: true,
    confirm: () => { _deleteNode(data, node) }
  };
  setDeleteConfirmDialog(deleteConfirmContext)
}

const getFormList = async () => {
  const selfTable: TableInfo = {
    tableId: table.value.uid,
    table: table.value,
    promise: null,
    data: null
  };
  try {
    const res = await axios.get(`nocode/read-form-list`, {
      params: {
        nocodeId: nocodeId,
        connectionId: connection.value.uid,
        tableId: selfTable.tableId,
      }
    });
    if (!res.data) return [];
    return res.data.rows.map((item) => {
      return {
        row: { ...item },
        id: item[uuidField.uid],
        parentIds: item[parentField.uid],
        type: 'document' as 'document',
      }
    })
  } catch (error) {
    console.error('Failed to get form list', error);
    return [];
  }
}

const deleteFormRow = async(formId: TableUID, rows: Row[]) => {
  const res = await axios.post(`/form-data/form/delete/${nocodeId}/${formId}`, { rows }).then(res => {
    ElMessage.success(i18next.t('CategoryView.deleteSuccess'));
  }).catch(err => {
    console.error(err)
    return err;
  })
  return res;
}

const _deleteNode = async(data: CustomNodeData, node: TreeNode) => {
  const typeUidMap = {
    document: [uuidField.uid, titleField.uid],
    catalog: [catalogUuidField.uid, catalogTitleField.uid]
  }
  const documents = await getFormList();
  // 递归删除所有children
  const dn = (data: CustomNodeData) => {
    let p = [];
    if (data.children && data.children.length > 0) {
      for (const iterator of data.children) {
        p = p.concat(dn(iterator));
      }
    }
    
    // 删除文档
    const delDocuments = documents.filter(item => item.parentIds?.[0] === data.id);
    delDocuments.forEach(item => {
      const documentRow: Row = {};
      documentRow[typeUidMap.document[0]] = item.id;
      p.push(deleteFormRow(table.value.uid, [documentRow]));
    });

    let originalRow: Row = {};
    originalRow[typeUidMap[data.type][0]] = data.id;
    p.push(deleteFormRow(data.tableId, [originalRow]));
    return p;
  }
  const deletePromiseArr = dn(data);
  await Promise.all(deletePromiseArr);
  treeRef.value.remove(node);
  uuid.value = '';
}

const createFormRow = async(formId: TableUID, rows: Row[]) => {
  const res = await axios.post(`/form-data/form/create/${nocodeId}/${formId}`, { rows }).then(res => {
    ElMessage.success(i18next.t('CategoryView.createSuccess'));
    return res;
  }).catch(err => {
    console.error(err);
    return err;
  })
  return res;
}

const addCatalog = async(data?: CustomNodeData, node?: TreeNode) => {
  node.expanded = true;
  let label: string = i18next.t('CategoryView.unnamedCatalog');
  let parentIds: string[] = data.id ? [data.id] : [];
  const row = {
    [catalogTitleField.uid]: label,
    [catalogParentField.uid]: parentIds,
    [catalogSortField.uid]: (data.children?.at(-1)?.sort || -1) + 1,
  };
  if (catalogSubFormField) {
    row[catalogSubFormField.uid] = [];
  }
  const res = await createFormRow(catalogTable.uid, [row]);
  const rowData = res.data.rows[0];
  // 组装新节点的nodeData
  const newNodeData: CustomNodeData = {
    row: { ...rowData },
    label: rowData[catalogTitleField.uid],
    id: rowData[catalogUuidField.uid],
    parentIds: rowData[catalogParentField.uid],
    sort: rowData[catalogSortField.uid] || 0,
    tableId: catalogTable.uid,
    type: 'catalog',
    hover: false,
    rename: false,
    num: 0,
  }
  treeRef.value.append(newNodeData, node);
  renameNode(newNodeData);
}

const addDocument = async(data: CustomNodeData, node: TreeNode, row?: Row) => {
  // 实现添加文档的逻辑
  let label: string = i18next.t('CategoryView.unnamedDoc');
  let parentIds: string[] = data.id ? [data.id] : [];
  let newRow: Row = {
    [titleField.uid]: label,
    [parentField.uid]: parentIds,
    [sortField.uid]: (data.children.at(-1)?.sort ?? -1) + 1,
  };
  if (row) newRow = { ...newRow, ...row };
  if (subFormField) {
    newRow[subFormField.uid] = row?.[subFormField.uid] || [];
  }
  const res = await createFormRow(table.value.uid, [newRow]);
  const rowData = res.data.rows[0];
  const newNodeData: CustomNodeData = {
    row: { ...rowData },
    label: rowData[titleField.uid],
    id: rowData[uuidField.uid],
    parentIds: rowData[parentField.uid],
    sort: rowData[sortField.uid],
    tableId: table.value.uid,
    type: 'document',
    hover: false,
    rename: false
  }
  let referNodeIndex: number = node.childNodes.findIndex(item => item.data.sort > newNodeData.sort);
  if (referNodeIndex === -1) {
    treeRef.value.append(newNodeData, node);
  } else {
    treeRef.value.insertBefore(newNodeData, node.childNodes[referNodeIndex]);
  }
  treeRef.value.setCurrentKey(newNodeData.id);
  uuid.value = newNodeData.id;
  // isViewing.value = false;
}

const getFormData = async(formId: TableUID, options: QueryOptions) => {
  const res = await axios.post('/form-data/get', {
    nocodeId: nocodeId,
    tableUIDs: [formId],
    options
  }).then(res => {
    return res;
  }).catch(err => {
    console.error(err)
    return err;
  })
  return res;
}

const getSubFormData = async(relatedDataId: string) => {
  let filters = {
    [subFormTable.uid]: [
      { [subFormRelatedDataIdField.uid]: { '$in': [relatedDataId] } }
    ]
  };
  const res = await getFormData(subFormTable.uid, { filters });
  return res.data[0].rows;
}

const copyNode = async(data: CustomNodeData, node: TreeNode) => {
  const parentNode = node.parent;
  let sort = data.sort + 1;
  if (node.nextSibling) {
    sort = (node.data.sort + node.nextSibling.data.sort) / 2;
  }
  let newRow: Row = {
    [uuidField.uid]: unique() // 新的子表单数据需要指定父表的uuid
  };
  for (const field of table.value.fields) {
    if (isSystemField(field)) continue;

    if(field.meta.subType === 'subForm'){
      // 填充子表单数据，
      data.row[field.uid] = await getSubFormData(data.row[uuidField.uid]);
      newRow[field.uid] = data.row[field.uid].map((item: Row) => ({
        ...item,
        [subFormUuidField.uid]: undefined,  // 拷贝的子表单数据为新数据，uuid置空
        [subFormRelatedDataIdField.uid]: newRow[uuidField.uid], // 关联数据ID字段值指定为新节点的uuid
      }));
      continue;
    }
    newRow[field.uid] = data.row[field.uid];
  }
  newRow = {
    ...newRow,
    [sortField.uid]: sort,
  }
  addDocument(parentNode.data as CustomNodeData, parentNode, newRow);
}

const renameNode = (data: CustomNodeData, node?: TreeNode) => {
  data.rename = true;
  treeDraggable.value = false;
  nextTick(() => {
    inputRef.value.focus();
    inputRef.value.select();
  })
}

watch(() => treeData.value, (newVal: CustomNodeData[]) => { 
  nextTick(() => {  
    if (!Array.isArray(treeData.value.data) || treeData.value.data.length === 0) return;  
    const node = treeRef.value.getNode((treeRef.value.data as CustomNodeData[])[0].id); 
    rootNode.value = node.parent; 
  })  
})  

providePreRow(preRow);
</script>

<style scoped lang="scss">
.category-view {
  display: flex;
  height: 100%;
  background-color: var(--bg-color-page);
}

.aside-tree {
  padding: 0 8px;
}

:deep(.el-tree) {
  --hover-color: #F5F6F7;

  .el-tree-node.is-current > .el-tree-node__content {
    background-color: var(--el-color-primary-light-9) !important;
  }

  .el-tree-node:focus > .el-tree-node__content {
    background-color: unset;
  }

  .el-tree-node {
    overflow: hidden;

    .el-tree-node__content {
      transition: all 0.3s ease;
    }

    .el-tree-node__content .custom-tree-node {
      max-width: 100%;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 400;
      padding: 0px 8px 0px 0px;
      font-size: 14px;
      color: #373737;
      height: 32px;
      font-family: "PingFangSC-Regular", "din", "Microsoft Yahei", "Arial", "Helvetica Neue", "Helvetica", sans-serif;

      .node-left {
        display: flex;
        align-items: baseline;
        max-width: 90%;
        overflow: hidden;
        white-space: nowrap;
      }

      .node-arrow {
        position: relative;
        left: -2px;
      }

      .node-label {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .node-num {
        margin-left: auto;
        font-size: 12px;
        color: gray;
        padding: 0px 6px 0px 0px;
      }

      .node-handle {
        margin-left: auto;
        transition: all 0.3s ease;
        display: none;
        gap: 8px;
        align-items: center; 
      }

      &:hover {
        .node-handle {
          display: flex;
        }

        .node-num {
          display: none;
        }
      }
    }

    &.document-node {

      &.active,
      &:focus>.el-tree-node__content {
        background-color: var(--hover-color);

        .custom-tree-node {
          font-weight: 800;
        }
      }
    }

    &.catalog-node:focus>.el-tree-node__content {
      background-color: transparent;
    }

    .el-tree-node__content {
      padding: 14px 0;
      height: 32px;

      // .el-tree-node__expand-icon {
      //   display: none;
      // }

      &:hover {
        background-color: var(--hover-color) !important;
      }
    }
  }
}

:deep(.el-tooltip__trigger:focus-visible) {
  outline: unset;
}

.aside-header {
  display: flex;
  padding: 12px;
  justify-content: space-between;

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .left {
    font-weight: 400;
    font-size: 16px;
    color: #141414;
  }

  .right {
    .el-icon {
      cursor: var(--cursor-pointer);
    }
  }
}

.all-button {
  display: block;
  margin: 0px 8px;
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0px 8px 0px 24px;
  font-size: 14px;
  font-size: 14px;
  font-family: "PingFangSC-Regular", "din", "Microsoft Yahei", "Arial", "Helvetica Neue", "Helvetica", sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  color: var(--text-color-regular);

  &:hover {
    background-color: var(--bg-color-overlay);
  }

  &.active {
    background-color: var(--color-primary-light-9);
  }

  .node-num {
    margin-left: auto;
    padding: 0px 6px 0px 0px;
  }
}
</style>
