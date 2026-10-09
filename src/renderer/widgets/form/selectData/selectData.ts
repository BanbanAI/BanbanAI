import { OptionFieldUID } from "@common/types/project";
import { isSystemField, isNocodeFormData, getUUIDSystemField, SystemField, mappingSystemFieldAlias } from "@common/utils/connection";
import { getRelatedFields } from "@common/utils/related";
import { RuleFunc } from "@common/types/nocode";
import { isProcessTable } from "@common/utils/flow";
import { DefinedOptions, LogicalOperator, GetOptionOptions } from "@renderer/b2/types";
import { FormElement, SubFormRow, isSubForm } from "@renderer/b2/controllers/form";
import { WidgetSoul } from "@common/types/project";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { ref, watch } from "vue";
import { deepClone, equals, isEmpty } from "@common/utils/object";
import { unique } from "@common/utils/unique";
import { FillRules, FilterRule, FormCondition, SelectDataFillTrace } from "./types";
import { DEFERRED_SELECT_DATA, SubForm } from "../subForm/subForm";
import { Field, FieldUID, OptionValue, QueryOptions, Table, WhereCondition } from "@common/types/project";
import FillRulesDialog from "./FillRulesDialog.vue";
import { isSelect, isUploader } from '../_common/utils';
import FormDataFilterDialog from "./FormDataFilterDialog.vue"
import AddFormDataValueDialog from "../_common/AddFormDataValueDialog.vue"
import { resolveDataSourceSelectionMeta } from "../_common/page-permission";

const filterWidgets = ["widget.form.splitLine", "widget.form.connecter"];
const UUID = "__uuid__";

type Options = {
  label: string,
  value: string,
  isSystem?: boolean,
  children?: Options[],
}

export const getSelectDataPreHiddenColumns = (widget: SelectData): FieldUID[] => {
  const showFields = new Set(widget.showFields || []);
  const hiddenFields = new Set<FieldUID>();
  const allFields = new Set<FieldUID>();
  const uuidFields = new Set<FieldUID>();

  const collectField = (field?: Field) => {
    if (!field?.uid) return;
    allFields.add(field.uid);
    if (field.meta?.name === SystemField.UUID) {
      uuidFields.add(field.uid);
    }
  };

  widget.connectionTableFields.forEach(collectField);
  for (const subTable of widget.subFormTableFields) {
    (subTable.subFields || []).forEach(collectField);
  }

  // Include runtime-only fields such as data owner and related sub-form.
  const collectOptionFields = (options: Options[]) => {
    for (const option of options) {
      if (!option?.value) continue;
      allFields.add(option.value as FieldUID);
      if (option.children?.length) {
        collectOptionFields(option.children);
      }
    }
  };

  collectOptionFields(widget.selectShowFieldsFieldsOptions);
  for (const fieldUID of allFields) {
    if (uuidFields.has(fieldUID) || !showFields.has(fieldUID)) {
      hiddenFields.add(fieldUID);
    }
  }

  return [...hiddenFields];
};

const isSubTable = (table: Table) => {
  return !isEmpty(table.meta?.extra?.primaryTable);
}

const getPrimaryTable = (tables: Table[] = [], table?: Table) => {
  const primaryTableUID = table?.meta?.extra?.primaryTable?.[1];
  if (!primaryTableUID) return null;
  return tables.find(item => item.uid === primaryTableUID) || null;
}

const isValidSelectableTable = (tables: Table[] = [], table?: Table) => {
  if (!table) return false;
  if (!isSubTable(table)) return true;

  const primaryTable = getPrimaryTable(tables, table);
  if (!primaryTable) return false;

  return primaryTable.fields?.some(field => field?.meta?.extra?.subTableUID?.[1] === table.uid);
}

const buildRuntimeDataOwnerField = (): Field => ({
  uid: SystemField.DATA_OWNER,
  alias: mappingSystemFieldAlias(SystemField.DATA_OWNER),
  type: 'string',
  meta: {
    name: SystemField.DATA_OWNER,
    uid: SystemField.DATA_OWNER,
    subType: 'account',
    extra: {},
    isSystem: true,
  },
} as Field);

const getRuntimeTableFields = (table: Table) => {
  const fields = (table?.fields || []).filter(field => !isSubTable(table) || field.meta?.name !== SystemField.DATA_OWNER);
  if (isSubTable(table) || fields.some(field => field.meta?.name === SystemField.DATA_OWNER)) {
    return fields;
  }
  return [...fields, buildRuntimeDataOwnerField()];
};
export class SelectData extends FormElement {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }

  private _fillRulesDialogVisible = ref(false);
  private _selectedRows = ref<Record<string, any[]>>({});
  get selectedRows() {
    return this._selectedRows.value;
  }

  set selectedRows(value) {
    this._selectedRows.value = value || {};
  }

  get isHidden() {
    if(this.topForm.isViewing) return true
    return super.isHidden;
  }

  get superIsHidden() {
    return super.isHidden;
  }

  isCreateField() {
    return false;
  }
  get fillRulesDialogVisible() {
    return this._fillRulesDialogVisible.value;
  }
  set fillRulesDialogVisible(value: boolean) {
    this._fillRulesDialogVisible.value = value;
  }

  get buttonText() {
    return this.getOption("buttonText");
  }
  set buttonText(value: string) {
    this.setOption("buttonText", value);
  }

  get selectedButtonText() {
    return this.getOption("selectedButtonText");
  }

  set selectedButtonText(value: string) {
    this.setOption("selectedButtonText", value);
  }

  get connectionTable() {
    const connectionTable = this.getOption<string>("connectionTable");
    if (connectionTable) {
      return connectionTable.split(",");
    }
    return [];
  }
  get nocodeId() {
    return this.getConnectionTableMeta().nocodeId || this.getBoard().nocodeId;
  }
  private _data = ref<Partial<Awaited<ReturnType<ReturnType<typeof this.getData>['getPagingRows']>>>>({});
  get rows() {
    return this._data.value?.rows || [];
  }
  override initAfterConstructor() {
    super.initAfterConstructor();
  }

  private _subTableData = ref<Record<FieldUID, typeof this._data.value>>({});
  async readSubTableData(rows: object[]) {
    const keys = rows.map(row=>row[this.uuidKey]);
    for (const field of this.subFormTableFields) {
      this.getData().getPagingRows(field.subTableUID, {
        filters: {
          [field.subTableUID[1]]: [{
            [field.relationKey]: {
              $in: keys,
            }
          }]
        },
      }).then(({ rows, count }) => {
        const data = this._subTableData.value[field.fieldUID];
        if (!data) {
          this._subTableData.value[field.fieldUID] = {rows, count};
        } else {
          data.rows = rows;
          data.count = count;
        }
      });
    }
  }

  get uuidKey() {
    return getUUIDSystemField(this.connectionTableFields)?.uid;
  }

  setConnectionTable(value: string) {
    this.setOption("connectionTable", value);
  }

  private getConnectionTableMeta() {
    return resolveDataSourceSelectionMeta(
      this.getBoard(),
      this.connectionTable,
      this.topForm?.tableUID?.[0],
      { includeSchemaOnly: true },
    );
  }

  private getConnectionTableConnection() {
    return this.getConnectionTableMeta().connection;
  }

  private getConnectionTableTable() {
    return this.getConnectionTableMeta().table;
  }

  get connectionTableFields() {
    if (!isEmpty(this.connectionTable)) {
      const table = this.getConnectionTableTable();
      return table?.fields || [];
    }
    return [];
  }

  get hiddenFieldsUid() {
    return this.getOption("hidden-fields-uid") || []
  }
  set hiddenFieldsUid(val: string[]) {
    this.setOption("hidden-fields-uid",  val)
  }

  get isRelatedConnectionTable() {
    if (isEmpty(this.connectionTable)) return false;
    const connection = this.getConnectionTableConnection();
    const table = this.getConnectionTableTable();
    if (!connection || !table) return false;
    const relatedFields = getRelatedFields(connection, table);
    return !isEmpty(relatedFields);
  }

  get isSubTableSource() {
    const table = this.getConnectionTableTable();
    return !!table && isSubTable(table);
  }

  get shouldShowSubTableAddDisabledTip() {
    return this.isSubTableSource && !!this.getOption("allow-add-new-row");
  }

  get selectShowFieldsFieldsOptions(): Options[] {
    if (!isEmpty(this.connectionTable)) {
      const [, tableUID] = this.connectionTable;
      const connection = this.getConnectionTableConnection();
      const table = this.getConnectionTableTable();
      if (!connection || !table) return [];
      const tableFields = getRuntimeTableFields(table);
      const { baseFields, subFields } = tableFields.reduce<{ baseFields: Field[], subFields: Field[] }>((prev, f) => {
        if (f.meta.subType === "subForm") {
          prev.subFields.push(f);
        } else {
          prev.baseFields.push(f);
        }
        return prev;
      }, { baseFields: [], subFields: [] });
      const startSystemFields: string[] = [
        SystemField.UUID,
        SystemField.DATA_TITLE,
      ];
      const showSystemFields: string[] = [
        // SystemField.DATA_TITLE,
        SystemField.CREATE_OWNER,
        ...(!isSubTable(table) ? [SystemField.DATA_OWNER] : []),
        SystemField.CREATE_TIME,
        SystemField.UPDATE_TIME,
      ];
      const processFields: string[] = [
        SystemField.STATUS,
        SystemField.CURRENT_NODE,
        SystemField.CURRENT_OWNER
      ]

      if (this.isRelatedConnectionTable) {
        showSystemFields.unshift(SystemField.RELATED_SUB_FORM)
      }

      if(isProcessTable(connection?.formOptions?.[tableUID])) {
        showSystemFields.push(...processFields)
      }

      const startOptions = startSystemFields.map(name => {
        const field = baseFields.find(f => f.meta.name === name);
        if (!field) return null;
        return { label: field.alias, value: `${field.uid}`, isSystem: true }
      })?.filter(Boolean);
      const baseOptions = baseFields.filter(f => (!isSystemField(f))).map(f => ({ label: f.alias, value: `${f.uid}` }));
      const showSystemOptions = showSystemFields.map(name => {
        const field = baseFields.find(f => f.meta.name === name);
        if (!field) {
          if (name === SystemField.RELATED_SUB_FORM) {
            return { label: mappingSystemFieldAlias(SystemField.RELATED_SUB_FORM), value: SystemField.RELATED_SUB_FORM, isSystem: true, }
          }
          return null;
        }
        return { label: field.alias, value: `${field.uid}`, isSystem: true }
      })?.filter(Boolean);
      const subOptions = subFields.map(f => {
        const subTable = connection.tables.find(t => t.uid === f.meta?.extra?.subTableUID?.[1]);
        const uuidField = getUUIDSystemField(subTable?.fields || []);
        const subChildren = subTable?.fields?.filter(f => !isSystemField(f)).map(sf => {
          return {
            label: `${sf.alias}`,
            value: `${sf.uid}`,
          }
        }) ?? [];
        return {
          label: `${f.alias}`,
          value: `${f.uid}`,
          children: [{ label: uuidField?.alias, value: uuidField?.uid, isSystem: true }, ...subChildren]
        }
      })

      // 保持表头的顺序
      const tableFildsOptions = table.fields.map(f => {
        return baseOptions.find(b => b.value === f.uid) || subOptions.find(s => s.value === f.uid)
      }).filter(f => f)

      // 系统字段放到最后，标题保留在最前面
      return [...startOptions, ...tableFildsOptions, ...showSystemOptions]
    }
    return [];
  }

  get subFormTableFields() {
    return this.connectionTableFields.filter(f => f.meta?.subType === "subForm").map(f => {
      const connection = this.getConnectionTableConnection();
      const subTable = connection?.tables?.find(t => t.uid === f.meta?.extra?.subTableUID?.[1]);
      return {
        fieldUID: f.uid,
        relationKey: subTable?.fields?.find(f => f.meta.name === SystemField.KEY)?.uid,
        subFields: subTable?.fields,
        subTableUID: f.meta.extra?.subTableUID,
      }
    })
  }

  get showFields() {
    return this.getOption<string[]>("showFields") || [];
  }

  get currentFormWidgets(): FormElement[] {
    const form = this.form;
    return form.container.getChildWidgets(true, (widget: FormElement) => {
      return this.isInSubForm === widget.isInSubForm;
    }).filter((widget: FormElement) => {
      return widget.isCreateField() && !(widget instanceof SelectData) && !filterWidgets.includes(widget.type);
    }) as FormElement[]
  }

  get fillRules() {
    return this.getOption<FillRules>("fillRules") || [];
  }

  set fillRules(value: FillRules) {
    this.setOption("fillRules", value);
  }

  getFillRuleSourceSubTableFieldUIDs() {
    const subTableFieldUIDSet = new Set(this.subFormTableFields.map(item => item.fieldUID));
    const result = new Set<FieldUID>();
    const collectSourceFieldUID = (sourceUID?: string) => {
      const fieldUID = sourceUID?.split(".")?.[0] as FieldUID | undefined;
      if (fieldUID && subTableFieldUIDSet.has(fieldUID)) {
        result.add(fieldUID);
      }
    };

    for (const rule of this.fillRules) {
      collectSourceFieldUID(rule.sourceUID);
      for (const item of rule.linkageSubFields || []) {
        collectSourceFieldUID(item.subSourceUID);
      }
    }

    return [...result];
  }

  get index() {
    return this.parent.widgets.findIndex(w => w.uid === this.uid);
  }

  get inSubForm() {
    return this.parent.type === "widget.form.subform";
  }

  get inSubFormRow() {
    return this.parent instanceof SubFormRow;
  }

  get rowIndex() {
    if (this.inSubFormRow) {
      const subFormRow = this.parent as SubFormRow;
      const uid = subFormRow.uid;
      return (subFormRow.parent as SubForm).rows.findIndex(r => r[UUID] === uid);
    }
    return 0;
  }
  get isMultiple() {
    return this.inSubFormRow && isEmpty(this.selectedRows);
  }

  get tableChoices() {
    const connections = this.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || [];
    const canView = (tableUID: string) => (this.topForm as any)?.canReadLayerDataSync?.(tableUID);
    if (connections.length === 1) {
      return connections[0]?.tables.filter(t => isValidSelectableTable(connections[0].tables, t) && canView(t.uid)).map(t => {
        return {
          label: t.alias,
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
        children: c.tables.filter(t => isValidSelectableTable(c.tables, t) && canView(t.uid)).map(t => {
          const alias = this.topForm?.tableUID[0] === c.uid && this.topForm?.tableUID[1] === t.uid ? i18next.t("currentFormLabel") : t.alias;
          return {
            label: alias,
            value: [c.uid, t.uid].join(","),
            isCurrent: t.uid === this.topForm?.tableUID[1] ? 1 : 0,
          };
        }).sort((a, b) => b.isCurrent - a.isCurrent),
        isCurrent: c.tables.some(t => t.uid === this.topForm?.tableUID[1] && canView(t.uid)) ? 1 : 0,
      }
    }).filter(item => item.children?.length).sort((a, b) => b.isCurrent - a.isCurrent);
  }

  get formDataFilter() {
    return this.getOption<FilterRule>("form-data-filter") || {
      logic: LogicalOperator.AND,
      conditions: [],
    };
  }

  set formDataFilter(value: FilterRule) {
    this.setOption("form-data-filter", value)
  }

  async addField(fieldId: string, index: number) {
    if (isEmpty(this.connectionTable)) return;
    const uid = [...this.connectionTable, fieldId] as OptionFieldUID;
    const name = this.connectionTableFields.find(f => f.uid === fieldId)?.alias;
    const { extra } = this.getOptionByField(uid);
    const soul: WidgetSoul = {
      type: extra?.widgetType || "widget.form.textInput",
      name,
    };
    return await this.parent.container.addWidget(soul, index);
  }

  getWidgetByUID(uid: string): FormElement {
    if (this.inSubFormRow) {
      return (this.parent.widgets as FormElement[]).find(w => w.field?.meta?.uid === uid);
    }
    return this.topForm?.getChildElement(uid);
    // return (this.parent.widgets as FormElement[]).find(w => w.uid === uid);
  }

  private getCurrentSubFormComparisonElement(comparisonUid?: string): FormElement | undefined {
    if (!comparisonUid || this.form.getSoul().type !== "SubFormRow") return undefined;

    const [, subFieldId] = comparisonUid.split(".");
    if (!subFieldId) return undefined;

    return this.form.children.find((field: FormElement) => {
      return field.uid === subFieldId
        || field.fieldId === subFieldId
        || field.field?.uid === subFieldId
        || field.field?.meta?.uid === subFieldId
        || (field as any).originId === subFieldId;
    }) as FormElement | undefined;
  }

  getComparisonFormElement(comparisonUid?: string): FormElement | undefined {
    if (!comparisonUid) return undefined;

    if (this.form.getSoul().type === "SubFormRow") {
      const currentSubFormElement = this.getCurrentSubFormComparisonElement(comparisonUid);
      if (currentSubFormElement) return currentSubFormElement;

      return this.topForm.getChildElement(comparisonUid) as FormElement | undefined;
    }

    return this.topForm?.getChildElement(comparisonUid) as FormElement | undefined;
  }

  get computedOtherTableField() {
    const connection = this.getConnectionTableConnection();
    if (!connection) return [];

    return connection.tables?.filter(t => this.connectionTable[1] === t.uid && isEmpty(t.meta?.extra?.primaryTable)).map(t => {
      const { baseFields, subFields } = t.fields.reduce<{ baseFields, subFields }>((prev, f) => {
        if (isSystemField(f)) return prev;
        if (f.meta.subType === "subForm") {
          prev.subFields.push(f);
        } else {
          prev.baseFields.push(f);
        }
        return prev;
      }, { baseFields: [], subFields: [] });

      const baseOptions = baseFields.map(f => ({ label: f.alias, value: `${connection.uid}.${t.uid}.${f.uid}` }));
      const subOptions = subFields.map(f => {
        const subTable = connection.tables.find(t => t.uid === f.meta?.extra?.subTableUID?.[1]);
        return subTable?.fields?.filter(f => !isSystemField(f)).map(sf => {
          return {
            label: `${f.alias}.${sf.alias}`,
            value: `${f.uid}.${sf.uid}`,
          }
        }) ?? [];
      })
      return {
        label: t.alias,
        value: t.uid,
        children: [...baseOptions, ...subOptions.flat(Infinity)],
      }
    })
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "input-width",
                alias: i18next.t("inputWidth"),
              },
              {
                name: "width-subform",
                default: 200,
              },
              {
                name: "buttonText",
                alias: i18next.t("buttonTextLabel"),
                type: "string",
                default: i18next.t("selectDataTitle"),
              },
              {
                name: "selectedButtonText",
                alias: i18next.t("selectedButtonTextLabel"),
                type: "string",
                default: i18next.t("selected"),
              },
              {
                name: "connectionTable",
                alias: i18next.t("selectDataFormLabel"),
                type: "select(tree,onlyCheckLeaf)",
                selectChoices: (widget: SelectData) => {
                  return widget.tableChoices;
                }
              },
              {
                name: "showFields",
                alias: i18next.t("popupFieldsLabel"),
                tip: i18next.t("popupFieldsTip"),
                type: "select(tree,multiple)",
                selectChoices: (widget: SelectData) => {
                  return widget.selectShowFieldsFieldsOptions;
                },
                default: (widget: SelectData) => {
                  return widget.selectShowFieldsFieldsOptions.filter(f => !f.isSystem).map(f => {
                    if (f.children) {
                      return f.children.filter(sf => !sf.isSystem).map(c => c.value);
                    }
                    return f.value;
                  })?.flat(Infinity);
                },
                visible(widget: SelectData) {
                  return !isEmpty(widget.connectionTable);
                },
              },
              {
                name: "hidden-fields-uid", // 保存未选中的字段uid
                visible: false,
              },
              {
                name: "dataMode",
                visible: false,
              },
              {
                name: "fillRules",
                alias: i18next.t("fillRulesControl"),
                type: `dialog`,
                dialog: {
                  component: FillRulesDialog,
                  buttonText(widget: SelectData, paths) {
                    return isEmpty(widget.fillRules) ? i18next.t("addFillRules") : i18next.t("fillRulesConfigured");
                  },
                  buttonStyle(widget: SelectData) {
                    const value = widget.fillRules;
                    return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                  },
                },
                tip: i18next.t("fillRulesTip"),
                visible(widget: SelectData) {
                  return !isEmpty(widget.connectionTable);
                },
                buttonClick: (widget: SelectData) => {
                  widget.fillRulesDialogVisible = true;
                }
              },
              {
                name: "other-table-field",
                default: (widget: SelectData) => {
                  return widget.computedOtherTableField
                },
                visible: false
              },
              {
                name: "form-data-filter",
                alias: i18next.t("dataFilterTitle"),
                type: 'dialog',
                dialog: {
                  component: FormDataFilterDialog,
                  buttonText(widget: SelectData, paths) {
                    return isEmpty(widget.formDataFilter.conditions) ? i18next.t("setCondition") : i18next.t("conditionConfigured");
                  },
                  buttonStyle(widget: SelectData) {
                    const value = widget.formDataFilter.conditions;
                    return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                  },
                },
                visible(widget: SelectData) {
                  return !isEmpty(widget.connectionTable);
                },
              },
              {
                name: "allow-add-new-row",
                alias: i18next.t("allowAddData"),
                type: "boolean",
                tip: i18next.t("subTableAddDisabledTip"),
                default: false,
                disabled(widget: SelectData) {
                  return widget.isSubTableSource;
                },
              },
              {
                name: "allow-edit-row",
                alias: i18next.t("allowEditData"),
                type: "boolean",
                default: false,
              },
              {
                name: "add-current-row-to-linkage-form",
                alias: i18next.t("autoFillData"),
                type: "dialog",
                dialog: {
                  component: AddFormDataValueDialog,
                  buttonText(widget: SelectData, paths) {
                    return isEmpty(widget.addCurrentRowToLinkageForm) ? i18next.t("addAutoFillRule") : i18next.t("ruleConfigured");
                  },
                  buttonStyle(widget: SelectData) {
                    const value = widget.addCurrentRowToLinkageForm;
                    return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                  },
                },
                visible(widget: SelectData) {
                  return widget.allowAddNewRow;
                },
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
                visible: false
              },
            ],
            visible: false,
          },
          linkForm: {
            visible: false,
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get allowAddNewRow() {
    if (this.isSubTableSource) return false;
    return !!this.getOption("allow-add-new-row");
  }
  get allowEditRow() {
    return this.getOption("allow-edit-row");
  }
  get addCurrentRowToLinkageForm() {
    if (!this.allowAddNewRow) return null;
    return this.getOption("add-current-row-to-linkage-form");
  }

  private getSubFormSelectDataWidget(index: number) {
    const subForm = this.parent.parent as SubForm;
    const row = subForm.rows[index];
    if (!row) return;
    const subFormRow = subForm.getSubFormRow(row[UUID]);
    return subFormRow?.children?.find(w => (w as any).originId === (this as any).originId) as SelectData;
  }

  private getSubFormRowWidget(subFormRow: SubFormRow, uid: string) {
    return subFormRow.children.find(widget => {
      return widget.field?.meta?.uid === uid
        || (widget as any).originId === uid
        || widget.uid === uid;
    }) as FormElement | undefined;
  }

  private getCurrentSubFormRowData() {
    if (!this.inSubFormRow) return;
    const subFormRow = this.parent as SubFormRow;
    return (subFormRow.parent as SubForm).rows.find(row => row[UUID] === subFormRow.uid);
  }

  private syncCurrentSubFormRowValue(targetWidget: FormElement, value: any) {
    const rowData = this.getCurrentSubFormRowData();
    const fieldId = targetWidget?.fieldId;
    if (!rowData || !fieldId) return;

    if (isSubForm(targetWidget)) {
      rowData[fieldId] = deepClone(value);
      return;
    }

    if (isSelect(targetWidget)) {
      if ((targetWidget as any).isMultiple) {
        rowData[fieldId] = deepClone(value ?? []);
      } else {
        rowData[fieldId] = Array.isArray(value) ? value[0] ?? "" : value ?? "";
      }
      return;
    }

    rowData[fieldId] = deepClone(value ?? "");
  }

  private getFillDataForRow(rows: any[]) {
    const rowData: Record<string, any> = {};
    const inputFillData: Array<{ targetUID: string; value: any }> = [];
    const selectFillData: Array<{ targetUID: string; value: any }> = [];
    const nestedFillData: Array<{ targetUID: string; value: any[] }> = [];
    const uploaderTargetUIDs: string[] = [];

    for (const rule of this.fillRules) {
      const targetWidget = this.getWidgetByUID(rule.targetUID);
      if (!targetWidget) continue;

      try {
        const fieldIds = rule.sourceUID.split(".");
        let value = rows?.[0]?.[fieldIds[0]];
        if (fieldIds.length > 1) {
          value = rows?.map(row => row[fieldIds[1]]) ?? [];
        }

        const fieldId = targetWidget.fieldId;
        if (isSelect(targetWidget)) {
          const normalizedValue = (targetWidget as any).isMultiple
            ? deepClone(value ?? [])
            : Array.isArray(value) ? value[0] ?? "" : value ?? "";
          if (fieldId) rowData[fieldId] = normalizedValue;
          selectFillData.push({ targetUID: rule.targetUID, value });
        } else if (isSubForm(targetWidget)) {
          const subRowValue = this.transformSubRowVaue(value, rule.linkageSubFields, targetWidget as SubForm);
          if (fieldId) rowData[fieldId] = subRowValue.length === 0 ? [] : deepClone(subRowValue);
          nestedFillData.push({
            targetUID: rule.targetUID,
            value: subRowValue,
          });
        } else {
          if (isUploader(targetWidget)) {
            uploaderTargetUIDs.push(rule.targetUID);
          } else {
            inputFillData.push({ targetUID: rule.targetUID, value });
          }
          if (fieldId) rowData[fieldId] = deepClone(value ?? "");
        }
      } catch {
        continue;
      }
    }

    return { rowData, inputFillData, selectFillData, nestedFillData, uploaderTargetUIDs };
  }

  private async handleFillDataInSubForm(selectedRows: typeof this.selectedRows, trace?: SelectDataFillTrace) {
    const subForm = this.parent.parent as SubForm;
    const currentRows = subForm.rows || [];
    const nextRows = currentRows.slice() as Record<string, any>[];
    const pendingFillData: Array<{
      index: number;
      key: string;
      rows: any[];
      inputFillData: Array<{ targetUID: string; value: any }>;
      selectFillData: Array<{ targetUID: string; value: any }>;
      nestedFillData: Array<{ targetUID: string; value: any[] }>;
      uploaderTargetUIDs: string[];
    }> = [];
    let index = this.rowIndex;
    let isFirstTargetRow = true;
    for (const [key, rows] of Object.entries(selectedRows)) {
      let selectDataWidget = this.getSubFormSelectDataWidget(index);

      // 当前行会在弹窗确认时先同步为“已选择”，首条分发仍应优先写回当前行。
      while (index < currentRows.length && (!selectDataWidget || (!isFirstTargetRow && !selectDataWidget.isMultiple))) {
        index ++;
        selectDataWidget = this.getSubFormSelectDataWidget(index);
      }

      const rowsToAdd = index + 1 - currentRows.length;
      if (rowsToAdd > 0 && !subForm.canAddRows(rowsToAdd)) break;
      const fillData = this.getFillDataForRow(rows);
      const isNewRow = index >= currentRows.length;
      while (nextRows.length <= index) {
        const row: Record<string, any> = {
          isManualAdd: true,
          [UUID]: unique(),
        };
        nextRows.push(row);
      }

      Object.assign(nextRows[index], fillData.rowData);
      if (isNewRow) {
        subForm.applyManualAddRowDefaults(nextRows[index], {
          allowPopulatedRow: true,
        });
      }
      const deferredSelectData = (nextRows[index] as any)[DEFERRED_SELECT_DATA] || {};
      deferredSelectData[(this as any).originId || this.uid] = {
        key,
        rows: deepClone(rows),
      };
      Object.defineProperty(nextRows[index], DEFERRED_SELECT_DATA, {
        value: deferredSelectData,
        configurable: true,
        writable: true,
        enumerable: false,
      });
      pendingFillData.push({ index, key, rows, ...fillData });
      index ++;
      isFirstTargetRow = false;
    }

    if (!pendingFillData.length) return;
    await subForm.batchApplyRows(nextRows, trace);

    // The selected rows are the only rows whose controls must participate in
    // linkage/formula watchers. Initialize those rows before applying the
    // mapped values so every selected row follows the normal mounted-row
    // update path; unrelated virtual rows remain unmounted.
    await Promise.all(pendingFillData.map(pending => {
      const row = subForm.rows[pending.index];
      return row ? subForm.ensureSubFormRowInitialized(row) : undefined;
    }));
    const affectedRowIds = new Set<string>();
    for (const pending of pendingFillData) {
      const row = subForm.rows[pending.index];
      const rowId = row?.[UUID];
      if (rowId) affectedRowIds.add(String(rowId));
      const subFormRow = row && subForm.getSubFormRow(row[UUID]);
      if (!subFormRow || !subForm.isSubFormRowInitialized(subFormRow)) continue;

      const selectDataWidget = this.getSubFormSelectDataWidget(pending.index)
        || (pending.index === this.rowIndex ? this : undefined);
      if (selectDataWidget) {
        selectDataWidget.selectedRows = { [pending.key]: deepClone(pending.rows) };
        selectDataWidget.updateLastChangeTime();
      }

      for (const input of pending.inputFillData) {
        try {
          const targetWidget = this.getSubFormRowWidget(subFormRow, input.targetUID);
          if (targetWidget) {
            targetWidget.inputValue = input.value ?? "";
          }
        } catch {
          continue;
        }
      }

      for (const targetUID of pending.uploaderTargetUIDs) {
        try {
          const targetWidget = this.getSubFormRowWidget(subFormRow, targetUID);
          if (isUploader(targetWidget)) {
            targetWidget.fileList = [];
          }
        } catch {
          continue;
        }
      }

      for (const select of pending.selectFillData) {
        try {
          const targetWidget = this.getSubFormRowWidget(subFormRow, select.targetUID);
          if (isSelect(targetWidget)) {
            // Keep the display options populated by onFillData, but also write
            // through the real widget value. The latter updates the row
            // control's reactive state and last-change timestamp so formulas
            // depending on this select field run immediately after a batch
            // fill (the single-row path already does this).
            targetWidget.onFillData(select.value);
            const inputValue = targetWidget.isMultiple
              ? (Array.isArray(select.value) ? select.value : select.value ? [select.value] : [])
              : (Array.isArray(select.value) ? select.value[0] ?? "" : select.value ?? "");
            targetWidget.inputValue = deepClone(inputValue);
          }
        } catch {
          continue;
        }
      }

      for (const nested of pending.nestedFillData) {
        try {
          const targetWidget = this.getSubFormRowWidget(subFormRow, nested.targetUID);
          if (!isSubForm(targetWidget)) continue;
          if (nested.value.length === 0) {
            targetWidget.inputValue = [{}];
          } else {
            await (targetWidget as SubForm).onFillData(nested.value);
          }
        } catch {
          continue;
        }
      }

      // Formula watchers in edit mode intentionally ignore an unchanged
      // initial value. After all mapped fields have been written, run the
      // row's local formula columns explicitly so formulas depending on a
      // selected option are calculated in the same batch.
      const formulaChildren = subFormRow.children.filter((child: any) => {
        if (typeof child.handleFormatValue !== "function") return false;
        if (child.type === "widget.form.autoCompute") {
          return child.computeType === "formula" && !!child.formulaValue;
        }
        return child.defaultType === "formula" && !!child.defaultFormulaValueStr;
      });
      for (let round = 0; round < formulaChildren.length; round++) {
        let changed = false;
        for (const child of formulaChildren) {
          const previousValue = child.inputValue;
          (child as any).handleFormatValue();
          changed = changed || !equals(previousValue, child.inputValue);
        }
        if (!changed) break;
      }
      for (const child of formulaChildren) {
        const fieldId = child.fieldId;
        if (fieldId && child.inputValue !== undefined) {
          row[fieldId] = deepClone(child.inputValue);
        }
      }

    }

    // Keep dynamic caches coherent for the affected rows. Their real widgets
    // already ran the formula watchers above, so this does not create any
    // additional row controls or data requests.
    for (const rowId of affectedRowIds) {
      subForm.invalidateDynamicValueCache(rowId);
    }
  }

  // 将选择数据的值的key转换为目标子表单的字段的key
  private transformSubRowVaue(linkageValue, linkageSubFields, subFormWidget: SubForm) {
    let subRowValue = [];
    linkageValue?.forEach(valueItem => {
      let tempRowValue = {};
      for (const ruleItem of linkageSubFields) {
        const targetElement = subFormWidget.children.find(w => w.uid === ruleItem.subTargetUID);
        if (!targetElement) continue;
        const subSourceFieldId = ruleItem.subSourceUID.split(".")[1];
        tempRowValue[targetElement.fieldId] = valueItem[subSourceFieldId]
      }
      subRowValue.push(tempRowValue)
    })

    return subRowValue
  }

  async onFillData(selectedRows: typeof this.selectedRows, trace?: SelectDataFillTrace) {
    const selectedCount = Object.keys(selectedRows || {}).length;
    const batchSubForm = trace && selectedCount > 1 && this.inSubFormRow
      ? this.parent.parent as SubForm
      : undefined;
    if (selectedCount > 1) {
      batchSubForm?.beginSelectDataBatchFill();
      try {
        await this.handleFillDataInSubForm(selectedRows, trace);
      } finally {
        batchSubForm?.endSelectDataBatchFill();
      }
    } else {
      const rows = Object.values(selectedRows)?.[0];
      for (const rule of this.fillRules) {
        let targetWidget = this.getWidgetByUID(rule.targetUID);
        if (!targetWidget) continue;
        try {
          const fieldIds = rule.sourceUID.split(".");
          let value = rows?.[0]?.[fieldIds[0]];
          if (fieldIds.length > 1) {
            value = rows?.map(row => row[fieldIds[1]]) ?? [];
          }
          if (isSelect(targetWidget)) {
            targetWidget.onFillData(value);

            const widget = targetWidget;
            const inputValue = widget.isMultiple
              ? (Array.isArray(value) ? value : value ? [value] : [])
              : (Array.isArray(value) ? value[0] ?? "" : value ?? "");

            // Programmatic fills must go through the normal setter so the
            // dependent formula watchers receive the field change as well.
            widget.inputValue = deepClone(inputValue);
            this.syncCurrentSubFormRowValue(targetWidget, value);
          } else if (isSubForm(targetWidget)) {
            const subRowValue = this.transformSubRowVaue(value, rule.linkageSubFields, targetWidget as SubForm);
            if (subRowValue.length === 0) {
              (targetWidget as SubForm).inputValue = [{}];
              this.syncCurrentSubFormRowValue(targetWidget, []);
            } else {
              (targetWidget as SubForm).onFillData(subRowValue);
              this.syncCurrentSubFormRowValue(targetWidget, subRowValue);
            }
          } else {
            if(isUploader(targetWidget)) {
              targetWidget.fileList = []
            }
            targetWidget.inputValue = value ?? "";
            this.syncCurrentSubFormRowValue(targetWidget, value ?? "");
          }
        } catch (err) {
          console.error(err);
        }
      }
      this._selectedRows.value = selectedRows;
    }
    this.updateLastChangeTime();
  }

  override getOption<T extends OptionValue>(paths: string | string[], options?: GetOptionOptions) {
    const path = Array.isArray(paths) ? paths.at(-1) : paths;
    if (["field-filling", "field-visible"].includes(path)) {
      return this.topForm?.getFieldOptionRule(path === "field-filling" ? "fill" : "visible", this) as T;
    }

    // if (["showFields"].includes(path)) {
    //   // 判断引用的表的字段是否有变化，新增的字段直接被选中
    //   if (!isEmpty(this.connectionTableFields)) {
    //     let curFields = super.getOption<T>(paths, options) as string[]
    //     let selectFormAllFieldsUID = []
    //     this.selectShowFieldsFieldsOptions.forEach(f => {
    //       selectFormAllFieldsUID.push(f.value)
    //       if (f.children) {
    //         selectFormAllFieldsUID = selectFormAllFieldsUID.concat(f.children.map(f => f.value))
    //       }
    //     });
    //     const oldAllFieldsUID = [...curFields, ...this.hiddenFieldsUid];

    //     const hasNewFields = selectFormAllFieldsUID.filter((uid: `f_${string}`) => !oldAllFieldsUID.includes(uid));
    //     const hasDeleteFields = oldAllFieldsUID.filter((uid: `f_${string}`) => !selectFormAllFieldsUID.includes(uid));
    //     if (isEmpty(hasNewFields) && isEmpty(hasDeleteFields)) return super.getOption<T>(paths, options);

    //     // 字段有新增,将新增的字段加入showFields
    //     for (const uid of hasNewFields) {
    //       curFields = [...curFields, uid]
    //     }

    //     // 字段删除
    //     for (const uid of hasDeleteFields) {
    //       if (curFields.includes(uid)) {
    //         curFields = curFields.filter(fuid => fuid !== uid)
    //       }
    //       if (this.hiddenFieldsUid.includes(uid)) {
    //         this.hiddenFieldsUid = this.hiddenFieldsUid.filter(fuid => fuid !== uid);
    //       }
    //     }

    //     return curFields
    //   }
    // }

    return super.getOption<T>(paths, options);
  }

  override setOption(paths: string | string[], value: OptionValue, history?: boolean): void {
    const path = Array.isArray(paths) ? paths.at(-1) : paths;
    if (["field-filling", "field-visible"].includes(path)) {
      return this.topForm.setFieldOptionRule(path === "field-filling" ? "fill" : "visible", this, value);
    }

    if (["showFields"].includes(path)) {
      if(value) {
        let allFieldsUIDs = []
        this.selectShowFieldsFieldsOptions.forEach(f => {
          allFieldsUIDs.push(f.value)
          if (f.children) {
            allFieldsUIDs = allFieldsUIDs.concat(f.children.map(f => f.value))
          }
        });
        // 获取是添加还是删除项
        const hasAddFields = (value as string[]).filter(f => !this.getOption("showFields").includes(f));
        const hasDeleteFields = this.getOption("showFields").filter(f => !(value as string[]).includes(f));

        if (!isEmpty(hasAddFields)) {
          // 获取当前子表单项的fields
          const selectSubFields = this.subFormTableFields.filter(f => hasAddFields.includes(f.fieldUID))
          const selectColumns = this.selectShowFieldsFieldsOptions.filter(fc => selectSubFields.some(f => f.fieldUID === fc.value))

          if (!isEmpty(selectColumns)) {
            selectColumns.forEach(sc => {
              // 选中了当前子表单，其子项全部变成选中状态
              if ((value as string[]).includes(sc.value))  {
                sc.children.forEach(childrenItem => {
                  if (!(value as string[]).includes(childrenItem.value)) {
                    (value as string[]).push(childrenItem.value)
                  }
                })
              }
            })
          }

          // 子表单的子项全部选中时，添加子表单项
          const allSubCloumns = this.selectShowFieldsFieldsOptions.filter(f => f.children)
          allSubCloumns.forEach(f => {
            const fChildrenUID = f.children.map(f => f.value)
            if (fChildrenUID.every(fcu => (value as string[]).includes(fcu)) && !(value as string[]).includes(f.value)) {
              (value as string[]).push(f.value)
            }
          })

        }

        // 删除子表单
        if (!isEmpty(hasDeleteFields)) {
          const deleteSubFields = this.subFormTableFields.filter(f => hasDeleteFields.includes(f.fieldUID))
          const deleteColumns = this.selectShowFieldsFieldsOptions.filter(fc => deleteSubFields.some(f => f.fieldUID === fc.value))

          // 删除子表单项，其子项全部删除
          if (!isEmpty(deleteColumns)) {
            const deleteSubChildrem = deleteColumns[0].children.map(f => f.value)
            value = (value as string[]).filter(f => !deleteSubChildrem.includes(f))
          }

          // 删除子表单中的某个项，子表单项的选中删除
          const allSubCloumns = this.selectShowFieldsFieldsOptions.filter(f => f.children)
          allSubCloumns.forEach(f => {
            if (f.children.find(fc => hasDeleteFields.includes(fc.value)) && (value as string[]).includes(f.value)) {
              value = (value as string[]).filter(v => v !== f.value)
            }
          })
        }

        this.hiddenFieldsUid = allFieldsUIDs.filter(f => !(value as string[]).some(s => s === f));
      }
    }
    return super.setOption(paths, value, history);
  }
}
