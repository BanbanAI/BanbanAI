<template>
  <div class="process-flows">
    <div class="title" v-if="!props.isMobile && props.isShowTitle">
      <ul>
        <li class="active">
          {{ $t('ProcessFlows.flow') }}
        </li>
        <li v-if="false">
          {{ $t('ProcessFlows.log') }}
        </li>
        <li v-if="false">
          {{ $t('ProcessFlows.comment') }}
        </li>
      </ul>
    </div>

    <div class="process-version" v-if="currentProcessVersionLabel">
      <el-tag type="primary" effect="light" class="process-version__tag">
        {{ currentProcessVersionLabel }}
      </el-tag>
    </div>

    <div class="process-container">
      <div class="empty-box" v-if="isEmpty(processesData)">
        <div class="empty-container">
          <span>{{ $t('ProcessFlows.noFlow') }}</span>
        </div>
      </div>
      <el-scrollbar v-else height="100%" class="scrollbar">
        <process-timeline :processes-data="processesData"/>
      </el-scrollbar>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { TODO, TodoProcess } from '@common/types/nocode';
import { ProcessNodeType, ProcessNodeStatus } from '@common/types/project';
import { computed, ref, watch } from 'vue';
import { formFlowApi } from '../utils';
import { deepClone, isEmpty } from '@common/utils/object';
import i18next from 'i18next';

type ProcessCard = TodoProcess & {
  fold: boolean,
  children?: ProcessCard[],
}

const props = withDefaults(defineProps<{
  todo: TODO,
  isMobile: boolean,
  isShowTitle: boolean,
}>(), {
  isMobile: false,
  isShowTitle: true,
})
const processesData = ref<ProcessCard[]>([]);
const latestProcessFlowRequestId = ref(0);
const canLoadProcessFlow = computed(() => {
  return !!props.todo?.nocodeId
    && !!props.todo?.tableId
    && !!props.todo?.uuid
    && !!props.todo?.todoId;
});
const currentProcessVersionLabel = computed(() => {
  const version = props.todo?.processVersion;
  if (!Number.isInteger(version) || version <= 0) {
    return '';
  }
  return i18next.t('ProcessFlows.versionLabel', { version });
});
const processFlowKey = computed(() => {
  return `${props.todo?.nocodeId || ''}:${props.todo?.tableId || ''}:${props.todo?.uuid || ''}:${props.todo?.todoId || ''}`;
});

const initData = async () => {
  if (!canLoadProcessFlow.value) {
    processesData.value = [];
    return;
  }

  const requestId = latestProcessFlowRequestId.value + 1;
  const currentKey = processFlowKey.value;
  latestProcessFlowRequestId.value = requestId;
  const res = await formFlowApi.getFlowRecords({
    nocodeId: props.todo.nocodeId,
    tableId: props.todo.tableId,
    uuid: props.todo.uuid,
    todoId: props.todo.todoId,
  });
  if (requestId !== latestProcessFlowRequestId.value || currentKey !== processFlowKey.value) {
    return;
  }
  const records = Array.isArray(res) ? res : [];
  processesData.value = expandData(records).filter(item => item.type !== ProcessNodeType.BRANCH_SETTING);
}

watch(processFlowKey, async () => {
  latestProcessFlowRequestId.value += 1;
  processesData.value = [];
  if (!canLoadProcessFlow.value) {
    return;
  }
  await initData();
}, {
  immediate: true,
});

const expandData = (value) => {
  const changeStatus = (data, index) => {
    const item = data[index]
    const originalStatus = item.status
    item.children = []
    item.status = originalStatus || null
    if(!originalStatus || originalStatus === ProcessNodeStatus.NOT_STARTED) {
      if(data[index+1]?.status) {
        item.status = ProcessNodeStatus.FINISHED
      } else if(data[index-1]?.status === ProcessNodeStatus.FINISHED && index != data.length-1) {
        item.status = ProcessNodeStatus.IN_PROGRESS
      }
    }
    for(let j = 0; j < item.branches.length; j++) {
      const branch = item.branches[j]
      branch.children = expandData(branch.flows)
        .filter(child => child.type !== ProcessNodeType.BRANCH_SETTING)
      branch.options = {
        name: branch.flowName || branch.flows?.[0]?.options?.name
      }
      const statusNode = branch.children.filter(i => i.status)
      branch.status = statusNode.length ? ProcessNodeStatus.FINISHED : null
      if(branch.status && !item.status) {
        item.status = ProcessNodeStatus.FINISHED
      }
      if(j === item.branches.length-1 && !branch.status && item.children.filter(i => i.status).length == 0) {
        branch.status = item.status
      }
      item.children.push(branch)
    }

    if(index === 0) {
      return
    }
    const _item = data[index-1]
    if((_item.type === ProcessNodeType.PARALLEL_BRANCH || _item.type === ProcessNodeType.CONDITION_BRANCH)) {
      changeStatus(data, index-1)
    }
  }
  const data = deepClone(value)
  const result = []
  for(let i = 0; i < data.length; i++) {
    const item = data[i]
    if
      (
        (item.type === ProcessNodeType.PARALLEL_BRANCH || item.type === ProcessNodeType.CONDITION_BRANCH) &&
        item.branches?.length
      )
    {
      changeStatus(data, i)
      if(item.children.some(i => i.status != null) && item.type === ProcessNodeType.CONDITION_BRANCH) {
        item.children = item.children.filter(i => i.status != null)
      }
    }
    if(item.type === ProcessNodeType.TRANSACT && item.submitRecords?.length) {
      const children = []
      for(let j = 0; j < item.submitRecords.length; j++) {
        const record = item.submitRecords[j]
        const type = 'satisfy' in record ? 'condition-check' : 'transact_temp'
        const flowName = type === 'condition-check' ? i18next.t('ProcessFlows.handleCheck') : item.flowName
        children.push({
          ...item,
          type: type,
          paddingOperators: type === 'condition-check' ? [] : [record.userId],
          operator: type === 'condition-check' ? [] : [record.userId],
          opinionRecord: 'satisfy' in record ? undefined : record,
          startTime: record.time,
          flowName: flowName,
          status: type === 'condition-check' ? record.satisfy ? ProcessNodeStatus.FINISHED : ProcessNodeStatus.BACK : ProcessNodeStatus.FINISHED,
          parent: 'transact'
        })
      }
      if(children.at(-1).status === ProcessNodeStatus.BACK) {
        children.push({
          ...item,
          type: 'transact_temp',
          status: ProcessNodeStatus.IN_PROGRESS,
        })
      }
      item.children = children
      item.paddingOperators = []
      item.operator = []
    }

    if(item.type === ProcessNodeType.REPORT_DATA && item.submitRecords?.length) {
      const children = []
      for(let j = 0; j < item.submitRecords.length; j++) {
        const record = item.submitRecords[j]
        const type = 'satisfy' in record ? 'condition-check' : 'report-data'
        const flowName = type === 'condition-check' ? i18next.t('ProcessFlows.fillCheck') : item.flowName
        children.push({
          ...item,
          type: type,
          paddingOperators: type === 'condition-check' ? [] : [record.userId],
          operator: type === 'condition-check' ? [] : [record.userId],
          opinionRecord: 'satisfy' in record ? undefined : record,
          startTime: record.time,
          flowName: flowName,
          status: type === 'condition-check' ? record.satisfy ? ProcessNodeStatus.FINISHED : ProcessNodeStatus.BACK : ProcessNodeStatus.FINISHED,
          parent: 'report-data'
        })
      }
      if(children.at(-1).status === ProcessNodeStatus.BACK) {
        children.push({
          ...item,
          type: 'report-data',
          status: ProcessNodeStatus.IN_PROGRESS,
        })
      }
      item.children = children
      item.paddingOperators = []
      item.operator = []
    }
    if(item.type === ProcessNodeType.START) {
      const meta = (Object.values(item.metas)?.[0] as any);
      const entryId = meta?.entryId;
      const branch = props.todo?.flows?.[0]?.branches?.find(item => item.uid === entryId);
      const flow = branch?.flows?.[0]
      if(flow) {
        item.flowName = flow?.options?.name || item.flowName
        item.options.name = flow?.options?.name || item?.options?.name
        item.type = flow?.type || item.type
      } else {
        item.flowName = i18next.t('ProcessFlows.dataChange')
        item.options.name = i18next.t('ProcessFlows.dataChange')
        item.type = ProcessNodeType.TRIGGER_DATA_CHANGE
      }
    }
    result.push(item)
  }
  return result
}
</script>

<style lang='scss' scoped>
.process-flows {
  height: 100%;
  display: flex;
  flex-direction: column;

  .title {
    height: 40px;
    padding-bottom: 8px;
    font-weight: 500;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: 0%;
    border-bottom: 1px solid var(--border-color);

    ul {
      display: flex;
      padding-left: 8px;
      li {
        width: 60px;
        height: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          color: var(--color-primary);
        }

        &.active {
          color: var(--color-primary);
          border-bottom: 2px solid var(--color-primary);
        }
      }
    }
  }

  .process-version {
    padding: 12px 12px 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;

    &__tag {
      height: 24px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 20px;
      color: #1677ff;
      background: #eff6ff;
      border-color: rgba(22, 119, 255, 0.16);
    }
  }

  .process-container {
    width: auto;
    flex: 1;
    min-height: 0;
    padding: 16px 8px;

    :deep(.el-scrollbar) {
      .el-scrollbar__view {
        padding-right: 16px;
        padding-left: 5px;
      }

      .el-scrollbar__bar.is-vertical {
        right: 5px;
      }
    }
  }

  .empty-box {
    width: 100%;
    height: 100%;
    .empty-container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 14px;
      color: var(--text-color-placeholder);
    }
  }
}
</style>
