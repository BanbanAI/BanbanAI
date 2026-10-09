import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { isNocodeFormData } from "@common/utils/connection";
import { DefinedOptions } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import { Widget } from "@renderer/b2/controllers/widget";
import { WidgetSoul } from "@common/types/project";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref, nextTick, watch, defineAsyncComponent } from "vue";
import { CountingRule, SerialNumberCounter, SerialNumberRule } from "./type";
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import utc from 'dayjs/plugin/utc';
import { unique } from "@common/utils/unique"
import { isEmpty } from "@common/utils/object";
import { FormMode } from "../_common/type";
import { flattenDepartments, formatSerialNumber, getNextSerialNumberCounter, getSubSerialNumberCounterFieldId } from "./utils";

dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);
dayjs.extend(utc);

export class SerialNumber extends FormElement {
  static resource = resource as any;
  private _fieldDisplaySourcesReady?: Promise<void>;
  private _fieldDisplaySourcesSignature?: string;

  constructor(soul: WidgetSoul, parent: Widget) {
    super(soul, parent);
  }

  initAfterConstructor() {
    super.initAfterConstructor();

    this.effectScope.run(() => {
      const stop = watch(() => this.getBoard().isProjectReady, (value) => {
        if (!value) return;
        this.preloadFieldDisplaySources();
        nextTick(() => {
          stop();
        });
      }, { immediate: true });
    });
  }

  public preloadFieldDisplaySources() {
    const fieldRules = (this.getResolvedSerialNumberRules() || [])
      .filter(rule => rule.type === "field") as Array<{ id: string; type: "field"; value: string }>;
    const signature = fieldRules.map(rule => rule.value).sort().join(",");

    if (!this._fieldDisplaySourcesReady || this._fieldDisplaySourcesSignature !== signature) {
      this._fieldDisplaySourcesSignature = signature;
      this._fieldDisplaySourcesReady = (async () => {
        const targetWidgets = fieldRules
          .map(rule => this.form.children.find(child => ((child as any).originId ?? child.uid) === rule.value) as any)
          .filter(Boolean);

        for (const targetWidget of targetWidgets) {
          if (targetWidget.type === "widget.form.memberSelect" && !targetWidget.allUserList?.length) {
            targetWidget.allUserList = await targetWidget.getBoard().getOrganizeUsers();
          }

          if (targetWidget.type === "widget.form.departmentSelect" && !targetWidget.allDepartmentsList?.length) {
            targetWidget.allDepartmentsList = flattenDepartments(await targetWidget.getBoard().getOrganizeDepartments());
          }
        }
      })();
    }
    return this._fieldDisplaySourcesReady;
  }

  private getCurrentWidgetUid() {
    return (this as any).originId ?? this.uid;
  }

  private getCurrentSubForm() {
    if (!this.isInSubForm) return undefined;

    const currentForm = this.form as any;
    if (currentForm?.field?.subTableFields) {
      return currentForm;
    }

    if (currentForm?.parent?.field?.subTableFields) {
      return currentForm.parent;
    }

    return undefined;
  }

  private getCurrentTableUID() {
    if (!this.isInSubForm) {
      return this.form?.tableUID;
    }

    const subForm = this.getCurrentSubForm();
    return subForm?.tableUID || subForm?.field?.meta?.extra?.subTableUID;
  }

  private getCurrentField() {
    if (this.field) {
      return this.field;
    }

    const widgetUid = this.getCurrentWidgetUid();
    return this.getCurrentSubForm()?.field?.subTableFields?.find(field => field.meta?.uid === widgetUid);
  }

  private getCurrentColumn() {
    const connections = this.getBoard().getConnections().find(c => isNocodeFormData(c));
    const currentTableUID = this.getCurrentTableUID();
    const tableUid = Array.isArray(currentTableUID) ? currentTableUID[currentTableUID.length - 1] : undefined;
    if (!tableUid) return undefined;

    const metaTableUid = connections?.tables?.find(t => t.uid === tableUid)?.meta?.uid;
    const formDataTable = connections?.options.tables.find(t => t.uid === metaTableUid);
    const widgetUid = this.getCurrentWidgetUid();
    return formDataTable?.columns.find(c => c.uid === widgetUid || c.meta?.uid === widgetUid);
  }

  private getSerialNumberSetting() {
    const col = this.getCurrentColumn();
    if (col?.extra?.serialNumber) {
      return col.extra.serialNumber;
    }

    const field = this.getCurrentField();
    return field?.meta?.extra?.serialNumber || field?.extra?.serialNumber;
  }

  private ensureSerialNumberSetting() {
    const col = this.getCurrentColumn();
    if (col) {
      if (!col.extra) {
        col.extra = {};
      }
      if (!col.extra.serialNumber) {
        col.extra.serialNumber = {};
      }
      return col.extra.serialNumber;
    }

    const field = this.getCurrentField();
    if (field?.meta?.extra) {
      if (!field.meta.extra.serialNumber) {
        field.meta.extra.serialNumber = {};
      }
      return field.meta.extra.serialNumber;
    }

    if (field?.extra) {
      if (!field.extra.serialNumber) {
        field.extra.serialNumber = {};
      }
      return field.extra.serialNumber;
    }

    return undefined;
  }

  private getResolvedSerialNumberRules() {
    const rules = this.serialNumberRules ?? [];
    if (!this.isInSubForm) {
      return rules;
    }

    return rules.map((rule) => {
      if (rule.type !== "counting") {
        return rule;
      }

      return {
        ...rule,
        value: {
          ...rule.value,
          resetOnSubmit: this.subSerialNumberResetOnSubmit,
        },
      };
    });
  }

  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basicStyle: {
          children: [
            {
              name: "width-subform",
              default: 200,
            },
            {
              name: "placeholder",
              alias: i18next.t("tipText"),
              default: i18next.t("pleaseInput"),
              type: "string",
            },
            {
              name: "serial-number-rules",
              alias: i18next.t("serialNumberRules"),
              type: "dialog",
              dialog: {
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/SerialNumberRulesDialog.vue")),
                buttonText: (widget: SerialNumber)=>{
                  if (widget.getOption("serial-number-rules")) {
                    return i18next.t("configured");
                  }
                  return i18next.t("set");
                },
                buttonStyle(element, paths) {
                  const value = element.getOption("serial-number-rules");
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              },
              default: (element: SerialNumber, paths) => {
                const rules = element.getSerialNumberSetting()?.rules;

                return rules ?? [
                  {
                    id: unique(),
                    type: 'counting',
                    value: {
                      digitLength: 5,
                      digitFixed: false,
                      resetCycle: 'none',
                      startValue: 0
                    }
                  }
                ]
              },
            },
            {
              name: "sub-serial-number-reset-on-submit",
              alias: i18next.t("resetSerialNumberOnSubmit"),
              type: "boolean",
              visible: (widget: SerialNumber) => {
                return widget.isInSubForm;
              },
              default: (element: SerialNumber) => {
                const countingRule = element.getSerialNumberSetting()?.rules?.find(rule => rule.type === "counting");
                const resetOnSubmit = countingRule?.value?.resetOnSubmit;
                return resetOnSubmit ?? true;
              }
            },
            {
              name: `serial-number-reset`,
              alias: i18next.t("serialNumberReset"),
              type: "button(size=small)",
              visible: (widget: SerialNumber) => {
                return !widget.isInSubForm;
              },
              buttonText: (widget: SerialNumber)=>{
                const {currentCount, isCounting} = widget.countState;
                if (isCounting) {
                  return i18next.t("resetCounted", { count: currentCount });
                }
                return i18next.t("reset");
              },
              buttonStyle(element: SerialNumber, paths) {
                const {isCounting} = element.countState;
                return isCounting ? { color: 'var(--color-primary)' } : {}
              },
              buttonClick(element: SerialNumber, paths) {
                element.resetCounting();
                element.getBoard().updateHistory();
              },
            }
          ],
        },
        scanInput: {
          visible: false,
        },
        validation: {
          children: [
            {
              name: "required",
              visible: false
            },
          ],
        },
      },
    }, ...super.defineOptions()];
  }

  get placeholder() {
    return this.getOption("placeholder");
  }
  get isEditMode() {
    return this.getBoard().formMode === FormMode.Edit;
  }

  protected _inputValue: Ref<string> = ref(); // count计数
  public set inputValue(value: string) {
    this._inputValue.value = value;
    this.updateLastChangeTime();
  }

  get inputValue(): string {
    return this._inputValue.value ?? this.initialValue ?? null;
  }

  public resetCounting() {
    const serialNumber = this.getSerialNumberSetting();
    if (!serialNumber) return;
    const startValue = this.countingRule?.value.startValue ?? 1;
    serialNumber.count = Number(startValue) - 1;
    serialNumber.updateTime = Date.now();
  }

  get countState() {
    if (this.isInSubForm) {
      return {
        currentCount: undefined,
        isCounting: false
      }
    }
    const currentCount = this.getSerialNumberSetting()?.count;
    const startValue = this.countingRule?.value.startValue ?? 0;
    return {
      currentCount,
      isCounting: currentCount !== undefined && currentCount >= startValue
    }
  }

  protected async doValidate() {

  }

  get serialNumberRules(): SerialNumberRule[] {
    return this.getOption("serial-number-rules");
  }

  set serialNumberRules(serialNumberRule: SerialNumberRule[]) {
    this.setOption("serial-number-rules", serialNumberRule);
  }

  get count(): number {
    return this.getOption("count");
  }

  set count(count: number) {
    this.setOption("count", count);
  }

  // get resetTime(): number {
  //   return this.getOption("reset-time");
  // }

  // set resetTime(resetTime: number) {
  //   this.setOption("reset-time", resetTime);
  // }

  get defaultName() {
    return i18next.t("defaultName");
  }

  get subSerialNumberResetOnSubmit() {
    const optionValue = this.getOption<boolean>("sub-serial-number-reset-on-submit", { skipDefault: true });
    if (optionValue !== undefined) {
      return optionValue;
    }

    const resetOnSubmit = this.getSerialNumberSetting()?.rules?.find(rule => rule.type === "counting")?.value?.resetOnSubmit;
    return resetOnSubmit ?? true;
  }

  get countingRule(): CountingRule {
    const rules = (this.getResolvedSerialNumberRules() || []) as SerialNumberRule[];
    return rules.find((rule): rule is CountingRule => rule.type === "counting");
  }

  get resetOnSubmit() {
    return this.countingRule?.value?.resetOnSubmit ?? true;
  }

  get subSerialNumberCounterFieldId() {
    return getSubSerialNumberCounterFieldId(this.uid);
  }

  get subSerialNumberCounterRowFieldId() {
    const topTable = this.topForm?.getTable?.(this.topForm?.tableUID);
    return topTable?.fields?.find(field => field.meta?.uid === this.subSerialNumberCounterFieldId)?.uid || this.subSerialNumberCounterFieldId;
  }

  get subSerialNumberTableId() {
    const tableUID = this.getCurrentTableUID();
    return Array.isArray(tableUID) ? tableUID[1] : undefined;
  }

  get subSerialNumberFieldId() {
    return this.getCurrentField()?.uid;
  }

  private getCurrentSubFormRows() {
    const subForm = this.getCurrentSubForm();
    const subFormFieldId = subForm?.field?.uid || subForm?.fieldId;
    const rows = subFormFieldId ? this.topForm?.getRow?.()?.[subFormFieldId] : undefined;
    return Array.isArray(rows) ? rows : [];
  }

  private getFallbackSubSerialNumberCounter() {
    if (!this.resetOnSubmit) return undefined;

    const fieldId = this.subSerialNumberFieldId;
    if (!fieldId) return undefined;

    const countedRows = this.getCurrentSubFormRows().filter(row => !isEmpty(row?.[fieldId]));
    if (!countedRows.length) return undefined;

    const startValue = Number(this.countingRule?.value?.startValue ?? 0);
    return {
      count: startValue + countedRows.length - 1,
    } as SerialNumberCounter;
  }

  private getLatestSubSerialNumberCounter(...counters: Array<SerialNumberCounter | undefined>) {
    return counters
      .filter(counter => counter && (counter.count !== undefined || counter.resetTime !== undefined || counter.updateTime !== undefined))
      .reduce<SerialNumberCounter | undefined>((latest, current) => {
        if (!latest) return current;
        if (!current) return latest;

        const latestUpdateTime = latest.updateTime ?? 0;
        const currentUpdateTime = current.updateTime ?? 0;
        return currentUpdateTime > latestUpdateTime ? current : latest;
      }, undefined);
  }

  public getNextSubSerialNumberCount() {
    if (!this.isInSubForm) return undefined;

    const formRow = this.topForm.getRow() ?? {};
    if (!this.topForm.getRow()) {
      this.topForm.setRow(formRow);
    }

    const rowCounterFieldId = this.subSerialNumberCounterRowFieldId;
    const rowCounter = formRow[rowCounterFieldId] ?? formRow[this.subSerialNumberCounterFieldId];
    const currentCounter = this.resetOnSubmit
      ? (rowCounter ?? this.getFallbackSubSerialNumberCounter())
      : this.getLatestSubSerialNumberCounter(rowCounter, this.getSerialNumberSetting());
    const nextCounter = getNextSerialNumberCounter(currentCounter, this.countingRule);
    formRow[rowCounterFieldId] = nextCounter;
    if (rowCounterFieldId !== this.subSerialNumberCounterFieldId) {
      delete formRow[this.subSerialNumberCounterFieldId];
    }

    return nextCounter.count;
  }

  public handleSubSerialNumberSubmitSuccess(counter?: SerialNumberCounter) {
    if (this.resetOnSubmit || !counter) {
      return;
    }

    const serialNumber = this.ensureSerialNumberSetting();
    if (!serialNumber) return;

    serialNumber.count = counter.count;
    serialNumber.resetTime = counter.resetTime;
    serialNumber.updateTime = counter.updateTime;
  }

  public formatSubSerialNumber(serialNumber: number, row?: Record<string, any>) {
    return formatSerialNumber(serialNumber, this.getResolvedSerialNumberRules(), this, row);
  }

  resolveFormSetting() {
    const formSetting = super.resolveFormSetting();
    const serialNumber = this.getSerialNumberSetting();

    return {
      ...formSetting,
      subType: "text",
      extra: {
        ...(formSetting?.extra || {}),
        serialNumber: {
          count: serialNumber?.count,
          resetTime: serialNumber?.resetTime,
          updateTime: serialNumber?.updateTime,
          rules: this.getResolvedSerialNumberRules(),
        },
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
      }
    }
  }
}
