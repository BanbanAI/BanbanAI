import { FormConditionValueType } from '@common/types/nocode';
import { replaceByFormula, createFormulaRuntimeByWidget, evaluateFormulaWithRuntime } from '@common/utils/formula';
import { TreeSelect } from '../treeSelect/treeSelect';
import { Uploader } from '../uploader/uploader';
import { Row } from '@common/types/project';

export const isSelect = (widget: any): widget is TreeSelect => {
  return ["widget.form.treeSelect", "widget.form.treeMultipleSelect"].includes(widget.type);
}

export const isUploader = (widget: any): widget is Uploader => {
  return ["widget.form.image-uploader", "widget.form.file-uploader"].includes(widget.type);
}

export const getCurrentRowData = (allFormInputs, addNewRowRule) => {
  let addNewRowData: Row = {};
  for (const rule of addNewRowRule) {
    if (rule.type === FormConditionValueType.FORM) {
      addNewRowData[rule.linkageField] = allFormInputs.find(item => item.uid === rule.currentWidget).inputValue;
    } else if (rule.type === FormConditionValueType.FORMULA) {
      // 公式编辑需要先计算出值
      const tempFormula = replaceByFormula(rule.formula, (keys) => {
        const [sourceUID, fieldId, subFieldId] = keys;
        let fieldValue = allFormInputs.find(item => item.fieldId === fieldId)?.inputValue;
        if (subFieldId) {
          const subWidgetValue = allFormInputs.find(item => item.fieldId === fieldId)?.inputValue;
          fieldValue = subWidgetValue.map(item => {
            return item[subFieldId];
          })
        }
        return fieldValue;
      })
      try {
        const formulaRuntime = allFormInputs?.[0] ? createFormulaRuntimeByWidget(allFormInputs[0]) : null;
        addNewRowData[rule.linkageField] = evaluateFormulaWithRuntime(tempFormula, formulaRuntime);
      } catch (err) {
      }
    } else {
      addNewRowData[rule.linkageField] = rule.value;
    }
  }
  return addNewRowData
}
