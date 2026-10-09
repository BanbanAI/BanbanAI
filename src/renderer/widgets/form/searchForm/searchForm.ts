import { getRelatedFields } from "@common/utils/related";
import { isProcessTable } from "@common/utils/flow";
import { getUUIDSystemField, isNocodeFormData, isSystemField, SystemField, transformCondition, mappingSystemFieldAlias } from "@common/utils/connection";
import { RuleFunc, FormCondition } from "@common/types/nocode";
import { DefinedOptions, GetOptionOptions, LogicalOperator, SelectIdOfForm, useWidget } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { computed, nextTick, ref, Ref, watch, WatchStopHandle } from "vue";
import { equals, isEmpty } from "@common/utils/object";
import { Field, FieldUID, OptionValue, QueryOptions, Table, WhereCondition } from "@common/types/project";
import { Column, CurrentFieldWrapperOperator, FilterRule, FormSortOrder, ShowDataRow, ShowDataStyle } from "./types";
import FormDataFilterDialog from "./FormDataFilterDialog.vue"
import { DistinctFields, FormMode } from "../_common/type";
import AddFormDataValueDialog from "../_common/AddFormDataValueDialog.vue"
import { debounce } from "lodash";
import { resolveDataSourceSelectionMeta } from "../_common/page-permission";
const isSubTable = (table: Table) => {
  return !isEmpty(table.meta?.extra?.primaryTable);
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
export class SearchForm extends FormElement {
  static resource = resource as any;

  private _searchFormDestroyed = false;
  private _filterWatchStops: WatchStopHandle[] = [];
  private _filterDebounceCancels: Array<() => void> = [];

  get defaultName() {
    return i18next.t("defaultName");
  }
  private _formulaDataVersion = ref(0);

  get formulaDataVersion() {
    return this._formulaDataVersion.value;
  }

  markFormulaDataChanged() {
    this._formulaDataVersion.value += 1;
    this.updateLastChangeTime();
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "input-width",
                visible: false,
              },
              {
                name: "input-width-px",
                visible: false,
              },
              {
                name: "select-search-form",
                alias: i18next.t("searchFormLabel"),
                type: "select",
                selectChoices: (widget: SearchForm) => {
                  return widget.searchFormTableChoices;
                }
              },
              {
                name: "other-table-field",
                default: (widget: SearchForm) => {
                  return widget.computedOtherTableField
                },
                visible: false
              },
              {
                name: "showFields",
                alias: i18next.t("showFieldsLabel"),
                type: "check-select(multiple,tree,allCheck)",
                selectChoices: (widget: SearchForm) => {
                  return widget.selectSearchFormFieldsOptions;
                },
                default: (widget: SearchForm) => {
                  return widget.selectSearchFormFieldsOptions.filter(f => !f.isSystem).map(f => {
                    if (f.children) {
                      return f.children.filter(sf => !sf.isSystem).map(c => c.value);
                    }
                    return f.value;
                  })?.flat(Infinity);
                },
              },
              {
                name: "hidden-fields-uid", // 保存未选中的字段uid
                visible: false,
              },
              {
                name: "show-data-row",
                alias: i18next.t("showDataRowCount"),
                type: "select(radioGroup)",
                default: "single",
                selectChoices:[
                  {
                    label: i18next.t("single"),
                    value: ShowDataRow.SINGLE
                  },
                  {
                    label: i18next.t("multiple"),
                    value: ShowDataRow.MULTIPLE
                  }
                ],
                visible(widget: SearchForm) {
                  return !widget.inSubForm;
                },
              },
              {
                name: "show-data-style",
                alias: i18next.t("showDataStyle"),
                type: "select(radioGroup)",
                default: ShowDataStyle.PARAGRAPH,
                selectChoices:[
                  {
                    label: i18next.t("paragraph"),
                    value: ShowDataStyle.PARAGRAPH
                  },
                  {
                    label: i18next.t("table"),
                    value: ShowDataStyle.TABLE
                  }
                ],
                visible(widget: SearchForm) {
                  return widget.showDataRow === ShowDataRow.SINGLE;
                },
              },
              {
                name: "form-data-filter",
                alias: i18next.t("dataFilterTitle"),
                type: 'dialog',
                visible: (widget: SearchForm) => {
                  return widget.selectSearchForm.length > 0;
                },
                dialog: {
                  component: FormDataFilterDialog,
                  buttonText(widget: SearchForm, paths) {
                    return isEmpty(widget.formDataFilter.conditions) ? i18next.t("setCondition") : i18next.t("conditionConfigured");
                  },
                  buttonStyle(widget: SearchForm) {
                    const value = widget.formDataFilter.conditions;
                    return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                  },
                }
              },
              {
                name: "form-data-sort-fields",
                alias: i18next.t("dataSortLabel"),
                type: "select",
                selectChoices: (widget: SearchForm) => {
                  return widget.selectSearchFormFields.map(f => {
                    return {
                      label: f.alias,
                      value: f.uid,
                    }
                  }).filter(f => widget.showFields.includes(f.value));
                },
                visible(widget: SearchForm) {
                  return widget.showDataRow === ShowDataRow.MULTIPLE;
                },
              },
              {
                name: "form-data-sort-orderby",
                type: "select",
                default: FormSortOrder.ASCEND,
                selectChoices:[
                  {
                    label: i18next.t("sortAsc"),
                    value: FormSortOrder.ASCEND
                  },
                  {
                    label: i18next.t("sortDesc"),
                    value: FormSortOrder.DESCEND
                  }
                ],
                visible(widget: SearchForm) {
                  return widget.showDataRow === ShowDataRow.MULTIPLE;
                },
              },
              {
                name: "allow-edit-row",
                alias: i18next.t("allowEditData"),
                type: "boolean",
                default: false,
              },
              {
                name: "allow-add-new-row",
                alias: i18next.t("allowAddData"),
                type: "boolean",
                default: false,
                visible(widget: SearchForm) {
                  return widget.showDataRow === ShowDataRow.MULTIPLE;
                },
              },
              {
                name: "add-current-row-to-linkage-form",
                alias: i18next.t("autoFillData"),
                type: "dialog",
                dialog: {
                  component: AddFormDataValueDialog,
                  buttonText(widget: SearchForm, paths) {
                    return isEmpty(widget.addCurrentRowToLinkageForm) ? i18next.t("addAutoFillRule") : i18next.t("ruleConfigured");
                  },
                  buttonStyle(widget: SearchForm) {
                    const value = widget.addCurrentRowToLinkageForm;
                    return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                  },
                },
                visible(widget: SearchForm) {
                  return widget.allowAddNewRow;
                },
              },
            ]
          },
          fieldProperty: {
            children: [
              {
                name: "is-readonly",
                visible: false,
              }
            ]
          },
          fieldsControl: {
            visible: false,
          },
          validation: {
            visible: false,
          },
          linkForm: {
            visible: false,
          }
        }
      },
      ...super.defineOptions(),
    ]
  }

  get defaultValue(): string[] {
    return [];
  }

  protected _inputValue: Ref<string[]> = ref();
  public get inputValue(): string[] {
    let value = this._inputValue.value ?? this.initialValue ?? this.defaultValue
    return value;
  }
  public set inputValue(value) {
    this._inputValue.value = value
  }

  get tableChoices() {
    const connections = this.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || [];
    const canView = (tableUID: string) => (this.topForm as any)?.canReadLayerDataSync?.(tableUID);
    if (connections.length === 1) {
      return connections[0]?.tables.filter(t => !isSubTable(t) && canView(t.uid)).map(t => {
        const alias = this.topForm?.tableUID[1] !== t.uid  ? t.alias : i18next.t("currentFormLabel");
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
        children: c.tables.filter(t => this.topForm?.tableUID[1] !== t.uid && !isSubTable(t) && canView(t.uid)).map(t => {
          const alias = this.topForm?.tableUID[1] !== t.uid  ? t.alias : i18next.t("currentFormLabel");
          return {
            label: alias,
            value: [c.uid, t.uid].join(","),
            isCurrent: t.uid === this.topForm?.tableUID[1] ? 1 : 0,
          };
        }).sort((a, b) => b.isCurrent - a.isCurrent),
        isCurrent: c.tables.some(t => t.uid === this.topForm?.tableUID[1] && canView(t.uid)) ? 1 : 0,
      }
    }).filter(item => item.children?.length).sort((a, b) => b.isCurrent - a.isCurrent);;
  }

  get searchFormTableChoices() {
    const connections = this.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || [];
    const currentConnectionUID = this.topForm?.tableUID?.[0];
    const currentTableUID = this.topForm?.tableUID?.[1];
    const canView = (tableUID: string) => (this.topForm as any)?.canReadLayerDataSync?.(tableUID);

    return connections.flatMap(connection => {
      return connection.tables.filter(t => !isSubTable(t) && canView(t.uid)).map(t => {
        const isCurrent = currentConnectionUID === connection.uid && currentTableUID === t.uid;
        const connectionName = connection.name;
        const isCrossAppTable = connection.uid !== currentConnectionUID;

        return {
          label: isCrossAppTable && connectionName ? `[${connectionName}]${t.alias}` : t.alias,
          value: [connection.uid, t.uid].join(","),
          isCurrent: isCurrent ? 1 : 0,
        };
      });
    }).sort((a, b) => b.isCurrent - a.isCurrent);
  }

  private getSelectSearchFormMeta() {
    return resolveDataSourceSelectionMeta(
      this.getBoard(),
      this.selectSearchForm,
      this.topForm?.tableUID?.[0],
      { includeSchemaOnly: true },
    );
  }

  private getSelectSearchFormConnection() {
    return this.getSelectSearchFormMeta().connection;
  }

  private getSelectSearchFormTable() {
    return this.getSelectSearchFormMeta().table;
  }

  get hasSelectedFormViewPermission() {
    return this.getSelectSearchFormMeta().hasViewPermission;
  }

  get computedOtherTableField() {
    const connection = this.getSelectSearchFormConnection();
    if (!connection) return [];

    return connection.tables?.filter(t => this.selectSearchForm[1] === t.uid && isEmpty(t.meta?.extra?.primaryTable)).map(t => {
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

  get selectSearchForm() {
    const selectSearchForm = this.getOption<string>("select-search-form");
    if (selectSearchForm) {
      return selectSearchForm.split(",");
    }
    return [];
  }

  setSelectSearchForm(value: string) {
    this.setOption("select-search-form", value);
  }

  set otherTableField(value) {
    this.setOption("other-table-field", value)
  }

  get selectSearchFormFields() {
    if (!isEmpty(this.selectSearchForm)) {
      const table = this.getSelectSearchFormTable();
      return table?.fields || [];
    }
    return [];
  }

  get selectSearchFormFieldsOptions(): Column[] {
    if (!isEmpty(this.selectSearchForm)) {
      const [, tableUID] = this.selectSearchForm;
      const connection = this.getSelectSearchFormConnection();
      const table = this.getSelectSearchFormTable();
      if (!connection || !table) return [];

      const tableFields = getRuntimeTableFields(table);
      const { baseFields, subFields } = tableFields.reduce<{ baseFields: Field[], subFields: Field[] }>((prev, f) => {
        if (isSystemField(f)) {
          if (([SystemField.CREATE_OWNER, SystemField.DATA_OWNER, SystemField.UPDATE_OWNER, SystemField.CURRENT_OWNER] as string[]).includes(f.meta.name)) {
            f.meta.subType = "account";
          }
          if (([SystemField.STATUS] as string[]).includes(f.meta.name)) {
            f.meta.subType = "process-status";
          }
          if (([SystemField.CURRENT_NODE] as string[]).includes(f.meta.name)) {
            f.meta.subType = "process-node";
          }
        }
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

      const relatedFields = getRelatedFields(connection, table);
      if (!isEmpty(relatedFields)) {
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

      const baseOptions = baseFields.filter(f => (!isSystemField(f))).map(f => {
        return {
          label: f.alias,
          value: `${f.uid}`,
          subType: f.meta?.subType,
        }
      });
      const showSystemOptions = showSystemFields.map(name => {
        const field = baseFields.find(f => f.meta.name === name);
        if (!field) {
          if (name === SystemField.RELATED_SUB_FORM) {
            return { label: mappingSystemFieldAlias(SystemField.RELATED_SUB_FORM), value: SystemField.RELATED_SUB_FORM, isSystem: true, subType: "relatedSubForm", }
          }
          return null;
        }
        return { label: field.alias, value: `${field.uid}`, isSystem: true, subType: field.meta?.subType }
      })?.filter(Boolean);

      const subOptions = subFields.map(f => {
        const subTable = connection.tables.find(t => t.uid === f.meta?.extra?.subTableUID?.[1]);
        const uuidField = getUUIDSystemField(subTable?.fields || []);
        const subChildren = subTable?.fields?.filter(f => !isSystemField(f)).map(sf => {
          return {
            label: `${sf.alias}`,
            value: `${sf.uid}`,
            subType: f.meta?.subType,
          }
        }) ?? [];
        return {
          label: `${f.alias}`,
          value: `${f.uid}`,
          subType: f.meta?.subType,
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

  get inSubForm() {
    return this.parent.type === "widget.form.subform";
  }

  get formDataFilter() {
    return this.getOption<FilterRule>("form-data-filter") || {
      logic: LogicalOperator.AND,
      conditions: [],
    };
  }

  set formDataFilter(value: FilterRule) {
    this.setOption("form-data-filter", value);
  }

  private isConditionValueRequired(condition: FormCondition) {
    return ![RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.func);
  }

  private isConditionValueEmpty(value: any): boolean {
    if (Array.isArray(value)) {
      return value.length === 0 || value.every(item => this.isConditionValueEmpty(item));
    }

    return value === undefined || value === null || value === "";
  }

  private resolveConditionRuntimeValue(condition: FormCondition) {
    if (condition.fieldType !== CurrentFieldWrapperOperator.FIELD || !condition.comparisonUid) {
      return condition.value;
    }

    if (condition.comparisonOfForm === SelectIdOfForm.LINKAGE) {
      const allRelatedForms = this.topForm.children
        .filter(child => child.getSoul().type === "widget.form.relatedData")
        .filter((relatedForm: any) => {
          const relatedTable = this.getTable(relatedForm.connectionTable);
          return relatedTable.fields.find(f => f.uid === condition.comparisonUid);
        });
      const relatedValues = allRelatedForms
        .map((relatedData: any) => relatedData.getValue(condition.comparisonUid))
        .flat(Infinity);

      return relatedValues.length > 0 ? [...new Set(relatedValues)] : condition.value;
    }

    const comparisonForm = this.getComparisonFormElement(condition.comparisonUid);
    return comparisonForm ? comparisonForm.inputValue : condition.value;
  }

  get runtimeFormDataFilter(): FilterRule {
    const filterRule = this.formDataFilter;
    return {
      ...filterRule,
      conditions: filterRule.conditions.map(condition => ({
        ...condition,
        value: this.resolveConditionRuntimeValue(condition),
      })),
    };
  }

  get shouldHideDataWhenAllFilterConditionsEmpty() {
    const conditions = this.runtimeFormDataFilter.conditions.filter(condition => {
      return condition.uid?.split(".").length === 1 && this.isConditionValueRequired(condition);
    });

    return conditions.length > 0 && conditions.every(condition => {
      return this.isConditionValueEmpty(condition.value);
    });
  }

  get emptyResultFilterRule(): FilterRule | null {
    if (!this.uuidKey) return null;

    return {
      logic: LogicalOperator.AND,
      conditions: [{
        uid: this.uuidKey,
        func: RuleFunc.IN,
        value: [],
      }],
    };
  }

  get effectiveFormDataFilter(): FilterRule {
    if (this.shouldHideDataWhenAllFilterConditionsEmpty) {
      return this.emptyResultFilterRule || this.runtimeFormDataFilter;
    }

    return this.runtimeFormDataFilter;
  }

  get showFields() {
    return this.getOption<string[]>("showFields") || [];
  }

  set showFields(val: string[]) {
    this.setOption("showFields", val);
  }

  get showDataRow() {
    return this.getOption("show-data-row")
  }

  get showDataStyle() {
    return this.getOption("show-data-style")
  }

  private _showRows = ref([]);
  private _data = ref<Partial<Awaited<ReturnType<ReturnType<typeof this.getData>['getPagingRows']>>>>({});
  get showRows() {
    return this._showRows.value;
  }
  get rows() {
    return this._data.value?.rows || [];
  }

  public getValue(fieldUID: FieldUID, subFieldUID?: FieldUID) {
    if (subFieldUID) {
      if (this.showDataRow === ShowDataRow.SINGLE) return (this._columnCache.value[`${fieldUID}.${subFieldUID}`] || [])?.[0]?.falt();
      return (this._columnCache.value[`${fieldUID}.${subFieldUID}`] || []).flat();
    } else {
      if (this.showDataRow === ShowDataRow.SINGLE) return (this._columnCache.value[fieldUID] || [])?.[0];
      return this._columnCache.value[fieldUID] || [];
    }
  }

  get hiddenFieldsUid() {
    return this.getOption("hidden-fields-uid") || []
  }
  set hiddenFieldsUid(val: string[]) {
    this.setOption("hidden-fields-uid",  val)
  }
  private getCurrentSubFormComparisonElement(comparisonUid?: string) {
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

  private getComparisonFormElement(comparisonUid?: string) {
    if (!comparisonUid) return undefined;

    if (this.form.getSoul().type === "SubFormRow") {
      const currentSubFormElement = this.getCurrentSubFormComparisonElement(comparisonUid);
      if (currentSubFormElement) return currentSubFormElement;

      return this.topForm.getChildElement(comparisonUid) as FormElement | undefined;
    }

    return this.form.children.find((f: FormElement) => f.uid === comparisonUid) as FormElement | undefined;
  }

  override initAfterConstructor() {
    super.initAfterConstructor();

    if (!this.isEditable) {
      this.effectScope.run(() => {
        watch(() => this._computeShowRows(), (value) => {
          this._showRows.value = value || [];
        })

        watch(() => {
          return {
            value: this.formDataFilter.conditions.map(c => c.value),
            lastChangeTime: this.formDataFilter.conditions.map(c => {
              const widget = this.getComparisonFormElement(c.comparisonUid);
              return widget?.status?.lastChangeTime || null;
            }).filter(Boolean)
          }
        }, async(val) => {
          if(this.getBoard().formMode === FormMode.Edit && val.lastChangeTime.length === 0) return;
          // await this.fetchDistinctColumns(this._distinctFields.value);
          this.updateLastChangeTime();
        })

        const stop = watch(() => this.getBoard().isProjectReady, (value) => {
          if (value) {
            this.watchFilterRulesFieldsValue();
            if (this.showDataRow === ShowDataRow.SINGLE) {
              this.getSearchData()
            }
            nextTick(() => {
              stop();
            })
          }
        }, { immediate: true })
      })
    }
    this.effectScope.run(() => {
      watch(() => [ this.formDataSortFields, this.formDataSortOrderby ], (value) => {
        if(value[0]) {
          this.fieldSortRule = [
            {
              field: value[0],
              value: value[1]
            }
          ]
        }
      }, {immediate: true})

      watch(() => this.showDataRow, (value) => {
        // 变成单条数据查询时还原升降序和允许新增的默认值
        if (value === ShowDataRow.SINGLE) {
          this.setOption("form-data-sort-fields", null)
          this.setOption("form-data-sort-orderby", FormSortOrder.ASCEND)
        }
      })
    })
  }

  async handleSearchData(
    val: any,
    options: {
      condition: FormCondition,
    },
  ) {
    if (this._searchFormDestroyed) return;
    const { condition } = options;
    const value = val.value;
    condition.value = value;
    if (this.showDataRow === ShowDataRow.SINGLE) {
      await this.getSearchData();
    }
    if (this._searchFormDestroyed) return;
    const lastChange = val.lastChange;
    if (lastChange !== undefined && lastChange !== null) {
      if (this.showDataRow === ShowDataRow.SINGLE) {
        this.updateLastChangeTime();
      }
    }
  }
  handleSearchDataDebounce = debounce(this.handleSearchData, 500);

  // 监听筛选中所选的当前表单的字段值变化
  private watchFilterRulesFieldsValue() {
    this.stopFilterRulesFieldsValueWatchers();
    if (isEmpty(this.formDataFilter.conditions)) return;
    this.formDataFilter.conditions.forEach(condition => {
      if (condition.fieldType === CurrentFieldWrapperOperator.FIELD && condition.comparisonUid) {
        if (condition.comparisonOfForm && condition.comparisonOfForm === SelectIdOfForm.LINKAGE) {
          // 获取所有与当前查询表单所关联的表单不同的关联表单
          const allRelatedForms = this.topForm.children.filter(child => child.getSoul().type === "widget.form.relatedData").filter((r: any) => {
            const relatedTable = this.getTable(r.connectionTable);
            if (relatedTable.fields.find(f => f.uid === condition.comparisonUid)) return r;
          });
          // 多个关联表单的逻辑
          const relatedValues = ref([])
          for(const [index, relatedData] of allRelatedForms.entries()) {
            // 只会与关联表单的主表字段值进行筛选
            const relatedValueDebounce = debounce(async (value) => {
              if (this._searchFormDestroyed) return;
              relatedValues.value[index] = value;
              if (relatedValues.value.length > 0) {
                condition.value = [...new Set(relatedValues.value.flat())];
                if (this.showDataRow === ShowDataRow.SINGLE) {
                  await this.getSearchData();
                  if (this._searchFormDestroyed) return;
                  this.updateLastChangeTime();
                }
              }
            }, 500);
            this._filterDebounceCancels.push(() => relatedValueDebounce.cancel());
            const stop = watch(() => (relatedData as any).getValue(condition.comparisonUid), relatedValueDebounce, { immediate: true });
            this._filterWatchStops.push(stop);
          }
        } else {
          // 与当前表单字段的值进行对比
          const comparisonForm = computed(() => this.getComparisonFormElement(condition.comparisonUid))
          const stop = watch(() => {
            const widget = comparisonForm.value as FormElement | undefined;
            return {
              value: widget?.inputValue,
              lastChange: widget?.status?.lastChangeTime
            }
          }, async (val) => {
            await this.handleSearchDataDebounce(val, { condition })
          }, { immediate: true })
          this._filterWatchStops.push(stop);
        }
      }
    })
  }

  private stopFilterRulesFieldsValueWatchers() {
    this._filterWatchStops.forEach(stop => stop());
    this._filterWatchStops = [];
    this._filterDebounceCancels.forEach(cancel => cancel());
    this._filterDebounceCancels = [];
  }

  public pageSize = ref<number>(10);
  public total = ref<number>(0);
  public pageNumber = ref<number>(1);
  public searchData = ref({});
  public async getSearchData() {
    if (this._searchFormDestroyed) return;
    const res = await this.getRows({
      pageSize: this.pageSize.value,
      pageNumber: this.pageNumber.value,
    });
    if (this._searchFormDestroyed) return;
    this.total.value = res.count;
    this.searchData.value = res.rows[0];
  }

  private _subTableData = ref<Record<FieldUID, typeof this._data.value>>({});
  get subTableData() {
    return this._subTableData.value
  }
  async readSubTableData(rows: object[]) {
    if (this._searchFormDestroyed) return;
    const keys = rows.map(row=>row[this.uuidKey]);
    for (const field of this.subFormTableFields) {
      if (this._searchFormDestroyed) return;
      await this.getData().getPagingRows(field.subTableUID, {
        filters: {
          [field.subTableUID[1]]: [{
            [field.relationKey]: {
              $in: keys,
            }
          }]
        },
      }).then(({ rows, count }) => {
        if (this._searchFormDestroyed) return;
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
  // 筛选条件处理
  private _filters = ref();
  get curFilters() {
    return this._filters.value
  }
  async getRows(options: QueryOptions = {}) {
    if (this._searchFormDestroyed) {
      return {
        rows: [],
        count: 0,
      };
    }
    const selectionMeta = resolveDataSourceSelectionMeta(
      this.getBoard(),
      this.selectSearchForm,
      this.topForm?.tableUID?.[0],
    );

    if (!selectionMeta.connection || !selectionMeta.table) {
      const emptyData = {
        rows: [],
        count: 0,
      };
      this._data.value = emptyData;
      return emptyData as any;
    }
    if (this.shouldHideDataWhenAllFilterConditionsEmpty) {
      const emptyData = {
        rows: [],
        count: 0,
      };
      this._filters.value = undefined;
      this._data.value = emptyData;
      return emptyData as any;
    }
    if (this.formDataFilter.conditions && this.formDataFilter.conditions.length > 0) {
      let filters: Record<string, WhereCondition[]> = {};
      const filterRule = this.effectiveFormDataFilter as FilterRule
      const cond = filterRule.conditions.filter(c => c.uid?.split(".").length === 1);
      const queryConditions = cond.map(transformCondition);
      const logicKey = filterRule.logic === LogicalOperator.AND ? "$and" : "$or";
      let queryParts: any[] = [];
      if (cond.length) {
        queryParts.push({ [logicKey]: queryConditions });
      }
      const query: WhereCondition = queryParts.length > 1
        ? { $and: queryParts }
        : queryParts[0]; // 只有一个条件就不用包 $and
      filters = {
        [this.selectSearchForm[1]]: [
          query,
        ]
      };
      this._filters.value = filters
      options.filters = filters
    }
    const res = await this.getData().getPagingRows(this.selectSearchForm, options);
    if (this._searchFormDestroyed) {
      return {
        rows: [],
        count: 0,
      };
    }
    await this.readSubTableData(res.rows);
    if (this._searchFormDestroyed) {
      return {
        rows: [],
        count: 0,
      };
    }
    this._data.value = res;
    return res;
  }

  get uuidKey() {
    return getUUIDSystemField(this.selectSearchFormFields)?.uid;
  }

  get subFormTableFields() {
    return this.selectSearchFormFields.filter(f => f.meta?.subType === "subForm").map(f => {
      const connection = this.getSelectSearchFormConnection();
      const subTable = connection?.tables?.find(t => t.uid === f.meta?.extra?.subTableUID?.[1]);
      return {
        fieldUID: f.uid,
        relationKey: subTable?.fields?.find(f => f.meta.name === SystemField.KEY)?.uid,
        subFields: subTable?.fields,
        subTableUID: f.meta.extra?.subTableUID,
      }
    })
  }

  private _computeShowRows() {
    const rows = [];
    const uuidKey = this.uuidKey;
    for (const row of this.rows) {
      const rowUUID = row[uuidKey];
      //子表数据
      let maxLen = 1;
      const subRowsList: { subRows: object[], subFields: Field[] }[] = [];
      for (const {fieldUID, relationKey, subFields} of this.subFormTableFields) {
        const data = this._subTableData.value[fieldUID];
        const subRows = data?.rows?.filter(row=>row[relationKey] === rowUUID) ?? [];
        subRowsList.push({ subRows, subFields });
        if (subRows.length > maxLen) {
          maxLen = subRows.length;
        }
      }
      for (let i = 0; i < maxLen; i++) {
        const newRow = {
          ...row,
          _merge: maxLen > 1,
          _mergeRow: i === 0 ? maxLen : undefined,
        };
        for (const { subRows, subFields } of subRowsList) {
          const subRow = subRows[i] ?? {};
          Object.assign(newRow, (subFields || []).reduce<Record<string, any>>((result, field) => {
            const canDisplayInMainRow = field.meta?.name === SystemField.UUID || !isSystemField(field);
            if (canDisplayInMainRow && Object.prototype.hasOwnProperty.call(subRow, field.uid)) {
              result[field.uid] = subRow[field.uid];
            }
            return result;
          }, {}));
        }
        rows.push(newRow);
      }
    }

    return rows;
  }

  get supportFixedWidth() {
    return false;
  }

  isCreateField() {
    return false;
  }

  get nocodeId() {
    return this.getSelectSearchFormMeta().nocodeId || this.getBoard().nocodeId;
  }

  // 排序字段
  get formDataSortFields() {
    return this.getOption("form-data-sort-fields")
  }
  // 升降序
  get formDataSortOrderby() {
    return this.getOption("form-data-sort-orderby")
  }

  private _fieldSortRule = ref()
  get fieldSortRule() {
    return this._fieldSortRule.value
  }
  set fieldSortRule(val) {
    this._fieldSortRule.value = val
  }

  override getOption<T extends OptionValue>(paths: string | string[], options?: GetOptionOptions) {
    const path = Array.isArray(paths) ? paths.at(-1) : paths;
    if (["field-filling", "field-visible"].includes(path)) {
      return this.topForm?.getFieldOptionRule(path === "field-filling" ? "fill" : "visible", this) as T;
    }

    if (["showFields"].includes(path)) {
      // 判断引用的表的字段是否有变化，新增的字段直接被选中
      if (!isEmpty(this.selectSearchFormFields)) {
        let curFields = super.getOption<T>(paths, options) as string[]
        let selectFormAllFieldsUID = []
        this.selectSearchFormFieldsOptions.forEach(f => {
          selectFormAllFieldsUID.push(f.value)
          if (f.children) {
            selectFormAllFieldsUID = selectFormAllFieldsUID.concat(f.children.map(f => f.value))
          }
        });
        const oldAllFieldsUID = [...curFields, ...this.hiddenFieldsUid];

        const hasNewFields = selectFormAllFieldsUID.filter((uid: `f_${string}`) => !oldAllFieldsUID.includes(uid));
        const hasDeleteFields = oldAllFieldsUID.filter((uid: `f_${string}`) => !selectFormAllFieldsUID.includes(uid));
        if (isEmpty(hasNewFields) && isEmpty(hasDeleteFields)) return super.getOption<T>(paths, options);

        // 字段有新增,将新增的字段加入showFields
        for (const uid of hasNewFields) {
          curFields = [...curFields, uid]
        }

        // 字段删除
        for (const uid of hasDeleteFields) {
          if (curFields.includes(uid)) {
            curFields = curFields.filter(fuid => fuid !== uid)
          }
          if (this.hiddenFieldsUid.includes(uid)) {
            this.hiddenFieldsUid = this.hiddenFieldsUid.filter(fuid => fuid !== uid);
          }
        }

        return curFields
      }
    }

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
        this.selectSearchFormFieldsOptions.forEach(f => {
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
          const selectColumns = this.selectSearchFormFieldsOptions.filter(fc => selectSubFields.some(f => f.fieldUID === fc.value))

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
          const allSubCloumns = this.selectSearchFormFieldsOptions.filter(f => f.children)
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
          const deleteColumns = this.selectSearchFormFieldsOptions.filter(fc => deleteSubFields.some(f => f.fieldUID === fc.value))

          // 删除子表单项，其子项全部删除
          if (!isEmpty(deleteColumns)) {
            const deleteSubChildrem = deleteColumns[0].children.map(f => f.value)
            value = (value as string[]).filter(f => !deleteSubChildrem.includes(f))
          }

          // 删除子表单中的某个项，子表单项的选中删除
          const allSubCloumns = this.selectSearchFormFieldsOptions.filter(f => f.children)
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

  get allowAddNewRow() {
    return this.getOption("allow-add-new-row");
  }
  get allowEditRow() {
    return this.getOption("allow-edit-row");
  }
  get addCurrentRowToLinkageForm() {
    return this.getOption("add-current-row-to-linkage-form");
  }

  private _columnCache = ref<Record<FieldUID, any[]>>({});
  get columnCache() {
    return this._columnCache.value;
  }
  private getFilterQuery(filterRule: FilterRule, conditions = filterRule.conditions) {
    const queryConditions = conditions.map(transformCondition);
    const logicKey = filterRule.logic === LogicalOperator.AND ? "$and" : "$or";
    let queryParts: any[] = [];
    if (queryConditions.length) {
      queryParts.push({ [logicKey]: queryConditions });
    }
    return queryParts.length > 1
      ? { $and: queryParts }
      : queryParts[0];
  }
  public async refreshColumnCache(ids: string[]) {
    if (this._searchFormDestroyed) return;
    if (!this.getSelectSearchFormConnection() || !this.getSelectSearchFormTable()) {
      this._columnCache.value = {};
      return;
    }
    let options: QueryOptions = {};
    const filterRule = this.formDataFilter as FilterRule
    const mainConditions = filterRule.conditions.filter(c => c.uid?.split(".").length === 1);
    if (mainConditions.length > 0) {
      let filters: Record<string, WhereCondition[]> = {};
      const query = this.getFilterQuery(filterRule, mainConditions)
      filters = {
        [this.selectSearchForm[1]]: [
          query,
        ]
      };
      this._filters.value = filters
      options.filters = filters
    }

    const { rows = [] } = await this.getData().getPagingRows(this.selectSearchForm, options);
    if (this._searchFormDestroyed) return;
    const uuidKey = this.uuidKey;
    const rowKeys = uuidKey ? rows.map(row => row[uuidKey]).filter(Boolean) : [];
    const subTableRowsMap: Record<FieldUID, Record<string, any[]>> = {};
    const subTableFieldIds = [...new Set(ids.filter(id => id.split(".").length > 1).map(id => id.split(".")[0] as FieldUID))];

    for (const fieldId of subTableFieldIds) {
      if (this._searchFormDestroyed) return;
      const field = this.selectSearchFormFields.find(f => f.uid === fieldId);
      const subTableUID = field?.meta?.extra?.subTableUID;
      const subTable = subTableUID ? this.getTable(subTableUID) : undefined;
      const relationKey = subTable?.fields?.find(f => f.meta.name === SystemField.KEY)?.uid;
      if (!subTable || !relationKey || !rowKeys.length) continue;

      const subConditions = filterRule.conditions
        .filter(condition => {
          const uid = condition.uid?.split(".") || [];
          return uid.length > 1 && uid[0] === fieldId;
        })
        .map(condition => ({
          ...condition,
          uid: condition.uid.split(".")[1],
        }));
      const subQuery = this.getFilterQuery(filterRule, subConditions);
      const relationQuery = {
        [relationKey]: {
          $in: rowKeys,
        }
      };
      const query: WhereCondition = subQuery ? {
        $and: [
          subQuery,
          relationQuery,
        ]
      } : relationQuery;
      const { rows: subRows = [] } = await this.getData().getPagingRows(subTableUID, {
        filters: {
          [subTable.uid]: [query],
        }
      });
      if (this._searchFormDestroyed) return;
      subTableRowsMap[fieldId] = subRows.reduce<Record<string, any[]>>((prev, row) => {
        const key = row[relationKey];
        if (!prev[key]) {
          prev[key] = [];
        }
        prev[key].push(row);
        return prev;
      }, {});
    }

    if (rows) {
      for (const id of ids) {
        const [fieldId, subFieldId] = id.split(".");
        if (!subFieldId) {
          this._columnCache.value[id] = rows.map(r => r[fieldId])
        } else {
          this._columnCache.value[id] = rows.map(row => {
            const rowKey = uuidKey ? row[uuidKey] : undefined;
            const subRows = rowKey ? (subTableRowsMap[fieldId]?.[rowKey] || []) : [];
            return subRows.map(subRow => subRow[subFieldId]);
          });
        }
      }
    }
  }

  override destroy(onlySelf: boolean = false) {
    if (this._searchFormDestroyed) return;
    this._searchFormDestroyed = true;
    this.stopFilterRulesFieldsValueWatchers();
    this.handleSearchDataDebounce.cancel();
    super.destroy(onlySelf);
  }
}
