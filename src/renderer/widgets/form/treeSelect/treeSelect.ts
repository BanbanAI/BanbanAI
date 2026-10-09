import { FormElementConfiguration, RuleFunc, RuleFuncValue, FormConditionValueType, AggregationType } from "@common/types/nocode";
import { isNocodeFormData, isSystemField, SystemField, getUUIDSystemField, transformCondition } from "@common/utils/connection";
import { unique } from "@common/utils/unique";
import { DefinedOptions, LogicalOperator, FormLinkageCondition, SelectIdOfForm, SelectChoice } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { FormElement, AbstractForm, AbstractSubForm, SubFormRow } from "@renderer/b2/controllers/form";
import { nextTick, Ref, ref, watch, defineAsyncComponent } from "vue";
import { deepClone, equals, isEmpty } from "@common/utils/object";
import { Field, FieldUID, OptionTableUID, TableUID, WhereCondition } from "@common/types/project";
import { FilterRule } from "@common/types/nocode";
import { SubForm } from "@renderer/widgets/form/subForm/subForm";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { resolveDataSourceSelectionMeta } from "../_common/page-permission";
import { fetchDistinct } from "../_common/distinct";
import axios from "axios";

export enum SortType {
  ASC = 1,
  DESC = -1
}

export type TreeSelectOption = {
  id?: string;
  value: string;
  label: string;
  color?: string;
};

export type TreeListItem = {
  label: string;
  value: string;
  key?: string;
  children?: TreeListItem[];
}

export type TreeSelectGroupItem = {
  id?: string;
  label: string;
  value: string;
  color?: string;
};

type ColorOptions = {
  checkedValue?: string | string[];
  isColored: boolean;
  options: TreeSelectGroupItem[];
  otherOptions?: { id: string; value: string };
};

type TreeFilterRule = Omit<FilterRule, "conditions"> & {
  conditions: FormLinkageCondition[]
}
const defaultColoredArray = {
  get options() {
    return [
      {
        label: i18next.t("defaultOption1"),
        value: i18next.t("defaultOption1"),
      },
      {
        label: i18next.t("defaultOption2"),
        value: i18next.t("defaultOption2"),
      },
      {
        label: i18next.t("defaultOption3"),
        value: i18next.t("defaultOption3"),
      },
    ];
  },
};
const runtimeCustomOptionColors = [
  "rgba(16, 204, 85, 1)",
  "rgba(18, 184, 178, 1)",
  "rgba(31, 128, 255, 1)",
  "rgba(127, 102, 255, 1)",
  "rgba(202, 94, 235, 1)",
  "rgba(242, 97, 189, 1)",
  "rgba(255, 92, 97, 1)",
  "rgba(255, 158, 31, 1)",
  "rgba(178, 209, 25, 1)",
  "rgba(89, 214, 51, 1)",
];
const systemFieldNameOfFilter = [ SystemField.CREATE_TIME, SystemField.UPDATE_TIME, SystemField.CREATE_OWNER, SystemField.DATA_OWNER ]
export const ADDED_CUSTOM_OPTION_COLOR = "#909399";

export class TreeSelect extends FormElement {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }
  private _otherTableChoices: Ref<TreeSelectOption[]> = ref([]);
  isOther = ref(false);
  initAfterConstructor() {
    super.initAfterConstructor();
    watch(() => [ this.formDataSortFields, this.formDataSortOrderby ], (value) => {
      if(value[0]) {
        this.fieldSortRule = [
          {
            field: value[0],
            value: value[1]
          }
        ]
      }
    }, {immediate: true});

    watch(() => [ this.choicesType, this.otherTableFieldUID ], (value) => {
      this.setOption("form-data-sort-fields", null);
      this.setOption("form-data-sort-orderby", SortType.ASC);
    })
    

    watch(() => {
      return this.isInitOption.value
    }, (value) => {
      if(value && this.fillValue.value) {
        this.setInputValue(this.fillValue.value);
      }
    })
  }

  get choicesType() {
    return this.getOption("select-choices-type");
  }

  get isDataFill() {
    return this.choicesType === "data-fill";
  }

  get isChoicesFromTableData() {
    return this.choicesType === "from-table";
  }

  private getOtherTableMeta() {
    return resolveDataSourceSelectionMeta(
      this.getBoard(),
      this.otherTableFieldUID?.slice(0, 2),
      this.topForm?.tableUID?.[0],
      { includeSchemaOnly: true },
    );
  }

  private getOtherTableConnection() {
    return this.getOtherTableMeta().connection;
  }

  private getOtherTableTable() {
    return this.getOtherTableMeta().table;
  }

  get connectionTableFields() {
    if (!isEmpty(this.otherTableFieldUID)) {
      const table = this.getOtherTableTable();
      return table?.fields || [];
    }
    return [];
  }

  get otherTableFieldUID() {
    const value = this.getOption<string>("other-table-field");
    return value?.split(".") || [];
  }

  get linkageMainTableUID() {
    const [connectionUID, tableUID] = this.otherTableFieldUID;
    const table = this.getOtherTableTable();
    const linkageMainTableUid = table?.meta?.extra?.primaryTable ? table?.meta?.extra?.primaryTable : [connectionUID, tableUID];
    return linkageMainTableUid;
  }

  async initSelectChoices() {
    if (!this.isChoicesFromTableData || isEmpty(this.otherTableFieldUID)) return;
    await nextTick();
    if (this.topForm?.isViewing) return;
    this.effectScope.run(() => {
      watch(() => this.optionFilter?.conditions?.map((c) => {
        let elementUID
        if (this.form.tableUID && c.type === FormConditionValueType.FORM) {
          if (c.comparisonUid?.split(".")?.length < 2) {
            elementUID = this.findElementByField(c.comparisonUid, this.form.tableUID[1]);
          } else {
            elementUID = this.findElementByField(c.comparisonUid?.split(".")?.[1], this.form.tableUID[1]);
          }
        }
        if (this.parent instanceof SubFormRow && c.type === FormConditionValueType.FORM) {
          const ids = c.comparisonUid?.split(".")
          if (ids?.length > 1) {
            // 子表行内联动只依赖当前行值，不能再把整列值聚合成一个条件数组。
            const targetWidget = this.form.children.find(child => child.fieldId === ids[1]);
            return targetWidget ? [{
              [targetWidget.fieldId]: targetWidget.inputValue
            }] : [];
          } else {
            if (c.comparisonOfForm && c.comparisonOfForm === SelectIdOfForm.LINKAGE) {
              let allRelatedForms = this.topForm.children.filter(child => child.getSoul().type === "widget.form.relatedData").filter((r: any) => {
                const relatedTable = this.getTable(r.connectionTable);
                if (c.comparisonUid?.split(".")?.length === 1 && relatedTable.fields.find(f => f.uid === c.comparisonUid)) return r;
              });
              const relatedValues = ref([])
              for(const [index, relatedData] of allRelatedForms.entries()) {
                // 只会与关联表单的主表字段值进行筛选
                if (c.comparisonUid?.split(".")?.length === 1) {
                  relatedValues.value[index] = (relatedData as any).getValue(c.comparisonUid);
                }
              }
              return {
                [c.comparisonUid]: [...new Set(relatedValues.value.flat())]
              };
            } else {
              elementUID = this.findElementByField(c.comparisonUid, this.topForm.tableUID[1]);
              return {
                [c.comparisonUid]: (this.topForm.getChildElement(elementUID) as FormElement)?.inputValue
              }
            }
          }
        }

        if (c.comparisonOfForm && c.comparisonOfForm === SelectIdOfForm.LINKAGE) {
          let allRelatedForms = this.topForm.children.filter(child => child.getSoul().type === "widget.form.relatedData").filter((r: any) => {
            const relatedTable = this.getTable(r.connectionTable);
            if (c.comparisonUid?.split(".")?.length === 1 && relatedTable.fields.find(f => f.uid === c.comparisonUid)) return r;
          });
          const relatedValues = ref([])
          for(const [index, relatedData] of allRelatedForms.entries()) {
            // 只会与关联表单的主表字段值进行筛选
            if (c.comparisonUid?.split(".")?.length === 1) {
              relatedValues.value[index] = (relatedData as any).getValue(c.comparisonUid);
            }
          }
          return [...new Set(relatedValues.value.flat())];
        }
        return [(this.form.getChildElement(elementUID) as FormElement)?.inputValue];
      }),
        async (value, oldValue) => {
          if (this.topForm?.isViewing) return;
          if ((value?.length > 0 && oldValue?.length > 0) && equals(value, oldValue)) return;
          await this.handleGetSelectOption(value);
          this.isInitOption.value = true
        },
        { immediate: true }
      )
    });
  }

  private isInitOption = ref(false)

  async handleGetSelectOption(value) {
    if (this.topForm?.isViewing) return;
    const [ cUID, tUID, fUID ] = this.otherTableFieldUID;
    const linkageTable = this.getOtherTableTable();
    if (!linkageTable) {
      this._otherTableChoices.value = [];
      return;
    }
    if (this.form instanceof AbstractForm) { // 下拉选择在主表上
      // 当前使用主表字段还是子表字段的值作为填充
      if (this.linkageTableTypeIsSubForm()) {
        let uuidTransformCondition: any;
        if (this.isLinkageMainField()) { // 存在与关联的表主字段的判断
          // 取出关联主表单相关的筛选条件
          const linkageFieldFilter: FilterRule = {
            logic: this.optionFilter?.logic,
            conditions: this.optionFilter?.conditions?.filter(item => item.uid.split(".").length === 1)
          }
          const table = this.getTable([cUID, tUID] as OptionTableUID); // 子表
          const mainTable = this.getTable(table.meta?.extra?.primaryTable);
          const filters = await this.transformLinkageFilters(mainTable.uid, linkageFieldFilter, value) || {};
          const orderBy = this.transformOrderBy(mainTable.uid as TableUID);
          const uuidField = mainTable.fields.find(f => f.meta.name === "_uuid")
          const subUUIDField = table.fields.find(f => f.meta.uid === uuidField.meta.uid)
          const mainDistinct = await this.otherTableFieldValue(mainTable.uid as TableUID, uuidField.uid as FieldUID, { filters, orderBy });
          if (!isEmpty(filters)) {
            uuidTransformCondition = transformCondition({uid: subUUIDField.uid, func: RuleFunc.IN, value: mainDistinct})
          } else {
            uuidTransformCondition = transformCondition({uid: subUUIDField.uid, func: RuleFunc.IN, value: []})
          }
        }
        // 取出关联子表单相关的筛选条件
        const linkageSubFieldFilter: FilterRule = this.optionFilter ? {
          logic: this.optionFilter?.logic,
          conditions: this.optionFilter?.conditions?.filter(item => item.uid.split(".").length > 1).map(c => {
            return {...c, uid: c.uid.split(".")[1]};
          })
        } : { logic: LogicalOperator.AND, conditions: [] };
        const filters = this.optionFilter ? this.transformLinkageFilters(tUID, linkageSubFieldFilter, value) : {};
        const orderBy = this.transformOrderBy(tUID as TableUID);

        if (uuidTransformCondition) {
          const logicKey = this.optionFilter?.logic === LogicalOperator.AND ? "$and" : "$or";
          if (filters?.[tUID] && Array.isArray(filters?.[tUID][0]?.[logicKey])) {
            filters?.[tUID][0]?.[logicKey]?.push(uuidTransformCondition);
          } else {
            filters[tUID] = [{
              [logicKey]: [uuidTransformCondition]
            }];
          }
        }
        const distinctRes = await this.otherTableFieldValue(tUID as TableUID, fUID as FieldUID, { filters, orderBy });

        if (distinctRes.length === 0) {
          this._otherTableChoices.value = [];
          return;
        }
        const items = Array.from(new Set(distinctRes));
        this._otherTableChoices.value = items.map(item => ({ label: item, value: item })) as TreeSelectOption[];
      } else {
        // 使用主表字段值填充
        const table = this.getTable([cUID, tUID] as OptionTableUID);
        const subFields = table.fields.filter(f => f.meta.subType === 'subForm');
        let subFilters: any;
        let subUUIDTransformCondition: any[] = [];
        let subField = 0;
        const mainUUIDField = table.fields.find(f => f.meta.name === '_uuid');
        if(this.isLinkageSubField()) {
          // 关联表有可能会有多个子表单
          for (let i in subFields) {
            const subTable = this.getTable(subFields[i].meta?.extra?.subTableUID);
            const linkageSubFieldFilter: FilterRule = {
              logic: this.optionFilter?.logic,
              conditions: this.optionFilter?.conditions?.map(item => {
                const curSubTableField = table.fields.find(f => f.uid === item.uid.split(".")[0])
                if (item.uid.split(".").length > 1 && curSubTableField.uid === subFields[i].uid) {
                  return item;
                }
              }).filter(Boolean)
            }
            if (linkageSubFieldFilter.conditions?.length === 0) continue;
            const filters = this.transformLinkageFilters(subTable.uid, linkageSubFieldFilter, value) || {};
            const orderBy = this.transformOrderBy(subTable.uid as TableUID);
            const keyField = subTable.fields.find(f => f.meta.name === "_key");
            const subDistinct = await this.otherTableFieldValue(subTable.uid as TableUID, keyField.uid as FieldUID, { filters, orderBy });
            if (!isEmpty(filters)) {
              subUUIDTransformCondition.push(...subDistinct);
              subField++
            }
          }
          const seen = new Set();
          const duplicates = new Set();
          // 找出所有重复的元素
          subUUIDTransformCondition.forEach(item => {
            if (seen.has(item)) {
              duplicates.add(item);
            } else {
              seen.add(item);
            }
          });
          let tempSubUUIDTransformCondition = [];
          // 多个子表条件判断
          if (this.optionFilter?.logic === LogicalOperator.AND) {
            if (duplicates.size > 0) {
              tempSubUUIDTransformCondition = Array.from(duplicates);
            } else if (subField > 1 && duplicates.size === 0) {
              tempSubUUIDTransformCondition = []
            } else {
              tempSubUUIDTransformCondition = subUUIDTransformCondition;
            }
          } else {
            tempSubUUIDTransformCondition = subUUIDTransformCondition;
          }
          subFilters = transformCondition({uid: mainUUIDField.uid, func: RuleFunc.IN, value: tempSubUUIDTransformCondition});
        }
        // 取出关联主表单相关的筛选条件
        const linkageFieldFilter: FilterRule = this.optionFilter ? {
          logic: this.optionFilter?.logic,
          conditions: this.optionFilter?.conditions?.filter(item => item.uid.split(".").length === 1)
        } : { logic: LogicalOperator.AND, conditions: [] };
        const filters = this.optionFilter ? this.transformLinkageFilters(tUID, linkageFieldFilter, value) : {};
        const orderBy = this.transformOrderBy(tUID as TableUID);

        if (subFilters) {
          const logicKey = this.optionFilter?.logic === LogicalOperator.AND ? "$and" : "$or";
          if (filters?.[tUID] && Array.isArray(filters?.[tUID][0]?.[logicKey])) {
            filters?.[tUID][0]?.[logicKey].push(subFilters);
          } else {
            filters[tUID] = [{
              [logicKey]: [subFilters]
            }];
          }
        }
        const distinctRes = await this.otherTableFieldValue(tUID as TableUID, fUID as FieldUID, { filters, orderBy });
        if (distinctRes.length === 0) {
          this._otherTableChoices.value = [];
          return;
        }
        const items = Array.from(new Set(distinctRes));
        if (this.isInitOptions) {
          if (!items.includes(this.inputValue)) this.cleanSelected();
        }
        this._otherTableChoices.value = items.map(item => ({ label: item, value: item })) as TreeSelectOption[];
      }
    } else { // 下拉选择在子表上
      // 当前使用主表字段还是子表字段的值作为填充
      if (this.linkageTableTypeIsSubForm()) {
        let uuidTransformCondition: any;
        const table = this.getTable([cUID, tUID] as OptionTableUID); // 子表
        const mainTable = this.getTable(table.meta?.extra?.primaryTable);
        const uuidField = mainTable.fields.find(f => f.meta.name === "_uuid")
        const subUUIDField = table.fields.find(f => f.meta.uid === uuidField.meta.uid)
        let mainDistinct: any[] = [];
        let subField = 0;
        if (this.isLinkageMainField()) { // 存在与关联的表主字段的判断
          const linkageFieldFilter: FilterRule = {
            logic: this.optionFilter?.logic,
            conditions: this.optionFilter?.conditions?.filter(item => item.uid.split(".").length === 1)
          }
          const filters = await this.transformSubFormFilters(mainTable.uid, linkageFieldFilter, value) || {};
          if (linkageFieldFilter?.conditions?.length > 0) { // 有主表判断时也要计数
            subField++
          }
          const orderBy = this.transformOrderBy(mainTable.uid as TableUID);
          if (!isEmpty(filters)) {
            mainDistinct = await this.otherTableFieldValue(mainTable.uid as TableUID, uuidField.uid as FieldUID, { filters, orderBy });
          }
        }
        let allDistinct: any[] = [];
        allDistinct.push(...mainDistinct)
        // 关联表有可能会有多个子表单
        const otherSubFields = mainTable.fields.filter(f => f.meta.subType === 'subForm');
        for (let i in otherSubFields) {
          if (otherSubFields[i].meta?.extra?.subTableUID[1] !== tUID) {
            const otherSubTable = this.getTable(otherSubFields[i].meta?.extra?.subTableUID);
            const otherLinkageSubFieldFilter: FilterRule = {
              logic: this.optionFilter?.logic,
              conditions: this.optionFilter?.conditions?.map(item => {
                const curSubTableField = mainTable.fields.find(f => f.uid === item.uid.split(".")[0])
                if (item.uid.split(".").length > 1 && curSubTableField.uid === otherSubFields[i].uid) {
                  return item;
                }
              }).filter(Boolean)
            }
            if (otherLinkageSubFieldFilter?.conditions?.length === 0) continue;
            const filters = this.transformSubFormFilters(otherSubTable.uid, otherLinkageSubFieldFilter, value) || {};
            const orderBy = this.transformOrderBy(otherSubTable.uid as TableUID);
            const keyField = otherSubTable.fields.find(f => f.meta.name === "_key");
            const subDistinct = await this.otherTableFieldValue(otherSubTable.uid as TableUID, keyField.uid as FieldUID, { filters, orderBy });
            if (!isEmpty(filters)) {
              allDistinct.push(...subDistinct)
              subField++
            }
          }
        }
        const seen = new Set();
        const duplicates = new Set();
        // 找出所有重复的元素
        allDistinct.forEach(item => {
          if (seen.has(item)) {
            duplicates.add(item);
          } else {
            seen.add(item);
          }
        });
        let tempSubUUIDTransformCondition = [];
        // 多个子表条件判断
        if (this.optionFilter?.logic === LogicalOperator.AND) {
          if (duplicates.size > 0) {
            tempSubUUIDTransformCondition = Array.from(duplicates);
          } else if (subField > 1 && duplicates.size === 0) {
            tempSubUUIDTransformCondition = []
          } else {
            tempSubUUIDTransformCondition = allDistinct;
          }
        } else {
          tempSubUUIDTransformCondition = allDistinct;
        }

        uuidTransformCondition = transformCondition({uid: subUUIDField.uid, func: RuleFunc.IN, value: tempSubUUIDTransformCondition})

        // 取出填充选项的关联子表单相关的筛选条件
        const linkageSubFieldFilter: FilterRule = this.optionFilter ? {
          logic: this.optionFilter?.logic,
          conditions: this.optionFilter?.conditions?.filter(item => (item.uid.split(".").length > 1 && table.fields.findIndex(f => f.uid === item.uid.split(".")[1]) !== -1)).map(c => {
            return {...c, uid: c.uid.split(".")[1]};
          })
        } : { logic: LogicalOperator.AND, conditions: [] };
        const filters = this.optionFilter ? this.transformSubFormFilters(tUID, linkageSubFieldFilter, value) : {};
        const orderBy = this.transformOrderBy(tUID as TableUID);
        const logicKey = this.optionFilter?.logic === LogicalOperator.AND ? "$and" : "$or";

        if (subField > 0) {
          if (filters?.[tUID] && Array.isArray(filters?.[tUID][0]?.[logicKey] )) {
            filters?.[tUID][0]?.[logicKey]?.push(uuidTransformCondition);
          } else {
            filters[tUID] = [{
              [logicKey]: [uuidTransformCondition]
            }];
          }
        }
        const distinctRes = await this.otherTableFieldValue(tUID as TableUID, fUID as FieldUID, { filters, orderBy });

        if (distinctRes.length === 0) {
          this._otherTableChoices.value = [];
          return;
        }
        const values = this._otherTableChoices.value = distinctRes;
        const items = Array.from(new Set(values));
        this._otherTableChoices.value = items.map(item => ({ label: item, value: item })) as TreeSelectOption[];
      } else {
        // 使用主表字段值填充
        const table = this.getTable([cUID, tUID] as OptionTableUID);
        const subFields = table.fields.filter(f => f.meta.subType === 'subForm');
        let subFilters: any;
        let subUUIDTransformCondition: any[] = [];
        let subField = 0;
        const mainUUIDField = table.fields.find(f => f.meta.name === '_uuid');
        let tempSubUUIDTransformCondition = [];
        if(this.isLinkageSubField()) {
          // 关联表有可能会有多个子表单
          for (let i in subFields) {
            const subTable = this.getTable(subFields[i].meta?.extra?.subTableUID);
            const linkageSubFieldFilter: FilterRule = {
              logic: this.optionFilter?.logic,
              conditions: this.optionFilter?.conditions?.map(item => {
                const curSubTableField = table.fields.find(f => f.uid === item.uid.split(".")[0])
                if (item.uid.split(".").length > 1 && curSubTableField.uid === subFields[i].uid) {
                  return item;
                }
              }).filter(Boolean)
            }
            if (linkageSubFieldFilter?.conditions?.length === 0) continue;
            const filters = this.transformSubFormFilters(subTable.uid, linkageSubFieldFilter, value) || {};
            const orderBy = this.transformOrderBy(subTable.uid as TableUID);
            const keyField = subTable.fields.find(f => f.meta.name === "_key");
            const subDistinct = await this.otherTableFieldValue(subTable.uid as TableUID, keyField.uid as FieldUID, { filters, orderBy });
            if (!isEmpty(filters)) {
              subUUIDTransformCondition.push(...subDistinct)
              subField++
            }
          }
          const seen = new Set();
          const duplicates = new Set();
          // 找出所有重复的元素
          subUUIDTransformCondition.forEach(item => {
            if (seen.has(item)) {
              duplicates.add(item);
            } else {
              seen.add(item);
            }
          });
          // 多个子表条件判断
          if (this.optionFilter?.logic === LogicalOperator.AND) {
            if (duplicates.size > 0) {
              tempSubUUIDTransformCondition = Array.from(duplicates);
            } else if (subField > 1 && duplicates.size === 0) {
              tempSubUUIDTransformCondition = []
            } else {
              tempSubUUIDTransformCondition = subUUIDTransformCondition;
            }
          } else {
            tempSubUUIDTransformCondition = subUUIDTransformCondition;
          }
          subFilters = transformCondition({uid: mainUUIDField.uid, func: RuleFunc.IN, value: tempSubUUIDTransformCondition});
        }
        // 取出关联主表单相关的筛选条件
        const linkageFieldFilter: FilterRule = this.optionFilter ? {
          logic: this.optionFilter?.logic,
          conditions: this.optionFilter?.conditions?.filter(item => item.uid.split(".").length === 1)
        } : { logic: LogicalOperator.AND, conditions: [] };
        const filters = this.optionFilter ? this.transformSubFormFilters(tUID, linkageFieldFilter, value) : {};
        const orderBy = this.transformOrderBy(tUID as TableUID);

        if (subField > 0) {
          const logicKey = this.optionFilter?.logic === LogicalOperator.AND ? "$and" : "$or";
          if (filters?.[tUID] && Array.isArray(filters?.[tUID][0]?.[logicKey])) {
            filters?.[tUID][0]?.[logicKey].push(subFilters);
          } else {
            filters[tUID] = [{
              [logicKey]: [subFilters]
            }];
          }
        }
        const distinctRes = await this.otherTableFieldValue(tUID as TableUID, fUID as FieldUID, { filters, orderBy });
        if (distinctRes.length === 0) {
          this._otherTableChoices.value = [];
          return;
        }
        const items = Array.from(new Set(distinctRes));
        this._otherTableChoices.value = items.map(item => ({ label: item, value: item })) as TreeSelectOption[];
      }
    }
  }

  // fieldId转换elementId
  private findElementByField(field, tableUID) {
    let element: string = ""
    const connection = this.getOtherTableConnection();
    const table = connection?.tables?.find(t => t.uid === tableUID);

    if (table) {
      element = table.fields.find(f => f.uid === field)?.meta?.uid
    }
    return element
  }

  // 判断optionFilter中的condition中的uid是否关联的是关联表单的子表字段
  private isLinkageSubField() {
    let isSubField = false;
    if (isEmpty(this.optionFilter?.conditions)) return false;
    this.optionFilter?.conditions?.forEach(item => {
      if (item.uid.split(".").length > 1) {
        isSubField = true;
      }
    })
    return isSubField;
  }
  // 判断optionFilter中的condition中的uid是否关联的是关联表单的主表字段
  private isLinkageMainField() {
    let isSubField = false;
    if (isEmpty(this.optionFilter?.conditions)) return false;
    this.optionFilter?.conditions?.forEach(item => {
      if (item.uid.split(".").length === 1) {
        isSubField = true;
      }
    })
    return isSubField;
  }

  // 判断是否与当前子表字段做对比
  private isCompareBySubfield() {
    let isSubField = false;
    if (isEmpty(this.optionFilter?.conditions)) return false;
    this.optionFilter?.conditions?.forEach(item => {
      if (item.uid.split(".").length === 1) {
        isSubField = true;
      }
    })
  }

  /**
   * 判断是否使用子表字段填充选项
   * @returns
   */
  private linkageTableTypeIsSubForm() {
    const table = this.getOtherTableTable();
    return !!table?.meta?.extra?.primaryTable;
  }

  private transformOrderBy(tableUID?: TableUID) {
    let orderBy = {};
    if (this.formDataSortFields && this.fieldSortRule) {
      const fieldId = this.fieldSortRule[0]?.field;
      const table = this.getOtherTableConnection()?.tables?.find(t => t.uid === tableUID);
      if (table?.fields?.some(field => field.uid === fieldId)) {
        orderBy = { [fieldId]: this.fieldSortRule[0].value };
      }
    }
    return orderBy
  }
  // 基础条件转换
  private transformLinkageFilters(tUID, curOptionFilter: TreeFilterRule,value) {
    let filters: Record<string, WhereCondition[]> = {};
    const queryConditions = curOptionFilter?.conditions?.map((c) => {
      // 过滤条件只在本次查询里改值，避免把运行时结果污染回共享配置。
      const runtimeCondition = deepClone(c);
      let allRelatedForms = this.topForm.children.filter(child => child.getSoul().type === "widget.form.relatedData").filter((r: any) => {
          const relatedTable = this.getTable(r.connectionTable);
          if (relatedTable.fields.find(f => f.uid === c.comparisonUid)) return r;
        });
      const relatedValues = ref([])
      for(const [index, relatedData] of allRelatedForms.entries()) {
        // 只会与关联表单的主表字段值进行筛选
        relatedValues.value[index] = (relatedData as any).getValue(c.comparisonUid);
      }
      const relatedValuesSetArr = [...new Set(relatedValues.value.flat())]
      let curValue: any
      let elementUID
      const ids = (c.type as any) === FormConditionValueType.FORM ? (c.comparisonUid?.split(".") || []) : [];

      if (this.form.tableUID) {
        if (ids.length < 2) { // 与当前的主表判断
          elementUID = this.findElementByField(c.comparisonUid, this.form.tableUID[1])
          curValue = (this.form.getChildElement(elementUID) as FormElement)?.inputValue;
        } else { // 子表单内的下拉与主表单字段做对比
          elementUID = this.findElementByField(ids[1], this.form.tableUID[1]);
          curValue = (this.form.getChildElement(elementUID) as FormElement)?.inputValue || value?.[0]?.[0];
        }
      }

      if (c.comparisonOfForm && c.comparisonOfForm === SelectIdOfForm.LINKAGE && relatedValuesSetArr.length > 0) {
        runtimeCondition.value = relatedValuesSetArr;
      } else if (curValue) {
        runtimeCondition.value = curValue;
      }

      return transformCondition(runtimeCondition);
    })

    const logicKey = curOptionFilter?.logic === LogicalOperator.AND ? "$and" : "$or";
    let queryParts: any[] = [];
    if (!isEmpty(queryConditions)) {
      queryParts.push({ [logicKey]: queryConditions });
    }
    const query: WhereCondition = queryParts.length > 1
      ? { $and: queryParts }
      : queryParts[0];
    if (query) {
      filters = {
        [tUID]: [
          query,
        ]
      };
    }

    return filters
  }

  // 子表中条件转换
  private transformSubFormFilters(tUID, curOptionFilter: TreeFilterRule,value) {
    let filters: Record<string, WhereCondition[]> = {};
    const queryConditions = curOptionFilter?.conditions?.map((c) => {
      // 子表查询条件同样使用运行时副本，避免不同子表行之间互相污染。
      const runtimeCondition = deepClone(c);
      let curValue: any
      const ids = (c.type as any) === FormConditionValueType.FORM ? (c.comparisonUid?.split(".") || []) : [];
      if (ids.length > 1) { // 与当前子表比较
        value.forEach(v => {
          if (v.length) {
            v.forEach(v1 => {
              if (v1 && v1[ids[1]]) {
                curValue = v1[ids[1]]
              }
            })
          }
        })
      } else { // 与当前主表比较
        value.forEach(v => {
          if (v[ids[0]]) {
            curValue = v[ids[0]]
          }
        });
      }
      if (curValue) {
        runtimeCondition.value = curValue;
      }
      return transformCondition(runtimeCondition);
    })

    const logicKey = curOptionFilter?.logic === LogicalOperator.AND ? "$and" : "$or";
    let queryParts: any[] = [];
    if (!isEmpty(queryConditions)) {
      queryParts.push({ [logicKey]: queryConditions });
    }
    const query: WhereCondition = queryParts.length > 1
      ? { $and: queryParts }
      : queryParts[0];
    if (query) {
      filters = {
        [tUID]: [
          query,
        ]
      };
    }

    return filters;
  }

  onFillData(value: any) {
    if (this.isDataFill) {
      if (!value) {
        this._treeList.value = [];
        return;
      }
      if (!Array.isArray(value)) {
       value = value?.split(",") ?? value;
      }
      value = Array.from(new Set(value));
      this._treeList.value = value.map(item => {
        return {
          label: item,
          value: item,
        }
      });
    } else {
      if (Array.isArray(value)) {
        value = value[0];
      }
      if(this.isInitOptions) {
        this.setInputValue(value);
      }
      this.fillValue.value = value
    }
  }

  get isInitOptions() {
    if (!this.isChoicesFromTableData) return true;
    return this.isInitOption.value;
  }

  static defineOptions(): DefinedOptions[] {
    const optionText = i18next.t("option");
    return [{
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
              name: "placeholder",
              alias: i18next.t("placeholderLabel"),
              default: i18next.t("treeSelectPlaceholder"),
              type: "string",
            },
            {
              name: "select-choices-type",
              alias: i18next.t("option"),
              type: "select",
              selectChoices: [
                {
                  label: i18next.t("custom"),
                  value: "custom",
                },
                {
                  label: i18next.t("fromTableData"),
                  value: "from-table",
                },
                {
                  label: i18next.t("fromDataFill"),
                  value: "data-fill"
                }
              ],
              default: "custom"
            },
            {
              name: "treeselect-value-text-option",
              alias: i18next.t("treeselectOptions"),
              type: `colored-array(draggable, defaultString=${optionText})`,
              default: (widget: TreeSelect) => {
                return {options: widget?.field?.meta?.extra?.choices || defaultColoredArray.options};
              },
              visible: (widget: TreeSelect) => {
                return widget.choicesType === "custom";
              },
            },
            {
              name: "allow-add-custom-option",
              alias: i18next.t("allowAddCustomOption"),
              type: "boolean",
              default: false,
              beforeChange: (widget: TreeSelect, value) => {
                if (!value) {
                  widget.setOption("persist-added-custom-option", false);
                }
                return true;
              },
              visible: (widget: TreeSelect) => {
                return widget.isMultiple && widget.choicesType === "custom";
              },
            },
            {
              name: "persist-added-custom-option",
              alias: i18next.t("persistAddedCustomOption"),
              type: "boolean",
              default: false,
              visible: (widget: TreeSelect) => {
                return widget.isMultiple
                  && widget.choicesType === "custom"
                  && widget.getOption<boolean>("allow-add-custom-option");
              },
            },
              {
                name: "other-table-field",
                alias: i18next.t("selectOtherTableField"),
                type: "select(tree,onlyCheckLeaf)",
                selectChoices: (widget: TreeSelect) => {
                  const connections = widget.getBoard().getConnections().filter(c => isNocodeFormData(c));
                  if (!connections.length) return [];

                  const canView = (connectionUID: string, tableUID: string) => {
                    return connectionUID !== widget.topForm?.tableUID?.[0] || (widget.topForm as any)?.canReadLayerDataSync?.(tableUID);
                  };

                  const buildOptions = (connection) => connection.tables?.filter(t => {
                    return widget.topForm?.tableUID[1] !== t.uid && isEmpty(t.meta?.extra?.primaryTable) && canView(connection.uid, t.uid);
                  }).map(t => {
                    const { baseFields, subFields } = t.fields.reduce<{ baseFields: Field[], subFields: Field[] }>((prev, f) => {
                      if (isSystemField(f) && !systemFieldNameOfFilter.includes(f.meta.name as SystemField)) return prev;
                      if (f.meta.subType === "subForm") {
                        prev.subFields.push(f);
                    } else {
                      prev.baseFields.push(f);
                    }
                    return prev;
                  }, { baseFields: [], subFields: [] });
                  const baseOptions = baseFields.filter(f => !systemFieldNameOfFilter.includes(f.meta.name as SystemField)).map(f => ({ label: f.alias, value: `${connection.uid}.${t.uid}.${f.uid}` }));
                  const showSystemOptions = baseFields.filter(f => systemFieldNameOfFilter.includes(f.meta.name as SystemField)).map(f => ({ label: f.alias, value: `${f.uid}` }));
                  const subOptions = subFields.map(f => {
                    const subTable = connection.tables.find(t => t.uid === f.meta?.extra?.subTableUID?.[1]);
                    return subTable?.fields?.filter(f => !isSystemField(f)).map(sf => {
                      return {
                        label: `${f.alias}.${sf.alias}`,
                        value: `${f.meta.extra?.subTableUID?.join(".")}.${sf.uid}`,
                      }
                    }) ?? [];
                  })
                  return {
                    label: t.alias,
                    value: t.uid,
                    children: [...baseOptions, ...subOptions.flat(Infinity), ...showSystemOptions],
                  } as SelectChoice
                }).filter(option => option.children?.length > 0) || [];

                if (connections.length === 1) {
                  return buildOptions(connections[0]);
                }

                return connections.map(connection => ({
                  label: connection.name,
                  value: connection.uid,
                  children: buildOptions(connection),
                } as SelectChoice)).filter(option => option.children?.length > 0)
              },
              visible: (widget: TreeSelect) => {
                return widget.isChoicesFromTableData;
              }
            },
            {
              name: "showFields",
              alias: i18next.t("showFieldsLabel"),
              default: (widget: TreeSelect) => {
                return widget.connectionTableFields.filter(f => !isSystemField(f)).map(f => f.uid);
              },
              visible: false,
            },
            {
              name: "option-filter",
              alias: i18next.t("optionFilter"),
              type: "dialog",
              dialog: {
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/FormDataFilterDialog.vue")),
                buttonText(element) {
                  const value = element.getOption("option-filter");
                  return isEmpty(value) || (value as any).conditions?.length === 0 ? i18next.t("addFilterCondition") : i18next.t("filterConditionAdded");
                },
                buttonStyle(element, paths) {
                  const value = element.getOption("option-filter");
                  return isEmpty(value) || (value as any).conditions?.length === 0 ? {} : { color: 'var(--color-primary)' }
                },
              },
              visible: (widget: FormElement)=>{
                const connections = widget.getBoard().getConnections();
                const [connectionUID, tableUID] = (widget.getOption("other-table-field") as string)?.split(".") || [];
                const connection = connections.find(c => c.uid === connectionUID && isNocodeFormData(c));
                if (!connection) return false;
                const mainTable = connection.tables.find(t => t.uid === tableUID);
                return widget.getOption("select-choices-type") === "from-table" && widget.getOption("other-table-field") && mainTable !== undefined;
              },
            },
            {
              name: "option-filter-use-group-option",
              alias: i18next.t("filterUseRelatedTableValue"),
              type: "boolean",
              default: true,
              visible: false,
            },
            {
              name: "form-data-sort-fields",
              alias: i18next.t("dataSort"),
              type: "select",
              selectChoices: (widget: TreeSelect) => {
                return widget.connectionTableFields.filter(f => !isSystemField(f) && f.meta?.subType !== "subForm").map(f => {
                  return {
                    label: f.alias,
                    value: f.uid,
                  }
                });
              },
              visible(widget: TreeSelect) {
                return widget.getOption("select-choices-type") === "from-table";
              },
            },
            {
              name: "form-data-sort-orderby",
              type: "select",
              default: SortType.ASC,
              selectChoices:[
                {
                  label: i18next.t("sortAsc"),
                  value: SortType.ASC
                },
                {
                  label: i18next.t("sortDesc"),
                  value: SortType.DESC
                }
              ],
              visible(widget: TreeSelect) {
                return widget.getOption("select-choices-type") === "from-table";
              },
            },
          ],
        },
        validation: {
          children: [
            {
              name: "option-count",
              alias: i18next.t("limitSelectableCount"),
              type: "boolean",
              default: false,
              visible: (widget: TreeSelect) => {
                return widget.isMultiple;
              }
            },
            {
              name: "option-count-range",
              alias: i18next.t("optionRange"),
              default: [0, 100],
              type: "vector<min,max>(min=0)",
              visible: (widget: TreeSelect) => {
                return widget.getOption<boolean>("option-count");
              },
              beforeChange: (widget, value) => {
                return value && value[0] <= value[1];
              }
            },
          ]
        }
      },

    },
    ...super.defineOptions(),
    ];
  }

  public get placeholder() {
    return this.getOption<string>("placeholder");
  }

  get optionLimit() {
    return this.getOption<boolean>("option-count");
  }

  get optionLength() {
    if (!this.optionLimit) {
      return null;
    }
    const [min, max] = this.getOption<[number, number]>("option-count-range");
    return {
      min,
      max,
    }
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

  protected _inputValue: Ref<string | string[]> = ref();
  protected _otherInputVal: Ref<string> = ref();
  private _treeList = ref<TreeSelectOption[]>([]);
  private _runtimeCustomOptionsSessionKey = "";
  private _runtimeCustomOptions: Ref<TreeSelectOption[]> = ref([]);

  protected normalizeRuntimeSingleValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return "";
  }

  get allowAddCustomOption() {
    return this.isMultiple
      && this.choicesType === "custom"
      && this.getOption<boolean>("allow-add-custom-option");
  }

  get persistAddedCustomOption() {
    return this.allowAddCustomOption && this.getOption<boolean>("persist-added-custom-option");
  }

  get canAddCustomOptionInRuntime() {
    return this.allowAddCustomOption && !this.customOption.otherOptions?.value;
  }

  protected getRuntimeCustomOptionColor(index: number) {
    return runtimeCustomOptionColors[index % runtimeCustomOptionColors.length] ?? ADDED_CUSTOM_OPTION_COLOR;
  }

  protected normalizeRuntimeMultipleValues(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);

    const optionValues = (this.customOption.options ?? defaultColoredArray.options).map(item => item.value);
    if (optionValues.includes(value)) {
      return [value];
    }
    return String(value).split(",").filter(Boolean);
  }

  protected createRuntimeCustomOption(value: string, color = ADDED_CUSTOM_OPTION_COLOR, id = unique()): TreeSelectOption {
    return {
      id,
      label: value,
      value,
      color,
    };
  }

  protected getRuntimeCustomOptionsSeedValues() {
    return this.normalizeRuntimeMultipleValues(this.initialValue ?? this.checkedValue);
  }

  protected getRuntimeCustomOptionsSeedKey() {
    return JSON.stringify(this.getRuntimeCustomOptionsSeedValues());
  }

  protected getSeedRuntimeCustomOptions() {
    const baseOptions = this.customOption.options ?? defaultColoredArray.options;
    const optionValues = new Set(baseOptions.map(item => item.value));
    const runtimeValues = new Set<string>();
    const runtimeOptions: TreeSelectOption[] = [];

    this.getRuntimeCustomOptionsSeedValues().forEach(item => {
      if (!item || optionValues.has(item) || runtimeValues.has(item)) return;
      runtimeOptions.push(this.createRuntimeCustomOption(item, this.getRuntimeCustomOptionColor(runtimeOptions.length)));
      runtimeValues.add(item);
    });

    return runtimeOptions;
  }

  protected getSessionRuntimeCustomOptions() {
    if (!this.canAddCustomOptionInRuntime) return [];
    if (this._runtimeCustomOptionsSessionKey !== this.getRuntimeCustomOptionsSeedKey()) {
      return [];
    }
    return this._runtimeCustomOptions.value;
  }

  protected rememberRuntimeCustomOptions(values: string[]) {
    if (!this.canAddCustomOptionInRuntime) {
      this._runtimeCustomOptionsSessionKey = "";
      this._runtimeCustomOptions.value = [];
      return;
    }

    const sessionKey = this.getRuntimeCustomOptionsSeedKey();
    const baseOptions = this.customOption.options ?? defaultColoredArray.options;
    const optionValues = new Set(baseOptions.map(item => item.value));
    const seedValues = new Set(this.getSeedRuntimeCustomOptions().map(item => item.value));
    const runtimeOptions = this._runtimeCustomOptionsSessionKey === sessionKey ? [...this._runtimeCustomOptions.value] : [];
    const runtimeValues = new Set(runtimeOptions.map(item => item.value));

    values.forEach(item => {
      if (!item || optionValues.has(item) || seedValues.has(item) || runtimeValues.has(item)) return;
      runtimeOptions.push(this.createRuntimeCustomOption(item, this.getRuntimeCustomOptionColor(runtimeOptions.length)));
      runtimeValues.add(item);
    });

    this._runtimeCustomOptionsSessionKey = sessionKey;
    this._runtimeCustomOptions.value = runtimeOptions;
  }

  protected getPrimaryTreeListByValues(
    values = this.normalizeRuntimeMultipleValues(this._inputValue.value ?? this.initialValue ?? this.checkedValue),
  ): TreeSelectOption[] {
    const options = [...(this.customOption.options ?? defaultColoredArray.options)];
    if (!this.canAddCustomOptionInRuntime) {
      return options;
    }

    const optionValues = new Set(options.map(item => item.value));
    const runtimeOptions = [
      ...this.getSeedRuntimeCustomOptions(),
      ...this.getSessionRuntimeCustomOptions(),
    ];
    runtimeOptions.forEach(item => {
      if (optionValues.has(item.value)) return;
      options.push(item);
      optionValues.add(item.value);
    });
    return options;
  }

  public appendCustomOption(value: string, appendedChoice?: Partial<TreeSelectOption>) {
    const optionValue = value?.trim?.();
    if (!optionValue) return null;

    const options = this.customOption.options ?? defaultColoredArray.options;
    const existed = options.find(item => item.value === optionValue);
    if (existed) {
      return existed;
    }

    const choice = {
      ...this.createRuntimeCustomOption(
        optionValue,
        appendedChoice?.color ?? this.getRuntimeCustomOptionColor(options.length),
        appendedChoice?.id,
      ),
      label: appendedChoice?.label?.trim?.() || optionValue,
    };
    this.setOption("treeselect-value-text-option", {
      ...this.customOption,
      options: [...options, choice],
    });
    this._runtimeCustomOptions.value = this._runtimeCustomOptions.value.filter(item => item.value !== optionValue);
    return choice;
  }

  public async persistCustomOption(value: string) {
    const optionValue = value?.trim?.();
    if (!optionValue || !this.persistAddedCustomOption) return;

    const projectContext = (this.getBoard() as any)?.projectContext;
    const choice = this.createRuntimeCustomOption(
      optionValue,
      this.getRuntimeCustomOptionColor((this.customOption.options ?? defaultColoredArray.options).length),
    );
    if (projectContext?.queueFormFieldChoiceAppend) {
      projectContext.queueFormFieldChoiceAppend({
        tableUID: this.form?.tableUID?.[1],
        rootTableUID: this.topForm?.tableUID?.[1],
        fieldId: this.fieldId,
        widgetUID: this.uid,
        choice,
      });
    }
    this.appendCustomOption(optionValue, choice);
  }

  private _selectfilter: Ref<string> = ref('');
  changeSelectFilter(value) {
    this._selectfilter.value = value;
  }

  getFilterList(value, list) {
    if (!value) return list;
    return list.filter(item => item.label?.includes(value) || item.value?.includes(value));
  }

  public get treeList(): TreeSelectOption[] {
    if (this.isDataFill) {
      return this.getFilterList(this._selectfilter.value, this._treeList.value)
    } else if (this.isChoicesFromTableData) {
      return this.getFilterList(this._selectfilter.value, this._otherTableChoices.value)
    }
    const options = this.getPrimaryTreeListByValues();
    const { otherOptions } = this.customOption;
    const filteredOptions = otherOptions?.value ? [...options, { label: otherOptions.value, value: otherOptions.value }] : options;
    return this.getFilterList(this._selectfilter.value, filteredOptions);
  }

  /**
   * 不含"其他选项"的列表
   */
  public get primaryTreeList(): TreeSelectOption[] {
    if (this.isDataFill) {
      return this._treeList.value;
    } else if (this.isChoicesFromTableData) {
      return this._otherTableChoices.value;
    }
    return this.getPrimaryTreeListByValues();
  }

  public get otherInputVal() {
    if (this._otherInputVal.value === undefined || this._otherInputVal.value === null) {
      const tree = this.treeList.find((item) => item.value === this.initialValue);
      if (!tree && this.customOption.otherOptions?.value) {
        return this.normalizeRuntimeSingleValue(this.initialValue);
      }
    }
    return this.normalizeRuntimeSingleValue(this._otherInputVal.value);
  }

  public set otherInputVal(value: string) {
    this._otherInputVal.value = this.normalizeRuntimeSingleValue(value);
    this.updateLastChangeTime();
  }

  public get checkedValue(): string | string[] {
    const value = this.customOption.checkedValue;
    if (!value) return null;

    const matched = this.customOption.options.find(item => item.value === value);
    if (matched) return matched.value;
    // if (this.customOption.otherOptions?.id === value) return this.customOption.otherOptions.value;
    return null;
  }

  public fillValue = ref(null)

  public get inputValue(): string | string[] {
    const initialValue = this._inputValue.value ?? this.initialValue;
    let value = this.normalizeRuntimeSingleValue(
      this.choicesType === "custom" ? initialValue ?? this.checkedValue : initialValue,
    );
    this.isOther.value = false;
    if (this.choicesType === "custom") {
      if (!this.customOption?.options.some(item => item.value === value) && this.customOption.otherOptions?.value && value) {
        this.isOther.value = true;
        if (!this._otherInputVal.value && !this._inputValue.value) {
          this._otherInputVal.value = value;
        }
        value = this.otherInputVal ?? "";
      }
    }
    return value || null;
  }

  setInputValue (value: string) {
    const normalizedValue = this.normalizeRuntimeSingleValue(value);
    if (!normalizedValue) {
      this._inputValue.value = "";
      this._otherInputVal.value = "";
      return;
    }

    const matched = this.treeList.find(item => item.value === normalizedValue);
    const otherOption = this.customOption.otherOptions;
    if (matched) {
      this._inputValue.value = matched.value;
    } else if (otherOption?.value) {
      this._inputValue.value = otherOption.value;
      this.otherInputVal = normalizedValue;
    } else {
      this._inputValue.value = normalizedValue;
    }
  }
  public set inputValue(value: string) {
    this.setInputValue(value)
    this.updateLastChangeTime();
  }

  override setInputValueNotChanged(value: string) {
    this.fillValue.value = value
    this.setInputValue(value)
  }

  cleanSelected() {
    this._inputValue.value = this.isMultiple ? [] : "";
    this._otherInputVal.value = "";
  }

  async doValidate() {
    if (!this.isMultiple) return;
    if (this.optionLimit) {
      const { min, max } = this.optionLength;
      let value: string[];
      if (Array.isArray(this.inputValue)) {
        value = this.inputValue;
      } else {
        value = this.inputValue?.split(",") ?? [];
      }
      if (value.length < min || value.length > max) {
        throw new Error(i18next.t("selectCountRange", { min, max }));
      }
    }
  }

  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }

  public get customOption(): ColorOptions {
    return this.getOption<ColorOptions>("treeselect-value-text-option");
  }

  public get openBgColor(): boolean {
    return this.customOption.isColored;
  }

  get isMultiple(): boolean {
    return false;
  }

  get optionFilter() {
    return this.getOption<TreeFilterRule>("option-filter");
  }

  async otherTableFieldValue(tableUID: TableUID, columnId: FieldUID, options?) {
    const otherFieldValue = ref([]);
    const dataSourceMeta = this.getOtherTableMeta();
    const nocodeId = dataSourceMeta.nocodeId;
    if (!nocodeId || (!dataSourceMeta.isCurrentConnection && !dataSourceMeta.hasViewPermission)) {
      return otherFieldValue.value;
    }
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

  resolveFormSetting() {
    const options = this.getOption<ColorOptions>("treeselect-value-text-option");
    const extra = super.resolveFormSetting().extra || {};
    const formSetting = {...super.resolveFormSetting()}
    if (options.isColored) {
      for (const item of options.options) {
        extra[item.value] = item.color;
      }
      formSetting.subType = 'tag'
    }
    return {
      subType: this.isMultiple ? undefined : "text",
      ...formSetting,
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
        choices: options.options,
        defaultValueType: "custom",
        defaultValue: this.checkedValue,
      },
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
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
      },
      aggregationInfo: [
        AggregationType.NOT_SHOW,
        AggregationType.FILLED,
        AggregationType.UNFILLED,
      ]
    };
  }
}

