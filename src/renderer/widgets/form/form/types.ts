import { RuleFunc } from "@common/types/nocode";
import { getDynamicValue } from "@common/utils/connection";
import dayjs from 'dayjs';
import i18next from "@renderer/widgets/i18next";

export const meetRuleFuncs = {
  [RuleFunc.EQUAL]: (a: any, b: any) => a == b,
  [RuleFunc.NOT_EQUAL]: (a: any, b: any) => a != b,
  [RuleFunc.GT]: (a: any, b: any) => a > b,
  [RuleFunc.GTE]: (a: any, b: any) => a >= b,
  [RuleFunc.LT]: (a: any, b: any) => a < b,
  [RuleFunc.LTE]: (a: any, b: any) => a <= b,
  [RuleFunc.IN]: (a: any, b: any) => (b || []).includes(a),
  [RuleFunc.NOT_IN]: (a: any, b: any) => !(b || []).includes(a),
  [RuleFunc.CONTAIN]: (a: any, b: any) => (a || []).includes(b),
  [RuleFunc.NOT_CONTAIN]: (a: any, b: any) => !(a || []).includes(b),
  [RuleFunc.BETWEEN]: (a: any, b: any) => b[0] <= a && a <= b[1],
  [RuleFunc.CONTAIN_ANY]: (a: any, b: any) => {
    if (!Array.isArray(a)) a = a.split(",");
    if (!Array.isArray(b)) b = b.split(",");
    return b.some((item: any) => (a || []).includes(item));
  },
  [RuleFunc.CONTAIN_ALL]: (a: any, b: any) => {
    if (!Array.isArray(a)) a = a.split(",");
    if (!Array.isArray(b)) b = b.split(",");
    return b?.every((item: any) => (a || []).includes(item));
  },
  [RuleFunc.BELONG]: (a: any, b: any) => (b || []).includes(a),
  [RuleFunc.NOT_BELONG]: (a: any, b: any) => !(b || []).includes(a),
  [RuleFunc.EMPTY]: (a: any, b: any) => ['', null, undefined].includes(a),
  [RuleFunc.NOT_EMPTY]: (a: any, b: any) => !['', null, undefined].includes(a),
  [RuleFunc.TRUE]: (a: any, b: any) => a === true,
  [RuleFunc.FALSE]: (a: any, b: any) => a === false,
  [RuleFunc.DYNAMIC]: (a: any, b: any) => {
    const transB = getDynamicValue(b);
    return transB.$gte <= a && a <= transB.$lte;
  },
  [RuleFunc.TIME_EQUAL]: (a: any, b: any) => {
    return dayjs(a).isSame(dayjs(b), "day");
  },
  [RuleFunc.TIME_NOT_EQUAL]: (a: any, b: any) => {
    return !dayjs(a).isSame(dayjs(b), "day");
  },
  [RuleFunc.TIME_LTE]: (a: any, b: any) => {
    return dayjs(a).isBefore(dayjs(b), "day") || dayjs(a).isSame(dayjs(b), "day");
  },
  [RuleFunc.TIME_BETWEEN]: (a: any, b: any) => {
    return (dayjs(a).isBefore(dayjs(b[1]), "day") || dayjs(a).isSame(dayjs(b[1]), "day")) && (dayjs(a).isAfter(dayjs(b[0]), "day") || dayjs(a).isSame(dayjs(b[0]), "day"));
  },
}

export const filedType = [
  {
    name: i18next.t("fieldTypeLocation"),
    filed: ['widget.form.position'],
    color: '#FF4D4F'
  },
  {
    name: i18next.t("fieldTypeDepartment"),
    filed: ['widget.form.departmentSelect'],
    color: '#FF7033'
  },
  {
    name: i18next.t("fieldTypeMember"),
    filed: ['widget.form.memberSelect'],
    color: '#F24EA0'
  },
  {
    name: i18next.t("fieldTypeNumber"),
    filed: ['widget.form.numberInput', 'widget.form.rate'],
    color: '#FAAD14'
  },
  {
    name: i18next.t("fieldTypeTimestamp"),
    filed: ['widget.form.datePicker'],
    color: '#52C41A'
  },
  {
    name: i18next.t("fieldTypeText"),
    filed: ['widget.form.textInput', 'widget.form.textarea', 'widget.form.serialNumber', 'widget.form.radioGroup', 'widget.form.treeSelect', 'widget.form.phoneInput'],
    color: '#1890FF'
  },
  {
    name: i18next.t("fieldTypeArray"),
    filed: ['widget.form.dateRangePicker', 'widget.form.checkboxGroup', 'widget.form.treeMultipleSelect', 'widget.form.dateRangePicker', ],
    color: '#9367EB'
  },
  {
    name: i18next.t("fieldTypeBoolean"),
    filed: ['widget.form.switch'],
    color: '#337ECC'
  },
]

