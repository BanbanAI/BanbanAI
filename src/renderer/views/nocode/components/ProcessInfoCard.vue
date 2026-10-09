<template>
  <div class="process-info-card" :class="{isEnd: isFinished(props.todo)}">
    <div class="info-container">
      <div class="main-container-header-item">
        <span>{{ $t('ProcessInfoCard.submitter') }}</span>
        <div
          class="submitter-text"
          :title="creator()"
        >
          {{ creator() }}
        </div>
      </div>
      <div class="main-container-header-item">
        <span>{{ $t('ProcessInfoCard.submitTime') }}</span>
        <div
          class="regular-text"
          :title="startTimeTitle()"
        >
          {{ startTimeTitle() }}
        </div>
      </div>
      <div class="main-container-header-item">
        <span>{{ $t('ProcessInfoCard.updateTime') }}</span>
        <div
          class="regular-text"
          :title="updateTimeTitle()"
        >
          {{ updateTimeTitle() }}
        </div>
      </div>
      <div class="main-container-header-item">
        <span>{{ $t('ProcessInfoCard.flowStatus') }}</span>
        <div
          class="state-text"
          :style="{ backgroundColor: getStatusColor(props.todo?.status) }"
          :title="getStatusText(props.todo?.status)"
        >
          {{ getStatusText(props.todo?.status) }}
        </div>
      </div>
      <div class="main-container-header-item" v-if="!isFinished(props.todo)">
        <span>{{ $t('ProcessInfoCard.currNode') }}</span>
        <div
          class="node-text"
          :class="props.todo?.type"
          :title="props.todo?.flowName"
        >
          {{ props.todo?.flowName }}
        </div>
      </div>
      <div class="main-container-header-item" v-if="!isFinished(props.todo)">
        <span>{{ $t('ProcessInfoCard.currHandler') }}</span>
        <div
          class="regular-text"
          :title="currentHandlerText()"
        >
          {{ currentHandlerText() }}
        </div>
      </div>
    </div>
      <img
        src="@renderer/assets/image/process/process-info-card-pass.png"
      v-if="props.todo?.status === ProcessNodeStatus.FINISHED"
      >
    <img
      src="@renderer/assets/image/process/process-info-card-reject.png"
      v-if="props.todo?.status === ProcessNodeStatus.REJECTED"
    >
      <img
        src="@renderer/assets/image/process/process-info-card-cancel.png"
      v-if="props.todo?.status === ProcessNodeStatus.CANCELED"
      >
  </div>
</template>

<script setup lang="ts">
import { TODO } from "@common/types/nocode";
import { OrganizeUtil } from "@renderer/views/nocode/utils";
import { nextTick, onMounted } from "vue";
import dayjs from "dayjs";
import { ProcessNodeStatus } from '@common/types/project';
import i18next from "i18next";
import { getUserDisplayName } from "@renderer/utils/other";

const organizeUtil = new OrganizeUtil()

const props = withDefaults(defineProps<{
  todo?: TODO,
}>(), {
});

onMounted(async () => {
  await nextTick(); // 等子组件渲染好
  await organizeUtil.getUsers();
});

const getStatus = (status?: ProcessNodeStatus) => {
  const textMap = {
    [ProcessNodeStatus.FINISHED]: i18next.t('ProcessInfoCard.approved'),
    [ProcessNodeStatus.IN_PROGRESS]: i18next.t('ProcessInfoCard.processing'),
    [ProcessNodeStatus.REJECTED]: i18next.t('ProcessInfoCard.rejected'),
    [ProcessNodeStatus.BACK]: i18next.t('ProcessInfoCard.rolledBack'),
    [ProcessNodeStatus.CANCELED]: i18next.t('ProcessInfoCard.revoked')
  }
  const colorMap = {
    [ProcessNodeStatus.FINISHED]: '#52c41a',
    [ProcessNodeStatus.IN_PROGRESS]: '#faad14',
    [ProcessNodeStatus.REJECTED]: '#f9484e',
    [ProcessNodeStatus.BACK]: '#f9484e',
    [ProcessNodeStatus.CANCELED]: '#A1A1A1'
  }
  return {
    text: textMap[status] || "--",
    color: colorMap[status] || "#A1A1A1"
  }
}

const getStatusText = (status?: ProcessNodeStatus) => {
  return getStatus(status).text;
}

const getStatusColor = (status?: ProcessNodeStatus) => {
  return getStatus(status).color;
}

const getUserName = (id?: string) => {
  if(!id) {
    return '-'
  }
  const user = organizeUtil.users.find(item => item.id === id)
  return getUserDisplayName(user, '-')
}

const creator = () => {
  const uid = props.todo?.fields?.find(item => item.meta?.name === '_create_owner')?.uid;
  const creatorUid = uid ? (props.todo?.data?.[uid] || props.todo?.flowStartOperator) : props.todo?.flowStartOperator;
  const creatorName = getUserName(creatorUid)
  return creatorName || "-"
}

const currentHandlerText = () => {
  const names = (props.todo?.paddingOperators || [])
    .map(item => getUserName(item))
    .filter(Boolean);
  return names.join("、") || "-";
}

const updateTime = () => {
  const uid = props.todo?.fields?.find(item => item.meta?.name === '_update_time')?.uid;
  const updateTime = uid ? props.todo?.data?.[uid] : undefined;
  return updateTime || props.todo?.endTime || props.todo?.startTime || props.todo?.flowStartTime || "";
}

const formatTime = (value?: string | number | Date) => {
  if (!value) return "--";
  const target = dayjs(value);
  if (!target.isValid()) return "--";
  return target.format("YYYY-MM-DD HH:mm");
}

const startTime = () => {
  const uid = props.todo?.fields?.find(item => item.meta?.name === '_create_time')?.uid;
  const startValue = uid ? props.todo?.data?.[uid] : undefined;
  return startValue || props.todo?.flowStartTime || props.todo?.startTime || "";
}

const updateTimeTitle = () => {
  return formatTime(updateTime());
}

const startTimeTitle = () => {
  return formatTime(startTime());
}

const isFinished = (todo?: TODO) => {
  const status = todo?.status;
  if(status === ProcessNodeStatus.FINISHED) {
    return true
  }
  if(status === ProcessNodeStatus.REJECTED) {
    return true
  }
  if(status === ProcessNodeStatus.CANCELED) {
    return true
  }
  return false
}
</script>

<style scoped lang="scss">
.process-info-card {
  background-color: white;
  border-radius: 4px;
  display: flex;
  align-items: center;

  &.isEnd .main-container-header-item {
    flex: 1 0 50% !important; /* 每个占 1/3 宽度 */
  }

  .info-container {
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    flex-wrap: wrap;
    flex: 1;
 
    .main-container-header-item {
      flex: 1 0 33.33%; /* 每个占 1/3 宽度 */
      text-align: center;
      padding-left: 24px;
      display: flex;
      align-items: center;

      span {
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0%; 
        color: var(--text-color-secondary);
        width: 60px;
        text-align: left;
        margin-right: 16px;
      }

      .submitter-text {
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0%;
        color: var(--el-color-primary);
      }

      .regular-text {
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0%;
        color: var(--el-text-color-regular);
        white-space: nowrap;
        width: 110px;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: left;
      }

      .state-text {
        border-radius: 3px;
        padding: 4px 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-white);
        font-weight: 400;
        font-size: 12px;
        letter-spacing: 0%;
      }

      .node-text {
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0%;

        &.start {
          color: #82bd53;
        }

        &.approval {
          color: #fa9830;
        }

        &.notify {
          color: #398bfc;
        }

        &.transact {
          color: #f9704a;
        }
      }
    }
  }

  img {
    height: 56px;
    width: 56px;
    margin-right: 16px;
  }
}
</style>
