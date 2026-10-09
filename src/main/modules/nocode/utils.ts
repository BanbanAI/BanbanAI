import { Field } from "@common/types/project";
import dayjs from "dayjs";
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { isEmpty } from "@common/utils/object";

dayjs.extend(customParseFormat);

const resolveSerialNumberDateFormat = (rule: any) => {
  return rule?.value?.optionalFormat === "custom"
    ? rule?.value?.customFormat
    : rule?.value?.optionalFormat;
};

export function parseSerialNumberCountingValue(
  serialNumberText: any,
  field: Field,
  rowData: Record<string, any>,
) {
  const serialNumberRules = field.meta?.extra?.serialNumber?.rules;
  if (isEmpty(serialNumberText) || isEmpty(serialNumberRules)) {
    return null;
  }

  let dataToCheck = String(serialNumberText);
  let countingValue: number | null = null;

  for (const rule of serialNumberRules) {
    switch (rule.type) {
      case 'counting':
        if (rule.value?.digitFixed) {
          const countingText = dataToCheck.substring(0, rule.value.digitLength);
          if (!new RegExp(`^\\d{${rule.value.digitLength}}$`).test(countingText)) {
            return null;
          }
          countingValue = Number(countingText);
          dataToCheck = dataToCheck.substring(rule.value.digitLength);
          break;
        }

        let otherRulesLength = 0;
        for (let i = serialNumberRules.indexOf(rule) + 1; i < serialNumberRules.length; i++) {
          const nextRule = serialNumberRules[i];
          switch (nextRule.type) {
            case 'date':
              otherRulesLength += resolveSerialNumberDateFormat(nextRule)?.length || 0;
              break;
            case 'field':
              if (rowData[nextRule.value] !== null && rowData[nextRule.value] !== undefined) {
                otherRulesLength += String(rowData[nextRule.value]).length;
              }
              break;
            case 'prefix':
              otherRulesLength += nextRule.value?.length || 0;
              break;
          }
        }

        const unfixedDigitsLength = dataToCheck.length - otherRulesLength;
        const countingText = dataToCheck.substring(0, unfixedDigitsLength);
        if (unfixedDigitsLength <= 0 || !/^\d+$/.test(countingText)) {
          return null;
        }
        countingValue = Number(countingText);
        dataToCheck = dataToCheck.substring(unfixedDigitsLength);
        break;
      case 'date':
        const dateFormat = resolveSerialNumberDateFormat(rule);
        const dateStr = dataToCheck.substring(0, dateFormat.length);
        if (!dayjs(dateStr, dateFormat, true).isValid()) {
          return null;
        }
        dataToCheck = dataToCheck.substring(dateFormat.length);
        break;
      case 'field':
        const referencedFieldValue = rowData[rule.value];
        if (referencedFieldValue !== null && referencedFieldValue !== undefined) {
          const fieldValueStr = String(referencedFieldValue);
          if (!dataToCheck.startsWith(fieldValueStr)) {
            return null;
          }
          dataToCheck = dataToCheck.substring(fieldValueStr.length);
        }
        break;
      case 'prefix':
        if (!dataToCheck.startsWith(rule.value)) {
          return null;
        }
        dataToCheck = dataToCheck.substring(rule.value.length);
        break;
    }
  }

  if (dataToCheck.length) {
    return null;
  }

  return countingValue;
}

export async function validateSerialNumber(
  excelData: any, 
  field: Field, 
  rowData: Record<string, any>,
) {
  // 获取字段中的自动编号规则
  const serialNumberRules = field.meta?.extra?.serialNumber?.rules;
  
  // 如果Excel中没有提供自动编号字段数据，则不导入这行数据
  if (isEmpty(excelData)) {
    return false;
  }
  
  // 将数据转换为字符串，按顺序处理规则
  let dataToCheck = String(excelData);
  
  for (const rule of serialNumberRules) {
    switch (rule.type) {
      case 'counting':
        // 计数规则验证
        const countingRule = rule.value;
        if (countingRule.digitFixed) {
          // 固定位数验证
          const regex = new RegExp(`^\\d{${countingRule.digitLength}}$`);
          if (!regex.test(dataToCheck.substring(0, countingRule.digitLength))) {
            return false; // 不符合固定位数规则
          }
          // 更新dataToCheck为剩余部分
          dataToCheck = dataToCheck.substring(countingRule.digitLength);
        } else {
          // 不固定位数验证
          // 计算其他规则使用的总长度
          let otherRulesLength = 0;
          
          // 遍历后续的规则并计算它们的长度，后续规则不会再有counting类型
          for (let i = serialNumberRules.indexOf(rule) + 1; i < serialNumberRules.length; i++) {
            const nextRule = serialNumberRules[i];
            switch (nextRule.type) {
              case 'date':
                otherRulesLength += nextRule.value.optionalFormat.length;
                break;
              case 'field':
                // 字段规则长度取决于实际字段值的长度
                if (rowData[nextRule.value] !== null) {
                  otherRulesLength += String(rowData[nextRule.value]).length;
                }
                break;
              case 'prefix':
                otherRulesLength += nextRule.value.length;
                break;
            }
          }
          
          // 不固定位数部分应该是剩余的所有数字字符
          const unfixedDigitsLength = dataToCheck.length - otherRulesLength;
          if (unfixedDigitsLength <= 0 || !/^\d+$/.test(dataToCheck.substring(0, unfixedDigitsLength))) {
            return false; // 不符合不固定位数规则
          }
          
          // 更新dataToCheck为剩余部分
          dataToCheck = dataToCheck.substring(unfixedDigitsLength);
        }
        break;
      case 'date':
        // 日期规则验证
        const dateFormat = rule.value.optionalFormat;
        const dateStr = dataToCheck.substring(0, rule.value.optionalFormat.length)
        const dateInstance = dayjs(dateStr, dateFormat, true);
        if (!dateInstance.isValid()) {
          return false;
        }
        // 更新dataToCheck为剩余部分
        dataToCheck = dataToCheck.substring(dateFormat.length);
        break;
      case 'field':
        // 字段规则 - 根据其他字段的值进行验证
        const referencedFieldUid = rule.value;
        const referencedFieldValue = rowData[referencedFieldUid];
        
        if (referencedFieldValue !== null) {
          const fieldValueStr = String(referencedFieldValue);
          if (dataToCheck.startsWith(fieldValueStr)) {
            dataToCheck = dataToCheck.substring(fieldValueStr.length);
          } else {
            return false; // 不符合字段值规则
          }
        }
        break;
      case 'prefix':
        // 前缀规则验证
        if (dataToCheck.startsWith(rule.value)) {
          dataToCheck = dataToCheck.substring(rule.value.length);
        } else {
          return false; // 不符合前缀规则
        }
        break;
    }
  }
  
  // 如果所有规则都通过了，则数据有效
  return true;
}
