import { getUUIDSystemField, SystemField, isNocodeFormData } from "@common/utils/connection";
import { FieldUID } from "@common/types/project";
import { FormElementConfiguration, RuleFunc, RuleFuncValue, AggregationType } from "@common/types/nocode";
import { DefinedOptions } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { WidgetSoul } from "@common/types/project";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { ref } from "vue";
import { TheWidget as SelectData } from "@renderer/widgets/form/selectData";
import { deepClone, isEmpty } from "@common/utils/object";
import { DataMode } from "./types";

export class RelatedData extends SelectData {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }

  private _isRelatedConnection = ref(false);
  constructor(soul: WidgetSoul, parent: Widget) {
    super(soul, parent);
    this._isRelatedConnection.value = !isEmpty(this.connectionTable);
  }

  isCreateField() {
    return true;
  }

  async onSave() {
    this._isRelatedConnection.value = !isEmpty(this.connectionTable);
  }

  get dataMode() {
    // if (this.inSubForm) return DataMode.SINGLE;
    return this.getOption<DataMode>("dataMode");
  }

  override get isMultiple() {
    if (this.dataMode === DataMode.MULTIPLE) {
      return true;
    }
    return super.isMultiple;
  }

  get titleField() {
    return this.connectionTableFields.find(f => f.meta.name === SystemField.DATA_TITLE)
  }

  get uuidField() {
    return getUUIDSystemField(this.connectionTableFields);
  }

  get isRelated() {
    return !isEmpty(this.selectedRows);
  }

  get dataValue(): string {
    return this.form.getFormInputValue(this.fieldId);
  }

  get isChanged() {
    return !!this.status.lastChangeTime;
  }

  get tableChoices() {
    const connections = this.getBoard().getConnections()?.filter(c => {
      return isNocodeFormData(c);
    }) || [];

    if (connections.length === 1) {
      return connections[0]?.tables.filter(t => isEmpty(t.meta?.extra?.primaryTable) && !!connections[0]?.formOptions?.[t.uid]).map(t => {
        const alias = this.topForm?.tableUID[1] !== t.uid ? t.alias : i18next.t("currentForm");
        return {
          label: alias,
          value: [connections[0].uid, t.uid].join(","),
          isCurrent: t.uid === this.topForm?.tableUID[1] ? 1 : 0,
        };
      }).sort((a, b) => {
        return b.isCurrent - a.isCurrent;
      })
    }

    return connections.map(c => {
      return {
        label: c.name,
        value: c.uid,
        children: c.tables.filter(t => isEmpty(t.meta?.extra?.primaryTable) && !!c?.formOptions?.[t.uid]).map(t => {
          const alias = this.topForm?.tableUID[0] === c.uid && this.topForm?.tableUID[1] === t.uid ? i18next.t("currentForm") : t.alias;
          return {
            label: alias,
            value: [c.uid, t.uid].join(","),
            isCurrent: t.uid === this.topForm?.tableUID[1] ? 1 : 0,
          };
        }).sort((a, b) => b.isCurrent - a.isCurrent),
        isCurrent: c.tables.some(t => t.uid === this.topForm?.tableUID[1]) ? 1 : 0,
      }
    }).sort((a, b) => b.isCurrent - a.isCurrent);
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-value",
                alias: i18next.t("axisValue"),
                type: "field",
              },
            ],
          },
        },
        style: {
          basicStyle: {
            children: [
              {
                name: "width-subform",
                default: 200,
              },
              {
                name: "selectedButtonText",
                visible: false,
              },
              {
                name: "connectionTable",
                alias: i18next.t("relatedDataForm"),
                tip: i18next.t("saveUnsupportedModify"),
                disabled(widget: RelatedData) {
                  return widget._isRelatedConnection.value;
                },
              },
              {
                name: "buttonText",
                alias: i18next.t("buttonText"),
                type: "string",
                default: i18next.t("relatedData"),
              },
              {
                name: "dataMode",
                alias: i18next.t("relatedDataMode"),
                type: "select(radioGroup)",
                default: DataMode.SINGLE,
                selectChoices:[
                  {
                    label: i18next.t("single"),
                    value: DataMode.SINGLE
                  },
                  {
                    label: i18next.t("multiple"),
                    value: DataMode.MULTIPLE
                  }
                ],
                visible: true,
                // visible(widget: RelatedData) {
                //   return !widget.inSubForm;
                // },
              },
              {
                name: "fillRules",
                visible: (widget: RelatedData) => {
                  return widget.dataMode === DataMode.SINGLE
                }
              },
            ],
          },
          fieldsControl: {
            visible: false,
          },
          validation: {
            children: [
              {
                name: "required",
                visible: true
              },
              {
                name: "unique",
                visible: true
              },
            ],
            visible: true,
          },
          linkForm: {
            visible: false,
          }
        },
      },
      ...super.defineOptions(),
    ];
  }

  override async onFillData(rows: typeof this.selectedRows) {
    if (this.dataMode !== DataMode.MULTIPLE) {
      await super.onFillData(rows);
    } else {
      this.selectedRows = rows || {};
      this.updateLastChangeTime();
    }
    this.syncInputValueToRow();
  }

  private syncInputValueToRow(value?: unknown) {
    const row = (this.form as unknown as { getRow?: () => object })?.getRow?.() as Record<string, unknown> | undefined;
    if (!row || !this.fieldId) return;
    const selectedValue = Object.values(this.selectedRows)
      .flat()
      .map(item => item?.[this.uuidKey])
      .filter(Boolean);
    row[this.fieldId] = deepClone(value === undefined ? selectedValue : value);
  }

  override get inputValue() {
    // The raw row value is the source of truth while selected row details are
    // being restored. This also covers virtual sub-form rows, which carry a
    // transient change timestamp before their relation lookup completes.
    const rawValue = this.dataValue;
    if (isEmpty(this.connectionTable)) return [];
    if (isEmpty(this.selectedRows) && !isEmpty(rawValue)) {
      return rawValue;
    }
    const selectedValue = Object.entries(this.selectedRows).map(([key, rows]) => {
      return rows?.map(row => row[this.uuidKey]);
    })?.flat(Infinity)?.filter(Boolean) || [];
    // During initial hydration a lookup can return only a subset of the
    // requested IDs. Keep persisted IDs until a user action changes the field.
    if (!this.isChanged && !isEmpty(rawValue)) {
      const rawIds = Array.isArray(rawValue) ? rawValue : [rawValue];
      return [...new Set([...rawIds, ...selectedValue])];
    }
    return selectedValue;
  }

  set inputValue(value) {
  }

  get isRelatedConnectionTable() {
    return true;
  }

  get dataRows() {
    if (isEmpty(this.connectionTable)) return [];
    return Object.entries(this.selectedRows).map(([key, rows]) => {
      return rows?.map(row => row[this.titleField.uid]);
    })?.flat(Infinity)?.filter(Boolean) || [];
  }

  public getValue(fieldUID: FieldUID, subFieldUID?: FieldUID) {
    return Object.entries(this.selectedRows).map(([key, rows]) => {
      return rows?.map(row => subFieldUID && Array.isArray(row[fieldUID]) ? row[fieldUID]?.map(subRow => subRow[subFieldUID]) : row[fieldUID]);
    })?.flat(Infinity)?.filter(Boolean) || []
  }

  get fieldType() {
    return "array";
  }

  override resolveFormSetting() {
    return {
      ...super.resolveFormSetting(),
      subType: "related",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        relatedTableUID: this.connectionTable,
        relatedDataMode: this.dataMode,
      },
    };
  }

  get isHidden() {
    return super.superIsHidden;
  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      aggregationInfo: [
        AggregationType.NOT_SHOW,
        AggregationType.FILLED,
        AggregationType.UNFILLED,
      ]
    };
  }
}

