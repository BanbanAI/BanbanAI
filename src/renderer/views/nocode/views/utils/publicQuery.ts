import { FormWidgetType, RuleFunc, RuleFuncValue } from '@common/types/nocode';
import type { Field } from '@common/types/project';
import { getSystemColumnConfigurations } from '@renderer/views/nocode/components/global/table/utils';
import { formElementInstances } from '@renderer/utils/instance';

export type PublicQueryFieldFuncInfo = Partial<Record<RuleFunc, RuleFuncValue>>;

const PUBLIC_QUERY_UNSUPPORTED_WIDGET_TYPES = new Set([
  FormWidgetType.CHECKBOX_GROUP,
  FormWidgetType.TREE_MULTIPLE_SELECT,
  FormWidgetType.TAG_INPUT,
  FormWidgetType.FILE_UPLOADER,
  FormWidgetType.IMAGE_UPLOADER,
]);

const PUBLIC_QUERY_PREFER_IN_WIDGET_TYPES = new Set([
  FormWidgetType.RADIO_GROUP,
  FormWidgetType.TREE_SELECT,
  FormWidgetType.MEMBER_SELECT,
  FormWidgetType.DEPARTMENT_SELECT,
]);

const PUBLIC_QUERY_SUPPORTED_TAGS_WIDGET_TYPES = new Set<string>([]);

const getFieldWidgetType = (field: Field) => field?.meta?.extra?.widgetType || '';

const getFallbackPublicQueryFieldFuncInfo = (field: Field): PublicQueryFieldFuncInfo => {
  const widgetType = getFieldWidgetType(field);
  if (widgetType === FormWidgetType.SWITCH) {
    return {
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.TRUE]: RuleFuncValue.NULL,
      [RuleFunc.FALSE]: RuleFuncValue.NULL,
    };
  }
  if ([FormWidgetType.FILE_UPLOADER, FormWidgetType.IMAGE_UPLOADER].includes(widgetType as FormWidgetType)) {
    return {
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    };
  }
  if (field?.type === 'number') {
    return {
      [RuleFunc.BETWEEN]: RuleFuncValue.RANGE,
    };
  }
  if (['date', 'datetime', 'time', 'month', 'year'].includes(field?.meta?.subType || '')) {
    return {
      [RuleFunc.TIME_BETWEEN]: RuleFuncValue.RANGE,
    };
  }
  if ([FormWidgetType.ADDRESS, FormWidgetType.POSITION].includes(widgetType as FormWidgetType)) {
    return {
      [RuleFunc.BELONG]: RuleFuncValue.ADDRESS,
    };
  }
  if (field?.type === 'array') {
    return {
      [RuleFunc.EQUAL]: RuleFuncValue.TAGS,
    };
  }
  return {
    [RuleFunc.EQUAL]: RuleFuncValue.STRING,
  };
};

export const getPublicQueryFieldFuncInfo = async (field: Field): Promise<PublicQueryFieldFuncInfo> => {
  const widgetType = getFieldWidgetType(field);
  if (widgetType === FormWidgetType.SWITCH) {
    return getFallbackPublicQueryFieldFuncInfo(field);
  }
  if (widgetType) {
    const instance = await formElementInstances.getInstance(widgetType);
    const configurations = instance?.getConfigurations?.();
    const editFuncInfo = configurations?.editFuncInfo || {};
    if (Object.keys(editFuncInfo).length > 0) {
      return editFuncInfo;
    }
  }

  const systemFuncInfo = getSystemColumnConfigurations(field?.meta?.name)?.funcInfo || {};
  if (Object.keys(systemFuncInfo).length > 0) {
    return systemFuncInfo;
  }

  return getFallbackPublicQueryFieldFuncInfo(field);
};

export const isUnsupportedPublicQueryField = (field: Field, funcInfo: PublicQueryFieldFuncInfo) => {
  if (PUBLIC_QUERY_UNSUPPORTED_WIDGET_TYPES.has(getFieldWidgetType(field) as FormWidgetType)) {
    return true;
  }
  return funcInfo?.[RuleFunc.EQUAL] === RuleFuncValue.SELECT_MULTIPLE;
};

export const shouldPreferPublicQueryInFunc = (field: Field, funcInfo: PublicQueryFieldFuncInfo) => {
  if (!funcInfo?.[RuleFunc.IN]) {
    return false;
  }
  return PUBLIC_QUERY_PREFER_IN_WIDGET_TYPES.has(getFieldWidgetType(field) as FormWidgetType);
};

export const isPublicQuerySwitchField = (field: Field, funcInfo: PublicQueryFieldFuncInfo) => {
  if (getFieldWidgetType(field) !== FormWidgetType.SWITCH) {
    return false;
  }
  return [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].some((func) => func in (funcInfo || {}));
};

const isSupportedPublicQueryTagsField = (field: Field, funcInfo: PublicQueryFieldFuncInfo) => {
  return funcInfo?.[RuleFunc.EQUAL] === RuleFuncValue.TAGS
    && PUBLIC_QUERY_SUPPORTED_TAGS_WIDGET_TYPES.has(getFieldWidgetType(field));
};

export const isSupportedPublicQueryField = (field: Field, funcInfo: PublicQueryFieldFuncInfo) => {
  const widgetType = getFieldWidgetType(field);
  return !isUnsupportedPublicQueryField(field, funcInfo)
    && (
      funcInfo?.[RuleFunc.BETWEEN] === RuleFuncValue.RANGE
      || funcInfo?.[RuleFunc.TIME_BETWEEN] === RuleFuncValue.RANGE
      || shouldPreferPublicQueryInFunc(field, funcInfo)
      || funcInfo?.[RuleFunc.BELONG] === RuleFuncValue.ADDRESS
      || funcInfo?.[RuleFunc.EMPTY] === RuleFuncValue.NULL
      || funcInfo?.[RuleFunc.NOT_EMPTY] === RuleFuncValue.NULL
      || funcInfo?.[RuleFunc.EQUAL] === RuleFuncValue.STRING
      || funcInfo?.[RuleFunc.EQUAL] === RuleFuncValue.SELECT
      || funcInfo?.[RuleFunc.EQUAL] === RuleFuncValue.TREE_SELECT
      || isSupportedPublicQueryTagsField(field, funcInfo)
      || [FormWidgetType.ADDRESS, FormWidgetType.POSITION].includes(widgetType as FormWidgetType)
    );
};
