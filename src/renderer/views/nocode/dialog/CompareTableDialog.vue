<template>
  <div class="compare-table-dialog">
    <el-dialog v-model="dialogVisible" width="1008px" draggable :close-on-click-modal="false"
      :title="$t('CompareTableDialog.fieldCodeTable')" align-center destroy-on-close @open="handleOpen" @closed="handleClosed">
      <div class="dialog-body">
        <div class="tips">
          <p class="tip-line">·&nbsp;{{ $t('CompareTableDialog.copyCodeTip') }}</p>
          <p class="tip-line">·&nbsp;{{ $t('CompareTableDialog.imgFieldCodeDesc') }}</p>
          <p class="tip-line">·&nbsp;{{ $t('CompareTableDialog.textFieldCodeDesc') }}</p>
          <p class="tip-line">·&nbsp;{{ $t('CompareTableDialog.moreContent') }} <a href="https://www.banban.work/docs/v1/bk4s8253fe5c/" target="_blank">{{ $t('CompareTableDialog.helpDoc') }}</a></p>
        </div>
        <div class="compare-table">
          <el-tabs v-model="activeTab" class="demo-tabs">
            <el-tab-pane class="form-field" :label="$t('CompareTableDialog.formField')" name="formFieldTab"> 
              <div class="table-wrapper">
                <el-table :data="formFieldsTable" border :span-method="spanMethod">
                  <el-table-column prop="fieldName" :label="$t('CompareTableDialog.fieldName')" width="320">
                    <template #default="scope">
                      <div class="field-name-cell">{{ scope.row.fieldName }}</div>
                    </template>
                  </el-table-column>
                  <el-table-column :label="$t('CompareTableDialog.fieldCode')">
                    <template #default="scope">
                      <div class="field-code-cell" @click="copyFieldCode(scope.row.fieldCode)">
                        <div class="field-code">
                          <span v-if="scope.row.fieldType" class="field-type">{{ scope.row.fieldType }}{{ getI18nLabelColon() }}</span>
                          {{ scope.row.fieldCode }}
                        </div>
                        <div class="copy-button" link type="primary">
                          <el-icon size="16"><CopyDocument /></el-icon><div class="copy-text">{{ $t('CompareTableDialog.copy') }}</div>
                        </div>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>
            <el-tab-pane class="system-field" :label="$t('CompareTableDialog.sysField')" name="systemFieldTab">
              <div class="table-wrapper">
                <el-table :data="systemFieldsTable" border>
                  <el-table-column :label-class-name="'field-name-cell'" prop="fieldName" :label="$t('CompareTableDialog.fieldName')" width="320">
                    <template #default="scope">
                      <div class="field-name-cell">{{ scope.row.fieldName }}</div>
                    </template>
                  </el-table-column>
                  <el-table-column prop="fieldCode" :label="$t('CompareTableDialog.fieldCode')">
                    <template #default="scope">
                      <div class="field-code-cell" @click="copyFieldCode(scope.row.fieldCode)">
                        <div class="field-code">{{ scope.row.fieldCode }}</div>
                        <div class="copy-button" link type="primary">
                          <el-icon size="16"><CopyDocument /></el-icon><div class="copy-text">{{ $t('CompareTableDialog.copy') }}</div>
                        </div>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>

                <div class="comment-tips" v-if="isProcessFlowCommentTemplate">
                  <span class="tips-title">{{ $t('CompareTableDialog.printRuleSetting') }}</span>
                </div>
                <div v-if="isProcessFlowCommentTemplate">
                  <el-button class="flow-comment-btn" @click="handleShowPrintCommentDialog">
                    <span class="flow-comment-btn-text">
                      {{ flowCommentText }}
                    </span>
                  </el-button>
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane class="aggregate-field" :label="$t('CompareTableDialog.aggregateField')" name="aggregateFieldTab">
              <div class="table-wrapper">
                <el-table :data="aggregateFieldsTable" border>
                  <el-table-column prop="fieldName" :label="$t('CompareTableDialog.fieldName')" width="320">
                    <template #default="scope">
                      <div class="field-name-cell">{{ scope.row.fieldName }}</div>
                    </template>
                  </el-table-column>
                  <el-table-column prop="fieldCode" :label="$t('CompareTableDialog.fieldCode')">
                    <template #default="scope">
                      <div class="field-code-cell" @click="copyFieldCode(scope.row.fieldCode)">
                        <div class="field-code">{{ scope.row.fieldCode }}</div>
                        <div class="copy-button" link type="primary">
                          <el-icon size="16"><CopyDocument /></el-icon><div class="copy-text">{{ $t('CompareTableDialog.copy') }}</div>
                        </div>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </el-dialog>
  </div>
  <print-comment-dialog
    ref="printCommentDialogRef"
    :flow-comment-node-options="flowCommentNodeOptions"
    @confirm="handleFlowCommentRuleConfirm"
  />
</template>

<script setup lang='ts'>
import { ref, inject, computed } from 'vue';
import type { PropType } from 'vue';
import { NOCODE } from '@renderer/types';
import { getFlows, isPrintableTableAggregateField, isSystemField, normalizePrintFlowCommentRule, printFlowCommentFieldUid, printFlowCommentTextFieldUid, printOperator, printRowShareInternalUrl, printRowSharePublicUrl, printTemplateSystemFieldNames, printTime, SystemField } from '@common/utils';
import { barcodeStr, imageFillAuto, imageFillFixed, qrcodeStr, SubFormCodePartition, SubFormOrderCode } from '@common/utils/print/shared';
import { getNocodeDataSourceTableByUID } from '@common/utils/connection';
import { useClipboard } from '@vueuse/core';
import { ElMessage } from 'element-plus';
import { CopyDocument } from "@element-plus/icons-vue";
import type { TableColumnCtx } from 'element-plus'
import { Field, ProcessFlow, ProcessNodeType } from '@common/types/project';
import { FormWidgetType, PrintFlowCommentNodeScope, PrintFlowCommentOrder, PrintFlowCommentRule, PrintTemplate, PrintTemplateType } from '@common/types/nocode';
import i18next from 'i18next';
import PrintCommentDialog from './PrintCommentDialog.vue';
import { getPrintableRelatedSubForms } from '@common/utils/related';
import { getI18nLabelColon } from '@common/utils/i18n';

const props = defineProps({
  activePageId: {
    type: String,
    required: true,
  },
  templateType: {
    type: String as PropType<PrintTemplateType>,
    required: true,
  },
  printTemplate: {
    type: Object as PropType<PrintTemplate | undefined>,
    default: undefined,
  },
});
const emit = defineEmits(['update']);

const nocode = inject(NOCODE);
const { copy } = useClipboard({ legacy: true });
const dialogVisible = ref(false);
const printCommentDialogRef = ref<InstanceType<typeof PrintCommentDialog> | null>(null);
const activeTab = ref('formFieldTab')
interface FormField {
  fieldName: string
  fieldCode: string
  // 展示字段类型 如： 文本、二维码、条形码；宽度固定、高度自适应、高度固定、宽度自适应等
  fieldType?: string
  rowspan?: number
  colspan?: number
}
interface SpanMethodProps {
  row: FormField
  column: TableColumnCtx<FormField>
  rowIndex: number
  columnIndex: number
}
type FlowCommentRuleState = Required<Pick<PrintFlowCommentRule, "order" | "nodeScope" | "onlySubmitOperation" | "onlyNonEmptyComment">> & {
  nodeIds: string[];
}
const formFieldsTable = ref<FormField[]>([])
const systemFieldsTable = ref<FormField[]>([])
const aggregateFieldsTable = ref<FormField[]>([])
const systemFieldNames = printTemplateSystemFieldNames
const flowCommentText = computed(() => {
  const getprintOrderText = () => {
    if (flowCommentRule.value.order === PrintFlowCommentOrder.DESC) {
      return i18next.t('CompareTableDialog.printOrderDesc');
    }
    return i18next.t('CompareTableDialog.printOrderAsc')
  }
  const getprintFlowCommentNodeScopeText = () => {
    if (flowCommentRule.value.nodeScope === PrintFlowCommentNodeScope.ALL) {
      return i18next.t('CompareTableDialog.allApprovalOpinionNodes');
    }
    return i18next.t('CompareTableDialog.customNodes');
  }
  const printOrderText = getprintOrderText()
  const printFlowCommentNodeScopeText = getprintFlowCommentNodeScopeText()
  const onlySubmitOperationText = flowCommentRule.value.onlySubmitOperation ? i18next.t('CompareTableDialog.onlySubmitApprovalOpinion') : '';
  const onlyNonEmptyCommentText = flowCommentRule.value.onlyNonEmptyComment ? i18next.t('CompareTableDialog.onlyNonEmptyApprovalOpinion') : '';
  return [printOrderText, printFlowCommentNodeScopeText, onlySubmitOperationText, onlyNonEmptyCommentText].filter(Boolean).join('，')
})
const getFlowCommentTextFieldCode = () => {
  return `\${${i18next.t('CompareTableDialog.flowCommentText')}#${printFlowCommentFieldUid}${SubFormCodePartition}${printFlowCommentTextFieldUid}}`
}
const createFlowCommentRuleState = (rule?: PrintFlowCommentRule | null): FlowCommentRuleState => {
  const normalizedRule = normalizePrintFlowCommentRule(rule);
  return {
    ...normalizedRule,
    nodeIds: [...(normalizedRule.nodeIds || [])],
  };
}
const flowCommentRule = ref<FlowCommentRuleState>(createFlowCommentRuleState())
const process = computed(() => {
  return nocode.value.body.formData.formOptions?.[props.activePageId]?.process;
})
const isFlowCommentPrintTemplate = computed(() => {
  return props.templateType === PrintTemplateType.WORD || props.templateType === PrintTemplateType.EXCEL;
})
const isProcessFlowCommentTemplate = computed(() => {
  return isFlowCommentPrintTemplate.value && process.value?.enabled;
})
const collectFlowCommentNodes = (nodes: ProcessFlow[] = []) => {
  const result: ProcessFlow[] = [];
  for (const node of nodes) {
    if ([ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(node.type)) {
      result.push(node);
    }
    for (const branch of node.branches || []) {
      result.push(...collectFlowCommentNodes(branch.flows || []));
    }
  }
  return result;
}
const flowCommentNodeOptions = computed(() => {
  const nodes = process.value ? getFlows(process.value) || [] : [];
  const usedNodeIds = new Set<string>();
  return collectFlowCommentNodes(nodes)
    .filter(node => {
      if (usedNodeIds.has(node.uid)) return false;
      usedNodeIds.add(node.uid);
      return true;
    })
    .map(node => ({
      uid: node.uid,
      name: node.options?.name || node.uid,
    }));
})
// 文本内容添加fieldType
const handleShowPrintCommentDialog = () => {
  printCommentDialogRef.value?.show(flowCommentRule.value);
}
const handleFlowCommentRuleConfirm = (rule: PrintFlowCommentRule) => {
  const nextRule = createFlowCommentRuleState(rule);
  flowCommentRule.value = nextRule;
  emit('update', nextRule);
}
const textFieldTypeFun = (table: FormField[], field: Field, {fieldName = '', fieldCode = ''} = {}) => {
  fieldName = fieldName || field.alias
  fieldCode = fieldCode || `${field.alias}#${field.uid}`
  const arr: FormField[] = [
    {
      fieldName,
      fieldCode: `\${${fieldCode}}`,
      fieldType: i18next.t('CompareTableDialog.text'),
    },
    {
      fieldName,
      fieldCode: `\${${fieldCode}|${qrcodeStr}|size=20*20}`,
      fieldType: i18next.t('CompareTableDialog.qrCode'),
    },
    {
      fieldName,
      fieldCode: `\${${fieldCode}|${barcodeStr}|size=30*20}`,
      fieldType: i18next.t('CompareTableDialog.barCode'),
    },
  ]
  arr.forEach((item, index) => {
    if (index === 0) {
      item.rowspan = item.rowspan || 3
      item.colspan = item.colspan || 1
    } else {
      item.rowspan = item.rowspan || 0
      item.colspan = item.colspan || 0
    }
  })
  arr.forEach(item => {
    table.push(item)
  })
}
const imageFieldTypeFun = (table: FormField[], field: Field, {fieldName = '', fieldCode = ''} = {}) => {
  fieldName = fieldName || field.alias
  fieldCode = fieldCode || `${field.alias}#${field.uid}`

  const arr: FormField[] = [
    {
      fieldName,
      fieldCode: `\${${fieldCode}|size=30*auto}`,
      fieldType: i18next.t('CompareTableDialog.fixWidthAutoHeight'),
    },
    {
      fieldName,
      fieldCode: `\${${fieldCode}|size=auto*20}`,
      fieldType: i18next.t('CompareTableDialog.fixHeightAutoWidth'),
    },
    {
      fieldName,
      fieldCode: `\${${fieldCode}|size=30*20${imageFillAuto}}`,
      fieldType: i18next.t('CompareTableDialog.autoWidthHeight'),
    },
    {
      fieldName,
      fieldCode: `\${${fieldCode}|size=30*20${imageFillFixed}}`,
      fieldType: i18next.t('CompareTableDialog.fixWidthHeight'),
    },
  ]
  arr.forEach((item, index) => {
    if (index === 0) {
      item.rowspan = item.rowspan || 4
      item.colspan = item.colspan || 1
    } else {
      item.rowspan = item.rowspan || 0
      item.colspan = item.colspan || 0
    }
  })
  arr.forEach(item => {
    table.push(item)
  })
}
const widgetTypeMap = {
  [FormWidgetType.TEXT_INPUT]: textFieldTypeFun,
  [FormWidgetType.HYPERLINK]: textFieldTypeFun,
  [FormWidgetType.SERIAL_NUMBER]: textFieldTypeFun,
  [FormWidgetType.IMAGE_UPLOADER]: imageFieldTypeFun,
  [FormWidgetType.HANDWRITTEN_SIGNATURE]: imageFieldTypeFun,
  // [FormWidgetType.RELATED_DATA]: relatedDataTypeFun,
}
const getWidgetType = (field: Field) => {
  return field?.meta?.extra?.widgetType
}
const appendFieldCode = (field: Field, fieldName: string, fieldCode: string) => {
  const key = getWidgetType(field)
  const func = widgetTypeMap[key]
  if (func) {
    func(formFieldsTable.value, field, {
      fieldName,
      fieldCode,
    })
    return
  }
  formFieldsTable.value.push({
    fieldName,
    fieldCode: `\${${fieldCode}}`
  })
}
const handleOpen = () => {
  flowCommentRule.value = createFlowCommentRuleState(props.printTemplate?.flowCommentRule);
  const activeTable = getNocodeDataSourceTableByUID(nocode.value.body, props.activePageId, {
    nocodeId: nocode.value.meta?.id,
  }, true)?.table
  if (!activeTable) {
    return;
  }
  const formFields = activeTable.fields.filter(field => !isSystemField(field))
  const systemFields = activeTable.fields.filter(field => isSystemField(field))
  const aggregateFields = (nocode.value.body.formData.metas?.[props.activePageId]?.aggregateFields || [])
    .filter(field => isPrintableTableAggregateField(field))

  let getSubFields = (field: Field) => {
    const subTableUID = field?.meta?.extra?.subTableUID[1]
    const subTableFields = getNocodeDataSourceTableByUID(nocode.value.body, subTableUID, {
      nocodeId: nocode.value.meta?.id,
    }, true)?.table?.fields || []
    const subTableCustomFields = subTableFields.filter(field => !isSystemField(field))
    return subTableCustomFields
  }

  formFields.forEach(field => {
    if (field?.meta?.subType === 'subForm') {
      // 如果是子表单
      // 1.获取subTableUID[1]
      // 2.根据subTableUID[1]找到对应的子表单table的fields
      // 3.过滤掉系统字段得到子表单自定义字段数据
      
      const subTableCustomFields = getSubFields(field)

      formFieldsTable.value.push({
        fieldName: `${field.alias}.${i18next.t('CompareTableDialog.serialNo')}`,
        fieldCode: `\${${field.alias}#${field.uid}${SubFormCodePartition}${SubFormOrderCode}}`
      })

      for (const item of subTableCustomFields) {
        const key = getWidgetType(item)
        if (['widget.form.subform', 'widget.form.relatedData'].includes(key)) {
          continue
        }
        const func = widgetTypeMap[key]
        if (func) {
          func(
            formFieldsTable.value,
            item,
            {
              fieldName: `${field.alias}.${item.alias}`,
              fieldCode: `${field.alias}#${field.uid}${SubFormCodePartition}${item.uid}`
            }
          )
        } else {
          formFieldsTable.value.push({
            fieldName: `${field.alias}.${item.alias}`,
            fieldCode: `\${${field.alias}#${field.uid}${SubFormCodePartition}${item.uid}}`
          })
        }
      }
    } else if (field?.meta?.subType === 'related') {
      // 单条：“字段代码对照表”，需要做子表单的多条
      // 多条：过滤子表单

      const isSingle = field.meta.extra.relatedDataMode === 'single'
      const isMultiple = field.meta.extra.relatedDataMode === 'multiple'

      const relatedTableUID = field?.meta?.extra?.relatedTableUID[1]
      const relatedTableFields = getNocodeDataSourceTableByUID(nocode.value.body, relatedTableUID, {
        nocodeId: nocode.value.meta?.id,
      }, true)?.table?.fields || []
      const relatedTableCustomFields = relatedTableFields.filter(field => !isSystemField(field))

      if (isMultiple) {
        formFieldsTable.value.push({
          fieldName: `${field.alias}.${i18next.t('CompareTableDialog.serialNo')}`,
          fieldCode: `\${${field.alias}#${field.uid}${SubFormCodePartition}${SubFormOrderCode}}`
        })
      }
      for (const item of relatedTableCustomFields) {
        const key = getWidgetType(item)
        if (key === 'widget.form.relatedData') {
          continue
        }
        if (key === 'widget.form.subform') {
          if (isSingle) {
            const subTableCustomFields = getSubFields(item)

            formFieldsTable.value.push({
              fieldName: `${field.alias}.${item.alias}.${i18next.t('CompareTableDialog.serialNo')}`,
              fieldCode: `\${${field.alias}#${field.uid}${SubFormCodePartition}${item.uid}${SubFormCodePartition}${SubFormOrderCode}}`
            })
            for (const subTableCustomField of subTableCustomFields) {
              const key = getWidgetType(subTableCustomField)
              if (key === 'widget.form.relatedData') {
                continue
              }
              const func = widgetTypeMap[key]
              if (func) {
                func(
                  formFieldsTable.value,
                  item,
                  {
                    fieldName: `${field.alias}.${item.alias}.${subTableCustomField.alias}`,
                    fieldCode: `${field.alias}#${field.uid}${SubFormCodePartition}${item.uid}${SubFormCodePartition}${subTableCustomField.uid}`
                  }
                )
              } else {
                formFieldsTable.value.push({
                  fieldName: `${field.alias}.${item.alias}.${subTableCustomField.alias}`,
                  fieldCode: `\${${field.alias}#${field.uid}${SubFormCodePartition}${item.uid}${SubFormCodePartition}${subTableCustomField.uid}}`
                })
              }
            }
          }
          continue
        }
        const func = widgetTypeMap[key]
        if (func) {
          func(
            formFieldsTable.value,
            item,
            {
              fieldName: `${field.alias}.${item.alias}`,
              fieldCode: `${field.alias}#${field.uid}${SubFormCodePartition}${item.uid}`
            }
          )
        } else {
          formFieldsTable.value.push({
            fieldName: `${field.alias}.${item.alias}`,
            fieldCode: `\${${field.alias}#${field.uid}${SubFormCodePartition}${item.uid}}`
          })
        }
      }
    } else {
      const key = getWidgetType(field)
      const func = widgetTypeMap[key]
      if (func) {
        func(formFieldsTable.value, field)
      } else {
        formFieldsTable.value.push({
          fieldName: field.alias,
          fieldCode: `\${${field.alias}#${field.uid}}`
        })
      }
    }
  })

  const relatedSubForms = getPrintableRelatedSubForms(nocode.value.body.formData, activeTable)
  Object.entries(relatedSubForms).forEach(([tableUID, relatedInfo]) => {
    formFieldsTable.value.push({
      fieldName: `${relatedInfo.name}.${i18next.t('CompareTableDialog.serialNo')}`,
      fieldCode: `\${${relatedInfo.name}#${tableUID}${SubFormCodePartition}${SubFormOrderCode}}`
    })
    relatedInfo.printableFields.forEach(field => {
      appendFieldCode(
        field,
        `${relatedInfo.name}.${field.alias}`,
        `${relatedInfo.name}#${tableUID}${SubFormCodePartition}${field.uid}`
      )
    })
  })

  systemFields.forEach(field => {
    if(systemFieldNames.includes(field.meta.name as SystemField)) {
      systemFieldsTable.value.push({
        fieldName: field.alias,
        fieldCode: `\${${field.alias}#${field.uid}}`
      })
    }
  })
  systemFieldsTable.value.push({
    fieldName: i18next.t('CompareTableDialog.printer'),
    fieldCode: `\${${i18next.t('CompareTableDialog.printer')}#${printOperator}}`
  })
  systemFieldsTable.value.push({
    fieldName: i18next.t('CompareTableDialog.printTime'),
    fieldCode: `\${${i18next.t('CompareTableDialog.printTime')}#${printTime}}`
  })
  if (activeTable.publish?.rowShareEnabled) {
    systemFieldsTable.value.push({
      fieldName: i18next.t('CompareTableDialog.rowShareInternalUrl'),
      fieldCode: `\${${i18next.t('CompareTableDialog.rowShareInternalUrl')}#${printRowShareInternalUrl}}`
    })
    systemFieldsTable.value.push({
      fieldName: i18next.t('CompareTableDialog.rowShareInternalQrCode'),
      fieldCode: `\${${i18next.t('CompareTableDialog.rowShareInternalUrl')}#${printRowShareInternalUrl}|${qrcodeStr}|size=20*20}`
    })
    systemFieldsTable.value.push({
      fieldName: i18next.t('CompareTableDialog.rowSharePublicUrl'),
      fieldCode: `\${${i18next.t('CompareTableDialog.rowSharePublicUrl')}#${printRowSharePublicUrl}}`
    })
    systemFieldsTable.value.push({
      fieldName: i18next.t('CompareTableDialog.rowSharePublicQrCode'),
      fieldCode: `\${${i18next.t('CompareTableDialog.rowSharePublicUrl')}#${printRowSharePublicUrl}|${qrcodeStr}|size=20*20}`
    })
  }
  if (isProcessFlowCommentTemplate.value) {
    systemFieldsTable.value.push({
      fieldName: i18next.t('CompareTableDialog.flowCommentText'),
      fieldCode: getFlowCommentTextFieldCode()
    })
  }

  aggregateFields.forEach(field => {
    aggregateFieldsTable.value.push({
      fieldName: field.name,
      fieldCode: `\${${field.name}#${field.uid}}`
    })
  })
}
const spanMethod = ({
  row,
  columnIndex,
}: SpanMethodProps) => {
  if (columnIndex === 0) {
    if (typeof row.rowspan === 'number' && typeof row.colspan === 'number') {
      return {
        rowspan: row.rowspan,
        colspan: row.colspan,
      }
    }
  }
}
const handleClosed = () => {
  formFieldsTable.value = []
  systemFieldsTable.value = []
  aggregateFieldsTable.value = []
  flowCommentRule.value = createFlowCommentRuleState()
  activeTab.value = 'formFieldTab'
}

const copyFieldCode = async (fieldCode: string) => {
  try {
    await copy(fieldCode);
    ElMessage.success(i18next.t('CompareTableDialog.copySuccess'));
  } catch {
    ElMessage.error(i18next.t('CompareTableDialog.copyFail'));
  }
}

defineExpose({
  show: () => {
    dialogVisible.value = true;
  }
})
</script>

<style scoped lang='scss'>
.compare-table-dialog {
  :deep(.hover-cell) {
    background-color: transparent !important;
  }
  :deep(.el-dialog) {
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    --el-dialog-padding-primary: 0;

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
    }

    .el-dialog__body {
      padding: 24px 16px;
      border-radius: 4px;

      .dialog-body {
        display: flex;
        flex-direction: column;

        .tips {
          line-height: 20px;
          margin-bottom: 16px;

          .tip-line {
            font-size: 12px;
            font-weight: 400;
            color: #727272;
            letter-spacing: 0.5px;

            a {
              color: var(--color-primary);
            }
          }
        }

        .compare-table {
          .table-wrapper {
            height: 485px;
            overflow-y: auto;
          }
          .comment-tips {
            margin: 24px 0px 12px;
            .tips-title {
              font-size: 14px;
              font-weight: 700;
            }
            .tips-desc {
              color: rgba(19, 29, 46, 0.47);
              font-size: 12px;
              margin-left: 8px;
            }
          }
          .flow-comment-btn {
            border-radius: 4px;
            font-size: 14px;
            .flow-comment-btn-text {
              width: 200px;
              text-overflow: ellipsis;
              white-space: nowrap;
              overflow: hidden;
            }
          }
          .flow-comment-rule {
            padding: 12px 16px;
            margin-bottom: 12px;
            background-color: var(--bg-color-overlay);
            border: 1px solid var(--border-color);
            border-radius: 4px;

            .flow-comment-rule__title {
              margin-bottom: 12px;
              font-size: 14px;
              line-height: 20px;
              color: #141414;
              font-weight: 500;
            }

            .flow-comment-rule__item {
              min-height: 32px;
              display: flex;
              align-items: center;
              gap: 16px;

              & + .flow-comment-rule__item {
                margin-top: 8px;
              }

              .flow-comment-rule__label {
                width: 88px;
                flex: 0 0 88px;
                font-size: 13px;
                color: #727272;
              }

              .el-select {
                width: 360px;
              }
            }
          }

          .el-table {
            width: 100%;

            --el-table-header-bg-color: var(--bg-color-overlay);
            --el-table-tr-bg-color: transparent;

            thead {
              tr {
                th {
                  font-size: 14px;
                  font-weight: 400;
                  color: #141414;
                }
              }
            }
            tbody {
              tr {
                .field-name-cell {
                  padding-left: 16px;
                }

                .field-code-cell {
                  height: 44px;
                  position: relative;
                  display: flex;
                  align-items: center;

                  .field-code {
                    margin-left: 16px;
                  }
                  .field-type {
                    color: #838892;
                    margin-right: 0px;
                  }
                  &:hover {
                    background-color: var(--bg-color-overlay);
                    cursor: pointer;
                    .field-code {
                      color: rgba(55, 55, 55, 0.1);
                    }
                    .field-type {
                      color: rgba(83, 88, 92, 0.1);
                    }
                  }

                  .copy-button {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    display: flex;
                    align-items: center;
                    opacity: 0;

                    .el-icon {
                      width: 14px;
                      height: 14px;
                    }
                    .copy-text {
                      font-size: 14px;
                      font-weight: 500;
                      margin-left: 4px;
                    }
                  }

                  &:hover .copy-button {
                    opacity: 1;
                  }
                }

                .current-row {
                  background-color: transparent !important;
                }
              }
              .el-table__row {
                height: 44px;
                .cell {
                  padding: 0;
                }
                .el-table__cell {
                  padding: 0;
                  margin: 0;
                }
              }
              .el-table__row:hover {
                .el-table__cell {
                  background-color: transparent;
                }
              }
            }
          }

          .system-field {
            // .el-table {
            //   max-height: 360px;
            // }
          }
        }
      }
    }
  }
}
</style>
