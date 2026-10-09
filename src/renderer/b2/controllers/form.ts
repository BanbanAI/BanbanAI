import { Field, FieldType, FormSubmitAllowNoticeMode, FormValidRule, FromSetting, OptionTableUID, Row, Table, TableColumn, WhereCondition } from "@common/types/project";
import { BaseWidget, Widget } from "./widget";
import { isNocodeFormData, getUUIDSystemField, transformCondition, SystemField } from "@common/utils/connection";
import { FieldUID } from "@common/types/project";
import { FormElementConfiguration, RuleFunc, RuleFuncValue, FormCondition } from "@common/types/nocode";
import { funcMap } from "@common/utils/flow";
import { DefinedOptions, GetOptionOptions, FormLinkageRule, LogicalOperator, FormVisibleRule, SelectChoice, SelectIdOfForm, VisibleType } from "../types";
import { Board } from "@renderer/b2/controllers/board";
import { OptionValue, Soul } from "@common/types/project";
import { defineAsyncComponent, Ref, ref, ShallowRef, watch } from "vue";
import { equals, isEmpty } from "@common/utils/object";
import { cloneDeep as deepClone } from "lodash";
import { FieldAuthValue, FilterRule, FormConditionValueType, FormTableRuntime, FormValidateSubmitResult, KeyValue, ViewActionFieldId } from "@common/types/nocode";
import axios from "axios";
import { formDataApi } from "@renderer/utils/api/form-data";
import { ElMessage, ElMessageBox } from "element-plus";
import i18next from "i18next";
// @ts-ignore
import { canReadNocodeTableDataByBody, isPublicDataPermissionBypassedRoute } from "@renderer/views/nocode/utils/data-permission";
// @ts-ignore
import router from "@renderer/router";
import { applyLinkageFillRuleRows, filterCircularLinkageRules } from "@common/utils/linkage-fill";
import { DEFAULT_HIDDEN_FIELD_SUBMIT_MODE, getHiddenFieldSubmitMode, HIDDEN_FIELD_SUBMIT_MODE_OPTION, HIDDEN_FIELD_SUBMIT_SPECIAL_RULES_OPTION, HiddenFieldSubmitMode, normalizeHiddenFieldSubmitSpecialRules } from "@common/utils/hiddenFieldSubmitPolicy";
import {
  applyHiddenFieldSubmitPolicy,
  collectSubmitUniqueChecks,
  type HiddenFieldSubmitContext,
  type RecalculateHiddenFieldOptions,
  type StabilizeHiddenFieldSubmitRowOptions,
  type StabilizeHiddenFieldSubmitRowResult,
} from "../utils/hiddenFieldSubmitRuntime";
import { HiddenFieldSubmitStateStore } from "../utils/hiddenFieldSubmitState";
import { applyManualSubFormRowDefaults } from "../utils/subFormManualRowDefaults";
import { buildElement } from "../utils/element.util";
// @ts-ignore
import { usePassportStore } from "@renderer/stores/passport";
import {
  computed,
  ComputedRef,
  nextTick,
} from "vue";
import { unique } from "@common/utils/unique";

const isUniqueFieldEmpty = (value: any) => isEmpty(value === "" ? null : value);
const UNIQUE_VALIDATION_ERROR_FLAG = "__uniqueValidationErrorFlag";
type SubmitValidationState = {
  valid: boolean;
  hasDuplicateSubmitError: boolean;
  notice: SubmitValidationNotice | null;
}

type SubFieldVisibleRuleGroup = {
  showRules: FormVisibleRule[];
  hideRules: FormVisibleRule[];
};
type SubmitValidationNotice = {
  messages: string[];
  allowNoticeMode: FormSubmitAllowNoticeMode;
}

const isResetOnCopyBlockedByLinkageFill = (widget: FormElement) => {
  if (!widget?.topForm || isSubForm(widget)) return false;
  const fieldsFillRules: FormLinkageRule[] = widget.topForm.getOption("fields-filling") || [];
  return fieldsFillRules.some(rule => {
    return (rule.fillWidgets || []).some(fillWidget => {
      if (fillWidget.fillWidget === widget.uid && !fillWidget.linkageSubFields?.length) {
        return true;
      }
      return !!fillWidget.linkageSubFields?.some(linkageSubField => linkageSubField.fillWidget === widget.uid);
    });
  });
};

const getResetOnCopyDisabledHelperText = (widget: FormElement) => {
  if (!isResetOnCopyBlockedByLinkageFill(widget)) return "";
  return i18next.t("form.resetOnCopyDisabledByLinkageFill");
};

type FormReadonlyMode = "off" | "on" | "condition";
type FormRequiredMode = "off" | "on" | "condition";

const FORM_READONLY_MODE_OPTION = "readonly-mode";
const FORM_READONLY_RULE_OPTION = "field-readonly";
const FORM_REQUIRED_MODE_OPTION = "required-mode";
const FORM_REQUIRED_RULE_OPTION = "field-required";
const CONDITION_WIDGET_SEPARATOR = ".";

const getFieldReadonlyMode = (widget: FormElement): FormReadonlyMode => {
  const mode = widget.getOption<FormReadonlyMode>(FORM_READONLY_MODE_OPTION, { skipDefault: true });
  if (mode) return mode;
  return widget.getOption<boolean>("is-readonly", { skipDefault: true }) ? "on" : "off";
};

const getWidthRatioChoices = (): SelectChoice[] => {
  return [
    { label: "1/10", value: 1 / 10 },
    { label: "1/6", value: 1 / 6 },
    { label: "1/5", value: 1 / 5 },
    { label: "1/4", value: 1 / 4 },
    { label: "1/3", value: 1 / 3 },
    { label: "2/5", value: 2 / 5 },
    { label: "1/2", value: 1 / 2 },
    { label: "2/3", value: 2 / 3 },
    { label: "3/4", value: 3 / 4 },
    { label: i18next.t('form.fullRow'), value: 1 },
  ];
};

const WIDTH_RATIO_MIN_VALUE_MAP: Partial<Record<string, number>> = {
  "widget.form.searchForm": 2 / 5,
  "widget.form.richTextEditor": 1 / 3,
  "widget.form.markdownEditor": 1 / 3,
  "widget.form.multipleTabs": 1 / 3,
};

const getWidthRatioSelectChoices = (widget: FormElement) => {
  const widgetType = widget.getSoul().type;
  const minValue = WIDTH_RATIO_MIN_VALUE_MAP[widgetType];
  const currentValue = widget.getOption<number>("width-ratio", { skipDefault: true });

  return getWidthRatioChoices().map(choice => {
    if (minValue === undefined || typeof choice.value !== "number" || choice.value >= minValue || choice.value === currentValue) {
      return choice;
    }

    return {
      ...choice,
      disabled: true,
    };
  });
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
  return funcMap[condition.func]?.(targetWidget.inputValue, condition.value) ?? false;
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
  return funcMap[condition.func]?.(targetWidget.inputValue, condition.value) ?? false;
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

export abstract class AbstractForm extends BaseWidget {
  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          visible: (widget: Widget)=>{
            return !widget.isFormMode;
          },
          children: [
            {
              name: "container-layout",
              default: "fluid",
            },
            {
              name: "container-layout-fluid",
              children: [
                {
                  name: "fluid-gap-value",
                  default: 20,
                },
                {
                  name: "padding",
                  default: [12, 12, 12, 12],
                },
              ],
            }
          ],
        },
        "widget-title": {
          visible: false,
        },
        cover: {
          visible: (widget: Widget)=>{
            return !widget.isFormMode;
          },
        },
        border: {
          visible: (widget: Widget)=>{
            return !widget.isFormMode;
          },
        },
        background: {
          default: true,
          visible: (widget: Widget)=>{
            return !widget.isFormMode;
          },
          children: [
            {
              name: "background-color",
              default: "#ffffff",
            }
          ],
        },
        hiddenFieldSubmit: {
          get alias() { return i18next.t("hiddenFieldSubmit.groupAlias"); },
          fold: "unfold",
          visible: (widget: Widget)=>{
            return widget.isFormMode;
          },
          children: [
            {
              name: HIDDEN_FIELD_SUBMIT_MODE_OPTION,
              get alias() { return i18next.t("hiddenFieldSubmit.defaultModeAlias"); },
              type: "select",
              default: DEFAULT_HIDDEN_FIELD_SUBMIT_MODE,
              selectChoices: [
                { get label() { return i18next.t("hiddenFieldSubmit.modeRecalculate"); }, value: HiddenFieldSubmitMode.RECALCULATE },
                { get label() { return i18next.t("hiddenFieldSubmit.modeKeepOriginal"); }, value: HiddenFieldSubmitMode.KEEP_ORIGINAL },
                { get label() { return i18next.t("hiddenFieldSubmit.modeEmpty"); }, value: HiddenFieldSubmitMode.EMPTY },
              ],
              async beforeChange(widget: AbstractForm, value: HiddenFieldSubmitMode) {
                if (widget.getOption(HIDDEN_FIELD_SUBMIT_MODE_OPTION) === value) {
                  return false;
                }
                const specialRules = normalizeHiddenFieldSubmitSpecialRules(widget.getOption(HIDDEN_FIELD_SUBMIT_SPECIAL_RULES_OPTION));
                if (isEmpty(specialRules)) {
                  return true;
                }
                try {
                  await ElMessageBox.confirm(
                    i18next.t("hiddenFieldSubmit.changeDefaultModeConfirmContent"),
                    i18next.t("hiddenFieldSubmit.changeDefaultModeConfirmTitle"),
                    {
                      confirmButtonText: i18next.t("hiddenFieldSubmit.confirm"),
                      cancelButtonText: i18next.t("hiddenFieldSubmit.cancel"),
                      type: "warning",
                    },
                  );
                  widget.setOption(HIDDEN_FIELD_SUBMIT_SPECIAL_RULES_OPTION, {}, false);
                  return true;
                } catch {
                  return false;
                }
              },
            },
            {
              name: HIDDEN_FIELD_SUBMIT_SPECIAL_RULES_OPTION,
              get alias() { return i18next.t("hiddenFieldSubmit.specialRulesAlias"); },
              type: "dialog",
              dialog: {
                // @ts-ignore
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/HiddenFieldSubmitSpecialRulesDialog.vue")),
                buttonText(widget: AbstractForm) {
                  const value = normalizeHiddenFieldSubmitSpecialRules(widget.getOption(HIDDEN_FIELD_SUBMIT_SPECIAL_RULES_OPTION));
                  return isEmpty(value)
                    ? i18next.t("hiddenFieldSubmit.addSpecialRules")
                    : i18next.t("hiddenFieldSubmit.specialRulesConfigured");
                },
                buttonStyle(widget: AbstractForm) {
                  const value = normalizeHiddenFieldSubmitSpecialRules(widget.getOption(HIDDEN_FIELD_SUBMIT_SPECIAL_RULES_OPTION));
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' };
                },
              },
            },
          ],
        },
        padding: {
          visible: false
        }
      },
    }, ...super.defineOptions()];
  }

  constructor(soul: Soul, parent: Widget | Board) {
    super(soul, parent);
    this.initContainer();
  }

  get children() {
    return super.children as unknown as FormElement[];
  }

  public forceWatch = ref(false)

  public linkageHighLightWidget = ref(null)
  public visibleHighLightWidget = ref(null)

  public rowId = unique();

  private _tableUID: OptionTableUID;

  get tableUID(): OptionTableUID {
    return this._tableUID;
  }
  setTableUID(uid: OptionTableUID) {
    this._tableUID = uid;
  }

  private _keyField: Field;
  get keyFieldId() {
    return this._keyField?.uid;
  }

  public bindFields(fields: Field[]) {
    this._keyField = getUUIDSystemField(fields);
    for (const formInput of this.formInputs) {
      const field = fields.find(f => f.meta.uid === formInput.uid);
      if (!field) continue;
      formInput.bindField(field);
    }
  }

  setWidgetAuth(
    fieldsAuth: Record<string, FieldAuthValue>,
    permissionFieldsAuth: Record<string, FieldAuthValue> = {},
  ) {
    for (const formInput of this.children as FormElement[]) {
      formInput.setWidgetAuth(fieldsAuth, permissionFieldsAuth);
    }
  }

  setWidgetRequired(requiredFieldsAuth: Record<string, boolean>) {
    for (const formInput of this.children as FormElement[]) {
      formInput.setWidgetRequired(requiredFieldsAuth);
    }
  }

  private _row = ref({});
  setRow(row: object) {
    this._hiddenFieldSubmitState.clear();
    this._row.value = row ?? {};
  }

  getRow() {
    const row = this._row.value;
    if (this.keyFieldId) {
      row[this.keyFieldId] = this.rowId;
    }
    return row;
  }

  private _submitFieldIds: ViewActionFieldId[] = [];
  private _effectiveSubmitFieldIds: ViewActionFieldId[] = [];
  private _recalculateHiddenFieldSubmitValue?: (options: RecalculateHiddenFieldOptions) => Promise<any> | any;
  private _stabilizeHiddenFieldSubmitRow?: (options: StabilizeHiddenFieldSubmitRowOptions) => Promise<StabilizeHiddenFieldSubmitRowResult | void> | StabilizeHiddenFieldSubmitRowResult | void;
  private _hiddenFieldSubmitState = new HiddenFieldSubmitStateStore();
  private _stopHiddenFieldSubmitStateWatch?: () => void;
  private _watchHiddenFieldSubmitisViewing?: () => void;
  private _isRestoringHiddenFieldSubmitValue = false;
  setSubmitFieldIds(fieldIds: ViewActionFieldId[] = []) {
    this._submitFieldIds = Array.from(new Set((fieldIds || []).filter(Boolean)));
    this._effectiveSubmitFieldIds = [];
  }

  setHiddenFieldSubmitRecalculator(recalculator?: (options: RecalculateHiddenFieldOptions) => Promise<any> | any) {
    this._recalculateHiddenFieldSubmitValue = recalculator;
  }

  setHiddenFieldSubmitStabilizer(stabilizer?: (options: StabilizeHiddenFieldSubmitRowOptions) => Promise<StabilizeHiddenFieldSubmitRowResult | void> | StabilizeHiddenFieldSubmitRowResult | void) {
    this._stabilizeHiddenFieldSubmitRow = stabilizer;
  }

  initializeHiddenFieldSubmitState() {
    this._stopHiddenFieldSubmitStateWatch?.();
    this._hiddenFieldSubmitState.clear();
    this._watchHiddenFieldSubmitisViewing?.();
    this._watchHiddenFieldSubmitisViewing = this.effectScope.run(() => watch(
      () => {
        return this.isViewing;
      },
      () => {
        this.initializeHiddenFieldSubmitState();
      }
    ))
    if (this.isViewing) {
      return;
    }
    // 监听页面真实显隐和值变化，使所有现有控件共享同一套快照和冻结语义。
    this._stopHiddenFieldSubmitStateWatch = this.effectScope.run(() => watch(
      () => this.formInputs.map(formInput => ({
        fieldId: formInput.fieldId,
        value: deepClone(formInput.inputValue),
        isBusinessHidden: !!formInput.fieldId && formInput.isHidden && !formInput.isHiddenByFieldPermission,
        mode: getHiddenFieldSubmitMode(this.getSoul().options, formInput.fieldId),
      })).filter(item => !!item.fieldId),
      (inputs) => {
        if (this._isRestoringHiddenFieldSubmitValue) return;
        const restoreActions = this._hiddenFieldSubmitState.sync(inputs);
        if (!restoreActions.length) return;

        this._isRestoringHiddenFieldSubmitValue = true;
        try {
          restoreActions.forEach(({ fieldId, value }) => {
            const formInput = this.formInputs.find(item => item.fieldId === fieldId);
            formInput?.setInputValueNotChanged(deepClone(value));
          });
        } finally {
          this._isRestoringHiddenFieldSubmitValue = false;
        }
      },
      { deep: true, flush: "sync", immediate: true },
    ));
  }

  private captureHiddenFieldSubmitContexts() {
    return this.formInputs.reduce<Record<string, HiddenFieldSubmitContext>>((result, formInput) => {
      const fieldId = formInput.fieldId;
      if (!fieldId) return result;
      const snapshot = this._hiddenFieldSubmitState.getSnapshot(fieldId);
      result[fieldId] = {
        isBusinessHidden: formInput.isHidden && !formInput.isHiddenByFieldPermission,
        isPermissionHidden: formInput.isHiddenByFieldPermission,
        mode: getHiddenFieldSubmitMode(this.getSoul().options, fieldId),
        hasSnapshot: snapshot.hasSnapshot,
        snapshotValue: snapshot.value,
      };
      return result;
    }, {});
  }

  isHiddenFieldSubmitCalculationFrozen(formInput: FormElement) {
    return !!formInput?.fieldId && this._hiddenFieldSubmitState.isFrozen(formInput.fieldId);
  }

  clearHiddenFieldSubmitState() {
    this._hiddenFieldSubmitState.clear();
  }

  getEffectiveSubmitFieldIds() {
    return this._effectiveSubmitFieldIds.length > 0 ? this._effectiveSubmitFieldIds : this._submitFieldIds;
  }

  private filterUpdateRowSystemFields(row: Row, tableUID: OptionTableUID = this.tableUID): Row {
    const systemFieldNames = new Set<string>(Object.values(SystemField));
    const systemFieldIds = new Set<string>(systemFieldNames);
    // UUID and relation keys are required to locate existing sub-form rows during updates.
    const preservedSystemFieldIds = new Set<string>([
      SystemField.UUID,
      SystemField.KEY,
    ]);
    for (const fieldName of systemFieldNames) {
      systemFieldIds.add(`${fieldName}_entity`);
    }
    const table = this.getTable(tableUID);

    for (const field of table?.fields || []) {
      const fieldName = field.meta?.name;
      if (!systemFieldNames.has(fieldName || "")) {
        continue;
      }
      for (const fieldId of [field.uid, field.meta?.uid]) {
        if (!fieldId) continue;
        systemFieldIds.add(fieldId);
        systemFieldIds.add(`${fieldId}_entity`);
        if (fieldName === SystemField.UUID || fieldName === SystemField.KEY) {
          preservedSystemFieldIds.add(fieldId);
        }
      }
    }

    return Object.entries(row || {}).reduce<Row>((result, [fieldId, value]) => {
      const field = table?.fields?.find(item => item.uid === fieldId || item.meta?.uid === fieldId);
      const subTableUID = field?.meta?.extra?.subTableUID as OptionTableUID | undefined;
      if (subTableUID?.[1] && Array.isArray(value)) {
        result[fieldId] = value.map(subRow => this.filterUpdateRowSystemFields(subRow, subTableUID));
      } else if (!systemFieldIds.has(fieldId) || preservedSystemFieldIds.has(fieldId)) {
        result[fieldId] = value;
      }
      return result;
    }, {});
  }

  clearEffectiveSubmitFieldIds() {
    this._effectiveSubmitFieldIds = [];
  }

  getFormInputValue(fieldId: string) {
    return this._row.value?.[fieldId];
  }

  getChildElement(uid: string) {
    return this.container.getChildWidget(uid) as FormElement;
  }

  get isHidden() {
    return !this.status.isVisible;
  }

  /** 所有表单项 */
  get formInputs(): FormElement[] {
    const elements = this.container.getChildWidgets(true, (widget: FormElement)=>{
      return !widget.isInSubForm;
    }) as FormElement[];

    return elements.filter(element => element.isCreateField());
  }

  get allFormInputs() {
    return this.container.getChildWidgets(true) as FormElement[];
  }

  public generateColumns() {
    const columns: TableColumn[] = [];
    for (const formInput of this.formInputs) {
      if (!formInput.isCreateField()) continue;
      const name = getUniqueName(columns, formInput.title);
      const {subType, extra} = formInput.resolveFormSetting() ?? {};
      columns.push({
        name,
        alias: formInput.title,
        uid: formInput.uid,
        type: formInput.fieldType,
        subType,
        extra,
      });
    }
    return columns;
  }

  /** 是否在新增数据 */
  private _isAddingRow?: boolean;
  setAddingRow(value: boolean) {
    this._isAddingRow = value;
  }

  get isAddingRow() {
    return this._isAddingRow ?? !this._row.value?.[this.keyFieldId];
  }

  get dataTitle() {
    return null;
  }

  private _submitValidationNotice = ref<SubmitValidationNotice | null>(null);

  get submitValidationNotice() {
    return this._submitValidationNotice.value;
  }

  clearSubmitValidationNotice(options: { keepEffectiveSubmitFieldIds?: boolean } = {}) {
    this._submitValidationNotice.value = null;
    if (!options.keepEffectiveSubmitFieldIds) {
      this.clearEffectiveSubmitFieldIds();
    }
  }

  private appendSubmitValidationMessages(target: string[], messages: string[] = []) {
    for (const message of messages) {
      const text = String(message || "").trim();
      if (!text || target.includes(text)) continue;
      target.push(text);
    }
    return target;
  }

  private mergeSubmitValidationNotice(current: SubmitValidationNotice | null, result?: FormValidateSubmitResult | null) {
    const messages = this.appendSubmitValidationMessages(current?.messages ? [...current.messages] : [], result?.messages || []);
    if (!messages.length) {
      return current;
    }

    return {
      messages,
      allowNoticeMode: current?.allowNoticeMode === FormSubmitAllowNoticeMode.DIALOG || result?.allowNoticeMode === FormSubmitAllowNoticeMode.DIALOG
        ? FormSubmitAllowNoticeMode.DIALOG
        : FormSubmitAllowNoticeMode.TOAST,
    };
  }

  private getSubmitValidationErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : i18next.t('NocodeForm.formSubmitFail');
  }

  private shouldValidateSubFormSubmit(subForm: AbstractSubForm, subFormValidRule?: FormValidRule) {
    if (!isEmpty(subFormValidRule)) {
      return true;
    }

    return subForm.children.some(child => {
      if (isSubForm(child)) {
        return this.shouldValidateSubFormSubmit(child as AbstractSubForm, child.getOption("submit-valid") as FormValidRule);
      }
      return child.isUnique;
    });
  }

  async validateFormSubmit(row: Row): Promise<SubmitValidationState> {
    this.clearSubmitValidationNotice({ keepEffectiveSubmitFieldIds: true });
    let firstInvalidSubFormTarget: FormElement | null = null;
    let firstErrorMessage: string | null = null;
    let hasInvalidSubmit = false;
    let hasDuplicateSubmitError = false;
    let submitValidationNotice: SubmitValidationNotice | null = null;
    for (const formInput of this.formInputs) {
      if (!isSubForm(formInput)) continue;
      if (formInput.isHidden) continue;

      const subForm = formInput as AbstractSubForm;
      const subformValidRule = subForm.getOption("submit-valid") as FormValidRule;
      if (!this.shouldValidateSubFormSubmit(subForm, subformValidRule)) continue;

      let validSubmit: FormValidateSubmitResult;
      try {
        validSubmit = await formDataApi.validateFormSubmit({
          nocodeId: this.getBoard().nocodeId,
          formValidRule: subformValidRule,
          type: "subform",
          rows: subForm.inputValue,
          tableId: subForm.tableUID[1],
          fullReplace: true,
          fullReplaceRelationValue: this.getFormInputValue(this.keyFieldId),
        });
      } catch (err) {
        ElMessage.error(this.getSubmitValidationErrorMessage(err));
        return {
          valid: false,
          hasDuplicateSubmitError: false,
          notice: null,
        };
      }

      if (!validSubmit?.valid) {
        const invalidTarget = await this.handleSubFormSubmitValidationError(subForm, validSubmit, false);
        firstInvalidSubFormTarget ??= invalidTarget;
        if (validSubmit?.duplicateIssues?.length) {
          hasDuplicateSubmitError = true;
        } else {
          firstErrorMessage ??= validSubmit?.error || i18next.t('form.duplicateFieldTips');
        }
        hasInvalidSubmit = true;
      } else {
        submitValidationNotice = this.mergeSubmitValidationNotice(submitValidationNotice, validSubmit);
      }
    }

    let formValidRule = this.getOption("submit-valid") as FormValidRule;
    if (!isEmpty(formValidRule)) {
      // 过滤掉隐藏的组件
      formValidRule = deepClone(formValidRule);
      formValidRule?.validConditions?.forEach(c => {
        c.conditions = (c.conditions ?? []).filter(condition => {
          const fieldId = condition.uid?.split('.').at(-1)
          const widget = this.formInputs?.find(f => f.fieldId === fieldId);
          if(!widget) return true
          if(widget.isHidden) return false
          return true
        });
      })
    }

    let validSubmit: FormValidateSubmitResult;
    try {
      validSubmit = await formDataApi.validateFormSubmit({
        nocodeId: this.getBoard().nocodeId,
        connectionUID: this.tableUID?.[0],
        tableUID: this.tableUID?.[1],
        formValidRule: isEmpty(formValidRule) ? undefined : formValidRule,
        type: "form",
        row: row,
        originRow: this.getRow(),
      });
    } catch (err) {
      ElMessage.error(this.getSubmitValidationErrorMessage(err));
      return {
        valid: false,
        hasDuplicateSubmitError: false,
        notice: null,
      };
    }

    if (validSubmit && !validSubmit.valid) {
      if (validSubmit?.duplicateIssues?.length) {
        hasDuplicateSubmitError = true;
      } else {
        firstErrorMessage ??= validSubmit.error;
      }
      hasInvalidSubmit = true;
    } else {
      submitValidationNotice = this.mergeSubmitValidationNotice(submitValidationNotice, validSubmit);
    }

    if (hasInvalidSubmit) {
      await firstInvalidSubFormTarget?.intoView();
      ElMessage.error(hasDuplicateSubmitError ? i18next.t('form.duplicateFieldTips') : (firstErrorMessage || i18next.t('form.duplicateFieldTips')));
      return {
        valid: false,
        hasDuplicateSubmitError,
        notice: null,
      };
    }

    this._submitValidationNotice.value = submitValidationNotice;
    return {
      valid: true,
      hasDuplicateSubmitError: false,
      notice: submitValidationNotice,
    };
  }

  serialize() {
    const formInputs = this.formInputs;
    const row = {};
    for (const formInput of formInputs) {
      row[formInput.fieldId] = formInput.inputValue;
    }
    return row;
  }

  async prepareSubmitRow(options: { applyHiddenFieldSubmitPolicy?: boolean } = {}) {
    const { applyHiddenFieldSubmitPolicy: shouldApplyHiddenFieldSubmitPolicy = true } = options;
    this.clearSubmitValidationNotice();
    const row: object = {};
    const workingRow: Row = {};
    for (const formInput of this.formInputs) {
      await formInput.ensureInputValue();
      workingRow[formInput.fieldId] = deepClone(formInput.inputValue);
      if (formInput.isHidden) {
        continue;
      }
      if (isSubForm(formInput)) {
        const isSubFormValid = await this.validateSubFormFields(formInput as AbstractSubForm);
        if (!isSubFormValid) {
          return false;
        }
      } else {
        await formInput.validate();
        if (!formInput.isHidden && formInput.validationError) {
          await this.handleFormInputValidationError(formInput);
          return false;
        }
      }
      if (!formInput.isHidden && formInput.validationError) {
        return false;
      }
      row[formInput.fieldId] = formInput.inputValue;
    }
    if (!shouldApplyHiddenFieldSubmitPolicy) {
      return row;
    }
    const hiddenFieldSubmitResult = await applyHiddenFieldSubmitPolicy({
      formInputs: this.formInputs,
      visibleRow: row as Row,
      workingRow,
      currentRow: this.getRow(),
      formOptions: this.getSoul().options,
      isAddingRow: this.isAddingRow,
      submitFieldIds: this._submitFieldIds,
      hiddenFieldContexts: this.captureHiddenFieldSubmitContexts(),
      recalculateHiddenField: this._recalculateHiddenFieldSubmitValue,
      stabilizeSubmitRow: this._stabilizeHiddenFieldSubmitRow,
    });
    this._effectiveSubmitFieldIds = hiddenFieldSubmitResult.submitFieldIds;
    const submitRow = hiddenFieldSubmitResult.row;
    if (this.isAddingRow && this.keyFieldId && this.getRow()?.[this.keyFieldId]) {
      (submitRow as Row)[this.keyFieldId] = this.getRow()[this.keyFieldId];
    }

    const submitValidation = await this.validateFormSubmit(submitRow as Row);
    if (!submitValidation.valid) {
      this.clearMainFormUniqueValidationErrors();
      this.clearEffectiveSubmitFieldIds();
      return false;
    }
    const isUniqueValid = await this.validateMainFormUniqueFields(submitRow);
    if (!isUniqueValid) {
      this.clearEffectiveSubmitFieldIds();
      return false;
    }
    if (!await this.validateForm(submitRow)) {
      this.clearEffectiveSubmitFieldIds();
      return false;
    }
    return submitRow;
  }

  private async handleFormInputValidationError(formInput: FormElement) {
    await formInput.intoView();
    console.error(formInput.validationError);
    if (formInput.isRequired && formInput.isEmpty()) {
      ElMessage.error(i18next.t('form.requiredFieldTips'));
      return;
    }
    ElMessage.error(formInput.validationError);
  }

  private async validateSubFormFieldTree(subForm: AbstractSubForm): Promise<FormElement | null> {
    subForm.validationError = null as unknown as Error;
    this.clearUniqueValidationError(subForm);

    if (subForm.isHidden) {
      return null;
    }

    if (subForm.isRequired && subForm.isEmpty()) {
      subForm.validationError = new Error(i18next.t('form.fieldRequiredTips'));
      return subForm;
    }

    const subFormRows = this.getSubFormRows(subForm);
    if (!subFormRows.length && this.hasRequiredSubFormSchemaField(subForm)) {
      subForm.validationError = new Error(i18next.t('form.fieldRequiredTips'));
      return subForm;
    }

    for (const subFormRow of subFormRows) {
      for (const subFormInput of subFormRow.children) {
        if (isSubForm(subFormInput)) {
          const invalidTarget = await this.validateSubFormFieldTree(subFormInput as AbstractSubForm);
          if (!invalidTarget) {
            continue;
          }
          subForm.validationError = new Error(subFormInput.validationError || invalidTarget.validationError);
          return invalidTarget;
        }

        this.clearUniqueValidationError(subFormInput);
        await subFormInput.validate();
        if (subFormInput.isHidden || !subFormInput.validationError) {
          continue;
        }
        subForm.validationError = new Error(subFormInput.validationError);
        return subFormInput;
      }
    }

    return null;
  }

  private async validateSubFormFields(subForm: AbstractSubForm) {
    const invalidTarget = await this.validateSubFormFieldTree(subForm);
    if (invalidTarget) {
      await this.handleFormInputValidationError(invalidTarget);
      return false;
    }
    return true;
  }

  private clearUniqueValidationError(formInput: FormElement) {
    if ((formInput as any)[UNIQUE_VALIDATION_ERROR_FLAG]) {
      formInput.validationError = null as unknown as Error;
      delete (formInput as any)[UNIQUE_VALIDATION_ERROR_FLAG];
    }
  }

  private setUniqueValidationError(formInput: FormElement, message: string) {
    formInput.validationError = new Error(message);
    (formInput as any)[UNIQUE_VALIDATION_ERROR_FLAG] = true;
  }

  private getSubFormDuplicateMessage(subFormTitle: string | undefined, fieldTitles: string[]) {
    if (!subFormTitle) {
      return i18next.t('form.subFormDuplicateFieldTips', {
        field: fieldTitles.join(','),
      });
    }

    return i18next.t('form.subFormNamedDuplicateFieldTips', {
      subForm: subFormTitle,
      field: fieldTitles.join(','),
    });
  }

  private getDuplicateToastMessage(result: FormValidateSubmitResult) {
    if (result?.duplicateIssues?.length) {
      return i18next.t('form.duplicateFieldTips');
    }
    return null;
  }

  private getSubFormRows(subForm: AbstractSubForm) {
    return ((subForm as any).tableData ?? []) as SubFormRow[];
  }

  private hasRequiredSubFormSchemaField(subForm: AbstractSubForm): boolean {
    return (subForm.children || []).some(child => {
      if (child.isHidden) {
        return false;
      }
      if (child.isRequired) {
        return true;
      }
      return isSubForm(child) && this.hasRequiredSubFormSchemaField(child as AbstractSubForm);
    });
  }

  private buildMergedSubFormPatchRows(subForm: AbstractSubForm, nextRows: Row[] = []) {
    const subFormRows = this.getSubFormRows(subForm);
    return (nextRows || []).map((nextRow, index) => {
      const subFormRow = subFormRows[index];
      const mergedRow: Row = {
        ...deepClone(subFormRow?.getRow() ?? {}),
        ...deepClone(nextRow ?? {}),
      };

      for (const child of subFormRow?.children || []) {
        if (!isSubForm(child) || !Array.isArray(nextRow?.[child.fieldId])) {
          continue;
        }
        mergedRow[child.fieldId] = this.buildMergedSubFormPatchRows(child as AbstractSubForm, nextRow[child.fieldId]);
      }

      return mergedRow;
    });
  }

  private buildSubmitPatchFieldValue(fieldId: string, nextValue: any) {
    if (!Array.isArray(nextValue)) {
      return deepClone(nextValue);
    }

    const subForm = this.formInputs.find(formInput => formInput.fieldId === fieldId && isSubForm(formInput)) as AbstractSubForm | undefined;
    if (!subForm) {
      return deepClone(nextValue);
    }

    return this.buildMergedSubFormPatchRows(subForm, nextValue);
  }

  private getRowFieldValue(row: Row | undefined, field?: Field) {
    for (const fieldId of [field?.uid, field?.meta?.uid, field?.meta?.name]) {
      if (fieldId && Object.prototype.hasOwnProperty.call(row || {}, fieldId)) {
        return row[fieldId];
      }
    }
    return undefined;
  }

  private getSubFormRowIdentity(row: Row | undefined, tableUID: OptionTableUID) {
    const table = this.getTable(tableUID);
    const uuidField = getUUIDSystemField(table?.fields || []);
    for (const fieldId of [uuidField?.uid, uuidField?.meta?.uid, SystemField.UUID, "__uuid__"]) {
      const value = fieldId ? row?.[fieldId] : undefined;
      if (value !== undefined && value !== null && value !== "") {
        return String(value);
      }
    }
    return undefined;
  }

  private collectChangedSubFormFieldIds(
    subForm: AbstractSubForm,
    nextRows: Row[],
    previousRows: Row[],
    fieldId: ViewActionFieldId,
  ) {
    if (!Array.isArray(previousRows) || nextRows.length !== previousRows.length) {
      return [fieldId];
    }

    const tableUID = subForm.tableUID;
    const table = this.getTable(tableUID);
    const formRows = this.getSubFormRows(subForm);
    const previousRowsByIdentity = new Map(previousRows.map(row => [
      this.getSubFormRowIdentity(row, tableUID),
      row,
    ]));
    const changedFieldIds = new Set<ViewActionFieldId>();

    for (const [index, inputRow] of nextRows.entries()) {
      const nextRow = {
        ...deepClone(formRows[index]?.getRow() || {}),
        ...inputRow,
      };
      const identity = this.getSubFormRowIdentity(nextRow, tableUID);
      if (!identity && this.getSubFormRowIdentity(previousRows[index], tableUID)) {
        return [fieldId];
      }
      const previousRow = identity ? previousRowsByIdentity.get(identity) : previousRows[index];
      if (!previousRow) {
        return [fieldId];
      }

      for (const [subFieldId, nextValue] of Object.entries(inputRow || {})) {
        const field = table?.fields?.find(item => item.uid === subFieldId || item.meta?.uid === subFieldId);
        if (!field || field.meta?.name === SystemField.UUID || field.meta?.name === SystemField.KEY) {
          continue;
        }
        if (!equals(nextValue, this.getRowFieldValue(previousRow, field))) {
          changedFieldIds.add(`${fieldId}.${field.uid}` as ViewActionFieldId);
        }
      }
    }

    return [...changedFieldIds];
  }

  private collectChangedSubmitFieldIds(row: Row, currentRow: Row) {
    const table = this.getTable(this.tableUID);
    const changedFieldIds = Object.entries(row || {}).reduce<ViewActionFieldId[]>((fieldIds, [fieldId, nextValue]) => {
      const field = table?.fields?.find(item => item.uid === fieldId || item.meta?.uid === fieldId);
      const canonicalFieldId = (field?.uid || fieldId) as ViewActionFieldId;
      const subForm = this.formInputs.find(item => item.fieldId === canonicalFieldId && isSubForm(item)) as AbstractSubForm | undefined;
      if (subForm && Array.isArray(nextValue)) {
        fieldIds.push(...this.collectChangedSubFormFieldIds(
          subForm,
          nextValue,
          this.getRowFieldValue(currentRow, field),
          canonicalFieldId,
        ));
      } else if (!equals(nextValue, this.getRowFieldValue(currentRow, field))) {
        fieldIds.push(canonicalFieldId);
      }
      return fieldIds;
    }, []);
    return [...new Set(changedFieldIds)];
  }

  private clearSubFormUniqueValidationErrors(subForm: AbstractSubForm) {
    this.clearUniqueValidationError(subForm);
    for (const subFormRow of this.getSubFormRows(subForm)) {
      for (const subFormInput of subFormRow.children) {
        if (isSubForm(subFormInput)) {
          this.clearSubFormUniqueValidationErrors(subFormInput as AbstractSubForm);
          continue;
        }
        this.clearUniqueValidationError(subFormInput);
      }
    }
  }

  private clearMainFormUniqueValidationErrors() {
    for (const formInput of this.formInputs) {
      if (isSubForm(formInput)) {
        continue;
      }
      this.clearUniqueValidationError(formInput);
    }
  }

  private async validateMainFormUniqueFields(row: Row, notify = true) {
    this.clearMainFormUniqueValidationErrors();

    const uniqueChecks: KeyValue[] = collectSubmitUniqueChecks(
      this.formInputs.filter(formInput => !isSubForm(formInput)),
      row,
      isUniqueFieldEmpty,
    );
    if (uniqueChecks.length === 0) {
      return true;
    }

    const params = {
      nocodeId: this.getBoard().nocodeId,
      tableId: this.tableUID[1],
      uniqueChecks,
      uuid: null,
    };
    if (!this.isAddingRow) {
      params.uuid = {
        key: this.keyFieldId,
        value: Object.prototype.hasOwnProperty.call(row || {}, this.keyFieldId)
          ? row[this.keyFieldId]
          : this.getFormInputValue(this.keyFieldId),
      }
    }

    let res;
    try {
      res = await axios.post("/nocode/check-unique-value", params).then(({ data }) => data);
    } catch (err) {
      throw new Error(err?.response?.data?.message || err?.message || i18next.t('form.uniqueValidationFailed'));
    }
    if (!res) {
      throw new Error(i18next.t('form.uniqueValidationFailed'));
    }
    if (res?.valid) {
      return true;
    }

    const fieldId = res.key;
    const formInput = this.formInputs.find(item => item.fieldId === fieldId);
    if (formInput) {
      this.setUniqueValidationError(formInput, i18next.t('form.notAllowDuplicateTips'));
      if (notify && !formInput.isHidden) {
        await formInput.intoView();
      }
    }
    if (notify) {
      ElMessage.error(i18next.t('form.duplicateFieldTips'));
    }
    return false;
  }

  private findSubFormInputByDuplicateIssue(
    subFormRows: SubFormRow[],
    issue: NonNullable<FormValidateSubmitResult["duplicateIssues"]>[number],
  ) {
    const subFormRow = issue.rowUUID
      ? subFormRows.find(row => {
        const rowUUID = row.getUUID?.();
        return rowUUID !== undefined && String(rowUUID) === issue.rowUUID;
      }) || subFormRows[issue.rowIndex]
      : subFormRows[issue.rowIndex];
    return subFormRow?.children.find(item => item.fieldId === issue.fieldId) ?? null;
  }

  private async handleSubFormSubmitValidationError(subForm: AbstractSubForm, result: FormValidateSubmitResult, notify = true) {
    this.clearSubFormUniqueValidationErrors(subForm);
    const duplicateFields = new Map<string, string>();
    let firstInvalidInput: FormElement | null = null;
    const duplicateIssues = result?.duplicateIssues ?? [];
    const duplicateTips = i18next.t('form.notAllowDuplicateTips');

    if (duplicateIssues.length > 0) {
      const subFormRows = this.getSubFormRows(subForm);
      for (const issue of duplicateIssues) {
        const subFormInput = this.findSubFormInputByDuplicateIssue(subFormRows, issue);
        const fieldTitle = issue.fieldTitle || subFormInput?.title;
        if (fieldTitle && !duplicateFields.has(issue.fieldId)) {
          duplicateFields.set(issue.fieldId, fieldTitle);
        }
        if (!subFormInput) {
          continue;
        }

        this.setUniqueValidationError(subFormInput, duplicateTips);
        firstInvalidInput ??= subFormInput;
      }
    }

    if (duplicateFields.size > 0) {
      this.setUniqueValidationError(subForm, this.getSubFormDuplicateMessage(subForm.title, [...duplicateFields.values()]));
    }

    const invalidTarget = firstInvalidInput ?? subForm;
    if (notify) {
      await invalidTarget.intoView();
      ElMessage.error(this.getDuplicateToastMessage(result) ?? result?.error ?? i18next.t('form.duplicateFieldTips'));
    }
    return invalidTarget;
  }

  async confirmSubmitValidationNotice() {
    return true;
  }

  notifySubmitValidationMessages() {
    const notice = this.submitValidationNotice;
    if (!notice?.messages?.length || notice.allowNoticeMode !== FormSubmitAllowNoticeMode.TOAST) {
      return;
    }

    for (const message of notice.messages) {
      ElMessage.warning(message);
    }
  }

  public async submit(options?: { skipSubmitValidationNoticeConfirm?: boolean; preparedRow?: Row | object | null }) {
    const isFormEditorRuntime = this.getBoard().runtime === FormTableRuntime.FORM_EDITOR;
    const row = options?.preparedRow ?? (isFormEditorRuntime ? this.serialize() : await this.prepareSubmitRow());
    if (!row) return false;
    if (!isFormEditorRuntime && !options?.skipSubmitValidationNoticeConfirm) {
      const confirmed = await this.confirmSubmitValidationNotice();
      if (!confirmed) {
        this.clearSubmitValidationNotice();
        return false;
      }
    }
    let res;
    if (!this.isAddingRow) {//update
      const currentRow = this._row.value ?? {};
      let effectiveSubmitFieldIds = this.getEffectiveSubmitFieldIds();
      let newRow: Row = {};
      if (effectiveSubmitFieldIds.length > 0) {
        newRow = this.buildSubmitPatchRow(row as Row, currentRow, effectiveSubmitFieldIds);
      } else {
        effectiveSubmitFieldIds = this.collectChangedSubmitFieldIds(row as Row, currentRow);
        this._effectiveSubmitFieldIds = effectiveSubmitFieldIds;
        if (!effectiveSubmitFieldIds.length) {
          res = { success: true, data: [] };
        } else {
          newRow = this.buildSubmitPatchRow(row as Row, currentRow, effectiveSubmitFieldIds);
        }
      }

      if (!res) {
        res = await this.getData().updateRows(
          this.tableUID,
          [this.filterUpdateRowSystemFields(newRow)],
          [[...this.tableUID, this.keyFieldId]],
        );
      }
    } else {//insert
      res = await this.getData().addRows(this.tableUID, [row]);
    }
    if (res && !isFormEditorRuntime) {
      this.notifySubmitValidationMessages();
      this.clearHiddenFieldSubmitState();
    }
    this.clearSubmitValidationNotice();
    return res;
  }

  private buildSubmitPatchRow(row: Row, currentRow: Row, submitFieldIds: ViewActionFieldId[]) {
    const patchRow: Row = {};
    if (this.keyFieldId) {
      const rowKeyValue = Object.prototype.hasOwnProperty.call(currentRow || {}, this.keyFieldId)
        ? currentRow[this.keyFieldId]
        : row?.[this.keyFieldId];
      if (rowKeyValue !== undefined) {
        patchRow[this.keyFieldId] = rowKeyValue;
      }
    }

    const visitedFieldIds = new Set<string>();
    for (const fieldId of submitFieldIds) {
      const rootFieldId = String(fieldId).split(".")[0];
      if (visitedFieldIds.has(rootFieldId)) {
        continue;
      }
      visitedFieldIds.add(rootFieldId);
      if (Object.prototype.hasOwnProperty.call(row || {}, rootFieldId)) {
        patchRow[rootFieldId] = this.buildSubmitPatchFieldValue(rootFieldId, row[rootFieldId]);
      }
    }

    return patchRow;
  }

  protected abstract validateForm(row: object): Promise<boolean>;

  abstract getFieldOptionRule(type: "visible" | "fill", element: FormElement);
  abstract setFieldOptionRule(type: "visible" | "fill", element: FormElement, value: OptionValue, history?: boolean): void;

  override destroy(onlySelf: boolean = false) {
    this._stopHiddenFieldSubmitStateWatch?.();
    this._stopHiddenFieldSubmitStateWatch = undefined;
    this._watchHiddenFieldSubmitisViewing?.();
    this._hiddenFieldSubmitState.clear();
    super.destroy(onlySelf);
  }

  private _isViewing = ref(false);
  private _hasWarnedCircularFieldsFilling = false;
  public get isViewing(): boolean {
    return this._isViewing.value;
  }
  public set isViewing(value: boolean) {
    this._isViewing.value = value;
  }
  private _hiddenFields: Ref<string[]> = ref([]);
  private _forceHiddenFields: Ref<string[]> = ref([]);
  private _forceShownFields: Ref<string[]> = ref([]);
  public setHiddenFields(fields: string[]) {
    this._hiddenFields.value = fields;
  }
  public setForceHiddenFields(fields: string[]) {
    this._forceHiddenFields.value = fields;
  }
  public setForceShownFields(fields: string[]) {
    this._forceShownFields.value = fields;
  }
  public getRunnableFieldsFilling(rules: FormLinkageRule[] = []) {
    const result = filterCircularLinkageRules(rules);
    if (result.circularRuleIndexes.size && !this._hasWarnedCircularFieldsFilling) {
      this._hasWarnedCircularFieldsFilling = true;
      ElMessage.warning(i18next.t("form.circularFieldsFillingSkipped"));
    }
    return result.rules;
  }
  private getWidgetFieldIds(widget: BaseWidget) {
    const fieldId = (widget as { fieldId?: string })?.fieldId;
    if (typeof fieldId !== "string" || !fieldId) {
      return [];
    }

    const path = [fieldId];
    let parent = widget.parent;
    while (parent && parent !== this) {
      if (parent instanceof AbstractSubForm && parent.fieldId) {
        path.unshift(parent.fieldId);
      }
      parent = parent.parent as any;
    }

    const fieldPath = path.join(".");
    return fieldPath === fieldId ? [fieldId] : [fieldId, fieldPath];
  }
  private hasForceShownField(widget: BaseWidget) {
    return this.getWidgetFieldIds(widget).some(fieldId => this._forceShownFields.value.includes(fieldId));
  }
  public isFormInputHidden(formInput: FormElement) {
    const fieldIds = this.getWidgetFieldIds(formInput);
    if (fieldIds.some(fieldId => this._forceShownFields.value.includes(fieldId))) {
      return false;
    }
    return fieldIds.some(fieldId => this._forceHiddenFields.value.includes(fieldId))
      || (this.isViewing && fieldIds.some(fieldId => this._hiddenFields.value.includes(fieldId)));
  }
  private hasForceShownDescendant(widget: BaseWidget) {
    const descendants = widget.container?.getChildWidgets?.(true) as BaseWidget[] | undefined;
    if (!descendants?.length) {
      return false;
    }
    return descendants.some(item => this.hasForceShownField(item));
  }
  private hasVisibleDescendantAfterForceHidden(widget: BaseWidget) {
    const descendants = widget.container?.getChildWidgets?.(true) as BaseWidget[] | undefined;
    if (!descendants?.length) {
      return false;
    }
    return descendants.some(item => {
      const fieldIds = this.getWidgetFieldIds(item);
      if (!fieldIds.length) {
        return false;
      }
      return fieldIds.some(fieldId => this._forceShownFields.value.includes(fieldId))
        || fieldIds.every(fieldId => !this._forceHiddenFields.value.includes(fieldId));
    });
  }
  public isForceShownWidget(widget: BaseWidget) {
    if (this.hasForceShownField(widget)) {
      return true;
    }
    return this.hasForceShownDescendant(widget);
  }
  isChildShow(widget: BaseWidget) {
    if (!this._forceHiddenFields.value.length) {
      return true;
    }
    if (this.isForceShownWidget(widget)) {
      return true;
    }
    const fieldIds = this.getWidgetFieldIds(widget);
    if (fieldIds.length) {
      return fieldIds.every(item => !this._forceHiddenFields.value.includes(item));
    }
    return this.hasVisibleDescendantAfterForceHidden(widget);
  }

  async bringChildIntoView(element: FormElement) {
    element.dom?.scrollIntoView({ behavior: "smooth" });
  }

  async canViewLayer(layerId: string) {
    if (isPublicDataPermissionBypassedRoute(router.currentRoute.value)) {
      return true;
    }
    return await axios.get("/project/can-view-nocode-layer", { params: { nocodeId: this.getBoard().nocodeId, layerId } }).then(({ data }) => data).catch(() => false);
  }

  async canReadLayerData(layerId: string) {
    return this.canReadLayerDataSync(layerId);
  }

  canReadLayerDataSync(layerId: string) {
    const pagePermissionContext = (this.getBoard() as any)?.projectContext?.pagePermissionContext;
    const permissionBody = pagePermissionContext?.getPermissionBody?.(layerId) || pagePermissionContext?.nocodeBody;
    return canReadNocodeTableDataByBody(
      permissionBody,
      layerId,
      pagePermissionContext?.departments || [],
      pagePermissionContext?.account,
      pagePermissionContext?.skipDataPermission,
    );
  }

  getUUID() {
    const table = this.getTable(this.tableUID);
    const uuidField = getUUIDSystemField(table?.fields);
    return this.getFormInputValue(uuidField?.uid)
      ?? this.getFormInputValue("__uuid__")
      ?? this.getFormInputValue(SystemField.UUID);
  }
}


export class FormElement extends BaseWidget {
  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          visible: (widget: Widget)=>{
            return !widget.isFormMode;
          },
          children: [
            {
              name: "container-layout",
              default: "fluid",
            },
          ],
        },
        "widget-title": {
          visible: false,
        },
        cover: {
          visible: (widget: Widget)=>{
            return !widget.isFormMode;
          },
        },
        border: {
          visible: (widget: Widget)=>{
            return !widget.isFormMode;
          },
        },
        background: {
          visible: (widget: Widget)=>{
            return !widget.isFormMode;
          },
        },
        basicStyle: {
          alias: i18next.t('form.style'),
          fold: "unfold",
          children: [
            {
              name: "width-ratio",
              alias: i18next.t('form.fieldWidth'),
              type: "select(radioGroup)",
              visible: (widget: FormElement)=>{
                return widget.isFormMode && !widget.isInSubForm;
              },
              default: 1,
              selectChoices: (widget: FormElement) => {
                return getWidthRatioSelectChoices(widget);
              },
            },
            {
              name: "width-subform",
              alias: i18next.t('form.fieldWidth'),
              type: "number(unit=px,min=30)",
              default: 160,
              visible: (widget: FormElement)=>{
                return widget.isInSubForm;
              },
            },
            {
              name: "input-width",
              alias: i18next.t('form.inputWidth'),
              type: "select(radioGroup)",
              visible: (widget: FormElement)=>{
                return widget.isFormMode && !widget.isInSubForm && widget.supportFixedWidth;
              },
              default: "fixed",
              selectChoices: [
                { label: i18next.t('form.fieldWidth'), value: "fill" },
                { label: i18next.t('form.fixedWidth'), value: "fixed" },
              ],
            },
            {
              name: "input-width-px",
              alias: "",
              type: "number(unit=px,min=1)",
              default: 360,
              visible: (widget: FormElement)=>{
                return widget.supportFixedWidth && !widget.isInSubForm && widget.getOption<"fill"|"fixed">("input-width") === "fixed";
              },
            },
            {
              name: "show-title",
              alias: i18next.t('form.showTitle'),
              type: "boolean",
              default: true,
              visible: (widget: FormElement)=>{
                return !widget.isInSubForm;
              },
            },
            {
              name: "title-text",
              alias: i18next.t('form.title'),
              type: "string",
              default: (widget: FormElement)=>{
                return widget.name;
              },
            },
            {
              name: "show-description",
              alias: i18next.t('form.showDesc'),
              type: "boolean",
              default: false,
            },
            {
              name: "description-layout",
              alias: i18next.t('form.descDisplayMode'),
              type: "select(radioGroup)",
              visible: (widget: FormElement)=>{
                return !widget.isInSubForm && widget.showDescription;
              },
              selectChoices: [
                { label: i18next.t('form.textTile'), value: "block" },
                { label: i18next.t('form.tooltip'), value: "tooltip" },
              ],
              default: "block",
            },
            {
              name: "description-content",
              type: "dialog",
              dialog: {
                // @ts-ignore
                component: defineAsyncComponent(() => import("../ShowDescriptionDialog.vue")),
                buttonText: (widget: FormElement)=>{
                  if (widget.getOption("default-formula")) {
                    return i18next.t('form.descSet');
                  }
                  return i18next.t('form.setDesc');
                },
              },
              visible: (widget: FormElement)=>{
                return widget.showDescription;
              },
            },
          ],
        },
        fieldProperty: {
          alias: i18next.t('form.fieldAttr'),
          fold: "unfold",
          children: [
            {
              name: "is-readonly",
              type: "hidden",
              default: false,
            },
            {
              name: FORM_READONLY_MODE_OPTION,
              alias: i18next.t("form.readOnly"),
              type: "select(radioGroup)",
              default: (widget: FormElement) => getFieldReadonlyMode(widget),
              selectChoices: [
                { label: i18next.t("form.readOnlyOff"), value: "off" },
                { label: i18next.t("form.readOnlyOn"), value: "on" },
                { label: i18next.t("form.conditionReadonly"), value: "condition" },
              ],
            },
            {
              name: FORM_READONLY_RULE_OPTION,
              alias: "",
              type: "dialog",
              visible: (widget: FormElement) => getFieldReadonlyMode(widget) === "condition",
              dialog: {
                // @ts-ignore
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/FieldReadonlyDialog.vue")),
                buttonText(widget: FormElement) {
                  const value = getFieldReadonlyRule(widget);
                  return value ? i18next.t("form.conditionSet") : i18next.t("form.setCondition");
                },
                buttonStyle(widget: FormElement) {
                  const value = getFieldReadonlyRule(widget);
                  return value ? { color: "var(--color-primary)" } : {};
                },
              },
            },
            {
              name: "is-hidden",
              alias: i18next.t('form.hidden'),
              type: "boolean",
              default: false,
            },
            {
              name: "reset-on-copy",
              alias: i18next.t('form.resetOnCopy'),
              type: "boolean",
              default: false,
              visible: (widget: Widget) => !isSubForm(widget),
              disabled: (widget: FormElement) => isResetOnCopyBlockedByLinkageFill(widget),
              disabledHelperText: (widget: FormElement) => getResetOnCopyDisabledHelperText(widget),
            },
          ],
        },
        fieldsControl: {
          alias: i18next.t('form.controlOtherFields'),
          fold: "unfold",
          children: [
            {
              name: "field-filling",
              alias: i18next.t('form.linkFillControl'),
              type: "dialog",
              dialog: {
                // @ts-ignore
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/LinkageFillDialog.vue")),
                buttonText(element) {
                  const value = element.getOption("field-filling");
                  return isEmpty(value) ? i18next.t('form.addLinkFillRule') : i18next.t('form.linkFillRuleSet');
                },
                buttonStyle(element, paths) {
                  const value = element.getOption("field-filling");
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              }
            },
            {
              name: "field-visible",
              alias: i18next.t('form.showHideControl'),
              type: "dialog",
              dialog: {
                // @ts-ignore
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/FieldVisibleDialog.vue")),
                buttonText(element) {
                  const value = element.getOption("field-visible");
                  return isEmpty(value) ? i18next.t('form.addShowHideRule') : i18next.t('form.showHideRuleSet');
                },
                buttonStyle(element, paths) {
                  const value = element.getOption("field-visible");
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              },
              visible:(element: FormElement) => {
                return !element.isInSubForm
              }
            },
            {
              name: "sub-field-visible",
              alias: i18next.t('form.subShowHideControl'),
              type: "dialog",
              dialog: {
                // @ts-ignore
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/SubFieldVisibleDialog.vue")),
                buttonText(element) {
                  const value = element.getOption("sub-field-visible");
                  return isEmpty(value) ? i18next.t('form.subAddShowHideRule') : i18next.t('form.subShowHideRuleSet');
                },
                buttonStyle(element, paths) {
                  const value = element.getOption("sub-field-visible");
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              },
              visible:(element: FormElement) => {
                return element.isInSubForm
              }
            }
          ],
        },
        scanInput: {
          alias: i18next.t('form.scanInput'),
          visible: false,
          children: [],
        },
        validation: {
          alias: i18next.t('form.validate'),
          fold: "unfold",
          children: [
            {
              name: "required",
              type: "hidden",
              default: false,
            },
            {
              name: FORM_REQUIRED_MODE_OPTION,
              alias: i18next.t("form.required"),
              type: "select(radioGroup)",
              default: (widget: FormElement) => getFieldRequiredMode(widget),
              selectChoices: [
                { label: i18next.t("form.requiredOff"), value: "off" },
                { label: i18next.t("form.requiredOn"), value: "on" },
                { label: i18next.t("form.conditionRequired"), value: "condition" },
              ],
            },
            {
              name: FORM_REQUIRED_RULE_OPTION,
              alias: "",
              type: "dialog",
              visible: (widget: FormElement) => getFieldRequiredMode(widget) === "condition",
              dialog: {
                // @ts-ignore
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/FieldRequiredDialog.vue")),
                buttonText(widget: FormElement) {
                  const value = getFieldRequiredRule(widget);
                  return value ? i18next.t("form.conditionSet") : i18next.t("form.setCondition");
                },
                buttonStyle(widget: FormElement) {
                  const value = getFieldRequiredRule(widget);
                  return value ? { color: "var(--color-primary)" } : {};
                },
              },
            },
            {
              name: "unique",
              alias: i18next.t('form.notAllowDuplicate'),
              tip: i18next.t('form.notAllowSubmitDuplicate'),
              type: "boolean",
              default: false,
              visible: (element: FormElement) => {
                return !element.isInSubForm;
              }
            },
            {
              name: "global-unique",
              alias: i18next.t('form.notAllowGlobalDuplicate'),
              tip: i18next.t('form.notAllowGlobalDuplicateTip'),
              type: "boolean",
              default: (element: FormElement) => {
                return false;
              },
              visible: (element: FormElement) => {
                return element.isInSubForm;
              }
            },
            {
              name: "unique-subform",
              alias: i18next.t('form.notAllowSingleDuplicate'),
              tip: i18next.t('form.notAllowSingleDuplicateTip'),
              type: "boolean",
              default: (element: FormElement) => {
                if (element.getOption<boolean>("global-unique")) {
                  return true;
                }
                return element.getOption<boolean>("unique", { skipDefault: true }) ?? false;
              },
              disabled: (element: FormElement) => {
                return element.isInSubForm && element.getOption<boolean>("global-unique");
              },
              visible: (element: FormElement) => {
                return element.isInSubForm;
              }
            },
          ],
        },
        padding: {
          visible: false
        },
        // 单行文本加密
        encryption: {
          visible: false,
        },
        linkForm: {
          alias: i18next.t('form.linkOtherForm'),
          type: "boolean",
          default: false,
          fold: "unfold",
          children: [
            {
              name: "select-link-form",
              alias: i18next.t('form.selectForm'),
              type: "select",
              selectChoices: (widget: FormElement) => {
                return widget.tableChoices;
              },
              unknownOptionText: i18next.t('form.formDeletedTips'),
            },
            {
              name: "open-form-type",
              alias: i18next.t('form.openMode'),
              type: "select",
              selectChoices: [
                { label: i18next.t('form.modal'), value: "dialog" },
                { label: i18next.t('form.newTab'), value: "blank" },
              ],
              default: "dialog",
            },
            {
              name: "link-form-filter",
              alias: i18next.t('form.dataFilter'),
              type: 'dialog',
              visible: (widget: FormElement) => {
                return !!widget.getOption<string>("select-link-form");
              },
              dialog: {
                // @ts-ignore
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/LinkFormFilterDialog.vue")),
                buttonText(widget: FormElement, paths) {
                  const dataFilter: FilterRule = widget.getOption("link-form-filter") || {
                    logic: LogicalOperator.AND,
                    conditions: [],
                  };
                  return isEmpty(dataFilter.conditions) ? i18next.t('form.setFilterCondition') : i18next.t('form.filterConditionSet');
                },
                buttonStyle(widget: FormElement) {
                  const dataFilter: FilterRule = widget.getOption("link-form-filter") || {
                    logic: LogicalOperator.AND,
                    conditions: [],
                  };
                  const value = dataFilter.conditions;
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              }
            },
          ]
        },
      }
    }, ...super.defineOptions()];
  }

  declare public parent: AbstractForm | AbstractSubForm | AbstractFormLayout;

  /** 字段唯一标识 */
  get fieldId(): string {
    return this.field?.uid;
  }

  get tableChoices() {

    const isSubTable = (table: Table) => {
      return !isEmpty(table.meta?.extra?.primaryTable);
    }

    const connections = this.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || [];
    const pagePermissionContext = (this.getBoard() as any)?.projectContext?.pagePermissionContext;
    const departments = pagePermissionContext?.departments || this.getBoard().organizeUtil?.departments || [];
    const isViewable = (tableId: string) => canReadNocodeTableDataByBody(
      pagePermissionContext?.getPermissionBody?.(tableId) || pagePermissionContext?.nocodeBody,
      tableId,
      departments,
      pagePermissionContext?.account,
      pagePermissionContext?.skipDataPermission,
    );
    const currentConnectionUID = this.topForm?.tableUID?.[0];
    const currentTableUID = this.topForm?.tableUID?.[1];

    return connections.flatMap(connection => {
      return connection.tables
        .filter(t => !isSubTable(t) && isViewable(t.uid))
        .map(t => {
          const isCurrent = currentConnectionUID === connection.uid && currentTableUID === t.uid;
          const alias = isCurrent ? i18next.t('form.currentForm') : t.alias;
          const isCrossAppTable = connection.uid !== currentConnectionUID;
          return {
            label: isCrossAppTable && connection.name ? `[${connection.name}]${alias}` : alias,
            value: [connection.uid, t.uid].join(","),
            isCurrent: isCurrent ? 1 : 0,
          };
        });
    }).sort((a, b) => b.isCurrent - a.isCurrent);
  }

  private _field = ref<Field>();
  get field() {
    return this._field.value;
  }
  public bindField(field: Field) {
    this._field.value = field;
  }
  get children() {
    return super.children as unknown as FormElement[];
  }
  setWidgetAuth(
    fieldsAuth: Record<string, FieldAuthValue>,
    permissionFieldsAuth: Record<string, FieldAuthValue> = {},
  ) {
    const auth = fieldsAuth[this.uid];
    const permissionAuth = permissionFieldsAuth[this.uid];
    // 流程权限只叠加限制；没有命中权限时保留 undefined，让字段自身的静态只读/隐藏配置继续生效。
    this.setReadonlyInProcess(auth === FieldAuthValue.VISIBLE ? true : undefined);
    this.setHiddenInProcess(auth !== void 0 && auth < FieldAuthValue.VISIBLE ? true : undefined);
    this.setHiddenByFieldPermission(permissionAuth !== void 0 && permissionAuth < FieldAuthValue.VISIBLE);
    for (const widget of this.children as FormElement[]) {
      widget.setWidgetAuth(fieldsAuth, permissionFieldsAuth);
    }
  }
  setWidgetRequired(requiredFieldsAuth: Record<string, boolean>) {
    const hasOwnRequired = Object.prototype.hasOwnProperty.call(requiredFieldsAuth || {}, this.uid);
    this.setRequiredInProcess(hasOwnRequired ? !!requiredFieldsAuth?.[this.uid] : null);
    for (const widget of this.children as FormElement[]) {
      widget.setWidgetRequired(requiredFieldsAuth);
    }
  }
  /** 初始值，来源于数据 */
  get initialValue() {
    return this.form?.getFormInputValue(this.fieldId);
  }
  /** 所在表单 */
  get form(): AbstractForm | AbstractSubForm {
    let parent = this.parent;
    while (parent) {
      if (parent instanceof AbstractForm || parent instanceof AbstractSubForm) {
        return parent;
      }
      parent = parent.parent;
    }
    return null;
  }
  get topForm(): AbstractForm {
    if (this.form instanceof AbstractSubForm) {
      return this.form.topForm;
    }
    return this.form;
  }

  get currentValue() {
    return this.inputValue;
  }
  /** 当前值 */
  protected _inputValue: Ref<any> = ref();
  get inputValue() {
    return undefined;
  }
  set inputValue(value) {
  }
  trySetInputValue(value: any) {
    if (this.topForm.isViewing) return;
    this.inputValue = value;
  }
  clearValue() {
    this.inputValue = null;
  }
  public isEmpty() {
    const value = this.inputValue;
    if (!value && typeof value !== "number") {
      return true;
    }
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
    if (typeof value === "object" && Object.values(value).length === 0) {
      return true;
    }
    return false;
  }
 
  private _isInTable: Ref<boolean> = ref(false);

  set isInTable(value: boolean) {
    this._isInTable.value = value
  }
  get isInTable() {
    return this._isInTable.value
  }
  get isInSubForm() {
    return this.form instanceof AbstractSubForm || this._isInTable.value;
  }
  get widthInSubForm() {
    return this.getOption<number>("width-subform");
  }
  get title() {
    return this.getOption<string>("title-text");
  }
  get showTitle() {
    return this.getOption<boolean>("show-title");
  }
  get isRequired() {
    if (this._isRequiredInProcess.value === true) return true;
    const mode = getFieldRequiredMode(this);
    if (mode === "on") return true;
    if (mode === "condition") return isConditionalRequired(this);
    return false;
  }
  get isUnique() {
    if (this.isInSubForm) {
      return this.isGlobalUnique || (this.getOption<boolean>("unique-subform", { skipDefault: true }) ?? this.getOption<boolean>("unique"));
    }
    return this.getOption<boolean>("unique");
  }
  get isGlobalUnique() {
    return this.getOption<boolean>("global-unique");
  }
  private _isReadonlyInProcess: Ref<boolean | undefined> = ref();
  private _isHiddenInProcess: Ref<boolean | undefined> = ref();
  private _isHiddenByFieldPermission: Ref<boolean> = ref(false);
  private _isRequiredInProcess: Ref<boolean | null> = ref(null);
  // 必须保留显式传入的 undefined，用它清除上一次流程权限留下的运行态覆盖值。
  public setReadonlyInProcess(value: boolean | undefined) {
    this._isReadonlyInProcess.value = value;
  }
  public setHiddenInProcess(value: boolean | undefined) {
    this._isHiddenInProcess.value = value;
  }
  public setHiddenByFieldPermission(value = true) {
    this._isHiddenByFieldPermission.value = value;
  }
  public setRequiredInProcess(value: boolean | null = null) {
    this._isRequiredInProcess.value = value;
  }
  get isReadonly() {
    return this.topForm?.isViewing || (this._isReadonlyInProcess.value ?? (getFieldReadonlyMode(this) === "on" || isConditionalReadonly(this)));
  }

  private resolveIsHidden(): boolean {
    if (this.topForm?.isForceShownWidget?.(this)) {
      return false;
    }
    return this.topForm?.isFormInputHidden?.(this) || (this._isHiddenInProcess.value ?? this.getOption<boolean>("is-hidden")) || !this.parent.container.shouldShowWidget(this) || this.parent.isHidden;
  }

  private readonly _isHiddenComputed: ComputedRef<boolean> = this.effectScope.run(
    () => computed(() => {
      return this.resolveIsHidden();
    }),
  );
  get isHidden(): boolean {
    return this._isHiddenComputed.value;
  }
  // 标记字段是否因字段权限而隐藏，用于区别业务显隐并避免误处理权限不可见字段。
  get isHiddenByFieldPermission() {
    return this._isHiddenByFieldPermission.value || !!(this.parent as any)?.isHiddenByFieldPermission;
  }

  get isLinkage() {
    if (isSubForm(this)) return false;

    const fieldsFillRules: FormLinkageRule[] = this.topForm.getOption("fields-filling");

    return fieldsFillRules?.some(rule => {
      return rule.fillWidgets.some(fillWidget => {
        if (!fillWidget.linkageSubFields) {
          return fillWidget.fillWidget === this.uid
        } else {
          return fillWidget.linkageSubFields.some(linkageSubField => linkageSubField.fillWidget === this.uid)
        }
      });
    })
  }

  get isLinkageTrigger() {
    if (isSubForm(this)) return false;

    const fieldsFillRules: FormLinkageRule[] = this.topForm.getOption("fields-filling");

    return fieldsFillRules?.some(rule => {
      return rule.conditions?.some(condition => {
        return condition.value === this.uid || condition.value?.split('.')?.[1] === this.uid;
      });
    })
  }

  get isLinkageHighLight() {
    const _widget = this.topForm.linkageHighLightWidget.value?.uid;
    const type = this.topForm.linkageHighLightWidget.value?.type;
    if(!_widget) return null;
    if(this.uid === _widget) return type;
    const fieldsFillRules: FormLinkageRule[] = this.topForm.getOption("fields-filling");
    const filterRules = fieldsFillRules.filter(rule => {
      const isFill =  rule.fillWidgets.some(fillWidget => {
        if (!fillWidget.linkageSubFields) {
          return fillWidget.fillWidget === _widget
        } else {
          return fillWidget.linkageSubFields.some(linkageSubField => linkageSubField.fillWidget === _widget)
        }
      });

      const isTrigger = rule.conditions?.some(condition => {
        return condition.value === _widget || condition.value?.split('.')?.[1] === _widget;
      });
      return isFill || isTrigger;
    })
    const isFill = filterRules.some(rule => {
      return rule.fillWidgets.some(fillWidget => {
        if (!fillWidget.linkageSubFields) {
          return fillWidget.fillWidget === this.uid
        } else {
          return fillWidget.linkageSubFields.some(linkageSubField => linkageSubField.fillWidget === this.uid)
        }
      });
    }) && type === 'out'
    if(isFill) return 'in';

    const isTrigger = filterRules.some(rule => {
      return rule.conditions?.some(condition => {
        return condition.value === this.uid || condition.value?.split('.')?.[1] === this.uid;
      });
    }) && type === 'in'
    if(isTrigger) return 'out';
    
    return null
  }

  get isVisibleControl() {
    if (this.isInSubForm && this.form instanceof AbstractSubForm) {
      const subFieldsVisibleRules: FormVisibleRule[] = (this.form as AbstractSubForm).getOption("sub-fields-visible");
      
      return subFieldsVisibleRules?.some(rule => {
        return rule.widgetIds?.some(w => w === this.uid);
      });
    } else {
      const fieldsVisibleRules: FormVisibleRule[] = this.topForm?.getOption("fields-visible");
  
      return fieldsVisibleRules?.some(rule => {
        return rule.widgetIds?.some(w => w === this.uid);
      });
    }
  }

  get isVisibleTrigger() {
    if (this.isInSubForm) {
      const subFieldsVisibleRules: FormVisibleRule[] = this.form.getOption("sub-fields-visible");
      
      return subFieldsVisibleRules?.some(rule => {
        return rule.conditions?.some(condition => {
          if (condition.uid?.split('.').length > 1) {
            return condition.uid.split('.')[1] === this.uid;
          }
        });
      });
    } else {
      const fieldsVisibleRules: FormVisibleRule[] = this.topForm.getOption("fields-visible");
      const allSubForm = this.topForm.container.getChildWidgets(true, (widget: FormElement)=>{
        return widget instanceof AbstractSubForm;
      }) as AbstractSubForm[];
      let allSubFieldsVisibleRules: FormVisibleRule[] = [];
      // 获取所有子表的显隐规则
      allSubForm.forEach(subForm => {
        allSubFieldsVisibleRules = allSubFieldsVisibleRules.concat(subForm.getOption("sub-fields-visible")).filter(rule => rule !== undefined);
      })
      let isSubVisibleTrigger = false;
      if (allSubFieldsVisibleRules.length > 0) {
        isSubVisibleTrigger = allSubFieldsVisibleRules.some(rule => {
          return rule.conditions?.some(condition => {
            return condition.uid === this.uid;
          });
        });
      }
  
      return fieldsVisibleRules?.some(rule => {
        return rule.conditions?.some(condition => {
          return condition.uid === this.uid;
        });
      }) || isSubVisibleTrigger;
    }
  }

  get isVisibleHighLight() {
    const type = this.topForm.visibleHighLightWidget.value?.type;
    const _widget = this.topForm.visibleHighLightWidget.value?.uid;
    if(!_widget) return false;
    if(this.uid === _widget) return type;

    const fieldsVisibleRules: FormVisibleRule[] = this.topForm.getOption("fields-visible");
    const filterRules = fieldsVisibleRules?.filter(rule => {
      const isVisible =  rule.widgetIds?.some(w => w === _widget)
      const isTrigger = rule.conditions?.some(condition => {
        return condition.uid === _widget;
      });
      return isVisible || isTrigger;
    }) || [];
    const allSubForm = this.topForm.container.getChildWidgets(true, (widget: FormElement)=>{
      return widget instanceof AbstractSubForm;
    }) as AbstractSubForm[];
    let allSubFieldsVisibleRules: FormVisibleRule[] = [];
    // 获取所有子表的显隐规则
    allSubForm.forEach(subForm => {
      allSubFieldsVisibleRules = allSubFieldsVisibleRules.concat(subForm.getOption("sub-fields-visible")).filter(rule => rule !== undefined);
    })
    for (const rule of allSubFieldsVisibleRules) {
      const isVisible =  rule.widgetIds?.some(w => w === _widget)
      const isTrigger = rule.conditions?.some(condition => {
        return condition.uid.split(".").length > 1 ? condition.uid.split(".")[1] === _widget : condition.uid === _widget;
      })
      if (isVisible || isTrigger) {
        filterRules.push(rule);
      }
    }

    const isVisible = filterRules.some(rule => {
      return rule.widgetIds?.some(w => w === this.uid)
    }) && type === 'out'
    if(isVisible) return 'in';

    const isTrigger = filterRules.some(rule => {
      return rule.conditions?.some(condition => {
        return condition.uid.split(".").length > 1 ? condition.uid.split(".")[1] === this.uid : condition.uid === this.uid;
      });
    }) && type === 'in'
    if(isTrigger) return 'out';
    
    return null
  }

  get showDescription() {
    return this.getOption<boolean>("show-description");
  }
  get descriptionLayout() {
    if (this.isInSubForm) return "tooltip";
    return this.getOption<string>("description-layout");
  }
  get descriptionContent() {
    return this.getOption<string>("description-content");
  }

  public ensureInputValue(): Promise<void> {
    return Promise.resolve();
  }

  override getOption<T extends OptionValue>(paths: string | string[], options?: GetOptionOptions) {
    const path = Array.isArray(paths) ? paths.at(-1) : paths;
    if (["field-filling", "field-visible"].includes(path)) {
      return this.topForm?.getFieldOptionRule(path === "field-filling" ? "fill" : "visible", this) as T;
    }
    if (["sub-field-visible"].includes(path)) {
      return (this.form as AbstractSubForm)?.getSubFieldOptionRule(this) as T;
    }
    return super.getOption<T>(paths, options);
  }

  override setOption(paths: string | string[], value: OptionValue, history?: boolean): void {
    const path = Array.isArray(paths) ? paths.at(-1) : paths;
    if (["select-link-form"].includes(path) && value != this.getOption(path)) {
      this.setOption("link-form-filter", {
        logic: LogicalOperator.AND,
        conditions: [],
      }, history);
    }
    if (["field-filling", "field-visible"].includes(path)) {
      return this.topForm.setFieldOptionRule(path === "field-filling" ? "fill" : "visible", this, value, history);
    }
    if (["sub-field-visible"].includes(path)) {
      return (this.form as AbstractSubForm)?.setSubFieldOptionRule(this, value as FormVisibleRule[], history);
    }
    if (path === FORM_READONLY_MODE_OPTION) {
      super.setOption("is-readonly", value === "on", false);
      return super.setOption(paths, value, history);
    }
    if (path === FORM_REQUIRED_MODE_OPTION) {
      super.setOption("required", value === "on", false);
      return super.setOption(paths, value, history);
    }
    if (path === "global-unique" && this.isInSubForm) {
      if (value && !this.getOption<boolean>("unique-subform")) {
        super.setOption("unique-subform", true, false);
      }
      return super.setOption(paths, value, history);
    }
    if (path === "unique-subform" && this.isInSubForm && this.getOption<boolean>("global-unique")) {
      return super.setOption(paths, true, history);
    }
    return super.setOption(paths, value, history);
  }

  /** 当需要校验值时调用此方法 */
  async validate() {
    this._validationError.value = null;
    try {
      if (this.isRequired && this.isEmpty()) {
        throw new Error(i18next.t('form.fieldRequiredTips'));
      }
      await this.doValidate();
    } catch(err) {
      this._validationError.value = err;
    }
  }
  private _validationError: ShallowRef<Error> = ref();
  get validationError(): string {
    return this._validationError.value?.message;
  }
  set validationError(val: Error) {
    this._validationError.value = val;
  }
  /**
   * 校验当前值，校验不通过时，直接throw error
   * 由字类实现该方法
   * @throws Error
   */
  public async doValidate() {
  }

  get fieldType(): FieldType {
    return "string";
  }

  isCreateField() {
    return true;
  }

  get supportFixedWidth() {
    return true;
  }
  get inputWidthStyle() {
    if (!this.supportFixedWidth || this.isInSubForm) {
      return "100%";
    }
    const widthType = this.getOption<"fill"|"fixed">("input-width");
    if (widthType === "fill") {
      return "100%";
    }
    const widthPx = this.getOption<number>("input-width-px");
    return `${widthPx}px`;
  }

  public setInputValueNotChanged(value: any) {
    this._inputValue.value = value;
  }

  resolveFormSetting(): FromSetting {
    return {
      extra: {
        widgetType: this.type,
        isUnique: this.isUnique,
        isGlobalUnique: this.isGlobalUnique,
        isRequired: getFieldRequiredMode(this) === "on",
        requiredMode: getFieldRequiredMode(this),
        requiredRule: this.getOption<FilterRule>(FORM_REQUIRED_RULE_OPTION, { skipDefault: true }),
        isReadonly: getFieldReadonlyMode(this) === "on",
        readonlyMode: getFieldReadonlyMode(this),
        readonlyRule: this.getOption<FilterRule>(FORM_READONLY_RULE_OPTION, { skipDefault: true }),
        isHidden: this.getOption<boolean>("is-hidden"),
        resetOnCopy: !isSubForm(this) && !isResetOnCopyBlockedByLinkageFill(this) && this.getOption<boolean>("reset-on-copy"),
        isLinkForm: this.getOption<boolean>("linkForm"),
        selectLinkForm: this.getOption<boolean>("select-link-form"),
        openFormType: this.getOption<"dialog"|"blank">("open-form-type"),
        linkFormFilter: this.getOption("link-form-filter"),
      }
    }
  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.STRING,
      },
      editFuncInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.STRING,
      }
    };
  }
  async intoView() {
    await this.parent.bringChildIntoView(this);
  }


  public command(cmd: string) {}
}


export class AbstractSubForm extends FormElement {
  declare public parent: AbstractForm | AbstractSubForm;
  constructor(soul: Soul, parent: AbstractForm | AbstractSubForm) {
    super(soul, parent);
    this.initContainer();
  }

  get children(): FormElement[] {
    return super.children as FormElement[];
  }
  get form(): AbstractForm {
    return super.form as AbstractForm;
  }

  public getFormInputValue(fieldId: string) {
    return undefined;
  }

  public applyManualAddRowDefaults(row: Row, options: { allowPopulatedRow?: boolean } = {}) {
    return applyManualSubFormRowDefaults({
      row,
      subForm: this,
      formData: this.getBoard()?.getNocodeBodyData?.()?.formData,
      account: usePassportStore().account,
      ...options,
    });
  }

  getChildElement(uid: string) {
    return this.container.getChildWidget(uid) as FormElement;
  }

  public getSubFieldOptionRule(widget: FormElement) {
    return this.getOption<FormVisibleRule[]>("sub-fields-visible")?.filter(rule => (rule.conditions[0].uid.split(".").length > 1) && (rule.conditions[0].uid.split(".")[1] === widget.uid) && (rule.conditions.length === 1));
  }

  public setSubFieldOptionRule(widget: FormElement, value: FormVisibleRule[], history?: boolean) {
    const originRules = this.getSubFieldOptionRule(widget) as FormVisibleRule[];
    let allRules = this.getOption<FormVisibleRule[]>("sub-fields-visible") || [];
    if (isEmpty(originRules)) {
      this.setOption("sub-fields-visible", [...allRules, ...value], history);
      return;
    }
    const rules = value;
    const addRules = rules.filter(r => !originRules.find(rule => rule.id === r.id));
    const removeRules = originRules.filter(rule => !rules.find(r => r.id === rule.id));
    const updateRules = rules.filter(r => originRules.find(rule => rule.id === r.id));
    allRules = allRules.filter(r => !removeRules.find(rule => rule.id === r.id));
    allRules = allRules.map(r => (updateRules.find(rule => rule.id === r.id) || r));
    allRules.push(...addRules);
    this.setOption("sub-fields-visible", allRules, history);
  }

  public async bindField(field: Field) {
    super.bindField(field);
    const subTableFields = this.field.subTableFields ?? [];
    this._keyField = getUUIDSystemField(subTableFields);
    const children = this.children;
    if (isEmpty(children) && !isEmpty(this.getSoul().widgets)) {
      await this.container['syncWidgets']();
    }
    for (const widget of this.children) {
      const f = subTableFields.find(f=>f.meta.uid === widget.uid);
      widget.bindField(f);
    }
  }
  get tableUID(): OptionTableUID {
    return this.field?.meta?.extra?.subTableUID;
  }
  protected _keyField: Field;
  get keyFieldId() {
    return this._keyField?.uid;
  }

  private _generateColumns() {
    const columns: TableColumn[] = [];
    for (const formInput of this.children) {
      if (!formInput.isCreateField()) continue;
      const name = getUniqueName(columns, formInput.title);
      const {subType, extra} = formInput.resolveFormSetting() ?? {};
      columns.push({
        name,
        alias: formInput.title,
        uid: formInput.uid,
        type: formInput.fieldType,
        subType,
        extra,
      });
    }
    return columns;
  }

  resolveFormSetting(): FromSetting {
    const setting = super.resolveFormSetting() ?? {};
    return {
      ...setting,
      subType: "subForm",
      extra: {
        ...(setting.extra ?? {}),
        subColumns: this._generateColumns(),
      },
    };
  }

  async bringChildIntoView(element: FormElement) {
    element.dom?.scrollIntoView({ behavior: "smooth" });
  }

  private readonly _subFieldVisibleRuleIndex = this.effectScope.run(
    () => computed(() => {
      const index = new Map<string, SubFieldVisibleRuleGroup>();
      const rules =
        this.getOption<FormVisibleRule[]>("sub-fields-visible") || [];

      for (const rule of rules) {
        // 保持原 filter 语义，避免同一规则因重复 widgetId 被加入多次
        for (const widgetId of new Set(rule.widgetIds || [])) {
          let group = index.get(widgetId);

          if (!group) {
            group = {
              showRules: [],
              hideRules: [],
            };
            index.set(widgetId, group);
          }

          if (rule.visibleType === VisibleType.HIDE) {
            group.hideRules.push(rule);
          } else {
            group.showRules.push(rule);
          }
        }
      }

      return index;
    }),
  )!;

  getSubFieldVisibleRules(widgetId: string) {
    return this._subFieldVisibleRuleIndex.value.get(widgetId);
  }
}

export const isSubForm = (element: unknown): element is AbstractSubForm => {
  return element instanceof AbstractSubForm;
}

export class SubFormRow extends AbstractSubForm {
  declare public parent: AbstractSubForm;
  public readonly suppressComputedWatchers: boolean;
  private _didInitAfterConstructor = false;
  constructor(soul: Soul, parent: AbstractSubForm, options: { suppressComputedWatchers?: boolean } = {}) {
    super(soul, parent);
    buildElement(SubFormRow);
    this.container.updateHistory = ()=>{};
    this.suppressComputedWatchers = !!options.suppressComputedWatchers;
    this.initAfterConstructor()
  }

  protected initAfterConstructor() {
    if (this._didInitAfterConstructor) return;
    this._didInitAfterConstructor = true;
    super.initAfterConstructor();
    if (!this.form.isEditable && !this.suppressComputedWatchers) {
      setTimeout(() => {
        this.watchFieldsFill();
        this.topForm.forceWatch.value = !this.topForm.forceWatch.value;
      }, 0)
    }
  }

  private _row = ref(null);
  private fieldFillWatchVersions = new Map<string, number>();
  public setRow(row) {
    this._row.value = row;
  }
  getRow() {
    return this._row.value;
  }

  getUUID() {
    const subform = this.parent as AbstractSubForm;
    const table = subform?.getTable(subform.tableUID);
    const uuidField = getUUIDSystemField(table?.fields);
    return this.getFormInputValue(uuidField?.uid)
      ?? this.getFormInputValue("__uuid__")
      ?? this.getFormInputValue(SystemField.UUID);
  }

  public getFormInputValue(fieldId: string) {
    return this._row.value?.[fieldId];
  }

  private transformFieldsFillCondition(condition: FormCondition) {
    const { uid, func, fixedValue, type } = condition;
    if (type === FormConditionValueType.FORM && Array.isArray(fixedValue)) {
      const value = fixedValue.filter(item => item !== undefined && item !== null && item !== "");
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

  private isEmptyFieldsFillValue(value: any) {
    if (Array.isArray(value)) {
      return value.filter(item => item !== undefined && item !== null && item !== "").length === 0;
    }
    return value === undefined || value === null || value === "";
  }

  private isNoValueRequiredFunc(func: RuleFunc) {
    return [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(func);
  }

  private hasMissingFieldsFillCondition(conditions: FormCondition[], valuesMap: Record<string, any>) {
    return conditions.some(condition => {
      if (condition.type !== FormConditionValueType.FORM) return false;
      if (this.isNoValueRequiredFunc(condition.func)) return false;
      const conditionKey = (condition as any).id || condition.uid;
      return this.isEmptyFieldsFillValue(valuesMap?.[conditionKey]);
    });
  }

  private buildFieldsFillQuery(conditions: FormCondition[], valuesMap: Record<string, any>, logic: LogicalOperator) {
    if (!conditions.length) return null;
    if (logic === LogicalOperator.AND && this.hasMissingFieldsFillCondition(conditions, valuesMap)) return null;
    const queryConditions = conditions.map(condition => {
      const runtimeCondition = condition.type === FormConditionValueType.FORM
        ? {
          ...condition,
          fixedValue: valuesMap[(condition as any).id || condition.uid],
        }
        : condition;
      return this.transformFieldsFillCondition(runtimeCondition);
    }).filter(Boolean);

    if (!queryConditions.length) return null;

    return {
      [logic === LogicalOperator.AND ? "$and" : "$or"]: queryConditions,
    } as WhereCondition;
  }

  private watchFieldsFill() {
    this.effectScope.run(() => {
      const fieldsFilling = (this.topForm as AbstractForm).getRunnableFieldsFilling((this.topForm as any).fieldsFilling || []);
      for (const rule of fieldsFilling) {
        this.watchFieldFill(rule);
      }
    });
  }

  private isAllowFillWidget(widget, linkageSubFields) {
    if(widget.dataOrigin != "multiple") return true;
    if(isEmpty(linkageSubFields)) return true;

    const multipleRules = widget.getOption('data-fill-rules')?.fillWidgets?.map(item => item.fillWidget) || [];
    if(multipleRules.length === 0) return true;

    const subWidgets = linkageSubFields.map(f => f.fillWidget);
    const set = new Set(subWidgets);

    return !multipleRules.some(r => set.has(r))
  }

  private isAggregateLinkageTable(rule: FormLinkageRule) {
    const [connectionUID, tableUID] = rule.linkageTable || [];
    if (!connectionUID || !tableUID) return false;

    const bodyData = this.getBoard().getNocodeBodyData?.();
    const aggregateSources = [
      bodyData?.formData?.uid ? {
        uid: bodyData.formData.uid,
        aggregateTables: bodyData.formData.aggregateTables || [],
      } : null,
      ...((bodyData?.otherDataSources || []).map(source => ({
        uid: source.uid,
        aggregateTables: (source as any).aggregateTables || [],
      }))),
    ].filter(Boolean) as Array<{ uid: string, aggregateTables: Array<{ uid: string }> }>;

    return aggregateSources.some(source => {
      return source.uid === connectionUID && source.aggregateTables.some(table => table.uid === tableUID);
    });
  }

  private watchFieldFill(rule: FormLinkageRule) {
    const watchKey = rule.id || JSON.stringify(rule);
    const currentSubFormFillWidgets = (rule.fillWidgets || []).filter(c => {
      return c.linkageSubFields?.length
    })
    const getConditionValues = (conditions: FormCondition[], preferUid = false) => {
      return conditions.reduce<Record<string, any>>((prev, item: any) => {
        if(item.type === "CUSTOM") return prev
        const key = preferUid ? (item.uid || item.id) : (item.id || item.uid);
        if(!key) return prev;
        if (this.isNoValueRequiredFunc(item.func)) return prev;
        const widgetIds = item.value?.split(".") || [];
        if (widgetIds.length > 1) {
          const widget = this.form.getChildElement(widgetIds[1]);
          if (widget) prev[key] = this.getFormInputValue(widget.fieldId);
        } else {
          const widget = (this.topForm as AbstractForm).getChildElement(item.value);
          if (widget) prev[key] = widget.inputValue;
          // 根据关联表单的数据进行筛选
          if (item.comparisonOfForm && item.comparisonOfForm === SelectIdOfForm.LINKAGE) {
            let allRelatedForms = this.topForm.children.filter(child => child.getSoul().type === "widget.form.relatedData").filter((r: any) => {
              const relatedTable = this.getTable(r.connectionTable);
              if (relatedTable.fields.find(f => f.uid === item.value)) return r;
            });
            const relatedValues = ref([])
            for(const [index, relatedData] of allRelatedForms.entries()) {
              // 只会与关联表单的主表字段值进行筛选
              relatedValues.value[index] = (relatedData as any).getValue(item.value);
            }
            prev[key] = [...new Set(relatedValues.value.flat())];
          }
        }

        return prev;
      }, {})
    }

    if (currentSubFormFillWidgets.length > 0) {
      watch(() => {
        return getConditionValues(rule.conditions)
      }, async (newVal, oldVal) => {
        if(this.topForm.isViewing) return;
        const isChanged = newVal ? Object.keys(newVal).some(key => newVal?.[key] !== oldVal?.[key]) : false;
        if (!isChanged) return;
        const watchVersion = (this.fieldFillWatchVersions.get(watchKey) || 0) + 1;
        this.fieldFillWatchVersions.set(watchKey, watchVersion);
        const rowsFilterValue = getConditionValues(rule.conditions);
        const rowsQuery = this.buildFieldsFillQuery(rule.conditions, rowsFilterValue, rule.logic);
        if (!rowsQuery) return;
        let rowsFilters = {
          [rule.linkageTable[1]]: [rowsQuery],
        }
        const isSubTableChanged = () => {
          const _table = this.getTable(rule.linkageTable)
          if(!_table) return false;
          return !isEmpty(_table.meta?.extra?.primaryTable)
        }
        if(isSubTableChanged()) {
          const subTableFilterConditions = getConditionValues(rule.subTableSetting?.conditions || [])
          const primaryTablePath = this.getTable(rule.linkageTable).meta?.extra?.primaryTable
          const primaryTable = this.getTable(primaryTablePath)
          const primaryKeyField = getUUIDSystemField(primaryTable.fields)
          const subTableQuery = this.buildFieldsFillQuery(
            rule.subTableSetting?.conditions || [],
            subTableFilterConditions,
            rule.subTableSetting?.logic || LogicalOperator.AND,
          );
          if (rule.subTableSetting?.conditions?.length && !subTableQuery) return;
          const filters = {
            [primaryTable.uid]: [subTableQuery || {}],
          }
          const distinct = await formDataApi.distinct({
            nocodeId: this.getBoard().nocodeId,
            tableUID: primaryTable.uid,
            columnId: primaryKeyField.uid,
            options: {
              filters
            }
          })
          const keyField = this.getTable(rule.linkageTable).fields.find(f => f.meta?.name === SystemField.KEY)
          rowsFilters = {
            [rule.linkageTable[1]]: [{
              $and: [
                rowsQuery,
                {
                  [keyField.uid]: distinct || [],
                }
              ]
            }]
          }
        }
        const queryOptions = this.isAggregateLinkageTable(rule) ? {} : { filters: rowsFilters };
        let _rows = await (this.topForm as any).getTableData(rule.linkageTable, queryOptions);
        if (this.fieldFillWatchVersions.get(watchKey) !== watchVersion) return;
        const dataUid = this.getTable(rule.linkageTable).fields.find(f => f.meta?.name === '_uuid')?.uid
        const subFormFields = this.getTable(rule.linkageTable).fields.filter(item => item.meta?.extra?.widgetType === 'widget.form.subform')
        for(const subF of subFormFields) {
          const tempRows = [];
          const dataSource = this.getTable(subF.meta?.extra?.subTableUID)?.fields?.find(f => f.meta?.name === '_key')?.uid
          const rowKeys = dataUid ? _rows?.map(row => row[dataUid]).filter(Boolean) : [];
          if(!dataSource || !rowKeys?.length) continue;
          const subFormRows = await (this.topForm as any).getTableData(subF.meta?.extra?.subTableUID, {
            filters: {
              [subF.meta?.extra?.subTableUID?.[1]]: [{
                [dataSource]: {
                  $in: rowKeys,
                }
              }],
            }
          })
          // const uniqueRows = Array.from(
          //   new Map(subFormRows.map(item => [item[dataSource], item])).values()
          // );
          // if(!uniqueRows?.length) continue;
          if(!subFormRows?.length) continue;
          for(let row of _rows) {
            const subFormRow = subFormRows.filter(r => r[dataSource] === row[dataUid])
            if(subFormRow?.length) {
              tempRows.push({...row, [subF.uid]: subFormRow});
            } else {
              tempRows.push(row);
            }
          }
          _rows = tempRows;
        }
        if (this.fieldFillWatchVersions.get(watchKey) !== watchVersion) return;

        const rows = _rows?.filter(r => {
          const func = rule.logic === LogicalOperator.AND ? "every" : "some";
          return rule.conditions[func](c => {
            try {
              return funcMap[c.func]?.(c.type === FormConditionValueType.FORM ? r[c.uid] : c.fixedValue, newVal[c.id || c.uid])
            } catch (error) {
              return false;
            }
          });
        })
        const canFillCurrentSubForm = currentSubFormFillWidgets.some(item => item.fillWidget === this.form.uid);
        applyLinkageFillRuleRows(rule, rows || [], {
          resolveWidget: widgetUID => canFillCurrentSubForm ? (this.topForm as AbstractForm).getChildElement(widgetUID) : null,
          resolveSubWidget: (subFormUID, widgetUID) => {
            if (subFormUID !== this.form.uid) return null;
            const child = this.form.getChildElement(widgetUID);
            return this.children.find(c => c.fieldId === child?.fieldId);
          },
          canFillSubWidget: (_subFormUID, linkageSubFields) => this.isAllowFillWidget(this.form, linkageSubFields || []),
        });
      }, { deep: true, immediate: this._row.value.isManualAdd })
    }
  }
  // 单个条件的计算函数
  private isConditionMet(cond: FormCondition): boolean {
    let fieldValue;
    if (cond.uid.split('.').length > 1) {
      const subFormRowChildFieldId = this.form.getChildElement(cond.uid.split('.')[1])?.fieldId;
      const subFormRowChild = this.children.find(c => c.fieldId === subFormRowChildFieldId);
      fieldValue = subFormRowChild?.inputValue;
    } else {
      fieldValue = this.topForm.getChildElement(cond.uid)?.inputValue;
    }
    const targetValue = cond.value;
    return funcMap[cond.func]?.(fieldValue, targetValue);
  }

  private controlFieldVisible(cond: FormCondition): boolean {
    let widget: FormElement;
    if (cond.uid.split('.').length > 1) {
      const subFormRowChildFieldId = this.form.getChildElement(cond.uid.split('.')[1])?.fieldId;
      widget = this.children.find(c => c.fieldId === subFormRowChildFieldId);
    } else {
      widget = this.topForm.getChildElement(cond.uid);
    }
    // 如果组件自身隐藏属性开启，则自己隐藏不影响被控组件隐藏
    if (!widget.getOption<boolean>("is-hidden")) {
      return !widget.isHidden;
    } else {
      return true;
    }
  }

  isChildShow(widget) {
    if (this.topForm?.isForceShownWidget?.(widget)) {
      return true;
    }

    const matchedRules = (this.form as AbstractSubForm)?.getSubFieldVisibleRules(widget.uid);

    if (isEmpty(matchedRules)) {
      // 没有规则，默认显示
      return true;
    }

    const { showRules, hideRules } = matchedRules;
    // const showRules = matchedRules.filter(rule => rule.visibleType !== VisibleType.HIDE);
    // const hideRules = matchedRules.filter(rule => rule.visibleType === VisibleType.HIDE);

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
}

export class AbstractFormLayout extends BaseWidget {
  declare public parent: AbstractForm | AbstractFormLayout;
  constructor(soul: Soul, parent: AbstractForm | AbstractFormLayout) {
    super(soul, parent);
    this.initContainer();
  }
  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          children: [
            {
              name: "container-layout",
              default: "fluid",
            },
            {
              name: "container-layout-fluid",
              children: [
                {
                  name: "fluid-gap-value",
                  default: 20,
                },
                {
                  name: "padding",
                  default: [12, 12, 12, 12],
                },
              ],
            }
          ]
        },
        "widget-title": {
          visible: false,
        },
        basicStyle: {
          alias: i18next.t('form.style'),
          fold: "unfold",
          children: [
            {
              name: "title-text",
              alias: i18next.t('form.title'),
              type: "string",
              default: (widget: FormElement)=>{
                return widget.name;
              },
            },
          ]
        },
      },
    }];
  }
  
  get title() {
    return this.getOption<string>("title-text");
  }

  get form(): AbstractForm | AbstractSubForm {
    let parent = this.parent;
    while (parent) {
      if (parent instanceof AbstractForm || parent instanceof AbstractSubForm) {
        return parent;
      }
      parent = parent.parent;
    }
    return null;
  }

  get topForm(): AbstractForm {
    if (this.form instanceof AbstractSubForm) {
      return this.form.topForm;
    }
    return this.form;
  }

  setWidgetAuth(
    fieldsAuth: Record<string, FieldAuthValue>,
    permissionFieldsAuth: Record<string, FieldAuthValue> = {},
  ) {
    const auth = fieldsAuth[this.uid];
    const permissionAuth = permissionFieldsAuth[this.uid];
    // 布局容器与普通字段保持相同语义，不能用 false 吞掉容器自身的静态配置。
    this.setReadonlyInProcess(auth === FieldAuthValue.VISIBLE ? true : undefined);
    this.setHiddenInProcess(auth !== void 0 && auth < FieldAuthValue.VISIBLE ? true : undefined);
    this.setHiddenByFieldPermission(permissionAuth !== void 0 && permissionAuth < FieldAuthValue.VISIBLE);
    for (const widget of this.children as FormElement[]) {
      widget.setWidgetAuth(fieldsAuth, permissionFieldsAuth);
    }
  }
  setWidgetRequired(requiredFieldsAuth: Record<string, boolean>) {
    for (const widget of this.children as FormElement[]) {
      widget.setWidgetRequired(requiredFieldsAuth);
    }
  }

  private _isReadonlyInProcess: Ref<boolean | undefined> = ref();
  private _isHiddenInProcess: Ref<boolean | undefined> = ref();
  private _isHiddenByFieldPermission: Ref<boolean> = ref(false);
  // 布局容器同样需要支持清除旧权限状态，不能把 undefined 通过默认参数改写为 true。
  public setReadonlyInProcess(value: boolean | undefined) {
    this._isReadonlyInProcess.value = value;
  }
  public setHiddenInProcess(value: boolean | undefined) {
    this._isHiddenInProcess.value = value;
  }
  public setHiddenByFieldPermission(value = true) {
    this._isHiddenByFieldPermission.value = value;
  }
  get isReadonly() {
    return this.topForm?.isViewing || (this._isReadonlyInProcess.value ?? (getFieldReadonlyMode(this as unknown as FormElement) === "on" || isConditionalReadonly(this as unknown as FormElement)));
  }
  private resolveIsHidden(): boolean {
    if (this.topForm?.isForceShownWidget?.(this)) {
      return false;
    }
    const state = this.topForm?.isFormInputHidden?.(this as any) || (this._isHiddenInProcess.value ?? this.getOption<boolean>("is-hidden")) || !this.parent.container.shouldShowWidget(this) || this.parent.isHidden;
    return !!state;
  }
  
  private readonly _isHiddenComputed: ComputedRef<boolean> = this.effectScope.run(
    () => computed(() => {
      return this.resolveIsHidden();
    }),
  );
  get isHidden() {
    return this._isHiddenComputed.value;
  }
  // 布局容器沿父级传递权限隐藏状态，避免子字段被误当作业务隐藏字段处理。
  get isHiddenByFieldPermission() {
    return this._isHiddenByFieldPermission.value || !!(this.parent as any)?.isHiddenByFieldPermission;
  }

  get isInSubForm() {
    return false;
  }

  isChildShow(widget: FormElement) {
    return (this.topForm as AbstractForm).isChildShow(widget);
  }

  async bringChildIntoView(element: FormElement) {
    element.dom?.scrollIntoView({ behavior: "smooth" });
  }
}


function getUniqueName(columns: TableColumn[], name: string) {
  let _name = name;
  let i = 1;
  while (columns.find((column) => column.name === _name)) {
    _name = `${name}_${i}`;
    i++;
  }
  return _name;
}
