<template>
  <el-form class="filler-option" :model="props.nodeOwner" :rules="rules" ref="formRef">
    <div class="checkbox-container" v-if="props.isMultiple">
      <el-form-item>
        <el-checkbox :label="$t('OperatorOption.submitterSelf')" v-model="isSubmitter"/>
      </el-form-item>
      <el-form-item>
        <el-checkbox :label="$t('OperatorOption.specifiedMemberRole')" v-model="isAssignee"/>
      </el-form-item>
      <el-form-item>
        <el-checkbox :label="$t('OperatorOption.deptManager')" v-model="isDepartmentManager"/>
      </el-form-item>
      <el-form-item>
        <el-checkbox :label="$t('OperatorOption.formMemberField')" v-model="isFormMember"/>
      </el-form-item>
      <el-form-item>
        <el-checkbox :label="$t('OperatorOption.formDeptField')" v-model="isFormDepartment"/>
      </el-form-item>
    </div>
    <div class="radio-container" v-else>
      <el-form-item>
        <el-radio-group :modelValue="currentSubmitter" @update:modelValue="(val) => changeCheck(val)">
          <el-radio value="isSubmitter">{{ $t('OperatorOption.submitterSelf') }}</el-radio>
          <el-radio value="isAssignee">{{ $t('OperatorOption.specifiedMemberRole') }}</el-radio>
          <el-radio value="isDepartmentManager">{{ $t('OperatorOption.deptManager') }}</el-radio>
          <el-radio value="isFormMember">{{ $t('OperatorOption.formMemberField') }}</el-radio>
          <el-radio value="isFormDepartment">{{ $t('OperatorOption.formDeptField') }}</el-radio>
        </el-radio-group>
      </el-form-item>
    </div>
    <draggable
      v-if="selectedOwnerTypes.length"
      v-model="selectedOwnerTypes"
      item-key="type"
      handle=".move"
      chosen-class="dragging"
      :component-data="{ class: 'filler-option-sortable' }"
      animation="300"
      delay="60"
    >
      <template #item="{ element }">
        <div>
          <div class="filler-option-item" v-if="element.type === ProcessNodeOwnerType.SUBMITTER">
            <span class="title">
              <el-icon class="user">
                <i-ep-user/>
              </el-icon>
              {{ $t('OperatorOption.submitterSelf') }}
              <span class="icons">
                <el-icon class="move" v-if="Object.keys(selectedOwnerTypes)?.length > 1">
                  <i-icon-park-outline-drag />
                </el-icon>
                <el-icon class="delete" @click="isSubmitter = false">
                  <i-ep-delete/>
                </el-icon>
              </span>
            </span>
          </div>
          <div class="filler-option-item" v-else-if="element.type === ProcessNodeOwnerType.ASSIGNEE">
            <span class="title">
              <el-icon class="user">
                <i-ep-user/>
              </el-icon>
              {{ $t('OperatorOption.specifiedMemberRole') }}
              <span class="icons">
                <el-icon class="move" v-if="Object.keys(selectedOwnerTypes)?.length > 1">
                  <i-icon-park-outline-drag />
                </el-icon>
                <el-icon class="delete" @click="isAssignee = false">
                  <i-ep-delete/>
                </el-icon>
              </span>
            </span>
            <el-form-item :prop="`${ProcessNodeOwnerType.ASSIGNEE}`">
              <div class="container" ref="containerAssigneeRef">
                <div class="add-button" @click="openUserDialog">
                  <el-icon>
                    <i-ep-plus />
                  </el-icon>
                  {{ $t('OperatorOption.add') }}
                </div>

                <!-- 可见部分 -->
                <template v-for="(item, index) in allAssigneeTags" :key="item.type + '-' + item.id">
                  <el-tag v-if="index < visibleAssigneeCount" closable class="tag-item-assignee" @close="closeAssigneeTag(item.type, item.id)">
                    {{ item.label }}
                  </el-tag>
                </template>

                <!-- 折叠部分 -->
                <el-tag
                  v-if="visibleAssigneeCount < allAssigneeTags.length"
                  class="tag-item-assignee"
                  type="info"
                >
                  ...
                </el-tag>
              </div>
            </el-form-item>
          </div>
          <div class="filler-option-item" v-else-if="element.type === ProcessNodeOwnerType.DEPARTMENT_MANAGER && props.nodeOwner?.[ProcessNodeOwnerType.DEPARTMENT_MANAGER]?.mode">
            <span class="title">
              <el-icon class="user">
                <i-ep-user/>
              </el-icon>
              {{ $t('OperatorOption.deptManager') }}
              <span class="icons">
                <el-icon class="move" v-if="Object.keys(selectedOwnerTypes)?.length > 1">
                  <i-icon-park-outline-drag />
                </el-icon>
                <el-icon class="delete" @click="isDepartmentManager = false">
                  <i-ep-delete/>
                </el-icon>
              </span>
            </span>
            <div class="select-container">
              <span style="margin-right: 8px;">{{ $t('OperatorOption.submitterOf') }}</span>
              <el-select
                :placeholder="$t('OperatorOption.selectDeptManager')"
                v-model="props.nodeOwner[ProcessNodeOwnerType.DEPARTMENT_MANAGER].value"
                :teleported="true"
                v-if="hasDataFillingOption"
              >
                <template #header>
                  <div class="select-header">
                    <div class="mode">
                      {{ props.nodeOwner?.[ProcessNodeOwnerType.DEPARTMENT_MANAGER]?.mode === 'up' ? $t('OperatorOption.selectFromDirectDeptManagerUp') : $t('OperatorOption.selectFromTopDeptManagerDown') }}
                    </div>

                    <div
                      @click="switchDepartmentManagerMode"
                      class="switch-btn"
                    >
                      <el-icon>
                        <i-ep-switch/>
                      </el-icon>
                      {{ props.nodeOwner?.[ProcessNodeOwnerType.DEPARTMENT_MANAGER]?.mode === 'up' ? $t('OperatorOption.switchToTopDeptDown') : $t('OperatorOption.switchToDirectDeptUp') }}
                    </div>
                  </div>
                </template>
                <el-option
                  v-for="(item, index) in 21"
                  :label="getDepartmentManagerOptionName(props.nodeOwner?.[ProcessNodeOwnerType.DEPARTMENT_MANAGER]?.mode,index)"
                  :value="index"
                />
              </el-select>
            </div>
          </div>
          <div class="filler-option-item" v-else-if="element.type === ProcessNodeOwnerType.FORM_MEMBER">
            <span class="title">
              <el-icon class="user">
                <i-ep-user/>
              </el-icon>
              {{ $t('OperatorOption.formMemberField') }}
              <span class="icons">
                <el-icon class="move" v-if="Object.keys(selectedOwnerTypes)?.length > 1">
                  <i-icon-park-outline-drag />
                </el-icon>
                <el-icon class="delete" @click="isFormMember = false">
                  <i-ep-delete/>
                </el-icon>
              </span>
            </span>
            <el-form-item :prop="`${ProcessNodeOwnerType.FORM_MEMBER}`">
              <div class="select-container">
                <el-select
                  :placeholder="$t('OperatorOption.selectFormMemberField')"
                  multiple
                  v-model="filterFormMember"
                >
                  <el-option
                    v-for="field in formFields.filter(item => item?.meta?.extra?.widgetType === 'widget.form.memberSelect')"
                    :label="field.alias"
                    :value="field.uid"
                  />
                </el-select>
              </div>
            </el-form-item>
          </div>
          <div class="filler-option-item" v-else-if="element.type === ProcessNodeOwnerType.FORM_DEPARTMENT">
            <span class="title">
              <el-icon class="user">
                <i-ep-user/>
              </el-icon>
              {{ $t('OperatorOption.formDeptField') }}
              <span class="icons">
                <el-icon class="move" v-if="Object.keys(selectedOwnerTypes)?.length > 1">
                  <i-icon-park-outline-drag />
                </el-icon>
                <el-icon
                  class="delete"
                  @click="isFormDepartment = false"
                >
                  <i-ep-delete/>
                </el-icon>
              </span>
            </span>
            <el-form-item :prop="`${ProcessNodeOwnerType.FORM_DEPARTMENT}`">
              <div class="select-container">
                <el-select
                  :placeholder="$t('OperatorOption.selectFormDeptField')"
                  v-model="filterFormDepartment"
                >
                  <el-option
                    v-for="field in formFields.filter(item => item?.meta?.extra?.widgetType === 'widget.form.departmentSelect')"
                    :label="field.alias"
                    :value="field.uid"
                  />
                </el-select>
                <span style="margin-left: 8px;">{{ $t('OperatorOption.managerOf') }}</span>
              </div>
            </el-form-item>
          </div>
        </div>
      </template>
    </draggable>
  </el-form>
  <organize-manager-dialog
    :tableList="{
      departments: [],
      roles: props.nodeOwner?.[ProcessNodeOwnerType.ASSIGNEE]?.roles?.map(roleId => organizeUtil.roles?.find(role => role.id === roleId))?.filter(Boolean) || [],
      users: props.nodeOwner?.[ProcessNodeOwnerType.ASSIGNEE]?.users?.map(userId => organizeUtil.findUserById(userId))?.filter(Boolean) || [],
      dynamic: [],
    }"
    @confirm="handleAddRoleUser"
    :dialogTitle="$t('OperatorOption.specifiedMemberRole')"
    :isInOption="true"
    :hideDepartmentTab="true"
    ref="selectRoleUserRef"
    :multiple="props.isMultiple"
  />
</template>

<script lang='ts' setup>
import { ProcessNodeOwnerType, ProcessNodeOwner } from '@common/types/project';
import { FormInstance, FormRules } from 'element-plus';
import { ref, reactive, computed, inject, onMounted, nextTick, watch } from 'vue';
import { ORGANIZE_UTIL } from '@renderer/types';
import { isEmpty } from '@common/utils/object';
import { useFormFields } from '../../../hooks'
import i18next from 'i18next';
import { getUserDisplayName } from '@renderer/utils/other';
import draggable from 'vuedraggable';

const organizeUtil = inject(ORGANIZE_UTIL);
const props = withDefaults(defineProps<{
  nodeOwner: ProcessNodeOwner,
  isMultiple: boolean
}>(), {
  isMultiple: true
})

const emit = defineEmits<{
  (event: "update:nodeOwner", value: ProcessNodeOwner),
}>();

const formFields = useFormFields();
const selectRoleUserRef = ref(null)
const formRef = ref<FormInstance>();
const hasDataFillingOption = ref(false)

const defaultOwnerOrder = [
  ProcessNodeOwnerType.SUBMITTER,
  ProcessNodeOwnerType.ASSIGNEE,
  ProcessNodeOwnerType.DEPARTMENT_MANAGER,
  ProcessNodeOwnerType.FORM_MEMBER,
  ProcessNodeOwnerType.FORM_DEPARTMENT,
]

const isOwnerSelected = (type: ProcessNodeOwnerType) => {
  if (type === ProcessNodeOwnerType.SUBMITTER) {
    return Boolean(props.nodeOwner?.[type])
  }
  return type in (props.nodeOwner ?? {})
}

const ensureOwnerOrder = () => {
  if (!props.nodeOwner) {
    return []
  }
  const sourceOrder = Array.isArray(props.nodeOwner.ownerOrder)
    ? props.nodeOwner.ownerOrder
    : defaultOwnerOrder
  const order = sourceOrder.filter(type => defaultOwnerOrder.includes(type) && isOwnerSelected(type))
  const missingTypes = defaultOwnerOrder.filter(type => isOwnerSelected(type) && !order.includes(type))
  props.nodeOwner.ownerOrder = [...order, ...missingTypes]
  return props.nodeOwner.ownerOrder
}

const addOwnerOrder = (type: ProcessNodeOwnerType) => {
  const order = ensureOwnerOrder()
  if (!order.includes(type)) {
    order.push(type)
  }
}

const removeOwnerOrder = (type: ProcessNodeOwnerType) => {
  if (Array.isArray(props.nodeOwner?.ownerOrder)) {
    props.nodeOwner.ownerOrder = props.nodeOwner.ownerOrder.filter(item => item !== type)
  }
}

const selectedOwnerTypes = computed({
  get: () => ensureOwnerOrder().filter(type => isOwnerSelected(type)).map(type => ({ type })),
  set: (value) => {
    props.nodeOwner.ownerOrder = value.map(item => item.type).filter(type => isOwnerSelected(type))
  }
})


const rules = reactive<FormRules<ProcessNodeOwner>>({
  [`${ProcessNodeOwnerType.ASSIGNEE}`]: [
    {
      validator: (rule, value, callback) => {
        // value 就是 options.filler[ASSIGNEE] 对象
        if (!value) {
          return callback();
        }
        const hasAssignee = allAssigneeTags.value?.length > 0
        if (hasAssignee) {
          callback(); // 校验通过
        } else {
          callback(new Error(i18next.t('OperatorOption.selectRoleOrUser')));
        }
      },
      trigger: 'change'
    }
  ],
  [`${ProcessNodeOwnerType.FORM_MEMBER}`]: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          return callback();
        }
        const hasMember = value.length > 0
        if(hasMember) {
          callback()
        } else {
          callback(new Error(i18next.t('OperatorOption.selectMemberField')));
        }
      },
      trigger: 'change'
    }
  ],
  [`${ProcessNodeOwnerType.FORM_DEPARTMENT}`]: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          return callback();
        }
        const hasDepart = value.value != null
        if(hasDepart) {
          callback()
        } else {
          callback(new Error(i18next.t('OperatorOption.selectDeptField')));
        }
      },
      trigger: 'change'
    }
  ],
})

const isDepartmentManager = computed({
  get: () => ProcessNodeOwnerType.DEPARTMENT_MANAGER in (props.nodeOwner ?? {}),
  set: (val: boolean) => {
    // if (!props.nodeOwner) {
    //   props.nodeOwner = {} as Record<ProcessNodeOwnerType, any>
    // }
    if (val) {
      props.nodeOwner[ProcessNodeOwnerType.DEPARTMENT_MANAGER] = {
        mode: 'up',
        value: 0
      }
      addOwnerOrder(ProcessNodeOwnerType.DEPARTMENT_MANAGER)
    } else {
      delete props.nodeOwner[ProcessNodeOwnerType.DEPARTMENT_MANAGER]
      removeOwnerOrder(ProcessNodeOwnerType.DEPARTMENT_MANAGER)
    }
  }
})

const isSubmitter = computed({
  get: () => {
    if(ProcessNodeOwnerType.SUBMITTER in (props.nodeOwner ?? {})) {
      return props.nodeOwner[ProcessNodeOwnerType.SUBMITTER]
    } else {
      return false
    }
  },
  set: (val: boolean) => {
    // if (!props.nodeOwner) {
    //   props.nodeOwner = {} as Record<ProcessNodeOwnerType, any>
    // }
    props.nodeOwner[ProcessNodeOwnerType.SUBMITTER] = val
    if (val) {
      addOwnerOrder(ProcessNodeOwnerType.SUBMITTER)
    } else {
      removeOwnerOrder(ProcessNodeOwnerType.SUBMITTER)
    }
  }
})

const isAssignee = computed({
  get: () => {
    return ProcessNodeOwnerType.ASSIGNEE in (props.nodeOwner ?? {});
  },
  set: (val: boolean) => {
    // if (!props.nodeOwner) {
    //   props.nodeOwner = {} as Record<ProcessNodeOwnerType, any>
    // }
    if (val) {
      props.nodeOwner[ProcessNodeOwnerType.ASSIGNEE] = {
        roles: [],
        users: []
      }
      addOwnerOrder(ProcessNodeOwnerType.ASSIGNEE)
    } else {
      delete props.nodeOwner[ProcessNodeOwnerType.ASSIGNEE]
      removeOwnerOrder(ProcessNodeOwnerType.ASSIGNEE)
    }
  }
})

const isFormMember = computed({
  get: () => ProcessNodeOwnerType.FORM_MEMBER in (props.nodeOwner ?? {}),
  set: (val) => {
    // if (!props.nodeOwner) {
    //   props.nodeOwner = {}
    // }
    if (val) {
      props.nodeOwner[ProcessNodeOwnerType.FORM_MEMBER] = []
      addOwnerOrder(ProcessNodeOwnerType.FORM_MEMBER)
    } else {
      delete props.nodeOwner[ProcessNodeOwnerType.FORM_MEMBER]
      removeOwnerOrder(ProcessNodeOwnerType.FORM_MEMBER)
    }
  }
})

const isFormDepartment = computed({
  get: () => ProcessNodeOwnerType.FORM_DEPARTMENT in (props.nodeOwner ?? {}),
  set: (val) => {
    if (val) {
      props.nodeOwner[ProcessNodeOwnerType.FORM_DEPARTMENT] = {
        value: null,
        level: 0
      }
      addOwnerOrder(ProcessNodeOwnerType.FORM_DEPARTMENT)
    } else {
      delete props.nodeOwner[ProcessNodeOwnerType.FORM_DEPARTMENT]
      removeOwnerOrder(ProcessNodeOwnerType.FORM_DEPARTMENT)
    }
  }
})

const switchDepartmentManagerMode = () => {
  props.nodeOwner[ProcessNodeOwnerType.DEPARTMENT_MANAGER].value = 0
  if(props.nodeOwner[ProcessNodeOwnerType.DEPARTMENT_MANAGER].mode === 'up') {
    props.nodeOwner[ProcessNodeOwnerType.DEPARTMENT_MANAGER].mode = 'down'
  } else {
    props.nodeOwner[ProcessNodeOwnerType.DEPARTMENT_MANAGER].mode = 'up'
  }
}

const getDepartmentManagerOptionName = (mode, value) => {
  const text = mode === 'up' ? i18next.t('OperatorOption.directDeptManager') : i18next.t('OperatorOption.topDeptManager')
  if(value === 0) {
    return text
  } else {
    return `${text}${mode === 'up' ? i18next.t('OperatorOption.plus') : i18next.t('OperatorOption.minus')} ${value} ${i18next.t('OperatorOption.levelDept')}`
  }
}

const openUserDialog = () => {
  selectRoleUserRef.value.show()
}

const containerAssigneeRef = ref(null)
const visibleAssigneeCount = ref(0)
const containerEmptyUserRef = ref(null)
const visibleEmptyUserCount = ref(0)

const allAssigneeTags = computed(() => {
  const roles = props.nodeOwner?.[ProcessNodeOwnerType.ASSIGNEE]?.roles || []
  const users = props.nodeOwner?.[ProcessNodeOwnerType.ASSIGNEE]?.users || []
  const value = [
    ...roles.map(id => ({
      type: "role",
      id,
      label: organizeUtil.roles.find(r => r.id === id)?.name
    })),
    ...users.map(id => ({
      type: "user",
      id,
      label: getUserDisplayName(organizeUtil.findUserById(id))
    }))
  ].filter(item => item.label);
  if (isEmpty(value) && (!isEmpty(roles) || !isEmpty(users))) {
    props.nodeOwner[ProcessNodeOwnerType.ASSIGNEE] = {
      roles: [],
      users: [],
    }
  }
  return value
})

const closeAssigneeTag = (type, id) => {
  if(type == 'user') {
    props.nodeOwner[ProcessNodeOwnerType.ASSIGNEE].users = props.nodeOwner?.[ProcessNodeOwnerType.ASSIGNEE]?.users.filter(item => item != id)
  } else {
    props.nodeOwner[ProcessNodeOwnerType.ASSIGNEE].roles = props.nodeOwner?.[ProcessNodeOwnerType.ASSIGNEE]?.roles.filter(item => item != id)
  }
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

    hasDataFillingOption.value = !!document.querySelector(".filler-option")     
  })
  if (!props.nodeOwner) {
    emit('update:nodeOwner', {});
  }
})

const filterFormMember = computed({
  get:() => {
    const field = formFields.value.filter(item => item?.meta?.extra?.widgetType === 'widget.form.memberSelect')
    return (props.nodeOwner[ProcessNodeOwnerType.FORM_MEMBER] ?? []).filter(item => field.some(f => f.uid === item))
  },
  set:(val) => {
    props.nodeOwner[ProcessNodeOwnerType.FORM_MEMBER] = val
  }
})

const filterFormDepartment = computed({
  get:() => {
    const field = formFields.value.filter(item => item?.meta?.extra?.widgetType === 'widget.form.departmentSelect')
    if(field.some(field => field.uid === props.nodeOwner[ProcessNodeOwnerType.FORM_DEPARTMENT].value)) {
      return props.nodeOwner[ProcessNodeOwnerType.FORM_DEPARTMENT].value
    }
    return null
  },
  set:(val) => {
    props.nodeOwner[ProcessNodeOwnerType.FORM_DEPARTMENT].value = val
  }
})

const handleAddRoleUser = (value) => {
  props.nodeOwner[ProcessNodeOwnerType.ASSIGNEE].roles = []
  props.nodeOwner[ProcessNodeOwnerType.ASSIGNEE].users = []

  for(const item of value.roles) {
    props.nodeOwner[ProcessNodeOwnerType.ASSIGNEE].roles.push(item.id)
  }

  for(const item of value.users) {
    props.nodeOwner[ProcessNodeOwnerType.ASSIGNEE].users.push(item.id)
  }
}

watch(() => props.nodeOwner?.[ProcessNodeOwnerType.ASSIGNEE], () => {
  nextTick(() => {
    updateAssigneeVisible()
  })
},{ deep: true })

const refsMap = {
  isSubmitter,
  isAssignee,
  isDepartmentManager,
  isFormMember,
  isFormDepartment
}

const currentSubmitter = computed(() => {
  for (const key in refsMap) {
    if(refsMap[key].value) {
      return key
    }
  }
})

const changeCheck = (val) => {
  if(currentSubmitter.value === val) {
    return
  }
  for (const key in refsMap) {
    if(key === val) {
      refsMap[key].value = true
    } else {
      refsMap[key].value = false
    }
  }
}

const validate = async () => {
  return new Promise((resolve, reject) => {
    formRef.value?.validate((isValid) => {
      if (isValid) {
        resolve(true)
      } else {
        resolve(false)
      }
    })
  })
}
defineExpose({
  validate,
})
</script>

<style lang='scss' scoped>
// .data-filling-option {
//   width: 100%;
//   height: 100%;
//   padding: 12px;

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

  .filler-option {
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

    .radio-container {
      padding: 12px 16px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;

      .el-form-item {
        margin-bottom: 0px;
      }

      .el-radio-group {
        display: flex;
        flex-wrap: wrap;

        .el-radio {
          flex: 0 0 33%;
          box-sizing: border-box;
          margin: 0px;
        }
      }
    }

    .filler-option-item {
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


        .icons {
          margin-left: auto;
          .delete {
            color: var(--text-color-secondary);
            font-size: 16px; 
            cursor: pointer;
          }
  
          .move {
            margin-right: 8px;
            color: var(--text-color-secondary);
            font-size: 16px;
            cursor: move;
          }
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

  :deep(.empty-filler) {
    .el-form-item__content {
      display: block;
    }
    .filler-option-item {
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

    .empty-filler-item {
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

  :deep(.option-item) {
    .title {
      font-weight: 500;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
    }
  }

  :deep(.el-form-item__error) {
    position: unset;
  }
// }
</style>
