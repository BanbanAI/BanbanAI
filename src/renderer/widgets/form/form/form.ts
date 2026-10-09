import { OptionTableUID } from "@common/types/project";
import { getUUIDSystemField, SystemField, transformCondition } from "@common/utils/connection";
import { FormCondition, RuleFunc, FormConditionValueType } from "@common/types/nocode";
import { getRelatedFields } from "@common/utils/related";
import { getCircularLinkageRuleIndexes } from "@common/utils/linkage-fill";
import { DefinedOptions, FormLinkageRule, FormVisibleRule, LogicalOperator, VisibleType, SelectIdOfForm } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { AbstractForm, AbstractSubForm, FormElement, isSubForm } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { watch, Ref, ref, computed, defineAsyncComponent } from "vue";
import VisibilityRuleList from "./components/visibility/VisibilityRuleList.vue";
import LinkageRuleList from "./components/linkage/LinkageRuleList.vue";
import { meetRuleFuncs } from "./types";
import { deepClone, equals, isEmpty } from "@common/utils/object";
import CustomDataTitleDialog from "./components/data-title/CustomDataTitleDialog.vue";
import RelatedFormLinkageFillDialog from "./components/related-form/RelatedFormLinkageFillDialog.vue";
import { isSelect } from '../_common/utils';
import { SubForm, UUID } from '../subForm/subForm';
import { QueryOptions, WhereCondition } from "@common/types/project";
import { FilterRule } from "@common/types/nocode";
import md5 from 'md5'
import { DataFillRule } from "@renderer/widgets/form/subForm/type";
import axios from 'axios';
import type { SerialNumber } from "../serialNumber/serialNumber";
import { getSubSerialNumberCounterFieldId, getSubSerialNumberCounterFieldName } from "../serialNumber/utils";
import type { SerialNumberCounter } from "../serialNumber/type";
import { canViewLayerByContext } from "../_common/page-permission";
import { canReadLayerDataByContext } from "../_common/data-permission";
import { FormMode } from "../_common/type";
import { ElMessage } from "element-plus";
import type { TheWidget as DatePicker } from "../datePicker";
import { fetchDistinct } from "../_common/distinct";
import { usePassportStore } from "@renderer/stores/passport";

const VisiblePermissionDefault = ['all-members'];
const EditablePermissionDefault = ['all-members'];
const DeleteAblePermissionDefault = ['all-members'];
const DATA_OWNER_SETTING_SUBMITTER = "submitter";
const DATA_OWNER_SETTING_FORM_FIELD = "form-field";
const getDataOwnerInvalidFieldSuffix = () => i18next.t("unavailableSuffix");
const getDataOwnerFieldTip = () => i18next.t("dataOwnerFieldTip");

type FormReadonlyMode = "off" | "on" | "condition";
type FormRequiredMode = "off" | "on" | "condition";

const FORM_READONLY_MODE_OPTION = "readonly-mode";
const FORM_READONLY_RULE_OPTION = "field-readonly";
const FORM_READONLY_PATCH_FLAG = "__banbanReadonlyConditionPatched__";
const FORM_REQUIRED_MODE_OPTION = "required-mode";
const FORM_REQUIRED_RULE_OPTION = "field-required";
const FORM_REQUIRED_PATCH_FLAG = "__banbanRequiredConditionPatched__";
const CONDITION_WIDGET_SEPARATOR = ".";

const getFieldReadonlyMode = (widget: FormElement): FormReadonlyMode => {
  const mode = widget.getOption<FormReadonlyMode>(FORM_READONLY_MODE_OPTION, { skipDefault: true });
  if (mode) return mode;
  return widget.getOption<boolean>("is-readonly", { skipDefault: true }) ? "on" : "off";
};

const getFieldReadonlyRule = (widget: FormElement): FilterRule | null => {
  const rule = widget.getOption<FilterRule>(FORM_READONLY_RULE_OPTION, { skipDefault: true });
  if (!rule?.conditions?.length) return null;
  return rule;
};

const splitConditionWidgetUid = (uid: string) => {
  return uid?.split(CONDITION_WIDGET_SEPARATOR).filter(Boolean) || [];
};

const getSubFormConditionContext = (widget: FormElement) => {
  if (!widget.isInSubForm || !(widget.form instanceof AbstractSubForm)) return null;
  const currentForm = widget.form as AbstractSubForm;
  if (currentForm.parent instanceof AbstractSubForm) {
    return {
      templateForm: currentForm.parent as AbstractSubForm,
      currentRowForm: currentForm,
    };
  }
  return {
    templateForm: currentForm,
    currentRowForm: null,
  };
};

const getSubFormConditionWidget = (widget: FormElement, uid: string) => {
  const context = getSubFormConditionContext(widget);
  if (!context || !uid) return null;

  const conditionIds = splitConditionWidgetUid(uid);
  if (!conditionIds.length) return null;

  const childUid = conditionIds[conditionIds.length - 1];
  const subFormUid = conditionIds.length > 1 ? conditionIds[0] : context.templateForm.uid;
  if (!childUid || subFormUid !== context.templateForm.uid) return null;

  const templateChild = context.templateForm.getChildElement(childUid);
  if (!templateChild) return null;

  if (!context.currentRowForm) {
    return templateChild;
  }

  return context.currentRowForm.children.find(child => {
    return child.fieldId === templateChild.fieldId || (child as any).originId === childUid;
  }) || null;
};

const getConditionWidget = (widget: FormElement, uid: string) => {
  return getSubFormConditionWidget(widget, uid) || widget.topForm?.getChildElement?.(uid) || null;
};

const isTabConditionWidget = (widget: FormElement | null) => {
  let parent = widget?.parent as unknown as Widget | undefined;
  while (parent) {
    if (parent.type === "widget.form.tabPanel") {
      return true;
    }
    parent = parent.parent as unknown as Widget | undefined;
  }
  return false;
};

const isConditionWidgetVisible = (targetWidget: FormElement | null) => {
  if (!targetWidget) return false;
  if (targetWidget.getOption<boolean>("is-hidden")) {
    return true;
  }
  if (isTabConditionWidget(targetWidget)) {
    return true;
  }
  return !targetWidget.isHidden;
};

const isReadonlyConditionVisible = (widget: FormElement, condition: FormCondition) => {
  return isConditionWidgetVisible(getConditionWidget(widget, condition.uid));
};

const isReadonlyConditionMatched = (widget: FormElement, condition: FormCondition) => {
  const targetWidget = getConditionWidget(widget, condition.uid);
  if (!targetWidget) return false;
  return meetRuleFuncs[condition.func]?.(targetWidget.inputValue, condition.value) ?? false;
};

const isConditionalReadonly = (widget: FormElement) => {
  if (getFieldReadonlyMode(widget) !== "condition") return false;
  const rule = getFieldReadonlyRule(widget);
  if (!rule?.conditions?.length) return false;
  const matcher = rule.logic === LogicalOperator.OR ? "some" : "every";
  return rule.conditions[matcher](condition => {
    if (!condition?.uid) return false;
    return isReadonlyConditionVisible(widget, condition) && isReadonlyConditionMatched(widget, condition);
  });
};

const getFieldRequiredMode = (widget: FormElement): FormRequiredMode => {
  const mode = widget.getOption<FormRequiredMode>(FORM_REQUIRED_MODE_OPTION, { skipDefault: true });
  if (mode) return mode;
  return widget.getOption<boolean>("required", { skipDefault: true }) ? "on" : "off";
};

const getFieldRequiredRule = (widget: FormElement): FilterRule | null => {
  const rule = widget.getOption<FilterRule>(FORM_REQUIRED_RULE_OPTION, { skipDefault: true });
  if (!rule?.conditions?.length) return null;
  return rule;
};

const isRequiredConditionVisible = (widget: FormElement, condition: FormCondition) => {
  return isConditionWidgetVisible(getConditionWidget(widget, condition.uid));
};

const isRequiredConditionMatched = (widget: FormElement, condition: FormCondition) => {
  const targetWidget = getConditionWidget(widget, condition.uid);
  if (!targetWidget) return false;
  return meetRuleFuncs[condition.func]?.(targetWidget.inputValue, condition.value) ?? false;
};

const isConditionalRequired = (widget: FormElement) => {
  if (getFieldRequiredMode(widget) !== "condition") return false;
  const rule = getFieldRequiredRule(widget);
  if (!rule?.conditions?.length) return false;
  const matcher = rule.logic === LogicalOperator.OR ? "some" : "every";
  return rule.conditions[matcher](condition => {
    if (!condition?.uid) return false;
    return isRequiredConditionVisible(widget, condition) && isRequiredConditionMatched(widget, condition);
  });
};

const patchConditionalReadonly = () => {
  const prototype = FormElement.prototype as typeof FormElement.prototype & Record<string, any>;
  if (prototype[FORM_READONLY_PATCH_FLAG]) return;

  let currentPrototype: object | null = FormElement.prototype;
  let descriptor: PropertyDescriptor | undefined;
  while (currentPrototype && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(currentPrototype, "isReadonly");
    currentPrototype = Object.getPrototypeOf(currentPrototype);
  }

  if (!descriptor?.get) return;

  Object.defineProperty(prototype, FORM_READONLY_PATCH_FLAG, {
    value: true,
    configurable: true,
  });

  const originGetter = descriptor.get;
  Object.defineProperty(FormElement.prototype, "isReadonly", {
    configurable: true,
    enumerable: descriptor.enumerable ?? false,
    get() {
      const widget = this as FormElement;
      const baseReadonly = !!originGetter.call(this);
      if (getFieldReadonlyMode(widget) !== "condition") {
        return baseReadonly;
      }
      return baseReadonly || isConditionalReadonly(widget);
    }
  });
};

patchConditionalReadonly();

const patchConditionalRequired = () => {
  const prototype = FormElement.prototype as typeof FormElement.prototype & Record<string, any>;
  if (prototype[FORM_REQUIRED_PATCH_FLAG]) return;

  let currentPrototype: object | null = FormElement.prototype;
  let descriptor: PropertyDescriptor | undefined;
  while (currentPrototype && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(currentPrototype, "isRequired");
    currentPrototype = Object.getPrototypeOf(currentPrototype);
  }

  if (!descriptor?.get) return;

  Object.defineProperty(prototype, FORM_REQUIRED_PATCH_FLAG, {
    value: true,
    configurable: true,
  });

  const originGetter = descriptor.get;
  Object.defineProperty(FormElement.prototype, "isRequired", {
    configurable: true,
    enumerable: descriptor.enumerable ?? false,
    get() {
      const widget = this as FormElement;
      const baseRequired = !!originGetter.call(this);
      const requiredMode = getFieldRequiredMode(widget);
      if (requiredMode !== "condition") {
        return baseRequired;
      }
      return baseRequired || isConditionalRequired(widget);
    }
  });
};

patchConditionalRequired();

type SubSerialNumberCounterSyncItem = {
  widget: SerialNumber;
  tableUID: string;
  fieldId: string;
  counter: SerialNumberCounter;
}

export class Form extends AbstractForm {
  static resource = resource
  private tableDataCache = ref<Record<string, any[]>>({});
  private getTableDataPromise: Record<string, Promise<any[]>> = {};
  private hasWarnedCircularFieldsFilling = false;
  private fieldFillWatchVersions = new Map<string, number>();

  private passportState = usePassportStore();

  private getDataOwnerMemberFieldWidgets() {
    return (this.container.getChildWidgets(true) as FormElement[])
      .filter(element => !element.isInSubForm && element.type === "widget.form.memberSelect");
  }

  private getSelectableDataOwnerMemberFieldWidgets() {
    return this.getDataOwnerMemberFieldWidgets().filter(element => (element as any).isMultiple !== true);
  }

  private getDataOwnerFieldWidget(fieldUid?: string) {
    if (!fieldUid) {
      return undefined;
    }
    return this.getDataOwnerMemberFieldWidgets().find((element: any) => element?.uid === fieldUid);
  }

  private getDataOwnerFieldLabel(element?: FormElement) {
    return element?.title || element?.defaultName || element?.uid || "";
  }

  private getDataOwnerFieldChoices() {
    return this.getSelectableDataOwnerMemberFieldWidgets().map(element => ({
      label: this.getDataOwnerFieldLabel(element),
      value: element.uid,
    }));
  }

  private getInvalidDataOwnerFieldChoice() {
    const fieldUid = this.getOption<string>("data-owner-field");
    const field = this.getDataOwnerFieldWidget(fieldUid);
    if (!field || (field as any).isMultiple !== true) {
      return null;
    }
    return {
      label: `${this.getDataOwnerFieldLabel(field)}${getDataOwnerInvalidFieldSuffix()}`,
      value: field.uid,
      disabled: true,
    };
  }

  private getSubSerialNumberWidgets() {
    return this.children
      .filter(widget => widget.type === "widget.form.subform")
      .flatMap(widget => (widget as SubForm).children.filter(child => child.type === "widget.form.serialNumber") as unknown as SerialNumber[]);
  }

  private getSubSerialNumberCounterColumns() {
    return this.getSubSerialNumberWidgets().map((widget) => {
      const subForm = widget.form as SubForm;
      return {
        uid: getSubSerialNumberCounterFieldId(widget.uid),
        name: getSubSerialNumberCounterFieldName(widget.uid),
        alias: `${subForm?.title || subForm?.name || i18next.t("subformLabel")}-${widget.title || widget.defaultName}-${i18next.t("countSuffix")}`,
        type: "object",
        extra: {
          internalField: true,
        },
      };
    });
  }

  private appendSubSerialNumberCounters(row: Record<string, any>) {
    const currentRow = this.getRow() ?? {};
    for (const widget of this.getSubSerialNumberWidgets()) {
      if (!widget.resetOnSubmit) continue;

      const fieldId = widget.subSerialNumberCounterRowFieldId;
      const legacyFieldId = getSubSerialNumberCounterFieldId(widget.uid);
      const counter = currentRow[fieldId] ?? currentRow[legacyFieldId];
      if (counter === undefined) continue;

      row[fieldId] = deepClone(counter);
    }
    return row;
  }

  private getSubSerialNumberCounterSyncItems() {
    const currentRow = this.getRow() ?? {};
    const counters: SubSerialNumberCounterSyncItem[] = [];

    for (const widget of this.getSubSerialNumberWidgets()) {
      if (widget.resetOnSubmit) continue;

      const counterFieldId = widget.subSerialNumberCounterRowFieldId;
      const legacyFieldId = getSubSerialNumberCounterFieldId(widget.uid);
      const counter = currentRow[counterFieldId] ?? currentRow[legacyFieldId];
      const tableUID = widget.subSerialNumberTableId;
      const fieldId = widget.subSerialNumberFieldId;
      if (!counter || counter.count === undefined || !tableUID || !fieldId) continue;

      counters.push({
        widget,
        tableUID,
        fieldId,
        counter: deepClone(counter),
      });
    }

    return counters;
  }

  private async saveSubSerialNumberCounters(counterItems: SubSerialNumberCounterSyncItem[]) {
    if (!counterItems.length || !this.getBoard().nocodeId) return;

    await axios.post("/project/save-sub-serial-number-counters", {
      nocodeId: this.getBoard().nocodeId,
      counters: counterItems.map(item => ({
        tableUID: item.tableUID,
        fieldId: item.fieldId,
        counter: item.counter,
      })),
    }, { baseURL: "" });
  }

  private syncSubSerialNumberCounters(counterItems: SubSerialNumberCounterSyncItem[]) {
    for (const item of counterItems) {
      item.widget.handleSubSerialNumberSubmitSuccess(item.counter);
    }
  }

  private clearSubSerialNumberCounterCache() {
    const currentRow = this.getRow();
    if (!currentRow) return;

    for (const widget of this.getSubSerialNumberWidgets()) {
      delete currentRow[widget.subSerialNumberCounterRowFieldId];
      delete currentRow[getSubSerialNumberCounterFieldId(widget.uid)];
    }
  }

  override async submit(options?: { skipSubmitValidationNoticeConfirm?: boolean; preparedRow?: Record<string, any> | null }) {
    const isAddingRow = this.isAddingRow;
    const counterItems = this.getSubSerialNumberCounterSyncItems();

    const res = await super.submit(options);

    if (!res) {
      return res;
    }

    if (!isEmpty(counterItems)) {
      let saveSuccess = true;
      await this.saveSubSerialNumberCounters(counterItems).catch((err) => {
        saveSuccess = false;
        console.error("save sub serial number counters failed", err);
      });
      if (saveSuccess) {
        this.syncSubSerialNumberCounters(counterItems);
      }
    }

    if (isAddingRow) {
      this.clearSubSerialNumberCounterCache();
    }
    this.clearTableDataCache();

    return res;
  }

  initAfterConstructor() {
    super.initAfterConstructor();

    //为了强制在options中带上这三个设置项的默认值
    const visiablePermission = this.getOption("visiable", {skipDefault: true});
    if (!visiablePermission) {
      this.setOption("visiable", VisiblePermissionDefault, false);
    }
    const editablePermission = this.getOption("editable", {skipDefault: true});
    if (!editablePermission) {
      this.setOption("editable", EditablePermissionDefault, false);
    }
    const deleteablePermission = this.getOption("deleteable", {skipDefault: true});
    if (!deleteablePermission) {
      this.setOption("deleteable", DeleteAblePermissionDefault, false);
    }
    const dataOwnerSetting = this.getOption<{
      type?: string;
      fieldUid?: string;
      fieldUID?: string;
    } | string>("data-owner", { skipDefault: true });
    if (!dataOwnerSetting) {
      this.setOption("data-owner", DATA_OWNER_SETTING_SUBMITTER, false);
    } else if (typeof dataOwnerSetting === "object") {
      const fieldUid = dataOwnerSetting.fieldUid || dataOwnerSetting.fieldUID || "";
      const dataOwnerType = dataOwnerSetting.type
        || (fieldUid ? DATA_OWNER_SETTING_FORM_FIELD : DATA_OWNER_SETTING_SUBMITTER);
      this.setOption("data-owner", dataOwnerType, false);
      if (fieldUid) {
        this.setOption("data-owner-field", fieldUid, false);
      }
    }

    if (!this.isEditable) {
      this.watchFieldsFill();
    }
  }

  async getTableData(tableUID: OptionTableUID, options: QueryOptions={}): Promise<any[]> {
    const key = `${tableUID[1]}-${md5(JSON.stringify(options))}`;
    if (this.tableDataCache.value[key]) {
      return this.tableDataCache.value[key];
    }
    if (this.getTableDataPromise[key]) return this.getTableDataPromise[key];
    this.getTableDataPromise[key] = new Promise(async (resolve) => {
      const data = await this.getData().getPagingRows(tableUID, options).catch(() => null);
      let rows = [];
      if (data) {
        rows = data?.rows;
        this.tableDataCache.value[key] = rows;
      }
      delete this.getTableDataPromise[key];
      resolve(rows);
    })
    return this.getTableDataPromise[key];
  }

  public clearTableDataCache() {
    this.tableDataCache.value = {};
    this.getTableDataPromise = {};
    this.forceWatch.value = !this.forceWatch.value;
  }

  async canViewLayer(layerId: string) {
    return this.canViewLayerSync(layerId);
  }

  canViewLayerSync(layerId: string) {
    return canViewLayerByContext((this.getBoard() as any)?.projectContext?.pagePermissionContext, layerId);
  }

  async canReadLayerData(layerId: string) {
    return this.canReadLayerDataSync(layerId);
  }

  canReadLayerDataSync(layerId: string) {
    return canReadLayerDataByContext((this.getBoard() as any)?.projectContext?.pagePermissionContext, layerId);
  }

  async waitForViewableLayersPrefetch() {
    return;
  }

  private watchFieldsFill() {
    this.effectScope.run(() => {
      for (const rule of this.runnableFieldsFilling) {
        // 子表子字段联动改为逐行执行，这里跳过顶层整表 watcher，避免按整列取值后串改所有行。
        if (this.isSubFormRowFillRule(rule)) continue;
        this.watchFieldFill(rule);
      }
    });
  }

  private isSubFormRowFillRule(rule: FormLinkageRule) {
    return (rule.fillWidgets || []).some(item => item.fillWidget && item.linkageSubFields?.length);
  }

  private isSubFormRowLinkageFillItem(rule: FormLinkageRule, item: FormLinkageRule["fillWidgets"][number]) {
    if (!item.fillWidget || !item.linkageSubFields?.length) return false;
    const targetWidget = this.getChildElement(item.fillWidget);
    if (!isSubForm(targetWidget) || targetWidget.dataOrigin !== "multiple") return false;
    return (rule.conditions || []).some(condition => {
      if (condition.type !== FormConditionValueType.FORM) return false;
      const [subFormUID, subWidgetUID] = condition.value?.split(".") || [];
      return !!subWidgetUID && subFormUID === item.fillWidget;
    });
  }

  private getMainFormLinkageFillWidgets(rule: FormLinkageRule) {
    return (rule.fillWidgets || []).filter(item => !this.isSubFormRowLinkageFillItem(rule, item));
  }

  /** 「选项来自联动结果」的下拉：选项只能在 onFillData 时写入 */
  private isDataFillWidget(widgetUid?: string) {
    const widget = widgetUid ? this.getChildElement(widgetUid) : null;
    return isSelect(widget) && widget.isDataFill;
  }

  private getFieldsFillValue(value: string) {
    const widgetIds = value?.split(".") || [];
    if (widgetIds.length > 1) {
      const widget = this.getChildElement(widgetIds[0]) as SubForm;
      if (!isSubForm(widget)) return;
      const subWidget = widget?.form?.getChildElement(widgetIds[1]);
      if (!subWidget) return;
      const values = widget.inputValue?.map(i => i[subWidget.fieldId]).filter(i => i !== undefined && i !== null && i !== "");
      if (!values?.length) return;
      return values.length === 1 ? values[0] : values;
    }
    const widget = this.getChildElement(value);
    return widget?.inputValue;
  }

  private getFieldsFillLastChangeTime(value: string) {
    const widgetIds = value?.split(".") || [];
    if (widgetIds.length > 1) {
      const widget = this.getChildElement(widgetIds[0]) as SubForm;
      if (!isSubForm(widget)) return;
      const subWidget = widget?.form?.getChildElement(widgetIds[1]);
      if (!subWidget) return;
      return widget.tableData?.map(i => i.children.find(f => f.fieldId === subWidget.fieldId)?.status.lastChangeTime).filter(Boolean);
    }
    const widget = this.getChildElement(value);
    return widget?.status?.lastChangeTime;
  }

  private transformFieldsFillCondition(condition: FormCondition) {
    const { uid, func, fixedValue, type } = condition;
    if (type === FormConditionValueType.FORM && Array.isArray(fixedValue)) {
      const value = fixedValue.filter(i => i !== undefined && i !== null && i !== "");
      if (!value.length) return;
      if (func === RuleFunc.EQUAL) {
        return transformCondition({ uid, func: RuleFunc.IN, value });
      }
      if (func === RuleFunc.NOT_EQUAL) {
        return transformCondition({ uid, func: RuleFunc.NOT_IN, value });
      }
      return transformCondition({ uid, func, value });
    }
    return transformCondition({ uid, func, value: fixedValue });
  }

  private watchFieldFill(rule: FormLinkageRule) {
    const watchKey = rule.id || md5(JSON.stringify(rule));
    watch(
      () => {
        // 收集所有条件字段的值
        return {
          value:rule.conditions.reduce<Record<string, any>>((prev, item) => {
            prev[item.id] = this.getFieldsFillValue(item.value);
            // 根据关联表单的数据进行筛选
            if (item.comparisonOfForm && item.comparisonOfForm === SelectIdOfForm.LINKAGE) {
              let allRelatedForms = this.children.filter(child => child.getSoul().type === "widget.form.relatedData").filter((r: any) => {
                const relatedTable = this.getTable(r.connectionTable);
                if (relatedTable.fields.find(f => f.uid === item.value)) return r;
              });
              const relatedValues = ref([])
              for(const [index, relatedData] of allRelatedForms.entries()) {
                // 只会与关联表单的主表字段值进行筛选
                relatedValues.value[index] = (relatedData as any).getValue(item.value);
              }

              prev[item.id] = [...new Set(relatedValues.value.flat())];
            }
            return prev;
          }, {}),
          trigger: this.forceWatch.value,
          lastChangeTime: rule.conditions.reduce<Record<string, any>>((prev, item) => {
            const lastChangeTime = this.getFieldsFillLastChangeTime(item.value);
            if (!lastChangeTime) return prev;
            prev[item.id] = lastChangeTime;
            return prev;
          }, {}),
        }
      },
      async ({value, lastChangeTime}, {value: lastValue, lastChangeTime: lastLastChangeTime}) => {
        if (this.isViewing) return;
        if (!value) return;
        const isEditInitWithoutChange =
          this.getBoard().formMode === FormMode.Edit &&
          !Object.values(lastChangeTime || {}).flat(Infinity).filter(Boolean).length;
        // 编辑打开时的数据回显不是用户改动条件字段，不触发联动填充；
        // 只有「选项来自联动结果」的下拉需要借这次初始化刷新选项。
        const hasDataFillTarget = isEditInitWithoutChange
          && this.getMainFormLinkageFillWidgets(rule).some(item => this.isDataFillWidget(item.fillWidget));
        let isChange = false
        // 条件中有空值时不进行填充
        for (const key in value) {
          const type = rule.conditions.find(c => c.id === key)?.type;
          if (value[key] === undefined && type === FormConditionValueType.FORM) return;
          const valueIsEqual = equals(value[key], lastValue[key])
          const timeIsEqual = equals(lastChangeTime[key], lastLastChangeTime[key])
          const shouldTriggerEditInit =
            hasDataFillTarget
            && value[key] !== undefined
            && !valueIsEqual;
          if((this.getBoard().formMode === FormMode.Add && !valueIsEqual) || shouldTriggerEditInit || !timeIsEqual) {
            isChange = true;
          }
        }

        if (!isChange) return;
        const fillWidgets = this.getMainFormLinkageFillWidgets(rule);
        if (!fillWidgets.length) return;
        const watchVersion = (this.fieldFillWatchVersions.get(watchKey) || 0) + 1;
        this.fieldFillWatchVersions.set(watchKey, watchVersion);

        // 构建查询条件
        const cond = rule.conditions.map(c => {
          // 运行时条件不能直接回写到规则对象，否则后续其他 watcher 会读到被污染的 fixedValue。
          const nextCondition = deepClone(c);
          if (nextCondition.type === FormConditionValueType.FORM) {
            nextCondition.fixedValue = value[nextCondition.id];
          }
          return nextCondition;
        })

        if (!cond.length) return;
        const queryConditions = cond.map(c => this.transformFieldsFillCondition(c)).filter(item => item);
        if (!queryConditions.length) return;
        const [connectionUID, linkTableUID] = rule.linkageTable;
        const logicKey = rule.logic === LogicalOperator.AND ? "$and" : "$or";
        const queryParts: any[] = [{ [logicKey]: queryConditions }];
        let query: WhereCondition = queryParts.length > 1 ? { $and: queryParts } : queryParts[0];

        const isSubTableChanged = () => {
          const _table = this.getTable(rule.linkageTable)
          if(!_table) return false;
          return !isEmpty(_table.meta?.extra?.primaryTable)
        }
        if(isSubTableChanged()) {
          const subTableFilterConditions = rule.subTableSetting?.conditions?.reduce<Record<string, any>>((prev, item) => {
            prev[item.uid] = this.getFieldsFillValue(item.value);
            // 根据关联表单的数据进行筛选
            if (item.comparisonOfForm && item.comparisonOfForm === SelectIdOfForm.LINKAGE) {
              let allRelatedForms = this.children.filter(child => child.getSoul().type === "widget.form.relatedData").filter((r: any) => {
                const relatedTable = this.getTable(r.connectionTable);
                if (relatedTable.fields.find(f => f.uid === item.value)) return r;
              });
              const relatedValues = ref([])
              for(const [index, relatedData] of allRelatedForms.entries()) {
                // 只会与关联表单的主表字段值进行筛选
                relatedValues.value[index] = (relatedData as any).getValue(item.value);
              }

              prev[item.uid] = [...new Set(relatedValues.value.flat())];
            }
            return prev;
          }, {})
          const primaryTablePath = this.getTable(rule.linkageTable).meta?.extra?.primaryTable
          const primaryTable = this.getTable(primaryTablePath)
          const primaryKeyField = getUUIDSystemField(primaryTable.fields)
          const filters = {
            [primaryTable.uid]: [subTableFilterConditions],
          }
          const options = {
            nocodeId: this.getBoard().nocodeId,
            tableUID: primaryTable.uid,
            columnId: primaryKeyField.uid,
            options: {
              filters
            }
          }
          const distinct = await fetchDistinct(options, axios, { baseURL: "" });
          const keyField = this.getTable(rule.linkageTable).fields.find(f => f.meta?.name === SystemField.KEY)
          query = {
            $and: [
              query,
              { [keyField.uid]: distinct || [] }
            ]
          }
        }

        let options: QueryOptions = {
          filters: { [linkTableUID]: [query] },
        };

        // 获取目标表数量?
        const rows = await this.getTableData(rule.linkageTable, options) || []
        if (this.fieldFillWatchVersions.get(watchKey) !== watchVersion) return;

        // 遍历需要填充的控件
        for (const item of fillWidgets) {
          if(item.linkageSubFields?.length) {
            for(const itemField of item.linkageSubFields) {
              await this.fillWidget(item, rows, rule.linkageTable, [item.fillWidget, itemField.fillWidget], isEditInitWithoutChange);
            }
          }
          await this.fillWidget(item, rows, rule.linkageTable, [item.fillWidget], isEditInitWithoutChange);
        }
      },
      { deep: true }
    );
  }

  /**
   * 填充控件
   */
  private async fillWidget(item, rows: any[], linkageTableUID, ids, skipClearOnEmpty = false) {
    const widgetIds = ids;
    const targetWidget = this.getChildElement(item.fillWidget) as any;
    if (isSubForm(targetWidget) && targetWidget.dataOrigin === "multiple") {
      return;
    }
    if (widgetIds.length > 1) {
      // 嵌套字段填充
      await this.fillNestedFieldWidget(item, rows, linkageTableUID, widgetIds, skipClearOnEmpty);
      return;
    }

    // 当前表单字段填充联动表单的子表单的值
    const linkageWidgetIds = item.linkageField?.split(".");
    if (!linkageWidgetIds && item.linkageSubFields) {
      return;
    }
    if (widgetIds.length === 1 && linkageWidgetIds.length > 1) {
      await this.fillLinkageSubFieldWidget(item, rows, linkageTableUID, skipClearOnEmpty);
      return;
    }


    const widget = this.getChildElement(item.fillWidget);
    if (!widget) return;
    if(rows.length === 0 && !skipClearOnEmpty) {
      widget.clearValue();
    };
    if (skipClearOnEmpty && isSubForm(widget)) {
      return;
    }

    if (isSubForm(widget)) {
      await this.fillSubFormWidget(widget, item, rows, linkageTableUID);
    } else {
      await this.fillNormalWidget(widget, item, rows, linkageTableUID, skipClearOnEmpty);
    }
  }

  private isAllowFillWidget(widget, linkageSubFields) {
    if(widget.dataOrigin != "multiple") return true;
    if(isEmpty(linkageSubFields)) return true;

    const multipleRules = (widget.getOption('data-fill-rules') as DataFillRule)?.fillWidgets?.map(item => item.fillWidget) || [];
    if(multipleRules.length === 0) return true;

    const subWidgets = linkageSubFields.map(f => f.fillWidget);
    const set = new Set(subWidgets);

    return !multipleRules.some(r => set.has(r))
  }

  /**
   * 填充子表单控件
   */
  private async fillSubFormWidget(widget: any, item, rows: any[], linkageTableUID) {
    if(widget.dataOrigin === "multiple") return
    if(!this.isAllowFillWidget(widget, item.linkageSubFields || [])) return
    const table = this.getTable(linkageTableUID);
    const uuidField = getUUIDSystemField(table.fields);
    const uuid = rows?.[0]?.[uuidField.uid];
    if (!uuid) return;

    const subFormField = table.fields.find(f => f.uid === item.linkageField);
    const tableUID = subFormField?.meta?.extra?.subTableUID;
    if (!tableUID) return;

    const allRelationRows = await this.getTableData(tableUID);
    const relationRows = allRelationRows.filter(r => Object.values(r).includes(uuid));

    const fillRows = relationRows.map(r => {
      const row: Record<string, any> = {};
      for (const subItem of item.linkageSubFields || []) {
        const subWidget = widget.topForm.getChildElement(subItem.fillWidget);
        if (subWidget) {
          row[subWidget.fieldId] = r[subItem.linkageField];
        }
      }
      return row;
    });

    widget.trySetInputValue(fillRows);
  }

  /**
   * 填充嵌套字段控件 (field.subField)
   */
  private fillSubFormFieldWidget(widget: SubForm, childId: string, value: any, clear = false) {
    const child = this.getChildElement(childId)
    if (!child) return;
    for (const [key, row] of widget.getSubFormRowMap()) {
      const rowData = widget.inputValue?.find(i => i[UUID] === key);
      const subWidget = row.children.find(c => c.fieldId === child.fieldId);
      if(!isSelect(subWidget)) {
        const fillValue = clear ? undefined : value;
        if (rowData) rowData[child.fieldId] = fillValue;
        if (subWidget) subWidget.inputValue = fillValue;
      }
    }
  }

  private async fillNestedFieldWidget(item, rows: any[], linkageTableUID, widgetIds, skipClearOnEmpty = false) {
    const widget = this.getChildElement(item.fillWidget) as SubForm;
    if (!widget) return;
    if (skipClearOnEmpty) return;
    if(rows.length === 0 && !skipClearOnEmpty) {
      this.fillSubFormFieldWidget(widget, widgetIds[1], undefined, true);
    };
    if(rows.length === 0) return;
    const index = item.linkageSubFields?.findIndex(f => f.fillWidget === widgetIds[1]);
    if (index === -1) return;
    const linkageField = item.linkageSubFields[index]?.linkageField;
    const ids = linkageField?.split(".");
    if (!ids) return;
    if (ids.length < 2) {
      this.fillSubFormFieldWidget(widget, widgetIds[1], rows?.[0]?.[linkageField]);
      return;
    }

    const table = this.getTable(linkageTableUID);
    const field = table.fields.find(f => f.uid === ids[0]);
    const uuidField = getUUIDSystemField(table.fields);
    const uuid = rows?.[0]?.[uuidField.uid];
    if (!field || !uuid) return;

    const subTableUID = field?.meta?.extra?.subTableUID;
    if (!subTableUID) return;

    const allSubTableRows = await this.getTableData(subTableUID);
    const subTableRows = allSubTableRows.filter(r => Object.values(r).includes(uuid));
    // 这里的subTableRows的数据是从后往前取的， 所以取最后一个数据
    this.fillSubFormFieldWidget(widget, widgetIds[1], subTableRows?.at(-1)?.[ids[1]]);
  }

  // 当前表单字段填充联动表单的子表单的值
  private async fillLinkageSubFieldWidget(item, rows: any[], linkageTableUID, skipClearOnEmpty = false) {
    const widget = this.getChildElement(item.fillWidget);
    if (!widget) return;

    if(rows.length === 0 && !skipClearOnEmpty) {
      widget.clearValue();
    };

    const ids = item.linkageField?.split(".");
    if (!ids || ids.length < 2) return;

    const table = this.getTable(linkageTableUID);
    const field = table.fields.find(f => f.uid === ids[0]);

    const uuidField = getUUIDSystemField(table.fields);
    const uuid = rows?.[0]?.[uuidField.uid];
    if (!field || !uuid) return;

    const subTableUID = field?.meta?.extra?.subTableUID;
    if (!subTableUID) return;

    const allSubTableRows = await this.getTableData(subTableUID);
    const subTableRows = allSubTableRows.filter(r => Object.values(r).includes(uuid));

    const rowData = subTableRows ? subTableRows.map(rowItem => rowItem[ids[1]]) : [];
    if (isSelect(widget)) {
      // 编辑初始化只用于刷新「选项来自联动结果」下拉的选项，不改变字段值
      if (skipClearOnEmpty && !this.isDataFillWidget(item.fillWidget)) return;
      if (skipClearOnEmpty && rowData.every(value => value === undefined || value === null || value === "")) return;
      // 选择时填充到选项
      (widget as any).onFillData(rowData);
    } else {
      // 其余则填充到inputValue
      if (skipClearOnEmpty) return;
      widget.trySetInputValue(subTableRows?.[0]?.[ids[1]]);
    }
  }

  /**
   * 填充普通控件
   */
  private async fillNormalWidget(widget: any, item, rows: any[], linkageTableUID, skipClearOnEmpty = false) {
    if (isSelect(widget)) {
      // 编辑初始化只用于刷新「选项来自联动结果」下拉的选项，不改变字段值
      if (skipClearOnEmpty && !this.isDataFillWidget(item.fillWidget)) return;
      const data = rows.map(row => row[item.linkageField]);
      if (skipClearOnEmpty && data.every(value => value === undefined || value === null || value === "")) return;
      widget.onFillData(data);
    } else {
      if (skipClearOnEmpty) return;
      const value = rows?.[0]?.[item.linkageField];
      widget.trySetInputValue(this.normalizeLinkageFillValue(widget, value));
    }
  }

  private normalizeLinkageFillValue(widget: FormElement, value: any) {
    if (widget?.type !== "widget.form.datePicker") {
      return value;
    }

    return (widget as DatePicker).normalizeInputDateValue(value) ?? value;
  }

  get fieldsFilling(): FormLinkageRule[] {
    return this.getOption("fields-filling") || [];
  }

  get runnableFieldsFilling(): FormLinkageRule[] {
    const circularRuleIndexes = getCircularLinkageRuleIndexes(this.fieldsFilling);
    if (circularRuleIndexes.size && !this.hasWarnedCircularFieldsFilling) {
      this.hasWarnedCircularFieldsFilling = true;
      ElMessage.warning(i18next.t("legacyLinkageCycleWarning"));
    }
    return this.fieldsFilling.filter((_, index) => !circularRuleIndexes.has(index));
  }

  get submitValid(): any {
    return this.getOption("submit-valid") || {};
  }

  get settingRelatedFormFill() {
    return this.getOption("setting-related-form-fill");
  }

  getRelatedTablesData() {
    const connections = this.getBoard().getConnections();
    const connection = connections.find(c => c.uid === this.tableUID[0]);
    const table = this.getTable(this.tableUID);
    return getRelatedFields(connection, table);
  }

  private get fieldsVisibleRules () {
    return this.getOption<FormVisibleRule[]>("fields-visible") || [];
  }

  getFieldOptionRule(type: "visible" | "fill", element: FormElement) {
    if (type === "visible") {
      return this.fieldsVisibleRules.filter(r => {
        return (r.conditions[0].uid === element.uid) && (r.conditions.length === 1);
      });
    } else {
      return this.fieldsFilling.find(r => {
        return r.conditions.some(item => {
          return item.value?.split(".").includes(element.uid);
        });
      });
    }
  }
  setFieldOptionRule(type: "visible" | "fill", element: FormElement, value: FormVisibleRule[] | FormLinkageRule) {
    if (type === "visible") {
      const originRules = this.getFieldOptionRule("visible", element) as FormVisibleRule[];
      const rules = value as FormVisibleRule[];
      const addRules = rules.filter(r => !originRules.find(rule => rule.id === r.id));
      const removeRules = originRules.filter(rule => !rules.find(r => r.id === rule.id));
      const updateRules = rules.filter(r => originRules.find(rule => rule.id === r.id));
      let allRules = this.fieldsVisibleRules;

      allRules = allRules.filter(r => !removeRules.find(rule => rule.id === r.id));
      allRules = allRules.map(r => (updateRules.find(rule => rule.id === r.id) || r));
      allRules.push(...addRules);
      this.setOption("fields-visible", allRules);
    } else {
      const rules = this.fieldsFilling;
      if (value) {
        const index = rules.findIndex(r => r.id === (value as FormLinkageRule).id);
        if (index >= 0) {
          rules.splice(index, 1, value as FormLinkageRule);
        } else {
          rules.push(value as FormLinkageRule);
        }
      } else {
        const current = element.getOption<FormLinkageRule>('field-filling');
        if (!current) return;
        const index = rules.findIndex(r => r.id === current.id);
        rules.splice(index, 1);
      }
      this.setOption("fields-filling", rules);
    }
  }

  get dataTitle() {
    const type = this.getOption("data-title");
    if (type === "custom") {
      return this.getOption("data-title-custom");
    }
    const child = (this.container.getChildWidgets(true) as FormElement[]).find(element => {
      if (element.isInSubForm) return false;
      return ["widget.form.textInput", "widget.form.numberInput", "widget.form.radioGroup", "widget.form.treeSelect", "widget.form.serialNumber"].includes(element.type);
    });
    if (child) {
      return `{:${child.uid}}`;
    }
    return null;
  }

  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basicStyle: {
          fold: "always-unfold",
          hideTitle: true,
          children: [
            {
              name: "data-title",
              alias: i18next.t("dataTitleLabel"),
              type: "select(radioGroup)",
              selectChoices: [
                { label: i18next.t("firstFormField"), value: "first-field" },
                { label: i18next.t("custom"), value: "custom" },
              ],
              default: "first-field",
            },
            {
              name: "data-title-custom",
              alias: "",
              type: "dialog",
              dialog: {
                component: CustomDataTitleDialog,
                buttonText: i18next.t("setDataTitle"),
              },
              visible: (widget: Form)=>{
                return widget.getOption<"first-field"|"custom">("data-title") === "custom";
              },
            },
            {
              name: "data-owner",
              alias: i18next.t("dataOwner"),
              type: "select(radioGroup)",
              selectChoices: [
                { label: i18next.t("submitter"), value: DATA_OWNER_SETTING_SUBMITTER },
                { label: i18next.t("fromFormField"), value: DATA_OWNER_SETTING_FORM_FIELD },
              ],
              default: DATA_OWNER_SETTING_SUBMITTER,
              tip: getDataOwnerFieldTip(),
            },
            {
              name: "data-owner-field",
              alias: "",
              type: "select",
              selectChoices: (widget: Form) => {
                const choices = widget.getDataOwnerFieldChoices();
                const invalidChoice = widget.getInvalidDataOwnerFieldChoice();
                if (invalidChoice && !choices.some(item => item.value === invalidChoice.value)) {
                  choices.push(invalidChoice);
                }
                return choices;
              },
              visible: (widget: Form) => {
                const setting = widget.getOption<{
                  type?: string;
                  fieldUid?: string;
                  fieldUID?: string;
                } | string>("data-owner");
                if (typeof setting === "object") {
                  return (setting.type || (setting.fieldUid || setting.fieldUID ? DATA_OWNER_SETTING_FORM_FIELD : "")) === DATA_OWNER_SETTING_FORM_FIELD;
                }
                return setting === DATA_OWNER_SETTING_FORM_FIELD;
              },
            },
            {
              name: "fields-filling",
              alias: i18next.t("linkageFillControl"),
              type: "drawer",
              drawer: {
                component: LinkageRuleList,
                title: i18next.t("linkageFillRules"),
                buttonText: (widget: Form) => {
                  const value = widget.fieldsFilling;
                  return isEmpty(value)
                    ? i18next.t("addLinkageFillRule")
                    : i18next.t("configuredLinkageFillRules", { count: value.length });
                },
                buttonStyle(widget: Form) {
                  const value = widget.fieldsFilling;
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              }
            },
            {
              name: "fields-visible",
              alias: i18next.t("visibilityControl"),
              type: "drawer",
              drawer: {
                component: VisibilityRuleList,
                title: i18next.t("visibilityRulesTitle"),
                buttonText: (widget: Form) => {
                  const value = widget.fieldsVisibleRules;
                  return isEmpty(value)
                    ? i18next.t("addVisibilityRule")
                    : i18next.t("configuredVisibilityRules", { count: value.length });
                },
                buttonStyle(widget: Form) {
                  const value = widget.fieldsVisibleRules;
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              }
            },
            {
              name: "formPermission",
              alias: i18next.t("formPermission"),
              fold: "unfold",
              visible: false,
              children: [
                {
                  name: "visiable",
                  alias: i18next.t("visiblePermission"),
                  type: "select(multiple)",
                  selectChoices: [
                    { value: 'all-members', label: i18next.t("allMembers") },
                    { value: 'manager', label: i18next.t("manager") },
                    { value: 'same-department-users', label: i18next.t("sameDepartmentMembers") },
                    { value: 'all-supervisor-manager', label: i18next.t("allSuperiorManagers") },
                    { value: 'superior-department-members', label: i18next.t("allSuperiorMembers") },
                    { value: 'all-descendant-members', label: i18next.t("allDescendantMembers")},
                    { value: 'creater-self', label: i18next.t("submitterSelf") },
                  ],
                  default: VisiblePermissionDefault,
                },
                {
                  name: "editable",
                  alias: i18next.t("editablePermission"),
                  type: "select(multiple)",
                  selectChoices: [
                    { value: 'all-members', label: i18next.t("allMembers") },
                    { value: 'manager', label: i18next.t("manager") },
                    { value: 'same-department-users', label: i18next.t("sameDepartmentMembers") },
                    { value: 'all-supervisor-manager', label: i18next.t("allSuperiorManagers") },
                    { value: 'superior-department-members', label: i18next.t("allSuperiorMembers") },
                    { value: 'all-descendant-members', label: i18next.t("allDescendantMembers")},
                    { value: 'creater-self', label: i18next.t("submitterSelf") },
                  ],
                  default: EditablePermissionDefault,
                },
                {
                  name: "deleteable",
                  alias: i18next.t("deleteablePermission"),
                  type: "select(multiple)",
                  selectChoices: [
                    { value: 'all-members', label: i18next.t("allMembers") },
                    { value: 'manager', label: i18next.t("manager") },
                    { value: 'same-department-users', label: i18next.t("sameDepartmentMembers") },
                    { value: 'all-supervisor-manager', label: i18next.t("allSuperiorManagers") },
                    { value: 'superior-department-members', label: i18next.t("allSuperiorMembers") },
                    { value: 'all-descendant-members', label: i18next.t("allDescendantMembers")},
                    { value: 'creater-self', label: i18next.t("submitterSelf") },
                  ],
                  default: DeleteAblePermissionDefault,
                },
              ]
            },
            {
              name: "enable-setting-related-form",
              alias: i18next.t("enableRelatedForm"),
              type: "boolean",
              default: false,
            },
            {
              name: "setting-related-form-fill",
              alias: i18next.t("autoFillData"),
              type: "dialog",
              dialog: {
                component: RelatedFormLinkageFillDialog,
                buttonText: (widget: Form) => {
                  const value = widget.settingRelatedFormFill;
                  return isEmpty(value) ? i18next.t("autoFillRuleButton") : i18next.t("autoFillRuleConfigured");
                },
                buttonStyle: (widget: Form) => {
                  const value = widget.settingRelatedFormFill;
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' };
                }
              },
              visible: (widget: Form) => {
                return widget.getOption<boolean>("enable-setting-related-form");
              },
            }
          ],
        },
        validation: {
          alias: i18next.t("validationLabel"),
          fold: "unfold",
          children: [
            {
              name: "submit-valid",
              alias: i18next.t("submitValidation"),
              type: "drawer",
              drawer: {
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/FormValidRule.vue")),
                title: i18next.t("submitValidation"),
                buttonText: (widget: Form) => {
                  const value = widget.submitValid?.validConditions;
                  return isEmpty(value)
                    ? i18next.t("addValidationRule")
                    : i18next.t("configuredValidationRules", { count: value?.length });
                },
                buttonStyle(widget: Form) {
                  const value = widget.submitValid?.validConditions;
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              }
            },
          ],
        }
      }
    }, ...super.defineOptions()];
  }

  protected async validateForm(row: object): Promise<boolean> {
    //TODO
    return true;
  }

  override generateColumns() {
    return [
      ...super.generateColumns(),
      ...this.getSubSerialNumberCounterColumns(),
    ];
  }

  override async prepareSubmitRow() {
    const row = await super.prepareSubmitRow();
    if (!row) return false;

    const nextRow = this.appendSubSerialNumberCounters(row as Record<string, any>);
    return this.isAddingRow ? this.fillDataOwner(nextRow) : nextRow;
  }

  private getCurrentUserId() {
    const account = this.passportState.account;
    return account?.id || account?.uid || "";
  }

  private getDataOwnerFieldValue() {
    const setting = this.getOption<{
      type?: string;
      fieldUid?: string;
      fieldUID?: string;
    } | string>("data-owner");
    const settingType = typeof setting === "object"
      ? (setting?.type || ((setting?.fieldUid || setting?.fieldUID) ? DATA_OWNER_SETTING_FORM_FIELD : DATA_OWNER_SETTING_SUBMITTER))
      : (setting || DATA_OWNER_SETTING_SUBMITTER);
    if (settingType === DATA_OWNER_SETTING_SUBMITTER) {
      return this.getCurrentUserId();
    }

    const fieldUid = typeof setting === "object"
      ? setting.fieldUid || setting.fieldUID || this.getOption<string>("data-owner-field")
      : this.getOption<string>("data-owner-field");
    if (settingType !== DATA_OWNER_SETTING_FORM_FIELD || !fieldUid) {
      return this.getCurrentUserId();
    }

    const field = this.getDataOwnerFieldWidget(fieldUid);
    const value = field?.inputValue;
    if (Array.isArray(value)) {
      return value[0] || this.getCurrentUserId();
    }
    if (value && typeof value === "object") {
      return value.id || this.getCurrentUserId();
    }
    return value || this.getCurrentUserId();
  }

  private fillDataOwner(row: Record<string, any>) {
    const dataOwnerValue = this.getDataOwnerFieldValue();
    if (!dataOwnerValue) {
      return row;
    }

    row[SystemField.DATA_OWNER] = dataOwnerValue;
    return row;
  }

  private getFieldValue(uid: string) {
    const widget = this.getChildElement(uid);
    return widget?.inputValue;
  }

  // 单个条件的计算函数
  private isConditionMet(cond: FormCondition): boolean {
    const fieldValue = this.getFieldValue(cond.uid);
    const targetValue = cond.value;
    return meetRuleFuncs[cond.func]?.(fieldValue, targetValue);
  }

  private controlFieldVisible(cond: FormCondition): boolean {
    const widget = this.getChildElement(cond.uid);
    // 如果组件自身隐藏属性开启，则自己隐藏不影响被控组件隐藏
    if (!widget.getOption<boolean>("is-hidden")) {
      return !widget.isHidden;
    } else {
      return true;
    }
  }

  isChildShow(widget: FormElement) {
    if (this.isEditable) return true;
    if (!this.fieldsVisibleRules) return true;
    const widgetId = widget.uid;

    // 遍历所有规则，找出包含该组件的规则项
    const matchedRules = this.fieldsVisibleRules.filter(rule =>
      rule.widgetIds.includes(widgetId)
    );
    if (isEmpty(matchedRules)) {
      // 没有规则，默认显示
      return true;
    }

    const showRules = matchedRules.filter(rule => rule.visibleType !== VisibleType.HIDE);
    const hideRules = matchedRules.filter(rule => rule.visibleType === VisibleType.HIDE);

    for (const rule of showRules) {
      const result = rule.logic === LogicalOperator.AND
        ? rule.conditions.every(cond => this.isConditionMet(cond) && this.controlFieldVisible(cond))
        : rule.conditions.some(cond => this.isConditionMet(cond) && this.controlFieldVisible(cond));

      if (result) {
        return true;
      }
    }

    for (const rule of hideRules) {
      const result = rule.logic === LogicalOperator.AND
        ? rule.conditions.every(cond => this.isConditionMet(cond) && this.controlFieldVisible(cond))
        : rule.conditions.some(cond => this.isConditionMet(cond) && this.controlFieldVisible(cond));

      if (result) {
        return false;
      }
    }

    return (!isEmpty(showRules) && !isEmpty(hideRules)) ? false : isEmpty(hideRules) ? false : true;
  }

  get defaultName () {
    return i18next.t("defaultName");
  }
}

