<template>
  <div class="import-excel-dialog">
    <el-dialog v-model="dialogVisibleComp" width="1000px" :close-on-click-modal="false" draggable :title="dialogTitle"
      :before-close="handleCloseExcel" align-center @opened="handleOpened"
    >
      <div class="popup-content">
        <div class="popup-body">
          <!-- 步骤指示器（新建表单时） -->
          <div class="steps-container" v-if="isCreateMode">
            <div class="steps">
              <div class="step" :class="{ active: currentStep >= 1 }">
                <div class="step-number">1</div>
                <div class="step-text">{{ $t("ImportExcelDialog.selectExcel") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 2, 'nocode-create-data': props.contentSource === 'nocodeCreateDataDialogValue' }"></div>
              <div class="step" :class="{ active: currentStep >= 2 }">
                <div class="step-number">2</div>
                <div class="step-text">{{ $t("ImportExcelDialog.previewData") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 3, 'nocode-create-data': props.contentSource === 'nocodeCreateDataDialogValue' }"></div>
              <div class="step" :class="{ active: currentStep >= 3 }">
                <div class="step-number">3</div>
                <div class="step-text">{{ $t("ImportExcelDialog.setForm") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 4, 'nocode-create-data': props.contentSource === 'nocodeCreateDataDialogValue' }"></div>
              <div class="step" :class="{ active: currentStep >= 4 }">
                <div class="step-number">4</div>
                <div class="step-text">{{ $t("ImportExcelDialog.importData") }}</div>
              </div>
            </div>
          </div>
          <!-- 步骤指示器（导入数据时） -->
          <div class="steps-container" v-else-if="isImportMode">
            <div class="steps">
              <div class="step" :class="{ active: currentStep >= 1 }">
                <div class="step-number">1</div>
                <div class="step-text">{{ $t("ImportExcelDialog.selectExcel") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 2 }"></div>
              <div class="step" :class="{ active: currentStep >= 2 }">
                <div class="step-number">2</div>
                <div class="step-text">{{ $t("ImportExcelDialog.previewData") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 3 }"></div>
              <div class="step" :class="{ active: currentStep >= 3 }">
                <div class="step-number">3</div>
                <div class="step-text">{{ $t("ImportExcelDialog.fieldMap") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 4 }"></div>
              <div class="step" :class="{ active: currentStep >= 4 }">
                <div class="step-number">4</div>
                <div class="step-text">{{ $t("ImportExcelDialog.modeSelect") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 5 }"></div>
              <div class="step" :class="{ active: currentStep >= 5 }">
                <div class="step-number">5</div>
                <div class="step-text">{{ $t("ImportExcelDialog.importData") }}</div>
              </div>
            </div>
          </div>
          <div class="steps-container" v-else>
            <div class="steps">
              <div class="step" :class="{ active: currentStep >= 1 }">
                <div class="step-number">1</div>
                <div class="step-text">{{ $t("ImportExcelDialog.selectExcel") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 2 }"></div>
              <div class="step" :class="{ active: currentStep >= 2 }">
                <div class="step-number">2</div>
                <div class="step-text">{{ $t("ImportExcelDialog.previewData") }}</div>
              </div>
              <div class="step-connector" :class="{ active: currentStep >= 3 }"></div>
              <div class="step" :class="{ active: currentStep >= 3 }">
                <div class="step-number">3</div>
                <div class="step-text">{{ $t('importExcelDialog.analysisConfirm') }}</div>
              </div>
            </div>
          </div>
          <!-- 步骤内容 -->
          <div class="step-content">
            <div v-if="currentStep === 1" class="step1-content" :class="{ 'has-selected-excel': hasSelectedExcel }">
              <div class="step1-content-tip">
                <p>{{ $t("ImportExcelDialog.uploadGuide") }}{{ getI18nLabelColon() }} <a style="color: #1F77FC;" target="_blank" @click="downloadTemplate">{{ $t("ImportExcelDialog.downloadTemplate") }}</a></p>
                <p>· {{ $t("ImportExcelDialog.onlySupportImportFile") }}</p>
                <p>· {{ $t("ImportExcelDialog.notSupportMerge") }}</p>
                <p>· {{ $t("ImportExcelDialog.notSupportFormula") }}</p>
                <p>· {{ $t("ImportExcelDialog.maxDatarow") }}</p>
                <p>· {{ $t("ImportExcelDialog.notMatchCannotImport") }}</p>
                <p>· {{ $t("ImportExcelDialog.moreDetailOperation") }}<a style="color: #1F77FC;" href="https://www.banban.work/docs/v1/ygxgkwimrnyt3ehs" target="_blank">{{ $t("ImportExcelDialog.viewGuide") }}</a></p>
              </div>
              <el-upload
                class="drag-upload"
                drag
                accept=".xlsx,.xls,.zip"
                :show-file-list="false"
                :before-upload="handleBeforeUpload"
                :http-request="uploadFile"
              >
                <div class="drag-upload-content" v-loading="loading">
                  <div v-if="uploadProgress === 0" class="drag-upload-content-item">
                    <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                    <div class="el-upload__text" style="color: #A1A1A1;">
                      {{ $t("ImportExcelDialog.dragHere") }}<em style="color: #1F77FC;">{{ $t("ImportExcelDialog.clickToAdd") }}</em>
                    </div>
                  </div>
                </div>
              </el-upload>
              <div v-if="hasSelectedExcel" class="step1-selected-file-card">
                <div class="step1-selected-file-card__main">
                  <div class="step1-selected-file-card__icon">
                    <el-icon><UploadFilled /></el-icon>
                  </div>
                  <div class="step1-selected-file-card__content">
                    <div class="step1-selected-file-card__title">
                      {{ selectedExcelFileName }}
                    </div>
                    <div class="step1-selected-file-card__meta">{{ $t('importExcelDialog.autoImportedExcelTip') }}</div>
                  </div>
                </div>
                <div class="step1-selected-file-card__status">{{ $t('importExcelDialog.selected') }}</div>
              </div>
            </div>
            <div v-if="currentStep === 2" class="step2-content">
              <div>
                <div class="worksheet-header">
                  <div class="worksheet-dropdown">
                    <label class="label">{{ $t("ImportExcelDialog.worksheet") }}</label>
                    <el-select v-model="worksheet" :placeholder="$t('ImportExcelDialog.selectWorksheet')" style="width: 240px">
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
                    {{ $t("ImportExcelDialog.aboveTitleRowNotImport") }}
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
                                <span v-if="titleRowIndex === rowIndex">{{ $t("ImportExcelDialog.titleRow") }}</span>
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
                                {{ $t("ImportExcelDialog.onlySupportThirty") }}
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
                        <!-- 这里使用一个简单的图标表示警告 -->
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          class="feather feather-alert-triangle"
                        >
                          <!-- 实心三角形（使用fill） -->
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="currentColor"></path>
                          <!-- 感叹号（使用stroke保持线条） -->
                          <line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2" stroke-linecap="round"></line>
                          <circle cx="12" cy="17" r="1" fill="white"></circle> <!-- 底部圆点 -->
                        </svg>
                      </div>
                      <p class="alert-message">{{ $t("ImportExcelDialog.tableEmpty") }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="currentStep === 3" class="step3-content">
              <div id="app" v-if="isCreateMode">
                  <!-- 表单头部信息 -->
                  <div class="form-header">
                      <div class="form-header-left">
                      <div class="form-name">
                          <label>{{ $t("ImportExcelDialog.tableName") }}{{ getI18nLabelColon() }}</label>
                          <el-input class="el-input" v-model="formName" :placeholder="$t('ImportExcelDialog.inputTableName')" />
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
                      <span style="font-size: 12px; color: #A1A1A1;">{{ $t("ImportExcelDialog.import") }} {{ importFieldsNum }} {{ $t("ImportExcelDialog.fieldNum") }} / {{ $t("ImportExcelDialog.total") }} {{ totalFieldsNum }} {{ $t("ImportExcelDialog.fieldNum") }}</span>
                  </div>
                  <!-- 添加带滚动条的容器 -->
                  <div class="step3-table-container-create">
                    <div class="scrollable-table">
                        <table class="step3-table">
                        <thead>
                            <tr>
                            <th>{{ $t("ImportExcelDialog.excelField") }}</th>
                            <th class="step3-table-td2">&gt;</th>
                            <th>{{ $t("ImportExcelDialog.formFieldTitle") }}</th>
                            <th class="step3-table__field-type-cell">{{ $t("ImportExcelDialog.formFieldType") }}</th>
                            <th class="step3-table__validation-cell">
                              <div style="display: flex; justify-content: center; align-items: center;">
                                <span style="margin-right: 4px;">{{ $t("ImportExcelDialog.fieldMatch") }}</span>
                                <el-tooltip placement="bottom-start" effect="light">
                                  <template #content>
                                    <div style="max-width: 200px;">{{ $t("ImportExcelDialog.matchTip") }}</div>
                                  </template>
                                  <div class="tip-icon" @click.stop>
                                    <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
                                  </div>
                                </el-tooltip>
                              </div>
                            </th>
                            </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(item, index) in excelFieldsForTemplate" :key="index" 
                            :class="[{'subform-item': item.parentExcelField, 'not-import': item.formFieldType === '不导入'}]"
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
                            <td class="step3-table__field-type-cell">
                              <div class="form-group">
                                <div class="serial-number-btns" v-if="item.formFieldType === 'widget.form.serialNumber'">
                                  <el-button @click="handleSetRules(item)" v-if="!serialNumberRules[item.uid] || serialNumberRules[item.uid].length === 0">{{ $t("ImportExcelDialog.setRule") }}</el-button>
                                  <el-button @click="handleSetRules(item)" style="color: var(--el-color-primary)" v-else>{{ $t("ImportExcelDialog.setted") }}</el-button>
                                </div>
                                <el-select 
                                  v-model="item.formFieldType" 
                                  class="el-select" 
                                  :class="{'not-import': item.formFieldType === '不导入', 'serial-number-select': item.formFieldType === 'widget.form.serialNumber'}" 
                                  popper-class="import-excel-field-type-select-popper"
                                  @change="(newValue) => handleSelectFieldType(newValue, item)"
                                >
                                  <el-option v-for="item in formFieldTypes" :key="item.type" 
                                    :value="item.type" value-key="type"
                                    :label="getFormFieldTypeName(item)"
                                  ></el-option>
                                </el-select>
                              </div>
                            </td>
                            <td class="step3-table__validation-cell">
                              <el-icon :size="16" style="color: var(--el-color-danger);" v-if="item.fieldMatchResult === 'all-fail'"><CircleCloseFilled /></el-icon>
                              <el-icon :size="16" style="color: var(--el-color-warning);" v-if="item.fieldMatchResult === 'some-success'"><WarnTriangleFilled /></el-icon>
                              <el-icon :size="16" style="color: var(--el-color-success);" v-if="item.fieldMatchResult === 'all-success'"><CircleCheckFilled /></el-icon>
                              <img src="@renderer/assets/icons/nocode/not-import.svg" v-if="item.fieldMatchResult === 'not-import'" style="width: 16px; height: 16px;" />
                            </td>
                          </tr>
                        </tbody>
                        </table>
                    </div>
                  </div>
              </div>
              <div id="app" v-if="isImportMode">
                <div class="form-header">
                  <div class="form-header-left">
                    <div class="form-name">
                      <label>{{ $t("ImportExcelDialog.formName") }}{{ getI18nLabelColon() }}</label>
                      <el-input class="el-input" v-model="formName" :placeholder="$t('ImportExcelDialog.inputFormName')" />
                    </div>
                  </div>
                  <span>{{ $t("ImportExcelDialog.import") }} {{ importFieldsNum }} {{ $t("ImportExcelDialog.fieldNum") }} / {{ $t("ImportExcelDialog.total") }} {{ totalFieldsNum }} {{ $t("ImportExcelDialog.fieldNum") }}</span>
                </div>
                <div class="step3-table-container-import">
                  <div class="scrollable-table">
                    <table class="step3-table">
                      <thead>
                        <tr>
                          <th>{{ $t("ImportExcelDialog.excelField") }}</th>
                          <th>&gt;</th>
                          <th>{{ $t("ImportExcelDialog.formField") }}</th>
                          <th>
                            <div style="display: flex; justify-content: center; align-items: center;">
                              <span style="margin-right: 4px;">{{ $t("ImportExcelDialog.fieldMatch") }}</span>
                              <el-tooltip placement="bottom-start" effect="light">
                                <template #content>
                                  <div style="max-width: 200px;">{{ $t("ImportExcelDialog.matchTip") }}</div>
                                </template>
                                <div class="tip-icon" @click.stop>
                                  <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
                                </div>
                              </el-tooltip>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(item, index) in excelFieldsForTemplate" :key="index"
                          :class="[{'subform-item': item.parentExcelField,'not-import': item.formField === '不导入'}]"
                        >
                          <td>
                            <div class="form-group">
                              <el-input type="text" v-model="item.excelFieldTitle" readonly></el-input>
                            </div>
                          </td>
                          <td>-</td>
                          <td>
                            <div class="form-group">
                              <el-select v-model="item.formField" :class="{'not-import': item.formField === '不导入'}" @change="(value) => handleFieldChange(value, index, item)">
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
                          <td>
                            <el-icon :size="16" style="color: var(--el-color-danger);" v-if="item.fieldMatchResult === 'all-fail'"><CircleCloseFilled /></el-icon>
                            <el-icon :size="16" style="color: var(--el-color-warning);" v-if="item.fieldMatchResult === 'some-success'"><WarnTriangleFilled /></el-icon>
                            <el-icon :size="16" style="color: var(--el-color-success);" v-if="item.fieldMatchResult === 'all-success'"><CircleCheckFilled /></el-icon>
                            <img src="@renderer/assets/icons/nocode/not-import.svg" v-if="item.fieldMatchResult === 'not-import'" style="width: 16px; height: 16px;" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div v-if="isAnalysisMode" class="analysis-confirm-content">
                <div class="form-header">
                  <div class="form-header-left">
                    <div class="form-name">
                      <label>{{ $t('importExcelDialog.worksheetLabel') }}</label>
                      <span>{{ worksheet }}</span>
                    </div>
                    <div class="form-name">
                      <label>{{ $t('importExcelDialog.titleRowLabel') }}</label>
                      <span>{{ $t('importExcelDialog.ordinalPrefix') }}{{ titleRowIndex + 1 }}{{ $t('importExcelDialog.row') }}</span>
                    </div>
                  </div>
                  <span>{{ analysisColumnSummaries.length }}{{ $t('importExcelDialog.column') }}</span>
                </div>
                <div class="step3-table-container-import">
                  <div class="scrollable-table">
                    <table class="step3-table">
                      <thead>
                        <tr>
                          <th>{{ $t('importExcelDialog.excelColumn') }}</th>
                          <th>{{ $t('importExcelDialog.inferredType') }}</th>
                          <th>{{ $t('importExcelDialog.sampleValue') }}</th>
                          <th>{{ $t('importExcelDialog.distinctSample') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="item in analysisColumnSummaries" :key="item.columnKey">
                          <td>{{ item.title }}</td>
                          <td>{{ item.inferredType }}</td>
                          <td>{{ item.sampleValues.join(' / ') || '-' }}</td>
                          <td>{{ item.distinctValuesSample.join(' / ') || '-' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="currentStep === 4 && isImportMode" class="step4-content-import">
              <div class="import-mode-container">
                <div class="table-header">
                  <div class="import-mode">
                    <div class="text">{{ $t("ImportExcelDialog.importMode") }}</div>
                    <el-select v-model="importModeValue" :placeholder="$t('ImportExcelDialog.selectImportMode')" @change="switchImportMode">
                      <el-option
                        v-for="item in importModeOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </div>
                  <div class="unique-identifier-field" v-if="importModeValue === 'overWrite'">
                    <div class="text">{{ $t("ImportExcelDialog.uniqueField") }}</div>
                    <el-select v-model="identifierField" :placeholder="$t('ImportExcelDialog.selectUniqueField')">
                      <el-option
                        v-for="item in identifierFieldOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </div>
                </div>
                <div class="table-container">
                  <!-- 添加带滚动条的容器 -->
                  <div class="scrollable-table">
                    <table class="data-table2">
                      <tbody>
                        <template v-for="(row, rowIndex) in table2Data" :key="rowIndex">
                          <tr 
                            :class="{ 'title-row': isTitleRow(rowIndex) }" 
                            v-if="rowIndex >= titleRowIndex"
                          >
                            <td class="index-cell">
                              {{ rowIndex + 1 }}
                            </td>
                            <template v-for="(cell, colIndex) in row" :key="cell + colIndex">
                              <td 
                                :class="{ 'identifier-field': isIdentifierField(colIndex) }"
                                v-if="filteredExcelMergeData[rowIndex]?.[colIndex]?.colspan !== 0 && filteredExcelMergeData[rowIndex]?.[colIndex]?.rowspan !== 0"
                                :rowspan="filteredExcelMergeData[rowIndex]?.[colIndex]?.rowspan ?? 1"
                                :colspan="filteredExcelMergeData[rowIndex]?.[colIndex]?.colspan ?? 1"
                              >
                                {{ formatDisplayCellData(cell, rowIndex, colIndex) }}
                              </td>
                            </template>
                          </tr>
                        </template>
                        <tr v-if="table2Data.length >= 30">
                          <td colspan="100%" style="text-align: center; white-space: nowrap; color: #999999;">
                            {{ $t("ImportExcelDialog.onlySupportThirty") }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="(currentStep === 4 && isCreateMode) || (currentStep === 5 && isImportMode)" class="step4-content">
              <div v-if="showImportProgress" class="import-progress-container">
                <div class="import-progress-wrapper">
                  <el-progress :percentage="Math.max(0, importPercent)" :stroke-width="8" :format="formatImportPercent" />
                </div>
                <p class="import-progress-text">{{ $t("ImportExcelDialog.importingWithWait") }}</p>
              </div>
              <div v-else-if="importFinished" class="import-complete-container">
                <div class="check-circle">
                  <el-icon class="check-icon"
                    v-if="importExcelSuccessLength === importExcelTotalLength"
                  ><i-nocode-import-success /></el-icon>
                  <el-icon class="check-icon" v-else><i-nocode-import-warning /></el-icon>
                </div>
                <p class="import-complete-text">
                  <span v-if="importExcelSuccessLength === importExcelTotalLength">
                    <span v-if="importModeValue !== 'overWrite'">{{ $t("ImportExcelDialog.importComplete") }} {{ importExcelSuccessLength }} {{ $t("ImportExcelDialog.dataCount") }}</span>
                    <span v-else>{{ $t("ImportExcelDialog.importComplete") }} {{ importExcelAddCount }} {{ $t("ImportExcelDialog.dataCount") }}，{{ $t("ImportExcelDialog.update") }} {{ importExcelUpdateCount }} {{ $t("ImportExcelDialog.dataCount") }}</span>
                  </span>
                  <span v-else-if="importExcelSuccessLength === 0 && importExcelTotalLength !== 0">
                    {{ $t("ImportExcelDialog.importFail") }}<span v-if="importExcelTotalLength !== null">，{{ $t("ImportExcelDialog.fail") }} {{ importExcelTotalLength }} {{ $t("ImportExcelDialog.dataCount") }}</span>
                  </span>
                  <span v-else>
                    <span v-if="importModeValue !== 'overWrite'">
                      {{ $t("ImportExcelDialog.importComplete") }} {{ importExcelSuccessLength }} {{ $t("ImportExcelDialog.dataCount") }}，{{ $t("ImportExcelDialog.fail") }}
                      <span class="failed-count">{{ importExcelTotalLength - importExcelSuccessLength }}</span>
                      {{ $t("ImportExcelDialog.dataCount") }}
                    </span>
                    <span v-else>
                      {{ $t("ImportExcelDialog.importComplete") }} {{ importExcelAddCount }} {{ $t("ImportExcelDialog.dataCount") }}，{{ $t("ImportExcelDialog.update") }} {{ importExcelUpdateCount }} {{ $t("ImportExcelDialog.dataCount") }}，{{ $t("ImportExcelDialog.fail") }}
                      <span class="failed-count">{{ importExcelTotalLength - importExcelSuccessLength }}</span>
                      {{ $t("ImportExcelDialog.dataCount") }}
                    </span>
                  </span>
                </p>
                <el-button v-if="showErrorReportDownload" class="error-report-btn" @click="downloadErrorReport">
                  {{ $t("ImportExcelDialog.downloadErrorReport") }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
        <div class="popup-footer">
          <div class="left-container">
            <a class="tutorial-link" href="https://www.banban.work/docs/v1/ygxgkwimrnyt3ehs" target="_blank"><el-icon><Opportunity /></el-icon>{{$t('ImportExcelDialog.viewGuide')}}</a>
            <el-checkbox v-model="fillDefaultValue" v-if="isImportMode && currentStep === 3">
              {{ $t('ImportExcelDialog.fillDefault') }}
              <el-tooltip placement="top" effect="light">
                <template #content>
                  <div class="fill-default-value-tip-content">{{ $t('ImportExcelDialog.fillDefaultTip') }}</div>
                </template>
                <span class="fill-default-value-tip" @click.stop>
                  <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
                </span>
              </el-tooltip>
            </el-checkbox>
          </div>
          <div>
            <el-button v-if="currentStep === 1" @click="handleCloseExcel">{{ $t('ImportExcelDialog.cancel') }}</el-button>
            <el-button class="next-btn" v-if="currentStep > 1 && currentStep < maxStep" @click="preStep" :disabled="loading">{{ $t('ImportExcelDialog.preStep') }}</el-button>
            <el-button type="primary" class="next-btn" v-if="showNextButton" @click="nextStep" :disabled="nextStepDisabled">{{ $t('ImportExcelDialog.nextStep') }}</el-button>
            <el-button type="primary" v-if="showImportButton" @click="importStep" :disabled="importActionDisabled">{{ $t('ImportExcelDialog.import') }}</el-button>
            <el-button type="primary" v-if="showAnalysisConfirmButton" @click="confirmAnalysis" :disabled="loading || !step2HaveTableData">{{ $t('importExcelDialog.confirmAnalysis') }}</el-button>
            <el-button type="primary" v-if="showCompleteButton" @click="completeStep">{{ $t('ImportExcelDialog.complete') }}</el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>

  <serial-number-rules-dialog 
    v-model="serialNumberRulesDialogVisible"  
    :serialNumberFormField="serialNumberFormField"
    :value="currentSerialNumberField ? serialNumberRules[currentSerialNumberField.uid] : undefined"
    @update="handleUpdateRule"
  ></serial-number-rules-dialog>
</template>

<script lang='ts' setup>
import { ref, inject, watch, computed, Ref, nextTick } from 'vue';
import { ElMessage, UploadRequestOptions } from 'element-plus';
import { NOCODE, NOCODE_ID, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import axios from "axios";
import { UploadFilled, Opportunity } from '@element-plus/icons-vue'
import { unique } from '@common/utils/unique';
import { CellMerge, ExcelFileData, SheetData, ExcelLocation, ExcelFieldItem, FieldMatchResult, ExcelSubformColMaps, ExcelFormColMap } from '@common/types/excel';
import { FormTableRuntime, Nocode, NocodeFormData } from '@common/types/nocode';
import { Field, FieldUID, Table, TableColumn } from '@common/types/project';
import { useFormData } from '../views/editor/form/hooks';
import { isBuiltinField, replaceIllegalChars } from '@common/utils';
import { getColumnLetter } from '@common/utils/print/shared';
import { applyImportFieldValueToRowDataMap as applyImportFieldValueToRowDataMapUtil, buildImportRowDataMap as buildImportRowDataMapUtil, dataRegex, customDayjs, processCellData, shouldTreatFieldAsRequired } from '@common/utils/validate';
import {
  createExcelValidationField,
  resolveExcelStorageFieldType,
  validateExcelColumnAgainstField,
} from '@common/utils/excelFieldValidation';
import { deepClone } from '@common/utils/object';
import { allFormFieldTypes, FormFieldType } from '@renderer/b2/formFieldTypes';
import type { Column, Worksheet } from "exceljs";
import { doDownload } from '@renderer/utils';
import { SerialNumberRule } from '@renderer/views/nocode/types'
import { CircleCloseFilled, WarnTriangleFilled, CircleCheckFilled } from '@element-plus/icons-vue';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import i18next from 'i18next';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { AiAttachmentUploadHandle } from '@common/types/aiAttachment';
import type { AiExcelAnalysisConfirmPayload } from '@common/types/aiExcelAnalysis';
import { buildAiExcelAnalysisConfirmPayload } from '@common/utils/aiExcelAnalysis';
import { recommendExcelFieldByLocalRules } from '@common/utils/excelFieldLocalPreset';
import { handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { getI18nLabelColon } from '@common/utils/i18n';

const nocodeId = inject(NOCODE_ID);
const nocode = inject<Ref<Nocode> | null>(NOCODE, null);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);
const formData: Ref<NocodeFormData> = useFormData();
const currentRequestSign = computed(() => {
  const sharedSign = String(nocode?.value?.body?.sign || '').trim();
  if (sharedSign) return sharedSign;
  return String(nocodeBody.value?.sign || '').trim();
});
const formInfo = ref({
  name: '',
  group: ''
})

type PrefillUploadedExcelPayload = Pick<AiAttachmentUploadHandle, 'fullPath' | 'sessionId'> & {
  name?: string
  formName?: string
}

type ExcelCreateCompletedPayload = {
  tableId: string
  formName: string
  importFieldCount: number
  successCount: number
  totalCount: number
  failedCount: number
  sourceInstance: {
    fullPath: string
    sessionId?: string
  }
}

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  dialogVisible: boolean,
  contentSource: 'tableHeaderValue' | 'nocodeCreateDataDialogValue',
  mode?: 'default' | 'analysis',
  runtime?: FormTableRuntime,
  formFields?: Field[],
  table?: Table
}>(), {
  formFields: () => [],
  mode: 'default',
});
// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits(['addData','importCompleted','excelCreateCompleted','update:dialogVisible', 'closed', 'confirmed', 'createForm', 'closeDialog', 'analysisConfirmed']);

const dialogVisibleComp = computed<boolean>({
  get: () => props.dialogVisible,
  set: (val) => emit('update:dialogVisible', val)
});
const isAnalysisMode = computed(() => props.mode === 'analysis');
const isCreateMode = computed(() => !isAnalysisMode.value && props.contentSource === 'nocodeCreateDataDialogValue');
const isImportMode = computed(() => !isAnalysisMode.value && props.contentSource === 'tableHeaderValue');
const titleMapping = {
  get nocodeCreateDataDialogValue() { return i18next.t("ImportExcelDialog.excelToForm") },
  get tableHeaderValue() { return i18next.t("ImportExcelDialog.importData") }
}
const dialogTitle = computed(() => isAnalysisMode.value ? i18next.t('importExcelDialog.fileAnalysis') : titleMapping[props.contentSource]);
const maxStep = computed(() => {
  if (isAnalysisMode.value) return 3;
  return isCreateMode.value ? 4 : 5;
});

const connectImportProgressStream = async (taskId: string) => {
  cleanupImportProgressStream();
  const controller = new AbortController();
  importProgressController = controller;
  let settled = false;

  const waitOpened = new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timer = null;
      settled = true;
      reject(new Error('connect import excel progress stream timeout'));
    }, 5000);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      callback();
    };

    void fetchEventSource(`/nocode/import-excel-progress-stream?taskId=${ encodeURIComponent(taskId) }`, {
      method: 'GET',
      signal: controller.signal,
      openWhenHidden: false,
      headers: currentRequestSign.value ? {
        'x-sign': currentRequestSign.value,
      } : undefined,
      async onopen(response) {
        if (response.ok) {
          finish(() => resolve());
          return;
        }
        const text = await response.text();
        const error = new Error(text || 'connect import excel progress stream failed');
        finish(() => reject(error));
        throw error;
      },
      async onmessage(ev) {
        const payload = JSON.parse(ev.data || '{}');
        const nextPercent = Number(payload?.percent || 0);
        if (payload?.taskId !== taskId) return;
        if (!Number.isFinite(nextPercent)) return;
        const localPercentBefore = importPercent.value || 0;
        const localPercentAfter = Math.max(localPercentBefore, Math.min(100, Number(nextPercent.toFixed(1))));
        importPercent.value = localPercentAfter;
      },
      onerror(error) {
        if (controller.signal.aborted) return;
        if (!settled) {
          finish(() => reject(error instanceof Error ? error : new Error('connect import excel progress stream failed')));
        }
        throw error;
      },
    }).catch((error) => {
      if (!controller.signal.aborted) {
        console.warn('connect import excel progress stream failed', error);
        cleanupImportProgressStream();
      }
    });
  });

  try {
    await waitOpened;
  } catch (error) {
    console.warn('wait import excel progress stream open failed', error);
    cleanupImportProgressStream();
  }
}

const cleanupImportProgressStream = () => {
  importProgressController?.abort();
  importProgressController = null;
}

const fillDefaultValue = ref(true)

let currentStep = ref(1);
const importFinished = ref(false);
const showImportProgress = computed(() => {
  return !importFinished.value && loading.value && (
    (isCreateMode.value && currentStep.value === 4) ||
    (isImportMode.value && currentStep.value === 5)
  );
});
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
const hasSelectedExcel = computed(() => !!readExcelFileData.value && !!uploadFileFullPath.value);
const selectedExcelFileName = computed(() =>
  String(readExcelFileData.value?.fileName || formInfo.value.name || '').trim() || i18next.t('importExcelDialog.selectedExcelFile')
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

const isIdentifierField = (colIndex) => {
  if(identifierField.value){
    return (identifierField.value.match(/col-(\d+)/)?.[1] == colIndex);
  } else {
    return false;
  }
}

const titleRowHeight = computed(() =>
  titleRadioColMerge.value[titleRowIndex.value]?.rowspan ?? 1
);

const uploadFileFullPath = ref<string>('');
const uploadSessionId = ref<string>('');
const uploadSourceType = ref<'excel' | 'zip' | ''>('');
const uploadProgress = ref(0); // 添加进度状态
const loading = ref<boolean>(false);
const importPercent = ref(0);
let importProgressController: AbortController | null = null;

const formatImportPercent = (percentage?: number) => `${Math.max(0, Number(percentage || 0)).toFixed(1)}%`;

const table2Headers = computed<any[]>(() => 
  table2Data.value?.[titleRowIndex.value] ?? []
);

const serialNumberRulesDialogVisible = ref(false);
const serialNumberFormField = ref();
// 存储自动编号规则
const serialNumberRules = ref<Record<string, SerialNumberRule[]>>({});

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
const analysisColumnDistinctValues = ref<string[][]>([]);
const analysisColumnSummaries = computed(() => {
  const payload = buildCurrentAnalysisPayload();
  return payload?.context.columns ?? [];
});
const showNextButton = computed(() => {
  if (isAnalysisMode.value) return currentStep.value < 3;
  if (isCreateMode.value) return currentStep.value < 3;
  return currentStep.value < 4;
});
const nextStepDisabled = computed(() => {
  if (currentStep.value === 1) {
    return !hasSelectedExcel.value;
  }
  if (!step2HaveTableData.value) return true;
  if (isImportMode.value && currentStep.value === 3 && importFieldsNum.value === 0) return true;
  if (isCreateMode.value && currentStep.value === 3) {
    if (importFieldsNum.value === 0) return true;
    if (hasBlockingCreateFieldValidation.value) return true;
  }
  return false;
});
const showImportButton = computed(() =>
  (isCreateMode.value && currentStep.value === 3) || (isImportMode.value && currentStep.value === 4)
);
const importActionDisabled = computed(() => {
  if (loading.value || importFieldsNum.value === 0) return true;
  if (isCreateMode.value && currentStep.value === 3 && hasBlockingCreateFieldValidation.value) return true;
  return false;
});
const showAnalysisConfirmButton = computed(() => isAnalysisMode.value && currentStep.value === 3);
const showCompleteButton = computed(() =>
  !loading.value && ((isCreateMode.value && currentStep.value === 4) || (isImportMode.value && currentStep.value === 5))
);
const analysisColumnDataCache = ref<Record<string, string[][]>>({});
const analysisColumnDataPendingMap = new Map<string, Promise<string[][]>>();
// 导入模式选择中，只显示要导入的字段数据
const filteredExcelMergeData = computed<CellMerge[][]>(() => {
  // 创建 excelMergeData 的深拷贝
  const filteredMergeData = deepClone(excelMergeData.value);

  // 遍历excelFieldsForTemplate找到不导入的列，分情况处理
  excelFieldsForTemplate.value.forEach(field => {
    if ((field.formField === '不导入') && !field.subformExcelFields && !field.parentExcelField) {  // 如果是普通字段没有导入，则将列的合并信息设置为0
      const colIndex = field.excelField.match(/col-(\d+)/)?.[1];
      filteredMergeData.forEach(row => {
        row[colIndex] = { rowspan: 0, colspan: 0 };
      });
    } else if((field.formField === '不导入') && field.subformExcelFields) {  // 如果是子表单字段父级没有导入，则将其所有子级表单字段的列的合并信息设置为0
      const colIndexs = [];
      field.subformExcelFields.forEach(subField => { 
        colIndexs.push(subField.excelField.match(/col-(\d+)/)?.[1]);
      });
      filteredMergeData.forEach(row => {
        colIndexs.forEach(colIndex => {
          row[colIndex] = { rowspan: 0, colspan: 0 };
        });
      });
    } else if ((field.formField === '不导入') && field.parentExcelField) {  // 如果是子表单字段的子级字段，则需将该子表单字段的合并信息设置为0，并更改其父级表单字段的合并信息
      // 1.将其父级表单的colspan - 1
      const parentColIndex = field.parentExcelField.match(/col-(\d+)/)?.[1];
      filteredMergeData[0][parentColIndex] = { rowspan: 1, colspan: filteredMergeData[0][parentColIndex].colspan - 1 };
      // 2.将该字段的合并信息设置为0
      const colIndex = field.excelField.match(/col-(\d+)/)?.[1];
      for (let i = 1; i < filteredMergeData.length; i++) {
        filteredMergeData[i][colIndex] = { rowspan: 0, colspan: 0 };
      }
    }
  })
  
  return filteredMergeData;
})

function formatDisplayCellData(cellData: any, rowIndex: number, colIndex: number) {
  let formatCell = cellData !== null ? deepClone(cellData) : null;
  if(excelTypeData.value[rowIndex][colIndex] === 'date'){
    formatCell = customDayjs(formatCell)?.format('YYYY-MM-DD HH:mm:ss') ?? formatCell;
  }
  return formatCell ?? '';
}

const organizeUtil = new OrganizeUtil()
const userList = ref()
const departmentList = ref()
const nocodeBody = ref()

const mapping = ref<ExcelFormColMap>({});
const subformMappings = ref<ExcelSubformColMaps>({});

// 表单名称
const formName = ref<string>('');

const importModeValue = ref('addData')
const importModeOptions = [
  {
    value: 'addData',
    get label() { return i18next.t("ImportExcelDialog.addData") },
  },
  {
    value: 'overWrite',
    get label() { return i18next.t("ImportExcelDialog.overwriteData") },
  },
]
const identifierField = ref()
const identifierFieldOptions = computed(() => { 
  return excelFieldsForTemplate.value
    .filter(field => (field.formField !== '不导入') && !field.subformExcelFields && !field.parentExcelField)
    .map(field => ({
      value: field.excelField,
      label: field.excelFieldTitle,
    }))
})

const formFieldTypes = ref<FormFieldType[]>([{
  type: '不导入',
  name: '',
}])
const types = [
  "widget.form.textInput",
  "widget.form.textarea",
  "widget.form.numberInput",
  "widget.form.amountInput",
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
// 遍历每个分类对象
allFormFieldTypes.forEach(item => {
  // 遍历当前分类的children数组
  item.children.forEach(child => {
    // 若isFieldType为true，则将name添加到结果数组
    if (types.includes(child.type)) {
      formFieldTypes.value.push(deepClone(child))
    }
  });
});

const getFormFieldTypeName = (item: FormFieldType) => (
  item.type === '不导入' ? i18next.t('ImportExcelDialog.skipImport') : item.name
)

const handleCloseExcel = () => {
  if((currentStep.value === 4 && isCreateMode.value) || (currentStep.value=== 5 && isImportMode.value)) {
    emit('importCompleted')
  }
  emit('closeDialog')
  void resetDialogState({ cleanupImportSession: true });
};

const preStep = () => {
  uploadProgress.value = 0
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

const nextStep = () => {
  if (currentStep.value < maxStep.value) {
    currentStep.value++;
  }
}

function buildCurrentAnalysisPayload(): AiExcelAnalysisConfirmPayload | null {
  if (!readExcelFileData.value || !worksheet.value || !uploadFileFullPath.value) {
    return null;
  }
  return buildAiExcelAnalysisConfirmPayload({
    fileData: readExcelFileData.value,
    worksheet: worksheet.value,
    titleRowIndex: titleRowIndex.value,
    titleRowHeight: titleRowHeight.value,
    fullPath: uploadFileFullPath.value,
    sessionId: uploadSessionId.value || undefined,
    distinctColumnValues: analysisColumnDistinctValues.value,
  });
}

function hashAnalysisText(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildAnalysisColumnDataCacheKey() {
  if (!uploadFileFullPath.value || !worksheet.value) {
    return '';
  }
  const headerHash = hashAnalysisText(
    table2Headers.value
      .map(item => String(item ?? '').trim())
      .join('||'),
  );
  return `${uploadFileFullPath.value}::${worksheet.value}::${titleRowIndex.value}::${headerHash}`;
}

async function ensureAnalysisColumnData() {
  if (!uploadFileFullPath.value || !worksheet.value) {
    return;
  }
  const cacheKey = buildAnalysisColumnDataCacheKey();
  if (!cacheKey) {
    analysisColumnDistinctValues.value = [];
    return;
  }

  const cachedColumnData = analysisColumnDataCache.value[cacheKey];
  if (Array.isArray(cachedColumnData)) {
    analysisColumnDistinctValues.value = cachedColumnData;
    return;
  }

  const pendingRequest = analysisColumnDataPendingMap.get(cacheKey);
  if (pendingRequest) {
    const pendingColumnData = await pendingRequest.catch(() => []);
    analysisColumnDistinctValues.value = Array.isArray(pendingColumnData) ? pendingColumnData : [];
    return;
  }

  const nextRequest = axios.post("/nocode/collect-column-data", {
    extraData: {
      fullPath: uploadFileFullPath.value,
      worksheet: worksheet.value,
      sessionId: uploadSessionId.value || undefined,
    },
    length: table2Headers.value.length,
    titleRowIndex: titleRowIndex.value,
  }).then(res => {
    const columnData = Array.isArray(res?.data) ? res.data : [];
    analysisColumnDataCache.value = {
      ...analysisColumnDataCache.value,
      [cacheKey]: columnData,
    };
    return columnData;
  }).catch(() => []).finally(() => {
    if (analysisColumnDataPendingMap.get(cacheKey) === nextRequest) {
      analysisColumnDataPendingMap.delete(cacheKey);
    }
  });

  analysisColumnDataPendingMap.set(cacheKey, nextRequest);
  const columnData = await nextRequest;
  analysisColumnDistinctValues.value = Array.isArray(columnData) ? columnData : [];
}

async function confirmAnalysis() {
  loading.value = true;
  try {
    await ensureAnalysisColumnData();
    const payload = buildCurrentAnalysisPayload();
    if (!payload) {
      ElMessage.error(i18next.t('importExcelDialog.analysisContextFailed'));
      return;
    }
    emit('analysisConfirmed', payload);
    emit('closeDialog');
    dialogVisibleComp.value = false;
    await resetDialogState({ cleanupImportSession: false });
  } finally {
    loading.value = false;
  }
}

// 导入Excel数据
async function importStep() {
  let extraData: object = {}, curTable: Table;
  let colToUidMap: ExcelFormColMap = {};
  let colToUidSubformMaps: ExcelSubformColMaps = {};
  const importTaskId = unique();
  loading.value = true;
  importFinished.value = false;
  importErrorReport.value = null;
  importPercent.value = 0;
  currentStep.value = props.contentSource === 'nocodeCreateDataDialogValue' ? 4 : 5;
  try {
    if (props.contentSource === 'nocodeCreateDataDialogValue') {
      let curFormData: NocodeFormData;
      ({ newTable: curTable, curFormData } = await createForm());

      extraData = {
        fullPath: uploadFileFullPath.value,
        worksheet: worksheet.value,
        importTaskId,
        sessionId: uploadSessionId.value,
      }
    // 构建数据映射关系
      // 构建数据映射关系
      const formTable = curFormData.tables.find(item => item.uid === curTable.uid);
      const formFields = formTable.fields.filter(field => !isBuiltinField(field));

      importFields.value.forEach((item, index) => {
        colToUidMap[item.excelField] = formFields[index].uid;
    // 导入Excel表数据

        if (item.subformExcelFields?.length) {
          colToUidSubformMaps[item.excelField] = {};
          const subform = curFormData.tables.find(item => item.uid === formFields[index].meta.extra?.subTableUID?.[1]);
          const subformFields = subform.fields.filter(field => !isBuiltinField(field));

          item.subformExcelFields.forEach((subItem, subIndex) => {
            colToUidSubformMaps[item.excelField][subItem.excelField] = subformFields[subIndex].uid;
          });
        }
      });
    } else if (props.contentSource === 'tableHeaderValue') {
      if(importModeValue.value === 'overWrite') {
        if(!identifierField.value) {
          ElMessage.warning(`${i18next.t("ImportExcelDialog.selectUniqueField")}!`);
          /*
          ElMessage.warning(`${i18next.t("ImportExcelDialog.selectUniqueField")}！`);
          /*
          ElMessage.warning(`${i18next.t("ImportExcelDialog.selectUniqueField")}！`);
          */
          return
        }
      }

      // 导入Excel表数据
      extraData = {
        fullPath: uploadFileFullPath.value,
        worksheet: worksheet.value,
        importMode: importModeValue.value,
        identifierField: identifierField.value,
        fillDefaultValue: fillDefaultValue.value,
        importTaskId,
        sessionId: uploadSessionId.value,
      }
      curTable = props.table;

      importFields.value.forEach(item => {
        colToUidMap[item.excelField] = item.formField;
        if (item.subformExcelFields?.length) {
          colToUidSubformMaps[item.excelField] = {};
          item.subformExcelFields.forEach(subItem => {
            colToUidSubformMaps[item.excelField][subItem.excelField] = subItem.formField;
          });
        }
      })
    }
    mapping.value = colToUidMap
    subformMappings.value = colToUidSubformMaps

    void connectImportProgressStream(importTaskId);

    const res = await axios.post("/nocode/import-excel-data", {
      nocodeId: nocodeId,
      tableUID: curTable.uid,
      runtime: props.runtime,
      extraData,
      mapping: mapping.value,
      subformMappings: subformMappings.value,
      titleRowIndex: titleRowIndex.value
    }, currentRequestSign.value ? {
      headers: {
        'x-sign': currentRequestSign.value,
      },
    } : undefined).then(res => res).catch(err => err);
    if (handleNocodeSyncConflictError(res, nocodeSignIsLatest)) {
      importErrorReport.value = null;
      return;
    }
    if (res.data) {
      importExcelSuccessLength.value = res.data.successImportCount;  // 导入Excel工作表的数据条数
      importExcelTotalLength.value = res.data.total;
      importExcelUpdateCount.value = res.data.updatedCount;
      importExcelAddCount.value = res.data.addedCount;
      importErrorReport.value = res.data.errorReport ?? null;
      importPercent.value = 100;
      importFinished.value = true;
      if (props.contentSource === 'nocodeCreateDataDialogValue') {
        const totalCount = Number(importExcelTotalLength.value || 0);
        const successCount = Number(importExcelSuccessLength.value || 0);
        const completionPayload: ExcelCreateCompletedPayload = {
          tableId: String(curTable?.uid || '').trim(),
          formName: String(curTable?.alias || formName.value || formInfo.value.name || '').trim(),
          importFieldCount: Number(importFieldsNum.value || 0),
          successCount,
          totalCount,
          failedCount: Math.max(0, totalCount - successCount),
          sourceInstance: {
            fullPath: uploadFileFullPath.value,
            sessionId: uploadSessionId.value || undefined,
          },
        };
        emit('excelCreateCompleted', completionPayload);
      }
    } else {
      ElMessage.error(`${i18next.t("ImportExcelDialog.importFail")}`);
      importErrorReport.value = null;
    }
  } finally {
    cleanupImportProgressStream();
    loading.value = false;
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

    // 组合子表单的columns
    if (field.subformExcelFields?.length) {
      subformColumns[column.uid] = [];
      for (const subfield of field.subformExcelFields) {
        let subColumn: TableColumn = makeColumn(subfield, subformColumns[column.uid]);
        subformColumns[column.uid].push(subColumn);
      }
    }
  }

  const extraData = {
    fullPath: uploadFileFullPath.value,
    worksheet: worksheet.value,
  }
  const columnData = await axios.post("/nocode/collect-column-data", {
    extraData,
    length: table2Headers.value.length,
    titleRowIndex: titleRowIndex.value,
  }).then(res => res.data).catch(err => err);

  for(let index = 0; index < columns.length; index++) {
    const column = columns[index];

    // 处理自动编号字段
    if(column.extra.widgetType === 'widget.form.serialNumber') {
      const serialNumber = parseSerialNumber(column, importFields.value[index], columns, importFields.value);
      column.extra.serialNumber = serialNumber;
    }

    // 处理选择字段
    const selectWidgetTypes = ["widget.form.treeSelect", "widget.form.treeMultipleSelect", "widget.form.radioGroup", "widget.form.checkboxGroup"]
    if(selectWidgetTypes.includes(column.extra.widgetType)) {
      const colMatch = importFields.value[index].excelField.match(/^col-(\d+)$/);
      const colIndex = colMatch ? Number(colMatch[1]) : -1;
      const columnOptions = Array.isArray(columnData[colIndex]) ? columnData[colIndex] : [];
      column.extra.choices = columnOptions.map(item => ({
        label: item,
        value: item,
      }))
    }
  }

  // 生成表单，并等待其完成
  let curFormData: NocodeFormData;
  await new Promise<void>((resolve) => {
    const callback = (formData: NocodeFormData, table: Table) => {
      newTable = table;
      curFormData = formData;
      resolve();
    }
    const resolvedFormName = String(formName.value || formInfo.value.name || '').trim();
    emit('createForm', resolvedFormName, columns, subformColumns, callback, formInfo.value.group);
  });
  return { newTable, curFormData };
}

function makeColumn(excelField: ExcelFieldItem, columns: TableColumn[]) {
  const subTypeMap = {
    'widget.form.subform': 'subForm',
  };
  // 定义一个允许任意属性的类型结构
  const column: TableColumn = {
    alias: excelField.formFieldTitle,
    extra: { widgetType: excelField.formFieldType },
    name: excelField.formFieldTitle,
    uid: excelField.uid,
    type: resolveExcelStorageFieldType(excelField.formFieldType),
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

  // 如果用户已经设置了规则，则直接使用用户设置的规则
  if (serialNumberRules.value[excelField.uid]) {
    return { rules: serialNumberRules.value[excelField.uid] };
  }

  let rules = [];
  // 分隔符，被匹配规则后的子串会被替换为此符号，防止已匹配的子串对后续规则匹配造成影响
  const divideChar = '!';
  let curColIndex = Number(excelField.excelField.replace('col-', ''));
  const firstRowIndex = titleRowIndex.value + titleRowHeight.value;
  const importData = table2Data.value.slice(firstRowIndex, firstRowIndex + 15);
  let autoNumberData: string[] = importData.map(row => row[curColIndex]);
  let tData: string[] = JSON.parse(JSON.stringify(autoNumberData));

  // 如果tData为[]，则返回一个默认规则
  if (tData.length === 0) {
    return { 
      rules: [
        { 
          id: unique(), 
          type: 'counting', 
          value: { 
            digitFixed: false,
            digitLength: 5,
            resetCycle: "none",
            startValue: 0,
          } 
        }
      ] 
    };
  }

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
  void resetDialogState({ cleanupImportSession: true });
  emit('importCompleted')
}

const downloadErrorReport = () => {
  if (!importErrorReport.value?.url) {
    ElMessage.warning(`${i18next.t("downloadTs.downloadFailed")}`);
    return;
  }

  doDownload(importErrorReport.value);
}

const downloadTemplate = async () => {
  const tableName = `${i18next.t("ImportExcelDialog.excelImportTemplate")}`;

  const blob = await createTemplateByFieldArr(props.formFields);
  
  // 创建下载链接
  const downloadUrl = URL.createObjectURL(blob);

  doDownload({
    url: downloadUrl,
    name: `${replaceIllegalChars(tableName)}.xlsx`,
  });
}
/**
 * 根据Excel列字母获取对应的列索引
 * @param colLetter 列字母
 * @returns 对应的列索引（从0开始）
 * @example
 * getColumnIndex('A') => 0
 * getColumnIndex('Z') => 25
 * getColumnIndex('AA') => 26
 */
const getColumnIndex = (colLetter: string): number => {
  let index = 0;
  for (let i = 0; i < colLetter.length; i++) {
    index = index * 26 + (colLetter.charCodeAt(i) - 64);
  }
  return index - 1;
}
const defineDateFormat = 'yyyy-mm-dd';
type newField = Field & { extra?: any };
interface SetColumnStyleParams {
  worksheet: Worksheet;
  column: Column;
  field: newField;
  hasSubForm?: boolean;
}
const reservedRowsCurrentCount = 10;
const setColumnStyleMap = {
  'widget.form.numberInput': (option: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = option;
    const extra = field.meta?.extra ? field.meta.extra : field.extra;
    const decimalPlaces = extra?.decimalPlaces ? extra.decimalPlaces : 0;
    const numFmt = decimalPlaces && decimalPlaces > 0 ? `0.${'0'.repeat(decimalPlaces)}` : '0';
    column.style.numFmt = numFmt;

    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'decimal',
        operator: 'between',
        allowBlank: true,
        formulae: [-1.7976931348623157E+308], // Excel中最小的负数

        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.numberDesc")}`,
        prompt: `${i18next.t("ImportExcelDialog.numberTip")}`,
      }
    });
    return column;
  },
  'widget.form.amountInput': (option: SetColumnStyleParams) => {
    return setColumnStyleMap['widget.form.numberInput'](option);
  },
  'widget.form.datePicker': (option: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = option;
    const extra = field.meta?.extra ? field.meta.extra : field.extra;
    const numFmt = extra?.dateFormat ? extra.dateFormat : defineDateFormat;
    column.style.numFmt = numFmt;

    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'date',
        operator: 'between',
        allowBlank: true,
        formulae: [new Date('1900-01-01'), new Date('9999-12-31')],

        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.dateDesc")}`,
        prompt: `${i18next.t("ImportExcelDialog.dateTip")}`,
      }
    });
    return column;
  },
  'widget.form.dateRangePicker': (option: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = option;
    const extra = field.meta?.extra ? field.meta.extra : field.extra;
    const numFmt = extra?.dateFormat ? `${extra.dateFormat},${extra.dateFormat}` : `${defineDateFormat},${defineDateFormat}`;
    column.style.numFmt = numFmt;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.dateRangeDesc")}`,
        prompt: `${i18next.t("ImportExcelDialog.dateRangeTip")}`,
      }
    });
    return column;
  },
  'widget.form.switch': (option: SetColumnStyleParams) => {
    const { worksheet, column, field, hasSubForm = false } = option;

    const statusOptions = ['true', 'false'];
    const optionStr = statusOptions.join(',');

    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${optionStr}"`],
        operator: 'equal',
        errorStyle: 'error',
        errorTitle: `${i18next.t("ImportExcelDialog.alert")}`,
        error: `${i18next.t("ImportExcelDialog.selectOptionValue")}`,
      }
    })
    return column;
  },
  'widget.form.treeSelect': (option: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = option;
    const extra = field.meta?.extra ? field.meta.extra : field.extra;
    const options = extra?.choices ? extra.choices : [];
    const optionValues = options.map((opt: any) => opt.value);
    const optionStr = optionValues.join(',');
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.dropdownSingleSelectionDesc")}`,
        prompt: `${i18next.t("ImportExcelDialog.dropdownSingleSelectionTip")}${getI18nLabelColon()}${optionStr}`,
      }
    })
    return column;
  },
  'widget.form.checkboxGroup': (option: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = option;
    const extra = field.meta?.extra ? field.meta.extra : field.extra;
    const options = extra?.choices ? extra.choices : [];
    const optionValues = options.map((opt: any) => opt.value);
    const optionsStr = optionValues.join(',');

    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],
  
        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.multipleSelectionDesc")}`,
        prompt: `${i18next.t("ImportExcelDialog.multipleSelectionTip")}${getI18nLabelColon()}${optionsStr}`,
      }
    })
    return column;
  },
  'widget.form.treeMultipleSelect': (option: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = option;
    const extra = field.meta?.extra ? field.meta.extra : field.extra;
    const options = extra?.choices ? extra.choices : [];
    const optionValues = options.map((opt: any) => opt.value);
    const optionsStr = optionValues.join(',');

    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],
  
        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.dropdownMultipleSelectionDesc")}`,
        prompt: `${i18next.t("ImportExcelDialog.dropdownMultipleSelectionTip")}${getI18nLabelColon()}${optionsStr}`,
      }
    })
    return column;
  },
  'widget.form.phoneInput': (options: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = options;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'textLength',
        operator: 'equal',
        allowBlank: true,
        formulae: [11],
        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.phoneFormat")}`,
        prompt: `${i18next.t("ImportExcelDialog.phoneTip")}`,
      }
    })
    return column;
  },
  "widget.form.rate": (options: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = options;
    const extra = field.meta?.extra ? field.meta.extra : field.extra;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'whole',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.alert")}`,
        prompt: `${i18next.t("ImportExcelDialog.inputInt")}`,
      }
    })
    return column;
  },
  "widget.form.tagInput": (options: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = options;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'textLength', 
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.tagTextDesc")}`,
        prompt: `${i18next.t("ImportExcelDialog.tagTextTip")}`,
      }
    })
    return column;
  },
  "widget.form.radioGroup": (options: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = options;
    const extra = field.meta?.extra ? field.meta.extra : field.extra;
    const optionsList = extra?.choices ? extra.choices : [];
    const optionValues = optionsList.map((opt: any) => opt.value);
    const optionStr = optionValues.join(',');
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'textLength',
        allowBlank: true,
        formulae: [0, 100],
        operator: 'between',

        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.singleSelectionDesc")}`,
        prompt: `${i18next.t("ImportExcelDialog.singleSelectionTip")}${getI18nLabelColon()}${optionStr}`,
      }
    })
    return column;
  },
  "widget.form.memberSelect": (options: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = options;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'textLength', 
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.selectMemberDesc")}`,
        prompt: `${i18next.t("ImportExcelDialog.selectMemberTip")}`,
      }
    })

    return column;
  },
  "widget.form.departmentSelect": (options: SetColumnStyleParams) => {
    const { column, field, hasSubForm = false } = options;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return; // 跳过表头
      if (hasSubForm && rowNumber === 2) return; // 若有子表单，跳过第二行表头
      cell.dataValidation = {
        type: 'textLength', 
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],

        showInputMessage: true,
        promptTitle: `${i18next.t("ImportExcelDialog.selectDepartmentDesc")}`,
        prompt: `${i18next.t("ImportExcelDialog.selectDepartmentTip")}`,
      }
    })

    return column;
  },
};
const createTemplateByFieldArr = async (formFields: Field[]) => {
  const ExcelJS = (await import("exceljs")).default;
  if (!Array.isArray(formFields)) {
    formFields = []
  }
  // 创建工作簿
  const workbook = new ExcelJS.Workbook();
  const sheet1Name = 'sheet1'
  // 模板列表
  const worksheet = workbook.addWorksheet(sheet1Name);
  const descriptionSheet = workbook.addWorksheet(`${i18next.t("ImportExcelDialog.importDesc")}`)

  // 使用预定义的Excel模板作为descriptionSheet
  // 通过import引入资源，确保在构建时被打包
  const templateFile = await import('@renderer/assets/resource/excel-import-template.xlsx')
  const response = await fetch(templateFile.default);
  const templateData = await response.arrayBuffer();
  const templateWorkbook = await new ExcelJS.Workbook().xlsx.load(templateData);
  const templateSheet = templateWorkbook.getWorksheet(`${i18next.t("ImportExcelDialog.importDesc")}`);
  
  // 克隆模板工作表到当前工作簿
  templateSheet.eachRow((row, rowNumber) => {
    const newRow = descriptionSheet.getRow(rowNumber);
    row.eachCell((cell, colNumber) => {
      newRow.getCell(colNumber).value = cell.value;
      newRow.getCell(colNumber).style = cell.style;
    });
    newRow.commit();
  });
  // 复制合并单元格信息
  Object.values((templateSheet as any)._merges).forEach((mergedCell: any) => {
    descriptionSheet.mergeCells(mergedCell);
  });

  const firstRow = [];
  const secondRow = [];
  const mergeCells = [];
  // 设置列的类型
  const columnStyles = [];

  let colIndex = 0;

  let hasSubForm = formFields.some(field => field.meta.subType === 'subForm');

  formFields.forEach((field) => {
    if (isBuiltinField(field)) return;
    let key = field.meta?.extra?.widgetType || field.meta.subType;
    if (key === 'widget.form.subform') {
      if (!Array.isArray(field?.meta?.extra?.subColumns) || field.meta.extra.subColumns.length === 0) {
        return
      }
      mergeCells.push(`${getColumnLetter(colIndex)}1:${getColumnLetter(colIndex + field.meta.extra.subColumns.length - 1)}1`);
      field.meta.extra.subColumns.forEach((col) => {
        const subKey = col?.extra?.widgetType;
        const colLetter = getColumnLetter(colIndex);
        firstRow.push(field.alias);
        secondRow.push(col.alias);
        const colStyleFun = setColumnStyleMap[subKey];
        if (colStyleFun) {
          columnStyles.push({
            colLetter,
            type: subKey,
            field: col,
          });
        }
        colIndex = colIndex + 1;
      })

      return;
    }
    const colLetter = getColumnLetter(colIndex);
    firstRow.push(field.alias);
    if (hasSubForm) {
      secondRow.push(field.alias);
      mergeCells.push(`${colLetter}1:${colLetter}2`)
    }
    const colStyleFun = setColumnStyleMap[key];
    if (colStyleFun) {
      columnStyles.push({
        colLetter,
        type: key,
        field,
      })
    }
    colIndex = colIndex + 1;
  });
  worksheet.addRow(firstRow);

  if (hasSubForm) {
    worksheet.addRow(secondRow);
    // 合并单元格
    mergeCells.forEach((merge) => {
      worksheet.mergeCells(merge);
    });
  }

  for (let i = 0; i < reservedRowsCurrentCount; i++) {
    worksheet.addRow([]);
  }

  // 设置列的类型
  columnStyles.forEach((item) => {
    const column = worksheet.getColumn(item.colLetter)
    const setColumnStyleFun = setColumnStyleMap[item.type];
    setColumnStyleFun({
      worksheet,
      column, 
      field: item.field, 
      hasSubForm
    });
  })

  if (formFields.length === 0) {
    workbook.removeWorksheet(sheet1Name)
  }

  // 生成 ArrayBuffer
  const buffer = await workbook.xlsx.writeBuffer() as ArrayBuffer;

  // 转为 Blob 并下载
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return blob
}

// 步骤1，步骤2
const handleBeforeUpload = (file) => {
  const fileType = file.name.split('.').pop().toLowerCase();
  const isValidType = ['xls', 'xlsx', 'zip'].includes(fileType);
  if (!isValidType) {
    ElMessage.error(`${i18next.t("ImportExcelDialog.onlySupportExcel")}`);
    return false; // 阻止文件上传
  }
  return true;  // 允许文件上传
};

const applyParsedImportMappingValues = async (
  rowDataMap: Record<string, unknown>,
  currentMapping: ExcelFormColMap = {},
  fields: Field[] = [],
  sheetData: SheetData,
  rowIndex: number,
  skipFieldId?: FieldUID,
  subFormWidgetUid?: string,
) => {
  for (const [col, uid] of Object.entries(currentMapping || {})) {
    if (!uid || uid === "不导入" || (skipFieldId && uid === skipFieldId)) {
      continue;
    }
    const mappedField = fields.find(field => field.uid === uid);
    if (!mappedField || mappedField.meta?.extra?.widgetType === 'widget.form.subform') {
      continue;
    }
    const mappedColIndex = Number(col.replace('col-', ''));
    const parseRes = await processCellData(
      sheetData.rows[rowIndex][mappedColIndex],
      { c: mappedColIndex, r: rowIndex },
      mappedField,
      sheetData,
      titleRowIndex.value,
      nocodeBody.value,
      subformMappings.value,
      userList.value,
      departmentList.value,
      undefined,
      rowDataMap,
      undefined,
      true,
    );
    if (!parseRes.valid) {
      continue;
    }
    applyImportFieldValueToRowDataMapUtil(rowDataMap, mappedField, parseRes.data, subFormWidgetUid);
  }
};

function getSheetRowHeight(sheetData: SheetData, rowIndex: number) {
  return Math.max(...(sheetData.mergeData[rowIndex]?.map(item => item?.rowspan ?? 1) ?? [1]));
}

function resolveExcelTitleRowHeight(sheetData: SheetData) {
  let titleRowHeight = getSheetRowHeight(sheetData, titleRowIndex.value);
  if (titleRowHeight > 1) {
    return titleRowHeight;
  }

  const titleMergeRow = sheetData.mergeData[titleRowIndex.value] ?? [];
  const hasGroupedHeader = titleMergeRow.some(item => (item?.colspan ?? 1) > 1);
  const needsSecondHeaderRow = hasGroupedHeader
    && titleMergeRow.every(item => (item?.rowspan ?? 1) <= 1);

  if (needsSecondHeaderRow) {
    titleRowHeight += getSheetRowHeight(sheetData, titleRowIndex.value + titleRowHeight);
  }
  return titleRowHeight;
}

function createFieldForCreateModeValidation(excelField: ExcelFieldItem) {
  if (!excelField.formFieldType || excelField.formFieldType === SKIP_IMPORT_FIELD_TYPE) {
    return undefined;
  }
  if (excelField.subformExcelFields?.length && excelField.formFieldType === 'widget.form.subform') {
    return undefined;
  }
  return createExcelValidationField({
    uid: excelField.uid,
    alias: excelField.formFieldTitle || excelField.excelFieldTitle || excelField.uid,
    widgetType: excelField.formFieldType,
  });
}

const fieldMatchDetect = async (fieldId: FieldUID, excelField: ExcelFieldItem): Promise<FieldMatchResult> => {
  if (excelField.formField === SKIP_IMPORT_FIELD_TYPE) return 'not-import';

  const sheetData = readExcelFileData.value.originSheetsData[worksheet.value];
  const titleRowHeight = resolveExcelTitleRowHeight(sheetData);
  const colIndex = Number(excelField.excelField.replace('col-', ''));
  let matchCount = 0;
  if(!sheetData.isSheetNull) {
    let field;
    let currentMapping: ExcelFormColMap = mapping.value || {};
    let siblingFields = props.table.fields || [];
    let mainFields = props.table.fields || [];
    let subFormWidgetUid: string | undefined;
    if(!excelField.parentExcelField){ // 如果是主表字段
      field = props.table.fields.find(field => field.uid === fieldId);
    } else if (excelField.parentExcelField){ //如果是子表单字段
      const parentField = props.table.fields.find(field => field.uid === excelField.parentFormField);
      const subTableFields = parentField?.subTableFields || [];
      field = subTableFields.find(subField => subField.uid === fieldId)
      currentMapping = subformMappings.value[excelField.parentExcelField] || {};
      siblingFields = subTableFields;
      subFormWidgetUid = parentField?.meta?.uid || parentField?.uid;
    }
    for (let rowIndex = titleRowIndex.value + titleRowHeight; rowIndex < sheetData.rows.length; rowIndex++) {
      const data = sheetData.rows[rowIndex][colIndex];
      const cellLocation: ExcelLocation = { c: colIndex, r: rowIndex };
      const mainRowDataMap = excelField.parentExcelField
        ? buildImportRowDataMapUtil(mapping.value || {}, sheetData, rowIndex, mainFields)
        : {};
      if (excelField.parentExcelField) {
        await applyParsedImportMappingValues(
          mainRowDataMap,
          mapping.value || {},
          mainFields,
          sheetData,
          rowIndex,
        );
      }
      const rowDataMap = buildImportRowDataMapUtil(
        currentMapping,
        sheetData,
        rowIndex,
        siblingFields,
        fieldId,
        mainRowDataMap,
      );
      await applyParsedImportMappingValues(
        rowDataMap,
        currentMapping,
        siblingFields,
        sheetData,
        rowIndex,
        fieldId,
        subFormWidgetUid,
      );
      const parseRes = await processCellData(data, cellLocation, field, sheetData, titleRowIndex.value, nocodeBody.value, subformMappings.value, userList.value, departmentList.value, undefined, rowDataMap, undefined, true);
      if (!parseRes.valid) {
        continue
      }
      applyImportFieldValueToRowDataMapUtil(rowDataMap, field, parseRes.data, subFormWidgetUid);
      // 字段校验，判断excel当前项的值是否符合目标字段导入条件
      const processRes = await processCellData(data, cellLocation, field, sheetData, titleRowIndex.value, nocodeBody.value, subformMappings.value, userList.value, departmentList.value, undefined, rowDataMap, undefined);
      if (processRes.valid) {
        matchCount++
      } else {
        continue
      }
    }

    if (matchCount === 0) {
      return 'all-fail';
    } else if (matchCount > 0 && matchCount < (sheetData.rows.length - titleRowHeight)) {
      return 'some-success';
    } else if (matchCount === (sheetData.rows.length - titleRowHeight)) {
      return 'all-success';
    }
  }

  return 'all-success';
}

const createModeFieldDetect = async (excelField: ExcelFieldItem): Promise<FieldMatchResult> => {
  if (excelField.formFieldType === SKIP_IMPORT_FIELD_TYPE) return 'not-import';

  const sheetData = readExcelFileData.value.originSheetsData[worksheet.value];
  const titleRowHeight = resolveExcelTitleRowHeight(sheetData);
  const colIndex = Number(excelField.excelField.replace('col-', ''));
  const field = createFieldForCreateModeValidation(excelField);

  const result = await validateExcelColumnAgainstField({
    sheetData,
    titleRowIndex: titleRowIndex.value,
    titleRowHeight,
    colIndex,
    field,
    nocodeBody: nocodeBody.value,
    subformMappings: subformMappings.value,
    userList: userList.value,
    departmentList: departmentList.value,
  });
  return result.status;
}

const handleFieldChange = async (fieldId: FieldUID, currentIndex: number, excelFieldItem: ExcelFieldItem) => {
  // 计算当前字段前有多少子表单字段列
  let beforeSubColumCount = 0;
  // 选中某个映射字段时，检查是否已经被选中。若有，则将原项改为不导入，当前项改为选中。
  let ef: ExcelFieldItem[];
  if (excelFieldItem.parentExcelField) {  // 子表字段
    const parentIndex = excelFields.value.findIndex(item => item.excelField === excelFieldItem.parentExcelField);
    ef = excelFields.value[parentIndex].subformExcelFields;
    // 如果是子表字段，则计算其父节点之前子表单的长度
    const parentFormField = excelFieldItem.parentFormField;
    for (let i = 0; i < excelFields.value.length; i++) {
      if (excelFields.value[i].formField === parentFormField) { // 找到当前字段的父表单字段
        break;
      } else if (excelFields.value[i].formField !== parentFormField) {  
        if (excelFields.value[i].subformExcelFields) {
          beforeSubColumCount += excelFields.value[i].subformExcelFields.length;
        } else {
          continue;
        }
      }
    }
    currentIndex = currentIndex - parentIndex - beforeSubColumCount - 1;
  }else{  // 主表字段
    ef = excelFields.value;
    // 如果是主表字段，则计算其之前子表单的长度
    for (let i = 0; i < excelFields.value.length; i++) { 
      if (excelFields.value[i].formField === fieldId) {  // 找到当前字段
        break;
      } else if(excelFields.value[i].formField !== fieldId) {
        if (excelFields.value[i].subformExcelFields) {
          beforeSubColumCount += excelFields.value[i].subformExcelFields.length;
        } else {
          continue;
        }
      }
    }
    currentIndex = currentIndex - beforeSubColumCount;
  }
  const selectedItem = ef.find((excelField, index) => excelField.formField === fieldId && index !== currentIndex);
  if(selectedItem) {
    selectedItem.formField = '不导入';
    selectedItem.fieldMatchResult = 'not-import';
  }

  // 字段匹配检测
  if(!excelFieldItem.subformExcelFields){
    const fieldMatchResult = await fieldMatchDetect(fieldId, excelFieldItem);
    excelFieldItem.fieldMatchResult = fieldMatchResult;
  }
};
const getFilteredOptions = (index: number, excelFieldItem: ExcelFieldItem) => {
  let options: Field[] = [{ alias: i18next.t('ImportExcelDialog.skipImport'), uid: '不导入', meta: { extra: { widgetType: '不导入' } } }] as unknown as Field[];
  if (excelFieldItem.parentExcelField) {
    const parent = excelFields.value.find(item => item.excelField === excelFieldItem.parentExcelField);
    if (!parent) return options;
    const parentField: Field = props.formFields.find(field => field.uid === parent.formField);
    if (!parentField) return options;
    const subtableId = parentField.meta.extra.subTableUID[1];
    const subtable: Table = formData.value.tables.find(table => table.uid === subtableId);
    options = options.concat(subtable.fields.filter(field => !isBuiltinField(field)));
  } else {
    options = options.concat(props.formFields);
  }

  // 为必填字段添加 '*' 前缀
  return options.map(option => {
    let aliasWithTypeInfo = option.alias;
    
    if (option.uid !== '不导入') {
      // 获取字段类型名称
      const widgetType = option.meta?.extra?.widgetType;
      if (widgetType) {
        const fieldType = allFormFieldTypes
          .flatMap(category => category.children)
          .find(type => type.type === widgetType);
        
        if (fieldType) {
          aliasWithTypeInfo += ` (${fieldType.name})`;
        }
      }
      
      // 为必填字段添加 '*' 前缀
      if (shouldTreatFieldAsRequired(option)) {
        aliasWithTypeInfo = '<span style="color: red;">*</span>' + aliasWithTypeInfo;
      }
    }
    
    return {
      ...option,
      alias: aliasWithTypeInfo
    };
  });
};
const isOptionDisabled = (option: Field, currentIndex: number, excelFieldItem: ExcelFieldItem) => {
  // "自动编号"字段永远禁用
  if (option.meta.extra.widgetType === 'widget.form.serialNumber') return true;
  return false;
};

const uploadFile = async (options: UploadRequestOptions) => {
  loading.value = true
  if (uploadSessionId.value) {
    await axios.post("/nocode/cleanup-import-session", {
      sessionId: uploadSessionId.value,
    }).catch(() => null);
    uploadSessionId.value = '';
    uploadSourceType.value = '';
  }
  const fileType = options.file.name.split('.').pop().toLowerCase();
  const formData = new FormData();
  formData.append("file", options.file);
  formData.append("filename", options.file.name);
  formData.append("nocodeId", nocodeId);
  formData.append("sourceType", fileType === 'zip' ? 'zip' : 'excel');
  let res = await axios.post("/nocode/upload-file", formData).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
  });
  if(res) {
    uploadSessionId.value = res.data.data.sessionId ?? '';
    uploadSourceType.value = res.data.data.sourceType ?? 'excel';
    uploadFileFullPath.value = res.data.data.fullPath;
    readExcelFileData.value = await readExcelFile({
      fullPath: res.data.data.fullPath,
      maxRows: 30,
      sessionId: uploadSessionId.value,
    });
    initTable2();
    currentStep.value = 2
  } else {
    console.log("上传Excel接口调用失败！")
  }
  loading.value = false;
  return res;
}

const prefillUploadedExcel = async (payload: PrefillUploadedExcelPayload): Promise<boolean> => {
  const fullPath = String(payload.fullPath || '').trim()
  if (!fullPath) {
    ElMessage.warning(i18next.t('ImportExcelDialog.fileExpiredReupload'))
    return false
  }

  loading.value = true
  if (uploadSessionId.value && uploadSessionId.value !== payload.sessionId) {
    await axios.post("/nocode/cleanup-import-session", {
      sessionId: uploadSessionId.value,
    }).catch(() => null);
  }

  uploadSessionId.value = String(payload.sessionId || '').trim()
  uploadSourceType.value = 'excel'
  uploadFileFullPath.value = fullPath
  formInfo.value.name = String(payload.formName || payload.name || formInfo.value.name || '').trim()

  const nextReadExcelFileData = await readExcelFile({
    fullPath,
    maxRows: 30,
    sessionId: uploadSessionId.value || undefined,
  })
  readExcelFileData.value = nextReadExcelFileData
  if (nextReadExcelFileData) {
    initTable2()
    currentStep.value = isCreateMode.value ? 1 : 2
    loading.value = false
    return true
  }
  currentStep.value = 1
  loading.value = false
  ElMessage.warning(i18next.t('ImportExcelDialog.readSelectedExcelFail'))
  return false
}

const importExcelSuccessLength = ref(0);
const importExcelTotalLength = ref<number>(null);
const importExcelUpdateCount = ref(0);
const importExcelAddCount = ref(0);
const importErrorReport = ref<{ url: string; name?: string } | null>(null);
const failedImportCount = computed<number>(() => {
  if (importExcelTotalLength.value === null) return 0;
  return Math.max(importExcelTotalLength.value - importExcelSuccessLength.value, 0);
});
const showErrorReportDownload = computed<boolean>(() =>
  failedImportCount.value > 0 && !!importErrorReport.value?.url
);

// 监听 worksheet
watch(() => worksheet.value, (newVal, oldVal) => {
  titleRowIndex.value = 0;
  analysisColumnDistinctValues.value = [];
});

watch(() => [titleRowIndex.value, table2Data.value], ([newVal1, newVal2]) => {
  analysisColumnDistinctValues.value = [];
  initExcelFields();
});

const excelTypeMap: Record<string, string[]> = {
  number: ['widget.form.numberInput', 'widget.form.amountInput'],
  string: ['widget.form.textInput', 'widget.form.textarea', 'widget.form.phoneInput', 'widget.form.radioGroup', 'widget.form.treeSelect', 'widget.form.relatedData'],
  boolean: ['widget.form.switch'],
  date: ['widget.form.datePicker']
};

const uploadPathWidgetTypes = ['widget.form.image-uploader', 'widget.form.file-uploader'];
const SKIP_IMPORT_FIELD_TYPE = '不导入';

function getCompatibleFieldTypes(type?: string) {
  const baseTypes = type ? [...(excelTypeMap[type] ?? [])] : [];
  if (uploadSourceType.value === 'zip' && type === 'string') {
    return [...new Set([...baseTypes, ...uploadPathWidgetTypes])];
  }
  return baseTypes;
}

function collectPreviewColumnSamples(colIndex: number) {
  const firstDataRowIndex = titleRowIndex.value + titleRowHeight.value;
  return table2Data.value
    .slice(firstDataRowIndex, firstDataRowIndex + 20)
    .map(row => String(row?.[colIndex] ?? '').trim())
    .filter(Boolean);
}

function resolveLocalCreateFieldType(options: {
  excelField: `col-${number}`
  title: string
  colIndex: number
  excelFieldType?: string
  detectedFieldType?: string
  hasSubformChildren?: boolean
}) {
  const samples = collectPreviewColumnSamples(options.colIndex);
  const recommendation = recommendExcelFieldByLocalRules({
    excelField: options.excelField,
    excelFieldTitle: options.title,
    excelFieldType: options.excelFieldType,
    detectedFieldType: options.detectedFieldType,
    hasSubformChildren: options.hasSubformChildren,
    column: {
      columnKey: options.excelField,
      title: options.title,
      inferredType: options.excelFieldType || 'unknown',
      sampleValues: samples,
      distinctValuesSample: [...new Set(samples)],
    },
  }).recommendation;

  if (recommendation.import === false) {
    return SKIP_IMPORT_FIELD_TYPE;
  }
  return recommendation.fieldType || SKIP_IMPORT_FIELD_TYPE;
}

const initExcelFields = async() => {
  excelFields.value = [];
  // 初步映射表格字段类型
  const selectedFields: Field[] = [];

  for (let i = 0; i < table2Headers.value.length; i++) {
    if(!table2Headers.value[i]) continue
    const specialFieldType = await identifySpecialFieldType(table2Headers.value[i], i, titleRowIndex.value);
    if (specialFieldType === 'beMergedCell') return;

    let type = excelColumnType.value[i];
    let matchField: Field;
    let typeValid = true;

    if (props.contentSource === 'tableHeaderValue') {
      const correctTypeArr = specialFieldType ? [specialFieldType] : getCompatibleFieldTypes(type);
      matchField = await matchFormField(correctTypeArr, table2Headers.value[i], props.formFields, selectedFields);
      typeValid = await validSpecialFieldType(table2Headers.value[i], i, titleRowIndex.value, matchField);
    }

    let subformExcelFields: ExcelFieldItem[];
    if (specialFieldType === 'widget.form.subform') {
      subformExcelFields = await formatSubformExcelFields(i, matchField);
    }

    const excelField = `col-${i}` as `col-${number}`;
    const formField = matchField?.uid && typeValid ? matchField?.uid : SKIP_IMPORT_FIELD_TYPE;
    const detectedFieldType = (specialFieldType ?? excelTypeMap[type]?.[0]) && typeValid
      ? (specialFieldType ?? excelTypeMap[type]?.[0])
      : SKIP_IMPORT_FIELD_TYPE;
    const formFieldType = isCreateMode.value
      ? resolveLocalCreateFieldType({
        excelField,
        title: table2Headers.value[i],
        colIndex: i,
        excelFieldType: type,
        detectedFieldType,
        hasSubformChildren: Array.isArray(subformExcelFields) && subformExcelFields.length > 0,
      })
      : detectedFieldType;

    const uid = unique();
    const newExcelFieldItem: ExcelFieldItem = {
      uid: uid,
      excelField,
      excelFieldTitle: table2Headers.value[i],
      excelFieldType: type,
      formField: formField,
      formFieldTitle: table2Headers.value[i],
      formFieldType: formFieldType,
      subformExcelFields,
    };

    if (isCreateMode.value) {
      if (!subformExcelFields) {
        newExcelFieldItem.fieldMatchResult = await createModeFieldDetect(newExcelFieldItem);
      }
      if (subformExcelFields && subformExcelFields.length > 0) {
        for (let j = 0; j < subformExcelFields.length; j++) {
          newExcelFieldItem.subformExcelFields[j].fieldMatchResult = await createModeFieldDetect(newExcelFieldItem.subformExcelFields[j]);
        }
      }
    }

    // 执行字段匹配检测
    if (props.contentSource === 'tableHeaderValue') {
      // 对于主表单字段执行字段匹配检测
      if(!subformExcelFields){
        const fieldMatchResult = await fieldMatchDetect(formField as FieldUID, newExcelFieldItem);
        newExcelFieldItem.fieldMatchResult = fieldMatchResult;
      }
      // 对于子表单字段执行字段匹配检测
      if (subformExcelFields && subformExcelFields.length > 0) {
        for (let j = 0; j < subformExcelFields.length; j++) { 
          const fieldMatchResult = await fieldMatchDetect(subformExcelFields[j].formField as FieldUID, subformExcelFields[j]);
          newExcelFieldItem.subformExcelFields[j].fieldMatchResult = fieldMatchResult;
        }
      }
    }

    excelFields.value.push(newExcelFieldItem);
  }
}

function formatSubformExcelFields(colIndex: number, fieldSubform: Field) {
  const selectedFields: Field[] = [];
  const { colspan, rowspan } = excelMergeData.value[titleRowIndex.value][colIndex];
  let subformExcelFields: ExcelFieldItem[] = [];
  let startCol = colIndex, endCol = colIndex + colspan - 1;

  for (let ci = startCol; ci <= endCol; ci++) {
    let title = table2Data.value[titleRowIndex.value + rowspan][ci];

    let specialFieldType = identifySpecialFieldType(title, ci, titleRowIndex.value + rowspan);
    // 子表单中若仍然有字段识别为子表单，则将此合并单元格下一行的单元格作为当前子表单字段
    if (specialFieldType === 'widget.form.subform' || specialFieldType === 'beMergedCell') {
      const { rowspan: subRowspan } = excelMergeData.value[titleRowIndex.value + rowspan][ci];
      title = table2Data.value[titleRowIndex.value + rowspan + subRowspan][ci];
      specialFieldType = identifySpecialFieldType(title, ci, titleRowIndex.value + rowspan + subRowspan);
    }

    let type = excelColumnType.value[ci];

    let matchField: Field;
    if (props.contentSource === 'tableHeaderValue' && fieldSubform) {
      let subform = formData.value.tables.find(table => table.uid === fieldSubform.meta.extra.subTableUID[1]);
      const correctTypeArr = specialFieldType ? [specialFieldType] : getCompatibleFieldTypes(type);
      matchField = matchFormField(correctTypeArr, title, subform.fields.filter(field => !isBuiltinField(field)), selectedFields);
    }

    const uid = unique();
    const excelField = `col-${ci}` as `col-${number}`;
    const detectedFieldType = specialFieldType ?? excelTypeMap[type]?.[0] ?? SKIP_IMPORT_FIELD_TYPE;
    subformExcelFields.push({
      uid: uid,
      excelField,
      excelFieldTitle: title,
      excelFieldType: type,
      formField: matchField?.uid ?? SKIP_IMPORT_FIELD_TYPE,
      formFieldTitle: title,
      formFieldType: isCreateMode.value
        ? resolveLocalCreateFieldType({
          excelField,
          title,
          colIndex: ci,
          excelFieldType: type,
          detectedFieldType,
        })
        : detectedFieldType,
      parentExcelField: `col-${colIndex}`,
      parentFormField: fieldSubform?.uid,
    });
  }

  return subformExcelFields;
}

function getSpecialTypeValidator(colTitle: any[], colIndex: number, titleRowIndex: number) {
  const { colspan, rowspan } = excelMergeData.value[titleRowIndex]?.[colIndex] ?? { colspan: 1, rowspan: 1 };
  const firstRowIndex = titleRowIndex + rowspan;
  // 取前15条数据，用于映射字段时的格式验证
  const importData = table2Data.value.slice(firstRowIndex, firstRowIndex + 15);

  return [{
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
      const validStrs = ['省', '市', '区', '县', '省', '街', '镇', '乡', '村'];

      const dataOfValidSuccess = importData.filter((cur) => {
        const administrativeAddress = cur[colIndex]?.trim?.()?.split(' ')?.[0] as (string | undefined);
        return administrativeAddress?.split('/')?.every(item => {
          if (validStrs.includes(item[item.length - 1])) {
            return true;
          }
          return false;
        })
      })

      return dataOfValidSuccess.length > Math.floor(importData.length / 2);
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
      let dataValid = importData.some(item => Number.isNaN(Number(item[colIndex])) && customDayjs(item[colIndex])?.isValid());
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
          valid = timeArr.every(time => Number.isNaN(Number(item[colIndex])) && customDayjs(time)?.isValid());
        }
        return valid;
      });
      return dataValid;
    },
  }, {
    type: 'widget.form.numberInput',
    validator: () => {
      const filterArr = importData.filter(item => item[colIndex] !== null);
      return filterArr.every(item => !Number.isNaN(parseInt(item[colIndex]?.trim?.())))
    },
  }, {
    type: 'widget.form.amountInput',
    validator: () => {
      const filterArr = importData.filter(item => item[colIndex] !== null);
      return filterArr.every(item => {
        const text = item[colIndex]?.trim?.();
        if (text === undefined) {
          return !Number.isNaN(Number(item[colIndex]));
        }
        return !Number.isNaN(Number(String(text).replace(/,/g, '')));
      })
    },
  }];
}

// 辨别导入的特殊字段（e.g.子表单字段）
function identifySpecialFieldType(colTitle: any[], colIndex: number, titleRowIndex: number) {
  const specialTypeValidator = getSpecialTypeValidator(colTitle, colIndex, titleRowIndex);
  return specialTypeValidator.find(valid => valid.validator())?.type;
}

function validSpecialFieldType(colTitle: any[], colIndex: number, titleRowIndex: number, field: Field) {
  if (!field) return
  const specialTypeValidator = getSpecialTypeValidator(colTitle, colIndex, titleRowIndex);
  const target = specialTypeValidator.find(v => v.type === field.meta.extra.widgetType);
  if (target) return target?.validator();

  let type = excelColumnType.value[colIndex];
  if (!type) return true;
  const correctTypeArr = getCompatibleFieldTypes(type);
  return correctTypeArr?.includes(field.meta.extra.widgetType);
}

function matchFormField(typeArr: string[], title: string, formFields: Field[], selectedFields: Field[]): Field {
  const bannedWidgets = ['widget.form.serialNumber'];
  let matchField = formFields.find(field => {
    const typeValid = !typeArr?.length || typeArr.includes(field.meta?.extra?.widgetType);
    const aliasValid = title === field.alias;
    const repeatValid = !selectedFields.find(f => f.uid === field.uid);
    const bannedValid = !bannedWidgets.includes(field.meta?.extra?.widgetType);
    return typeValid && aliasValid && repeatValid && bannedValid;
  });
  if (!matchField) {
    matchField = formFields.find(field => {
      const aliasValid = title === field.alias;
      const repeatValid = !selectedFields.find(f => f.uid === field.uid);
      const bannedValid = !bannedWidgets.includes(field.meta?.extra?.widgetType);
      return aliasValid && repeatValid && bannedValid;
    });
  }
  if (matchField) selectedFields.push(matchField);
  return matchField;
}

// 读取已上传的Excel文件
const readExcelFile = async (options: {
  sessionId?: string;
  fullPath: string;     // 上传时返回的文件相对路径
  maxRows?: number;         // 最大读取行数（可选）
  onSuccess?: (data: any) => void; // 成功回调
  onError?: (error: any) => void;  // 失败回调
}) => {
  try {
    const response = await axios.get('/nocode/read-excel-file', {
      params: {
        fullPath: options.fullPath,
        maxRows: options.maxRows,
        sessionId: options.sessionId,
      }
    });
    if (response.data.success) {
      options.onSuccess?.(response.data.data);
      return response.data.data;
    } else {
      ElMessage.error(response.data.error || `${i18next.t("ImportExcelDialog.readExcelFileFail")}`);
      options.onError?.(response.data.error);
      return null;
    }
  } catch (error) {
    console.error(`${i18next.t("ImportExcelDialog.readExcelFileFail")}:`, error);
    ElMessage.error(error.message || `${i18next.t("ImportExcelDialog.networkError")}`);
    options.onError?.(error);
    return null;
  }
};

function initTable2(){
  if(!readExcelFileData.value) return ;
  titleRowIndex.value = 0;
  formName.value = String(formInfo.value.name || readExcelFileData.value.fileName || '').trim();
  nextTick(() => {
    worksheet.value = sheetsNames.value[0];
  });
}

async function resetDialogState(options: { cleanupImportSession: boolean }){
  cleanupImportProgressStream();
  if (options.cleanupImportSession && uploadSessionId.value) {
    await axios.post("/nocode/cleanup-import-session", {
      sessionId: uploadSessionId.value,
    }).catch(() => null);
  }
  if (options.cleanupImportSession) {
    uploadFileFullPath.value = '';
    uploadSessionId.value = '';
    uploadSourceType.value = '';
  }
  analysisColumnDistinctValues.value = [];
  analysisColumnDataCache.value = {};
  analysisColumnDataPendingMap.clear();
  worksheet.value = '';
  readExcelFileData.value = null;
  formName.value = '';
  uploadProgress.value = 0
  currentStep.value = 1
  serialNumberRules.value = {}
  fieldTypeOldValues.value = {}
  importModeValue.value = 'addData'
  identifierField.value = null
  fillDefaultValue.value = true
  importExcelSuccessLength.value = 0
  importExcelTotalLength.value = null
  importExcelUpdateCount.value = 0
  importExcelAddCount.value = 0
  importErrorReport.value = null
  importFinished.value = false
  importPercent.value = 0
}

// 步骤3
const excelFields = ref<ExcelFieldItem[]>([]);
const excelFieldsForTemplate = computed<ExcelFieldItem[]>({
  get: () => {
    let ef: ExcelFieldItem[] = [];
    excelFields.value.forEach(item => {
      ef.push(item);
      if (item.subformExcelFields?.length && item.formFieldType === 'widget.form.subform') {
        ef = ef.concat(item.subformExcelFields);
      }
    });
    return ef;
  },
  set: (val) => { }
});
const importFieldsNum = ref(0)
const totalFieldsNum = computed<number>(() => table2Headers?.value?.length ?? 0);
const hasBlockingCreateFieldValidation = computed(() => {
  if (!isCreateMode.value) return false;
  return excelFieldsForTemplate.value.some(item => (
    item.formFieldType !== SKIP_IMPORT_FIELD_TYPE
    && item.fieldMatchResult === 'all-fail'
  ));
});

// 使用泛型明确 ref 的值类型
const importFields = ref<ExcelFieldItem[]>([]);

const currentSerialNumberField = ref<ExcelFieldItem | null>(null);
const handleSetRules = (item: ExcelFieldItem) => { 
  currentSerialNumberField.value = item;
  serialNumberFormField.value = excelFieldsForTemplate.value.filter((field, index)=>{
    return field.excelField !== item.excelField && 
           field.formFieldType !== '不导入' && 
           !field.parentExcelField;
  })

  serialNumberRulesDialogVisible.value = true;
};

// 在这里添加一个 ref 来存储每个字段的旧值
const fieldTypeOldValues = ref({});
const handleSelectFieldType = async (newValue, item) => {
  // 获取该字段的旧值，默认为 '不导入'
  const oldValue = fieldTypeOldValues.value[item.uid] || SKIP_IMPORT_FIELD_TYPE;
  
  // 更新该字段的旧值为新值
  fieldTypeOldValues.value[item.uid] = newValue;

  // 只有当从自动编号(widget.form.serialNumber)切换到其他字段时才清空该字段的规则
  if (oldValue === 'widget.form.serialNumber' && newValue !== 'widget.form.serialNumber') {
    if (serialNumberRules.value[item.uid]) {
      delete serialNumberRules.value[item.uid];
    }
  }

  if (item.subformExcelFields?.length && newValue === 'widget.form.subform') {
    item.fieldMatchResult = undefined;
    return;
  }

  item.fieldMatchResult = await createModeFieldDetect(item);
}

const handleUpdateRule = (ruleOptions) => { 
  // 保存特定字段的规则，在创建表单时使用
  if (currentSerialNumberField.value) {
    serialNumberRules.value[currentSerialNumberField.value.uid] = ruleOptions;
  }
};

const switchImportMode = () => {
  identifierField.value = null;
}

watch(
  excelFields,
  (newVal, oldVal) => {
    importFields.value = [];
    excelFields.value.forEach(item => {
      const validator = (item: ExcelFieldItem) => {
        if (props.contentSource === 'nocodeCreateDataDialogValue')
          return item.formFieldType !== '不导入'
        else if (props.contentSource === 'tableHeaderValue')
          return item.formField !== '不导入'
      };

      const newItem: ExcelFieldItem = JSON.parse(JSON.stringify(item));
      if (newItem.subformExcelFields?.length) {
        newItem.subformExcelFields = newItem.subformExcelFields.filter(subItem => validator(subItem));
      }
      if (validator(newItem)) importFields.value.push(newItem);
    });
    importFieldsNum.value = importFields.value.length;
  },
  { deep: true } // 开启深度监听
);

const handleOpened = async() => {
  userList.value = await organizeUtil.getAllUsers({})
  departmentList.value = await organizeUtil.getDepartments()
  nocodeBody.value = await axios.get(`project/get-nocode-body/${nocodeId}`).then(({ data }) => data)
}

// 将方法暴露给父组件
defineExpose({
  handleCloseExcel,
  prefillUploadedExcel,
  setFormInfo: (name?: string, group?: string) => {
    formInfo.value = {
      name: name || '',
      group: group || ''
    }
  }
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
          min-width: 160px; /* 防止连接线因空间不足而消失（默认值） */
          position: relative;
          top: -10px; /* 向上移动2px，根据实际情况调整 */
          z-index: 1;
        }

        .step-connector.active {
          background-color: var(--color-primary); /* 激活时直接变为蓝色 */
        }

        .step-connector.nocode-create-data {
          min-width: 220px; /* 防止连接线因空间不足而消失 */
        }
      }
    }

    // 步骤内容
    .step-content {
      margin-top: 30px;

      .import-progress-wrapper {
        margin-bottom: 16px;
      }
    }
    // 步骤1
    .step1-content {
      &.has-selected-excel {
        .drag-upload-content {
          height: 144px;
        }

        .upload-progress {
          margin-top: 72px;
        }
      }

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

      .step1-selected-file-card {
        margin-top: 16px;
        padding: 16px;
        border: 1px solid #d9ecff;
        border-radius: 8px;
        background: #f5f9ff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;

        &__main {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        &__icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #e8f3ff;
          color: #157cff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 18px;
        }

        &__content {
          min-width: 0;
        }

        &__title {
          color: var(--text-color-regular);
          font-size: 14px;
          line-height: 22px;
          font-weight: 600;
          word-break: break-word;
        }

        &__meta {
          margin-top: 2px;
          color: var(--text-color-secondary);
          font-size: 12px;
          line-height: 18px;
        }

        &__status {
          flex-shrink: 0;
          padding: 4px 10px;
          border-radius: 999px;
          background: #e8f3ff;
          color: #157cff;
          font-size: 12px;
          line-height: 18px;
          font-weight: 500;
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
      .step3-table-container-create {
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
              table-layout: fixed;
              width: 100%; /* 可根据实际情况设置表格总宽度 */
            }
            th:nth-child(1),
            td:nth-child(1) {
              width: 22%;
            }
            th:nth-child(2),
            td:nth-child(2) {
              width: 48px;
            }
            th:nth-child(3),
            td:nth-child(3) {
              width: 22%;
            }
            th.step3-table__field-type-cell,
            td.step3-table__field-type-cell {
              width: 22%;
            }
            th.step3-table__validation-cell,
            td.step3-table__validation-cell {
              width: 14%;
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
            td.step3-table__field-type-cell {
              .form-group {
                display: flex;
                justify-content: center;
                min-width: 0;
                .serial-number-btns {
                  :deep(.el-button) {
                    width: 80px;
                  }
                }
                .el-select {
                  width: 100%;
                  max-width: 280px;
                  min-width: 0;
                }
                .serial-number-select {
                  margin-left: 10px;
                  width: 100%;
                  max-width: 190px;
                  min-width: 0;
                }
              }
            }
          }
        }
      }
      .step3-table-container-import {
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
              table-layout: fixed;
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
            // 添加各列宽度定义
            th:nth-child(1),
            td:nth-child(1) {
              width: 40%;
            }
            th:nth-child(2),
            td:nth-child(2) {
              width: 5%;
            }
            th:nth-child(3),
            td:nth-child(3) {
              width: 40%;
            }
            th:nth-child(4),
            td:nth-child(4) {
              width: 15%;
            }
            input, .el-select {
              &.not-import {
                :deep(.el-select__placeholder) {
                  color: var(--color-primary);
                }
              }
            }
            tr {
              td:last-child {
                .form-group {
                  display: flex;
                  justify-content: center;
                  .serial-number-btns {
                    :deep(.el-button) {
                      width: 80px;
                    }
                  }
                  .serial-number-select {
                    margin-left: 10px;
                    width: 190px;
                  }
                }
              }
            }
          }
        }
      }
    }

    // 步骤4
    .step4-content-import {
      .import-mode-container {
        .table-header {
          display: flex;
          margin-top: 49px;
          margin-bottom: 16px;

          :deep(.el-select) {
            width: 244px;
            .el-select__wrapper {
              background-color: #F5F6F7;
              box-shadow: none;
            }
          }

          .import-mode {
            display: flex;
            align-items: center;
            margin-right: 32px;
            .text {
              margin-right: 16px;
            }
          }
          .unique-identifier-field {
            display: flex;
            align-items: center;
            .text {
              margin-right: 16px;
            }
          }
        }
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
                  background-color: var(--bg-color-overlay);
                }
                
                &.disabled{
                  color: var(--text-color-disabled);
                }

                td.identifier-field {
                  background-color: var(--el-color-primary-light-9);
                }
              }
            }
          }
        }
      }
    }
    .step4-content {
      .import-progress-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 435px; /* 鍙互鏍规嵁瀹為檯闇€姹傝皟鏁撮珮搴?*/
        border: 1px dashed var(--border-color); /* 铏氱嚎杈规 */
        background-color: var(--bg-color-page);

        .import-progress-wrapper {
          width: 360px;
        }

        .import-progress-text {
          margin-top: 16px;
          font-size: 14px;
          color: var(--text-color-secondary);
        }
      }

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

        .error-report-btn {
          margin-top: 16px;
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

    .left-container {
      display: flex;
      align-items: center;

      .tutorial-link {
        color: #1F77FC;
        margin-right: 16px;
      }

      .el-checkbox {
        height: 14px;
        border-left: 1px solid #D9D9D9;
        padding-left: 16px;

        .fill-default-value-tip {
          display: inline-flex;
          margin-left: 4px;
          color: var(--text-color-secondary);
          vertical-align: middle;
        }
      }
    }
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
  // min-width: 120px;
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
