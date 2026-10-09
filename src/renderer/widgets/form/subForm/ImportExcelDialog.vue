<template>
  <div class="import-excel-dialog">
    <el-dialog v-model="dialogVisibleComp" width="1000px" :close-on-click-modal="false" draggable :title="dialogTitle"
      :before-close="handleCloseExcel" align-center append-to-body
    >
      <div class="popup-content">
        <div class="popup-body">
          <!-- 步骤指示器 -->
          <div class="steps-container">
            <!-- <div class="steps-line"></div> -->
            <div class="steps">
              <div class="step" :class="{ active: currentStep >= 1 }">
                <div class="step-number">1</div>
                <div class="step-text">{{ $t("importExcelStepSelectFile") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 2 }"></div>
              <div class="step" :class="{ active: currentStep >= 2 }">
                <div class="step-number">2</div>
                <div class="step-text">{{ $t("importExcelStepPreviewData") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 3 }"></div>
              <div class="step" :class="{ active: currentStep >= 3 }">
                <div class="step-number">3</div>
                <div class="step-text">{{ $t("importExcelStepConfigureForm") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 4 }"></div>
              <div class="step" :class="{ active: currentStep >= 4 }">
                <div class="step-number">4</div>
                <div class="step-text">{{ $t("importExcelStepImportData") }}</div>
              </div>
            </div>
          </div>
          <!-- 步骤内容 -->
          <div class="step-content"  v-loading="loading">
            <div v-if="currentStep === 1" class="step1-content">
              <div class="step1-content-tip">
                <p>{{ $t("importExcelRuleIntro") }}<a style="color: #1F77FC;" target="_blank" @click="downloadTemplate">{{ $t("importExcelDownloadTemplate") }}</a></p>
                <p>{{ $t("importExcelRuleFileType") }}</p>
                <p>{{ $t("importExcelRuleNoMergedCells") }}</p>
                <p>{{ $t("importExcelRuleNoFormula") }}</p>
                <p>{{ $t("importExcelRuleMaxSize") }}</p>
                <p>{{ $t("importExcelRuleDataMismatch") }}</p>
                <p>{{ $t("importExcelRuleMoreHelp") }}<a style="color: #1F77FC;" href="https://www.banban.work/docs/v1/ygxgkwimrnyt3ehs" target="_blank">{{ $t("viewTutorial") }}</a></p>
              </div>
              <el-upload
                class="drag-upload"
                drag
                accept=".xlsx,.xls"
                :show-file-list="false"
                :before-upload="handleBeforeUpload"
                :http-request="uploadFile"
              >
                <div class="drag-upload-content" v-loading="loading">
                  <div v-if="uploadProgress === 0" class="drag-upload-content-item">
                    <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                    <div class="el-upload__text" style="color: #A1A1A1;">
                      {{ $t("importExcelDragTipPrefix") }}<em style="color: #1F77FC;">{{ $t("importExcelClickToAdd") }}</em>
                    </div>
                  </div>
                </div>
              </el-upload>
            </div>
            <div v-if="currentStep === 2" class="step2-content">
              <div>
                <div class="worksheet-header">
                  <div class="worksheet-dropdown">
                    <label class="label">{{ $t("importExcelWorksheet") }}</label>
                    <el-select v-model="worksheet" :placeholder="$t('importExcelSelectWorksheet')" style="width: 240px">
                      <el-option
                        v-for="item in sheetsNames"
                        :key="item"
                        :label="item"
                        :value="item"
                      />
                    </el-select>
                  </div>
                  <p class="info">
                    <span class="info-icon">ⓘ</span>
                    {{ $t("importExcelSkipRowsAboveTitle") }}
                  </p>
                </div>
                <div v-if=step2HaveTableData>
                  <div class="havedata-table">
                    <div class="table-container">
                      <!-- 添加带滚动条的容器 -->
                      <div class="scrollable-table">
                        <table class="data-table2">
                          <tbody>
                            <tr v-for="(row, rowIndex) in table2Data" :key="rowIndex"
                              :class="[{ 'title-row': isTitleRow(rowIndex) }, { disabled: rowIndex < titleRowIndex }]"
                            >
                              <td v-if="titleRadioColMerge[rowIndex].rowspan !== 0 && titleRadioColMerge[rowIndex].colspan !== 0"
                                :rowspan="titleRadioColMerge[rowIndex].rowspan ?? 1"
                                :colspan="titleRadioColMerge[rowIndex].colspan ?? 1"
                              >
                                <el-radio class="title-row-radio" v-model="titleRowIndex" :value="rowIndex"></el-radio>
                                <span v-if="titleRowIndex === rowIndex">{{ $t("importExcelTitleRow") }}</span>
                              </td>
                              <td class="index-cell">
                                {{ rowIndex + 1 }}
                              </td>
                              <template v-for="(cell, colIndex) in row" :key="cell + colIndex">
                                <td v-if="excelMergeData[rowIndex]?.[colIndex]?.colspan !== 0 && excelMergeData[rowIndex]?.[colIndex]?.rowspan !== 0"
                                  :rowspan="excelMergeData[rowIndex]?.[colIndex]?.rowspan ?? 1"
                                  :colspan="excelMergeData[rowIndex]?.[colIndex]?.colspan ?? 1"
                                >{{ formatDisplayCellData(cell, rowIndex, colIndex) }}</td>
                              </template>
                            </tr>
                            <tr v-if="table2Data.length >= 30">
                              <td colspan="100%" style="text-align: center; white-space: nowrap; color: #999999;">
                                {{ i18next.t("importExcelPreviewLimit") }}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else>
                  <div class="empty-table">
                    <div class="empty-table-alert">
                      <div class="alert-icon">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          class="feather feather-alert-triangle"
                        >
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="currentColor"></path>
                          <line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2" stroke-linecap="round"></line>
                          <circle cx="12" cy="17" r="1" fill="white"></circle>
                        </svg>
                      </div>
                      <p class="alert-message">{{ i18next.t("importExcelEmptySheet") }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="currentStep === 3" class="step3-content">
              <div id="app" v-if="props.contentSource === 'nocodeCreateDataDialogValue'">
                  <!-- 表单头部信息 -->
                  <div class="form-header">
                      <div class="form-header-left">
                      <div class="form-name">
                          <label>{{ i18next.t("importExcelFormName") }}</label>
                          <el-input class="el-input" v-model="formName" :placeholder="i18next.t('importExcelEnterFormName')" />
                      </div>
                      <!-- <div class="form-group">
                          <label>表单分组：</label>
                          <el-select class="el-select" v-model="formGroup" placeholder="Select">
                          <el-option
                              v-for="item in formGroupOptions"
                              :key="item.value"
                              :label="item.label"
                              :value="item.value"
                          />
                          </el-select>
                      </div> -->
                      </div>
                      <span style="font-size: 12px; color: #A1A1A1;">{{ selectedFieldCountText }}</span>
                  </div>
                  <!-- 添加带滚动条的容器 -->
                  <div class="step3-table-container">
                    <div class="scrollable-table" v-loading="loading">
                        <table class="step3-table">
                        <thead>
                            <tr>
                            <th>{{ i18next.t("importExcelExcelField") }}</th>
                            <th class="step3-table-td2">&gt;</th>
                            <th>{{ i18next.t("importExcelFormFieldTitle") }}</th>
                            <th>{{ i18next.t("importExcelFormFieldType") }}</th>
                            </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(item, index) in excelFieldsForTemplate" :key="index"
                            :class="[{'not-import': item.formFieldType === NOT_IMPORT}]"
                          >
                            <td>
                              <div class="form-group">
                                <el-input v-model="item.excelFieldTitle" readonly />
                              </div>
                            </td>
                            <td class="step3-table-td2">-</td>
                            <td>
                              <div class="form-group">
                                <el-input v-model="item.formFieldTitle" />
                              </div>
                            </td>
                            <td>
                              <div class="form-group">
                                <el-select v-model="item.formFieldType" class="el-select" :class="{'not-import': item.formFieldType === NOT_IMPORT}" popper-class="import-excel-field-type-select-popper">
                                  <el-option v-for="item in formFieldTypes" :key="item.type"
                                    :value="item.type" value-key="type"
                                    :label="item.name"
                                  ></el-option>
                                </el-select>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                        </table>
                    </div>
                  </div>
              </div>
              <div id="app" v-if="props.contentSource === 'tableHeaderValue'">
                <div class="form-header">
                  <div class="form-header-left">
                    <div class="form-name">
                      <label>{{ i18next.t("importExcelFormName") }}</label>
                      <el-input class="el-input" v-model="formName" :placeholder="i18next.t('importExcelEnterFormName')" />
                    </div>
                  </div>
                  <span>{{ selectedFieldCountText }}</span>
                </div>
                <div class="step3-table-container">
                  <div class="scrollable-table">
                    <table class="step3-table">
                      <thead>
                        <tr>
                          <th>{{ i18next.t("importExcelExcelField") }}</th>
                          <th>&gt;</th>
                          <th>{{ i18next.t("importExcelFormField") }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(item, index) in excelFieldsForTemplate" :key="index"
                          :class="[{'not-import': item.formField === NOT_IMPORT}]"
                        >
                          <td>
                            <div class="form-group">
                              <el-input type="text" v-model="item.excelFieldTitle" readonly></el-input>
                            </div>
                          </td>
                          <td class="step3-table-td2">-</td>
                          <td>
                            <div class="form-group">
                              <el-select v-model="item.formField" :class="{'not-import': item.formField === NOT_IMPORT}" @change="(value: FieldUID) => handleFieldChange(value, index, item)">
                                <template #label="{ label, value }">
                                  <span v-html="label"></span>
                                </template>
                                <el-option v-for="option in getFilteredOptions(index, item)"
                                  :key="option.uid"
                                  :value="option.uid"
                                  :label="option.alias"
                                  :disabled="isOptionDisabled(option, index, item)"
                                >
                                  <template #default>
                                    <span v-html="option.alias"></span>
                                  </template>
                                </el-option>
                              </el-select>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="currentStep === 4" class="step4-content">
              <div class="import-complete-container">
                <div class="check-circle">
                  <el-icon class="check-icon"
                    v-if="importExcelSuccessLength === importExcelTotalLength"
                  ><i-ven-icon-widget-form-sub-form-import-success /></el-icon>
                  <el-icon class="check-icon" v-else><i-ven-icon-widget-form-sub-form-import-warning /></el-icon>
                </div>
                <p class="import-complete-text">
                  <span v-if="importExcelSuccessLength === importExcelTotalLength">
                    {{ i18next.t("importExcelResultSuccess", { count: importExcelSuccessLength }) }}
                  </span>
                  <span v-else-if="importExcelSuccessLength === 0 && importExcelTotalLength !== 0">
                    {{ i18next.t("importExcelResultFail", { count: importExcelTotalLength }) }}
                  </span>
                  <span v-else>
                    {{ i18next.t("importExcelResultPartialPrefix", { success: importExcelSuccessLength }) }}
                    <span class="failed-count">{{ importExcelTotalLength - importExcelSuccessLength }}</span>
                    {{ i18next.t("importExcelResultPartialSuffix") }}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="popup-footer">
          <div>
            <a style="color: #1F77FC;" href="https://www.banban.work/docs/v1/ygxgkwimrnyt3ehs" target="_blank"><el-icon><Opportunity /></el-icon>{{ i18next.t("viewTutorial") }}</a>
          </div>
          <div>
            <el-button v-if="currentStep === 1" @click="handleCloseExcel">{{ i18next.t("cancel") }}</el-button>
            <el-button class="next-btn" v-if="currentStep > 1 && currentStep < 4" @click="preStep" :disabled="loading">{{ i18next.t("prevStep") }}</el-button>
            <el-button type="primary" class="next-btn" v-if="currentStep < 3" @click="nextStep" :disabled="!step2HaveTableData">{{ i18next.t("nextStep") }}</el-button>
            <el-button type="primary" v-if="currentStep === 3" @click="importStep" :disabled="importFieldsNum === 0 || loading">{{ i18next.t("import") }}</el-button>
            <el-button type="primary" v-if="currentStep === 4" @click="completeStep">{{ i18next.t("complete") }}</el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed, nextTick } from 'vue';
import { ElMessage, UploadRequestOptions } from 'element-plus';
import { UploadFilled, Opportunity } from '@element-plus/icons-vue'
import { NocodeFormData } from '@common/types/nocode';
import { Field, FieldUID, Table, TableColumn, WidgetSoul } from '@common/types/project';
import { CellMerge, ExcelFieldItem, ExcelFileData, ExcelFormColMap, FormFieldType, FormFieldTypeClassify, SheetData } from './type';
import { customDayjs, dataRegex, getWidgets, importExcelData, parseExcelData } from './utils';
import { isSystemField } from '@common/utils/connection';
import { unique } from '@common/utils/unique';
import { FormElement } from '@renderer/b2/controllers/form';
import { SubForm } from './subForm';
import IVenIconImportSuccess from "~icons/ven-icon/widget-form-sub-form-import-success";
import IVenIconImportWarning from "~icons/ven-icon/widget-form-sub-form-import-warning";
import type { Column, Worksheet } from 'exceljs';
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  dialogVisible: boolean,
  subForm: SubForm,
  contentSource: 'tableHeaderValue' | 'nocodeCreateDataDialogValue',
}>();
const emit = defineEmits(['addData','update:dialogVisible', 'closed', 'createForm', 'closeDialog']);
const dialogVisibleComp = computed<boolean>({
  get: () => props.dialogVisible,
  set: (val) => emit('update:dialogVisible', val)
});

const formFields = computed<Field[]>(() => {
  return props.subForm.children.map(child => child.field)?.filter(Boolean);
});

const NOT_IMPORT = i18next.t("importExcelNotImport");
const dialogTitle = computed(() =>
  props.contentSource === 'nocodeCreateDataDialogValue'
    ? i18next.t("importExcelCreateFormTitle")
    : i18next.t("importExcelImportDataTitle")
);

let currentStep = ref(1);
const titleRowIndex = ref(0);
const step2HaveTableData = computed<boolean>(() =>
  !(readExcelFileData.value?.originSheetsData?.[worksheet.value]?.isSheetNull ?? true)
);
const worksheet = ref('')

const readExcelFileData = ref<ExcelFileData | null>();
const sheetsNames = computed<string[]>(() => readExcelFileData.value?.sheets);
const table2Data = computed<SheetData['rows']>(() =>
  readExcelFileData.value?.originSheetsData?.[worksheet.value]?.rows ?? []
);
const excelTypeData = computed<SheetData['typeData']>(() =>
  readExcelFileData.value?.originSheetsData?.[worksheet.value]?.typeData ?? []
);
const excelMergeData = computed<CellMerge[][]>(() =>
  readExcelFileData.value?.originSheetsData?.[worksheet.value]?.mergeData ?? []
);
const titleRadioColMerge = computed<CellMerge[]>(() => {
  let cellMergeArr: CellMerge[] = [];
  excelMergeData.value.forEach((row, rowIndex) => {
    const rowspanArr = row.map(cell => cell.rowspan);
    const minRowspan = Math.min(...rowspanArr);
    if (minRowspan <= 0) {
      cellMergeArr[rowIndex] = { rowspan: 0, colspan: 0 };
    } else {
      const maxRowspan = Math.max(...rowspanArr);
      cellMergeArr[rowIndex] = { rowspan: maxRowspan, colspan: 1 };
    }
  })
  return cellMergeArr;
});
const isTitleRow = (rowIndex: number) => {
  return rowIndex >= titleRowIndex.value
    && rowIndex < titleRowIndex.value + (titleRadioColMerge.value[titleRowIndex.value]?.rowspan ?? 1);
}

const titleRowHeight = computed(() =>
  titleRadioColMerge.value[titleRowIndex.value]?.rowspan ?? 1
);

const uploadProgress = ref(0); // 添加进度状态
const loading = ref<boolean>(false);

const table2Headers = computed<any[]>(() =>
  table2Data.value?.[titleRowIndex.value] ?? []
);

// 计算excel表每列的数据类型
const excelColumnType = computed<string[]>(() => {
  let colTypes: string[] = excelTypeData.value[titleRowIndex.value + titleRowHeight.value] ?? [];
  // 考虑空单元格，遍历全表类型，直至填满colType
  for (let i = titleRowIndex.value + titleRowHeight.value + 1; i < excelTypeData.value.length; i++) {
    if (!colTypes.includes(null)) break;
    const row = excelTypeData.value[i];
    colTypes.forEach((type, colIndex) => { if (!type) colTypes[colIndex] = row[colIndex]; });
  }
  return colTypes;
});

function formatDisplayCellData(cellData: any, rowIndex: number, colIndex: number) {
  let formatCell = JSON.parse(JSON.stringify(cellData));
  if(excelTypeData.value[rowIndex][colIndex] === 'date'){
    formatCell = customDayjs(formatCell)?.format('YYYY-MM-DD HH:mm:ss') ?? formatCell;
  }
  return formatCell ?? '';
}

// 表单名称
const formName = ref<string>('');
// 表单分组
const formGroup = ref('no');
const formGroupOptions = computed(() => [
  {
    value: 'yes',
    label: i18next.t("importExcelHas"),
  },
  {
    value: 'no',
    label: i18next.t("importExcelNone"),
  },
]);
const formWidgets = computed<FormFieldTypeClassify[]>(() => getWidgets());
const types = [
  "widget.form.textInput",
  "widget.form.textarea",
  "widget.form.numberInput",
  "widget.form.serialNumber",
  "widget.form.datePicker",
  "widget.form.dateRangePicker",
  "widget.form.radioGroup",
  "widget.form.checkboxGroup",
  "widget.form.treeSelect",
  "widget.form.treeMultipleSelect",
  "widget.form.memberSelect",
  "widget.form.departmentSelect",
  "widget.form.subform",
  "widget.form.phoneInput",
  "widget.form.address",
  "widget.form.richTextEditor",
  "widget.form.markdownEditor",
];
const formFieldTypes = computed<FormFieldType[]>(() => {
  const result: FormFieldType[] = [{
    type: NOT_IMPORT,
    name: i18next.t("importExcelNotImport"),
  }];
  formWidgets.value.forEach(item => {
    item.children.forEach(child => {
      if (types.includes(child.type)) {
        result.push(child);
      }
    });
  });
  return result;
});
const selectedFieldCountText = computed(() =>
  i18next.t("importExcelSelectedFieldCount", {
    selected: importFieldsNum.value,
    total: totalFieldsNum.value,
  })
);

const handleCloseExcel = () => {
  emit('closeDialog')
  clearDialog();
};

const preStep = () => {
  uploadProgress.value = 0
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

const nextStep = () => {
  if (currentStep.value < 4) {
    currentStep.value++;
  }
}

const shouldTreatFieldAsRequired = (field?: Field | null) => {
  const mode = field?.meta?.extra?.requiredMode;
  if (mode) {
    return mode === 'on' || mode === 'condition';
  }
  return !!field?.meta?.extra?.isRequired;
}

// 导入Excel数据
async function importStep() {
  let curTable: Table;
  let colToUidMap: ExcelFormColMap = {};
  loading.value = true;

  if (props.contentSource === 'nocodeCreateDataDialogValue') {
    let curFormData: NocodeFormData;
    ({ newTable: curTable, curFormData } = await createForm());

    // 构建数据映射关系
    const formTable = curFormData.tables.find(item => item.uid === curTable.uid);
    const formFields = formTable.fields.filter(field => !isSystemField(field));

    importFields.value.forEach((item, index) => {
      colToUidMap[item.excelField] = formFields[index].uid;
    });
  } else if (props.contentSource === 'tableHeaderValue') {
    // 导入Excel表数据
    // curTable = props.table;
    importFields.value.forEach(item => {
      colToUidMap[item.excelField] = item.formField;
    });
  }

  // 将数据添加到表单中
  try {
    const sheetData: SheetData = readExcelFileData.value?.originSheetsData?.[worksheet.value];
    let maxTitleRowIndex = Math.max(...(importFields.value.map(item => item.titleRowIndex)));
    const res = await importExcelData(sheetData, formFields.value, colToUidMap, maxTitleRowIndex, props.subForm);

    importExcelSuccessLength.value = res.successImportCount;  // 导入Excel工作表的数据条数
    importExcelTotalLength.value = res.total;
    res.rows.forEach(row => {
      props.subForm.addRow(undefined, row, true);
    });
  } catch (error) {
    ElMessage.error(i18next.t("importExcelImportFailed"));
    console.error(error);
  }

  loading.value = false;

  if (currentStep.value < 4) {
    currentStep.value++;
  }
}

async function createForm(){
  let newTable: Table;
  let columns: TableColumn[] = [];
  let subformColumns: Record<string, TableColumn[]> = {};
  // 遍历目标名称数组
  for (const field of importFields.value) {
    // 遍历组件列表查找匹配项
    let column: TableColumn = makeColumn(field, columns);
    columns.push(column);
  }

  const colIndex = columns.findIndex(column => column.extra.widgetType === 'widget.form.serialNumber');
  if(colIndex !== -1){
    const serialNumber = parseSerialNumber(columns[colIndex], importFields.value[colIndex], columns, importFields.value);
    columns[colIndex].extra.serialNumber = serialNumber;
  }

  // 生成表单，并等待其完成
  let curFormData: NocodeFormData;
  await new Promise<void>((resolve) => {
    const callback = (formData: NocodeFormData, table: Table) => {
      newTable = table;
      curFormData = formData;
      resolve();
    }
    emit('createForm', formName.value, columns, subformColumns, callback);
  });
  return { newTable, curFormData };
}

function makeColumn(excelField: ExcelFieldItem, columns: TableColumn[]) {
  const subTypeMap = {
    'widget.form.subform': 'subForm',
  };
  const uid = unique();
  // 定义一个允许任意属性的类型结构
  const column: TableColumn = {
    alias: excelField.formFieldTitle,
    extra: { widgetType: excelField.formFieldType },
    name: excelField.formFieldTitle,
    uid: uid,
    type: excelField.excelFieldType === 'number' ? 'number' : 'string',
    subType: subTypeMap[excelField.formFieldType],
  };

  // 找出列名重复项，添加后缀
  const repeatNameCols = columns.filter(col => col.alias === column.name);
  if (repeatNameCols.length) {
    column.name = `${column.name}_${repeatNameCols.length}`;
  }
  return column;
}

function parseSerialNumber(column: TableColumn, excelField: ExcelFieldItem, columns: TableColumn[], excelFields: ExcelFieldItem[]){
  if(excelField.formFieldType !== 'widget.form.serialNumber') return;

  let rules = [];
  // 分隔符，被匹配规则后的子串会被替换为此符号，防止已匹配的子串对后续规则匹配造成影响
  const divideChar = '!';
  let curColIndex = Number(excelField.excelField.replace('col-', ''));
  const firstRowIndex = titleRowIndex.value + titleRowHeight.value;
  const importData = table2Data.value.slice(firstRowIndex, firstRowIndex + 15);
  let autoNumberData: string[] = importData.map(row => row[curColIndex]);
  let tData: string[] = JSON.parse(JSON.stringify(autoNumberData));

  // 解析date规则
  let sortIndex = 0, dateFormat = '';
  let i: number;
  for (i = 0; i < tData.length; i++) {
    if(tData[i] === null) continue;
    const datesInfo = extractDates(tData[i]);
    if (datesInfo.length === 0) break;
    tData[i] = tData[i].replace(datesInfo[0].match, divideChar);
    if (i === 0) {
      sortIndex = datesInfo[0].start;
      dateFormat = datesInfo[0].format;
    }
  }
  if (i === tData.length) {
    rules.push({
      start: sortIndex,
      id: unique(),
      type: 'date',
      value: {
        optionalFormat: 'custom',
        customFormat: dateFormat
      }
    })
  }

  // 解析field规则
  let ruleColIndex: number, isRuleField = false;
  for (let index in excelFields) {
    const item = excelFields[index];
    let colIndex = Number(item.excelField.replace('col-', ''));
    // 跳过对当前自动编号列的匹配
    if(colIndex === curColIndex) continue;
    isRuleField = tData[0]?.includes(importData[0][colIndex]);

    if (isRuleField) {
      let match: RegExpExecArray = new RegExp(importData[0][colIndex], 'g').exec(autoNumberData[0]);
      ruleColIndex = colIndex;
      rules.push({
        start: match.index,
        id: unique(),
        type: 'field',
        value: columns[index].uid,
      });
      break;
    }
  }
  if (isRuleField) {
    tData.forEach((autoNumber, rowIndex) => {
      if(tData[rowIndex] === null) return;
      tData[rowIndex] = tData[rowIndex].replace(importData[rowIndex][ruleColIndex], divideChar);
    });
  }

  // 解析prefix规则
  const ruleChars: string[] = [];
  startCharLoop:
  for (let s = 0; s < tData[0].length; s++) {
    endCharLoop:
    for (let e = tData[0].length; e > s; e--) {
      if(tData[0][s] === divideChar) break endCharLoop;
      const char = tData[0].slice(s, e);

      let dCharMatch: RegExpExecArray = new RegExp(divideChar, 'g').exec(char);
      if(dCharMatch !== null){
        e = s + dCharMatch.index + 1;
        continue;
      }
      // 若匹配到0且后一位也为数字，则判定为counting规则的字符
      if(char[char.length - 1] === '0' && /\d/.test(tData[0][e])){
        let zeroStartIndex = e - 1;
        while (zeroStartIndex > s && char[zeroStartIndex - 1] === '0') {
          zeroStartIndex--;
        }
        e = zeroStartIndex + 1;
        continue;
      }

      let valid = true;
      for (const item of tData) {
        if(item === null) continue;
        let match: RegExpExecArray = new RegExp(char, 'g').exec(item);
        // 匹配到的公共字符不能相距太远
        if(match === null || match.index < s || match.index - s > 2) valid = false;
      }

      if(valid){
        s = e - 1;
        ruleChars.push(char);
      }
    }
  }
  ruleChars.forEach(char => {
    let match: RegExpExecArray = new RegExp(char, 'g').exec(autoNumberData[0]);
    rules.push({
      start: match.index,
      id: unique(),
      type: 'prefix',
      value: char,
    });
    tData.forEach((autoNumber, rowIndex) => {
      if(tData[rowIndex] === null) return;
      tData[rowIndex] = tData[rowIndex].replace(char, '');
      // 只剩下counting规则，去掉所有分隔符号
      tData[rowIndex] = tData[rowIndex].replace(divideChar, '');
    });
  });

  // 解析counting规则
  let digitFixed = !tData.filter(item => item !== null).some(item => item.length > tData[0].length);

  let matchIndexArr: number[] = [];
  autoNumberData.forEach((item, index) => {
    if(tData[index] === null) return;
    let match = new RegExp(tData[index], 'g').exec(autoNumberData[index]);
    matchIndexArr.push(match.index);
  });

  rules.push({
    start: Math.max(...matchIndexArr),
    id: unique(),
    type: 'counting',
    value: {
      digitLength: tData[0].length,
      digitFixed: digitFixed,
      resetCycle: 'none',
      startValue: Number(tData[0]) ?? 0,
    }
  });
  rules = rules.sort((a, b) => a.start - b.start);
  rules.forEach(rule => delete rule.start);
  return { rules };
}

function extractDates(text: string) {
  const datePatterns = [{
    format: 'YYYY-MM-DD HH:mm:ss',
    pattern: /(\d{2,4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2}:\d{1,2})/g,
  }, {
    format: 'YYYY-MM-DD HH:mm',
    pattern: /(\d{2,4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2})/g,
  }, {
    format: 'YYYY/MM/DD HH:mm:ss',
    pattern: /(\d{2,4}\/\d{1,2}\/\d{1,2} \d{1,2}:\d{1,2}:\d{1,2})/g,
  }, {
    format: 'YYYY/MM/DD HH:mm',
    pattern: /(\d{2,4}\/\d{1,2}\/\d{1,2} \d{1,2}:\d{1,2})/g,
  }, {
    format: 'YYYY-MM-DD',
    pattern: /(\d{2,4}-\d{1,2}-\d{1,2})/g,
  }, {
    format: 'YYYY/MM/DD',
    pattern: /(\d{2,4}\/\d{1,2}\/\d{1,2})/g,
  }, {
    format: 'YYYY.MM.DD',
    pattern: /(\d{2,4}\.\d{1,2}\.\d{1,2})/g,
  }];

  let results: { match: string, format: string, start: number, end: number }[] = [];
  let usedIndices = new Set(); // 用于记录已匹配字符的索引，避免重叠匹配

  for (const patternInfo of datePatterns) {
    const pattern = patternInfo.pattern;
    let match: RegExpExecArray;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0];
      const start = match.index;
      const end = start + fullMatch.length;

      // 检查这个匹配的范围是否已经被更优先的格式匹配过
      let isOverlapping = false;
      for (let i = start; i < end; i++) {
        if (usedIndices.has(i)) {
          isOverlapping = true;
          break;
        }
      }
      // 如果没有重叠，则添加到结果中，并标记这些索引已被使用
      if (!isOverlapping) {
        results.push({
          match: fullMatch,
          format: patternInfo.format,
          start: start,
          end: end
        });
        for (let i = start; i < end; i++) {
          usedIndices.add(i);
        }
      }
    }
  }
  results.sort((a, b) => a.start - b.start);
  return results;
}

const completeStep = () => {
  emit('closeDialog')
  clearDialog();
}

// 步骤1，步骤2
const handleBeforeUpload = (file) => {
  const fileType = file.name.split('.').pop().toLowerCase();
  const isValidType = ['xls', 'xlsx'].includes(fileType);
  if (!isValidType) {
    ElMessage.error(i18next.t("importExcelOnlyExcelFiles"));
    return false; // 阻止文件上传
  }
  return true;  // 允许文件上传
};

const handleFieldChange = (fieldId: FieldUID, currentIndex: number, excelFieldItem: ExcelFieldItem) => {
  // 选中某个映射字段时，检查是否已经被选中。若有，则将原项改为不导入，当前项改为选中。
  let ef: ExcelFieldItem[] = excelFields.value;
  const selectedItem = ef.find((excelField, index) =>
    excelField.formField === fieldId && index !== currentIndex
  );
  if(selectedItem) selectedItem.formField = NOT_IMPORT;
};
const getFilteredOptions = (index: number, excelFieldItem: ExcelFieldItem) => {
  let options: Field[] = [{ alias: i18next.t("importExcelNotImport"), uid: NOT_IMPORT }] as unknown as Field[];
  options = options.concat(formFields.value);

  // 为必填字段添加 '*' 前缀
  return options.map(option => {
    if (shouldTreatFieldAsRequired(option) && option.uid !== NOT_IMPORT) {
      return {
        ...option,
        alias: '<span style="color: red;">*</span>' + option.alias
      };
    }
    return option;
  });
};
const isOptionDisabled = (option: Field, currentIndex: number, excelFieldItem: ExcelFieldItem) => {
  // "自动编号"字段永远禁用
  if (option.meta?.extra?.widgetType === 'widget.form.serialNumber') return true;
  return false;
};

const uploadFile = async (options: UploadRequestOptions) => {
  loading.value = true
  currentStep.value = 2
  // 解析excel
  try {
    readExcelFileData.value = await parseExcelData(options.file);
    initTable2();
  } catch (error) {
    ElMessage.error(i18next.t("importExcelParseFailed"));
    console.error(error);
  }

  loading.value = false;
}
const importExcelSuccessLength = ref(0);
const importExcelTotalLength = ref<number>(null);

// 监听 worksheet
watch(() => worksheet.value, (newVal, oldVal) => {
  titleRowIndex.value = 0;
});

watch(() => [titleRowIndex.value, table2Data.value], ([newVal1, newVal2]) => {
  initExcelFields();
});

const excelTypeMap: Record<string, string[]> = {
  number: ['widget.form.numberInput'],
  string: ['widget.form.textInput', 'widget.form.textarea', 'widget.form.phoneInput', 'widget.form.radioGroup', 'widget.form.treeSelect'],
  boolean: ['widget.form.switch'],
  date: ['widget.form.datePicker']
};

function initExcelFields() {
  excelFields.value = [];
  // 初步映射表格字段类型
  const selectedFields: Field[] = [];
  table2Headers.value?.forEach?.((title, index) => {
    let specialFieldType: string, realTitleRowIndex: number;
    ({ specialFieldType, title, titleRowIndex: realTitleRowIndex } = flattenTitleRow(title, index, titleRowIndex.value));

    let type = excelColumnType.value[index];
    let matchField: Field;
    if (props.contentSource === 'tableHeaderValue') {
      const correctTypeArr = specialFieldType ? [specialFieldType] : excelTypeMap[type];
      matchField = matchFormField(correctTypeArr, title, formFields.value, selectedFields);
    }

    excelFields.value.push({
      excelField: `col-${index}`,
      excelFieldTitle: title,
      excelFieldType: type,
      titleRowIndex: realTitleRowIndex,
      formField: matchField?.uid ?? NOT_IMPORT,
      formFieldTitle: title,
      formFieldType: specialFieldType ?? excelTypeMap[type]?.[0] ?? NOT_IMPORT,
    });
  });
}
type DownloadInfo = {
  url: string,
  name?: string,
  target?: "_blank" | "_parent" | "_top",
}
/**
 * 根据列索引获取对应的Excel列字母
 * @param colIndex 列索引（从0开始）
 * @returns 对应的Excel列字母
 * @example
 * getColumnLetter(0) => 'A'
 * getColumnLetter(25) => 'Z'
 * getColumnLetter(26) => 'AA'
 */
const getColumnLetter = (colIndex: number): string => {
  if (colIndex < 0) throw new Error(i18next.t("importExcelNegativeColumnIndex"));

  let dividend = colIndex + 1;
  let columnName = '';

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
}
const defineDateFormat = 'yyyy-mm-dd';
type newField = Field & { extra?: any };
interface SetColumnStyleParams {
  worksheet: Worksheet;
  column: Column;
  field: newField;
}
const reservedRowsCurrentCount = 10;
const setColumnAssetMap = computed(() => ({
  "widget.form.textInput": {
    exampleRow: i18next.t("importExcelExampleName"),
    descriptionText: i18next.t("importExcelDescriptionText"),
  },
  "widget.form.textarea": {
    exampleRow: i18next.t("importExcelExampleTextarea"),
    descriptionText: i18next.t("importExcelDescriptionText"),
  },
  "widget.form.numberInput": {
    exampleRow: 123.456,
    descriptionText: i18next.t("importExcelDescriptionNumber"),
  },
  "widget.form.datePicker": {
    exampleRow: '2000-01-01',
    descriptionText: i18next.t("importExcelDescriptionDate"),
  },
  "widget.form.dateRangePicker": {
    exampleRow: '2000-01-01,2025-01-01',
    descriptionText: i18next.t("importExcelDescriptionDateRange"),
  },
  "widget.form.radioGroup": {
    exampleRow: i18next.t("importExcelExampleSingleOption"),
    descriptionText: i18next.t("importExcelDescriptionSingleOption"),
  },
  "widget.form.checkboxGroup": {
    exampleRow: i18next.t("importExcelExampleMultipleOption"),
    descriptionText: i18next.t("importExcelDescriptionMultipleOption"),
  },
  "widget.form.treeSelect": {
    exampleRow: i18next.t("importExcelExampleSingleOption"),
    descriptionText: i18next.t("importExcelDescriptionSingleOption"),
  },
  "widget.form.treeMultipleSelect": {
    exampleRow: i18next.t("importExcelExampleMultipleOption"),
    descriptionText: i18next.t("importExcelDescriptionMultipleOption"),
  },
  "widget.form.memberSelect": {
    exampleRow: i18next.t("importExcelExampleMember"),
    descriptionText: i18next.t("importExcelDescriptionMember"),
  },
  "widget.form.departmentSelect": {
    exampleRow: i18next.t("importExcelExampleDepartment"),
    descriptionText: i18next.t("importExcelDescriptionDepartment"),
  },
  "widget.form.phoneInput": {
    exampleRow: '13333333333',
    descriptionText: i18next.t("importExcelDescriptionPhone"),
  },
  "widget.form.address": {
    exampleRow: i18next.t("importExcelExampleAddress"),
    descriptionText: i18next.t("importExcelDescriptionAddress"),
  },
  "widget.form.rate": {
    exampleRow: '5',
    descriptionText: i18next.t("importExcelDescriptionRate"),
  },
  "widget.form.position": {
    exampleRow: i18next.t("importExcelExamplePosition"),
    descriptionText: i18next.t("importExcelDescriptionPosition"),
  },
  "widget.form.tagInput": {
    exampleRow: i18next.t("importExcelExampleTag"),
    descriptionText: i18next.t("importExcelDescriptionTag"),
  },
  "widget.form.image-uploader": {
    exampleRow: 'https://example.com/image.png',
    descriptionText: i18next.t("importExcelDescriptionImage"),
  },
  "widget.form.file-uploader": {
    exampleRow: 'https://example.com/file.pdf',
    descriptionText: i18next.t("importExcelDescriptionFile"),
  },
  "widget.form.switch": {
    exampleRow: i18next.t("importExcelExampleSwitchOn"),
    descriptionText: i18next.t("importExcelDescriptionSwitch"),
  },
  "widget.form.hyperlink": {
    exampleRow: 'https://www.banban.com',
    descriptionText: i18next.t("importExcelDescriptionHyperlink"),
  },
}));
const setColumnStyleMap = {
  'widget.form.numberInput': (option: SetColumnStyleParams) => {
    const { column, field } = option;

    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'decimal',
        operator: 'between',
        allowBlank: true,
        formulae: [-1.7976931348623157E+308], // Excel中最小的负数

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptNumberTitle"),
        prompt: i18next.t("importExcelPromptNumber"),
      }
    });
    return column;
  },
  'widget.form.datePicker': (option: SetColumnStyleParams) => {
    const { column, field } = option;
    column.style.numFmt = defineDateFormat;

    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'date',
        operator: 'between',
        allowBlank: true,
        formulae: [new Date('1900-01-01'), new Date('9999-12-31')],

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptDateTitle"),
        prompt: i18next.t("importExcelPromptDate"),
      }
    });
    return column;
  },
  'widget.form.dateRangePicker': (option: SetColumnStyleParams) => {
    const { column, field } = option;
    column.style.numFmt = `${defineDateFormat},${defineDateFormat}`;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptDateRangeTitle"),
        prompt: i18next.t("importExcelPromptDateRange"),
      }
    });
    return column;
  },
  'widget.form.switch': (option: SetColumnStyleParams) => {
    const { worksheet, column, field } = option;

    const statusOptions = ['true', 'false'];
    const optionStr = statusOptions.join(',');

    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${optionStr}"`],
        operator: 'equal',
        errorStyle: 'error',
        errorTitle: i18next.t("importExcelPromptHintTitle"),
        error: i18next.t("importExcelPromptSelectError"),
      }
    })
    return column;
  },
  'widget.form.treeSelect': (option: SetColumnStyleParams) => {
    const { column, field } = option;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptTreeSelectTitle"),
        prompt: i18next.t("importExcelPromptTreeSelect"),
      }
    })
    return column;
  },
  'widget.form.checkboxGroup': (option: SetColumnStyleParams) => {
    const { column, field } = option;

    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptCheckboxTitle"),
        prompt: i18next.t("importExcelPromptCheckbox"),
      }
    })
    return column;
  },
  'widget.form.treeMultipleSelect': (option: SetColumnStyleParams) => {
    const { column, field } = option;

    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptTreeMultipleTitle"),
        prompt: i18next.t("importExcelPromptTreeMultiple"),
      }
    })
    return column;
  },
  'widget.form.phoneInput': (options: SetColumnStyleParams) => {
    const { column, field } = options;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'equal',
        allowBlank: true,
        formulae: [11],
        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptPhoneTitle"),
        prompt: i18next.t("importExcelPromptPhone"),
      }
    })
    return column;
  },
  "widget.form.rate": (options: SetColumnStyleParams) => {
    const { column, field } = options;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'whole',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptHintTitle"),
        prompt: i18next.t("importExcelPromptRate"),
      }
    })
    return column;
  },
  "widget.form.tagInput": (options: SetColumnStyleParams) => {
    const { column, field } = options;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptTagTitle"),
        prompt: i18next.t("importExcelPromptTag"),
      }
    })
    return column;
  },
  "widget.form.radioGroup": (options: SetColumnStyleParams) => {
    const { column, field } = options;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'textLength',
        allowBlank: true,
        formulae: [0, 100],
        operator: 'between',

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptRadioTitle"),
        prompt: i18next.t("importExcelPromptRadio"),
      }
    })
    return column;
  },
  "widget.form.memberSelect": (options: SetColumnStyleParams) => {
    const { column, field } = options;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptMemberTitle"),
        prompt: i18next.t("importExcelPromptMember"),
      }
    })

    return column;
  },
  "widget.form.departmentSelect": (options: SetColumnStyleParams) => {
    const { column, field } = options;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: i18next.t("importExcelPromptDepartmentTitle"),
        prompt: i18next.t("importExcelPromptDepartment"),
      }
    })

    return column;
  },
};
const doDownload = (info: DownloadInfo) => {
  if (info) {
    const a = document.createElement("a");
    // 指定生成的文件名
    info.name && (a.download = info.name);
    info.target && (a.target = info.target);
    a.href = info.url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    ElMessage.warning(i18next.t("importExcelDownloadFailed"));
  }
}
const downloadTemplate = async () => {
  const soul = props.subForm.getSoul();

  const tableName = soul?.options['title-text'] || soul?.name;

  const blob = await createTemplateByFieldArr(props.subForm.children);

  // 创建下载链接
  const downloadUrl = URL.createObjectURL(blob);
  doDownload({
    url: downloadUrl,
    name: i18next.t("importExcelTemplateFileName"),
  });
}
const createTemplateByFieldArr = async (widgetSoul: FormElement[]) => {
  const ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default;
  // 创建工作簿
  const workbook = new ExcelJS.Workbook();
  // const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('sheet1');
  const descriptionSheet = workbook.addWorksheet(i18next.t("importExcelTemplateSheetDescription"))

  const firstRow = [];
  // 设置列的类型
  const columnStyles = [];
  const descriptionExampleRow = [i18next.t("importExcelTemplateDataExample")]
  const descriptionRow = [i18next.t("importExcelTemplateFieldDescription")]

  widgetSoul.forEach((widget, colIndex) => {
    const key = widget.type;
    const colLetter = getColumnLetter(colIndex);

    firstRow.push(widget.title || widget.name || ""); // 设置表头

    const colStyleFun = setColumnStyleMap[key];
    if (colStyleFun) {
      columnStyles.push({
        colLetter,
        colStyleFun,
        widget,
      });
    }
    const asset = setColumnAssetMap.value[key]
    if (asset) {
      descriptionExampleRow.push(asset.exampleRow)
      descriptionRow.push(asset.descriptionText)
    } else {
      descriptionExampleRow.push('')
      descriptionRow.push('')
    }
  });

  worksheet.addRow(firstRow);

  // 遍历setColumnAssetMap中的所有字段类型
  const descriptionRow1 = [i18next.t("importExcelTemplateFieldType")];
  const descriptionRow2 = [i18next.t("importExcelTemplateDataExample")];
  const descriptionRow3 = [i18next.t("importExcelTemplateFieldDescription")];

  Object.keys(setColumnAssetMap.value).forEach((key) => {
    // 查找对应字段类型的名字
    let fieldName = key;
    formWidgets.value.forEach(category => {
      const fieldType = category.children?.find(type => type.type === key);
      if (fieldType) {
        fieldName = fieldType.name;
      }
    });
    descriptionRow1.push(fieldName);
    descriptionRow2.push(setColumnAssetMap.value[key].exampleRow);
    descriptionRow3.push(setColumnAssetMap.value[key].descriptionText);
  });

  descriptionSheet.addRow(descriptionRow1);
  descriptionSheet.addRow(descriptionRow2);
  descriptionSheet.addRow(descriptionRow3);

  for (let i = 0; i < reservedRowsCurrentCount; i++) {
    worksheet.addRow([]);
  }

  columnStyles.forEach((item) => {
    const column = worksheet.getColumn(item.colLetter);
    item.colStyleFun({
      worksheet,
      column,
      field: item.widget,
    });
  })

  // 生成 ArrayBuffer
  const buffer = await workbook.xlsx.writeBuffer() as ArrayBuffer;

    // 转为 Blob 并下载
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return blob
}

function flattenTitleRow(title: any, colIndex: number, titleRowIndex: number) {
  let specialFieldType = identifySpecialFieldType(title, colIndex, titleRowIndex);
  // 子表单中若仍然有字段识别为子表单，则将此合并单元格下一行的单元格作为当前子表单字段
  if (specialFieldType === 'widget.form.subform' || specialFieldType === 'beMergedCell') {
    const { rowspan: curTitleHeight } = excelMergeData.value[titleRowIndex][colIndex];
    title = table2Data.value[titleRowIndex + curTitleHeight][colIndex];
    ({ specialFieldType, title, titleRowIndex } = flattenTitleRow(title, colIndex, titleRowIndex + curTitleHeight));
  }
  return { specialFieldType, title, titleRowIndex };
}

// 辨别导入的特殊字段（e.g.子表单字段）
function identifySpecialFieldType(colTitle: any, colIndex: number, titleRowIndex: number) {
  let specialFieldType: string;
  const { colspan, rowspan } = excelMergeData.value[titleRowIndex]?.[colIndex] ?? { colspan: 1, rowspan: 1 };
  const firstRowIndex = titleRowIndex + rowspan;
  // 取前15条数据，用于映射字段时的格式验证
  const importData = table2Data.value.slice(firstRowIndex, firstRowIndex + 15);

  const specialTypeValidator = [{
    type: 'beMergedCell',
    validator: () => colspan === 0 || rowspan === 0,
  }, {
    type: 'widget.form.subform',
    validator: () => colspan > 1 && rowspan > 0,
  }, {
    type: 'widget.form.phoneInput',
    validator: () => {
      let titleVaild = ['手机'].some(item => colTitle?.includes(item));
      if (titleVaild) return titleVaild;
      let dataValid = importData.some(item => dataRegex.phone.test(item[colIndex]?.trim?.()));
      return titleVaild || dataValid;
    },
  }, {
    type: 'widget.form.address',
    validator: () => {
      let titleVaild = ['地址','地点'].some(item => colTitle?.includes(item));
      if (titleVaild) return titleVaild;
      let dataValid = importData.some(item => dataRegex.address.test(item[colIndex]?.trim?.()));
      return titleVaild || dataValid;
    },
  }, {
    type: 'widget.form.memberSelect',
    validator: () => ['成员', '人员'].some(item => colTitle?.includes(item)),
  }, {
    type: 'widget.form.departmentSelect',
    validator: () => ['部门'].some(item => colTitle?.includes(item)),
  }, {
    type: 'widget.form.datePicker',
    validator: () => {
      let typeValid = excelColumnType.value[colIndex] === 'date';
      if (typeValid) return typeValid;
      let dataValid = importData.some(item => customDayjs(item[colIndex])?.isValid());
      return typeValid || dataValid;
    },
  }, {
    type: 'widget.form.dateRangePicker',
    validator: () => {
      let dataValid = importData.some(item => {
        let valid = true;
        let timeArr: any[] = item[colIndex]?.split(',');
        if (!Array.isArray(timeArr) || timeArr.length !== 2) {
          valid = false;
        } else {
          valid = timeArr.every(time => customDayjs(time)?.isValid());
        }
        return valid;
      });
      return dataValid;
    },
  }];
  specialFieldType = specialTypeValidator.find(valid => valid.validator())?.type;
  return specialFieldType;
}

function matchFormField(typeArr: string[], title: string, formFields: Field[], selectedFields: Field[]): Field {
  const bannedWidgets = ['widget.form.serialNumber'];
  let matchField = formFields.find(field => {
    const aliasValid = title === field.alias;
    const repeatValid = !selectedFields.find(f => f.uid === field.uid);
    const bannedValid = !bannedWidgets.includes(field.meta?.extra?.widgetType);
    return aliasValid && repeatValid && bannedValid;
  });
  if (matchField) selectedFields.push(matchField);
  return matchField;
}

function initTable2(){
  if(!readExcelFileData.value) return ;
  titleRowIndex.value = 0;
  formName.value = readExcelFileData.value.fileName;
  nextTick(() => {
    worksheet.value = sheetsNames.value[0];
  });
}

function clearDialog(){
  worksheet.value = '';
  readExcelFileData.value = null;
  formName.value = '';
  uploadProgress.value = 0
  currentStep.value = 1
}

// 步骤3
const excelFields = ref<ExcelFieldItem[]>([]);
const excelFieldsForTemplate = computed<ExcelFieldItem[]>({
  get: () => {
    let ef: ExcelFieldItem[] = [];
    excelFields.value.forEach(item => {
      ef.push(item);
    });
    return ef;
  },
  set: (val) => { }
});
const importFieldsNum = ref(0)
const totalFieldsNum = computed<number>(() => table2Headers?.value?.length ?? 0);

// 使用泛型明确 ref 的值类型
const importFields = ref<ExcelFieldItem[]>([]);

watch(
  excelFields,
  (newVal, oldVal) => {
    importFields.value = [];
    excelFields.value.forEach(item => {
      const validator = (item: ExcelFieldItem) => {
        if (props.contentSource === 'nocodeCreateDataDialogValue')
          return item.formFieldType !== NOT_IMPORT
        else if (props.contentSource === 'tableHeaderValue')
          return item.formField !== NOT_IMPORT
      };

      const newItem: ExcelFieldItem = JSON.parse(JSON.stringify(item));
      if (validator(newItem)) importFields.value.push(newItem);
    });
    importFieldsNum.value = importFields.value.length;
  },
  { deep: true } // 开启深度监听
);

// 将方法暴露给父组件
defineExpose({
  handleCloseExcel,
})
</script>

<style lang="scss" scoped>
:deep(.el-button) {
  border-radius: 4px;
}
input {
  background-color: transparent;
}

.import-excel-dialog {
  :deep(.el-dialog){
    border-radius: 4px;
    background-color: var(--bg-color-page);
    padding: 0px;

    .el-select.not-import {
      :deep(.el-select__placeholder) {
        color: var(--color-primary);
      }
    }

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
}

// 导入Excel弹窗
.popup-content {
  .popup-body {
    padding: 32px 16px;
    .scrollable-table::-webkit-scrollbar{
      width: 8px;
      height: 8px;
    }
    // 步骤指示器
    .steps-container {
      position: relative;
      margin-bottom: 32px;

      .steps {
        display: flex;
        align-items: center;
        position: relative;

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 25%;
          position: relative;
          z-index: 2;
          white-space: nowrap; /* 防止文字换行 */

          .step-number {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: var(--text-color-secondary);
            color: var(--color-white);
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 8px;
            transition: background-color 0.3s ease;
          }

          .step-text {
            font-size: 14px;
            color: var(--text-color-secondary);
            transition: color 0.3s ease;
          }
        }

        .active .step-number {
          background-color: var(--color-primary);
        }

        .active .step-text {
          color: var(--text-color-regular);
        }

        .step-connector {
          flex: 1;
          height: 1px;
          background-color: var(--text-color-secondary);
          margin: 0 1px; /* 关键调整：为连接线两侧留出空隙 */
          min-width: 220px; /* 防止连接线因空间不足而消失 */
          position: relative;
          top: -10px; /* 向上移动2px，根据实际情况调整 */
          z-index: 1;
        }

        .step-connector.active {
          background-color: var(--color-primary); /* 激活时直接变为蓝色 */
        }
      }
    }

    // 步骤内容
    .step-content {
      margin-top: 30px;
    }
    // 步骤1
    .step1-content {

      .step1-content-tip {
        margin-bottom: 10px;

        p {
          margin-bottom: 2px;
          color: var(--text-color-secondary);
        }
      }

      .drag-upload-content {
        height: 219px;
        display: flex;
        justify-content: center;

        .drag-upload-content-item {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;

          .el-icon--upload {
            margin-top: 10px;
            font-size: 32px;
          }
        }

        .upload-progress {
          margin-top: 120px;
          width: 450px;

          .progress-bar {
            margin-bottom: 20px;
          }
          .progress-text {
            color: var(--text-color-secondary);
          }
        }
      }
    }

    // 步骤2
    .step2-content {

      .worksheet-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 50px;

        .info {
          display: flex;
          align-items: center;
          color: var(--text-color-secondary);

          .info-icon {
            margin-right: 5px;
            color: var(--text-color-secondary);
          }
        }
      }

      // 表格有数据时
      .table-container {
        margin-top: 15px;
        height: 370px;

        .scrollable-table {
          height: 370px;
          max-height: 370px; /* 保留垂直滚动限制 */
          overflow: auto;
          /* 可选：添加边框或阴影，区分滚动区域 */
          border: 1px solid var(--border-color);

          .data-table2 {
            min-width: 100%; /* 确保表格在列数少时至少占满容器 */
            // height: 370px;
            border-collapse: collapse;
            /* 为表格行设置样式 */
            tr {
              height: 20px;
              line-height: 20px;
              .el-radio.title-row-radio{
                margin-right: 0px;
                height: auto;
                position: relative;
                top: 2px;
              }
              td.index-cell{
                min-width: 64px;
                max-width: 64px;
              }

              &.title-row{
                background-color: var(--el-color-primary-light-9);
              }

              &.disabled{
                color: var(--text-color-disabled);
              }
            }
          }
        }
      }

      // 表格没有数据时
      .empty-table-alert {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 370px; /* 可以根据实际需求调整高度 */
        border: 1px dashed var(--border-color); /* 虚线边框 */
        background-color: var(--bg-color-page);
        margin-top: 15px;

        .alert-icon {
          margin-bottom: 10px;
          color: var(--el-color-warning); /* 警告颜色 */
        }

        .alert-message {
          color: var(--text-color-secondary);
          font-size: 16px;
        }
      }
    }

    // 步骤3
    .step3-content {
      .form-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 50px;
        // margin-bottom: 20px;

        .form-header-left {
          display: flex;

          .form-name {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-right: 20px;

            .el-input {
              width: 240px;
            }
          }
          .form-group {
            display: flex;
            justify-content: center;
            align-items: center;

            .el-select {
              width: 240px;
            }
          }
        }
      }
      .step3-table-container {
        height: 370px;
        margin-top: 15px;
        // 啦啦啦啦啦啦啦
        .scrollable-table {
          height: 370px;
          max-height: 370px;
          overflow-y: auto;
          /* 可选：添加边框或阴影，区分滚动区域 */
          border: 1px solid var(--border-color);

          .step3-table {
            &table {
              border-collapse: collapse;
              table-layout: auto;
              width: 100%; /* 可根据实际情况设置表格总宽度 */
            }
            tr.subform-item{
              td:first-child {
                position: relative;

                .form-group {
                display: flex;
                margin-left: 24px;

                &::before {
                  position: absolute;
                  content: "";
                  display: inline-block;
                  width: 6px;
                  height: 6px;
                  background-color: var(--text-color-placeholder);
                  border-radius: 50%;
                  left: 12px;
                  top: 50%;
                  transform: translateY(-50%);
                }
              }
              }
            }
            tr.not-import {
              td, :deep(.el-input__wrapper), :deep(.el-select__wrapper){
                background-color: var(--bg-color-overlay);
              }
            }
            .step3-table-td2 {
              min-width: 48px;
            }
            input, .el-select {
              width: 280px;

              &.not-import {
                :deep(.el-select__placeholder) {
                  color: var(--color-primary);
                }
              }
            }
          }
        }
      }
    }

    // 步骤4
    .step4-content {
      .import-complete-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 435px; /* 可以根据实际需求调整高度 */
        border: 1px dashed var(--border-color); /* 虚线边框 */
        background-color: var(--bg-color-page);

        .check-circle {
          margin-bottom: 16px;
          .check-icon {
            font-size: 64px;
          }
        }

        .import-complete-text {
          font-size: 14px;
          color: var(--text-color-regular);
          .failed-count{
            color: var(--color-error);
          }
        }
      }
    }
  }

  .popup-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-top: 1px solid var(--border-color);
  }
}
// 表格公共样式
/* 表格整体样式 */
table {
  width: 100%;
  border-collapse: collapse;
  // height: 393px;
}

/* 表格单元格样式 */
th,
td {
  border: 1px solid var(--border-color);
  padding: 8px;
  text-align: center;
  vertical-align: middle;
  height: 20px;
  min-width: 120px;
  max-width: 240px;
}

/* 输入框样式 */
:deep(.el-input) {
  .el-input__wrapper {
    border-radius: 4px;
  }
}

:deep(.el-select) {
  .el-select__wrapper {
    border-radius: 4px;
  }
}

// 公共样式
.label {
  margin-right: 10px;
}

a:hover {
  text-decoration: underline;
}
</style>
