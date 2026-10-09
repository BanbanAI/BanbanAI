<template>
  <div class="export-data-dialog">
    <el-dialog v-model="dialogVisibleComp" width="680px" :close-on-click-modal="false" draggable :title="$t('ExportDataDialog.exportExcel')"
      :before-close="handleCloseExportDialog" align-center
    >
      <div class="dialog-content">
        <div class="dialog-body">
          <div v-if="isExportCompleted === false">
            <div class="export-uncomplete-container" v-loading="exportLoading">
              <div class="search-box">
                <el-input
                  v-model="searchVal"
                  :placeholder="$t('ExportDataDialog.searchKeyword')"
                  :prefix-icon="Search"
                />
              </div>
              <el-checkbox :model-value="isAllSelected" @update:model-value="toggleSelectAll" :label="$t('ExportDataDialog.selectAll')" />
              <div class="field-list">
                <el-tree
                  ref="fieldTreeRef"
                  :data="treeFields"
                  show-checkbox
                  node-key="uid"
                  :props="treeProps"
                  @check="handleTreeCheck"
                  :filter-node-method="filterTreeNodes"
                  :default-expand-all="true"
                  draggable
                  :allow-drag="allowDrag"
                  :allow-drop="allowDrop"
                >
                  <template #default="{ node, data }">
                    <span class="custom-tree-node">
                      <span>{{ data.alias }}</span>
                    </span>
                  </template>
                </el-tree>
              </div>
            </div>
          </div>

          <div v-if="isExportCompleted === true">
            <div class="export-complete-container">
              <div class="check-circle">
                <el-icon class="check-icon"><i-nocode-import-success /></el-icon>
              </div>
              <div class="complete-text">
                  {{ $t('ExportDataDialog.exportFinish') }}
              </div>
              <div class="completed-table">
                <table border="1">
                  <thead>
                    <tr>
                      <th>{{ $t('ExportDataDialog.fileName') }}</th>
                      <th style="width: 80px;">{{ $t('ExportDataDialog.operate') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(file, index) in exportedFiles" :key="index">
                      <td>{{ file.filename }}</td>
                      <td><a @click="downloadFile(file.url, file.filename)">{{ $t('ExportDataDialog.download') }}</a></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <div>
            <div class="export-options" v-show="!isExportCompleted">
              <el-checkbox v-model="isExportIdField" :label="$t('ExportDataDialog.exportID')" />
              <el-checkbox :model-value="isExportFileFormat" @update:model-value="handleExportFileFormatChange" :label="$t('ExportDataDialog.imageFileExport')" />
              <span>|</span>
              <el-button type="primary" text @click="handleSetting" :disabled="!isExportFileFormat">{{ $t('ExportDataDialog.setting') }}</el-button>
            </div>
          </div>
          <div v-if="isExportCompleted === false">
            <el-button @click="handleCancel">{{ $t('ExportDataDialog.cancel') }}</el-button>
            <el-button type="primary" @click="handleConfirm" :disabled="selectedFieldList.length === 0" :loading="exportLoading">{{ $t('ExportDataDialog.confirm') }}</el-button>
          </div>
          <div v-if="isExportCompleted === true">
            <!-- <el-button @click="handleCancel">取消</el-button> -->
            <el-button type="primary" @click="handleCompleted">{{ $t('ExportDataDialog.complete') }}</el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>

  <div class="setting-dialog">
    <el-dialog v-model="settingDialogVisible" :title="$t('ExportDataDialog.imgAttachName')" top="30vh" destroy-on-close draggable :before-close="handleCloseSettingDialog" align-center>
      <div class="dialog-content">
        <div class="dialog-body">
          <div class="name-text">{{ $t('ExportDataDialog.nameMode') }}</div>
          <el-select v-model="namingMethod">
            <el-option v-for="method in namingMethods"
              :key="method.value"
              :value="method.value"
              :label="method.label"
            ></el-option>
          </el-select>
        </div>
        <div class="dialog-footer">
          <el-button @click="handleSettingCancel">{{ $t('ExportDataDialog.cancel') }}</el-button>
          <el-button type="primary" @click="handleSettingConfirm">{{ $t('ExportDataDialog.confirm') }}</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { useTable, useTableProps } from '../components/global/table/hooks';
import * as XLSX from "xlsx";
import axios from "axios";
import { ElIcon, ElMessage } from "element-plus";
import { doDownload } from "@renderer/utils";
import { ExportType } from '@common/types/nocode';
import { replaceIllegalChars } from '@common/utils';
import i18next from 'i18next';
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import { shouldAutoEnableFileFormatExport } from './export-data-dialog-file-format';
import { formatRelatedDataExportValue, parseRelatedDataIds } from '@common/utils/validate';

dayjs.extend(customParseFormat)

const widget = useTable();
const searchVal = ref('');
const selectedFieldList = ref([])
const isExportCompleted = ref(false)
const settingDialogVisible = ref(false);
const isExportIdField = ref(false);
const isExportFileFormat = ref(false);
const exportLoading = ref(false);
const namingMethod = ref('originalFilename')
const namingMethods = ref([
  {
    value: "originalFilename",
    get label() { return i18next.t('ExportDataDialog.keepOriginalName') },
  },
  {
    value: "formFieldName",
    get label() { return i18next.t('ExportDataDialog.byFormFieldName') },
  }
])
const exportedFiles = ref([])

const props = defineProps<{
  dialogVisible: boolean,
  fields: any[],
  exportType: ExportType,
}>();
const emit = defineEmits(['update:dialogVisible', 'closeDialog']);

const dialogVisibleComp = computed<boolean>({
  get: () => props.dialogVisible,
  set: (val) => emit('update:dialogVisible', val)
});

// 对树组件的引用
const fieldTreeRef = ref()
// 定义树的属性
const treeProps = {
  children: 'subColumns',
  label: 'alias'
};
// 构造树形结构数据
const treeFields = computed(() => {
  const fields = props.fields || [];
  
  // 根据搜索关键词过滤字段
  if (searchVal.value) {
    const keyword = searchVal.value.toLowerCase();
    return fields.filter(field => 
      field.alias && field.alias.toLowerCase().includes(keyword)
    );
  }
  
  return fields;
});
// 过滤树节点的方法
const filterTreeNodes = (value, data) => {
  if (!searchVal.value) return true;
  return data.alias.toLowerCase().includes(searchVal.value.toLowerCase());
};
const updateSelectedFieldList = (nextSelectedFieldList) => {
  const normalizedSelectedFieldList = Array.from(new Set(nextSelectedFieldList));
  const prevSelectedFieldList = [...selectedFieldList.value];
  selectedFieldList.value = normalizedSelectedFieldList;

  if (shouldAutoEnableFileFormatExport(prevSelectedFieldList, normalizedSelectedFieldList, props.fields || [])) {
    isExportFileFormat.value = true;
  }
};
// 处理树节点选中变化
const handleTreeCheck = (data, checkedInfo) => {
  updateSelectedFieldList([
    ...checkedInfo.checkedKeys,
    ...(fieldTreeRef.value?.getHalfCheckedKeys?.() ?? []),
  ]);
};
// 全选/取消全选
const toggleSelectAll = (isChecked: boolean) => {
  if (isChecked) {
    // 获取所有节点的key
    const allKeys = getAllNodeKeys(treeFields.value);
    fieldTreeRef.value.setCheckedKeys(allKeys, true);
    updateSelectedFieldList(allKeys);
  } else {
    fieldTreeRef.value.setCheckedKeys([]);
    updateSelectedFieldList([]);
  }
};
// 获取所有节点的key（包括子节点）
const getAllNodeKeys = (nodes) => {
  let keys = [];
  for (const node of nodes) {
    keys.push(node.uid);
    if (node.subColumns && node.subColumns.length > 0) {
      keys = keys.concat(getAllNodeKeys(node.subColumns));
    }
  }
  return keys;
};
// 检查是否全选
const isAllSelected = computed(() => {
  if (treeFields.value.length === 0) return false;
  const allKeys = getAllNodeKeys(treeFields.value);
  return allKeys.length > 0 && allKeys.every(key => selectedFieldList.value.includes(key));
});
// 控制节点是否可以被拖拽
const allowDrag = (node) => {
  return true;
};
// 控制节点是否可以被放置到某个节点上
const allowDrop = (draggingNode, dropNode, type) => {
  // 只允许在同级之间拖拽（即 type === 'prev' 或 type === 'next'）
  // 不允许放到其他节点内部（type === 'inner'）
  if (type === 'inner') {
    return false;
  }

  // 如果拖拽的节点是子表单字段 (isSubColumn)
  if (draggingNode.data.isSubColumn) {
    // 确保目标节点也是子表单字段且属于同一个父节点
    if (dropNode.data.isSubColumn && draggingNode.parent === dropNode.parent) {
      return true;
    }
    
    // 如果目标节点是父节点，且拖拽节点是其子节点，则允许
    if (!dropNode.data.isSubColumn && draggingNode.parent === dropNode) {
      if(type === 'prev') {
        return false;
      }
    }
    
    return false;
  } else {  // 如果拖拽的节点是非子表单字段
    // 确保目标节点也是非子表单字段
    if (!dropNode.data.isSubColumn) {
      return true;
    }

    return false;
  }
};
// 监听搜索值变化，更新树过滤
watch(searchVal, (val) => {
  fieldTreeRef.value.filter(val);
});

const handleExportFileFormatChange = (value: boolean) => {
  isExportFileFormat.value = value;
};

const resetValues = () => {
  isExportCompleted.value = false
  exportLoading.value = false
  searchVal.value = ''
  exportedFiles.value = []
  // 清除树的选中状态
  if (fieldTreeRef.value) {
    fieldTreeRef.value.setCheckedKeys([]);
  }
};

const handleCloseExportDialog = () => {
  resetValues()
  selectedFieldList.value = []
  isExportIdField.value = false
  isExportFileFormat.value = false
  namingMethod.value = 'originalFilename'
  emit('closeDialog')
};

const handleSetting = () => {
  settingDialogVisible.value = true
}

const handleCancel = () => {
  resetValues()
  selectedFieldList.value = []
  isExportIdField.value = false
  isExportFileFormat.value = false
  namingMethod.value = 'originalFilename'
  emit('closeDialog')
}

const handleConfirm = async () => {
  resetValues()
  exportLoading.value = true
  try {

  const tableName = await widget.getTableName()
  const rows = await widget.getRows(props.exportType) || widget.rows;
  const rowUUIDKey = await widget.rowKey
  const tableUID = await widget.formTableUID

  // 根据选中的字段过滤列，支持主表字段和子表单字段
  const selectedColumns = widget.allColumns.reduce((acc, column) => {
    // 如果是非子表单字段且被选中
    if (selectedFieldList.value.includes(column.uid) && !column.isSubColumn) {
      acc.push({ ...column });
    }
    
    // 如果是子表单字段，检查其子字段是否被选中
    if (column.subColumns && Array.isArray(column.subColumns)) {
      const selectedSubColumns = column.subColumns.filter(subColumn => 
        selectedFieldList.value.includes(subColumn.uid)
      );
      // 为每个选中的子列添加带有parentUID的条目
      for (const subColumn of selectedSubColumns) {
        acc.push({
          ...subColumn,
          parentUID: column.uid,
        });
      }
    }

    // 如果时多选或下拉多选组件，则为其标记subType
    for (const column of acc) {
      if (column?.extra?.widgetType === 'widget.form.checkboxGroup') {
        column.subType = 'multicheckbox';
      } else if (column?.extra?.widgetType === 'widget.form.treeMultipleSelect') {
        column.subType = 'multiselect';
      } else if (column?.extra?.widgetType === 'widget.form.relatedData') {
        column.subType = 'relatedData';
      }
    }
    
    return acc;
  }, []);

  const relatedDataLabelMap = {};
  const relatedDataColumns = selectedColumns.filter(column => column.subType === 'relatedData');
  for (const column of relatedDataColumns) {
    const uuidSet = new Set();
    for (const row of rows) {
      if (column.parentUID) {
        const subRows = Array.isArray(row[column.parentUID]) ? row[column.parentUID] : [];
        subRows.forEach(subRow => {
          parseRelatedDataIds(subRow[column.uid]).forEach(uuid => uuidSet.add(uuid));
        });
      } else {
        parseRelatedDataIds(row[column.uid]).forEach(uuid => uuidSet.add(uuid));
      }
    }

    const uuids = [...uuidSet] as string[];
    const options = [];
    for (let index = 0; index < uuids.length; index += 200) {
      options.push(...await widget.getRelatedFilterOptions(column.uid, uuids.slice(index, index + 200)));
    }
    relatedDataLabelMap[column.uid] = Object.fromEntries(options.map(option => [option.value, option.label]));
  }

  // 如果选择导出ID字段，则添加ID字段
  if (isExportIdField.value) {
    selectedColumns.unshift({
      alias: 'ID',
      uid: rowUUIDKey,
    });
  }
  
  // 创建表头
  const headers = createTableHeaders(selectedColumns);

  // 导出为Excel
  const excelData = await exportToExcel(headers, rows, tableName, relatedDataLabelMap);

  // 把图片/附件字段以文件形式导出
  if (isExportFileFormat.value) {
    try {
      const res = await axios.post('/nocode/export-image-attachment', {
        selectedColumns: selectedColumns,
        rows: rows,
        excelData: excelData,
        tableName: tableName,
        tableUID: tableUID
      }).catch(({ response }) => {
        ElMessage.error(response?.data?.message);
      });

      if (res && res.data) {
        const downloadUrl = `${window.location.origin}${res.data.zipFileUrl}`
        exportedFiles.value.push({ url: downloadUrl, filename: `${tableName}(${i18next.t('ExportDataDialog.dataAndAttach')}).zip` });
      }
    } catch (error) {
      ElMessage.error(i18next.t('ExportDataDialog.exportAttachFail'));
    }
  }
  
  isExportCompleted.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || i18next.t('ExportDataDialog.requestFail'))
  } finally {
    exportLoading.value = false
    isExportIdField.value = false
    isExportFileFormat.value = false
    namingMethod.value = 'originalFilename'
  }
}
// 创建表头结构的函数
const createTableHeaders = (selectedColumns) => {
  // 检查是否存在子表单字段
  const hasSubForm = selectedColumns.some(col => col.isSubColumn);
  
  if (!hasSubForm) {
    // 没有子表单字段，只需要一行表头
    const singleRow = selectedColumns.map(column => ({
      name: column.alias,
      uid: column.uid,
      subType: column.subType,
      dateFormat: column.extra?.format,
      dateLocale: column.extra?.dateLocale,
    }));
    return {
      singleRow
    };
  } else {
    // 有子表单字段，需要两行表头
    const firstRow = [];
    const secondRow = [];
    
    // 遍历所有选中的字段
    for (let i = 0; i < selectedColumns.length; i++) {
      const column = selectedColumns[i];
      
      // 跳过子表单的子字段，在处理父字段时一起处理
      if (column.isSubColumn) {
        continue;
      }
      
      // 检查该字段是否有选中的子字段
      const subColumns = selectedColumns.filter(col => 
        col.parentUID === column.uid && col.isSubColumn
      );
      
      if (subColumns.length > 0) {
        // 是子表单字段，第一行添加一个标题，然后为每个子字段添加空占位符
        firstRow.push({
          name: column.alias,
          uid: column.uid,
          colspan: subColumns.length
        });

        // 为每个子字段在第一行添加空占位符
        for (let j = 1; j < subColumns.length; j++) {
          firstRow.push({
            name: '',
            uid: column.uid,
            isPlaceholder: true
          });
        }
        
        // 第二行添加对应的子字段
        for (const subColumn of subColumns) {
          secondRow.push({
            name: subColumn.alias,
            uid: subColumn.uid,
            parentUID: column.uid,
            isSubColumn: true,
            subType: subColumn.subType,
            dateFormat: subColumn.extra?.format,
            dateLocale: subColumn.extra?.dateLocale,
          });
        }
      } else {
        // 普通字段（非子表单），需要在两行中都显示，但合并单元格
        firstRow.push({
          name: column.alias,
          uid: column.uid,
          rowspan: 2, // 合并两行
          isMaster: true // 标记为主字段
        });
        
        // 第二行添加占位符
        secondRow.push({
          // name: '',
          name: column.alias,
          uid: column.uid,
          isPlaceholder: true, // 标记为占位符
          subType: column.subType,
          dateFormat: column.extra?.format,
          dateLocale: column.extra?.dateLocale,
        });
      }
    }
    
    return {
      firstRow,
      secondRow
    };
  }
}

const safeCellValue = (val, header) => {
  if (header?.subType === 'date') {
    if (val === undefined || val === null || val === '') return '';

    const formatDateValue = (date) => {
      if (!header.dateFormat) {
        return typeof val === 'string' ? limitText(val) : date.format('YYYY-MM-DD HH:mm:ss');
      }
      const localizedDate = header.dateLocale === 'en' ? date.locale('en') : date.locale('zh-cn');
      return localizedDate.format(header.dateFormat);
    };

    const formattedDate = header.dateFormat ? dayjs(val, header.dateFormat) : null;
    if (formattedDate?.isValid()) {
      return formatDateValue(formattedDate);
    }

    const date = dayjs(val);
    if (date.isValid()) {
      return formatDateValue(date);
    }

    return typeof val === 'string' ? limitText(val) : val;
  } else if (Array.isArray(val)) {
    return val?.join(",");
  }

  if (typeof val === 'string') {
    return limitText(val);
  }
  return val;
}

const limitText = (str) => {
  const maxCellLength = 30000;
  if (str.length <= maxCellLength) return str;
  return str.slice(0, maxCellLength) + `...(${i18next.t('ExportDataDialog.excelContentTruncated')})`;
}

// 导出为Excel文件
const exportToExcel = async (headers, rows, tableName, relatedDataLabelMap) => {
  const subTableUIDs = await widget.getSubTableUIDs()
  // 创建工作簿
  const wb = XLSX.utils.book_new();
  
  // 构建表头数据结构
  const headerData = [];
  
  if (headers.singleRow) {
    // 只有一行表头
    const row = headers.singleRow.map(item => item.name);
    headerData.push(row);
  } else {
    // 有两行表头
    const firstRow = headers.firstRow.map(item => item.name);
    const secondRow = headers.secondRow.map(item => {
      // 对于占位符字段，不显示内容
      if (item.isPlaceholder) {
        return '';
      }
      return item.name;
    });
    headerData.push(firstRow);
    headerData.push(secondRow);
  }

  //创建合并单元格信息数组 
  const mergeCells = [];
  // 构建导入数据结构
  const dataRows = [];
  if (rows && rows.length > 0) {
    const nameCount = {}; // 用于统计文件名出现次数
    // 处理每一行数据
    for (const row of rows) {
      // 计算这一行数据中所有子表单的最大长度
      let maxSubTableLength = 1;
      if(subTableUIDs) {
        for (const [fieldUID, tableUID] of subTableUIDs) {
          maxSubTableLength = Math.max(maxSubTableLength, row[fieldUID].length);
        }
      }
      mergeCells.push(maxSubTableLength)

      let dataRow = [];
      
      // 只有一行表头的情况（没有子表单）
      if (headers.singleRow) {
        for (const header of headers.singleRow) {
          const column = row[header.uid];
          if (header.subType === 'relatedData') {
            dataRow.push(formatRelatedDataExportValue(column, relatedDataLabelMap[header.uid] || {}));
          } else if (Array.isArray(column) && ["file", "image"].includes(header.subType)) {  // 图片和附件
            if (!isExportFileFormat.value) {
              const fileList = column.map(item => item.exportUrl).join(',');
              dataRow.push(fileList);
            } else {  // 图片附件单独导出时
              for (const item of column) {
                let originalName = item.name;
                if(namingMethod.value === 'formFieldName'){ // 按照表单中字段命名
                  const fileExt = item.name.substring(item.name.lastIndexOf('.'));
                  originalName = `${header.name}${fileExt}`;
                }
                if (originalName) {
                  if(nameCount[originalName]){
                    // 文件名已存在，添加数字后缀
                    nameCount[originalName]++;
                    const extIndex = originalName.lastIndexOf('.');
                    if (extIndex > 0) {
                      const name = originalName.substring(0, extIndex);
                      const ext = originalName.substring(extIndex);
                      item.name = `${name}(${nameCount[originalName] - 1})${ext}`;
                    } else {
                      item.name = `${originalName}(${nameCount[originalName]})`;
                    }
                  } else {
                    // 第一次出现的文件名
                    nameCount[originalName] = 1;
                    item.name = originalName;
                  }
                }
              }
              // 单元格存的内容为：文件相对路径地址
              if(column.length > 0){
                const relativePath = `./${tableName}_${i18next.t('ExportDataDialog.attachment')}/${column[0].name}`
                const fileList = column.map(item => `./${tableName}_${i18next.t('ExportDataDialog.attachment')}/${item.name}`).join(',');
                // 创建超链接格式的数据
                dataRow.push({ t:'s', v:`${fileList}`, l:{Target:`${relativePath}`} });
              } else {
                dataRow.push('');
              }
            }
          } else if(header.subType === 'hyperlink') { // 超链接
            // 创建超链接格式的数据
            dataRow.push({ t:'s', v:`${column}`, l:{Target:`${column}`} });
          } else if(header.subType === 'daterange' || header.subType === 'multicheckbox' || header.subType === 'multiselect') { // 时间范围或多选框或下拉多选框
            const combineString = column?.join(',')
            dataRow.push(combineString);
          } else {
            dataRow.push(safeCellValue(column, header));
          }
        }
      } else {  // 有两行表头的情况（包含子表单）
        for (let i = 0; i < maxSubTableLength; i++) {
          for (const header of headers.secondRow) {
            // 非子表单字段
            if (!header.isSubColumn) {
              const column = row[header.uid];
              if (header.subType === 'relatedData') {
                dataRow.push(formatRelatedDataExportValue(column, relatedDataLabelMap[header.uid] || {}));
              } else if (Array.isArray(column) && ["file", "image"].includes(header.subType)) {  // 图片和附件
                if (!isExportFileFormat.value) {
                  const fileList = column.map(item => item.exportUrl).join(',');
                  dataRow.push(fileList);
                } else { 
                  if(i === 0){
                    for (const item of column) {
                      let originalName = item.name;
                      if(namingMethod.value === 'formFieldName'){
                        const fileExt = item.name.substring(item.name.lastIndexOf('.'));
                        originalName = `${header.name}${fileExt}`;
                      }
                      if (originalName) {
                        if(nameCount[originalName]){
                          // 文件名已存在，添加数字后缀
                          nameCount[originalName]++;
                          const extIndex = originalName.lastIndexOf('.');
                          if (extIndex > 0) {
                            const name = originalName.substring(0, extIndex);
                            const ext = originalName.substring(extIndex);
                            item.name = `${name}(${nameCount[originalName] - 1})${ext}`;
                          } else {
                            item.name = `${originalName}(${nameCount[originalName]})`;
                          }
                        } else {
                          // 第一次出现的文件名
                          nameCount[originalName] = 1;
                          item.name = originalName;
                        }
                      }
                    }
                  }
                  // 单元格存的内容为：文件相对路径地址
                  if(column.length > 0){
                    const relativePath = `./${tableName}_${i18next.t('ExportDataDialog.attachment')}/${column[0].name}`
                    const fileList = column.map(item => `./${tableName}_${i18next.t('ExportDataDialog.attachment')}/${item.name}`).join(',');
                    // 创建超链接格式的数据
                    dataRow.push({ t:'s', v:`${fileList}`, l:{Target:`${relativePath}`} });
                  } else {
                    dataRow.push('');
                  }
                }
              } else if (header.subType === 'hyperlink') { // 超链接
                // 创建超链接格式的数据
                dataRow.push({ t:'s', v:`${column}`, l:{Target:`${column}`} });
              } else if (header.subType === 'daterange' || header.subType === 'multicheckbox' || header.subType === 'multiselect') { // 时间范围或多选框或下拉多选框
                const combineString = column?.join(',')
                dataRow.push(combineString);
              } else {
                dataRow.push(safeCellValue(column, header));
              }
            } else {  // 子表单字段
              const forwardRow = row[header.parentUID]
              const reverseRow = [...forwardRow].reverse()  // 创建副本再反转
              const subRow = reverseRow[i]
              if (subRow) {
                const column = subRow[header.uid];
                if (header.subType === 'relatedData') {
                  dataRow.push(formatRelatedDataExportValue(column, relatedDataLabelMap[header.uid] || {}));
                } else if (Array.isArray(column) && ["file", "image"].includes(header.subType)) {  // 图片和附件
                  if (!isExportFileFormat.value) { 
                    const fileList = column.map(item => item.exportUrl).join(',');
                    dataRow.push(fileList);
                  } else {
                    for (const item of column) {
                      let originalName = item.name;
                      if(namingMethod.value === 'formFieldName'){
                        const fileExt = item.name.substring(item.name.lastIndexOf('.'));
                        originalName = `${header.name}${fileExt}`;
                      }
                      if (originalName) {
                        if(nameCount[originalName]){
                          // 文件名已存在，添加数字后缀
                          nameCount[originalName]++;
                          const extIndex = originalName.lastIndexOf('.');
                          if (extIndex > 0) {
                            const name = originalName.substring(0, extIndex);
                            const ext = originalName.substring(extIndex);
                            item.name = `${name}(${nameCount[originalName] - 1})${ext}`;
                          } else {
                            item.name = `${originalName}(${nameCount[originalName]})`;
                          }
                        } else {
                          // 第一次出现的文件名
                          nameCount[originalName] = 1;
                          item.name = originalName;
                        }
                      }
                    }
                    // 单元格存的内容为：文件相对路径地址
                    if(column.length > 0){
                      const relativePath = `./${tableName}_${i18next.t('ExportDataDialog.attachment')}/${column[0].name}`
                      const fileList = column.map(item => `./${tableName}_${i18next.t('ExportDataDialog.attachment')}/${item.name}`).join(',');
                      // 创建超链接格式的数据
                      dataRow.push({ t:'s', v:`${fileList}`, l:{Target:`${relativePath}`} });
                    } else {
                      dataRow.push('');
                    }
                  }
                } else if (header.subType === 'hyperlink') { // 超链接
                  // 创建超链接格式的数据
                  dataRow.push({ t:'s', v:`${column}`, l:{Target:`${column}`} });
                } else if (header.subType === 'daterange' || header.subType === 'multicheckbox' || header.subType === 'multiselect') { // 时间范围或多选框或下拉多选框
                  if (column) {
                    const combineString = column?.join(',')
                    dataRow.push(combineString);
                  } else {
                    dataRow.push('')
                  }
                } else {
                  dataRow.push(safeCellValue(column, header));
                }
              } else {
                dataRow.push('');
              }
            }
          }
          dataRows.push(dataRow);
          dataRow = [];
        }
      }
      if(dataRow.length > 0){
        dataRows.push(dataRow);
      }
    }
  }

  // 合并表头和数据
  const allData = [...headerData, ...dataRows];
  
  // 创建工作表
  const ws = XLSX.utils.aoa_to_sheet(allData);
  // 处理表头合并单元格（如果有子表单字段）
  if (headers.firstRow) {
    const merges = [];
    let firstRowColIndex = 0;
    
    for (const item of headers.firstRow) {
      if (item.colspan && item.colspan > 1) {
        // 子表单字段需要跨列
        merges.push({
          s: { r: 0, c: firstRowColIndex }, // 开始单元格 (行, 列)
          e: { r: 0, c: firstRowColIndex + item.colspan - 1 } // 结束单元格 (行, 列)
        });
        firstRowColIndex += 1;
      } else if (item.rowspan && item.rowspan > 1) {
        // 普通字段需要跨行
        merges.push({
          s: { r: 0, c: firstRowColIndex }, // 开始单元格 (行, 列)
          e: { r: 1, c: firstRowColIndex } // 结束单元格 (行, 列)
        });
        firstRowColIndex += 1;
      } else {
        firstRowColIndex += 1;
      }
    }
    
    if (merges.length > 0) {
      ws['!merges'] = merges;
    }
  }

  // 处理数据合并单元格（如果有子表单字段）
  if (headers.secondRow) {
    const dataMerges = [];
    let rowIndex = 2;
    let colIndex = 0;
    for (let i = 0; i < mergeCells.length; i++) { 
      for (const item of headers.secondRow) {
        if(!item.isSubColumn){
          if(mergeCells[i] > 1){
            dataMerges.push({
              s: { r: rowIndex, c: colIndex}, // 开始单元格 (行, 列)
              e: { r: rowIndex + mergeCells[i] - 1, c: colIndex} // 结束单元格 (行, 列)
            })
          }
          colIndex += 1;
        } else {
          colIndex += 1;
        }
      }
      rowIndex += mergeCells[i];
      colIndex = 0;
    }
    // 将合并信息应用到工作表
    if (dataMerges.length > 0) {
      ws['!merges'] = [...(ws['!merges'] || []), ...dataMerges];
    }
  }
  const name = replaceIllegalChars(tableName);
  const sheetName = name.slice(0, 31) || 'Sheet1';
  // 将工作表添加到工作簿
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // 导出文件
  let filename = `${name}.xlsx`;
  if(isExportFileFormat.value) { 
    filename = `${name}(${i18next.t('ExportDataDialog.data')}).xlsx`;
  }

  // XLSX.writeFile(wb, filename);
  // 生成二进制数据而不是直接下载
  const excelData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelData], { type: 'application/octet-stream' });
  // 创建下载链接
  const url = URL.createObjectURL(blob);
  exportedFiles.value.push({url,filename})

  // 返回Excel数据
  return Array.from(new Uint8Array(excelData));
}
// 下载导出的文件
const downloadFile = async(url, filename) => {
  try {
    // 验证参数
    if (!url) {
      console.error(i18next.t('ExportDataDialog.downloadLinkEmpty'));
      return false;
    }

    if (filename.endsWith('.xlsx')) {
      // 发起请求获取文件数据
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${i18next.t('ExportDataDialog.requestFail')}: ${response.status}`);
      }

      // 根据文件扩展名确定MIME类型
      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
      // 将响应转换为Blob
      const blob = await response.blob();
      const fileBlob = new Blob([blob], { 
        type: mimeType
      });

      // 创建下载链接
      const downloadUrl = URL.createObjectURL(fileBlob);
      // 使用doDownload函数触发下载
      doDownload({
        url: downloadUrl,
        name: filename || i18next.t('ExportDataDialog.exportFile')
      });
      
      // 清理资源
      URL.revokeObjectURL(downloadUrl);
      return true;
    } else if (filename.endsWith('.zip')) {
      // 使用doDownload函数触发下载
      doDownload({
        url: url,
        name: filename || i18next.t('ExportDataDialog.exportFile')
      });
      return true;
    }
  } catch (error) {
    console.error(i18next.t('ExportDataDialog.fileDownloadFail'), error);
    return false;
  }
}

const handleCompleted = async () => { 
  resetValues()
  selectedFieldList.value = []
  isExportIdField.value = false
  isExportFileFormat.value = false
  namingMethod.value = 'originalFilename'
  emit('closeDialog')
};

const handleSettingCancel = async () => { 
  namingMethod.value = 'originalFilename'
  settingDialogVisible.value = false
};
const handleSettingConfirm = async () => { 
  settingDialogVisible.value = false
};
const handleCloseSettingDialog = async () => { 
  namingMethod.value = 'originalFilename'
  settingDialogVisible.value = false
};

</script>

<style lang="scss" scoped>
:deep(.el-button) {
  border-radius: 4px;
}
.export-data-dialog {
  :deep(.el-dialog){
    border-radius: 4px;
    background-color: var(--bg-color-page);
    padding: 0px;

    .el-dialog__header{
      padding: 0px;
      text-align: center;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
    }

    .el-dialog__body {
      p {
        font-size: 12px;
        line-height: 16px;
        color: var(--text-color-secondary);
      }
    }
  }

  .dialog-content {
    .dialog-body {
      height: 380px;
      .export-uncomplete-container {
        padding: 16px;
        .search-box {
          height: 48px;
          :deep(.el-input) {
            --el-input-bg-color: var(--bg-color-overlay);
            --el-input-focus-border-color: unset;
            width: 100%;
            height: 32px;
            .el-input__wrapper {
              border-radius: 4px;
              box-shadow: none;
              .el-input__prefix {
                color: var(--icon-default-color);
                font-size: 16px;
              }
            }
          }
        }

        .field-list {
          max-height: 280px;
          overflow-y: auto;
          /* 滚动条样式 */
          &::-webkit-scrollbar {
            width: 6px;
          }

          .checkbox-group {
            margin-top: 8px;

            .checkbox-item{
              display: block;
              width: 100%;
              padding-top: 9px;
              border-radius: 4px;
              transition: background-color 0.2s;
              
              &:hover {
                background-color: var(--bg-color-overlay);
              }

              // 修复最后一个元素背景阴影宽度不一致的问题
              :deep(.el-checkbox) {
                display: flex;
                width: 100%;
              }
            }

            .sub-column-item {
              padding-left: 24px;
            }
          }
        }
      }

      .export-complete-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;

        .check-circle {
          margin-top: 60px;
          margin-bottom: 15px;
          .check-icon {
            font-size: 64px;
          }
        }

        .completed-table {
          margin-top: 40px;
          border-collapse: collapse;
          border-radius: 8px !important;

          table {
            width: 640px;

            thead {
              font-size: 14px;
              font-weight: 500;
              font-family: 'Noto Sans SC';
              line-height: 30px;
              background-color: #F5F6F7;
            }
            
            tbody {
              font-size: 14px;
              font-weight: 400;
              font-family: 'Noto Sans SC';
              line-height: 30px;
              text-align: center;
              a {
                color: #0873FF;
              }
            }
          }
        }
      }
    }
    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-top: 1px solid var(--border-color);

      .export-options {
        display: flex;
        align-items: center;
        .el-checkbox {
          margin-right: 10px;
        }
      }
    }
  }
}

.setting-dialog {
  :deep(.el-dialog) {
    width: 400px;
    border-radius: 4px;
    background-color: var(--bg-color-page);
    padding: 0px;

    .el-dialog__header{
      padding: 0px;
      text-align: center;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
    }

    .el-dialog__body {
      p {
        font-size: 12px;
        line-height: 16px;
        color: var(--text-color-secondary);
      }
    }
  }

  .dialog-content {
    .dialog-body {
      padding: 10px;
      .name-text {
        margin-top: 20px;
        margin-bottom: 10px;
      }
    }
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      border-top: 1px solid var(--border-color);
      margin-top: 25px;
      padding: 10px;
    }
  }
}

</style>
