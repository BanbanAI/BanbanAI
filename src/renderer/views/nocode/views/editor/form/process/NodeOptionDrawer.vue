<template>
  <div class="node-option-drawer">
    <el-drawer
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      direction="rtl"
      :size="720"
      :show-close="false"
      :before-close="onBeforeClose"
      destroy-on-close
      close-on-click-modal
    >
      <template #header>
        <div class="header-content">
          <div class="title title-main">
            <span class="node-name" v-if="!isEditName">{{ options.name }}</span>
            <el-input ref="renameInputRef" style="width: 120px;" v-else v-model="editName" @blur="handleRename" @keydown.enter="handleRename"></el-input>
            <el-icon :size="16" @click="enterRename">
              <i-ep-edit></i-ep-edit>
            </el-icon>
            <el-tag
              v-if="nodeTypeTag"
              disable-transitions
              effect="light"
              class="node-type-tag"
              size="small"
              :class="`is-${nodeTypeTag.className}`"
            >
              {{ nodeTypeTag.label }}
            </el-tag>
          </div>
          <div class="title title-extra" v-if="props.node && type === ProcessNodeType.BRANCH_SETTING && props.node.parent.getOwner()?.getFlow()?.type === ProcessNodeType.CONDITION_BRANCH">
            <el-select v-model="priority" placeholder="Select" v-if="props.node.parent" :disabled="!structureEditable">
              <el-option v-for="(item, index) in (props.node.parent.getOwner()?.branches?.length || 2) - 1" :key="index" :label="`${$t('NodeOptionDrawer.priority')}${index + 1}`" :value="index">
              </el-option>
            </el-select>
          </div>
        </div>
      </template>
      <el-scrollbar>
        <data-change-option :node="node" :options="options" ref="optionRef" v-if="type === ProcessNodeType.TRIGGER_DATA_CHANGE" />
        <time-task-option :node="node" :options="options" ref="optionRef" v-else-if="type === ProcessNodeType.TRIGGER_TIME_TASK" />
        <approval-option :node="node" :options="options" ref="optionRef" v-else-if="type === ProcessNodeType.APPROVAL" />
        <branch-setting-option :node="node" :options="options" ref="optionRef" v-else-if="type === ProcessNodeType.BRANCH_SETTING" />
        <transact-option :node="node" :options="options" ref="optionRef" v-else-if="type === ProcessNodeType.TRANSACT" />
        <notify-option :node="node" :options="options" ref="optionRef" v-else-if="type === ProcessNodeType.NOTIFY" />
        <operation-trigger-option :node="node" :options="options" ref="optionRef" v-else-if="type === ProcessNodeType.TRIGGER_OPERATION" />
        <add-data-option :node="node" :options="options" ref="optionRef" v-else-if="type === ProcessNodeType.ADD_DATA" />
        <edit-data-option :node="node" :options="options" ref="optionRef" v-else-if="type === ProcessNodeType.EDIT_DATA" />
        <delete-data-option :node="node" :options="options" ref="optionRef" v-else-if="type === ProcessNodeType.DELETE_DATA" />
        <report-data-option :node="node" :options="options" ref="optionRef" v-else-if="type === ProcessNodeType.REPORT_DATA" />
      </el-scrollbar>
      <template #footer>
        <el-button @click="onCancel">{{ $t('NodeOptionDrawer.cancel') }}</el-button>
        <el-button type="primary" @click.stop="onSave">{{ $t('NodeOptionDrawer.save') }}</el-button>
      </template>
    </el-drawer>
    <tip-dialog ref="drawerExitTipDialogRef" :title="$t('NodeOptionDrawer.tips')" :content="$t('NodeOptionDrawer.confirmSave')" :confirmText="$t('NodeOptionDrawer.save')" :closeOnClickModal="true" />
  </div>
</template>

<script lang='ts' setup>
import { ProcessFlowOptions, ProcessNodeType, ProcessTimeoutDeadlineType } from '@common/types/project';
import { DialogBeforeCloseFn, ElMessage } from 'element-plus';
import { ref, computed, provide, nextTick, watch, type PropType } from 'vue';
import { cloneDeep, isEqual } from 'lodash';
import { GET_OPTION_VALUE, UPDATE_OPTION } from '@renderer/b2/inject';
import i18next from 'i18next';
import type { ProcessNode } from './process';
import { useProcessStructureEditable } from '../hooks';
import { normalizeProcessTimeoutConfig } from '@common/utils';
const props = defineProps<{
  modelValue: boolean,
  node?: ProcessNode | null,
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean),
}>();
const optionRef = ref();
const options = ref<ProcessFlowOptions>({});
const initialOptions = ref<ProcessFlowOptions>({});
const priority = ref(0)
const currentNode = ref<ProcessNode | null>(props.node ?? null);
const type = computed(() => currentNode.value?.type);
const drawerExitTipDialogRef = ref();
const structureEditable = useProcessStructureEditable();
const nodeTypeTagMap: Partial<Record<ProcessNodeType, { label: string, className: string }>> = {
  get [ProcessNodeType.TRIGGER_DATA_CHANGE]() {
    return {
      label: i18next.t('NodeOptionDrawer.dataChangeTriggerTag'),
      className: 'trigger-data-change',
    };
  },
  get [ProcessNodeType.TRIGGER_TIME_TASK]() {
    return {
      label: i18next.t('NodeOptionDrawer.timeTaskTag'),
      className: 'trigger-time-task',
    };
  },
  get [ProcessNodeType.TRIGGER_OPERATION]() {
    return {
      label: i18next.t('NodeOptionDrawer.operationTriggerTag'),
      className: 'trigger-operation',
    };
  },
  get [ProcessNodeType.APPROVAL]() {
    return {
      label: i18next.t('NodeOptionDrawer.approvalTag'),
      className: 'approval',
    };
  },
  get [ProcessNodeType.TRANSACT]() {
    return {
      label: i18next.t('NodeOptionDrawer.transactTag'),
      className: 'transact',
    };
  },
  get [ProcessNodeType.NOTIFY]() {
    return {
      label: i18next.t('NodeOptionDrawer.notifyTag'),
      className: 'notify',
    };
  },
  get [ProcessNodeType.ADD_DATA]() {
    return {
      label: i18next.t('NodeOptionDrawer.addDataTag'),
      className: 'add-data',
    };
  },
  get [ProcessNodeType.EDIT_DATA]() {
    return {
      label: i18next.t('NodeOptionDrawer.editDataTag'),
      className: 'edit-data',
    };
  },
  get [ProcessNodeType.DELETE_DATA]() {
    return {
      label: i18next.t('NodeOptionDrawer.deleteDataTag'),
      className: 'delete-data',
    };
  },
  get [ProcessNodeType.REPORT_DATA]() {
    return {
      label: i18next.t('NodeOptionDrawer.reportDataTag'),
      className: 'report-data',
    };
  },
}
const nodeTypeTag = computed(() => {
  if (type.value === ProcessNodeType.BRANCH_SETTING) {
    const ownerType = props.node?.parent.getOwner()?.getFlow()?.type;
    if (ownerType === ProcessNodeType.CONDITION_BRANCH) {
      return {
        label: i18next.t('NodeOptionDrawer.conditionBranchTag'),
        className: 'condition-branch',
      };
    }
    if (ownerType === ProcessNodeType.PARALLEL_BRANCH) {
      return {
        label: i18next.t('NodeOptionDrawer.parallelBranchTag'),
        className: 'parallel-branch',
      };
    }
    return null;
  }
  const currentType = type.value;
  if (!currentType) {
    return null;
  }
  if (!nodeTypeTagMap[currentType]) {
    return null;
  }
  return nodeTypeTagMap[currentType];
});

const createDefaultTimeoutOption = () => ({
  enabled: false,
  deadline: {
    type: ProcessTimeoutDeadlineType.CUSTOM,
    value: null,
  },
  deadlineFieldId: null,
  rules: [],
})

const hasPendingOptionChanges = () => {
  return !isEqual(options.value, initialOptions.value)
    || !!optionRef.value?.hasPendingChanges?.()
}

const onBeforeClose: DialogBeforeCloseFn = async (done) => {
  done();
  return;
  // FIXME: 在打开drawer时会自动补全缺少的默认属性，导致这里判断有更改，得换一种判断是否更改设置项的方案
  if (!hasPendingOptionChanges()) {
    done();
    return;
  }
  const isExitSave = await drawerExitTipDialogRef.value?.confirm();
  if (isExitSave === undefined) {
    return; // 点击x 或 背景
  }
  if (isExitSave) {
    const valid = await onSave();
    if (valid) {
      done();
    }
  } else {
    done();
  }
}

provide(GET_OPTION_VALUE, () => {
  if(!options.value.fieldAuth) {
    options.value.fieldAuth = 'all'
  }
  return options.value.fieldAuth
})

provide(UPDATE_OPTION, (value) => {
  options.value.fieldAuth = value
})

watch(() => props.modelValue, (val) => {
  currentNode.value = props.node ?? null;
  if (!val || !currentNode.value) {
    options.value = {};
    initialOptions.value = {};
    return;
  }
  const data = cloneDeep(currentNode.value.options || {});
  
  if(!data.fieldAuth) data.fieldAuth = 'all';
  
  const initSourceTableTypes = [
    ProcessNodeType.TRIGGER_DATA_CHANGE,
    ProcessNodeType.TRIGGER_TIME_TASK,
    ProcessNodeType.ADD_DATA,
    ProcessNodeType.EDIT_DATA,
    ProcessNodeType.BRANCH_SETTING
  ]
  if(initSourceTableTypes.includes(type.value) && !data.sourceTables) {
    data.sourceTables = [];
  }
  if([ProcessNodeType.BRANCH_SETTING, ProcessNodeType.TRIGGER_DATA_CHANGE, ProcessNodeType.TRIGGER_TIME_TASK].includes(type.value) && !data.conditions) {
    data.conditions = [];
  }
  if([ProcessNodeType.ADD_DATA, ProcessNodeType.EDIT_DATA].includes(type.value) && !data.targetFields) {
    data.targetFields = [];
  }
  if(type.value === ProcessNodeType.ADD_DATA && !data.batchFields) {
    data.batchFields = [];
  }
  if ([ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA].includes(type.value)) {
    data.timeout = normalizeProcessTimeoutConfig(data.timeout || createDefaultTimeoutOption());
  }

  options.value = data;
  initialOptions.value = cloneDeep(data);
  
  if(type.value === ProcessNodeType.BRANCH_SETTING) {
    priority.value = currentNode.value.branchIndex
  }
}, { immediate: true});

const onCancel = () => {
  onBeforeClose(() => {
    emit('update:modelValue', false);
  });
}
const onSave = async () => {
  if (!currentNode.value) {
    return false;
  }
  const previousOptions = cloneDeep(currentNode.value.options || {});
  const valid = await optionRef.value?.save?.() ?? true;
  if (!valid) {
    ElMessage.error(i18next.t('NodeOptionDrawer.incompleteSettings'))
    return false;
  }

  currentNode.value.options = options.value;
  const nodeValid = currentNode.value.validate();
  if (!nodeValid) {
    currentNode.value.options = previousOptions;
    currentNode.value.validate();
    ElMessage.error(currentNode.value.errorMsg || i18next.t('NodeOptionDrawer.incompleteSettings'))
    return false;
  }

  if(type.value === ProcessNodeType.BRANCH_SETTING && structureEditable?.value) {
    currentNode.value.parent.changeIndex(priority.value, currentNode.value.branchIndex)
  }
  currentNode.value.parent.updateHistory();
  ElMessage.success(i18next.t('NodeOptionDrawer.saveSuccess'))
  emit('update:modelValue', false);
  return true;
}

const isEditName = ref(false)
const editName = ref('')
const renameInputRef = ref(null)

const enterRename = () => {
  isEditName.value = true
  editName.value = options.value.name
  nextTick(() => {
    renameInputRef.value.focus()
  })
}

const handleRename = () => {
  if(editName.value && editName.value !== options.value.name) {
    options.value.name = editName.value
  }
  isEditName.value = false
}
</script>

<style lang='scss' scoped>
.node-option-drawer {
  cursor: default;
  :deep(.el-drawer) {
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
    .el-drawer__header {
      padding: 0 12px;
      height: 44px;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-color-regular);
      margin: 0;
      background-color: var(--color-white);
      border-top-left-radius: 8px;

      .header-content {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .title {
        display: flex;
        align-items: center;
        min-width: 0;

        &.title-main {
          flex: 1;
          gap: 4px;
        }

        &.title-extra {
          flex-shrink: 0;
        }

        .node-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 280px;
        }

        span {
          font-weight: 500;
          font-style: Medium;
          font-size: 16px;
          line-height: 24px;
          letter-spacing: 0%;
        }

        .el-icon {
          cursor: pointer;
          padding-top: 2px;
          margin-left: 4px
        }

        .node-type-tag {
          --el-tag-border-color: transparent;
          height: 20px;
          padding: 0 4px;
          border-radius: 4px;
          margin-left: 12px;
          flex-shrink: 0;

          .el-tag__content {
            font-size: 12px !important;
            line-height: 20px !important;
            font-weight: 400 !important;
          }

          &.is-trigger-data-change {
            --el-tag-text-color: #6cb238;
            --el-tag-bg-color: #eef8e5;
          }

          &.is-trigger-time-task {
            --el-tag-text-color: #13b3c2;
            --el-tag-bg-color: #e8fbfd;
          }

          &.is-trigger-operation {
            --el-tag-text-color: #bb8ce8;
            --el-tag-bg-color: #f5edfd;
          }

          &.is-condition-branch {
            --el-tag-text-color: #b37feb;
            --el-tag-bg-color: #f9f0ff;
          }

          &.is-parallel-branch,
          &.is-approval,
          &.is-edit-data {
            --el-tag-text-color: #faad14;
            --el-tag-bg-color: #fff7e8;
          }

          &.is-transact {
            --el-tag-text-color: #f97316;
            --el-tag-bg-color: #fff1e8;
          }

          &.is-notify {
            --el-tag-text-color: #4096ff;
            --el-tag-bg-color: #e8f3ff;
          }

          &.is-add-data {
            --el-tag-text-color: #1677ff;
            --el-tag-bg-color: #edf5ff;
          }

          &.is-delete-data {
            --el-tag-text-color: #ff4d4f;
            --el-tag-bg-color: #fff1f0;
          }

          &.is-report-data {
            --el-tag-text-color: #13c2c2;
            --el-tag-bg-color: #e6fffb;
          }

        }

        .el-select {
          height: 24px;
          min-width: 82px;

          .el-select__wrapper {
            box-shadow: none;
            background-color: var(--bg-color-overlay);
            border-radius: 4px;
            min-height: 24px;
            padding: 2px 4px 2px 8px;
            gap: 60px;
            
            .el-select__selection .el-select__selected-item {
              width: fit-content !important;

              span {
                
                font-weight: 400;
                
                font-size: 14px;
                line-height: 20px;
                letter-spacing: 0%;
              }
            }
          }
        }
      }
    }
    .el-drawer__body {
      padding: 0px;
      background-color: var(--color-white);
    }
    .el-drawer__footer {
      height: 64px;
      border-top: 1px solid var(--border-color);
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: end;
      background-color: var(--color-white);
      border-bottom-left-radius: 8px;

      .el-button {
        width: 60px;
        border-radius: 4px;
      }
    }
  }

  :deep(.option-item) {
    .title {
      font-weight: 500;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
    }
  }
}
</style>
