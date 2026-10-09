<template>
  <el-form class="approval-option" :model="options" :rules="rules" ref="formRef">
    <option-item :title="$t('ApprovalOption.approvalType')">
      <el-form-item prop="changeType" class="approval-type">
        <el-radio-group class="data-change-checkbox-group" v-model="(props.options.category as any)">
          <el-radio v-for="item in ApprovalCategory" :key="item" :value="item">{{ textMapping[item] }}</el-radio>
        </el-radio-group>
        <el-divider direction="vertical" v-if="props.options.category === ApprovalCategory.MANUAL"/>
        <el-select
          style="width: 86px"
          v-if="props.options.category === ApprovalCategory.MANUAL"
          v-model="props.options.categoryRule" 
        >
          <el-option
            v-for="(item, index) in ApprovalCategoryRule"
            :value="item"
            :label="item === ApprovalCategoryRule.NORMAL ? $t('ApprovalOption.normalApproval') : $t('ApprovalOption.levelByLevelApproval')"
          />
        </el-select>
      </el-form-item>
      <el-tabs v-if="props.options.category === ApprovalCategory.MANUAL">

        <el-tab-pane :label="$t('ApprovalOption.approver')">
          <option-item :title="$t('ApprovalOption.approver')">
            <operator-option
              v-model:nodeOwner="props.options.approver"
              v-if="props.options.categoryRule === ApprovalCategoryRule.NORMAL"
              ref="operatorRef"
            />

            <div class="approver-option" v-else>
              <div class="checkbox-container">
                <el-form-item>
                  <el-checkbox :label="$t('ApprovalOption.continuousMultiDeptManager')" v-model="isMultiLevelDepartmentManager"/>
                </el-form-item>
              </div>
              <div class="approver-option-item" v-if="isMultiLevelDepartmentManager">
                <span class="title">
                  <el-icon class="user">
                    <i-ep-user/>
                  </el-icon>
                  {{ $t('ApprovalOption.approvalEndPoint') }}
                </span>
                <div class="select-container">
                  <span style="margin-right: 8px;">{{ $t('ApprovalOption.submitterOf') }}</span>
                  <el-select
                    :placeholder="$t('ApprovalOption.selectDeptManager')"
                    v-model="props.options.approver[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER].value"
                    :teleported="true"
                    append-to="body"
                  >
                    <template #header>
                      <div class="select-header">
                        <div class="mode">
                          {{ props.options?.approver?.[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]?.mode === 'up' ? $t('ApprovalOption.selectFromDirectDeptManagerUp') : $t('ApprovalOption.selectFromTopDeptManagerDown') }}
                        </div>

                        <div
                          @click="switchMultiLevelDepartmentManagerMode"
                          class="switch-btn"
                        >
                          <el-icon>
                            <i-ep-switch/>
                          </el-icon>
                          {{ props.options?.approver?.[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]?.mode === 'up' ? $t('ApprovalOption.switchToTopDeptDown') : $t('ApprovalOption.switchToDirectDeptUp') }}
                        </div>
                      </div>
                    </template>
                    <el-option
                      v-for="(item, index) in 21"
                      :label="getDepartmentManagerOptionName(props.options?.approver?.[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]?.mode,index)"
                      :value="index"
                    />
                  </el-select>
                </div>
              </div>
            </div>
          </option-item>

          <hr>

          <option-item :title="$t('ApprovalOption.multiApproverMode')" v-if="props.options.categoryRule === ApprovalCategoryRule.NORMAL">
            <el-form-item>
              <el-radio-group v-model="props.options.approverType" class="vertical-radio">
                <el-radio :value="ApproverType.AND">{{ $t('ApprovalOption.jointApproval') }}</el-radio>
                <el-radio :value="ApproverType.OR">{{ $t('ApprovalOption.eitherApproval') }}</el-radio>
                <el-radio :value="ApproverType.SEQUENTIAL">{{ $t('ApprovalOption.sequentialApproval') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </option-item>

          <option-item :title="$t('ApprovalOption.approvalPersonIsNull')">
            <el-form-item class="empty-approver">
              <el-radio-group v-model="props.options.approverEmpty">
                <el-radio :value="OwnerEmptyHandle.AUTO_APPROVE">{{ $t('ApprovalOption.autoApproval') }}</el-radio>
                <el-radio :value="OwnerEmptyHandle.ASSIGNEE">{{ $t('ApprovalOption.specifiedPersonApproval') }}</el-radio>
                <el-radio :value="OwnerEmptyHandle.ADMIN">{{ $t('ApprovalOption.transferToAdmin') }}</el-radio>
              </el-radio-group>

              <div class="approver-option-item empty-approver-item" v-if="props.options.approverEmpty === OwnerEmptyHandle.ASSIGNEE">
                <span class="title">
                  {{ $t('ApprovalOption.specifiedMember') }}
                </span>
                <el-form-item prop="approverEmptyUsers">
                  <div class="container" ref="containerEmptyUserRef">
                    <div class="add-button" @click="openOrganizeDialog()">
                      <el-icon>
                        <i-ep-plus/>
                      </el-icon>
                      {{ $t('ApprovalOption.add') }}
                    </div>

                    <!-- 可见部分 -->
                    <template v-for="(item, index) in allEmptyUserTags" :key="'empty-' + item.id">
                      <el-tag v-if="index < visibleEmptyUserCount" closable class="tag-item-empty-user" @close="closeEmptyUserTag(item.id)">
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
              <div class="approver-option-item empty-approver-item" v-if="props.options.approverEmpty === OwnerEmptyHandle.ADMIN">
                <span class="title">
                  {{ $t('ApprovalOption.selectAdmin') }}
                </span>
                <el-form-item prop="approverEmptyAdmin">
                  <div class="select-container">
                    <el-select
                      :placeholder="$t('ApprovalOption.pleaseSelectAdmin')"
                      v-model="props.options.approverEmptyAdmin"
                    >
                      <el-option
                        v-for="item in organizeUtil.users.filter(item => item.isAdmin)"
                        :label="item.realname"
                        :value="item.id"
                      />

                      <el-option
                        :label="$t('ApprovalOption.superAdmin')"
                        :value="organizeUtil.users.find(item => item.realname === ADMIN_USERNAME)?.id"
                      />
                    </el-select>
                  </div>
                </el-form-item>
              </div>
            </el-form-item>
          </option-item>

          <option-item :title="$t('ApprovalOption.sameApproverAndSubmitter')">
            <el-form-item>
              <el-radio-group v-model="props.options.approverSameAsSubmitter">
                <el-radio :value="ApproverSameAsSubmitter.SELF">{{ $t('ApprovalOption.submitterApproveSelf') }}</el-radio>
                <el-radio :value="ApproverSameAsSubmitter.DEPARTMENT_MANAGER">{{ $t('ApprovalOption.transferToDeptLeader') }}</el-radio>
                <el-radio :value="ApproverSameAsSubmitter.AUTO_SKIP">{{ $t('ApprovalOption.autoSkip') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </option-item>
        </el-tab-pane>

        <el-tab-pane :label="$t('ApprovalOption.formPermission')">
          <field-auth-option
            :requiredValue="props.options.requiredFieldAuth"
            @update:requiredValue="value => props.options.requiredFieldAuth = value"
          ></field-auth-option>
        </el-tab-pane>

        <el-tab-pane :label="$t('ApprovalOption.operationPermission')">
          <el-form-item>
            <el-checkbox v-model="props.options.allowTransfer" :label="$t('ApprovalOption.allowTransfer')"/>
          </el-form-item>
          <el-form-item class="range-option" prop="revertRange" v-if="props.options.allowTransfer">
            <el-radio-group v-model="isTransferRange">
              <el-radio :value="false">{{ $t('ApprovalOption.unlimitedRange') }}</el-radio>
              <el-radio :value="true">{{ $t('ApprovalOption.specifiedRange') }}</el-radio>
            </el-radio-group>
            <el-button
              style="width: 100%; border-radius: 4px;"
              v-if="isTransferRange"
              @click="openOrganizeDialog(true)"
            >
              {{ $t('ApprovalOption.setRange') }}
            </el-button>
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="props.options.allowRevert" :label="$t('ApprovalOption.allowRejectBack')"/>
          </el-form-item>
          <el-form-item class="range-option" prop="revertRange" v-if="props.options.allowRevert">
            <el-radio-group v-model="isRevertRange">
              <el-radio :value="false">{{ $t('ApprovalOption.unlimitedRange') }}</el-radio>
              <el-radio :value="true">{{ $t('ApprovalOption.specifiedRange') }}</el-radio>
            </el-radio-group>
            <el-select
              clearable
              :placeholder="$t('ApprovalOption.selectNode')"
              style="width: 100%"
              v-if="isRevertRange"
              v-model="props.options.revertRange"
              multiple 
            >
              <el-option
                v-for="item in nodeOption"
                :key="item.uid"
                :label="item.type === 'trigger-data-change' ? $t('ApprovalOption.submit') : item.options.name"
                :value="item.uid"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="props.options.allowReject" :label="$t('ApprovalOption.allowReject')"/>
          </el-form-item>
          <el-form-item class="range-option" v-if="props.options.allowReject">
            <el-checkbox v-model="isContinueAfterReject" :label="$t('ApprovalOption.continueAfterReject')"/>
            <el-select
              clearable
              :placeholder="$t('ApprovalOption.rejectSkipNodePlaceholder')"
              style="width: 100%"
              v-if="isContinueAfterReject"
              v-model="props.options.rejectSkipNodeIds"
              multiple
              collapse-tags
              collapse-tags-tooltip
            >
              <el-option
                v-for="item in rejectContinueNodeOptions"
                :key="item.uid"
                :label="getFlowOptionLabel(item)"
                :value="item.uid"
              />
            </el-select>
            <el-checkbox
              v-if="isContinueAfterReject"
              v-model="props.options.rollbackDataBeforeReject"
              :label="$t('ApprovalOption.rollbackDataBeforeReject')"
            />
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="props.options.allowStash" :label="$t('ApprovalOption.allowStash')"/>
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="props.options.allowFinishFlow" :label="$t('ApprovalOption.allowFinishFlow')"/>
          </el-form-item>
          <option-item :title="$t('ApprovalOption.approvalComment')">
            <el-form-item class="comment-option-required">
              <el-checkbox v-model="props.options.requireApprovalComments" :label="$t('ApprovalOption.mustFillCommentWhenSubmit')"/>
            </el-form-item>
          </option-item>
          <node-timeout-setting :node="props.node" :options="props.options" />
        </el-tab-pane>

      </el-tabs>
    </option-item>
  </el-form>
  <organize-manager-dialog 
    :tableList="tableList"
    @confirm="organizeDialogConfirm"
    :dialogTitle="dialogTitle"
    ref="selectUserRef"
    :isInWidget="isInWidget"
    :isSetting="isSetting"
    :isShowQuick="false"
  />
</template>

<script lang='ts' setup>
import { ProcessFlowOptions, ApprovalOptions, ApprovalCategory, ProcessNodeOwnerType, ApproverType, OwnerEmptyHandle, ApproverSameAsSubmitter, ApprovalCategoryRule, ProcessFlow, ProcessNodeType } from '@common/types/project';
import { FormInstance, FormRules } from 'element-plus';
import { ref, reactive, computed, inject, onMounted, nextTick, watch } from 'vue';
import { useRootBranch } from '../../hooks';
import { ORGANIZE_UTIL } from '@renderer/types';
import { unique } from '@common/utils/unique';
import { deepClone, isEmpty } from '@common/utils/object';
import { ADMIN_USERNAME } from "@common/types/account";
import i18next from 'i18next';
import { ProcessNode } from '../process';
import { getApprovalRejectSkipOptions, getApprovalRevertRangeOptions } from '../flow-rules';
import { getUserDisplayName } from '@renderer/utils/other';
import NodeTimeoutSetting from './component/NodeTimeoutSetting.vue';

const organizeUtil = inject(ORGANIZE_UTIL);
const props = defineProps<{
  node: ProcessNode,
  options: ProcessFlowOptions & ApprovalOptions,
}>();

const rootBranch = useRootBranch();
const selectUserRef = ref(null)
const operatorRef = ref(null)

const isInWidget = ref(false)
const isSetting = ref(false)
const dialogTitle = ref('')
const isRange = ref(false)
const tableList = ref({
  departments: [],
  roles: [],
  users: [],
  dynamic: [],
})

const resolveUsersByIds = (userIds = []) => {
  return (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .map(userId => organizeUtil?.findUserById(userId))
    .filter(Boolean)
}

const openOrganizeDialog = (_isRange = false) => {
  isRange.value = _isRange
  if(_isRange) {
    isInWidget.value = true
    isSetting.value = true
    dialogTitle.value = i18next.t('ApprovalOption.specifiedRange')
    tableList.value = {
      departments: props.options.transferRange.departments.map(deptId => organizeUtil.departments?.find(dept => dept.id === deptId))?.filter(Boolean) || [],
      roles: props.options.transferRange.roles.map(roleId => organizeUtil.roles?.find(role => role.id === roleId))?.filter(Boolean) || [],
      users: resolveUsersByIds(props.options.transferRange.users),
      dynamic: [],
    }
  } else {
    isInWidget.value = false
    isSetting.value = false
    dialogTitle.value = i18next.t('ApprovalOption.specifiedMember')
    tableList.value = {
      departments: [],
      roles: [],
      users: resolveUsersByIds(props.options?.approverEmptyUsers || []),
      dynamic: [],
    }
  }
  selectUserRef.value.show()
}

const isTransferRange = computed({
  get: () => 'transferRange' in (props.options ?? {}),
  set: (val) => {
    if (val) {
      props.options.transferRange = {
        users: [],
        departments: [],
        roles: [],
      }
    } else {
      delete props.options.transferRange
    }
  }
})

const isContinueAfterReject = computed({
  get: () => props.options.continueAfterReject === true,
  set: (val) => {
    props.options.continueAfterReject = val
    if (val && !Array.isArray(props.options.rejectSkipNodeIds)) {
      props.options.rejectSkipNodeIds = []
      return
    }
    if (!val) {
      delete props.options.rejectSkipNodeIds
      delete props.options.rollbackDataBeforeReject
    }
  }
})

const organizeDialogConfirm = (value) => {
  if(isRange.value) {
    props.options.transferRange = {
      users: value.users.map(user => user.id),
      departments: value.departments.map(dept => dept.id),
      roles: value.roles.map(role => role.id),
    }
  } else {
    props.options.approverEmptyUsers = value.users.map(user => user.id)
  }
}

const textMapping = {
  get [ApprovalCategory.AUTO_APPROVE]() {
    return i18next.t('ApprovalOption.autoApproval')
  },
  get [ApprovalCategory.AUTO_REJECT]() {
    return i18next.t('ApprovalOption.autoReject')
  },
  get [ApprovalCategory.MANUAL]() {
    return i18next.t('ApprovalOption.manualApproval')
  },
}

const findBranchByFlowUid = (branch, targetUid, path = []) => {
  let newPath = [...path];

  for (const flow of branch.flows) {
    let currentPath = [...newPath]
    
    if (flow.uid === targetUid) {
      return { found: true, path: currentPath };
    }

    currentPath = flow.type === "trigger-data-change" || flow.type === "approval"
        ? [...newPath, flow]
        : [...newPath];

    if (flow.branches) {
      for (const subBranch of flow.branches) {
        const result = findBranchByFlowUid(subBranch, targetUid, currentPath);
        if (result.found) {
          return result; // 找到直接返回
        } else {
          // 没找到保留当前子分支返回的路径
          newPath = [...newPath, ...result.path];
          
          const uidMap = {};
          newPath = newPath.filter(item => {
            if (!item.uid) return true; // 如果没有uid属性，保留
            if (uidMap[item.uid]) return false; // 如果已经存在相同uid，过滤掉
            uidMap[item.uid] = true; // 记录这个uid
            return true;
          });
        }
      }
    } else {
      // 没子分支，更新路径
      newPath = currentPath;
    }
  }
  return { found: false, path: newPath };
}

const nodeOption = computed(() => {
  const flowUID = props.node?.uid || '';
  const options = getApprovalRevertRangeOptions(rootBranch.value.getBranch().flows || [], flowUID);
  return options.map(item => {
    if (item.type !== ProcessNodeType.TRIGGER_DATA_CHANGE) {
      return item;
    }
    const flow = deepClone(item);
    flow.options.name = i18next.t('ApprovalOption.submit');
    return flow;
  });
})

const rejectContinueNodeOptions = computed(() => {
  const flowUID = props.node?.uid || '';
  return getApprovalRejectSkipOptions(rootBranch.value.getBranch().flows || [], flowUID);
})

const getFlowOptionLabel = (flow: ProcessFlow) => {
  if (flow.type === ProcessNodeType.TRIGGER_DATA_CHANGE) {
    return i18next.t('ApprovalOption.submit')
  }
  return flow?.options?.name || flow?.type || ''
}

const formRef = ref<FormInstance>();

const rules = reactive<FormRules<ApprovalOptions>>({
  [`approver.${ProcessNodeOwnerType.ASSIGNEE}`]: [
    {
      validator: (rule, value, callback) => {
        // value 就是 options.approver[ASSIGNEE] 对象
        if (!value) {
          return callback();
        }
        const hasRole = value.roles?.length > 0;
        const hasUser = value.users?.length > 0;

        if (hasRole || hasUser) {
          callback(); // 校验通过
        } else {
          callback(new Error(i18next.t('ApprovalOption.selectRoleOrUser')));
        }
      },
      trigger: 'change'
    }
  ],
  [`approver.${ProcessNodeOwnerType.FORM_MEMBER}`]: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          return callback();
        }
        const hasMember = value.length > 0
        if(hasMember) {
          callback()
        } else {
          callback(new Error(i18next.t('ApprovalOption.selectMemberField')));
        }
      },
      trigger: 'change'
    }
  ],
  [`approver.${ProcessNodeOwnerType.FORM_DEPARTMENT}`]: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          return callback();
        }
        const hasDepart = value.value != null
        if(hasDepart) {
          callback()
        } else {
          callback(new Error(i18next.t('ApprovalOption.selectDeptField')));
        }
      },
      trigger: 'change'
    }
  ],
  revertRange: [
    {
      validator: (rule, value, callback) => {
        if(!isRevertRange.value) {
          return callback()
        }
        const hasValue = value.length > 0
        if(hasValue) {
          callback()
        } else {
          callback(new Error(i18next.t('ApprovalOption.selectNode')));
        }
      }
    }
  ],
  approverEmptyUsers: [
    {
      validator: (rule, value, callback) => {
        if(props.options.approverEmpty != OwnerEmptyHandle.ASSIGNEE) {
          return callback()
        }

        const hasValue = (value || []).length > 0

        if(hasValue) {
          callback()
        } else {
          callback(new Error(i18next.t('ApprovalOption.addMember')));
        }
      }
    }
  ],
  approverEmptyAdmin: [
    {
      validator: (rule, value, callback) => {
        if(props.options.approverEmpty != OwnerEmptyHandle.ADMIN) {
          return callback()
        }

        if(value) {
          callback()
        } else {
          callback(new Error(i18next.t('ApprovalOption.addAdmin')));
        }
      },
    }
  ]
})

const isRevertRange = computed({
  get: () => 'revertRange' in (props.options ?? {}),
  set: (val) => {
    if (val) {
      props.options.revertRange = []
    } else {
      delete props.options.revertRange
    }
  }
})

const isMultiLevelDepartmentManager = computed({
  get: () => ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER in (props.options.approver ?? {}),
  set: (val: boolean) => {
    if (!props.options.approver) {
      props.options.approver = {} as Record<ProcessNodeOwnerType, any>
    }
    if (val) {
      props.options.approver[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER] = {
        mode: 'up',
        value: 0
      }
    } else {
      delete props.options.approver[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]
    }
  }
})

const switchMultiLevelDepartmentManagerMode = () => {
  props.options.approver[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER].value = 0
  if(props.options.approver[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER].mode === 'up') {
    props.options.approver[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER].mode = 'down'
  } else {
    props.options.approver[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER].mode = 'up'
  }
}

const getDepartmentManagerOptionName = (mode, value) => {
  const text = mode === 'up' ? i18next.t('ApprovalOption.directDeptManager') : i18next.t('ApprovalOption.topDeptManager')
  if(value === 0) {
    return text
  } else {
    return `${text}${mode === 'up' ? i18next.t('ApprovalOption.plus') : i18next.t('ApprovalOption.minus')} ${value} ${i18next.t('ApprovalOption.levelDept')}`
  }
}

const containerAssigneeRef = ref(null)
const visibleAssigneeCount = ref(0)
const containerEmptyUserRef = ref(null)
const visibleEmptyUserCount = ref(0)

const allEmptyUserTags = computed(() => {
  const users = props.options.approverEmptyUsers || []
  const value = [
    ...users.map(id => ({
      id,
      label: getUserDisplayName(organizeUtil.findUserById(id))
    }))
  ].filter(item => item.label);
  if (isEmpty(value) && !isEmpty(users)) {
    props.options.approverEmptyUsers = []
  }
  return value;
})

const closeEmptyUserTag = (id) => {
  props.options.approverEmptyUsers = props.options.approverEmptyUsers.filter(item => item != id)
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
  })
})

watch(() => props.options?.approver?.[ProcessNodeOwnerType.ASSIGNEE], () => {
  nextTick(() => {
    updateAssigneeVisible()
  })
},{ deep: true })

watch(() => props.options?.approverEmptyUsers, () => {
  nextTick(() => {
    updateEmptyUserVisible()
  })
},{ deep: true })

watch(rejectContinueNodeOptions, (value) => {
  if (!Array.isArray(props.options.rejectSkipNodeIds)) {
    return
  }
  const validIds = new Set(value.map(item => item.uid))
  props.options.rejectSkipNodeIds = props.options.rejectSkipNodeIds.filter(item => validIds.has(item))
}, { deep: true, immediate: true })

watch(nodeOption, (value) => {
  if (!Array.isArray(props.options.revertRange)) {
    return
  }
  const validIds = new Set(value.map(item => item.uid))
  const nextIds = props.options.revertRange.filter(item => validIds.has(item))
  if (nextIds.length > 0) {
    props.options.revertRange = nextIds
    return
  }
  delete props.options.revertRange
}, { deep: true, immediate: true })

const save = async () => {
  const valid = operatorRef.value ? await operatorRef.value?.validate() : true
  return new Promise((resolve, reject) => {
    formRef.value?.validate((isValid) => {
      if (isValid && valid) {
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
.approval-option {
  width: 100%;
  height: 100%;
  padding: 12px;

  :deep(.approval-type) {
    .el-select {
      height: 24px;
      .el-select__wrapper {
        border-radius: 2px;
        height: 24px;
        min-height: 24px;
        border: none;
        box-shadow: none;
        background-color: var(--bg-color-overlay);
        padding: 0px 4px 0px 8px;

        .el-select__selected-item {
          span {
            font-weight: 400;
            font-size: 12px;
            line-height: 16px;
            letter-spacing: 0%;
            text-align: right;
          }
        }
      }
    }
  }

  .data-change-checkbox-group {
    --el-checkbox-height: 20px;
  }

  :deep(.el-form-item__content) {
    display: flex;
    flex: unset;
    width: 100%;
  }

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

  .range-option {
    padding: 0px 8px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-color);

    :deep(.el-select__wrapper) {
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      overflow: hidden;
      box-shadow: none;
    }
  }

  .comment-option-toggle {
    margin-bottom: 4px;
  }

  .comment-option-required {
    margin-bottom: 18px;
  }

  .approver-option {
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

    .approver-option-item {
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

  :deep(.empty-approver) {
    .el-form-item__content {
      display: block;
    }
    .approver-option-item {
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

    .empty-approver-item {
      margin-top: 12px;
    }
  }

  hr {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 24px 0px;
  }

  .vertical-radio {
    display: flex;
    flex-direction: column;
    justify-content: left;

    .el-radio {
      display: block;   /* 每个单选按钮占一行 */
      margin: 5px 0;
      width: 100%;
    }
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

  :deep(.el-form-item__error) {
    position: unset;
  }
}
</style>
