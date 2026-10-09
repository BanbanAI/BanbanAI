<template>
  <div
    class="cell-content-value"
    :subType="subType"
    :class="getRowClassName"
  >
    <template v-if="!haveValue">
      <slot name="none"></slot>
    </template>
    <template v-else-if="subType === 'account'">
      <el-space class="link account" wrap spacer=",&nbsp;" :size="2">
        <template v-for="(account, index) in accountValue" :key="index">
          <template v-if="!account">
            <div>
              {{ displayUserValue(account?.id) }}
            </div>
          </template>
          <el-popover v-else trigger="click" placement="bottom-start" width="200" popper-class="user-popover" :popper-style="{
            background: 'var(--color-white)',
            padding: '2px'
          }" :show-arrow="false">
            <template #reference>
              <span
                :class="{'row-height-small': rowHeightLevel === FormTableRowHeight.SMALL}"
                :title="displayUserValue(account?.id)"
                @click.stop
              >
                {{ displayUserValue(account?.id) }}
              </span>
            </template>
            <div class="user-card">
              <div class="card-top">
                <div class="avatar">
                  <span class="avatar-text">{{ getUserBaseName(account, '?')?.[0] || '?' }}</span>
                </div>
                <div class="top-row">
                  <span class="name">{{ getUserDisplayName(account, $t('TableCellFormat.none')) }}</span>
                </div>
              </div>
              <div class="user-info">
                <div class="info-row"><span>{{ $t('TableCellFormat.name') }}{{ getI18nLabelColon() }}</span>{{ getUserDisplayName(account, $t('TableCellFormat.none')) }}</div>
                <div class="info-row"><span>{{ $t('TableCellFormat.phone') }}{{ getI18nLabelColon() }}</span>{{ account?.phone || $t('TableCellFormat.none') }}</div>
                <div class="info-row"><span v-if="account?.user !== 'admin'">{{ $t('TableCellFormat.department') }}{{ getI18nLabelColon() }}</span>{{ account?.user === 'admin' ? $t('TableCellFormat.superAdmin') : `${account?.department?.name || $t('TableCellFormat.none')}` }}</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-space>
    </template>
    <template v-else-if="subType === 'department'">
      <el-space class="link" wrap spacer="," :size="2">
        <template v-for="(dept, index) in departmentValue" :key="dept.id">
          <el-popover trigger="click" placement="bottom-start" width="200">
            <template #reference>
              <span :title="dept.name" @click.stop>{{ dept.name }}</span>
            </template>
            <span>{{ $t('TableCellFormat.depBelong') }}:&nbsp;{{ dept.parents.map(p=>p.name).join("/") }}</span>
          </el-popover>
        </template>
      </el-space>
    </template>
    <template v-else-if="subType === 'related'">
      <el-space class="link" wrap spacer="," :size="2">
        <span
          v-for="item in relatedValue"
          :key="item[relatedRowKey]"
          :title="item[relatedTitleFieldUID]"
          @click.stop="emit('show-related-form', { relatedTableUID, uuid: item[relatedRowKey], row: item, fieldUID })"
        >
          {{ item[relatedTitleFieldUID] }}
        </span>
      </el-space>
    </template>
    <template v-else-if="subType === 'tag'">
      <div class="tag-container">
        <el-tag v-for="tag in arrayValue" effect="dark" :color="extra[tag] ?? '#ccc'" :title="tag">{{ tag }}</el-tag>
      </div>
    </template>
    <template v-else-if="subType === 'html'">
      <div class="html-container">
        <div v-if="!extra?.isLinkForm" :title="htmlPlainTextValue">{{ htmlPlainTextValue }}</div>
        <div v-else class="link-form" :title="htmlPlainTextValue" @click="handleLinkForm">{{ htmlPlainTextValue }}</div>
      </div>
    </template>
    <template v-else-if="subType === 'image'">
      <cell-image category="image" :imageList="arrayValue" :listType="extra.listType" :rowHeightLevel="rowHeightLevel" :showArrowButton="!isTableCellEditable"></cell-image>
    </template>
    <template v-else-if="subType === 'signature'">
      <cell-image
        category="image"
        :imageList="signatureImageList"
        listType="picture"
        :rowHeightLevel="rowHeightLevel"
        :showArrowButton="!isTableCellEditable"
      ></cell-image>
    </template>
    <template v-else-if="subType === 'file'">
      <cell-file :fileList="arrayValue" :rowHeightLevel="rowHeightLevel" :showArrowButton="!isTableCellEditable"></cell-file>
    </template>
    <!-- 格式化开启加密时的单行文本单元格内容 -->
    <template v-else-if="subType === 'text'">
      <div v-if="!extra?.isLinkForm" :title="encryptedText">
        {{ encryptedText }}
      </div>
      <div v-else class="link-form" @click="handleLinkForm" :title="encryptedText">
        {{ encryptedText }}
      </div>
    </template>
    <template v-else-if="subType === 'number'">
      <div v-if="numberValue" class="cell-number">
        <span :class="['number-content', { 'link-form': extra?.isLinkForm }]" :title="numberTitle" @click="handleLinkForm">
          <span v-if="numberPrefix" class="unit-prefix">{{ numberPrefix }}</span>
          {{ numberValue }}
          <span v-if="isPercent" class="percent">%</span>
          <span v-if="numberSuffix" class="unit-suffix">{{ numberSuffix }}</span>
        </span> 
      </div>
    </template>
    <template v-else-if="subType === 'amount'">
      <span class="amount">{{ amountValue }}</span>
    </template>
    <template v-else-if="subType === 'date' || subType === 'daterange'">
      <span class="date">{{ date }}</span>
    </template>
    <!-- 处理超链接单元格内容 -->
    <template v-else-if="subType === 'hyperlink'">
      <el-link :href="linkAddress" v-if="extra.openFormType !== 'dialog'" target="_blank" type="primary" :underline="false" :title="linkText" @click.stop>{{ linkText }}</el-link>
      <span @click.stop="handleHyperLinkClick" :class="getRowClassName" class="link-form" :title="linkText" v-else>{{ linkText }}</span>
    </template>
    <template v-else-if="subType === 'process-status'">
      <el-tag effect="dark" :color="processStatus.color" :title="processStatus.text">{{ processStatus.text }}</el-tag>
    </template>
    <template v-else-if="subType === 'process-node'">
      <el-space wrap spacer="," :size="2">
        <span v-for="item in arrayValue" :class="getRowClassName" :title="widget.getFlowLabel(item, row)">{{ widget.getFlowLabel(item, row) }}</span>
      </el-space>
    </template>
    <template v-else-if="subType === 'relatedSubForm'">
      <el-space class="link" wrap spacer="," :size="2">
        <span
          v-for="value, key in widget.relatedSubForm"
          :key="key"
          :title="value.name"
          @click.stop="emit('show-related-sub-form', row, { uid: key, name: value.name, fields: value.fields})"
        >
          {{ value.name }}
        </span>
      </el-space>
    </template>
    <template v-else-if="subType === 'autoCompute'">
      <div v-if="hasAutoComputeValue" class="cell-number">
        <div v-if="extra?.isNumber" class="number">
          <span v-if="numberPrefix" class="unit-prefix">{{ numberPrefix }}</span>
          <span class="number-content">{{ autoComputeValue }}</span>
          <span v-if="isPercent" class="percent">%</span>
          <span v-if="numberSuffix" class="unit-suffix">{{ numberSuffix }}</span>
        </div>
        <div v-else class="text">
          {{ autoComputeValue }}
        </div>
      </div>
    </template>
    <template v-else>
      <el-space wrap spacer="," :size="2">
        <span v-for="item in arrayValue" :class="getRowClassName" v-if="!extra?.isLinkForm" :title="item">{{ item }}</span>
        <span @click="handleLinkForm" v-for="item in arrayValue" :class="getRowClassName" class="link-form" :title="item" v-else>{{ item }}</span>
      </el-space>
    </template>
    <el-icon
      v-if="isEditAble && !isPreparingEdit && !isMobile()"
      class="edit-button"
      :style="editButtonStyle"
      size="16"
      @click.stop="handleEditClick"
    >
      <i-ven-cell-edit/>
    </el-icon>
    <div v-if="isPreparingEdit" class="cell-edit-loading">
      <el-icon class="cell-edit-loading__spinner is-loading" size="16">
        <i-ep-loading />
      </el-icon>
    </div>
    <hyperlink-dialog
      v-if="textLinkDialogVisible"
      v-model="textLinkDialogVisible"
      :url="linkAddress"
      :title="linkText"
    />
  </div>
</template>

<script lang='ts' setup>
import { computed, ref, Ref, watch, nextTick, onMounted, onBeforeUnmount, inject, ComputedRef } from "vue";
import CellImage from './CellImage.vue';
import CellFile from './CellFile.vue';
import { Account, Department, NocodeUser } from "@common/types/account";
import { Field, FieldUID, ProcessFlow, ProcessNodeStatus, Row, TableUID, FieldExtra, OptionTableUID } from "@common/types/project";
import { Table } from "../../table";
import { FormTableRowHeight, FormWidgetType } from "@common/types/nocode";
import dayjs from "dayjs";
import { getUUIDSystemField, replaceByParams, SystemField } from "@common/utils";
import { getNocodeDataSourceByUID, getNocodeDataSourceTableByOptionTableUID } from "@common/utils/connection";
import { getDisplayAmount } from "@common/utils/amount";
import { formatNumberFieldDisplayValue } from "@common/utils/fieldValue";
import { useTable } from "../../hooks";
import { isEmpty } from "@common/utils/object";
import { ORGANIZE_UTIL, PUBLIC_QUERY_DISPLAY_MAP } from '@renderer/types';
import type { PublicQueryDisplayMap } from '@renderer/types';
import { displayUserInfoByUser, displayUserInfoByUserFlat, getUserBaseName, getUserDisplayName } from '@renderer/utils/other';
import { ElMessage } from "element-plus";
import i18next from "i18next";
import { isMobile, calculateAggregation } from '@renderer/utils';
import type { VirtualTableVerticalAlign } from "@renderer/components/virtual-table";
import "dayjs/locale/zh-cn";
import "dayjs/locale/en";
import { executeFormulaCalculation } from "../../utils";
import { resolveFormulaDisplayValue } from "../../formulaValue";
import { findWidgetSoulByUID } from '@common/utils/element';
import type { WidgetSoul } from '@common/types/project';
import { getI18nLabelColon } from '@common/utils/i18n';
import { richTextToPlainText } from "@common/utils/other";

const props = defineProps<{
  value: any,
  params: any,
  widget: Table,
  row: Row,
  rowHeightLevel?: FormTableRowHeight,
  cellVerticalAlign?: VirtualTableVerticalAlign,
  isMergedAnchorCell?: boolean,
  isEditAble?: boolean,
  isPreparingEdit?: boolean,
  isTableCellEditable?: boolean,
}>();

const widget = useTable()
const organizeUtil = inject(ORGANIZE_UTIL);
const publicQueryDisplayMap = inject<ComputedRef<PublicQueryDisplayMap> | null>(PUBLIC_QUERY_DISPLAY_MAP, null);

const getRowClassName = computed(() => {
  return [
    `table-row-height-${props.rowHeightLevel}`,
    props.isMergedAnchorCell ? "is-merged-anchor-cell" : "",
  ].filter(Boolean);
});

const editButtonStyle = computed(() => {
  if (props.cellVerticalAlign === "bottom") {
    return {
      top: "auto",
      bottom: "4px",
      transform: "none",
    };
  }

  if (props.cellVerticalAlign === "middle") {
    return {
      top: "50%",
      bottom: "auto",
      transform: "translateY(-50%)",
    };
  }

  return {
    top: "4px",
    bottom: "auto",
    transform: "none",
  };
});

const emit = defineEmits<{
  (event: "show-related-form", payload: { relatedTableUID: OptionTableUID, uuid: string, row?: Row, fieldUID?: FieldUID }): void,
  (event: "show-related-sub-form", row: Row, value: { uid: TableUID, name: string, fields: Field[] }): void,
  (event: 'show-link-form', tableId: string, filterPath: string, nocodeId?: string): void,
  (event: 'edit-click'): void,
}>();

const subType = computed(() => props.params.subType);
const extra = computed<FieldExtra>(() => props.params.extra);
const textLinkDialogVisible = ref(false);
const fieldUID = computed(() => props.params.uid);
const isPercent = computed(() => extra.value?.isPercent);
const htmlPlainTextValue = computed(() => {
  return String(richTextToPlainText(props.value) ?? "").replace(/\s+/g, " ").trim();
});

const switchDisplayValue = computed(() => {
  if (subType.value !== "switch") {
    return props.value;
  }
  const format = extra.value?.format;
  if (!Array.isArray(format) || format.length < 2) {
    return props.value;
  }
  if (format.includes(props.value)) {
    return props.value;
  }
  if ([true, "true"].includes(props.value)) {
    return format[0];
  }
  if ([false, "false"].includes(props.value)) {
    return format[1];
  }
  return props.value;
});

const resolveAccountTitleValue = (userId: string) => {
  if (publicQueryDisplayMap?.value) {
    const publicAccount = publicQueryDisplayMap.value.accounts?.[userId];
    return publicAccount?.realname || publicAccount?.id || i18next.t('other.unknowMember');
  }
  const account = accountValue.value.find(item => item?.id === userId);
  if (account) {
    return account.realname || account.id || "";
  }
  const organizeAccount = organizeUtil?.users?.find(item => item?.id === userId);
  if (organizeAccount) {
    return organizeAccount.realname || organizeAccount.id || "";
  }
  return "";
};

const titleDisplayValue = computed(() => {
  if (props.params?.name !== SystemField.DATA_TITLE) {
    return props.value;
  }
  const currentTable = widget.getTable(props.params.tableUID || widget.formTableUID);
  const titleTemplate = currentTable?.meta?.extra?.dataTitle?.value || currentTable?.extra?.dataTitle?.value || "";
  if (!titleTemplate) {
    const currentFields = currentTable?.fields?.filter(field => !field.meta?.isSystem) || [];
    const firstField = currentFields.find((field) => {
      return [
        FormWidgetType.TEXT_INPUT,
        FormWidgetType.RADIO_GROUP,
        FormWidgetType.TREE_SELECT,
        FormWidgetType.SERIAL_NUMBER,
      ].includes(field.meta?.extra?.widgetType as FormWidgetType);
    }) || currentFields[0];
    if (!firstField) {
      return props.value;
    }
    const rawValue = props.row?.[firstField.uid];
    return rawValue === undefined || rawValue === null ? props.value : rawValue;
  }
  const currentFields = currentTable?.fields?.filter(field => !field.meta?.isSystem) || [];
  if (!currentFields.length) {
    return props.value;
  }
  return replaceByParams(titleTemplate, (uid) => {
    const field = currentFields.find(item => {
      if (uid.startsWith("f_")) {
        return item.uid === uid;
      }
      return item?.meta?.uid === uid;
    });
    if (!field) {
      return "";
    }
    const rawValue = props.row?.[field.uid];
    if (field.meta?.subType === "account") {
      const ids = Array.isArray(rawValue) ? rawValue : (rawValue ? [rawValue] : []);
      return ids
        .map((id) => resolveAccountTitleValue(String(id)))
        .filter(Boolean)
        .join(",");
    }
    return rawValue === undefined || rawValue === null ? "" : String(rawValue);
  });
});

const displayValue = computed(() => {
  if (subType.value === "switch") {
    return switchDisplayValue.value;
  }
  if (props.params?.name === SystemField.DATA_TITLE) {
    return titleDisplayValue.value;
  }
  return props.value;
});

const arrayValue = computed(()=>{
  if (Array.isArray(displayValue.value)) {
    return displayValue.value.map(item => {
      if(typeof item === 'string'){
        return item.trim();
      }
      return item;
    });
  } else if (displayValue.value === undefined || displayValue.value === null || displayValue.value === "") {
    return [];
  } else {
    return [typeof displayValue.value === 'string' ? displayValue.value.trim() : displayValue.value];
  }
});
const haveValue = computed(() => {
  const map = {
    account: () => {
      if (accountValue.value && accountValue.value.length > 0) return true
      return false
    },
    department: () => {
      if (departmentValue.value && departmentValue.value.length > 0) return true
      return false
    },
    related: () => {
      if (relatedValue.value && relatedValue.value.length > 0) return true
      return false
    },
    tag: () => {
      if (arrayValue.value && arrayValue.value.length > 0) return true
      return false
    },
    html: () => {
      if (props.value) return true
      return false
    },
    image: () => {
      if (arrayValue.value && arrayValue.value.length > 0) return true
      return false
    },
    signature: () => {
      if (signatureImageList.value && signatureImageList.value.length > 0) return true
      return false
    },
    file: () => {
      if (arrayValue.value && arrayValue.value.length > 0) return true
      return false
    },
    number: () => {
      if (numberValue.value) return true
      return false
    },
    amount: () => {
      if (amountValue.value !== "" && amountValue.value !== null && amountValue.value !== undefined) return true
      return false
    },
    date: () => {
      if (date.value) return true
      return false
    },
    daterange: () => {
      if (date.value) return true
      return false
    },
    relatedSubForm: () => true,
    autoCompute: () => true,
  }
  const func = map[subType.value]
  if (!func) {
    if(arrayValue.value && arrayValue.value.length > 0){
      return true
    }
    return false
  }
  return func()
})

const signatureImageList = computed(() => {
  return arrayValue.value
    .filter((item) => !!item)
    .map((item, index) => {
      if (typeof item === "object" && item?.url) {
        return {
          uid: item.uid || `signature-${index}`,
          name: item.name || getSignatureFileName(item.url, index),
          status: item.status || "success",
          size: Number(item.size || 0),
          url: item.url
        };
      }

      return {
        uid: `signature-${index}`,
        name: getSignatureFileName(String(item), index),
        status: "success",
        size: 0,
        url: String(item)
      };
    });
});

function getSignatureFileName(url: string, index: number) {
  const fileName = url.split("?")[0]?.split("/").pop();
  if (!fileName) {
    return `${index + 1}.png`;
  }

  try {
    return decodeURIComponent(fileName);
  } catch (_error) {
    return fileName;
  }
}

const numberValue = computed(()=>{
  return formatNumberFieldDisplayValue(props.value, extra.value);
});
const numberPrefix = computed(()=>{
  if (isEmpty(extra.value)) return '';
  if (!extra.value['isPercent'] && extra.value['unitPosition'] === 'prefix') {
    return extra.value['unit'];
  }
  return '';
});
const numberSuffix = computed(()=>{
  if (isEmpty(extra.value)) return '';
  if (!extra.value['isPercent'] && extra.value['unitPosition'] === 'suffix') {
    return extra.value['unit'];
  }
  return '';
});
const numberTitle = computed(()=> {
  if(numberValue.value && isPercent.value){
    return `${numberValue.value}%`
  }
  return `${ numberPrefix.value || '' }${ numberValue.value }${ numberSuffix.value || '' }`;
})

const relatedLowerAmount = computed(() => {
  if (subType.value !== 'amount') return null;
  const getRaw = () => {
    if (extra.value?.amount?.relatedLowerAmount) return extra.value?.amount?.relatedLowerAmount as string;
    let widget = null;
    const root = props.widget.formData?.formOptions?.[props.widget.formTableUID]?.widget;
    const widgetUid = props.params?.elementId || props.params?.paths?.at?.(-1);
    if (root && widgetUid) {
      widget = findWidgetSoulByUID([root as WidgetSoul], widgetUid);
    }
    return widget?.options?.['related-lower-amount'];
  }

  const raw = getRaw();
  if (!raw) return null;

  const [connectionUID, tableUID, fieldUID] = String(raw).split('.');
  if (!connectionUID || !tableUID || !fieldUID) return null;
  if (fieldUID.startsWith("f_")) {
    return { connectionUID, tableUID, fieldUID };
  }
  const column = props.widget.allColumns.find((item) => item.elementId === fieldUID);
  if (!column) return null;
  return { connectionUID, tableUID, fieldUID: column?.uid };
});

const relatedLowerAmountValue = computed(() => {
  if (subType.value !== 'amount') return null;
  const relation = relatedLowerAmount.value;
  if (!relation) return undefined;

  // 当前表行、子表展开行都会把字段值平铺在 props.row[fieldUID]
  return props.row?.[relation.fieldUID];
});

const amountValue = computed(() => {
  if (subType.value !== 'amount') return null;
  if (extra.value?.isAggregateMetric) {
    const formattedValue = formatNumberFieldDisplayValue(props.value, extra.value);
    return formattedValue && extra.value?.isPercent ? `${formattedValue}%` : formattedValue;
  }
  const amount = extra.value?.amount;

  const relatedValue = relatedLowerAmountValue.value;
  let val = relatedValue !== undefined && relatedValue !== null
    ? relatedValue
    : props.value;

  if (val === null || val === undefined) {
    return "";
  }
  if (!amount) return val;
  return getDisplayAmount(val, {
    isUppercase: amount?.isUppercase,
    currencyType: amount?.currencyType,
    uppercaseLanguage: amount?.uppercaseLanguage,
    uppercaseShowFormat: amount?.uppercaseShowFormat,
    decimalPlaces: extra.value?.decimalPlaces ?? amount?.decimal,
    decimalPadding: amount?.decimalPadding ?? amount?.completeZero ?? extra.value?.completeZero,
    thousandSeparator: amount?.thousandSeparator,
    decimalSeparator: amount?.decimalSeparator,
    prefix: amount?.prefix,
    suffix: amount?.suffix
  });
});

const autoComputeValue = ref<number | string>("");
let autoComputeRequestVersion = 0;
const hasAutoComputeValue = computed(() => {
  return autoComputeValue.value !== "" && autoComputeValue.value !== null && autoComputeValue.value !== undefined;
});
if (subType.value === 'autoCompute') {
  watch([() => props.row, () => props.widget.subTableData], async (_value, _oldValue, onCleanup) => {
    const requestVersion = ++autoComputeRequestVersion;
    let cancelled = false;
    onCleanup(() => { cancelled = true; });
    if (subType.value !== 'autoCompute') return;
    const { isNumber, decimalPlaces, aggregateType, otherTableFieldUID, dataFilter, computeType, formula } = extra.value;
    const currentRow = props.params.tableUID === props.widget.formTableUID && props.row?.[props.widget.rowKey]
      ? props.widget.getRow(props.row[props.widget.rowKey])
      : props.row;
    const currentTableFields = props.widget.getTable(props.params.tableUID)?.fields || [];
    if (computeType === 'formula') {
      // 公式计算
      const result = await executeFormulaCalculation(
        formula,
        props.widget,
        currentRow,
        props.params.tableUID
      );
      if (cancelled || requestVersion !== autoComputeRequestVersion) return;
      const displayResult = resolveFormulaDisplayValue(result, props.value);
      if (isNumber) {
        autoComputeValue.value = formatNumberFieldDisplayValue(displayResult, extra.value);
      } else {
        autoComputeValue.value = displayResult ?? "";
      }
    } else {
      // 快速计算
      if (!otherTableFieldUID?.length) {
        autoComputeValue.value = "";
        return;
      }
      const computedValue = await calculateAggregation({
        otherTableFieldUID,
        dataFilter,
        nocodeId: widget.nocodeId,
        aggregateType,
        decimal: decimalPlaces,
        row: currentRow,
        fields: currentTableFields,
      });
      if (cancelled || requestVersion !== autoComputeRequestVersion) return;
      if (isNumber) {
        autoComputeValue.value = formatNumberFieldDisplayValue(computedValue, extra.value);
      } else {
        autoComputeValue.value = computedValue ?? "";
      }
    }
  }, { deep: true, immediate: true });
}

const displayUserValue = (userId): string => {
  const account = accountValue.value.find(item => item?.id === userId);
  const organizeUser = organizeUtil?.users?.find(item => item?.id === userId);
  const showInfo = extra.value?.showInfo || [];
  const isFillMemberInfoMode = extra.value?.autoFill === 'fill' && extra.value?.fillField;
  if (account || organizeUser) {
    const user = account || organizeUser;
    if (isFillMemberInfoMode) {
      return displayUserInfoByUserFlat(user, organizeUtil, showInfo);
    }
    return displayUserInfoByUser(user, organizeUtil, showInfo);
  }
  return i18next.t('other.unknowMember');
}

type _Account = Account & {
  department: Department,
};
const accountValue: Ref<Array<_Account | undefined>> = ref([]);
const departmentValue: Ref<_Department[]> = ref([]);
let organizationRequestVersion = 0;

const buildPublicQueryAccount = (id: string, displayMap: PublicQueryDisplayMap): _Account | undefined => {
  const account = displayMap.accounts?.[id];
  if (!account) {
    return undefined;
  }
  return {
    id,
    realname: account.realname || account.user || i18next.t('other.unknowMember'),
    user: account.user || '',
    phone: account.phone || '',
    roles: [],
    departments: [],
    department: {
      name: account.departmentName || '',
    } as Department,
  } as _Account;
};

const buildPublicQueryDepartment = (id: string, displayMap: PublicQueryDisplayMap): _Department => {
  const department = displayMap.departments?.[id];
  if (!department) {
    return {
      id,
      name: i18next.t('FilterValueFormat.unknownDep'),
      parents: [{
        name: i18next.t('FilterValueFormat.unknownDep'),
      } as Department],
    } as _Department;
  }
  return {
    id,
    name: department.name || i18next.t('FilterValueFormat.unknownDep'),
    parents: (department.parentNames || [department.name || i18next.t('FilterValueFormat.unknownDep')]).map(name => ({
      name,
    } as Department)),
  } as _Department;
};

watch(() => arrayValue.value, async (value, _oldValue, onCleanup)=>{
  const requestVersion = ++organizationRequestVersion;
  let cancelled = false;
  onCleanup(() => { cancelled = true; });
  if (subType.value === 'account') {
    if (publicQueryDisplayMap?.value) {
      accountValue.value = value.map((id) => buildPublicQueryAccount(String(id), publicQueryDisplayMap.value));
      return;
    }
    const accounts = (
      await Promise.all(
        value.map(async (id) => {
          const account = await props.widget.getOrganizationAccount(id, { status: 'all' }) as _Account;
          if (account && account.departments?.length) {
            account.department = await props.widget.getOrganizationDepartment(account.departments[0]);
          }
          return account;
        }) 
      )
    );
    if (cancelled || requestVersion !== organizationRequestVersion) return;
    accountValue.value = accounts;
  } else if (subType.value === 'department') {
    if (publicQueryDisplayMap?.value) {
      departmentValue.value = value
        .map((id) => buildPublicQueryDepartment(String(id), publicQueryDisplayMap.value));
      return;
    }
    const departments = await Promise.all(arrayValue.value.map(async (id)=>{
      const department = await props.widget.getOrganizationDepartment(id) as _Department;
      if (department) {
        const parents: Department[] = [department];
        let parent = department.parent;
        while (parent) {
          const parentDepartment = await props.widget.getOrganizationDepartment(parent);
          if (parents.includes(parentDepartment)) {//防止有环造成无限循环
            break;
          }
          parents.unshift(parentDepartment);
          parent = parentDepartment.parent;
        }
        department.parents = parents;
      }
      return department;
    })).then(data => {
      return data.filter(Boolean);
    });
    if (cancelled || requestVersion !== organizationRequestVersion) return;
    departmentValue.value = departments;
  }

}, { immediate: true });

onBeforeUnmount(() => {
  autoComputeRequestVersion += 1;
  organizationRequestVersion += 1;
  accountValue.value = [];
  departmentValue.value = [];
  autoComputeValue.value = "";
});

type _Department = Department & {
  parents: Department[],
};

const relatedValue = computed(()=>{
  const uuids = arrayValue.value;
  return props.widget.getRelatedRows(fieldUID.value, uuids);
});
const relatedRowKey = computed(()=>{
  return props.widget.getRelatedRowKey(fieldUID.value);
});
const relatedTitleFieldUID = computed(()=>{
  return props.widget.getRelatedTitleFieldUID(fieldUID.value);
});
const relatedTableUID = computed(()=>{
  return props.widget.getRelatedTableUID(fieldUID.value);
});

const date = computed(()=>{
  const getDay = (d) => {
    if (extra.value.dateLocale === 'en') {
      return d.locale('en').format(extra.value.format);
    } else {
      return d.locale('zh-cn').format(extra.value.format);
    }
  }
  if (subType.value === 'date') {
    if (!props.value) return "";
    const day = dayjs(props.value, extra.value.format)
    if (day.isValid()) {
      return getDay(day);
    } else {
      const day = dayjs(props.value);
      if (day.isValid()) {
        return getDay(day);
      }
    }
    return props.value || ''; // 解析失败返回原值
  } else if (subType.value === 'daterange') {
    if (!props.value) return "";
    if (props.value?.length === 2) {
      if (!props.value[0] || !props.value[1]) return "";
      const days = [dayjs(props.value[0], extra.value.format), dayjs(props.value[1], extra.value.format)];
      if (days.every(day => day.isValid())) return `${getDay(days[0])} - ${getDay(days[1])}`
      else {
        const days = [dayjs(props.value[0]), dayjs(props.value[1])];
        if (days.every(day => day.isValid())) {
          return `${getDay(days[0])} - ${getDay(days[1])}`;
        }
      }
      return props.value.join(' - ');
    }
    return String(props.value || '');
  }
});

const tableFilter = computed(()=>{
  const currentTableUID = props.params.tableUID || widget.formTableUID;
  const uuidField = getUUIDSystemField(widget.tables?.find(item => item.uid == widget.formTableUID)?.fields);
  const subUUIDField = getUUIDSystemField(widget.tables?.find(item => item.uid == currentTableUID)?.fields);
  const _f = {
    sourceNocodeId: widget.nocodeId,
    tableUID: currentTableUID,
    fieldUID: fieldUID.value,
    rowUUID: props.row?.[uuidField?.uid],
    subRowUUID: props.row?.[subUUIDField?.uid],
    mainTableUID: widget.formTableUID
  }
  const base64 = window.btoa(JSON.stringify(_f))
  return base64
})

const handleLinkForm = (ev: MouseEvent) => {
  if (!extra.value?.isLinkForm) return;
  ev.stopPropagation();
  if(!extra.value?.selectLinkForm) {
    return ElMessage.error(i18next.t('TableCellFormat.configLinkForm'))
  }

  const meta = getLinkFormMeta(extra.value.selectLinkForm);
  if (!meta?.tableUID || !meta.table) {
    return ElMessage.error(i18next.t('TableCellFormat.linkFormDeleted'))
  }
  if(extra.value?.openFormType === 'dialog') {
    emit('show-link-form', meta.tableUID, tableFilter.value, meta.nocodeId)
  } else {
    const url = `/#/app/${meta.nocodeId || widget.nocodeId}/${meta.tableUID}?filter=${tableFilter.value}`
    window.open(url, '_blank');
  }
}

const getCrossAppStoredNocodeId = (tableUID?: string) => {
  if (!tableUID) return undefined;
  const forms = widget.nocodeBody?.settings?.crossApp?.forms || [];
  return forms.find((item: any) => item?.tableUID === tableUID)?.nocodeId;
}

const getLinkFormMeta = (value?: string) => {
  if (!value) return null;
  const [connectionUID, tableUID] = String(value).split(",");
  if (!connectionUID || !tableUID) return null;

  const optionTableUID = [connectionUID, tableUID] as OptionTableUID;
  const targetContext = getNocodeDataSourceTableByOptionTableUID(widget.nocodeBody, optionTableUID, {
    nocodeId: widget.nocodeId,
  }, true);
  const schemaConnection = targetContext?.connection
    ? undefined
    : widget.nocodeBody?.otherDataSourceSchemas?.find(item => item?.uid === connectionUID);
  const connection = targetContext?.connection || schemaConnection;
  const table = targetContext?.table || schemaConnection?.tables?.find(item => item?.uid === tableUID);
  const nocodeId = connection?.nocodeId || getCrossAppStoredNocodeId(tableUID);

  return { tableUID, table, nocodeId };
}

const getHyperlinkFormMeta = (value?: string) => {
  if (!value || extra.value?.linkType !== 'form') return null;
  const [connectionUID, tableUID] = String(value).split(",");
  if (!connectionUID || !tableUID) return null;

  const currentTable = widget.getTable(tableUID);
  if (currentTable) {
    return {
      tableUID,
      table: currentTable,
      nocodeId: widget.nocodeId,
    };
  }

  const connection = getNocodeDataSourceByUID(widget.nocodeBody, connectionUID, {
    nocodeId: widget.nocodeId,
  }) || widget.nocodeBody?.otherDataSourceSchemas?.find((item: any) => item?.uid === connectionUID);
  const table = connection?.tables?.find((item: any) => item?.uid === tableUID);
  const currentConnectionUID = widget.formTableUID;
  const isCurrentConnection = !!connectionUID && connectionUID === currentConnectionUID;
  const nocodeId = connection?.nocodeId || (isCurrentConnection ? widget.nocodeId : getCrossAppStoredNocodeId(tableUID));

  return {
    tableUID,
    table,
    nocodeId,
  };
}

const handleHyperLinkClick = () => {
  if(!props.value) {
    return
  }
  if (extra.value?.linkType !== 'form') {
    textLinkDialogVisible.value = true;
    return;
  }
  const meta = getHyperlinkFormMeta(props.value);
  if (!meta?.tableUID) return;
  emit('show-link-form', meta.tableUID, null, meta.nocodeId)
}

const linkAddress = computed(()=>{ 
  const { defaultLinkAddress } = extra.value.hyperlink;
  if (props.value) {
    if(extra.value?.linkType != 'form') {
      return props.value;
    }
    const meta = getHyperlinkFormMeta(props.value);
    const nocodeId = meta?.nocodeId || widget.nocodeId;
    const tableUID = meta?.tableUID || "";
    const url = `/#/app/${nocodeId}/${tableUID}`
    return url;
  }
  return defaultLinkAddress;
});

const linkText = computed(()=>{
  if(!props.value) {
    return ""
  }
  const { linkText } = extra.value.hyperlink;
  if(extra.value.linkType === "form") {
    const meta = getHyperlinkFormMeta(props.value);
    if(meta?.table) {
      return meta.table.alias || i18next.t('TableCellFormat.unknowForm')
    }
  }
  return linkText;
})
// 单行文本加密
const encryptedText = computed(() => {
  if (subType.value === 'text' && extra.value?.encryption?.enable) {
    const { frontLength, backLength, encryptChar } = extra.value.encryption;
    const text = String(props.value || '');
    if ((frontLength + backLength) >= text.length) {
      // 如果前后显示字符数之和大于等于文本长度，则全部显示
      return props.value;
    }
    // 截取前面和后面的字符，中间用加密字符替代
    const frontText = text.substring(0, frontLength);
    const backText = text.substring(text.length - backLength);
    const middleText = encryptChar.repeat(text.length - frontLength - backLength);
    return frontText + middleText + backText;
  }
  // 如果未开启加密，则直接显示原文本
  return props.value;
});

const handleEditClick = () => {
  emit('edit-click')
}

const processStatus = computed(()=>{
  switch (props.value) {
    case ProcessNodeStatus.QUEUED:
      return {
        text: i18next.t('commonNocode.queued'),
        color: '#409eff',
      };
    case ProcessNodeStatus.IN_PROGRESS:
      return {
        text: i18next.t('TableCellFormat.processing'),
        color: 'orange',
      };
    case ProcessNodeStatus.FINISHED:
      return {
        text: i18next.t('TableCellFormat.done'),
        color: '#5ec431',
      };
    case ProcessNodeStatus.REJECTED:
      return {
        text: i18next.t('TableCellFormat.refused'),
        color: '#f9484e',
      };
    case ProcessNodeStatus.CANCELED:
      return {
        text: i18next.t('TableCellFormat.revoked'),
        color: '#a1a1a1',
      };
    default:
      return {
        text: props.value,
        color: 'orange',
      };
  }
});
</script>

<style lang='scss' scoped>
.cell-content-value {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  box-sizing: border-box;
  padding-right: 0;
  align-items: var(--virtual-table-cell-align-items, center);
  justify-content: var(--virtual-table-cell-content-justify, flex-start);
  text-align: var(--virtual-table-cell-text-align, left);
  font-size: var(--nocode-table-cell-font-size, 12px);
  line-height: 32px;

  > div {
    flex: 1;
    min-width: 0;
    text-align: inherit;
  }

  > :not(.edit-button) {
    min-width: 0;
  }

  > span {
    text-align: inherit;
  }

  .tag-container {
    line-height: 32px;
    >.el-tag {
      height: 24px;
    }
  }

  .edit-button {
    width: 24px;
    height: 24px;
    position: absolute;
    right: 0;
    border-radius: 4px;
    background: #e5e6eb;
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    &:hover {
      background: #c9cdd4;  
    }
  }

  .cell-edit-loading {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.72);
  }

  .cell-edit-loading__spinner {
    color: var(--el-color-primary);
  }

  &.table-row-height-small {
    height: 32px;
    line-height: 32px;
    
    .html-container {
      padding: 5px 0;
    }
    > :deep(.el-space) {
      line-height: 32px;
    }
  }
  &.table-row-height-medium {
    height: 66px;
    line-height: 22px;
  }
  &.table-row-height-large {
    height: 110px;
    line-height: 22px;
  }
  &.is-merged-anchor-cell {
    align-self: stretch;

    &.table-row-height-small,
    &.table-row-height-medium,
    &.table-row-height-large {
      height: 100%;
      min-height: 100%;
    }
  }


  .el-tag {
    border: none;
  }
  .el-tag:not(:last-child) {
    margin-right: 2px;
  }
  
  > :deep(.el-space) {
    display: block;
    max-width: 100%;
    height: 100%;

    > * {
      display: inline-block;
      vertical-align: top;
    }

    > span {
      padding-right: 2px;
    }

    // 单个成员标签内显示省略号
    .el-space__item:has(.row-height-small) {
      max-width: 100%;
      overflow: hidden;
      // text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row-height-small {
      white-space: nowrap;
    }
  }

  .cell-number {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: var(--virtual-table-cell-number-justify, space-between);
    overflow: hidden;
    text-align: inherit;

    .unit-prefix {
      flex: 0 0 auto;
    }

    .number-content {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: inherit;
    }

    .unit-suffix {
      flex: 0 0 auto;
      white-space: nowrap;
    }
  }

  .number,
  .amount {
    text-align: inherit;
  }

  .link span {
    color: var(--el-color-primary);
    cursor: var(--cursor-pointer);
  }

  :deep(.html-container) {
    line-height: 1.5;
    overflow: hidden;
    p {
      line-height: 22px;
    }
  }

  .image-box {
      position: absolute;
      top: 0px;
      bottom: 0px;
      right: 0px;
      left: 0px;
      display: flex;
      overflow: hidden;
      align-items: center;
  }
  
  .dialog-link {
    color: var(--color-primary);
    cursor: pointer;

    &:hover {
      color: var(--color-primary-light-3);
    }
  }
}

:deep(.user-popover) {
  background-color: #fff;
}

.user-card {
  display: flex;
  flex-direction: column;

  .card-top {
    display: flex;
    height: 48px;
    border-bottom: 1px solid var(--border-color);
    padding: 8px 10px;
    align-items: center;

    .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 20px;
    flex-shrink: 0;
    margin-right: 10px;
  }

  .top-row {
      display: flex;
      flex-direction: column;
      align-items: start;

      .name {
        font-size: 14px;
      }

      .status {
        margin-top: 4px;
        padding: 0 4px;
        border-radius: 2px;
        font-size: 12px;
        line-height: 18px;
        color: #f56c6c;
        background-color: #fef0f0;
      }
    }
  }

  .user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: 13px;

    .info-row {
      display: flex;
      color: var(--text-color-regular);
      height: 36px;
      padding: 8px 12px;
      line-height: 20px;
      gap: 8px;

      span {
        color: #666;
      }

      .depts {
        flex: 1;
        display: flex;
        flex-direction: column;

        span {
          margin-bottom: 2px;
        }
      }
    }
  }
}

.table-row-height-small:not(.is-merged-anchor-cell),
.table-row-height-small:not(.is-merged-anchor-cell) :deep(.html-container > div) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  overflow: hidden;
  word-break: break-word;
}
.table-row-height-medium:not(.is-merged-anchor-cell),
.table-row-height-medium:not(.is-merged-anchor-cell) :deep(.html-container > div) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  word-break: break-word;
}
.table-row-height-large:not(.is-merged-anchor-cell),
.table-row-height-large:not(.is-merged-anchor-cell) :deep(.html-container > div) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  line-clamp: 5;
  overflow: hidden;
  word-break: break-word;
}

.link-form {
  color: var(--color-primary);
  cursor: pointer;
}
</style>
