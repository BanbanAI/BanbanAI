<template>
  <el-form class="time-task-option" :model="options" :rules="rules" ref="formRef">
    <div class="warning">
      <el-icon size="16"><Warning /></el-icon>
      <span>{{ $t('TimeTaskOption.triggerConditionDesc') }}</span>
    </div>
    <option-item :title="$t('TimeTaskOption.changeType')" hideTitle>
      <el-tabs>
        <el-tab-pane :label="$t('TimeTaskOption.timingSetting')" class>
          <div class="time-setting">
            <el-form-item>
              <div>{{ $t('TimeTaskOption.timingMethod') }}</div>
              <el-select v-model="props.options.method" :disabled="isSingleMode">
                <el-option :label="$t('TimeTaskOption.basicTiming')+''" :value="TimeTaskMethod.BASIC_TASK" />
                <el-option :label="$t('TimeTaskOption.advancedTiming')+''" :value="TimeTaskMethod.ADVANCED_TASK" />
              </el-select>
            </el-form-item>
            <hr>
            <el-form-item v-if="props.options.method === TimeTaskMethod.ADVANCED_TASK" prop="triggerDate">
              <div>{{ $t('TimeTaskOption.triggerDateFromFormField') }}</div>
              <el-select v-model="props.options.triggerDate" :placeholder="$t('TimeTaskOption.selectDateField')">
                <el-option
                  v-for="field in dateFieldOptions"
                  :key="field.uid"
                  :label="field.alias"
                  :value="field.uid"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <div style="width: 100%;">{{ $t('TimeTaskOption.triggerTimePoint') }}</div>
              <el-select
                style="width: 184px; margin-right: 8px;"
                v-if="props.options.method === TimeTaskMethod.ADVANCED_TASK"
                v-model="props.options.triggerTimePoint.type"
              >
                <el-option :value="TimeTaskDatePoint.BEFORE" :label="$t('TimeTaskOption.before')+''" />
                <el-option :value="TimeTaskDatePoint.TODAY" :label="$t('TimeTaskOption.today')+''" />
                <el-option :value="TimeTaskDatePoint.AFTER" :label="$t('TimeTaskOption.after')+''" />
              </el-select>
              <el-input
                style="width: 64px; margin-right: 8px;"
                v-if="props.options.method === TimeTaskMethod.ADVANCED_TASK && props.options.triggerTimePoint?.type != TimeTaskDatePoint.TODAY"
                v-model="props.options.triggerTimePoint.value"
                type="number"
                min="1"
                :placeholder="$t('TimeTaskOption.inputTriggerTimePoint')"
                @change="props.options.triggerTimePoint.value = props.options.triggerTimePoint.value ? Number(props.options.triggerTimePoint.value) : 1"
              />
              <span style="margin-right: 8px;" v-if="props.options.method === TimeTaskMethod.ADVANCED_TASK && props.options.triggerTimePoint?.type != TimeTaskDatePoint.TODAY">
                {{ $t('TimeTaskOption.day') }}
              </span>
              <el-time-select
                v-model="props.options.triggerTime"
                start="00:00"
                step="00:1"
                end="23:59"
                :placeholder="$t('TimeTaskOption.selectTriggerTimePoint')"
                style="flex: 1;"
                :clearable="false"
              />
            </el-form-item>
            <el-form-item>
              <div>{{ $t('TimeTaskOption.repeat') }}</div>
              <el-select v-model="props.options.repeat" :placeholder="$t('TimeTaskOption.selectRepeatMethod')">
                <el-option v-for="item in TimeTaskRepeat" :key="item" :label="TimeTaskRepeatText[item]" :value="item" />
              </el-select>
            </el-form-item>
            <hr v-if="props.options.repeat != TimeTaskRepeat.ONECE">
            <el-form-item v-if="props.options.startDate && props.options.repeat != TimeTaskRepeat.ONECE" prop="startDate">
              <div style="width: 100%;">{{ $t('TimeTaskOption.startDate') }}</div>
              <el-select style="width: 184px;" v-model="props.options.startDate.type" @change="props.options.startDate.value = null">
                <el-option
                  v-for="item in timeTaskDateTypeOptions"
                  :key="item.value"
                  :value="item.value"
                  :label="item.label"
                />
              </el-select>
              <el-config-provider
                :locale="elementPlusLocale"
                v-if="props.options?.startDate?.type === TimeTaskDateType.CUSTOM"
              >
                <el-date-picker
                  type="date"
                  value-format="YYYY-MM-DD"
                  :placeholder="$t('TimeTaskOption.selectStartDate')"
                  size="default"
                  style="flex: 1; margin-left: 8px;"
                  v-model="props.options.startDate.value"
                />
              </el-config-provider>
              <el-select
                style="flex: 1; margin-left: 8px;"
                v-else-if="props.options?.startDate?.type === TimeTaskDateType.FIELD"
                :placeholder="$t('TimeTaskOption.selectField')"
                v-model="props.options.startDate.value"
              >
                <el-option
                  v-for="field in dateFieldOptions"
                  :key="field.uid"
                  :label="field.alias"
                  :value="field.uid"
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="props.options.endDate && props.options.repeat != TimeTaskRepeat.ONECE" prop="endDate">
              <div style="width: 100%;">{{ $t('TimeTaskOption.endDate') }}</div>
              <el-select style="width: 184px;" v-model="props.options.endDate.type" @change="props.options.endDate.value = null">
                <el-option
                  v-for="item in timeTaskDateTypeOptions"
                  :key="item.value"
                  :value="item.value"
                  :label="item.label"
                />
              </el-select>
              <el-config-provider
                :locale="elementPlusLocale"
                v-if="props.options?.endDate?.type === TimeTaskDateType.CUSTOM"
              >
                <el-date-picker
                  type="date"
                  value-format="YYYY-MM-DD"
                  :placeholder="$t('TimeTaskOption.selectEndDate')"
                  size="default"
                  style="flex: 1; margin-left: 8px;"
                  v-model="props.options.endDate.value"
                />
              </el-config-provider>

              <el-select
                style="flex: 1; margin-left: 8px;"
                v-else-if="props.options?.endDate?.type === TimeTaskDateType.FIELD"
                :placeholder="$t('TimeTaskOption.selectField')"
                v-model="props.options.endDate.value"
              >
                <el-option
                  v-for="field in dateFieldOptions"
                  :key="field.uid"
                  :label="field.alias"
                  :value="field.uid"
                />
              </el-select>
            </el-form-item>
            <el-form-item>

            </el-form-item>
          </div>
        </el-tab-pane>
        <el-tab-pane :label="$t('TimeTaskOption.moreTriggerConditions')">
          <div class="trigger-condition-switch">
            <span>{{ $t('TimeTaskOption.enableTriggerConditions') }}</span>
            <el-switch v-model="triggerConditionsEnabled" size="small" />
          </div>
          <template v-if="triggerConditionsEnabled">
            <div class="trigger-condition">
              <div class="title">
                {{ $t('TimeTaskOption.modeSelect') }}
              </div>

              <el-form-item class="container">
                <el-radio-group
                  :modelValue="isSingleMode"
                  class="radio-container"
                  @change="handleTriggerModeChange"
                >
                  <el-radio
                    v-for="(item, index) in TriggerModeOption"
                    :value="item.value"
                    :key="index"
                  >
                    <div class="radio-item">
                      <div class="radio-title">{{ item.title }}</div>
                      <div class="radio-description">{{ item.description }}</div>
                    </div>
                  </el-radio>
                </el-radio-group>
              </el-form-item>
            </div>

            <data-source-form
              v-if="showDataSourceForm"
              :sourceTables="props.options.sourceTables"
              ref="dataSourceFormRef"
              style="margin-top: 24px;"
            />
            <condition-item
              v-if="showConditionItem"
              :node="props.node"
              :options="props.options"
              :allowEmptyCondition="true"
              :customTitle="$t('TimeTaskOption.conditionTitle')"
              ref="conditionItemRef"
            />
          </template>
        </el-tab-pane>
        <el-tab-pane :label="$t('NodeOptionDrawer.operationPermission')">
          <div class="operation-permission">
            <cross-table-execution-mode-option :options="props.options" />
            <el-checkbox v-model="props.options.allowCancel" :label="$t('NodeOptionDrawer.allowCancel')" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </option-item>
  </el-form>
</template>

<script lang='ts' setup>
import { TimeTaskMethod, TimeTaskRepeat, TimeTaskOptions, TimeTaskDateType, TimeTaskDatePoint, TriggerMode, ProcessFlowOptions, isTimeTaskSingleTriggerMode, isTimeTaskTriggerConditionsEnabled } from '@common/types/project';
import { ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { ref, reactive, computed } from 'vue';
import { useFormFields } from '../../hooks';
import { isSystemField } from '@common/utils';
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale'
import { cloneDeep } from 'lodash';
import { TimeTaskNode } from '../process';
import { Warning } from '@element-plus/icons-vue';
import i18next from 'i18next';

const props = defineProps<{
  node: TimeTaskNode,
  options: TimeTaskOptions & ProcessFlowOptions,
}>();
const formRef = ref<FormInstance>();
const formFields = useFormFields();
const triggerConditionsEnabled = computed({
  get: () => isTimeTaskTriggerConditionsEnabled(props.options),
  set: (value: boolean) => {
    props.options.enableTriggerConditions = value
    if (value && !props.options.sourceTables?.length) {
      props.options.sourceTables = []
    }
  },
})
const isSingleMode = computed(() => triggerConditionsEnabled.value && props.options.triggerMode === TriggerMode.SINGLE)

const TimeTaskRepeatText = {
  /** 只触发一次 */
  get [TimeTaskRepeat.ONECE]() { return i18next.t('TimeTaskOption.triggerOnce') },
  /** 每天 */
  get [TimeTaskRepeat.EVERY_DAY]() { return i18next.t('TimeTaskOption.everyDay') },
  /** 每周 */
  get [TimeTaskRepeat.EVERY_WEEK]() { return i18next.t('TimeTaskOption.everyWeek') },
  /** 每两周 */
  get [TimeTaskRepeat.EVERY_TWO_WEEKS]() { return i18next.t('TimeTaskOption.everyTwoWeeks') },
  /** 每月 */
  get [TimeTaskRepeat.EVERY_MONTH]() { return i18next.t('TimeTaskOption.everyMonth') },
  /** 每季度 */
  get [TimeTaskRepeat.EVERY_QUARTER]() { return i18next.t('TimeTaskOption.everyQuarter') },
  /** 每年 */
  get [TimeTaskRepeat.EVERY_YEAR]() { return i18next.t('TimeTaskOption.everyYear') },
  /** 法定工作日 */
  get [TimeTaskRepeat.EVERY_WORK_DAY]() { return i18next.t('TimeTaskOption.legalWorkday') },
  /** 法定节假日 */
  get [TimeTaskRepeat.EVERY_HOLIDAY]() { return i18next.t('TimeTaskOption.legalHoliday') },
  /** 周一到周五 */
  get [TimeTaskRepeat.EVERY_WORK_DAY_OF_WEEK]() { return i18next.t('TimeTaskOption.mondayToFriday') },
}

const dateFieldOptions = computed(() => {
  return (formFields?.value || []).filter(item => !isSystemField(item) && item.meta?.extra?.widgetType === 'widget.form.datePicker')
})

/** 触发日期类型 */
const timeTaskDateTypeOptions = computed(()=>{
  return [
    {
      visible: !isSingleMode.value,
      value: TimeTaskDateType.FIELD,
      label: i18next.t('TimeTaskOption.field'),
    },
    {
      value: TimeTaskDateType.CUSTOM,
      label: i18next.t('TimeTaskOption.custom'),
    },
    {
      value: TimeTaskDateType.NONE,
      label: i18next.t('TimeTaskOption.none'),
    },
  ].filter(item => item.visible !== false)
})
const rules = reactive<FormRules<TimeTaskOptions>>({
  triggerDate: [
    {
      validator: (rule, value, callback) => value
        ? callback()
        : callback(new Error(i18next.t('TimeTaskOption.selectTriggerDate'))),
      trigger: ['change'],
    },
  ],
  startDate: [
    {
      validator: (rule, value, callback) => {
        if(value.type === TimeTaskDateType.NONE) {
          return callback()
        }
        if(!value.value) {
          return callback(new Error(i18next.t('TimeTaskOption.setStartDate')))
        }
        return callback()
      },
    }
  ],
  endDate: [
    {
      validator: (rule, value, callback) => {
        if(value.type === TimeTaskDateType.NONE) {
          return callback()
        }
        if(!value.value) {
          return callback(new Error(i18next.t('TimeTaskOption.setEndDate')))
        }
        return callback()
      },
    }
  ],
})

const TriggerModeOption = computed(() => {
  return [
    {
      value: true,
      triggerMode: TriggerMode.SINGLE,
      title: i18next.t('TimeTaskOption.singleTriggerMode'),
      description: i18next.t('TimeTaskOption.singleTriggerModeDesc'),
    },
    {
      value: false,
      triggerMode: TriggerMode.MULTI,
      title: i18next.t('TimeTaskOption.multiTriggerMode'),
      description: i18next.t('TimeTaskOption.multiTriggerModeDesc'),
    }
  ]
})

const lastChangeModeOptions = ref<TimeTaskOptions>({})
const handleTriggerModeChange = (value: boolean) => {
  if (value) {
    // 保存当前有效状态
    lastChangeModeOptions.value = cloneDeep(props.options)

    // 数据恢复
    Object.assign(
      props.options,
      {
        enableTriggerConditions: props.options.enableTriggerConditions,
        sourceTables: props.options.sourceTables || [],
        conditions: props.options.conditions || [],
        method: TimeTaskMethod.BASIC_TASK,
        triggerMode: TriggerMode.SINGLE,
        triggerDate: null,
        startDate: {
          type: TimeTaskDateType.CUSTOM,
          value: null,
        },
        endDate: {
          type: TimeTaskDateType.CUSTOM,
          value: null,
        },
      },
    )
  } else {
    // 数据恢复
    Object.assign(
      props.options,
      lastChangeModeOptions.value,
      {
        enableTriggerConditions: props.options.enableTriggerConditions,
        sourceTables: props.options.sourceTables || [],
        conditions: props.options.conditions || [],
        triggerMode: TriggerMode.MULTI,
      },
    )
  }
}

const showDataSourceForm = computed(() => triggerConditionsEnabled.value)
const showConditionItem = computed(() => triggerConditionsEnabled.value)

const conditionItemRef = ref()
const dataSourceFormRef = ref()

const save = async () => {
  let validState: boolean = false
  if (!triggerConditionsEnabled.value) {
    validState = true
  } else {
    const valid = await dataSourceFormRef.value?.validate?.() ?? true
    const validCondition = await conditionItemRef.value?.validate?.() ?? true
    validState = valid && validCondition
  }
  return new Promise((resolve) => {
    const handleValidate = () => {
      formRef.value?.validate((isValid) => {
        if (isValid && validState) {
          resolve(true)
        } else {
          resolve(false)
        }
      })
    }

    /** 切换为单条触发模式 时 后续节点需要禁用的节点类型 */
    const isChangeToisSingle = isSingleMode.value && !isTimeTaskSingleTriggerMode(props.node.options)
    const isChangeLeaveisSingle = !isSingleMode.value && isTimeTaskSingleTriggerMode(props.node.options)
    // 需要判断后续节点是否有需要禁用的节点
    const nextFlowDisabledNodeTypes = props.node.getNextFlowDisabledNodeTypes(props.options)
    const hasDisabledNode = props.node?.parent?.hasNodeType(nextFlowDisabledNodeTypes)
    if (isChangeToisSingle && hasDisabledNode) {
      ElMessageBox.confirm(
        i18next.t('TimeTaskOption.singleModeTip'),
        i18next.t('TimeTaskOption.tip'),
        {
          confirmButtonText: i18next.t('TimeTaskOption.modeSwitchTip'),
          cancelButtonText: i18next.t('TimeTaskOption.cancel'),
          type: 'warning',
        },
      ).then(() => {
        // 确认清除后续节点
        props.node?.parent?.removeNodeAfter(props.node)
        handleValidate()
      }).catch(() => {
        resolve(false)
      })
    } else if (isChangeLeaveisSingle) {
      props.node?.parent?.undoRemoveNodeAfter()
      handleValidate()
    } else {
      handleValidate()
    }
  })
}
defineExpose({
  save,
})
</script>

<style lang='scss' scoped>
.time-task-option {
  width: 100%;
  height: 100%;
  padding: 12px;

  .warning {
    font-size: 14px;
    margin-bottom: 24px;
    width: 100%;
    background-color: rgb(255, 251, 232);
    color: var(--el-color-warning);
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 4px;
    
    span {
      line-height: 22px;
    }

    .menu-icon {
      margin-right: 4px;
    }
  }

  .trigger-condition-switch {
    display: flex;
    align-items: center;
    font-size: 14px;
    gap: 24px;
    padding: 7px 0px;
    margin-top: 24px;
  }

  .operation-permission {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 24px;
  }

  :deep(.el-tabs) {
    .el-tabs__header {
      display: flex !important;
      border-radius: 4px;
      margin: 0px;
    }

    .el-tabs__content {
      .el-tab-pane {
        display: flex;
        flex-direction: column;

        .time-setting {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;

          hr {
            border: none;
            border-top: 1px solid var(--border-color);
          }

          .el-form-item {
            margin-bottom: 0px;
          }

          .el-select {
            .el-select__wrapper {
              background-color: var(--bg-color-overlay);
              box-shadow: none;
              border-radius: 4px;
            }
          }

          .el-input {
            .el-input__wrapper {
              background-color: var(--bg-color-overlay);
              box-shadow: none;
              border-radius: 4px;
            }
          }
        }
      }
    }

    .el-tabs__nav-wrap {
      border-radius: 4px;
    }

    .el-tabs__item {
      flex: 1 !important;
      text-align: center;
      height: 32px;
      border-radius: 4px;
      transition: all 0.3s ease;

      &.is-active {
        background-color: #1f77fc;
        color: var(--color-white);
      }
    }

    .el-tabs__nav {
      width: 100%;
      height: 32px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    .el-tabs__active-bar {
      display: none;
    }
    .trigger-condition {
      margin-top: 24px;
      .container {
        margin-top: 12px;
        margin-bottom: 0px;
        width: 100%;
        border-radius: 4px;
        background-color: #F5F6F7;
        box-sizing: border-box;
        padding: 8px 12px;
      }
      .radio-container {
        gap: 12px;
      }
      .el-radio {
        align-items: flex-start;
        height: fit-content;
      }
      .el-radio__input {
        margin-top: 4px;
      }
      .radio-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .radio-title {
        font-size: 14px;
        line-height: 20px;
        height: 20px;
      }
      .radio-description {
        color: #727272;
        font-size: 12px;
        line-height: 16px;
        height: 16px;
      }
    }
  }
}
</style>
