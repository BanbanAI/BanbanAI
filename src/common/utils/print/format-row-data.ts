import { FormWidgetType } from "@common/types/nocode";
import type { Field, FormOptions, Row, TableUID, WidgetSoul } from "@common/types/project";
import { formatFloat } from "@common/utils/math";
import { isEmpty } from "@common/utils/object";
import { cloneDeep } from "lodash";
import dayjs from "dayjs";
import i18next from "i18next";
import { getDisplayAmount } from "../amount";
import { findWidgetSoulByUID } from "../element";
import { formatNumberFieldDisplayValue } from "../fieldValue";
import { richTextToPlainText } from "../other";

export type FormatRowDataContext = {
  formOptions?: FormOptions,
  formTableUID?: TableUID,
  fields?: Field[],
  rawData?: Row,
}

type FieldFormatHandler = (data: Row, field: Field, context?: FormatRowDataContext) => Row;

const getFieldWidgetSoul = (field: Field, context?: FormatRowDataContext): WidgetSoul | null => {
  const widgetUID = field?.meta?.uid;
  const formTableUID = context?.formTableUID;
  if (!widgetUID || !formTableUID) return null;
  const formWidget = context?.formOptions?.[formTableUID]?.widget;
  if (!formWidget) return null;
  return findWidgetSoulByUID([formWidget], widgetUID);
}

const getRelatedLowerAmountValue = (data: Row, field: Field, context?: FormatRowDataContext) => {
  const fieldWidget = getFieldWidgetSoul(field, context);
  const relatedLowerAmount = fieldWidget?.options?.['related-lower-amount'];
  if (!relatedLowerAmount) return void 0;

  const relatedLowerAmountFieldUID = String(relatedLowerAmount).split('.').at(-1);
  if (!relatedLowerAmountFieldUID) return void 0;
  let fieldId: string
  if (relatedLowerAmountFieldUID.startsWith('f_')) {
    fieldId = relatedLowerAmountFieldUID;
  } else {
    const field = context?.fields?.find((field) => field?.meta?.uid === relatedLowerAmountFieldUID);
    if (field) {
      fieldId = field.uid as string;
    }
  }
  const rawData = context?.rawData;
  const sourceData = rawData && Object.prototype.hasOwnProperty.call(rawData, fieldId)
    ? rawData
    : data;
  if (!Object.prototype.hasOwnProperty.call(sourceData, fieldId)) return void 0;

  const value = sourceData[fieldId];
  return value === null || value === void 0 ? void 0 : value;
}

const fieldFormatMap: Partial<Record<FormWidgetType, FieldFormatHandler>> = {
  [FormWidgetType.RICH_TEXT_EDITOR]: (data: Row, field: Field) => {
    if (data[field.uid] === void 0 || data[field.uid] === null) {
      return data
    }
    data[field.uid] = richTextToPlainText(data[field.uid])
    return data
  },
  [FormWidgetType.MARKDOWN_EDITOR]: (data: Row, field: Field) => {
    if (field.meta?.subType !== 'html' || data[field.uid] === void 0 || data[field.uid] === null) {
      return data
    }
    data[field.uid] = richTextToPlainText(data[field.uid])
    return data
  },
  [FormWidgetType.NUMBER_INPUT]: (data: Row, field: Field) => {
    if (isEmpty(field?.meta?.extra)) {
      return data
    }
    let numberPrefix = ''
    let numberSuffix = ''
    let numberValue = ''
    
    const dealValue = (value) => {
      if (value === void 0 || value === null) {
        return ''
      }
      if (isNaN(value)) {
        value = 0
      }
      const { isPercent, decimalPlaces, completeZero } = field?.meta?.extra;
      let resultText = formatFloat(value, decimalPlaces, completeZero);
      if (isPercent) {
        resultText = formatFloat(value * 100, decimalPlaces, completeZero)
        resultText += "%";
      }

      return resultText
    }
    numberValue = dealValue(data[field.uid])
    
    if (!field?.meta?.extra?.['isPercent'] && field?.meta?.extra?.['unitPosition'] === 'prefix') {
      numberPrefix = field?.meta?.extra?.['unit'];
    }
    if (!field?.meta?.extra?.['isPercent'] && field?.meta?.extra?.['unitPosition'] === 'suffix') {
      numberSuffix = field?.meta?.extra?.['unit'];
    }
    data[field.uid] = `${numberPrefix}${numberValue}${numberSuffix}`
    return data
  },
  [FormWidgetType.MEMBER_SELECT]: (data: Row, field: Field) => {
    data[field?.uid] = data[field?.uid] ?? i18next.t('commonUtilsOther.dataNotFound')
    if (data[field?.uid] === '') {
      data[field?.uid] = i18next.t('commonUtilsOther.dataNotFound')
    }
    return data
  },
  [FormWidgetType.DEPARTMENT_SELECT]: (data: Row, field: Field) => {
    data[field?.uid] = data[field?.uid] ?? i18next.t('commonUtilsOther.dataNotFound')
    if (data[field?.uid] === '') {
      data[field?.uid] = i18next.t('commonUtilsOther.dataNotFound')
    }
    return data
  },
  [FormWidgetType.DATE_PICKER]: (data: Row, field: Field) => {
    if (isEmpty(field?.meta?.extra)) {
      return data;
    }
    const format = field?.meta?.extra?.format || 'yyyy-MM-dd';
    if (!format) {
      return data;
    }
    const value = data[field.uid];
    if (isEmpty(value)) {
      return data;
    }
    const dateDayjsByformat = dayjs(value, format, true);
    if (dateDayjsByformat.isValid()) {
      return data;
    }
    const dateDayjs = dayjs(value);
    if (dateDayjs.isValid()) {
      data[field.uid] = dateDayjs.format(format);
      return data;
    }
    return data;
  },
  [FormWidgetType.DATE_RANGE_PICKER]: (data: Row, field: Field) => {
    if (isEmpty(field?.meta?.extra)) {
      return data;
    }
    const format = field?.meta?.extra?.format || 'yyyy-MM-dd';
    const value = data[field.uid];
    if (isEmpty(value) || !Array.isArray(value)) {
      return data;
    }
    const dateRangeDayjsByformat = value.map((item) => dayjs(item, format, true));
    if (dateRangeDayjsByformat.every((item) => item.isValid())) {
      data[field.uid] = value.join('-');
      return data;
    }
    const dateRangeDayjs = value.map((item) => dayjs(item));
    if (dateRangeDayjs.every((item) => item.isValid())) {
      data[field.uid] = dateRangeDayjs.map((item) => item.format(format)).join('-');
      return data;
    }
    return data;
  },
  [FormWidgetType.SUBFORM]: (data: Row, field: Field, context?: FormatRowDataContext) => {
    const subformDatas = data[field.uid]
    if (isEmpty(subformDatas)) {
      return data
    }
    const subformFields = field?.subTableFields
    if (isEmpty(subformFields)) {
      return data
    }
    data[field.uid] = formatRowData(subformDatas, subformFields, context)
    return data
  },
  [FormWidgetType.RELATED_DATA]: (data: Row, field: Field, context?: FormatRowDataContext) => {
    const relatedTableDatas = data[field.uid]
    if (isEmpty(relatedTableDatas)) {
      return data
    }
    const relatedTableFields = field?.relatedTableFields
    if (isEmpty(relatedTableFields)) {
      return data
    }
    const relatedTableUID = field?.meta?.extra?.relatedTableUID;
    data[field.uid] = formatRowData(relatedTableDatas, relatedTableFields, {
      ...context,
      formTableUID: Array.isArray(relatedTableUID) ? relatedTableUID[1] : context?.formTableUID,
    })
    return data
  },
  [FormWidgetType.AMOUNT_INPUT]: (data: Row, field: Field, context?: FormatRowDataContext) => {
    if (isEmpty(field?.meta?.extra)) {
      return data
    }

    if (field.meta.extra.isAggregateMetric) {
      const formattedValue = formatNumberFieldDisplayValue(data[field.uid], field.meta.extra);
      data[field.uid] = formattedValue && field.meta.extra.isPercent ? `${formattedValue}%` : formattedValue;
      return data;
    }

    const amount = field?.meta?.extra?.amount;
    if (!amount) return data;
    const relatedLowerAmountValue = amount?.isUppercase
      ? getRelatedLowerAmountValue(data, field, context)
      : undefined;
    const amountValue = relatedLowerAmountValue === undefined
      ? data[field.uid]
      : relatedLowerAmountValue;
    data[field.uid] = getDisplayAmount(amountValue, {
      isUppercase: amount?.isUppercase,
      currencyType: amount?.currencyType,
      uppercaseLanguage: amount?.uppercaseLanguage,
      uppercaseShowFormat: amount?.uppercaseShowFormat,
      decimalPlaces: field?.meta?.extra?.decimalPlaces ?? amount?.decimal,
      decimalPadding: amount?.decimalPadding ?? amount?.completeZero ?? field?.meta?.extra?.completeZero,
      thousandSeparator: amount?.thousandSeparator,
      decimalSeparator: amount?.decimalSeparator,
      prefix: amount?.prefix,
      suffix: amount?.suffix
    })
    return data
  }
}
/** 格式化数据 
 * @param rowData 数据
 * @param fields 字段
*/
export const formatRowData = (
  rowData: Row[],
  fields?: Field[],
  context?: FormatRowDataContext,
) => {
  const rawRowData = rowData
  rowData = cloneDeep(rowData)
  if (isEmpty(rowData)) {
    return []
  }
  if (isEmpty(fields)) {
    return rowData
  }
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const widgetType = field?.meta?.extra?.widgetType
    if (!widgetType) {
      continue
    }
    rowData = rowData.map((data, dataIndex) => {
      if (fieldFormatMap[widgetType]) {
        data = fieldFormatMap[widgetType]?.(data, field, {
          ...context,
          fields,
          rawData: rawRowData?.[dataIndex],
        }) || data
      }
      return data
    })
  }
  return rowData
}
/**
 * 导出带数据的docx预览文件
 * 
 * @param template 模板和数据配置
 * @param rowData 数据
 */
