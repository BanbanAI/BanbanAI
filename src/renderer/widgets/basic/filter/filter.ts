import { RuleFunc, RuleFuncTextMapping, FormElementConfiguration, RuleFuncValue } from "@common/types/nocode";
import { formElementInstances } from "@renderer/utils/instance";
import { SystemField, isNocodeFormData, transformCondition, getSystemColumnConfigurations } from "@common/utils/connection";
import { DefinedOptions, OptionFileValue, OptionFieldValue } from "@renderer/b2/types";
import { Widget, FilterWidget } from "@renderer/b2/controllers/widget";
import { Color } from "@renderer/b2/color";
import { Board } from "@renderer/b2/controllers/board";
import { Soul } from "@common/types/project";
import { nextTick, ref, Ref, toRaw, toRef, watch } from "vue";
import resource from "./locales";
import { equals, isEmpty } from '@common/utils/object';
import i18next from "@renderer/widgets/i18next";
import { Field, FieldUID, TableUID, WhereCondition } from "@common/types/project";
import LinkageFieldsSettingDialog from "./LinkageFieldsSettingDialog.vue"
import dayjs from "dayjs";
import { fetchDistinct } from "../../form/_common/distinct";
import axios from "axios";

const LABEL_DEFAULT = i18next.t('plsSelect');

type SelectItemField = {
  linkageWidgets: string[],
  linkageFields: Record<FieldUID, string[]>,
}

const allowSelectFormFieldType = ["widget.form.checkboxGroup", "widget.form.textInput", "widget.form.memberSelect", "widget.form.radioGroup", "widget.form.treeSelect", "widget.form.treeMultipleSelect", "widget.form.serialNumber"]

export class DataFilter extends FilterWidget {
  public _selectedItem = ref(); // 当前选中项
  private _filterText = ref("");
  get defaultName () {
    return i18next.t("defaultName");
  }
  constructor(soul: Soul, parent: Widget | Board) {
    // 兼容
    // let hasKeyField = false;
    // if (soul.options?.["dropdown-key-fields"]) { // 联动字段
    //   hasKeyField = true;
    //   let fields = soul.options["dropdown-key-fields"];
    //   soul.options["dropdown-linkage-fields"] = fields;
    //   delete soul.options["dropdown-key-fields"];
    // }
    // if (soul.options?.["dropdown-fields"]) { // 选项字段
    //   let fields = soul.options["dropdown-fields"];
    //   soul.options["dropdown-item-fields"] = fields;
    //   if(!hasKeyField) {
    //     soul.options["dropdown-linkage-fields"] = fields;
    //   }
    //   delete soul.options["dropdown-fields"];
    // }
    super(soul, parent);
  }

  get filterText() {
    return this._filterText.value;
  }

  set filterText(val) {
    this._filterText.value = val;
  }

  get selectedItem () {
    return this._selectedItem.value;
  }
  set selectedItem(val) {
    this._selectedItem.value = val;
  }

  static resource = resource;
  // get useSearch() {
  //   return this.getOption('use-search')
  // }

  // get noDataText() {
  //   return this.getOption('dropdown-no-data') || " ";
  // }

  static defineOptions(): DefinedOptions[] {
    const UNIT_GE = i18next.t("unitGe");
    return [{
      data: {
        fields: {
          alias: i18next.t("fieldsSetting"),
          fold: "unfold",
          children: [
            {
              name: "dropdown-item-fields",
              alias: i18next.t("selectFields"),
              type: "field(max=1)"
            },
            {
              name: "use-json-type",
              alias: i18next.t("jsonFormat"),
              type: "boolean",
              // visible:(widget: DropdownV2) => {
              //   return widget.getOption("use-json-type");
              // },
              default: false
            },
            {
              name: "dropdown-linkage-fields",
              alias: i18next.t("dropdownFieldsKey"),
              visible:(widget: DataFilter) => {
                return !widget.getOption("use-json-type");
              },
              type: "field(max=1)"
            }
          ],
          visible:(widget: DataFilter)=>{
            return widget.getOption("dropdown-option-setting") === 'data'
          },
        },
        //联动字段绑定
        linkage: {
          locked: false,
          fold: "unfold",
          children: [
            {
              name: "linkage-elements",
              visible: false,
            },
            {
              name: "relationship-field",
              alias: i18next.t("linkageField"),
              type: "dialog",
              dialog: {
                component: LinkageFieldsSettingDialog,
                buttonText(widget: DataFilter) {
                  return isEmpty(widget.relationshipField?.linkageWidgets) ? i18next.t("setting") : i18next.t("linkageRuleSet");
                },
                buttonStyle(widget: DataFilter) {
                  const value = widget.relationshipField?.linkageWidgets;
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              },
              visible: (widget: DataFilter) => {
                return widget.getOption("linkage-out");
              }
            },
            {
              name: "relationship-filter-func",
              alias: i18next.t("defaultFilter"),
              type: "select",
              default: (widget: DataFilter) => {
                const selectFunc = Object.keys(widget.relationshipElementFunc).map(key => { return { label: RuleFuncTextMapping[key], value: key } });
                return isEmpty(selectFunc) ? RuleFunc.EQUAL : selectFunc[0].value;
              },
              selectChoices: (widget: DataFilter) => {
                const selectFunc = Object.keys(widget.relationshipElementFunc).map(key => { return { label: RuleFuncTextMapping[key], value: key } });
                return isEmpty(selectFunc)
                  ? [{ label: RuleFuncTextMapping[RuleFunc.EQUAL], value: RuleFunc.EQUAL }]
                  : selectFunc;
              },
              visible: (widget: DataFilter) => {
                return widget.getOption("linkage-out");
              }
            },
            {
              name: "relationship-select-filter-value",
              alias: i18next.t("optionValueRange"),
              type: "select",
              placeholder: i18next.t("selectRange"),
              default: "all",
              selectChoices: (widget: DataFilter) => {
                return isEmpty(widget.relationshipField?.linkageWidgets) ? [{ label: i18next.t("all"), value: "all" }] : [{ label: i18next.t("all"), value: "all" }].concat(widget.relationshipAllTables);
              },
              visible: (widget: DataFilter) => {
                return widget.getOption("linkage-out");
              }
            },
            {
              name: "relationship-default-option-value-single",
              alias: i18next.t("defVal"),
              type: "select",
              placeholder: i18next.t("selectDefaultValue"),
              disabled: (widget: DataFilter) => {
                return [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes((widget.relationshipFilterFunc as RuleFunc));
              },
              selectChoices: (widget: DataFilter) => {
                return widget.relationshipDefaultOptions || [];
              },
              visible: (widget: DataFilter) => {
                return widget.getOption("linkage-out") && !widget.isMultiple && widget.relationshipElementFunc[widget.relationshipFilterFunc as RuleFunc] !== RuleFuncValue.RANGE;
              }
            },
            {
              name: "relationship-default-option-value-multiple",
              alias: i18next.t("defVal"),
              type: "select(multiple)",
              placeholder: i18next.t("selectDefaultValue"),
              selectChoices: (widget: DataFilter) => {
                return widget.relationshipDefaultOptions || [];
              },
              visible: (widget: DataFilter) => {
                return widget.getOption("linkage-out") && widget.isMultiple && widget.relationshipElementFunc[widget.relationshipFilterFunc as RuleFunc] !== RuleFuncValue.RANGE;
              }
            },
            {
              name: "relationship-default-option-value-range-number-v1",
              alias: i18next.t("defVal"),
              placeholder: i18next.t("minValue"),
              type: "number",
              visible: (widget: DataFilter) => {
                return widget.getOption("linkage-out") && widget.relationshipElementTemp?.resolveFormSetting().subType === "number" && widget.relationshipElementFunc[widget.relationshipFilterFunc as RuleFunc] === RuleFuncValue.RANGE;
              }
            },
            {
              name: "relationship-default-option-value-range-number-v2",
              type: "number",
              placeholder: i18next.t("maxValue"),
              visible: (widget: DataFilter) => {
                return widget.getOption("linkage-out") && widget.relationshipElementTemp?.resolveFormSetting().subType === "number" && widget.relationshipElementFunc[widget.relationshipFilterFunc as RuleFunc] === RuleFuncValue.RANGE;
              }
            },
            {
              name: "relationship-default-option-value-range-date-v1",
              alias: i18next.t("defVal"),
              type: "date",
              placeholder: i18next.t("startDate"),
              visible: (widget: DataFilter) => {
                return widget.getOption("linkage-out") && widget.relationshipElementTemp?.resolveFormSetting().subType === "date" && widget.relationshipElementFunc[widget.relationshipFilterFunc as RuleFunc] === RuleFuncValue.RANGE;
              },
              valueType: '',
            },
            {
              name: "relationship-default-option-value-range-date-v2",
              type: "date",
              placeholder: i18next.t("endDate"),
              visible: (widget: DataFilter) => {
                return widget.getOption("linkage-out") && widget.relationshipElementTemp?.resolveFormSetting().subType === "date" && widget.relationshipElementFunc[widget.relationshipFilterFunc as RuleFunc] === RuleFuncValue.RANGE;
              },
              valueType: '',
            },
            {
              name: "relationship-level-filter",
              alias: i18next.t("multiLevelFilter"),
              type: "select(multiple)",
              placeholder: i18next.t("selectOtherFilterComp"),
              selectChoices: (widget: DataFilter) => {
                const thisRelationshipFieldValue: any = widget.getOption("relationship-field");
                const otherFilterptions = widget.getOtherFilterptions().filter(f => f.getSoul().type === "widget.basic.filter").map(item => {
                  const otherRelationshipFieldValue: any = item.getOption("relationship-field");
                  if (thisRelationshipFieldValue && otherRelationshipFieldValue && otherRelationshipFieldValue.linkageWidgets.every(item => thisRelationshipFieldValue.linkageWidgets.includes(item))) {
                    const otherLinkageTable = widget.getLinkageTable(otherRelationshipFieldValue.linkageWidgets[0]);
                    const otherLinkageField = widget.getLinkageFieldByTable(otherLinkageTable, otherRelationshipFieldValue);
                    // 允许多级筛选联动字段类型
                    if (allowSelectFormFieldType.includes(otherLinkageField.meta?.extra?.widgetType)) {
                      return { label: item.widgetTitle, value: item.uid };
                    }
                  }
                }).filter(item => item) || [];
                return otherFilterptions;
              },
              visible: (widget: DataFilter) => {
                return widget.getOption("linkage-out");
              }
            },
          ],
          visible:(widget: DataFilter)=>{
            return widget.getOption("dropdown-option-setting") !== "data";
          },
        }
      },
      style: {
        basic: {
          alias: i18next.t("basicSetting"),
          children: [
            {
              name: "grid-width",
              alias: "",
              type: "number(unit=格,min=1,max=60,showInput)",
              default: 18,
              visible: (widget: Widget)=>{
                return widget.parent.layout !== "fluid" && widget.getOption<"proportion"|"customize">("grid-width-option") === "customize";
              },
            },
            {
              name: "grid-height",
              alias: i18next.t("height"),
              type: "number(unit=格,min=1)",
              default: 6,
              visible: (widget: Widget)=>{
                return widget.parent.layout !== "fluid";
              },
            },
            {
              name: "no-events",
              visible: false,
            },
            {
              name: "dropdown-tip-text",
              alias: i18next.t("selectTipText"),
              type: "string",
              default: i18next.t("toChoice"),
              visible: true
            },
          ]
        },
        "widget-title": {
          children: [
            {
              name: "widget-title-text",
              alias: i18next.t("title"),
              type: "string",
              default: (widget: DataFilter) => {
                return widget.getOption("custom-widget-title-text");
              },
            },
          ],
          visible: false,
        },
        "custom-widget-title": {
          alias: i18next.t("title"),
          type: 'boolean',
          default: true,
          children: [
            {
              name: "custom-widget-title-text",
              alias: i18next.t("title"),
              type: "string",
              default: i18next.t("dropdownFilter"),
            },
            {
              name: "custom-widget-font",
              alias: i18next.t("fontSec"),
              type: "font(underline, line-through, noSize)",
              default: {
                family: 'sans-serif',
                size: 14,
                color: "#111111",
                bold: false,
                italic: false,
                underline: false,
                "line-through": false
              },
            },
            {
              name: "custom-widget-font-spacing",
              alias: i18next.t("textSpacing"),
              default: 0,
              type: "number(unit=px,min=0)",
            },
          ],
        },
        "dropdown-options": {
          alias: i18next.t("dropdownOptions"),
          visible: false,
          children: [
            {
              name: "dropdown-drop-style",
              alias: i18next.t("dropStyle"),
              show: "tab",
              children: [
                {
                  name: "dropdown-drop-overall-style-cluster",
                  alias: i18next.t("dropOverallCluster"),
                  fold: "unfold",
                  children: [
                    {
                      name: "options-drop-border-radius",
                      alias: i18next.t("dropBorderRadius"),
                      type: "number(unit=px)",
                      default: 0,
                    },
                  ]
                }
              ]
            },
          ]
        },
      }
    }

      , ...super.defineOptions()]
  }

  initAfterConstructor() {
    super.initAfterConstructor();
    const stop = watch(() => this.getBoard().isProjectReady, async (value) => {
      if (value) {
        await this.initWatch();
        nextTick(() => {
          stop();
        })
      }
    }, { immediate: true })
    this.effectScope.run(async () => {
      this._allDepartments.value = await this.getBoard().getOrganizeDepartments();
    })
  }
  initWatch() {
    this.effectScope.run(() => {
      watch(() => this.relationshipField, async (value: any, oldVal) => {
        if (value && this.getOption("linkage-out")) {
          if (isEmpty(value.linkageWidgets)) {
            this.relationshipFilterFunc = RuleFunc.EQUAL;
            this.setOption("relationship-select-filter-value", 'all');
            this.relationshipDefaultOptionValue = null;
            this.setOption("relationship-level-filter", null);
            this._relationshipElementFunc.value = {};
            this.relationshipDefaultOptions = [];
            return;
          }
          const table = this.getLinkageTable(value.linkageWidgets[0]);
          const field = this.getLinkageFieldByTable(table, value);
          this._relationshipElementTemp.value = await this.getInstance(field)
          this._relationshipElementFunc.value = await this.filterMenus(field);
          const unqiueValues = new Set();
          const selectTables = value?.linkageWidgets?.map(item => {
            const curLinkageTable = this.getLinkageTable(item);
            if (!unqiueValues.has(curLinkageTable.uid)) {
              unqiueValues.add(curLinkageTable.uid);
              return { label: curLinkageTable.alias, value: curLinkageTable.uid };
            }
          }).filter(item => item);
          this._relationshipAllTables.value = selectTables;
          if (oldVal) {
            const selectFunc = Object.keys(this.relationshipElementFunc).map(key => { return { label: RuleFuncTextMapping[key], value: key } });
            this.relationshipFilterFunc = isEmpty(selectFunc) ? RuleFunc.EQUAL : selectFunc[0].value as RuleFunc;
            this.setOption("relationship-select-filter-value", 'all');
            this.relationshipDefaultOptionValue = null;
            this.setOption("relationship-level-filter", null);
          }
          if (!isEmpty(this.relationshipDefaultOptions) && !oldVal && !this.isEditable) {
            // 关联this的筛选组件有默认值时return，否则会覆盖筛选后的选项
            return;
          }
          await this.getRelationshipDefaultOptions(this.relationshipSelectFilterValue);
        }
      }, { immediate: true, deep: true})

      watch(() => this.relationshipFilterFunc, (value, oldVal) => {
        if (equals(value, oldVal)) return;
        if (oldVal) {
          this.relationshipDefaultOptionValue = null;
          if (this.isRange) {
            this.selectedItem = [];
          } else {
            this.selectedItem = null;
          }
        }
      })

      watch(() => this.relationshipSelectFilterValue, async (value, oldVal) => {
        if (equals(value, oldVal)) return;
        if (!isEmpty(this.relationshipDefaultOptions) && !oldVal) {
          // 关联this的筛选组件有默认值时return，否则会覆盖筛选后的选项
          return;
        }
        await this.getRelationshipDefaultOptions(value);
      }, { immediate: true })
      watch(() => [this.relationshipDefaultOptionValueRangeNumber, this.relationshipDefaultOptionValueRangeDate, this.relationshipDefaultOptionValue, this.relationshipElementTemp?.resolveFormSetting().subType, this.isRange, this.getBoard().isProjectReady], (value, oldVal) => {
        if (value[5]) {
          let nextSelectedItem;
          if (value[4] && value[3] === "number") {
            nextSelectedItem = value[0];
          } else if (value[4] && (value[3] === "date" || value[3] === "daterange")) {
            nextSelectedItem = value[1];
          } else {
            nextSelectedItem = value[2];
          }
          if (!oldVal && !this.isEditable && this.isEmptyRelationshipDefaultValue(nextSelectedItem)) {
            return;
          }
          this.selectedItem = nextSelectedItem;
        }
      }, { immediate: true, deep: true })

      // 默认值筛选(多选)，多选时值会后变化
      const stopSelectWatch = watch(() => this.selectedItem, (value) => {
        if ((!isEmpty(value)) && this.relationshipField?.linkageWidgets && this.relationshipField.linkageWidgets.length > 0) {
          if (this.isRange && isEmpty(value[0]) && isEmpty(value[1])) return;
          this.applyFilter({
            value: value,
            func: this.relationshipFilterFunc,
            linkageFields: this.relationshipField.linkageFields,
          })
          nextTick(() => {
            stopSelectWatch();
          })
        }
      })
      // 默认值筛选(单选)
      if (this.selectedItem && !this.isMultiple) {
        this.applyFilter({
          value: this.selectedItem,
          func: this.relationshipFilterFunc,
          linkageFields: this.relationshipField.linkageFields,
        })
      }
      const unqiueValues = new Set();
      const selectTables = this.relationshipField?.linkageWidgets?.map(item => {
        const curLinkageTable = this.getLinkageTable(item);
        if (!unqiueValues.has(curLinkageTable.uid)) {
          unqiueValues.add(curLinkageTable.uid);
          return { label: curLinkageTable.alias, value: curLinkageTable.uid };
        }
      }).filter(item => item);
      this._relationshipAllTables.value = selectTables;

      watch(() => {
        return this.getOtherFilterptions().map((item: DataFilter) => {
          if(!isEmpty(item.relationshipLevelFilter)) return item.relationshipLevelFilter;
        }).filter(item => item).flat(Infinity)
      }, (value) => {
        if (value.includes(this.uid)) {
          this.handleRelationshipLevelFilter();
        }
      }, { immediate: true, deep: true })

      if (this.isEditable) {
        watch(() => this.getCurrentBoardWidgets(), (value, oldVal) => {
          // 删除被筛选的图表需要去除筛选组件上对应的条件
          const deleteWidget = oldVal.filter(oldItem => !value.find(newItem => newItem.uid === oldItem.uid));
          for (const item of deleteWidget) {
            if (this.relationshipField && this.relationshipField.linkageWidgets?.includes(item.uid)) {
              this.relationshipField.linkageWidgets = this.relationshipField.linkageWidgets.filter(widget => widget !== item.uid);
              for (const field of Object.keys(this.relationshipField.linkageFields)) {
                if (this.relationshipField.linkageFields[field].includes(item.uid)) {
                  this.relationshipField.linkageFields[field] = this.relationshipField.linkageFields[field].filter(widget => widget !== item.uid);
                  if (isEmpty(this.relationshipField.linkageFields[field])) {
                    delete this.relationshipField.linkageFields[field];
                  }
                }
              }
            }
          }
        })
      }
    })
  }

  handleRelationshipLevelFilter() {
    // 监听当前看板上所有关联自己的筛选组件（可能有多个筛选组件对我进行筛选）
    const allTables = (this.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || []).reduce((prev, connection) => {
      prev.push(...(connection.tables || []));
      return prev;
    }, [])
    let filters: Record<string, WhereCondition[]> = {};
    let tableUseFields: Record<string, Record<string, {func: string, value: any}>>= {};
    for (const [index, filterWidget] of this.getOtherFilterptions().entries()) {
      if ((filterWidget as any).relationshipLevelFilter && (filterWidget as any).relationshipLevelFilter.includes(this.uid)) {
        // 多级筛选
        watch(() => (filterWidget as any).selectedItem, async (value, oldValue) => {
          if (equals(value, oldValue)) return;
          // 用当前所选值来组合成{tableUID: filters}
          const curUseTables = allTables.filter(item => (filterWidget as any).relationshipAllTables.find(table => table.value === item.uid))
          const curFunc: string = (filterWidget as any).relationshipFilterFunc;
          for (const table of curUseTables) {
            const useField = this.getLinkageFieldByTable(table, (filterWidget as any).relationshipField);
            if (tableUseFields[table.uid]) {
              if (tableUseFields[table.uid][useField.uid]) {
                delete tableUseFields[table.uid][useField.uid];
              }
              tableUseFields[table.uid][useField.uid] = {func: curFunc, value: value}
            } else {
              tableUseFields[table.uid] = {[useField.uid]: {func: curFunc, value: value}};
            }
          }

          for (const table of curUseTables) {
            // 获取当前table的所有字段的查询条件
            const queryConditions = Object.keys(tableUseFields[table.uid]).map(key => {
              const useField = this.getLinkageFieldByTable(table, (filterWidget as any).relationshipField);
              if (useField.uid === key) {
                return transformCondition({uid: useField.uid, func: curFunc, value})
              } else if (tableUseFields[table.uid]?.[key]?.value) {
                // 其他有值的字段保留原值
                return transformCondition({uid: key, func: tableUseFields[table.uid]?.[key]?.func, value: tableUseFields[table.uid]?.[key]?.value})
              }
            }).filter(item => item);
            let queryParts: any[] = [];
            if (!isEmpty(queryConditions)) {
              queryParts.push({ "$and": queryConditions });
            }
            const query: WhereCondition = queryParts.length > 1
              ? { $and: queryParts }
              : queryParts[0];
            if (query) {
              filters[table.uid] = [query];
            }
          }
          await this.getRelationshipDefaultOptions(this.relationshipSelectFilterValue, filters)
        }, { immediate: true })
      }
    }
  }

  private _allDepartments = ref();
  get allDepartments() {
    return this._allDepartments.value;
  }

  get customWidgetTitleEnabled() {
    return this.getOption<boolean>("custom-widget-title");
  }

  get widgetTitleEnabled() {
    return false;
  }

  get widgetTitle() {
    return this.getOption<string>("custom-widget-title-text");
  }

  get relationshipFilterFunc() {
    return this.getOption<RuleFunc>("relationship-filter-func");
  }

  set relationshipFilterFunc(val) {
    this.setOption("relationship-filter-func", val);
  }

  get relationshipField() {
    return this.getOption<SelectItemField>("relationship-field");
  }

  private _relationshipElementFunc = ref({})

  get relationshipElementFunc() {
    return this._relationshipElementFunc.value;
  }

  private _relationshipElementTemp = ref()
  get relationshipElementTemp() {
    return this._relationshipElementTemp.value;
  }

  private getCurrentBoardWidgets() {
    return this.getBoard().container.getChildWidgets(true);
  }

  private _dataFilterWidgetOptions = ["widget.basic.filter", "widget.basic.filter-input"];
  getOtherFilterptions() {
    return this.getCurrentBoardWidgets().filter(item => item.uid !== this.uid && this._dataFilterWidgetOptions.includes(item.getSoul().type));
  }

  public async getRelationshipDefaultOptions(value, tableFilters?) {
    const relationshipFieldValue: any = this.relationshipField;
    if (!value) return [];
    const tables = (this.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || []).reduce((prev, connection) => {
      prev.push(...(connection.tables || []));
      return prev;
    }, []);
    if (value === "all") {
      let allFieldDistinct = [];
      const unqiueValues = new Set();
      let selectTables = this.relationshipField?.linkageWidgets?.map(item => {
        const curLinkageTable = this.getLinkageTable(item);
        if (!unqiueValues.has(curLinkageTable.uid)) {
          unqiueValues.add(curLinkageTable.uid);
          return { label: curLinkageTable.alias, value: curLinkageTable.uid };
        }
      }).filter(item => item);
      if (!selectTables) selectTables = [];
      for (const item of selectTables) {
        const curLinkageTable = tables.find(t => t.uid === item.value);
        const linkageFieldId = this.getLinkageFieldIdByTable(curLinkageTable, relationshipFieldValue);
        const filters = tableFilters ? {[curLinkageTable.uid]: tableFilters[curLinkageTable.uid]} : {};
        const fieldDistinct = await this.otherTableFieldValue(curLinkageTable.uid, linkageFieldId as FieldUID, {filters});
        allFieldDistinct = allFieldDistinct.concat(fieldDistinct);
      }
      allFieldDistinct = Array.from(new Set(allFieldDistinct));
      const linkageField = this.getLinkageFieldByTable(tables.find(t => t.uid === selectTables[0]?.value), relationshipFieldValue);
      if (linkageField?.meta?.subType === 'account') {
        let accounts = [];
        for (const itemId of allFieldDistinct) {
          const account = await this.getBoard().getOrganizationAccount(itemId);
          const label = account.staffNo ? `${account.realname}(${account.staffNo})` : account.realname;
          if (accounts) {
            accounts.push({label, value: itemId, selfInfo: account});
          }
        }
        this.relationshipDefaultOptions = accounts;
      } else if (linkageField?.meta?.subType === 'department') {
        let departments = [];
        for (const itemId of allFieldDistinct) {
          const department = await this.getBoard().getOrganizationDepartment(itemId);
          if (department) {
            departments.push({label: department.name, value: itemId, selfInfo: department});
          }
        }
        this.relationshipDefaultOptions = departments;
      } else {
        this.relationshipDefaultOptions = allFieldDistinct.map(item => { return { label: String(item), value: item} });
      }
    } else {
      const curLinkageTable = tables.find(item => item.uid === value);
      const linkageFieldId = this.getLinkageFieldIdByTable(curLinkageTable, relationshipFieldValue);
      const filters = tableFilters ? {[curLinkageTable.uid]: tableFilters[curLinkageTable.uid]} : {};
      const fieldDistinct = await this.otherTableFieldValue(curLinkageTable.uid, linkageFieldId as FieldUID, {filters});
      const linkageField = curLinkageTable.fields.find(item => item.uid === linkageFieldId);
      if (linkageField?.meta?.subType === 'account') {
        let accounts = [];
        for (const itemId of fieldDistinct) {
          const account = await this.getBoard().getOrganizationAccount(itemId);
          const label = account.staffNo ? `${account.realname}(${account.staffNo})` : account.realname;
          if (accounts) {
            accounts.push({label, value: itemId});
          }
        }
        this.relationshipDefaultOptions = accounts;
      } else if (linkageField?.meta?.subType === 'department') {
        let departments = [];
        for (const itemId of fieldDistinct) {
          const department = await this.getBoard().getOrganizationDepartment(itemId);
          if (department) {
            departments.push({label: department.name, value: itemId});
          }
        }
        this.relationshipDefaultOptions = departments;
      } else {
        this.relationshipDefaultOptions = fieldDistinct.map(item => { return { label: String(item), value: item} });
      }
    }
  }

  // get dropdownType() {
  //   if (this.getOption("dropdown-type") === "multiple") {
  //     return "multiple";
  //   } else {
  //     return "single";
  //   }
  // }

  // get showSearch() {
  //   return this.getOption("dropdown-show-search");
  // }

  get dropdownTipText() {
    return this.getOption<string>("dropdown-tip-text");
  }

  // get dropdownMenuIcon() {
  //   return this.getOption<OptionFileValue>("dropdown-menu-icon");
  // }

  get relationshipDefaultOptionValueRangeNumber() {
    return [this.getOption("relationship-default-option-value-range-number-v1"), this.getOption("relationship-default-option-value-range-number-v2")]
  }

  private formatDateToDateTime(date) {
    if (!date) return date;
    if (!(date instanceof Date)) {
      date = new Date(date);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  get relationshipDefaultOptionValueRangeDate() {
    return [this.formatDateToDateTime(this.getOption<Date>("relationship-default-option-value-range-date-v1")), this.formatDateToDateTime(this.getOption<Date>("relationship-default-option-value-range-date-v2"))]
  }

  get isMultiple() {
    const multipleType = [RuleFuncValue.SELECT_MULTIPLE, RuleFuncValue.TAGS];
    if (this.relationshipElementFunc && multipleType.includes(this.relationshipElementFunc[(this.relationshipFilterFunc as RuleFunc)])) {
      return true;
    } else {
      return false;
    }
  }

  get isRange() {
    return this.relationshipElementFunc?.[(this.relationshipFilterFunc as RuleFunc)] === RuleFuncValue.RANGE;
  }

  /**
   * 舟山项目中，定义树结构数据用relationship存放匹配值，优先级大于外层key
  */
  getTreeValueWithRelationship(treeData, key, value) {
    let targetValue;
    for(let index in treeData) {
      let data = treeData[index];
      if(data.relationship?.key === key && data.relationship?.value === value) {
        targetValue = data.value;
        break;
      } else {
        if(data.children?.length) {
          targetValue = this.getTreeValueWithRelationship(data.children, key, value);
          if(targetValue) break;
        }
      }
    }
   return targetValue;
  }

  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }

  get currentValue(){
    return {
      value: this.selectedItem
    }
  }

  public getLinkageTable(linkWidgetUID: string) {
    const curWidget = this.getBoard().getWidgetByUID(linkWidgetUID) as Widget;
    if (["widget.form.table", "widget.form.viewtable"].includes(curWidget?.type)) {
      return this.getTable((curWidget as any).formTableUID)
    }
    const widgetMetaData = (curWidget as Widget)?.getMetaData();
    return this.getTable([widgetMetaData.axisValue[0].uid[0], widgetMetaData.axisValue[0].uid[1]]);
  }

  private async getInstance (field?: Field) {
    if(field?.meta?.extra?.widgetType) {
      const curElement = await formElementInstances.getInstance(field.meta?.extra?.widgetType)
      return curElement;
    }
  }
  private async filterMenus (field?: Field) {
    if (!field) return {};
    const instance = await this.getInstance(field);
    if(instance) {
      const configurations = instance?.getConfigurations();
      return configurations?.editFuncInfo || {};
    } else {
      const configurations = getSystemColumnConfigurations(field.meta.name);
      return configurations?.funcInfo || {};
    }
  }

  // 过滤掉已删除字段等无效联动配置，避免把 undefined 字段下发到查询条件中
  private getValidLinkageFields(linkageFields = this.relationshipField?.linkageFields) {
    if (!linkageFields) return {};
    const validLinkageFields = Object.keys(linkageFields).reduce((prev, fieldId: FieldUID) => {
      if (!fieldId || fieldId === "undefined") return prev;
      const widgetUids = linkageFields[fieldId];
      if (isEmpty(widgetUids)) return prev;
      const validWidgetUids = widgetUids.filter((widgetUid) => {
        const table = this.getLinkageTable(widgetUid);
        return table?.fields?.find(field => field.uid === fieldId);
      });
      if (!isEmpty(validWidgetUids)) {
        prev[fieldId] = validWidgetUids;
      }
      return prev;
    }, {} as Record<FieldUID, string[]>);
    return validLinkageFields;
  }

  private isEmptyRelationshipDefaultValue(value) {
    if (this.isRange && Array.isArray(value)) {
      return isEmpty(value[0]) && isEmpty(value[1]);
    }
    return isEmpty(value);
  }

  getLinkageFieldIdByTable(table: any, relationshipField = this.relationshipField) {
    if (!table) return null;
    const linkageFields = this.getValidLinkageFields(relationshipField?.linkageFields);
    return Object.keys(linkageFields).find((fieldId: FieldUID) => {
      const widgetUids = linkageFields[fieldId];
      return !isEmpty(widgetUids) && table.fields.find(field => field.uid === fieldId);
    }) as FieldUID;
  }

  getLinkageFieldByTable(table: any, relationshipField = this.relationshipField) {
    const fieldId = this.getLinkageFieldIdByTable(table, relationshipField);
    return table?.fields.find(field => field.uid === fieldId);
  }

  get relationshipLevelFilter() {
    return this.getOption("relationship-level-filter");
  }

  private _relationshipAllTables = ref([]);
  get relationshipAllTables() {
    return this._relationshipAllTables.value;
  }
  set relationshipAllTables(value) {
    this._relationshipAllTables.value = value;
  }

  get relationshipSelectFilterValue() {
    return this.getOption("relationship-select-filter-value");
  }

  get relationshipDefaultOptionValue() {
    return this.isMultiple ? this.getOption('relationship-default-option-value-multiple') : this.getOption("relationship-default-option-value-single")
  }
  set relationshipDefaultOptionValue(value) {
    if(this.isMultiple) {
      this.setOption('relationship-default-option-value-multiple', value);
      this.setOption("relationship-default-option-value-single", null);
    } else {
      this.setOption("relationship-default-option-value-single", value);
      this.setOption('relationship-default-option-value-multiple', []);
    }
  }

  private _relationshipDefaultOptions = ref([]);
  get relationshipDefaultOptions() {
    return this._relationshipDefaultOptions.value;
  }
  set relationshipDefaultOptions(value) {
    this._relationshipDefaultOptions.value = value;
  }

  async otherTableFieldValue(tableUID: TableUID, columnId: FieldUID, options?) {
    const otherFieldValue = ref([]);
    const connection = (this.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || []).find(item => {
      return item.tables?.some(table => table.uid === tableUID);
    });
    const nocodeId = (connection as any)?.nocodeId || this.getBoard().nocodeId;
    if (nocodeId) {
      const data = await fetchDistinct({
        nocodeId,
        tableUID: tableUID,
        columnId: columnId,
        options: options
      }, axios).catch((err) => {
        console.log("error", err);
        return null;
      });
      if (data) {
        otherFieldValue.value = data
      }
    }
    return otherFieldValue.value;
  }

  applyFilter(filters: any) {
    const normalizeFilter = (filterItem) => {
      const linkageFields = this.getValidLinkageFields(filterItem?.linkageFields);
      if (isEmpty(linkageFields)) return null;
      return {
        ...filterItem,
        linkageFields,
      };
    };
    const nextFilters = Array.isArray(filters)
      ? filters.map(normalizeFilter).filter(item => item)
      : normalizeFilter(filters);
    return super.applyFilter(Array.isArray(filters) ? nextFilters : (nextFilters || []));
  }

  get linkageOut() {
    return this.getOption("linkage-out")
  }
}
