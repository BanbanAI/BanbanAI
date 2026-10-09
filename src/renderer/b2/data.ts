import { ConnectionData } from "@common/types/project";
import { funcMap } from "@common/utils/flow";
import { Readonly } from "./types";
import { ConditionGroup, ConditionRule, CategoryRule, Bucket } from "@common/types/project";
import { Element } from "@renderer/b2/controllers/element";
import { isEmpty } from "@common/utils/object";
import { OptionFieldUID, OptionTableUID, PROJECT_PARAMS_UID, PrivateDataConnectionUID, Row } from "@common/types/project";

export class Data {
  constructor(private connectionData: ConnectionData, private element: Element) {
  }

  filterRuleCategoryByConnection(rule: ConditionGroup): CategoryRule {
    const result = {};
    for (const andRule of rule) {
      let key: string;
      // @ts-ignore
      if (andRule.table === PROJECT_PARAMS_UID) {
        key = PROJECT_PARAMS_UID;
      } else {
        key = `${andRule.connection}_${andRule.table}`;
      }
      const ruleWrapper = result[key] || [];
      ruleWrapper.push(andRule);
      result[key] = ruleWrapper;
    }
    return Object.values(result);
  }

  getMeetRuleFuncs() {
    return funcMap
  }

  // 判断当前数据是否受当前数据条件的影响
  isConditionEffected(rows: any[], conditionGroup: ConditionGroup): boolean {
    let isEffected = true;
    if (isEmpty(rows)) return isEffected;
    for (const rule of conditionGroup) { // 且
      if (!rule.field) continue;
      // field 用了 row reverseRow count 都满足
      if (['row', 'reverseRow', 'count'].includes(rule.field)) {
        isEffected = isEffected && true;
      } else {
        // field 是id 判断 id 是否是用与数据的fieldId
        isEffected = isEffected && rows[0]?.hasOwnProperty(rule.field);
      }
      if (!isEffected) return isEffected;
    }
    return isEffected;
  }

  // 数据条件行号字段进行筛选
  filterByRowRule(rows: any[], rule: ConditionRule) {
    const meetRuleFuncs = this.getMeetRuleFuncs();
    const { field, func, args } = rule;
    return rows.filter((row: any, index: number) => {
      let rowNum = index + 1;
      if (field === 'reverseRow') {
        rowNum = rows.length - index;
      }
      return meetRuleFuncs[func](rowNum, args);
    });
  }

  // 数据条件数据字段进行筛选
  filterByFieldIdRule(rows: any[], rule: ConditionRule) {
    const meetRuleFuncs = this.getMeetRuleFuncs();
    const { field, func, args } = rule;
    return rows.filter(row => {
      return meetRuleFuncs[func](row[field], args);
    })
  }

  // 数据条件根据数据字段条件判断筛选
  filterByFieldMethodRule(rows: any[], rule: ConditionRule, rowIndex?: number) {
    if (rows.length === 0) return false;
    const meetRuleFuncs = this.getMeetRuleFuncs();
    const { field, func, args } = rule;
    const method = rule.method || 'some';
    if (!isEmpty(rowIndex)) {
      rows = [rows[rowIndex]];
    }
    const evaluateMethod = {
      some: () => rows.some((row) => meetRuleFuncs[func](row?.[field], args)),
      every: () => rows.every((row) => meetRuleFuncs[func](row?.[field], args)),
      custom: () => meetRuleFuncs[func](rows[rule.order - 1]?.[field], args),
      first: () => meetRuleFuncs[func](rows[0]?.[field], args),
      last: () => meetRuleFuncs[func](rows.at(-1)?.[field], args),
    };
    return evaluateMethod[method]();
  }

  filterByUID(rows: Row[], uids: OptionFieldUID[]) {
    const fieldUIDs = uids.map(uid => uid[2]);
    return rows.map(row => {
      let result = {};
      for (const fieldUID of fieldUIDs) {
        result[fieldUID] = row[fieldUID];
      }
      return result;
    })
  }

  public getBucket(uids: OptionTableUID[]): Bucket{
    if (isEmpty(uids)) return null;
    // 检测有无多个表的字段
    const otherUID = uids.find(uid => uid[0] !== uids[0][0] || uid[1] !== uids[0][1]);
    if (!isEmpty(otherUID)) {
      return;
    }

    const uid = uids[0];
    if (uid[0] === PrivateDataConnectionUID) {//use private data
      const { fields, rows } = this.element.getPrivateData();
      return {
        tableId: PrivateDataConnectionUID,
        tableName: "PrivateData",
        fields,
        rows,
      };
    }
    if (isEmpty(this.connectionData)) {
      void this.element.getBoard()?.ensureConnectionBucket(uid);
      return;
    }
    let buckets = this.connectionData[uid[0]] || [];
    let bucket = buckets.find(bucket => bucket.tableId === uid[1]);
    if (!bucket) {
      void this.element.getBoard()?.ensureConnectionBucket(uid);
    }
    return bucket;
  }
}
