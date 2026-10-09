<template>
  <div class="field-option-input" :class="{ over: isOver }" @dragover.prevent.stop="handleDragOver"
    @dragenter.prevent.stop="handleDragEnter" @dragleave.prevent.stop="handleDragLeave" @drop.prevent="handleDrop">
    <span class="field-option-placeholder" v-if="!fields?.length">{{ $t("axisPlaceholder") }}</span>
    <template v-else>
      <template v-for="(field, index) in fields" :key="field.uid[2]">
        <div :class="{ dropzone: true, active: index === drop_index }"></div>
        <div class="field" :class="{
          dragging: dragging_index === index,
          error: fieldErrorMessages[index]?.type === 'error' || activeElement.getFieldAlias(restoreFieldUid(field.uid)) === '',
          warning: fieldErrorMessages[index]?.type === 'warning',
        }" draggable="true" @dragstart.stop="handleFieldDragStart($event, index)" @dragend="handleFieldDragEnd">
          <div 
            :class="['field-name', { lost: !activeElement.getFieldAlias(restoreFieldUid(field.uid)) }]" 
            :title="fieldErrorMessages[index]?.message ?? ''"
            :style="{ maxWidth: getParsedAggs(field.uid) ? '130px' : '148px' }"
          >
            {{ getFieldAlias(field.uid) || $t('FieldOption.dataSourceLost') }}
          </div>
            <el-dropdown trigger="click" size="small" :hide-on-click="false" @command="handleSelect" v-if="getDropItems(field)?.length">
              <el-icon class="el-icon--right">
                <i-ep-arrow-down />
              </el-icon>
              <template #dropdown>
                <el-dropdown-menu :style="{ width: '108px' }">
                  <el-dropdown-item v-for="item in getDropItems(field)" :key="item.key" :style="{ lineHeight: '24px', padding: '2px 0' }">
                    <el-popover v-if="item.children" placement="left" :show-arrow="false" :popper-style="{ padding: '0', minWidth: '100px' }"
                     :offset="3" width="auto" transition="none" :show-after="200" :ref="(ref) => popoverRef[`${field.uid[2]}_${index}_${item.key}`] = ref"
                     @before-enter="handleCheckField(field)">
                      <template #reference>
                        <div :style="{ width: '100%', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}">
                          <span>{{ item.alias }}</span>
                          <el-icon :size="14" :style="{ marginRight: 0 }">
                            <i-ep-arrow-right />
                          </el-icon>
                        </div>
                      </template>
                      <div class="el-dropdown-menu" :style="{
                        '--el-dropdown-menuItem-hover-fill': 'var(--el-color-primary-light-9)',
                        '--el-dropdown-menuItem-hover-color': 'var(--el-color-primary)',
                      }">
                        <div class="el-dropdown-menu__item" v-for="child in item.children" :key="child.key" @click.stop="handleSelectChildItem(item.key, child.key, field, index)"
                        :style="{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: '24px', padding: '2px 8px' }">
                          <span>{{ child.alias }}</span>
                          <el-icon :size="14" v-if="field[item.key] === child.key" :style="{ marginRight: 0, marginLeft: '8px' }">
                            <i-ep-check />
                          </el-icon>
                        </div>
                      </div>
                    </el-popover>
                    <div v-else class="field-option-menu-item" @click.stop="handleSelectItem(item.key, field, index)"
                      :style="{ width: '100%', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }">
                      <span>{{ item.alias }}</span>
                      <el-icon :size="14" v-if="isItemChecked(item.key, field)" :style="{ marginRight: 0, marginLeft: '8px' }">
                        <i-ep-check />
                      </el-icon>
                    </div>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <i class="fs fs-remove" @click="handleRemove(field, index)"></i>
      </div>
      </template>
      <div :class="{ dropzone: true, active: drop_index >= fields.length }"></div>
    </template>
  </div>
</template>


<script lang="ts" setup>
/**
 * field(aggs=sum|max|min|mean|count, min=0, max=1, recommend=string|number|array)
 */
import { ref, inject, computed, watch, toRaw, onUnmounted, onMounted } from 'vue';
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { ACTIVE_ELEMENT, ACTIVE_FIELD_OPTION, DELETED_TABLES_UID, FIELD_OPTION_CONTEXTS } from '@renderer/types';
import { FieldUID, OptionFieldUID } from '@common/types/project';
import { isEntityField, SystemField } from '@common/utils/connection';
import { DefinedOptionWithParsedType, FieldMultiValueMode, OptionFieldValue, SummaryDataFormat, SummaryType, SummaryYearFormat, SummaryYearMonthDayFormat, SummaryYearMonthFormat, SummaryYearQuarterFormat, SummaryYearWeekFormat } from '../types';
import { ElMessage } from 'element-plus';
import { Field } from '@common/types/project';
import { equals, isEmpty } from '@common/utils/object';
import { ComputedRef } from 'vue';
import i18next from 'i18next';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import { reactive } from 'vue';

dayjs.extend(quarterOfYear);
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);


type FieldErrorMessage = {
  message: string,
  type: "warning" | "error",
};

const props = defineProps<{
  option: DefinedOptionWithParsedType,
  paths: string[],
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const activeFieldOption = inject(ACTIVE_FIELD_OPTION);
const fieldOptionContexts = inject(FIELD_OPTION_CONTEXTS);
const deletedTablesUid = inject(DELETED_TABLES_UID);
const activeElement = inject(ACTIVE_ELEMENT);

const popoverRef = reactive({});

const summaryMapping = {
  get none() { return i18next.t("axisSummaryNo") },
  get sum() { return i18next.t("axisSummarySum") },
  get max() { return i18next.t("axisSummaryMax") },
  get min() { return i18next.t("axisSummaryMin") },
  get mean() { return i18next.t("axisSummaryMean") },
  get count() { return i18next.t("axisSummaryCount") },
  get distinct() { return i18next.t("axisSummaryDistinct") },
  get fill() { return i18next.t("FieldOption.summaryFilled") },
  get unfill() { return i18next.t("FieldOption.summaryUnfilled") },
  get [SummaryType.YEAR]() { return i18next.t("FieldOption.summaryYear") },
  get [SummaryType.YEAR_QUARTER]() { return i18next.t("FieldOption.summaryYearQuarter") },
  get [SummaryType.YEAR_MONTH]() { return i18next.t("FieldOption.summaryYearMonth") },
  get [SummaryType.YEAR_WEEK]() { return i18next.t("FieldOption.summaryYearWeek") },
  get [SummaryType.YEAR_MONTH_DAY]() { return i18next.t("FieldOption.summaryYearMonthDay") },
};
const summaryFormatTextMapping = {
  get [SummaryYearFormat.YYYY_Y]() { return dayjs().format(i18next.t("FieldOption.yearFormatLong")) },
  [SummaryYearFormat.YYYY]: dayjs().format("YYYY"),
  get [SummaryYearFormat.YY_Y]() { return dayjs().format(i18next.t("FieldOption.yearFormatShort")) },
  [SummaryYearFormat.YY]: dayjs().format("YY"),

  get [SummaryYearQuarterFormat.YYYY_Q]() { return dayjs().format(i18next.t("FieldOption.yearQuarterFormatLong")) },
  get [SummaryYearQuarterFormat['YYYY/Q']]() { return dayjs().format(i18next.t("FieldOption.yearQuarterFormatSlashLong")) },
  get [SummaryYearQuarterFormat['YY/Q']]() { return dayjs().format(i18next.t("FieldOption.yearQuarterFormatSlashShort")) },

  get [SummaryYearMonthFormat.YYYY_Y_MM_M]() { return dayjs().format(i18next.t("FieldOption.yearMonthFormatLong")) },
  get [SummaryYearMonthFormat['YYYY/MM_M']]() { return dayjs().format(i18next.t("FieldOption.yearMonthFormatSlash")) },
  [SummaryYearMonthFormat['YYYY/MM']]: dayjs().format("YYYY/MM"),
  [SummaryYearMonthFormat['YY/MM']]: dayjs().format("YY/MM"),

  get [SummaryYearWeekFormat.YYYY_Y_WW_W]() { return dayjs().format(i18next.t("FieldOption.yearWeekFormatLong")) },
  get [SummaryYearWeekFormat['YYYY/WW_W']]() { return dayjs().format(i18next.t("FieldOption.yearWeekFormatSlashLong")) },
  get [SummaryYearWeekFormat['YY/WW_W']]() { return dayjs().format(i18next.t("FieldOption.yearWeekFormatSlashShort")) },

  get [SummaryYearMonthDayFormat.YYYY_Y_MM_M_DD_D]() { return dayjs().format(i18next.t("FieldOption.dateFormatLong")) },
  [SummaryYearMonthDayFormat['YYYY/MM/DD']]: dayjs().format("YYYY/MM/DD"),
  [SummaryYearMonthDayFormat['YY/MM/DD']]: dayjs().format("YY/MM/DD"),
  get [SummaryYearMonthDayFormat.MM_M_DD_D]() { return dayjs().format(i18next.t("FieldOption.monthDayFormatLong")) },
  [SummaryYearMonthDayFormat['MM/DD']]: dayjs().format("MM/DD"),
}

const restoreFieldUid = (uid: OptionFieldUID) => {
  return [uid?.[0], uid?.[1], uid?.[2]?.replace(/_entity$/, '')] as OptionFieldUID;
}

const isDateField = (field?: Field | null) => {
  const fieldName = field?.meta?.name;
  return fieldName === SystemField.CREATE_TIME || fieldName === SystemField.UPDATE_TIME || field?.meta?.subType === "date";
}
const CARTESIAN_CATEGORY_OPTION_NAMES = Object.freeze(["axis-x"]);
const TIME_SUMMARY_AGGS = Object.freeze([
  SummaryType.YEAR,
  SummaryType.YEAR_QUARTER,
  SummaryType.YEAR_MONTH,
  SummaryType.YEAR_WEEK,
  SummaryType.YEAR_MONTH_DAY,
]);
const parsedAggs = computed(() => {
  if (props.option.args?.aggs) {
    return props.option.args.aggs.split('|').map(item => item.trim());
  }
  return undefined;
})
const isCartesianCategoryFieldOption = () => {
  return CARTESIAN_CATEGORY_OPTION_NAMES.includes(String(props.option?.name || ""));
}
const isRiverDateFieldOption = () => {
  return String(props.option?.name || "") === "axis-date"
    && activeElement.value?.getSoul?.()?.type === "widget.echarts.river";
}
const shouldShowMissingTimeItem = (optionFieldValue: OptionFieldValue, field?: Field | null) => {
  return (isCartesianCategoryFieldOption() || isRiverDateFieldOption())
    && isDateField(field)
    && TIME_SUMMARY_AGGS.includes(optionFieldValue.summary as SummaryType);
}
const getDropItems = (optionFieldValue: OptionFieldValue) => {
  const field = activeElement.value?.getField(restoreFieldUid(optionFieldValue.uid));
  const result = [];
  if (isDateField(field)) {
    result.push({
      key: "summary",
      alias: i18next.t("FieldOption.aggregateMethod"),
      children: getSummaryItems(optionFieldValue),
    }) 
    if (
      optionFieldValue.summary &&
      optionFieldValue.summary !== SummaryType.NONE
    ) {
      result.push({
        key: "dataFormat",
        alias: i18next.t("FieldOption.dataFormat"),
        children: getDataFormatItems(optionFieldValue),
      });
    }
    if (shouldShowMissingTimeItem(optionFieldValue, field)) {
      result.push({
        key: "showMissingTime",
        alias: i18next.t("FieldOption.showMissingTime"),
      });
    }
  } else {
    const summaryItems = getSummaryItems(optionFieldValue);
    if (summaryItems.length) {
      result.push({
        key: "summary",
        alias: i18next.t("FieldOption.aggregateMethod"),
        children: summaryItems,
      })
    }
  }
  const multiValueModeItems = getMultiValueModeItems(optionFieldValue);
  if (multiValueModeItems.length) {
    result.push({
      key: "multiValueMode",
      alias: i18next.t("FieldOption.multiValueMode"),
      children: multiValueModeItems,
    });
  }
  return [
    ...result,
    // 其他的选项
  ];
}

const getParsedMultiValueModes = () => {
  const multiValueModes = String(props.option.args?.multiValueModes || "").trim();
  if (!multiValueModes) {
    return [];
  }
  return multiValueModes
    .split('|')
    .map(item => item.trim())
    .filter((item): item is FieldMultiValueMode => item === "split" || item === "join");
}

const multiValueModeMapping: Record<FieldMultiValueMode, string> = {
  get split() { return i18next.t("FieldOption.multiValueModeSplit") },
  get join() { return i18next.t("FieldOption.multiValueModeJoin") },
}

const getMultiValueModeItems = (optionFieldValue: OptionFieldValue) => {
  const field = activeElement.value?.getField(restoreFieldUid(optionFieldValue.uid));
  if (field?.type === "array" || (field?.type as any) === "tag") {
    return getParsedMultiValueModes().map(item => {
      return {
        key: item,
        alias: multiValueModeMapping[item],
      }
    });
  } else {
    return [];
  }
}

const getSummaryFormatItems = (format: Record<string, string>) => {
  return Object.entries(format).map(([, value]) => {
    return {
      key: value,
      alias: summaryFormatTextMapping[value],
    }
  })
}
const getDataFormatItems = (optionFieldValue: OptionFieldValue) => {
  if (DATE_AGGS.includes(optionFieldValue.summary)) {
    switch (optionFieldValue.summary) {
    case SummaryType.YEAR:
      return getSummaryFormatItems(SummaryYearFormat);
    case SummaryType.YEAR_QUARTER:
      return getSummaryFormatItems(SummaryYearQuarterFormat);
    case SummaryType.YEAR_MONTH:
      return getSummaryFormatItems(SummaryYearMonthFormat);
    case SummaryType.YEAR_WEEK:
      return getSummaryFormatItems(SummaryYearWeekFormat);
    case SummaryType.YEAR_MONTH_DAY:
      return getSummaryFormatItems(SummaryYearMonthDayFormat);
    }
  }
  return [];
}
const getSummaryItems = (optionFieldValue: OptionFieldValue) => {
  const aggs = getParsedAggs(optionFieldValue.uid);
  return aggs.map(item => {
    return {
      key: item,
      alias: summaryMapping[item],
    }
  })
}

let contextId;
let drop_index = ref(-1);
const isOver = ref(false);
const dragging_index = ref(-1);  // 内部field在拖拽时的 index
const dragFromOutside = computed(() => dragging_index.value === -1);

const NUMBER_AGGS = Object.freeze(["none", "sum", "max", "min", "mean", "count", "distinct", "fill", "unfill"]);
const DEFAULT_AGGS = Object.freeze(["none", "count", "distinct", "fill", "unfill"]);
const DATE_AGGS = Object.freeze([SummaryType.YEAR_MONTH_DAY, SummaryType.YEAR, SummaryType.YEAR_QUARTER, SummaryType.YEAR_MONTH, SummaryType.YEAR_WEEK, SummaryType.NONE]);

const getParsedAggs = (fieldPath?: OptionFieldUID) => {
  const autoAggs = props.option.args?.aggs === 'true' || (props.option.args?.aggs as unknown as boolean) === true;

  if (!autoAggs) {
    const aggs = parsedAggs.value ?? [];
    if (fieldPath?.[2]?.includes(".")) {
      return aggs.filter(item => item !== "none");
    }
    if (!isEmpty(aggs)) return aggs;
  }
  if (!fieldPath) return parsedAggs.value ?? [];
  const field = activeElement.value?.getField(restoreFieldUid(fieldPath));
  if (isDateField(field)) return DATE_AGGS;
  else if ((field?.revisedType || field?.type) === "number") return NUMBER_AGGS;
  return DEFAULT_AGGS;
};


// 删除使用的数据字段
const handleRemove = (field: OptionFieldValue, index: number) => {
  let fields = getOptionValue();
  fields = toRaw(fields).filter((item, i) => !(item.uid[2] == field.uid[2] && index === i))
  updateOption(fields);
  removeError();
}

// 切换聚和、最大值之类的
const handleSelect = () => {
  // let fields = getOptionValue();
  // for (const item of fields) {
  //   if (item.uid[2] === field.uid[2]) {
  //     item.summary = summary;
  //     break;
  //   }
  // }
  // updateOption(toRaw(fields));
}

const handleSelectChildItem = (key: string, value: SummaryType | SummaryDataFormat, field: OptionFieldValue, index = 0) => {
  if (field[key] !== value) {
    if (key === "summary") {
      field.summary = value;
      if (value === SummaryType.NONE) {
        delete field.dataFormat;
        delete field.showMissingTime;
      } else if (DATE_AGGS.includes(value)) {
        field.dataFormat = getDataFormatItems(field)?.[0]?.key as SummaryDataFormat;
      }
    } else {
      field[key] = value;
    }
    updateOption(toRaw(fields.value));
  }
  popoverRef[`${field.uid[2]}_${index}_${key}`]?.hide();
}

const handleSelectItem = (key: string, field: OptionFieldValue, index = 0) => {
  if (key === "showMissingTime") {
    field.showMissingTime = !field.showMissingTime;
    updateOption(toRaw(fields.value));
  }
  popoverRef[`${field.uid[2]}_${index}_${key}`]?.hide?.();
}

const isItemChecked = (key: string, field: OptionFieldValue) => {
  if (key === "showMissingTime") {
    return Boolean(field.showMissingTime);
  }
  return false;
}

const handleCheckField = (field: OptionFieldValue) => {
  if (!field.summary) {
    field.summary = (getParsedAggs(field.uid)?.[0] || "") as SummaryType;
  }
  if (!field.dataFormat &&
    field.summary !== SummaryType.NONE &&
    !field.dataFormat
  ) {
    field.dataFormat = (getDataFormatItems(field)?.[0]?.key || "") as SummaryDataFormat;
  }
  if (getMultiValueModeItems(field).length && !field.multiValueMode) {
    field.multiValueMode = (getParsedMultiValueModes()?.[0] || "split") as FieldMultiValueMode;
  }
}

const getFieldAlias = (uid: OptionFieldUID) => {
  const ids = uid[2]?.split(".") || [];
  if (!ids.length) return "";
  const _uid = restoreFieldUid([uid[0], uid[1], ids[0]] as OptionFieldUID);
  const alias = activeElement.value?.getFieldAlias(_uid);
  const field = activeElement.value?.getField(_uid);
  if (!field) return alias || "";
  if (ids.length > 1) {
    const subTableUID = field?.meta?.extra?.subTableUID;
    if (subTableUID) {
      const subField = activeElement.value?.getField(restoreFieldUid([subTableUID[0], subTableUID[1], ids[1] as FieldUID]));
      const subAlias = activeElement.value?.getFieldAlias(restoreFieldUid([subTableUID[0], subTableUID[1], ids[1] as FieldUID]));
      if (!subField) return alias || "";
      return `${alias}.${isEntityField(subField) && !ids[1]?.endsWith("_entity") ? subAlias + "(ID)" : subAlias}`;
    }
  }
  return isEntityField(field) && !ids[0]?.endsWith("_entity") ? `${alias}(ID)` : alias;
}

// 判断当前field是否达到上限
const isUpperLimit = () => {
  if (props.option.args) {
    const max = Number(props.option.args?.max) ?? Infinity;
    if (max <= fields.value.length) {
      return true;
    }
  }
  return false;
}

const addField = (uid: OptionFieldUID, field: Field) => {
  let fieldOptions: OptionFieldValue[] = getOptionValue() || [];
  if (isUpperLimit()) {
    ElMessage.warning(i18next.t("fieldOption.fieldsTypeLimit"));
    restoreDefault();
    return false;
  }
  // 类型推荐
  if (props.option?.args?.recommend && field) {
    const recommends = props.option.args.recommend.split('|');
    const index = recommends.indexOf(field.revisedType || field.type)
    if (index < 0) {
      ElMessage({
        type: 'warning',
        message: i18next.t("fieldOption.fieldsTypeError")
      });
      return false;
    }
  }
  fieldOptions.push({ uid, __opt_type: 'field', summary: (getParsedAggs(uid)?.[0] || '') as SummaryType });
  updateOption(fieldOptions);
  return true;
}

const removeField = (uid: OptionFieldUID) => {
  let fieldOptions = getOptionValue() || [];
  const index = fieldOptions.findIndex(item => item.uid[2] === uid[2]);
  fieldOptions.splice(index, 1);
  updateOption(fieldOptions);
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
  activeFieldOption.value = fieldOptionContexts.value[contextId];
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
  activeFieldOption.value = {};
}

const handleDragOver = (ev: DragEvent) => {
  drop_index.value = parseInt((ev.layerY / 25).toString());
}

const handleDrop = (ev: DragEvent) => {
  const dragType = ev.dataTransfer.getData("drag-type");
  let fieldOptions: OptionFieldValue[] = getOptionValue() || [];
  if (dragType === "FieldOptionDrag") {
    let fields: OptionFieldValue[] = getOptionValue();
    if (dragFromOutside.value) {
      // 从一个 FieldOption 拖拽到另外一个 FieldOption
      try {
        const dragField = JSON.parse(ev.dataTransfer.getData("drag-data") ?? "{}").field;
        if (fieldOptions.some(dim => dim.uid.every((uid, index) => uid === dragField.uid[index]))) {
          restoreDefault();
          return;
        }
        addField(dragField.uid, dragField);
      } catch (error) {
        console.error(error);
        return;
      }
      
    } else {
      // 在同一个 FieldOption 中拖拽
      const dragField = fields[dragging_index.value];
      fields.splice(drop_index.value, 0, dragField);
      if (dragging_index.value > drop_index.value) {
        fields.splice(dragging_index.value + 1, 1);
      } else {
        fields.splice(dragging_index.value, 1);
      }
      updateOption(toRaw(fields));
    }
    restoreDefault();
  } else if (dragType === "ProjectDataDrag") {
    try {
      const fieldData = JSON.parse(ev.dataTransfer.getData("drag-data") ?? "{}");
      if (fieldOptions.some(dim => dim.uid.every((uid, index) => uid === fieldData.fieldUID[index]))) {
        restoreDefault();
        return;
      }
      addField(fieldData.fieldUID, fieldData.field);
    } catch (error) {
      console.error(error);
      return;
    }
    restoreDefault();
  }
}

// 开始跨 FieldOption 组件拖拽
const handleFieldDragStart = (ev: DragEvent, index: number) => {
  ev.dataTransfer.setData("drag-type", "FieldOptionDrag");
  ev.dataTransfer.setData("drag-data", JSON.stringify({ field: fields.value[index] }));
  dragging_index.value = index;
  isOver.value = true;
}

const handleFieldDragEnd = () => {
  // 如果是跨 FieldOption 组件拖拽并且字段被拖到了外面，则在 DragEnd 回调中删除它
  if (!dragFromOutside.value && drop_index.value < 0) {
    removeField(fields.value[dragging_index.value].uid);
  }
}

// 恢复默认
const restoreDefault = () => {
  drop_index.value = -1;
  isOver.value = false;
  dragging_index.value = -1;
  activeFieldOption.value = {};
}

const fields = computed<OptionFieldValue[]>(() => {
  return getOptionValue() || [];
});

const fieldErrorMessages: ComputedRef<FieldErrorMessage[]> = computed(() => {
  const errorMessages: FieldErrorMessage[] = []
  for (const field of fields.value) {
    let errorMessage: FieldErrorMessage;
    if (deletedTablesUid.value.includes(fields.value[0].uid[1])) {
      errorMessage = {
        message: i18next.t("axisNotFound"),
        type: "error",
      };
    } else {
      errorMessage = checkMultiFiledError(restoreFieldUid(field.uid));
    }
    if (errorMessage) {
      errorMessages.push(errorMessage);
    }
  }
  return errorMessages;
});

const checkMultiFiledError = (uid: OptionFieldUID): FieldErrorMessage => {
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
  const errorDataFieldUIDs = errorInfo.data;
  const tableUID = [uid[0], uid[1]];
  const firstErrorTableUID = [errorDataFieldUIDs[0][0], errorDataFieldUIDs[0][1]];
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

watch(() => fields.value.length, () => {
  restoreDefault();
});

const computeFieldScore = (field: Field) => {
  const args = props.option.args;
  if (args) {
    if (isUpperLimit()) {
      return 'quantityLimit';
    }

    // 类型推荐
    if (args.recommend) {
      const recommends = args.recommend.split('|');
      const index = recommends.indexOf(field.revisedType || field.type)
      if (index < 0) {
        return 'typeError';
      }

      // 按正常的顺序
      // 如果要按照 recommend 的顺序来定优先级： -contextId - index - (增量，例如10)
      return -contextId;
    }
  }
  // 没有args的优先级最低，这里排在 1000 位
  // contextId 是 上往下当前fieldOption排的位数，排在上面的优先级比下面的高
  return -contextId - 1000;
}
const getFields = () => fields.value;

onMounted(() => {
  contextId = Object.values(fieldOptionContexts.value).length;
  fieldOptionContexts.value[contextId] = {
    getFields,
    addField,
    removeField,
    computeFieldScore
  }
});

onUnmounted(() => {
  delete fieldOptionContexts.value[contextId];
})
</script>

<style lang="scss" scoped>
.option-group-item {
  .field-option-input {
    border-radius: 2px;
    min-height: 25px;
    position: relative;
    padding: 3px 5px;
    flex: 1;
    border: 1px var(--border-color) solid;

    .dropzone {
      width: 100%;
      height: 1px;
      background-color: transparent;
      margin: 1px 0;

      &.active {
        background-color: var(--color-primary);
      }
    }

    &.over {
      border: 1px dashed var(--color-primary);

      * {
        pointer-events: none;
      }
    }

    .field-option-placeholder {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      line-height: 25px;
      text-indent: 10px;
      pointer-events: none;
    }

    .field {
      height: 25px;
      line-height: 25px;
      background-color: var(--bg-color-overlay);
      border: 1px solid var(--border-color);
      border-radius: 5px;
      margin-top: 1px;
      text-indent: 5px;
      display: flex;
      justify-content: space-between;
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
        border: 1px solid var(--color-warning);
      }

      .field-name {
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        
        &.lost {
          color: var(--color-warning);
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
