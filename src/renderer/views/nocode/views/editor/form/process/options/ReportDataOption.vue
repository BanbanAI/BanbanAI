<template>
  <el-form class="data-filling-option" :model="options" :rules="rules" ref="formRef">
    <option-item :title="$t('ReportDataOption.targetForm')">
      <el-form-item prop="targetTableUID">
        <el-select
          :placeholder="$t('ReportDataOption.selectForm')"
          v-model="props.options.targetTableUID"
          :no-data-text="$t('ReportDataOption.noForm')"
          filterable
          @change="changeTargetTable"
        >
          <el-option
            v-for="item in targetFormOption"
            :value="item.value"
            :label="item.label"
          />
        </el-select>
      </el-form-item>
    </option-item>
    <el-tabs v-if="props.options.targetTableUID">
      <el-tab-pane :label="$t('ReportDataOption.reporter')">
        <option-item :title="$t('ReportDataOption.reporter')">
          <operator-option
            v-model:nodeOwner="props.options.reporter"
            ref="operatorRef"
            :isMultiple="false"
          />
        </option-item>
        <hr>
        <option-item :title="$t('ReportDataOption.reporterEmpty')">
          <el-form-item class="empty-reporter">
            <el-radio-group v-model="props.options.reporterEmpty">
              <el-radio :value="OwnerEmptyHandle.ASSIGNEE">{{ $t('ReportDataOption.specifiedPersonReport') }}</el-radio>
              <el-radio :value="OwnerEmptyHandle.ADMIN">{{ $t('ReportDataOption.transferToAdmin') }}</el-radio>
            </el-radio-group>

            <div class="reporter-option-item empty-reporter-item" v-if="props.options.reporterEmpty === OwnerEmptyHandle.ASSIGNEE">
              <span class="title">
                {{ $t('ReportDataOption.specifiedMember') }}
              </span>
              <el-form-item prop="reporterEmptyUser">
                <div class="container" ref="containerEmptyUserRef">
                  <div class="add-button" @click="selectUserRef.show()">
                    <el-icon>
                      <i-ep-plus/>
                    </el-icon>
                    {{ $t('ReportDataOption.add') }}
                  </div>

                  <!-- 可见部分 -->
                  <template v-for="(item, index) in allEmptyUserTags" :key="'empty-' + item.id">
                    <el-tag v-if="index < visibleEmptyUserCount" closable class="tag-item-empty-user" @close="closeEmptyUserTag()">
                      {{ item.label }}
                    </el-tag>
                  </template>

                  <!-- 折叠部分 -->
                  <el-tag
                    v-if="visibleEmptyUserCount < allEmptyUserTags.length"
                    class="tag-item-empty-user"
                    type="info"
                  >
                    ...
                  </el-tag>
                </div>
              </el-form-item>
            </div>
            <div class="reporter-option-item empty-reporter-item" v-if="props.options.reporterEmpty === OwnerEmptyHandle.ADMIN">
              <span class="title">
                {{ $t('ReportDataOption.selectAdmin') }}
              </span>
              <el-form-item prop="reporterEmptyAdmin">
                <div class="select-container">
                  <el-select
                    :placeholder="$t('ReportDataOption.pleaseSelectAdmin')"
                    v-model="props.options.reporterEmptyAdmin"
                  >
                    <el-option
                      v-for="item in organizeUtil.users.filter(item => item.isAdmin)"
                      :label="item.realname"
                      :value="item.id"
                    />

                    <el-option
                      :label="$t('ReportDataOption.superAdmin')"
                      :value="organizeUtil.users.find(item => item.realname === ADMIN_USERNAME)?.id"
                    />
                  </el-select>
                </div>
              </el-form-item>
            </div>
          </el-form-item>
        </option-item>

        <option-item :title="$t('ReportDataOption.tip')">
          <span class="tip">
            {{ $t('ReportDataOption.reportNodeDesc') }}
          </span>
          <span class="tip">
            {{ $t('ReportDataOption.reportPermissionDesc') }}
          </span>
        </option-item>
      </el-tab-pane>

      <el-tab-pane :label="$t('ReportDataOption.targetFormPermission')">
        <field-auth-option
          v-if="targetFields && targetFormElementsInfo"
          :isReportData="true"
          :targetFields="targetFields"
          :targetFormElementsInfo="targetFormElementsInfo"
          :requiredValue="props.options.requiredFieldAuth"
          :targetRequiredMap="targetRequiredMap"
          @update:requiredValue="value => props.options.requiredFieldAuth = value"
        />
      </el-tab-pane>

      <el-tab-pane :label="$t('ReportDataOption.operationPermission')">
        <el-form-item>
          <el-checkbox v-model="props.options.allowStash" :label="$t('ReportDataOption.allowStash')"/>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="props.options.allowFinishFlow" :label="$t('ReportDataOption.allowFinishFlow')"/>
        </el-form-item>
        <option-item :title="$t('ReportDataOption.reportComplete')" class="transact-end">
          <el-form-item class="transact-end-checkbox">
            <el-checkbox @change="initFinshData" v-model="props.options.requireSatisfyCondition" :label="$t('ReportDataOption.reportCompleteConditionTip')"/>
          </el-form-item>
          <div v-if="props.options.requireSatisfyCondition && props.options.finishCondition" class="transact-end-container">
            <data-source-form
              :sourceTables="props.options.finishCondition?.sourceTables"
              :defaultFormInfo="defaultFormInfo"
              ref="dataSourceFormRef"
              :helpText="$t('ReportDataOption.conditionFieldSourceTip')"
            />
            <condition-item
              :node="props.node"
              :options="props.options.finishCondition"
              :allowEmptyCondition="false"
              :firstTableLabel="$t('ReportDataOption.targetForm')"
              :targetTable="getTargetTable"
              :showErrorTip="true"
              :defaultErrorTip="$t('ReportDataOption.reportCompleteConditionNotMet')"
              ref="conditionItemRef"
            >
              <template #condition-type-options>
                <el-option :label="$t('ReportDataOption.field')" :value="FormConditionValueType.FORM"/>
                <el-option :label="$t('ReportDataOption.formulaEdit')" :value="FormConditionValueType.FORMULA"/>
                <el-option :label="$t('ReportDataOption.triggerNode')" :value="FormConditionValueType.NODE"/>
                <el-option :label="$t('ReportDataOption.filterDataCount')" :value="FormConditionValueType.FILTER_ROW"/>
              </template>
            </condition-item>
          </div>
        </option-item>
        <node-timeout-setting :node="props.node" :options="props.options" />
      </el-tab-pane>
    </el-tabs>
  </el-form>
  
  <organize-manager-dialog 
    :tableList="{
      departments: [],
      roles: [],
      users: resolveUsersByIds([props.options?.reporterEmptyUser]),
      dynamic: [],
    }"
    @confirm="handleAddUser"
    :dialogTitle="$t('ReportDataOption.specifiedMember')"
    ref="selectUserRef"
    :multiple="false"
  />
</template>

<script lang='ts' setup>
import { ProcessFlowOptions, ProcessNodeOwnerType, OwnerEmptyHandle, ReportDataOptions } from '@common/types/project';
import { FormInstance, FormRules } from 'element-plus';
import { ref, reactive, computed, inject, onMounted, nextTick, watch } from 'vue';
import { ORGANIZE_UTIL } from '@renderer/types';
import { deepClone, isEmpty } from '@common/utils/object';
import { ADMIN_USERNAME } from "@common/types/account";
import { NOCODE } from "@renderer/types"
import { useFormTable } from '../../hooks'
import { getFormElementsInfo, isSystemField, SystemField } from '@common/utils';
import { FormConditionValueType } from '@common/types/nocode';
import i18next from 'i18next';
import { ProcessNode } from '../process';
import { canReadNocodeTableDataByBody } from '@renderer/views/nocode/utils/data-permission';
import { getNocodeDataSourceTableByUID, getNocodeMainTableOptions } from '@common/utils/connection';
import { getUserDisplayName } from '@renderer/utils/other';
import NodeTimeoutSetting from './component/NodeTimeoutSetting.vue';

const organizeUtil = inject(ORGANIZE_UTIL);
const props = defineProps<{
  node: ProcessNode,
  options: ProcessFlowOptions & ReportDataOptions,
}>();

const selectUserRef = ref(null)
const formRef = ref<FormInstance>();
const nocode = inject(NOCODE)
const table = useFormTable();
const hasDataFillingOption = ref(false)
const operatorRef = ref(null)
const dataSourceFormRef = ref(null)
const conditionItemRef = ref(null)

const resolveUsersByIds = (userIds = []) => {
  return (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .map(userId => organizeUtil?.findUserById(userId))
    .filter(Boolean)
}

const defaultFormInfo = [
  {
    get title() { return i18next.t('ReportDataOption.dataSourceFormDefault') },
    get tipContent() { return i18next.t('ReportDataOption.formNotDeletableTip') },
    get description() { return `${i18next.t('ReportDataOption.targetForm')}-${i18next.t('ReportDataOption.thisData')}` },
  },
]

const targetFields = computed(() => {
  const table = getNocodeDataSourceTableByUID(nocode.value?.body, props.options?.targetTableUID, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)?.table
  if (!table || !Array.isArray(table.fields)) return []

  const fields = table.fields.filter(field => {
    return (
      !isSystemField(field) ||
    [SystemField.CREATE_OWNER, SystemField.DATA_OWNER, SystemField.CREATE_TIME, SystemField.UPDATE_TIME].includes(
        field.meta.name as SystemField
      )
    )
  })

  return fields
})

const targetFormElementsInfo = computed(() => {
  const tableSource = getNocodeDataSourceTableByUID(nocode.value?.body, props.options?.targetTableUID, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)
  const origin = tableSource?.connection?.formOptions?.[props.options?.targetTableUID]
  if (!origin) return []

  const formOption = deepClone(origin)
  const formWidget = formOption?.widget
  if (!formWidget || !Array.isArray(formWidget.widgets)) return []

  return getFormElementsInfo(formWidget.widgets)
})

const targetRequiredMap = computed(() => {
  const tableSource = getNocodeDataSourceTableByUID(nocode.value?.body, props.options?.targetTableUID, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)
  const origin = tableSource?.connection?.formOptions?.[props.options?.targetTableUID]
  const requiredMap: Record<string, boolean> = {}
  const visit = (widgets = []) => {
    widgets.forEach((widget: any) => {
      if (widget?.uid) {
        const requiredMode = widget.options?.['required-mode']
        requiredMap[widget.uid] = requiredMode
          ? requiredMode === 'on' || requiredMode === 'condition'
          : widget.options?.required === true
      }
      if (Array.isArray(widget?.widgets) && widget.widgets.length) {
        visit(widget.widgets)
      }
    })
  }

  visit(origin?.widget?.widgets || [])
  return requiredMap
})

const rules = reactive<FormRules<ReportDataOptions>>({
  [`reporter.${ProcessNodeOwnerType.ASSIGNEE}`]: [
    {
      validator: (rule, value, callback) => {
        // value 就是 options.reporter[ASSIGNEE] 对象
        if (!value) {
          return callback();
        }
        const hasRole = value.roles?.length > 0;
        const hasUser = value.users?.length > 0;

        if (hasRole || hasUser) {
          callback(); // 校验通过
        } else {
          callback(new Error(i18next.t('ReportDataOption.selectRoleOrUser')));
        }
      },
      trigger: 'change'
    }
  ],
  [`reporter.${ProcessNodeOwnerType.FORM_MEMBER}`]: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          return callback();
        }
        const hasMember = value.length > 0
        if(hasMember) {
          callback()
        } else {
          callback(new Error(i18next.t('ReportDataOption.selectMemberField')));
        }
      },
      trigger: 'change'
    }
  ],
  [`reporter.${ProcessNodeOwnerType.FORM_DEPARTMENT}`]: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          return callback();
        }
        const hasDepart = value.value != null
        if(hasDepart) {
          callback()
        } else {
          callback(new Error(i18next.t('ReportDataOption.selectDeptField')));
        }
      },
      trigger: 'change'
    }
  ],
  reporterEmptyUser: [
    {
      validator: (rule, value, callback) => {
        if(props.options.reporterEmpty != OwnerEmptyHandle.ASSIGNEE) {
          return callback()
        }

        const hasValue = (value || []).length > 0

        if(hasValue) {
          callback()
        } else {
          callback(new Error(i18next.t('ReportDataOption.addMember')));
        }
      }
    }
  ],
  reporterEmptyAdmin: [
    {
      validator: (rule, value, callback) => {
        if(props.options.reporterEmpty != OwnerEmptyHandle.ADMIN) {
          return callback()
        }

        if(value) {
          callback()
        } else {
          callback(new Error(i18next.t('ReportDataOption.addAdmin')));
        }
      },
    }
  ],
  targetTableUID: [
    {
      validator: (rule, value, callback) => {
        if(value) {
          callback()
        } else {
          callback(new Error(i18next.t('ReportDataOption.selectTargetForm')));
        }
      }
    }
  ]
})

const handleAddUser = (value) => {
  props.options.reporterEmptyUser = value.users[0].id
}

const containerAssigneeRef = ref(null)
const visibleAssigneeCount = ref(0)
const containerEmptyUserRef = ref(null)
const visibleEmptyUserCount = ref(0)

const allEmptyUserTags = computed(() => {
  const user = props.options.reporterEmptyUser || null
  const value = [
    {
      id: user,
      label: getUserDisplayName(organizeUtil.findUserById(user))
    }
  ].filter(item => item.label && item.id);
  if (isEmpty(value) && !isEmpty(user)) {
    props.options.reporterEmptyUser = null
  }
  return value;
})

const closeEmptyUserTag = () => {
  props.options.reporterEmptyUser = null
}

const updateAssigneeVisible = () => {
  visibleAssigneeCount.value = 1000000000
  nextTick(() => {
    const container = containerAssigneeRef.value
    if (!container) return

    const maxWidth = container.offsetWidth - 150
    let used = 0
    let count = 0
    const children = container.querySelectorAll(".tag-item-assignee")
    children.forEach((el) => {
      const w = el.offsetWidth + 8 // 包含 margin
      if (used + w <= maxWidth) {
        used += w
        count++
      }
    })
    visibleAssigneeCount.value = count
  })
}

const updateEmptyUserVisible = () => {
  visibleEmptyUserCount.value = 1000000000
  nextTick(() => {
    const container = containerEmptyUserRef.value
    if (!container) return

    const maxWidth = container.offsetWidth - 150
    let used = 0
    let count = 0
    const children = container.querySelectorAll(".tag-item-empty-user")
    children.forEach((el) => {
      const w = el.offsetWidth + 8 // 包含 margin
      if (used + w <= maxWidth) {
        used += w
        count++
      }
    })
    visibleEmptyUserCount.value = count
  })
}

const initFinshData = () => {
  props.options.finishCondition = props.options.finishCondition || {
    conditions: [[
      {
        type: FormConditionValueType.FORM,
        func: null,
        value: null,
        uid: null,
      }
    ]],
    sourceTables: [],
  }
}

onMounted(() => {
  nextTick(() => {
    if (containerAssigneeRef.value) {
      updateAssigneeVisible()
      const resizeObserver = new ResizeObserver(() => updateAssigneeVisible())
      resizeObserver.observe(containerAssigneeRef.value)
    }
    if(containerEmptyUserRef.value) {
      updateEmptyUserVisible()
      const resizeObserver = new ResizeObserver(() => updateEmptyUserVisible())
      resizeObserver.observe(containerEmptyUserRef.value)
    }

    hasDataFillingOption.value = !!document.querySelector(".data-filling-option")     
  })
})

watch(() => props.options?.reporter?.[ProcessNodeOwnerType.ASSIGNEE], () => {
  nextTick(() => {
    updateAssigneeVisible()
  })
},{ deep: true })

watch(() => props.options?.reporterEmptyUser, () => {
  nextTick(() => {
    updateEmptyUserVisible()
  })
},{ deep: true })

const targetFormOption = computed(() => {
  return getNocodeMainTableOptions(nocode.value?.body, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
  }).filter(item => {
    if (item.isCrossApp) {
      return true
    }
    return canReadNocodeTableDataByBody(
      nocode.value.body,
      item.value,
      organizeUtil?.departments || [],
    )
  }).map(item => {
    return {
      label: item.label,
      value: item.value
    }
  })
})

const changeTargetTable = () => {
  props.options.finishCondition.sourceTables = []
  props.options.finishCondition.conditions = []
}

const getTargetTable = computed(() => {
  return getNocodeDataSourceTableByUID(nocode.value?.body, props.options?.targetTableUID, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)?.table || {}
})

const save = async () => {
  const valid = await operatorRef.value?.validate()
  let validDataSource = true
  let validCondition = true
  if (props.options.requireSatisfyCondition) {
    validDataSource = await dataSourceFormRef.value?.validate()
    validCondition = await conditionItemRef.value?.validate()
  }
  
  return new Promise((resolve, reject) => {
    formRef.value?.validate((isValid) => {
      if (isValid && valid && validCondition && validDataSource) {
        resolve(true)
      } else {
        resolve(false)
      }
    })
  })
}
defineExpose({
  save,
})
</script>

<style lang='scss' scoped>
.data-filling-option {
  width: 100%;
  height: 100%;
  padding: 12px;

  :deep(.el-tabs) {
    .el-tabs__header {
      display: flex !important;
      border-radius: 4px;
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
  }

  :deep(.el-select) {
    .el-select__wrapper {
      box-shadow: none;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
    }
  }

  .reporter-option {
    width: 100%;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--border-color);

    .checkbox-container {
      padding: 12px 16px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      display: flex;
      flex-wrap: wrap;

      .el-form-item {
        flex: 0 0 33%;
        box-sizing: border-box;
        margin-bottom: 0px;
      }
    }

    .reporter-option-item {
      margin: 16px 0px;

      .title {
        
        font-weight: 500;
        font-style: Medium;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
        display: flex;
        align-items: center;
        color: var(--text-color-regular);

        .user {
          margin-right:  4px;
          font-size: 16px;
        }

        .delete {
          margin-left: auto;
          color: var(--text-color-secondary);
          font-size: 16px; 
          cursor: pointer;
        }
      }

      .container {
        height: 48px;
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
        margin-top: 8px;
        padding: 8px;
        display: flex;
        gap: 8px;
        width: 100%;

        .add-button {
          background-color: var(--color-white);
          min-width: 68px;
          height: 32px;
          border-radius: 4px;
          display: flex;
          justify-content: center;
          align-items: center;
          
          font-weight: 400;
          
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          text-align: right;
          color: var(--color-primary);
          cursor: pointer;

          .el-icon {
            margin-right: 3px;
          }
        }

        :deep(.el-tag) {
          height: 32px;
          border: none;
          background-color: var(--color-white);
          
          .el-tag__content {
            
            font-weight: 400;
            
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%;
            color: var(--text-color-regular);
            text-align: right;
          }

          .el-tag__close {
            color: var(--text-color-regular);

            &:hover {
              background-color: var(--bg-color-overlay);
            }
          }
        }
      }

      .select-container {
        margin-top: 8px;
        display: flex;
        align-items: center;
        width: 100%;

        :deep(.el-select) {
          flex: 1;

          .el-select__wrapper {
            background-color: var(--bg-color-overlay);
            overflow: hidden;
            box-shadow: none;
            border-radius: 4px;
          }
        }
      }
    }
  }

  :deep(.empty-reporter) {
    .el-form-item__content {
      display: block;
    }
    .reporter-option-item {
      .title {
        
        font-weight: 500;
        font-style: Medium;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
        display: flex;
        align-items: center;
        color: var(--text-color-regular);
      }

      .container {
        height: 48px;
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
        margin-top: 8px;
        padding: 8px;
        display: flex;
        gap: 8px;

        .add-button {
          background-color: var(--color-white);
          min-width: 68px;
          height: 32px;
          border-radius: 4px;
          display: flex;
          justify-content: center;
          align-items: center;
          
          font-weight: 400;
          
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          text-align: right;
          color: var(--color-primary);
          cursor: pointer;

          .el-icon {
            margin-right: 3px;
          }
        }

        .el-tag {
          height: 32px;
          border: none;
          background-color: var(--color-white);
          
          .el-tag__content {
            
            font-weight: 400;
            
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%;
            color: var(--text-color-regular);
            text-align: right;
          }

          .el-tag__close {
            color: var(--text-color-regular);

            &:hover {
              background-color: var(--bg-color-overlay);
            }
          }
        }
      }

      .select-container {
        margin-top: 8px;
        display: flex;
        align-items: center;

        .el-select {
          flex: 1;

          .el-select__wrapper {
            background-color: var(--bg-color-overlay);
            overflow: hidden;
            box-shadow: none;
            border-radius: 4px;
          }
        }
      }
    }

    .empty-reporter-item {
      margin-top: 12px;
    }
  }

  hr {
    border: none;
    margin: 24px 0px 0px;
  }

  .select-header {
    display: flex;
    font-size: 13px;

    .mode {
      color: var(--text-color-secondary);
    }

    .switch-btn {
      margin-left: auto;
      cursor: pointer;
      display: flex;
      align-items: center;
      color: var(--color-primary);

      .el-icon {
        margin-right: 4px;
      }
    }
  }

  .tip {
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    color: var(--text-color-secondary);
  }

  :deep(.el-form-item__error) {
    position: unset;
  }
}
</style>
