<template>
  <div class="public-query-viewer" v-loading="loading">
    <div class="visit-login" v-if="showPasswordPanel">
      <div class="wrap-form">
        <div class="tip">{{ $t('PublicQueryViewer.inputAccessPwd') }}</div>
        <el-input
          v-model="password"
          type="password"
          :showPassword="true"
          :placeholder="$t('PublicQueryViewer.inputPwdPlaceholder')"
        ></el-input>
        <el-button type="primary" @click="handleVerifyVisit">{{ $t('PublicQueryViewer.confirm') }}</el-button>
      </div>
    </div>

    <el-empty v-else-if="errorText && !loading" :description="errorText" />

    <div class="content" v-else-if="bootstrap && table" :class="{ 'query-content': !showResult, 'result-content': showResult }">
      <div class="result-layout-shell" :class="{ 'is-result': showResult }">
        <div class="query-side-panel" :class="{ 'is-result': showResult }" v-show="!isMobileResultMode">
          <div class="query-header">
            <h3 class="query-title">{{ table.alias }}</h3>
            <el-popover
              v-if="!isMobileView"
              placement="bottom"
              trigger="click"
              popper-class="public-query-qr-popper"
              :teleported="false"
              append-to=".public-query-viewer"
              :show-arrow="false"
              :offset="6"
              :width="144"
            >
              <template #reference>
                <el-button class="qr-btn" text>
                  <el-icon><i-ven-qr-code></i-ven-qr-code></el-icon>
                </el-button>
              </template>
              <div class="qr-popover-content">
                <qrcode :value="publicQueryVisitUrl" :size="128" level="M" render-as="canvas" />
                <div class="qr-tip">{{ $t('PublicQueryViewer.scanToView') }}</div>
              </div>
            </el-popover>
          </div>

          <div class="query-body" :class="{ empty: !queryFields.length }">
            <div v-if="!queryFieldConfigs.length" class="empty-tip">{{ $t('PublicQueryViewer.noQueryCondition') }}</div>
            <el-form v-else class="query-form" label-position="top">
              <div class="query-grid">
                <el-config-provider :locale="locale">
                  <el-form-item
                    v-for="config in queryFieldConfigs"
                    :key="config.field.uid"
                    :label="config.field.alias"
                    :class="['query-field-item', { 'is-full-row': config.fullRow }]"
                  >
                    <template v-if="config.inputType === 'numberRange'">
                      <div class="range-input-group">
                        <el-input
                          :model-value="queryValues[config.field.uid]?.[0]"
                          type="number"
                          clearable
                          :placeholder="$t('PublicQueryViewer.minValuePlaceholder')"
                          @update:model-value="updateRangeValue(config.field.uid, 0, $event)"
                        />
                        <span class="range-separator">-</span>
                        <el-input
                          :model-value="queryValues[config.field.uid]?.[1]"
                          type="number"
                          clearable
                          :placeholder="$t('PublicQueryViewer.maxValuePlaceholder')"
                          @update:model-value="updateRangeValue(config.field.uid, 1, $event)"
                        />
                      </div>
                    </template>
  
                    <el-date-picker
                      v-else-if="config.inputType === 'dateRange'"
                      v-model="queryValues[config.field.uid]"
                      :type="config.pickerType"
                      :value-format="config.valueFormat"
                      :format="config.displayFormat"
                      :start-placeholder="$t('PublicQueryViewer.startDatePlaceholder')"
                      :end-placeholder="$t('PublicQueryViewer.endDatePlaceholder')"
                      :range-separator="$t('PublicQueryViewer.rangeSeparator')"
                      clearable
                      class="query-date-range"
                    />
  
                    <el-time-picker
                      v-else-if="config.inputType === 'timeRange'"
                      v-model="queryValues[config.field.uid]"
                      is-range
                      value-format="HH:mm:ss"
                      format="HH:mm:ss"
                      :start-placeholder="$t('PublicQueryViewer.startDatePlaceholder')"
                      :end-placeholder="$t('PublicQueryViewer.endDatePlaceholder')"
                      :range-separator="$t('PublicQueryViewer.rangeSeparator')"
                      clearable
                      class="query-date-range"
                    />
  
                    <el-tree-select
                      v-else-if="config.inputType === 'address'"
                      :model-value="queryValues[config.field.uid]"
                      @update:model-value="queryValues[config.field.uid] = $event"
                      lazy
                      :load="loadAddressNode"
                      node-key="value"
                      :render-after-expand="false"
                      :check-strictly="true"
                      :placeholder="$t('PublicQueryViewer.selectPlaceholder')"
                      class="query-address-select"
                      :props="{
                        label: 'label',
                        value: 'value',
                        children: 'children',
                        isLeaf: 'isLeaf',
                      }"
                    />
  
                    <el-select
                      v-else-if="config.inputType === 'emptyState' || config.inputType === 'switchState'"
                      v-model="queryValues[config.field.uid]"
                      :placeholder="$t('PublicQueryViewer.selectPlaceholder')"
                      clearable
                      class="query-common-select"
                    >
                      <el-option
                        v-for="option in getFixedQueryOptions(config)"
                        :key="String(option.value)"
                        :label="option.label"
                        :value="option.value"
                      />
                    </el-select>
  
                    <el-select
                      v-else-if="config.inputType === 'select'"
                      v-model="queryValues[config.field.uid]"
                      :placeholder="$t('PublicQueryViewer.selectPlaceholder')"
                      :loading="querySelectLoading[config.field.uid]"
                      :multiple="isMultiValueSelectConfig(config)"
                      :multiple-limit="0"
                      tag-type="primary"
                      clearable
                      filterable
                      collapse-tags
                      collapse-tags-tooltip
                      class="query-common-select"
                    >
                      <el-option
                        v-for="option in (querySelectOptions[config.field.uid] || [])"
                        :key="option.key"
                        :label="option.label"
                        :value="option.value"
                      />
                    </el-select>
  
                    <el-input
                      v-else
                      v-model="queryValues[config.field.uid]"
                      clearable
                      :placeholder="$t('PublicQueryViewer.inputPlaceholder')"
                    />
                  </el-form-item>
                </el-config-provider>
              </div>
            </el-form>
          </div>

          <div class="query-action">
            <el-button type="primary" class="search-btn" @click="handleSearch">
              <el-icon><Search /></el-icon>
              <span>{{ $t('PublicQueryViewer.search') }}</span>
            </el-button>
          </div>
        </div>

        <transition name="result-panel-slide">
          <div class="result-panel" v-if="showResult">
            <div class="mobile-result-header" v-if="isMobileView">
              {{ $t('PublicQueryViewer.queryResultCount', { count: resultRowsCount }) }}
            </div>
            <NocodeDataManagementTable
              class="public-query-result-table"
              :key="tableKey"
              :nocodeId="nocodeId"
              :tableUID="tableUID"
              :uid="tableWidgetUID"
              :tableViewMeta="publicQueryTableViewMeta"
              :preHiddenColumns="hiddenColumns"
              :preViewFilterRules="queryFilterRules"
              :prePageSize="isMobileView ? 10000 : undefined"
              :isAddDataAble="false"
              :isImportDataAble="false"
              :isExportDataAble="false"
              :isDeleteDataAble="false"
              :isShowMoreMenu="false"
              :isEditDataAble="false"
              :searchable="false"
              :filterable="false"
              :isChangeFilterDisplayMode="false"
              :isTableCellEditable="false"
              :sortable="true"
              :hideColumnsAble="false"
              :changeRowHeightAble="false"
              :isShowHeader="true"
              :isShowTableHeaderMenu="!isMobileView"
              headerMenuMode="sort-root-only"
              :enableHeaderFilterPanel="false"
              :updateColumnDataAble="false"
              :isShowCheck="false"
              :isMultiple="false"
              :clickRowShowDetail="false"
              :clickRowChecked="false"
              :isShowFooter="false"
              :isShowAggregateRow="false"
              :isShowPagination="!isMobileView"
              :isAlbum="false"
              :skipOrganizeLoad="true"
              @changeRows="handleResultRowsChange"
            />
            <div class="mobile-result-action" v-if="isMobileView">
              <el-button type="primary" class="mobile-requery-btn" @click="handleBackToQuery">
                {{ $t('PublicQueryViewer.searchAgain') }}
              </el-button>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <div class="tech-support-footer" v-if="showTechSupportFooter">
      <public-share-footer
        class="tech-support-footer__content"
        :publisher="publisher"
        :report-account="reportAccount"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue';
import axios from 'axios';
import { useRoute } from 'vue-router';
import { Search } from '@element-plus/icons-vue';
import { Field, FieldUID, Table, TableUID } from '@common/types/project';
import { FilterRule, FormTableViewMeta, LogicalOperator, RuleFunc, RuleFuncValue } from '@common/types/nocode';
import { NOCODE, ORGANIZE_UTIL, PUBLIC_QUERY_DISPLAY_MAP } from '@renderer/types';
import type { PublicQueryDisplayMap } from '@renderer/types';
import { ElMessage } from 'element-plus';
import Qrcode from 'qrcode.vue';
import { publicQueryVisitTokenStore } from '@renderer/utils/storage';
import { projectApi } from '@renderer/utils/api/project';
import { formDataApi } from '@renderer/utils/api/form-data';
import { formElementInstances } from '@renderer/utils/instance';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { SystemField } from '@common/utils';
import { getChinaAddressData } from '@renderer/utils/township';
import { getSystemColumnConfigurations } from '@renderer/views/nocode/components/global/table/utils';
import NocodeDataManagementTable from '@renderer/views/nocode/components/global/table/NocodeDataManagementTable.vue';
import PublicShareFooter from './PublicShareFooter.vue';
import {
  getPublicQueryFieldFuncInfo,
  isPublicQuerySwitchField,
  isSupportedPublicQueryField,
  shouldPreferPublicQueryInFunc,
} from '@renderer/views/nocode/views/utils/publicQuery';
import i18next from 'i18next';
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";

const route = useRoute();
const nocodeId = route.params.nocodeId as string;
const tableUID = route.params.tableUID as TableUID;
const organizeUtil = new OrganizeUtil();

const loading = ref(false);
const showResult = ref(false);
const tableKey = ref(0);
const resultRowsCount = ref(0);
const password = ref('');
const errorText = ref('');
const isNeedPassword = ref(false);
const isVerifyVisitSuccess = ref(false);
const bootstrap = ref<any>(null);
const nocode = ref<any>(null);
const queryFilterRules = ref<FilterRule[]>();
const queryValues = reactive<Record<string, any>>({});
const publicQueryToken = ref('');
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
const EMPTY_PUBLIC_QUERY_DISPLAY_MAP: PublicQueryDisplayMap = {
  accounts: {},
  departments: {},
  nodes: {},
};

const MOBILE_BREAKPOINT = 768;
const EMPTY_OPTION_VALUE = '__EMPTY__';
const NOT_EMPTY_OPTION_VALUE = '__NOT_EMPTY__';
const QUERY_VALUE_STORAGE_PREFIX = 'public-query-values';
const SWITCH_TRUE_OPTION_VALUE = RuleFunc.TRUE;
const SWITCH_FALSE_OPTION_VALUE = RuleFunc.FALSE;

type QueryInputType = 'text' | 'numberRange' | 'dateRange' | 'timeRange' | 'address' | 'emptyState' | 'switchState' | 'select';
type QuerySelectOption = {
  key: string,
  label: string,
  value: any,
}
type QueryFixedOption = {
  label: string,
  value: string,
}
type QueryFieldFuncInfo = Partial<Record<RuleFunc, RuleFuncValue>>;
type QueryFieldConfig = {
  field: Field,
  inputType: QueryInputType,
  fullRow: boolean,
  func: RuleFunc,
  funcValue: RuleFuncValue | null,
  pickerType?: 'daterange' | 'datetimerange' | 'monthrange' | 'yearrange',
  valueFormat?: string,
  displayFormat?: string,
}

const isMultiValueSelectConfig = (config: Pick<QueryFieldConfig, 'func' | 'funcValue'>) => {
  return config.funcValue === RuleFuncValue.TAGS || config.func === RuleFunc.IN;
};

const getFixedQueryOptions = (config: Pick<QueryFieldConfig, 'inputType'>): QueryFixedOption[] => {
  if (config.inputType === 'switchState') {
    return [
      { label: `${i18next.t('PublicQueryViewer.emptyOption')}`, value: EMPTY_OPTION_VALUE },
      { label: `${i18next.t('PublicQueryViewer.notEmptyOption')}`, value: NOT_EMPTY_OPTION_VALUE },
      { label: i18next.t('commonNocode.enable'), value: SWITCH_TRUE_OPTION_VALUE },
      { label: i18next.t('commonNocode.disable'), value: SWITCH_FALSE_OPTION_VALUE },
    ];
  }
  return [
    { label: `${i18next.t('PublicQueryViewer.emptyOption')}`, value: EMPTY_OPTION_VALUE },
    { label: `${i18next.t('PublicQueryViewer.notEmptyOption')}`, value: NOT_EMPTY_OPTION_VALUE },
  ];
};

const table = computed<Table | undefined>(() => bootstrap.value?.table);
const publisher = computed(() => bootstrap.value?.publisher);
const reportAccount = computed(() => String(bootstrap.value?.reportAccount || ''));
const queryFields = computed<Field[]>(() => bootstrap.value?.queryFields || []);
const displayFieldUIDs = computed<string[]>(() => bootstrap.value?.displayFieldUIDs || []);
const querySelectOptions = reactive<Record<string, QuerySelectOption[]>>({});
const querySelectLoading = reactive<Record<string, boolean>>({});
const queryFieldConfigs = ref<QueryFieldConfig[]>([]);
const queryAccountLabelCache = reactive<Record<string, string>>({});
const queryDepartmentLabelCache = reactive<Record<string, string>>({});
const resolveSubFormFields = (field: Field) => {
  if (Array.isArray(field?.subTableFields) && field.subTableFields.length) {
    return field.subTableFields;
  }
  const subTableUID = field?.meta?.extra?.subTableUID?.[1];
  if (!subTableUID) {
    return [];
  }
  return bootstrap.value?.formData?.tables?.find((item: Table) => item.uid === subTableUID)?.fields || [];
};
const showPasswordPanel = computed(() => {
  return isNeedPassword.value && !isVerifyVisitSuccess.value;
});
const showTechSupportFooter = computed(() => {
  if (showPasswordPanel.value) {
    return true;
  }
  return Boolean(bootstrap.value && table.value);
});
const isMobileView = computed(() => viewportWidth.value <= MOBILE_BREAKPOINT);
const isMobileResultMode = computed(() => isMobileView.value && showResult.value);
const tableWidgetUID = computed(() => `public-query-display-only-${nocodeId}-${tableUID}`);
const publicQueryTableViewMeta = computed<FormTableViewMeta>(() => ({
  hiddenColumns: [],
  columnOrders: {},
}));
const publicQueryVisitUrl = computed(() => (typeof window !== 'undefined' ? window.location.href : ''));
const publicQueryDisplayMap = computed<PublicQueryDisplayMap>(() => bootstrap.value?.displayMap || EMPTY_PUBLIC_QUERY_DISPLAY_MAP);
const visibleFieldUIDs = computed(() => {
  if (!table.value) return new Set<string>();
  const selectedFieldUIDs = new Set(displayFieldUIDs.value);
  const visibleUIDs = new Set<string>();
  for (const field of table.value.fields || []) {
    if (!field) {
      continue;
    }
    const subFields = resolveSubFormFields(field);
    const hasVisibleSubField = subFields.some((subField) => selectedFieldUIDs.has(subField.uid));
    if (selectedFieldUIDs.has(field.uid) || hasVisibleSubField) {
      visibleUIDs.add(field.uid);
    }
    const selectedSubFields = subFields.filter((subField) => selectedFieldUIDs.has(subField.uid));
    const shouldShowAllSubFields = selectedFieldUIDs.has(field.uid) && selectedSubFields.length === 0;
    if (shouldShowAllSubFields) {
      for (const subField of subFields) {
        visibleUIDs.add(subField.uid);
      }
      continue;
    }
    for (const subField of selectedSubFields) {
      visibleUIDs.add(subField.uid);
    }
  }
  return visibleUIDs;
});
const hiddenColumns = computed<FieldUID[]>(() => {
  if (!table.value) return [];
  const hiddenUIDs = new Set<FieldUID>();
  for (const field of table.value.fields || []) {
    if (!field) {
      continue;
    }
    if (field.meta?.subType === 'related') {
      hiddenUIDs.add(field.uid);
    }
    if (!visibleFieldUIDs.value.has(field.uid)) {
      hiddenUIDs.add(field.uid);
    }
    if (field.meta?.name === SystemField.RELATED_SUB_FORM) {
      hiddenUIDs.add(field.uid);
    }
    for (const subField of resolveSubFormFields(field)) {
      if (subField.meta?.subType === 'related') {
        hiddenUIDs.add(subField.uid);
      }
      if (!visibleFieldUIDs.value.has(subField.uid)) {
        hiddenUIDs.add(subField.uid);
      }
      if (subField.meta?.name === SystemField.RELATED_SUB_FORM) {
        hiddenUIDs.add(subField.uid);
      }
    }
  }
  return [...hiddenUIDs];
});

const getWidgetType = (field: Field) => field?.meta?.extra?.widgetType || '';
const getQueryValueStorageKey = () => `${QUERY_VALUE_STORAGE_PREFIX}:${nocodeId}:${tableUID}`;

const getFieldConfigurations = async (field: Field) => {
  const widgetType = getWidgetType(field);
  if (widgetType) {
    const instance = await formElementInstances.getInstance(widgetType);
    return instance?.getConfigurations?.() || {};
  }
  return getSystemColumnConfigurations(field?.meta?.name) || {};
};

const shouldPreferInQueryFunc = (field: Field, funcInfo: QueryFieldFuncInfo) => {
  return shouldPreferPublicQueryInFunc(field, funcInfo);
};

const pickQueryFuncInfo = (field: Field, funcInfo: QueryFieldFuncInfo): { func: RuleFunc, funcValue: RuleFuncValue | null } => {
  if (funcInfo[RuleFunc.TIME_BETWEEN] === RuleFuncValue.RANGE) {
    return {
      func: RuleFunc.TIME_BETWEEN,
      funcValue: RuleFuncValue.RANGE,
    };
  }
  if (funcInfo[RuleFunc.BETWEEN] === RuleFuncValue.RANGE) {
    return {
      func: RuleFunc.BETWEEN,
      funcValue: RuleFuncValue.RANGE,
    };
  }
  if (funcInfo[RuleFunc.BELONG] === RuleFuncValue.ADDRESS) {
    return {
      func: RuleFunc.BELONG,
      funcValue: RuleFuncValue.ADDRESS,
    };
  }
  if (shouldPreferInQueryFunc(field, funcInfo)) {
    return {
      func: RuleFunc.IN,
      funcValue: funcInfo[RuleFunc.IN] || null,
    };
  }
  if (funcInfo[RuleFunc.EQUAL]) {
    return {
      func: RuleFunc.EQUAL,
      funcValue: funcInfo[RuleFunc.EQUAL] || null,
    };
  }
  if (funcInfo[RuleFunc.EMPTY] === RuleFuncValue.NULL || funcInfo[RuleFunc.NOT_EMPTY] === RuleFuncValue.NULL) {
    return {
      func: RuleFunc.EMPTY,
      funcValue: RuleFuncValue.NULL,
    };
  }

  const [firstFunc, firstValue] = Object.entries(funcInfo)[0] || [];
  return {
    func: (firstFunc as RuleFunc) || RuleFunc.EQUAL,
    funcValue: (firstValue as RuleFuncValue) || RuleFuncValue.STRING,
  };
};

const getDateRangePickerMeta = (field: Field) => {
  switch (field?.meta?.subType) {
    case 'datetime':
      return {
        inputType: 'dateRange' as const,
        pickerType: 'datetimerange' as const,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
        displayFormat: 'YYYY-MM-DD HH:mm:ss',
      };
    case 'month':
      return {
        inputType: 'dateRange' as const,
        pickerType: 'monthrange' as const,
        valueFormat: 'YYYY-MM',
        displayFormat: 'YYYY-MM',
      };
    case 'year':
      return {
        inputType: 'dateRange' as const,
        pickerType: 'yearrange' as const,
        valueFormat: 'YYYY',
        displayFormat: 'YYYY',
      };
    case 'time':
      return {
        inputType: 'timeRange' as const,
      };
    default:
      return {
        inputType: 'dateRange' as const,
        pickerType: 'daterange' as const,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
        displayFormat: 'YYYY-MM-DD',
      };
  }
};

const buildQueryFieldConfig = async (field: Field): Promise<QueryFieldConfig | null> => {
  const funcInfo = await getPublicQueryFieldFuncInfo(field);
  if (!isSupportedPublicQueryField(field, funcInfo)) {
    return null;
  }
  const { func, funcValue } = pickQueryFuncInfo(field, funcInfo);
  const baseConfig = {
    field,
    func,
    funcValue,
  };

  if (isPublicQuerySwitchField(field, funcInfo)) {
    return {
      ...baseConfig,
      inputType: 'switchState',
      fullRow: false,
    };
  }
  if (funcValue === RuleFuncValue.NULL) {
    return {
      ...baseConfig,
      inputType: 'emptyState',
      fullRow: false,
    };
  }
  if (func === RuleFunc.BETWEEN && funcValue === RuleFuncValue.RANGE) {
    return {
      ...baseConfig,
      inputType: 'numberRange',
      fullRow: true,
    };
  }
  if (func === RuleFunc.TIME_BETWEEN && funcValue === RuleFuncValue.RANGE) {
    const datePickerMeta = getDateRangePickerMeta(field);
    return {
      ...baseConfig,
      ...datePickerMeta,
      fullRow: true,
    };
  }
  if (funcValue === RuleFuncValue.ADDRESS) {
    return {
      ...baseConfig,
      inputType: 'address',
      fullRow: false,
    };
  }
  if ([RuleFuncValue.SELECT, RuleFuncValue.TREE_SELECT, RuleFuncValue.TAGS].includes(funcValue || RuleFuncValue.STRING)) {
    return {
      ...baseConfig,
      inputType: 'select',
      fullRow: false,
    };
  }
  return {
    ...baseConfig,
    inputType: 'text',
    fullRow: false,
  };
};

const restorePersistedQueryValues = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const raw = window.localStorage.getItem(getQueryValueStorageKey());
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return;
    }
    Object.entries(parsed).forEach(([fieldUID, value]) => {
      queryValues[fieldUID] = value;
    });
  } catch (error) {
    window.localStorage.removeItem(getQueryValueStorageKey());
  }
};

const persistQueryValues = () => {
  if (typeof window === 'undefined' || !bootstrap.value) {
    return;
  }
  const payload = queryFieldConfigs.value.reduce<Record<string, any>>((result, config) => {
    result[config.field.uid] = queryValues[config.field.uid];
    return result;
  }, {});
  window.localStorage.setItem(getQueryValueStorageKey(), JSON.stringify(payload));
};

const normalizeQueryOptionLabel = (value: any) => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (value && typeof value === 'object') {
    const readableValue = [value.label, value.name, value.alias, value.title, value.text]
      .find((item) => item !== null && item !== undefined && String(item).trim() !== '');
    return readableValue ? String(readableValue) : '-';
  }
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
};

const isEmptyQueryOptionValue = (value: any): boolean => {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  return Array.isArray(value) && value.every(item => isEmptyQueryOptionValue(item));
};

const flattenQueryFieldOptions = (options: any[]): any[] => {
  return (options || []).reduce<any[]>((result, option) => {
    if (!option || typeof option !== 'object') {
      return result;
    }
    if (Array.isArray(option.options)) {
      result.push(...flattenQueryFieldOptions(option.options));
      return result;
    }
    if (Array.isArray(option.children)) {
      result.push(...flattenQueryFieldOptions(option.children));
      return result;
    }
    result.push(option);
    return result;
  }, []);
};

const getFieldStaticOptions = (field: Field) => {
  const widgetType = getWidgetType(field);
  const extra = field?.meta?.extra || {};
  if (widgetType === 'widget.form.treeSelect' || widgetType === 'widget.form.treeMultipleSelect') {
    if (extra['select-choices-type'] === 'custom') {
      return extra['treeselect-value-text-option']?.options || [];
    }
    return [];
  }
  if (widgetType === 'widget.form.radioGroup') {
    return extra['radiogroup-value-text-color-option']?.options || [];
  }
  if (widgetType === 'widget.form.checkboxGroup') {
    return extra['checkbox-option']?.options || [];
  }
  return extra.options || [];
};

const getQueryStaticOptionLabel = (field: Field, value: any) => {
  const options = flattenQueryFieldOptions(getFieldStaticOptions(field));
  const matchedOption = options.find((option) => {
    const optionValue = option?.value ?? option?.id ?? option?.uid ?? option?.key;
    return optionValue !== undefined && String(optionValue) === String(value);
  });
  if (!matchedOption) {
    return '';
  }
  const label = matchedOption?.label ?? matchedOption?.name ?? matchedOption?.alias ?? matchedOption?.text;
  return label === null || label === undefined || String(label).trim() === '' ? '' : String(label);
};

const getQueryAccountLabel = async (userId: string) => {
  if (!userId) {
    return i18next.t('FilterValueFormat.unknownMember');
  }
  const mappedAccount = publicQueryDisplayMap.value.accounts?.[userId];
  if (mappedAccount) {
    const label = mappedAccount.realname || mappedAccount.user || i18next.t('FilterValueFormat.unknownMember');
    queryAccountLabelCache[userId] = label;
    return label;
  }
  if (bootstrap.value) {
    return i18next.t('FilterValueFormat.unknownMember');
  }
  if (queryAccountLabelCache[userId]) {
    return queryAccountLabelCache[userId];
  }
  return i18next.t('FilterValueFormat.unknownMember');
};

const getQueryDepartmentLabel = async (departmentId: string) => {
  if (!departmentId) {
    return i18next.t('FilterValueFormat.unknownDep');
  }
  const mappedDepartment = publicQueryDisplayMap.value.departments?.[departmentId];
  if (mappedDepartment?.name) {
    queryDepartmentLabelCache[departmentId] = mappedDepartment.name;
    return mappedDepartment.name;
  }
  if (bootstrap.value) {
    return i18next.t('FilterValueFormat.unknownDep');
  }
  if (queryDepartmentLabelCache[departmentId]) {
    return queryDepartmentLabelCache[departmentId];
  }
  return i18next.t('FilterValueFormat.unknownDep');
};

const getQueryNodeLabel = (nodeId: string) => {
  if (!nodeId) {
    return i18next.t('FilterValueFormat.unknownNode');
  }
  return publicQueryDisplayMap.value.nodes?.[nodeId]?.name || i18next.t('FilterValueFormat.unknownNode');
};

const formatQueryOptionLabel = async (field: Field, value: any): Promise<string> => {
  if (Array.isArray(value)) {
    const labels = await Promise.all(value.map(item => formatQueryOptionLabel(field, item)));
    return labels.filter(label => label && label !== '-').join(', ') || '-';
  }
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const configurations = await getFieldConfigurations(field);
  const staticOptionLabel = getQueryStaticOptionLabel(field, value);
  if (staticOptionLabel) {
    return staticOptionLabel;
  }
  if (configurations?.subType === 'account') {
    return await getQueryAccountLabel(String(value));
  }
  if (configurations?.subType === 'department') {
    return await getQueryDepartmentLabel(String(value));
  }
  if (configurations?.subType === 'node') {
    return getQueryNodeLabel(String(value));
  }
  return normalizeQueryOptionLabel(value);
};

const buildQuerySelectOptions = async (field: Field, values: any[]) => {
  const optionMap = new Map<string, QuerySelectOption>();
  const normalizedValues = await Promise.all((values || []).map(async (raw, index) => ({
    raw,
    index,
    label: await formatQueryOptionLabel(field, raw),
  })));
  normalizedValues.forEach(({ raw, index, label }) => {
    if (isEmptyQueryOptionValue(raw)) {
      return;
    }
    const key = typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
      ? String(raw)
      : `${index}-${JSON.stringify(raw)}`;
    if (optionMap.has(key)) {
      return;
    }
    optionMap.set(key, {
      key,
      label,
      value: raw,
    });
  });
  return [...optionMap.values()];
};

const refreshQueryFieldConfigs = async () => {
  const configs = await Promise.all(queryFields.value.map((field) => buildQueryFieldConfig(field)));
  queryFieldConfigs.value = configs.filter((config): config is QueryFieldConfig => Boolean(config));
};

const loadQuerySelectOptions = async () => {
  const selectFields = queryFieldConfigs.value
    .filter((config) => config.inputType === 'select')
    .map((config) => config.field);
  await Promise.all(selectFields.map(async (field) => {
    querySelectLoading[field.uid] = true;
    try {
      const values = await formDataApi.distinct({
        nocodeId,
        tableUID,
        columnId: field.uid,
      });
      querySelectOptions[field.uid] = await buildQuerySelectOptions(field, values || []);
    } catch (error) {
      querySelectOptions[field.uid] = [];
    } finally {
      querySelectLoading[field.uid] = false;
    }
  }));
};

const getDefaultQueryValue = (config: QueryFieldConfig) => {
  if (config.inputType === 'numberRange') {
    return ['', ''];
  }
  if (config.inputType === 'dateRange' || config.inputType === 'timeRange') {
    return [];
  }
  if (isMultiValueSelectConfig(config)) {
    return [];
  }
  return '';
};

const ensureQueryValueState = () => {
  const currentFieldUIDs = new Set(queryFieldConfigs.value.map((config) => config.field.uid));
  Object.keys(queryValues).forEach((fieldUID: FieldUID) => {
    if (!currentFieldUIDs.has(fieldUID)) {
      delete queryValues[fieldUID];
    }
  });

  queryFieldConfigs.value.forEach((config) => {
    const fieldUID = config.field.uid;
    const currentValue = queryValues[fieldUID];
    if (!Object.prototype.hasOwnProperty.call(queryValues, fieldUID)) {
      queryValues[fieldUID] = getDefaultQueryValue(config);
      return;
    }
    if (config.inputType === 'numberRange' && (!Array.isArray(currentValue) || currentValue.length !== 2)) {
      queryValues[fieldUID] = ['', ''];
      return;
    }
    if ((config.inputType === 'dateRange' || config.inputType === 'timeRange') && !Array.isArray(currentValue)) {
      queryValues[fieldUID] = [];
      return;
    }
    if (isMultiValueSelectConfig(config) && !Array.isArray(currentValue)) {
      queryValues[fieldUID] = currentValue === '' || currentValue === null || currentValue === undefined
        ? []
        : [currentValue];
    }
  });
};

const updateRangeValue = (fieldUID: string, index: number, value: string) => {
  const current = Array.isArray(queryValues[fieldUID]) ? [...queryValues[fieldUID]] : ['', ''];
  current[index] = value;
  queryValues[fieldUID] = current;
};

const findAddressNodeByValue = (nodes: any[], value: string): any => {
  for (const node of nodes || []) {
    if (node.value === value) {
      return node;
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      const match = findAddressNodeByValue(node.children, value);
      if (match) {
        return match;
      }
    }
  }
  return null;
};

const loadAddressNode = async (node: any, resolve: (data: any[]) => void) => {
  const chinaAddressData = await getChinaAddressData();
  if (!node?.label) {
    resolve(chinaAddressData.map(({ children, ...rest }) => ({
      ...rest,
      isLeaf: !children || children.length === 0,
    })));
    return;
  }
  const match = findAddressNodeByValue(chinaAddressData, node.data?.value);
  if (!match || !Array.isArray(match.children)) {
    resolve([]);
    return;
  }
  resolve(match.children.map(({ children, ...rest }) => ({
    ...rest,
    isLeaf: !children || children.length === 0,
  })));
};

const loadAccess = async () => {
  const data = await projectApi.getPublicQueryAccess({
    nocodeId,
    tableUID,
  });
  isNeedPassword.value = !!data?.isNeedPassword;
};

const validateToken = async (token: string) => {
  return await projectApi.validatePublicQueryToken({
    nocodeId,
    tableUID,
    token,
  }).catch(() => false);
};

const tryAutoLogin = async () => {
  const token = publicQueryVisitTokenStore.get();
  if (!token) return;
  const valid = await validateToken(token);
  if (valid) {
    isVerifyVisitSuccess.value = true;
    publicQueryToken.value = token;
  } else {
    publicQueryVisitTokenStore.remove();
  }
};

const loadBootstrap = async () => {
  if (publicQueryToken.value) {
    axios.defaults.headers.common['x-public-query-token'] = publicQueryToken.value;
  } else {
    delete axios.defaults.headers.common['x-public-query-token'];
  }
  const data = await projectApi.getPublicQueryBootstrap({
    nocodeId,
    tableUID,
  });
  bootstrap.value = data;
  publicQueryToken.value = String(data?.token || '');
  if (publicQueryToken.value) {
    axios.defaults.headers.common['x-public-query-token'] = publicQueryToken.value;
    publicQueryVisitTokenStore.set(publicQueryToken.value);
  }
  nocode.value = {
    meta: {
      id: data?.nocode?.id || nocodeId,
      name: data?.nocode?.name || data?.table?.alias || '',
    },
    body: {
      formData: data?.formData,
      permissions: {
        application: {},
        page: {},
        view: {},
        field: {},
        data: {},
      },
      structure: [],
      views: {},
    },
  };
  await refreshQueryFieldConfigs();
  restorePersistedQueryValues();
  ensureQueryValueState();
  persistQueryValues();
  await loadQuerySelectOptions();
  document.title = data?.table?.alias || data?.nocode?.name || '';
};

const handleVerifyVisit = async () => {
  const data = await projectApi.visitPublicQuery({
    nocodeId,
    tableUID,
    password: password.value,
  }).catch((error) => {
    ElMessage.error(error?.response?.data?.message || error?.message);
    return null;
  });
  if (!data?.success) {
    return;
  }
  isVerifyVisitSuccess.value = true;
  publicQueryToken.value = String(data.token || '');
  publicQueryVisitTokenStore.set(publicQueryToken.value);
  await loadBootstrap();
};

const hasValidValue = (config: QueryFieldConfig, value: any) => {
  if (config.inputType === 'numberRange') {
    return Array.isArray(value)
      && value.length === 2
      && value[0] !== ''
      && value[1] !== ''
      && value[0] !== null
      && value[1] !== null
      && !Number.isNaN(Number(value[0]))
      && !Number.isNaN(Number(value[1]));
  }
  if (config.inputType === 'dateRange' || config.inputType === 'timeRange') {
    return Array.isArray(value) && value.length === 2 && value.every(item => Boolean(item));
  }
  if (config.inputType === 'emptyState') {
    return [EMPTY_OPTION_VALUE, NOT_EMPTY_OPTION_VALUE].includes(value);
  }
  if (config.inputType === 'switchState') {
    return [EMPTY_OPTION_VALUE, NOT_EMPTY_OPTION_VALUE, SWITCH_TRUE_OPTION_VALUE, SWITCH_FALSE_OPTION_VALUE].includes(value);
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  return true;
};

const resolveConditionByConfig = (config: QueryFieldConfig) => {
  const rawValue = queryValues[config.field.uid];
  if (config.inputType === 'numberRange') {
    return {
      uid: config.field.uid,
      func: RuleFunc.BETWEEN,
      value: [Number(rawValue[0]), Number(rawValue[1])],
    };
  }
  if (config.inputType === 'dateRange' || config.inputType === 'timeRange') {
    return {
      uid: config.field.uid,
      func: RuleFunc.TIME_BETWEEN,
      value: rawValue,
    };
  }
  if (config.inputType === 'emptyState') {
    return {
      uid: config.field.uid,
      func: rawValue === EMPTY_OPTION_VALUE ? RuleFunc.EMPTY : RuleFunc.NOT_EMPTY,
      value: '',
    };
  }
  if (config.inputType === 'switchState') {
    return {
      uid: config.field.uid,
      func: (rawValue === EMPTY_OPTION_VALUE
        ? RuleFunc.EMPTY
        : rawValue === NOT_EMPTY_OPTION_VALUE
          ? RuleFunc.NOT_EMPTY
          : rawValue) as RuleFunc,
      value: '',
    };
  }
  if (isMultiValueSelectConfig(config)) {
    return {
      uid: config.field.uid,
      func: config.func,
      value: Array.isArray(rawValue) ? rawValue : [rawValue],
    };
  }
  if (typeof rawValue === 'string') {
    return {
      uid: config.field.uid,
      func: config.func,
      value: rawValue.trim(),
    };
  }
  return {
    uid: config.field.uid,
    func: config.func,
    value: rawValue,
  };
};

const handleSearch = async () => {
  const hasIncompleteCondition = queryFieldConfigs.value.some((config) => !hasValidValue(config, queryValues[config.field.uid]));
  if (hasIncompleteCondition) {
    ElMessage.warning(i18next.t('PublicQueryViewer.queryConditionRequired'));
    return;
  }

  const conditions = queryFieldConfigs.value
    .map((config) => resolveConditionByConfig(config))
    .filter(Boolean);

  queryFilterRules.value = conditions.length
    ? [{
      logic: LogicalOperator.AND,
      conditions,
    }] as FilterRule[]
    : undefined;
  resultRowsCount.value = 0;
  showResult.value = true;
  tableKey.value += 1;
};

const handleResultRowsChange = (rows: any[]) => {
  resultRowsCount.value = Array.isArray(rows) ? rows.length : 0;
};

const handleBackToQuery = () => {
  showResult.value = false;
};

const updateViewportWidth = () => {
  if (typeof window === 'undefined') {
    return;
  }
  viewportWidth.value = window.innerWidth;
};

watch(queryValues, () => {
  persistQueryValues();
}, {
  deep: true,
});

const init = async () => {
  loading.value = true;
  errorText.value = '';
  try {
    await loadAccess();
    if (isNeedPassword.value) {
      await tryAutoLogin();
      if (!isVerifyVisitSuccess.value) {
        return;
      }
    } else {
      isVerifyVisitSuccess.value = true;
    }
    await loadBootstrap();
  } catch (error: any) {
    errorText.value = error?.response?.data?.message || error?.message || i18next.t('PublicQueryViewer.invalidLink');
  } finally {
    loading.value = false;
  }
};

init();
provide(NOCODE, nocode);
provide(ORGANIZE_UTIL, organizeUtil);
provide(PUBLIC_QUERY_DISPLAY_MAP, publicQueryDisplayMap);

onMounted(() => {
  updateViewportWidth();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateViewportWidth);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateViewportWidth);
  }
  delete axios.defaults.headers.common['x-public-query-token'];
});
</script>

<style scoped lang="scss">
.public-query-viewer {
  position: relative;
  height: 100%;
  width: 100%;
  background-color: #f2f3f5;
  padding: 40px;

  .visit-login {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;

    .wrap-form {
      width: 760px;
      height: 520px;
      background: #ffffff;
      border-radius: 16px;
      padding: 48px;
      display: flex;
      flex-direction: column;
      place-content: flex-start;
      place-items: flex-start;
      gap: 32px;

      .tip {
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        height: 24px;
        color: var(--text-color-primary);
      }

      .el-button {
        width: 100%;
        height: 36px;
        border-radius: 4px;
      }

      :deep(.el-input__wrapper) {
        min-height: 36px;
        border-radius: 4px;
        background: #f3f4f6;
        box-shadow: none;
      }

      :deep(.el-input__inner::placeholder) {
        color: #9ca3af;
      }
    }
  }

  .content {
    height: calc(100% - 18px);
    display: flex;
    flex-direction: column;

    &.query-content {
      justify-content: center;
      align-items: center;
    }

    &.result-content {
      justify-content: flex-start;
      align-items: stretch;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .result-layout-shell {
      width: 760px;
      min-height: 520px;
      margin: 0 auto;
      display: flex;
      gap: 0;
      transition: width 0.32s cubic-bezier(0.22, 1, 0.36, 1), min-height 0.32s cubic-bezier(0.22, 1, 0.36, 1), gap 0.32s cubic-bezier(0.22, 1, 0.36, 1);

      &.is-result {
        width: clamp(1052px, calc(100vw - 48px), 1832px);
        height: 100%;
        min-height: 0;
        gap: 12px;
        flex: 0 0 auto;
      }
    }

    .query-side-panel {
      width: 100%;
      flex: 0 0 100%;
      min-height: 380px;
      background: #ffffff;
      border-radius: 12px;
      padding: 32px 36px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      transition: width 0.32s cubic-bezier(0.22, 1, 0.36, 1), flex-basis 0.32s cubic-bezier(0.22, 1, 0.36, 1), min-height 0.32s cubic-bezier(0.22, 1, 0.36, 1), padding 0.32s cubic-bezier(0.22, 1, 0.36, 1);
      gap: 32px;

      &.is-result {
        width: 400px;
        flex: 0 0 400px;
        min-height: 0;
        padding: 24px;
      }
    }

    .query-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .query-title {
      margin: 0;
      font-weight: 500;
      font-size: 16px;
      line-height: 24px;
      color: var(--text-color-primary);
    }

    .query-side-panel.is-result .query-title {
      font-weight: 500;
      font-size: 16px;
      line-height: 24px;
    }

    .qr-btn {
      width: 24px;
      height: 24px;
      padding: 0;
      color: #8c8c8c;
      border: none;
      background: transparent;

      &:hover {
        background-color: #f1f1f1;
      }
    }

    .query-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      gap: 16px;

      &.empty {
        justify-content: center;
        align-items: center;
      }
    }

    .empty-tip {
      color: #9ca3af;
      font-size: 14px;
      line-height: 22px;
    }

    .query-form {
      width: 100%;
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding-right: 2px;
    }

    .query-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .query-field-item {
      margin-bottom: 0;

      &.is-full-row {
        grid-column: 1 / -1;
      }
    }

    .query-side-panel .query-grid .query-field-item:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }

    .query-side-panel.is-result .query-grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .query-field-item :deep(.el-form-item__label) {
      font-weight: 500;
      font-size: 14px;
      line-height: 22px;
      color: var(--text-color-primary);
    }

    .query-field-item :deep(.el-input__wrapper),
    .query-field-item :deep(.el-select__wrapper),
    .query-field-item :deep(.el-date-editor),
    .query-field-item :deep(.el-tree-select .el-select__wrapper) {
      min-height: 36px;
      border-radius: 4px;
      background: #f3f4f6;
      box-shadow: none;
      border: 1px solid transparent;
    }

    .query-field-item :deep(.el-date-editor) {
      width: 100%;
      padding: 0 12px;
    }

    .query-field-item :deep(.el-date-editor .el-range-input) {
      background: transparent;
    }

    .query-field-item :deep(.el-input-tag) {
      width: 100%;
      min-height: 36px;
      border-radius: 4px;
      background: #f3f4f6;
    }

    .range-input-group {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    }

    .range-separator {
      color: #8c8c8c;
      flex: 0 0 auto;
    }

    .query-common-select,
    .query-address-select,
    .query-date-range,
    .query-tag-input {
      width: 100%;
    }

    .query-action {
      margin-top: auto;
    }

    .search-btn {
      width: 100%;
      height: 36px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 22px;
      font-weight: 400;
    }

    .result-panel {
      flex: 1;
      width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background-color: #fff;
      border-radius: 16px;
      padding: 24px;
      gap: 16px;
      box-sizing: border-box;

      :deep(.nocode-data-management-table) {
        flex: 1;
        min-height: 0;
      }
      :deep(.public-query-result-table .virtual-table__scroller::-webkit-scrollbar) {
        display: block !important;
      }
      :deep(.public-query-result-table .virtual-table__scroller::-webkit-scrollbar:horizontal) {
        display: block !important;
        height: 10px;
      }
      :deep(.public-query-result-table .virtual-table__scroller) {
        scrollbar-width: auto;
      }
    }

    .mobile-result-header {
      margin-bottom: 12px;
      text-align: center;
      font-size: 22px;
      font-weight: 600;
      line-height: 30px;
      color: var(--text-color-primary);
    }

    .mobile-result-action {
      padding: 12px 20px 0;
      box-sizing: border-box;
    }

    .mobile-requery-btn {
      width: 100%;
      height: 40px;
      border-radius: 8px;
      font-size: 16px;
    }
  }
}

.tech-support-footer {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  width: min(760px, calc(100% - 80px));
  display: flex;
  justify-content: center;
}

.tech-support-footer__content {
  width: auto;
}

.tech-support-footer :deep(.public-share-footer) {
  position: relative;
  width: min(760px, calc(100vw - 80px));
  justify-content: center;
  margin: 0 auto;
}

.tech-support-footer :deep(.brand) {
  justify-content: center;
}

.tech-support-footer :deep(.brand-link),
.tech-support-footer :deep(.brand-text),
.tech-support-footer :deep(.report-link),
.tech-support-footer :deep(.brand-logo),
.tech-support-footer :deep(.el-icon) {
  color: #c2c8d1;
}

.result-panel-slide-enter-active,
.result-panel-slide-leave-active {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.result-panel-slide-enter-from,
.result-panel-slide-leave-to {
  opacity: 0;
  transform: translateX(56px);
}

:deep(.public-query-qr-popper) {
  border: none !important;
  border-radius: 4px !important;
  padding: 8px !important;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12) !important;
  background-color: #fff;
}

:deep(.public-query-qr-popper .qr-popover-content) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

:deep(.public-query-qr-popper .qr-tip) {
  font-size: 12px;
  line-height: 18px;
  color: #666;
}

@media (max-width: 768px) {
  .public-query-viewer {
    padding: 0;
    background: #f5f5f6;
    min-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .public-query-viewer .visit-login {
    align-items: flex-start;
    min-height: 100%;
    padding: 8px 16px calc(64px + 8px + env(safe-area-inset-bottom));
    background-color: #fff;
    box-sizing: border-box;
  }

  .public-query-viewer .visit-login .wrap-form {
    width: 100%;
    min-height: calc(100vh - 16px - 64px - 8px - env(safe-area-inset-bottom));
    background: transparent;
    border-radius: 0;
    padding: 0;
    gap: 12px;

    :deep(.el-input__wrapper) {
      height: 40px;
      border-radius: 8px;
    }

    .el-button {
      width: 100%;
      height: 40px;
      border-radius: 8px;
      font-size: 16px;
      line-height: 24px;
      margin-top: 12px;
    }
  }

  .public-query-viewer .visit-login .wrap-form .tip {
    height: 32px;
    margin: 0 auto;
    font-size: 16px;
    line-height: 32px;
  }

  .public-query-viewer .content {
    min-height: 100%;
    padding: 8px 16px calc(64px + 8px + env(safe-area-inset-bottom));
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  .public-query-viewer .content.query-content {
    justify-content: flex-start;
    align-items: stretch;
  }

  .public-query-viewer .content .result-layout-shell {
    width: 100%;
    max-width: none;
    min-height: calc(100vh - 16px - 64px - 8px - env(safe-area-inset-bottom));
    height: auto;
    display: flex;
    flex-direction: column;
    margin: 0;
    gap: 0;
  }

  .public-query-viewer .content .query-side-panel {
    width: 100%;
    flex: 0 0 auto;
    min-height: calc(100vh - 16px - 64px - 8px - env(safe-area-inset-bottom));
    padding: 16px;
    border-radius: 12px;
    gap: 12px;
  }

  .public-query-viewer .content .query-body {
    overflow: visible;
  }

  .public-query-viewer .content .query-form {
    flex: none;
    min-height: auto;
    overflow: visible;
    padding-right: 0;
  }

  .public-query-viewer .content .query-header {
    justify-content: center;
    margin-bottom: 4px;
  }

  .public-query-viewer .content .query-title,
  .public-query-viewer .content .query-side-panel.is-result .query-title {
    font-size: 16px;
    line-height: 24px;
    font-weight: 500;
  }

  .public-query-viewer .content .query-grid,
  .public-query-viewer .content .query-side-panel.is-result .query-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .public-query-viewer .content .query-field-item :deep(.el-form-item__label) {
    font-size: 15px;
    line-height: 23px;
  }

  .public-query-viewer .content .query-field-item :deep(.el-input__wrapper),
  .public-query-viewer .content .query-field-item :deep(.el-select__wrapper),
  .public-query-viewer .content .query-field-item :deep(.el-date-editor),
  .public-query-viewer .content .query-field-item :deep(.el-tree-select .el-select__wrapper),
  .public-query-viewer .content .query-field-item :deep(.el-input-tag) {
    min-height: 42px;
    border-radius: 6px;
  }

  .public-query-viewer .content.result-content {
    padding: 8px 16px calc(64px + 8px + env(safe-area-inset-bottom));
    overflow-y: auto;
    overflow-x: hidden;
  }

  .public-query-viewer .content.result-content .result-layout-shell.is-result {
    width: 100%;
    min-width: 0;
    max-width: none;
    height: auto;
    min-height: calc(100vh - 16px - 64px - 8px - env(safe-area-inset-bottom));
    gap: 0;
  }

  .public-query-viewer .content.result-content .result-panel {
    width: 100%;
    flex: 1;
    min-height: calc(100vh - 16px - 64px - 8px - env(safe-area-inset-bottom));
    border-radius: 12px;
    background: #ffffff;
    padding: 12px 0 0;
    gap: 12px;
  }

  .public-query-viewer .content.result-content .mobile-result-header {
    margin-bottom: 12px;
    font-size: 16px;
    line-height: 24px;
    font-weight: 600;
  }

  .public-query-viewer .content.result-content .result-panel :deep(.nocode-data-management-table) {
    flex: 1 1 auto;
    min-height: 0;
    background: #ffffff;
  }

  .public-query-viewer .content.result-content .mobile-result-action {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 8px 16px calc(8px + env(safe-area-inset-bottom));
    background: #ffffff;
    border-top: 1px solid #ebedf0;
    z-index: 22;
  }

  .public-query-viewer .content.result-content .mobile-requery-btn {
    border-radius: 8px;
    height: 40px;
    font-size: 16px;
    line-height: 24px;
    width: 100%;
  }

  .public-query-viewer .content .query-action {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    margin-top: 0;
    padding: 8px 16px calc(8px + env(safe-area-inset-bottom));
    background: #ffffff;
    border-top: 1px solid #ebedf0;
    z-index: 22;
  }

  .public-query-viewer .content .query-action .search-btn {
    height: 40px;
    border-radius: 8px;
    font-size: 16px;
    line-height: 24px;
  }

  .public-query-viewer .content .query-action .search-btn .el-icon {
    display: none;
  }

  .public-query-viewer .tech-support-footer {
    bottom: calc(24px + env(safe-area-inset-bottom));
    width: calc(100% - 32px);
  }
}
</style>
