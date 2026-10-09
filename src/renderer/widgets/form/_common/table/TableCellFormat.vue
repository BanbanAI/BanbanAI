<template>
  <div
    class="cell-content-value"
    :class="{ 'multiline-text-cell': isTextCell && extra?.widgetType === 'widget.form.textarea' }"
    :subType="subType"
  >
    <template v-if="subType === 'account'">
      <el-space class="link account" wrap spacer="," :size="2">
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
              <span :title="displayUserValue(account?.id)" @click.stop>
                {{ displayUserValue(account?.id) }}
              </span>
            </template>
            <div class="user-card">
              <div class="card-top">
                <div class="avatar">
                  <span class="avatar-text">{{ account?.realname?.[0] || '?' }}</span>
                </div>
                <div class="top-row">
                  <span class="name">{{ account?.realname }}</span>
                </div>
              </div>
              <div class="user-info">
                <div class="info-row"><span>{{ i18next.t("nameLabel") }}</span>{{ account?.user }}</div>
                <div class="info-row"><span>{{ i18next.t("phoneLabel") }}</span>{{ account?.phone || i18next.t("noneValue") }}</div>
                <div class="info-row"><span v-if="account.user !== 'admin'">{{ i18next.t("departmentLabel") }}</span>{{ account?.user === 'admin' ? i18next.t("superAdmin") : `${account?.department?.name || i18next.t("noneValue")}` }}</div>
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
            <span>{{ i18next.t("departmentOwnership") }}&nbsp;{{ dept.parents.map(p=>p.name).join("/") }}</span>
          </el-popover>
        </template>
      </el-space>
    </template>
    <template v-else-if="subType === 'related'">
      <el-space class="link" wrap spacer="," :size="2">
        <span v-for="item in relatedValue" :key="item[relatedRowKey]"
          @click="handleRelatedClick(item)" :title="item[relatedTitleFieldUID]">{{ item[relatedTitleFieldUID] }}</span>
      </el-space>
    </template>
    <template v-else-if="subType === 'tag'">
      <el-tag v-for="tag in arrayValue" effect="dark" :color="extra[tag] ?? '#ccc'" :title="tag">{{ tag }}</el-tag>
    </template>
    <template v-else-if="subType === 'html'">
      <div class="html-container">
        <div v-html="value"></div>
      </div>
    </template>
    <template v-else-if="subType === 'image'">
      <cell-image category="image" :imageList="arrayValue" :listType="extra.listType"></cell-image>
    </template>
    <template v-else-if="subType === 'signature'">
      <cell-image
        category="image"
        :imageList="signatureImageList"
        listType="picture"
      ></cell-image>
    </template>
    <template v-else-if="subType === 'file'">
      <cell-file :fileList="arrayValue" :widget="curWidget"></cell-file>
    </template>
    <!-- 格式化文本单元格内容 -->
    <template v-else-if="isTextCell">
      <div class="cell-text" :title="encryptedText">
        {{ encryptedText }}
      </div>
    </template>
    <template v-else-if="subType === 'number'">
      <div v-if="numberValue" class="cell-number" :title="numberTitle">
        <span v-if="numberPrefix" class="unit-prefix">{{ numberPrefix }}</span>
        <span class="number-content">{{ numberValue }}</span>
        <span v-if="isPercent" class="percent">%</span>
        <span v-if="numberSuffix" class="unit-suffix">{{ numberSuffix }}</span>
      </div>
    </template>
    <template v-else-if="subType === 'amount'">
      <span class="amount">{{ amountValue }}</span>
    </template>
    <template v-else-if="subType === 'date' || subType === 'daterange'">
      <el-space wrap spacer="," :size="2" :title="date">
        {{ date }}
      </el-space>
    </template>
    <!-- 处理超链接单元格内容 -->
    <template v-else-if="subType === 'hyperlink'">
      <el-link v-if="!isHyperlinkUseDialog" :href="linkAddress" target="_blank" type="primary" :underline="false" :title="linkText" @click.stop>{{ linkText }}</el-link>
      <span
        v-else
        class="dialog-link"
        :title="linkText"
        @click.stop="openHyperlinkInDialog()"
      >
        {{ linkText }}
      </span>
    </template>
    <template v-else-if="subType === 'process-status'">
      <el-tag effect="dark" :color="processStatus.color" :title="processStatus.text">{{ processStatus.text }}</el-tag>
    </template>
    <template v-else-if="subType === 'process-node'">
      <el-space wrap spacer="," :size="2">
        <span v-for="item in arrayValue" :title="getFlowById(getTableFlows(), item)?.options?.name || item">{{ getFlowById(getTableFlows(), item)?.options?.name || item }}</span>
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
      <el-space class="space" wrap spacer="," :size="2">
        <span v-for="item in arrayValue" :title="item">{{ item }}</span>
      </el-space>
    </template>
    <hyperlink-dialog
      v-if="textLinkDialogVisible"
      v-model="textLinkDialogVisible"
      :url="linkAddress"
      :title="linkText"
    />
  </div>
</template>

<script lang='ts' setup>
import { OptionTableUID, ProcessNodeStatus } from "@common/types/project";
import { calculateAggregation } from "@renderer/utils/autoCompute";
import { formatNumberWithSeparator, getDisplayAmount } from "@common/utils/amount";
import { getUUIDSystemField } from "@common/utils/connection";
import { displayUserInfo } from "@renderer/utils/other";
import { FormWidgetType, ProcessNodeStatusMapping } from "@common/types/nocode";
import { getFlowById, getFlows } from "@common/utils/flow";
import { Widget } from "@renderer/b2/controllers/widget";
import { SubFormRow, FormElement } from "@renderer/b2/controllers/form";
import { formatFloat } from "@common/utils/math";
import { computed, watch, ref, Ref, onMounted } from "vue";
import CellImage from './CellImage.vue';
import CellFile from './CellFile.vue';
import { RelatedData } from "./RelatedData";
import { Department, NocodeUser } from "@common/types/account";
import dayjs from "dayjs";
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { isEmpty } from "@common/utils/object";
import widget from "@renderer/widgets/basic/audio";
import { Row } from "@common/types/project";
import { Form } from "@renderer/widgets/form/form/form";
import { Department as DepartmentWidget } from "../../departmentSelect/department";
import { Member } from "../../memberSelect/member";
import { displayFilledMemberInfoByUser } from "../../memberSelect/display-user-info";
import { AutoCompute } from "../../autoCompute/autoCompute";
import { NumberInput } from "../../number/numberInput";
import { SubForm, UUID } from "../../subForm/subForm";
import "dayjs/locale/zh-cn";
import "dayjs/locale/en";
import { SearchForm } from "../../searchForm/searchForm";
import { createWidgetI18n } from "@renderer/widgets/i18n";

dayjs.extend(customParseFormat)

const props = defineProps<{
  row?: Row,
  subRow?: Row,
  subFormRow?: SubFormRow,
  value: any,
  params: any,
  widget: FormElement ,
}>();

const emit = defineEmits<{
  (event: "show-related-form", payload: { relatedTableUID: OptionTableUID, uuid: string, row?: Row, fieldUID?: string }): void,
  (event: 'show-link-form', tableId: string): void,
}>();

const i18next = createWidgetI18n(props.widget.type);
const organize = ref({ users: [], departments: [], roles: [] });
const textLinkDialogVisible = ref(false);

const subType = computed(() => props.params.subType);
const extra = computed(() => props.params.extra);
const fieldUID = computed(() => props.params.uid);
const isPercent = computed(() => extra.value?.isPercent);
const isTextCell = computed(() => {
  return subType.value === 'text' || extra.value?.widgetType === 'widget.form.textarea';
});

const curWidget = computed(() => {
  let curWidget: any = props.widget;
  if (curWidget.type === FormWidgetType.SUBFORM) {
    if (props.subFormRow) {
      const field = props.subFormRow.children.find((w: any) => w.fieldId === fieldUID.value);
      if (field) return field;
    }
    if (props.subRow && props.subRow[UUID]) {
      const subFormRow = (props.widget as unknown as SubForm).getSubFormRow(props.subRow[UUID]);
      if (subFormRow) {
        const field = subFormRow.children.find((w: any) => w.fieldId === fieldUID.value);
        if (field) return field;
      }
    }
    curWidget = props.widget.children.find((w: any) => w.fieldId === fieldUID.value);
  }
  return curWidget;
});

const arrayValue = computed(()=>{
  if (Array.isArray(props.value)) {
    return props.value;
  } else if (props.value === undefined || props.value === null || props.value === "") {
    return [];
  } else {
    return [props.value];
  }
});

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
  let val = props.value;
  if (val === null || val === undefined) {
    return "";
  }
  if (isNaN(val)) val = 0;
  const { isPercent, decimalPlaces, completeZero } = extra.value;
  let resultText = formatFloat(val, decimalPlaces, completeZero);
  if (isPercent) {
    resultText = formatFloat(Number((val * 100).toFixed(12)), decimalPlaces, completeZero)
    // resultText += "%";
  }
  const w: NumberInput = curWidget.value;
  if (w.isThousandSeparator && !!w.getNumberWithCommas) {
    resultText = w.getNumberWithCommas(resultText);
  }
  return resultText;
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
  } else if (numberValue.value && (numberPrefix.value || numberSuffix.value)) {
    return `${numberPrefix.value || '' + numberValue.value + numberSuffix.value || ''}`
  }
  return numberValue.value || ''
})

const amountValue = computed(()=>{
  let val = props.value;
  if (val === null || val === undefined) {
    return "";
  }
  const amount = extra.value?.amount;
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
const hasAutoComputeValue = computed(() => {
  return autoComputeValue.value !== "" && autoComputeValue.value !== null && autoComputeValue.value !== undefined;
});
const getAutoCompute = async () => {
  if (subType.value !== 'autoCompute') return;
  const { isNumber, isPercent, completeZero, decimalPlaces, thousandSeparator, unitPosition, unit, aggregateType, otherTableFieldUID, dataFilter, computeType, formula } = extra.value;
  const resolvedThousandSeparator = thousandSeparator === true
    ? ","
    : (typeof thousandSeparator === 'string' ? thousandSeparator : "");
  if (computeType === 'formula') {
    // 公式计算
    if (!formula) return "";
    const w: AutoCompute = curWidget.value;
    if (w.watchDefaultFormula && typeof w.watchDefaultFormula === 'function') {
      w.watchDefaultFormula(true, (val) => {
        if (isNumber) {
          autoComputeValue.value = formatNumberWithSeparator(
            val,
            {
              decimalPlaces,
              thousandSeparator: resolvedThousandSeparator,
              decimalPadding: completeZero
            }
          );
        } else {
          autoComputeValue.value = val ?? "";
        }
      });
    }
  } else {
    // 快速计算
    if (!otherTableFieldUID?.length) {
      autoComputeValue.value = "";
      return;
    }
    const w: AutoCompute = curWidget.value;
    const computedValue = await calculateAggregation({
      otherTableFieldUID,
      dataFilter: w?.runtimeDataFilter || dataFilter,
      nocodeId: props.widget.getBoard().nocodeId,
      aggregateType,
      decimal: decimalPlaces
    });
    if (isNumber) {
      autoComputeValue.value = formatNumberWithSeparator(
        computedValue,
        {
          decimalPlaces,
          thousandSeparator: resolvedThousandSeparator,
          decimalPadding: completeZero
        }
      );
    } else {
      autoComputeValue.value = computedValue ?? "";
    }
  }
};

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

type _Account = NocodeUser & {
  department: Department,
};
const _accountValue: Ref<_Account[]> = ref();
const accountValue = computed(()=>{
  if (!_accountValue.value) {//只进来一次
    _accountValue.value = [];
    Promise.all(arrayValue.value.map(async (id)=>{
      const account: _Account = await props.widget.getBoard().getOrganizationAccount(id);
      if (account) {
        account.department = await props.widget.getBoard().getOrganizationDepartment(account.departments[0]);
      }
      return account;
    })).then((accounts: _Account[])=>{
      _accountValue.value = accounts;
    });
  }
  return _accountValue.value;
});

type _Department = Department & {
  parents: Department[],
};
const _departmentValue: Ref<_Department[]> = ref();
const departmentValue = computed(()=>{
  if (!_departmentValue.value) {//只进来一次
    _departmentValue.value = [];
    Promise.all(arrayValue.value.map(async (id)=>{
      const department: _Department = await props.widget.getBoard().getOrganizationDepartment(id);
      if (department) {
        const parents: Department[] = [department];
        let parent = department.parent;
        while (parent) {
          const parentDepartment = await props.widget.getBoard().getOrganizationDepartment(parent);
          if (parents.includes(parentDepartment)) {//防止有环造成无限循环
            break;
          }
          parents.unshift(parentDepartment);
          parent = parentDepartment.parent;
        }
        department.parents = parents;
      }
      return department;
    })).then((departments: _Department[])=>{
      _departmentValue.value = departments.filter(Boolean);
    });
  }
  return _departmentValue.value;
});

const relatedValue = computed(()=>{
  const uuids = arrayValue.value;
  return (props.widget as unknown as RelatedData).getRelatedRows(fieldUID.value, uuids);
});
const relatedRowKey = computed(()=>{
  return (props.widget as unknown as RelatedData).getRelatedRowKey(fieldUID.value);
});
const relatedTitleFieldUID = computed(()=>{
  return (props.widget as unknown as RelatedData).getRelatedTitleFieldUID(fieldUID.value);
});
const relatedTableUID = computed(()=>{
  return (props.widget as unknown as RelatedData).getRelatedTableUID(fieldUID.value);
});

const handleRelatedClick = (item) => {
  const payload = {
    relatedTableUID: relatedTableUID.value,
    uuid: item?.[relatedRowKey.value],
    row: item,
    fieldUID: fieldUID.value,
  };
  const relatedDetailHandler = (props.widget.getBoard() as any)?.projectContext?.openRelatedDetail;
  if (relatedDetailHandler) {
    relatedDetailHandler(payload);
    return;
  }
  emit("show-related-form", payload);
};

const linkAddress = computed(()=>{
  const { defaultLinkAddress } = extra.value.hyperlink;
  if (props.value) {
    if(extra.value?.linkType != 'form') {
      return props.value;
    }
    const nocodeId = props.widget.getBoard().nocodeId;;
    const [formDataUID, tableUID] = props.value.split(",")  || []
    const url = `/#/app/${nocodeId}/${tableUID}`
    return url
  }
  return defaultLinkAddress;
});
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

const displayUserValue = (userId: string): string => {
  const showInfo = (curWidget.value as Member)?.showInfo || [];
  if (extra.value?.autoFill === 'fill' && extra.value?.fillField) {
    const account = organize.value.users.find(item => item?.id === userId);
    return displayFilledMemberInfoByUser(account, organize.value, showInfo, i18next.t("unknownMember"));
  }
  return displayUserInfo(userId, organize.value, showInfo);
}

const isHyperlinkUseDialog = computed(()=>{
  return extra.value?.openFormType === 'dialog'
})

const linkText = computed(()=>{
  const { linkText } = extra.value.hyperlink;
  if(extra.value?.linkType == 'form') {
    const table = props.widget.getBoard().getTable(props.value.split(","))
    return table?.alias || i18next.t("unknownForm")
  };
  return linkText;
})

const getTableFlows = () => {
  const [connectionUID, tableUID] = (props.widget as SearchForm).selectSearchForm || props.widget.topForm.tableUID;
  const connections = props.widget.getBoard().getConnections();
  const connection = connections.find(c => c.uid === connectionUID);
  let formOption = connection.formOptions[tableUID];
  const process = formOption?.process;

  if(!process) return [];
  return getFlows(process);
}

const openHyperlinkInDialog = () => {
  if (extra.value?.linkType !== 'form') {
    textLinkDialogVisible.value = true;
    return;
  }
  const [formDataUID, tableUID] = props.value.split(",")
  emit('show-link-form', tableUID)
}

onMounted(async () => {
  if ([FormWidgetType.MEMBER_SELECT, FormWidgetType.SUBFORM, FormWidgetType.SEARCH_FORM].includes(props.widget.type)) {
    if ([FormWidgetType.MEMBER_SELECT, FormWidgetType.SEARCH_FORM].includes(curWidget.value.type)) {
      organize.value.departments = await curWidget.value.getBoard().getOrganizeDepartments({}, false);
      organize.value.roles = await curWidget.value.getBoard().getOrganizeRoles();
      organize.value.users = await curWidget.value.getBoard().getOrganizeUsers();
    }
  }
  if ([FormWidgetType.AUTO_COMPUTE, FormWidgetType.SEARCH_FORM].includes(curWidget.value?.type as FormWidgetType)) {
    if (FormWidgetType.AUTO_COMPUTE === curWidget.value.type) {
      getAutoCompute();
    }
  }
});

const processStatus = computed(()=>{
  switch (props.value) {
    case ProcessNodeStatus.QUEUED:
      return {
        text: ProcessNodeStatusMapping[ProcessNodeStatus.QUEUED],
        color: '#409eff',
      };
    case ProcessNodeStatus.IN_PROGRESS:
      return {
        text: ProcessNodeStatusMapping[ProcessNodeStatus.IN_PROGRESS],
        color: 'orange',
      };
    case ProcessNodeStatus.FINISHED:
      return {
        text: ProcessNodeStatusMapping[ProcessNodeStatus.FINISHED],
        color: '#5ec431',
      };
    case ProcessNodeStatus.REJECTED:
      return {
        text: ProcessNodeStatusMapping[ProcessNodeStatus.REJECTED],
        color: '#f9484e',
      };
    case ProcessNodeStatus.CANCELED:
      return {
        text: ProcessNodeStatusMapping[ProcessNodeStatus.CANCELED],
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
  overflow-y: auto;
  max-height: 80px;
  height: 100%;
  width: 100%;
  flex: 1;
  display: flex;
  align-items: center;
  max-width: 100%;

  &.multiline-text-cell {
    align-items: flex-start;
  }

  .el-tag {
    border: none;
  }
  .el-tag:not(:last-child) {
    margin-right: 2px;
  }

  :deep(.el-space) {
    &.account {
      max-width: 100%;
      .el-space__item {
        display: block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    &.space {
      height: 100%;
    }
  }

  .cell-number {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    overflow: hidden;
    white-space: nowrap;

    .unit-prefix {
      flex: 0 0 auto;
      margin-right: 4px;
      color: var(--text-color-secondary);
    }

    .number-content {
      flex: 1 1 auto;
      text-align: right;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .percent {
      margin-left: 4px;
      color: var(--text-color-secondary);
    }

    .unit-suffix {
      flex: 0 0 auto;
      margin-left: 4px;
      white-space: nowrap;
      color: var(--text-color-secondary);
    }
  }

  .link span {
    color: var(--el-color-primary);
    cursor: var(--cursor-pointer);
  }

  .html-container {
    line-height: 1.5;
  }

  .cell-text {
    width: 100%;
    min-width: 0;
    line-height: 20px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .dialog-link {
    color: var(--color-primary);
    cursor: pointer;

    &:hover {
      color: var(--color-primary-light-3);
    }
  }

  .textarea-input {
    height: 100%;
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
      align-items: center;

      .name {
        font-size: 14px;
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
</style>

