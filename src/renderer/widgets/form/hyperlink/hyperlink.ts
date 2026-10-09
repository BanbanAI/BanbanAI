import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { replaceByFormula, findIdByFormula, collectFormulaFieldUsages, FormulaConfig } from "@common/utils/formula";
import { isNocodeFormData } from "@common/utils/connection";
import { DefinedOptions, GetOptionOptions } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { nextTick, Ref, ref, watch, defineAsyncComponent } from "vue";
import { isEmpty } from "@common/utils/object";
import { buildFormulaValueMap, getFormulaFieldValues, processFormulaResult } from "@renderer/widgets/form/form/function";
import { useFormulaWatcher } from "@renderer/widgets/form/form/useFormulaWatcher";
import { FormMode } from "../_common/type";
import { ElInput } from "element-plus";
import { OptionValue, Table } from "@common/types/project";

const isSubTable = (table: Table) => {
  return !isEmpty(table.meta?.extra?.primaryTable);
}

export class Hyperlink extends FormElement {
  static resource = resource as any;

  private _inputInstance: InstanceType<typeof ElInput> | null = null;

  set inputInstance(instance: InstanceType<typeof ElInput> | null) {
    this._inputInstance = instance;
  }

  initAfterConstructor() {
    super.initAfterConstructor();

    if (this.defaultType === "formula" && this.defaultFormulaValue && !this.isEditable) {
      const stop = watch(() => this.getBoard().isProjectReady, async (value) => {
        if (value) {
          this.watchDefaultFormula();
          nextTick(() => {
            stop();
          })
        }
      }, { immediate: true })
    }
  }


  get isEditMode() {
    return this.getBoard().formMode === FormMode.Edit;
  }

  private watchDefaultFormula() {
    this.effectScope.run(() => {
      useFormulaWatcher({
        formElement: this,
        formula: this.defaultFormulaValue,
        fieldType: this.fieldType,
        isEditMode: this.isEditMode,
        normalizeResult: (value) => processFormulaResult(value, this.fieldType),
        onApplyResult: (value) => {
          this._inputValue.value = value;
        }
      });
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
              name: "link-type",
              alias: i18next.t("linkType"),
              type: "select(radioGroup)",
              selectChoices: [
                { label: i18next.t("textLink"), value: "text" },
                { label: i18next.t("linkOtherForm"), value: "form" },
              ],
              default: "text",
            },
            {
              name: "link-form-range",
              alias: i18next.t("linkFormRange"),
              type: "check-select(multiple,tree,allCheck)",
              clearable: true,
              selectChoices: (widget: Hyperlink) => {
                return widget.allTableChoices || [];
              },
              placeholder: i18next.t("pleaseSelect"),
              visible: (widget: Hyperlink) => {
                return widget.getOption<"text"|"form">("link-type") === "form";
              },
            },
            {
              name: "default-type",
              alias: i18next.t("defaultValue"),
              type: "select(radioGroup)",
              selectChoices: [
                { label: i18next.t("custom"), value: "custom" },
                { label: i18next.t("formulaEdit"), value: "formula" }
              ],
              default: "custom",
              visible: (widget: Hyperlink) => {
                return widget.getOption<"text"|"form">("link-type") === "text";
              },
            },
            {
              name: "default-value",
              alias: "",
              type: "string",
              default: "",
              visible: (widget: Hyperlink) => {
                return widget.getOption<"custom"|"formula">("default-type") === "custom" && widget.getOption<"text"|"form">("link-type") === "text";
              },
            },
            {
              name: "default-formula",
              alias: "",
              type: "dialog",
              dialog: {
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/formula/FormDefaultValueFormulaDialog.vue")),
                buttonText: (widget: Hyperlink) => {
                  if (widget.getOption("default-formula")) {
                    return i18next.t("formulaSet");
                  }
                  return i18next.t("editFormula");
                },
                buttonStyle(element, paths) {
                  const value = element.getOption("default-formula");
                  return (isEmpty(value) || value === "") ? {} : { color: 'var(--color-primary)' }
                },
              },
              visible: (widget: Hyperlink) => {
                return widget.getOption<"custom"|"formula">("default-type") === "formula" && widget.getOption<"text"|"form">("link-type") === "text";
              },
            },
            {
              name: "link-text",
              alias: i18next.t("linkDisplayText"),
              default: i18next.t("viewLink"),
              type: "string",
              visible: (widget: Hyperlink) => {
                return widget.getOption<"text"|"form">("link-type") === "text";
              },
            },
            {
              name: "default-form",
              alias: i18next.t("defaultValue"),
              type: "select",
              clearable: true,
              selectChoices: (widget: Hyperlink) => {
                return widget.tableChoices;
              },
              placeholder: i18next.t("pleaseSelect"),
              visible: (widget: Hyperlink) => {
                return widget.getOption<"text"|"form">("link-type") === "form";
              },
            },
            {
              name: "open-form-type",
              alias: i18next.t("openMode"),
              type: "select",
              selectChoices: [
                { label: i18next.t("dialog"), value: "dialog" },
                { label: i18next.t("newTab"), value: "blank" },
              ],
              default: (widget: Hyperlink) => {
                return widget.linkType === "form" ? "dialog" : "blank";
              },
            }
          ],
        },
        scanInput: {
          visible: false,
        },
        linkForm: {
          visible: false,
        },
      },
    }, ...super.defineOptions()];
  }

  get placeholder() {
    return this.getOption<string>("placeholder");
  }

  get defaultValue(): string {
    return this.linkType === 'form' ? this.getOption<string>("default-form") : this.getOption<string>("default-value");
  }

  protected _inputValue: Ref<string> = ref();
  public get inputValue() {
    const getInputValue = () => {
      let defalutValue = this.defaultValue
      if(this._inputValue.value === "") {
        return null
      }
      return this._inputValue.value ?? this.initialValue ?? defalutValue;
    }
    const result = getInputValue()
    if(this.linkType === 'form') {
      if(!!this.tableChoices?.find(t => t.value === result)) {
        return result
      }
      return null
    }
    return result
  }
  public set inputValue(value: string) {
    this._inputValue.value = value;
    this.updateLastChangeTime();
  }

  protected async doValidate() {
    if (!this.inputValue) return;
    if (typeof this.inputValue === 'object' &&
      Object.keys(this.inputValue).length === 0) return;

    // 超链接格式校验
    if (!this.isValidUrl(this.inputValue) && this.linkType != 'form') {
      throw new Error(i18next.t("invalidUrl"));
    }
  }

  private isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString);
      return true;
    } catch (_) {
      return false;
    }
  }

  get defaultType() {
    return this.getOption<"custom"|"formula">("default-type");
  }

  set defaultValue(value: string ){
    if(this.linkType === 'form') {
      this.setOption("default-form", value);
      return
    }
    this.setOption("default-value", value);
  }

  get defaultFormulaValue() {
    return this.getOption<string | FormulaConfig>("default-formula");
  }

  get defaultFormulaValueString() {
    if (typeof this.defaultFormulaValue === "string") {
      return this.defaultFormulaValue as string
    }
    if (typeof this.defaultFormulaValue?.formula === "string") {
      return this.defaultFormulaValue.formula as string
    }
    return JSON.stringify(this.defaultFormulaValue)
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  get linkType() {
    return this.getOption<"text"|"form">("link-type");
  }

  get linkHref() {
    if(this.linkType === 'form') {
      const nocodeId = this.getBoard().nocodeId
      const [formDataUID, tableUID] = this.inputValue?.split(',') || [];
      return `/#/app/${nocodeId}/${tableUID}`
    }
    return this.inputValue || ''
  }

  get allTableChoices() {
    const connections = this.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || [];
    const canView = (tableUID: string) => (this.topForm as any)?.canReadLayerDataSync?.(tableUID);
    if (connections.length === 1) {
      return connections[0]?.tables.filter(t => !isSubTable(t) && canView(t.uid)).map(t => {
        const alias = this.topForm?.tableUID?.[1] !== t.uid  ? t.alias : i18next.t("currentFormLabel");
        return {
          label: alias,
          value: [connections[0].uid, t.uid].join(","),
          isCurrent: t.uid === this.topForm?.tableUID?.[1] ? 1 : 0,
        };
      }).sort((a, b) => {
        return b.isCurrent - a.isCurrent;
      })
    }

    return connections.map(c => {
      return {
        label: c.name,
        value: c.uid,
        children: c.tables.filter(t => this.topForm?.tableUID?.[1] !== t.uid && !isSubTable(t) && canView(t.uid)).map(t => {
          const alias = this.topForm?.tableUID?.[1] !== t.uid  ? t.alias : i18next.t("currentFormLabel");
          return {
            label: alias,
            value: [c.uid, t.uid].join(","),
            isCurrent: t.uid === this.topForm?.tableUID?.[1] ? 1 : 0,
          };
        }).sort((a, b) => b.isCurrent - a.isCurrent),
        isCurrent: c.tables.some(t => t.uid === this.topForm?.tableUID?.[1] && canView(t.uid)) ? 1 : 0,
      }
    }).filter(item => item.children?.length).sort((a, b) => b.isCurrent - a.isCurrent);;
  }
  get tableChoices() {
    const currentConnectionUID = this.topForm?.tableUID?.[0];
    const choices = (this.allTableChoices || []).flatMap((item: any) => {
      if (!Array.isArray(item.children)) {
        return [item];
      }

      return item.children.map((child: any) => {
        const isCrossAppTable = item.value !== currentConnectionUID;
        return {
          ...child,
          label: isCrossAppTable && item.label ? `[${item.label}]${child.label}` : child.label,
        };
      });
    });

    return choices.filter(t => (this.linkFormRange || []).includes(t.value))
  }

  get openFormType() {
    return this.getOption<"dialog"|"blank">("open-form-type");
  }

  get linkFormRange() {
    return this.getOption<string[]>("link-form-range") || [];
  }
  override setOption(paths: string | string[], value: OptionValue, history?: boolean): void {
    if (!Array.isArray(paths)) {
      paths = [paths];
    }

    const path = paths.at(-1);

    if (path === "default-form") {
      const nextValue = typeof value === "string" && this.linkFormRange.includes(value) ? value : null;
      super.setOption(paths, nextValue, history);
      return;
    }

    if (path === "link-form-range") {
      const nextRange = Array.isArray(value) ? value : [];
      super.setOption(paths, value, history);

      const defaultForm = super.getOption<string>("default-form");
      if (defaultForm && !nextRange.includes(defaultForm)) {
        super.setOption("default-form", null, false);
      }
      return;
    }

    if (path === "link-type") {
      super.setOption(paths, value, false);
      super.setOption("open-form-type", value === "form" ? "dialog" : "blank", false);
      if (history !== false) {
        this.getBoard()?.updateHistory();
      }
      return;
    }

    super.setOption(paths, value, history);
  }

  override getOption<T extends OptionValue>(paths: string | string[], options?: GetOptionOptions): T {
    if (!Array.isArray(paths)) {
      paths = [paths];
    }

    if (paths.at(-1) === "default-form") {
      const defaultForm = super.getOption<string>("default-form");
      if (!defaultForm) {
        return null as T;
      }

      return (this.linkFormRange.includes(defaultForm) ? defaultForm : null) as T;
    }

    return super.getOption<T>(paths, options);
  }

  public otherTableDataCache: Record<string, Record<string, any>> = {};

  // 超链接信息
  resolveFormSetting() {
    let defaultLinkAddress;
    if (this.getOption<"custom"|"formula">("default-type") === "custom"){
      defaultLinkAddress = this.getOption("default-value");
    } else if(this.getOption<"custom"|"formula">("default-type") === "formula"){
      const ids = findIdByFormula(this.defaultFormulaValueString);
      const formulaFieldMap = collectFormulaFieldUsages(this.defaultFormulaValueString);
      const dependencyMap = getFormulaFieldValues(this as any, ids, formulaFieldMap);
      const valueMap = buildFormulaValueMap({
        formElement: this as any,
        commonDeps: dependencyMap.formulaDeps,
        queryDeps: dependencyMap.queryDeps,
        formulaFieldMap,
      });
      const replaceCursor: Record<string, number> = {};
      defaultLinkAddress = replaceByFormula(this.defaultFormulaValueString, (keys) => {
        const id = keys.join('.');
        const values = valueMap[keys.join('.')];
        if (Array.isArray(values)) {
          const index = replaceCursor[id] ?? 0;
          replaceCursor[id] = index + 1;
          return values[index] ?? values[0] ?? '';
        }
        return values ?? '';
      });
    }

    return {
      ...super.resolveFormSetting(),
      subType: "hyperlink",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        hyperlink: {
          linkText: this.getOption("link-text"),
          defaultLinkAddress: defaultLinkAddress,
        },
        defaultValueType: this.defaultType,
        defaultValue: this.defaultValue,
        formula: this.defaultFormulaValueString,
        linkType: this.linkType,
        linkFormRange: this.linkFormRange,
        openFormType: this.openFormType,
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.IN]: RuleFuncValue.TAGS,
        [RuleFunc.NOT_IN]: RuleFuncValue.TAGS,
        [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
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
        [RuleFunc.IN]: RuleFuncValue.TAGS,
        [RuleFunc.NOT_IN]: RuleFuncValue.TAGS,
      }
    };
  }

  command(cmd: string) {
    if (cmd === "focus") {
      this._inputInstance?.focus();
    } else if (cmd === "select") {
      this._inputInstance?.select();
    }
  }
}

