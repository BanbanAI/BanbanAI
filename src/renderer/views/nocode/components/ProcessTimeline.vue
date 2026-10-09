<template>
  <el-timeline 
    style="max-width: 600px; padding: 20px 0px 5px 20px;"
    class="process-timeline"
  >
    <el-timeline-item 
      placement="top" 
      :hide-timestamp="true" 
      v-for="(item, index) in showFlowData"
      v-if="true"
      :class="{
        'not-started': item.status === ProcessNodeStatus.NOT_STARTED || item.status === ProcessNodeStatus.IN_PROGRESS,
        'is-started': item.status != ProcessNodeStatus.NOT_STARTED && item.status != ProcessNodeStatus.IN_PROGRESS,
        'is-last': index === showFlowData.length - 1,
        'not-last': index != showFlowData.length - 1,
      }"
    >
      <template #dot>
        <div class="custom-dot" :class="item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type">
          <el-icon>
            <i-nocode-process-flow-approval
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'approval'"
            />
            <i-nocode-process-flow-notify
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'notify'"
            />
            <i-nocode-process-flow-data-change
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'trigger-data-change'"
            />
            <i-ep-operation
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'trigger-operation'"
            />
            <i-nocode-flow-timer-task
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'trigger-time-task'"
            />
            <i-nocode-process-flow-transact
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'transact'"
            />
            <i-nocode-flow-add-data
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'add-data'"
            />
            <i-nocode-flow-edit-data
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'edit-data'"
            />
            <i-nocode-flow-delete-data
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'delete-data'"
            />
            <i-nocode-flow-condition-branch
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'condition-branch'"
            />
            <i-nocode-flow-parallel-branch
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'parallel-branch'"
            />
            <i-nocode-flow-data-filling
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'report-data'"
            />
            <i-nocode-flow-end
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'end'"
            />
            <i-nocode-process-flow-condition-check
              v-if="(item.type.endsWith('_temp') ? item.type.slice(0, -5) : item.type) === 'condition-check'"
            />
          </el-icon>
          <div class="dot-icon" v-if="item.status !== ProcessNodeStatus.NOT_STARTED">
            <el-icon :size="20" v-if="item.status === ProcessNodeStatus.IN_PROGRESS">
              <i-workbench-flow-in-progress />
            </el-icon>
            <el-icon :size="20" v-else-if="item.status === ProcessNodeStatus.FINISHED">
              <i-workbench-flow-finish/>
            </el-icon>
            <el-icon :size="20" v-else-if="item.status === ProcessNodeStatus.TRANSFERED">
              <i-workbench-flow-transfer/>
            </el-icon>
            <span class="skip-badge" v-else-if="item.status === ProcessNodeStatus.SKIPPED">
              <span class="skip-line"></span>
            </span>
            <el-icon :size="20" v-else-if="[ProcessNodeStatus.BACK, ProcessNodeStatus.REJECTED, ProcessNodeStatus.CANCELED].includes(item.status)">
              <i-workbench-flow-back />
            </el-icon>
          </div>
        </div>
      </template>
      <div style="margin-left: 2px;">
        <div class="item-header">
          <span class="type">
            {{ item.options.name }}
            <span v-if="item.isStashed && !item.type.endsWith('_temp')" class="stash-tag">
              {{ $t('ProcessTimeline.stash') }}
            </span>
            <div v-if="item.type === ProcessNodeType.APPROVAL && item.status === ProcessNodeStatus.IN_PROGRESS">
              {{ 
                item.options.categoryRule != ApprovalCategoryRule.NORMAL ? 
                $t('ProcessTimeline.stepApproval')
                : getApprovalTag(item.options.approverType)
              }}
            </div>
            <div v-if="item.type === ProcessNodeType.TRANSACT && (item.status === ProcessNodeStatus.IN_PROGRESS || item.data?.children?.length)">
              {{ 
                getTransactTag(item.options.transactorType)
              }}
            </div>
            <div v-if="[ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA].includes(item.type) && item.data?.children?.length">
              {{ $t('ProcessTimeline.condition') }}{{ item.type === ProcessNodeType.REPORT_DATA ? $t('ProcessTimeline.fill') : $t('ProcessTimeline.handle') }}
            </div>
            <div v-if="[ProcessNodeType.TRIGGER_DATA_CHANGE, ProcessNodeType.TRIGGER_OPERATION].includes(item.type) && getStartTag(item.data)">
              {{ 
                getStartTag(item.data)
              }}
            </div>
          </span>
          <span
            class="time"
            v-if="isTriggerNode(item.type) && index === 0"
          >
            {{ dayjs(item.data?.startTime).format("YYYY-MM-DD HH:mm") }}
          </span>
        </div>
        <div class="item-status">
          <span class="name">{{ getFlowDirector(item) }}</span>
          <span class="is-read" v-if="false">
            {{ $t('ProcessTimeline.allRead') }}
          </span>
          <el-icon
            v-if="item.status !== ProcessNodeStatus.SKIPPED && (getPaddingOperators(item)?.length || hasFlowDetail(item) || item.type === ProcessNodeType.CONDITION_BRANCH || item.type === ProcessNodeType.PARALLEL_BRANCH)"
            @click="foldData[index] = !foldData[index]"
          >
            <i-ep-arrow-down 
              :style="{
                transform: foldData[index] ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease'
              }"
            />
          </el-icon>
        </div>
        <div class="item-body" v-if="getPaddingOperators(item)?.length && !foldData[index]">
          <ul>
            <li  v-for="(id, opIndex) in getPaddingOperators(item)" :key="id + opIndex">
              <div class="user-card" :title="getUserName(id)">
                <div
                  class="avatar"
                  :style="{ background: colorGroup[(opIndex as number) % 9] }"
                >
                  {{ getUserName(id)[0] }}
                </div>
                <div class="name">{{ getUserName(id) }}</div>
              </div>
              <div
                class="relation-text"
                v-if="opIndex != getPaddingOperators(item).length - 1"
                :style="{
                  opacity: [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(item.type) ? 1 : 0,
                }"
              >
                {{
                  item.type === ProcessNodeType.APPROVAL ? 
                  (item.options.categoryRule === ApprovalCategoryRule.NORMAL ? getUserRelationSign(item.options.approverType) : '›') 
                  : getUserRelationSign(item.options.transactorType)
                }}
              </div>
            </li>
          </ul>
        </div>
        <div class="item-body detail-body" v-if="hasFlowDetail(item) && !foldData[index]">
          <div class="comment-text timeout-auto-text" v-if="getTimeoutAutoOperationText(item)">
            {{ getTimeoutAutoOperationText(item) }}
          </div>
          <template v-else-if="getFlowOpinionDetail(item)">
            <div class="comment-text" v-if="getFlowOpinionComment(item)">
              {{ getFlowOpinionComment(item) }}
            </div>
            <div class="detail-section" v-if="getFlowOpinionImages(item).length">
              <div class="section-label">{{ $t('ProcessTimeline.images') }}</div>
              <div class="image-list">
                <div class="image-item" v-for="(file, imageIndex) in getFlowOpinionImages(item)" :key="file.uid">
                  <el-image
                    :src="file.url"
                    fit="cover"
                    :preview-src-list="getFlowOpinionImageUrls(item)"
                    :initial-index="imageIndex"
                    preview-teleported
                  />
                  <el-button link class="download-btn image-download-btn" @click.stop="downloadFlowFile(file)">
                    <el-icon :size="12">
                      <i-ep-download />
                    </el-icon>
                  </el-button>
                </div>
              </div>
            </div>
            <div class="detail-section" v-if="getFlowOpinionFiles(item).length">
              <div class="section-label">{{ $t('ProcessTimeline.attachments') }}</div>
              <div class="file-list">
                <div class="file-item" v-for="file in getFlowOpinionFiles(item)" :key="file.uid">
                  <span class="file-name" :title="file.name">{{ file.name }}</span>
                  <el-button link class="download-btn file-download-btn" @click="downloadFlowFile(file)">
                    <el-icon :size="12">
                      <i-ep-download />
                    </el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </template>
          <div v-else v-html="getRawCommentHtml(item)"></div>
        </div>

        <div 
          v-if="item.status !== ProcessNodeStatus.SKIPPED && [ProcessNodeType.CONDITION_BRANCH, ProcessNodeType.PARALLEL_BRANCH, ProcessNodeType.TRANSACT, ProcessNodeType.REPORT_DATA].includes(item.type) && item.data?.children?.length"
          v-show="!foldData[index]"
        >
          <process-timeline :processes-data="item.data.children" :start-operator-id="resolvedStartOperatorId"/>
        </div>
      </div>
    </el-timeline-item>
  </el-timeline>
</template>

<script lang='ts' setup>
import 
{ ApprovalCategory,
  ApprovalCategoryRule,
  ProcessNodeStatus,
  ProcessNodeType,
  ApproverType,
}
  from '@common/types/project';
import dayjs from "dayjs";
import { OrganizeUtil } from "@renderer/views/nocode/utils";
import { computed, inject, onMounted, ref, type PropType } from 'vue';
import { NOCODE } from '@renderer/types';
import { unique } from '@common/utils/unique';
import { deepClone } from '@common/utils/object';
import { isTriggerNode } from "@common/utils";
import i18next from 'i18next';
import { getUserDisplayName } from '@renderer/utils/other';
import {
  getTimeoutAutoFlowSource,
  isTimeoutAutoFlowItem,
  resolveTransactTempOperator,
  splitFlowOperatorsByTimeoutAutoAction,
} from './process-timeline.util';

const props = defineProps({
  processesData: {
    type: Array as PropType<Array<{ operators?: string[] } & Record<string, unknown>>>,
    required: true,
  },
  startOperatorId: {
    type: String,
    default: '',
  },
});

const organizeUtil = new OrganizeUtil();
const nocode = inject(NOCODE);

const colorGroup = [
  '#1fc2b2',
  '#5dd873',
  '#87c05a',
  '#e7bf66',
  '#f08d71',
  '#e476a6',
  '#cf69db',
  '#9b86ea',
  '#579af2',
]

onMounted(async () => {
  await organizeUtil.getDepartments();
  await organizeUtil.getUsers();
  await organizeUtil.getRoles();
})

const resolvedStartOperatorId = computed(() => {
  if (props.startOperatorId) {
    return props.startOperatorId
  }
  return props.processesData.find(item => item?.operators?.[0])?.operators?.[0] || ''
})

const getTransactTag = (type) => {
  const textMap = {
    [ApproverType.AND]: i18next.t('ProcessTimeline.jointSign'),
    [ApproverType.OR]: i18next.t('ProcessTimeline.orSign'),
    [ApproverType.SEQUENTIAL]: i18next.t('ProcessTimeline.handleInTurn'),

  }
  return textMap[type]
}

const getApprovalTag = (type) => {
  const textMap = {
    [ApproverType.AND]: i18next.t('ProcessTimeline.jointSign'),
    [ApproverType.OR]: i18next.t('ProcessTimeline.orSign'),
    [ApproverType.SEQUENTIAL]: i18next.t('ApprovalOption.sequentialApproval').replace(/\s*\(.+\)$/, ''),
  }
  return textMap[type]
}

const getStartTag = (data) => {
  const metas = data.metas
  if(!metas) {
    return ''
  }
  const textMap = {
    add: i18next.t('ProcessTimeline.add'),
    delete: i18next.t('ProcessTimeline.del'),
    edit: i18next.t('ProcessTimeline.edit'),
    operation: i18next.t('ProcessTimeline.operationTrigger'),
  }
  for (const [k, v] of Object.entries(metas)) {
    const value = v as { source: string }
    if(value.source) {
      return textMap[value.source]
    }
  }
  return ''
}

const getFinishFlowOperatorId = (flow) => {
  const metas = flow?.data?.metas
  if (!metas) {
    return ''
  }

  if (flow.operator && metas[flow.operator]) {
    return metas[flow.operator]?.finishFlow ? flow.operator : ''
  }

  const matched = Object.entries(metas).find(([, meta]) => {
    return (meta as { finishFlow?: boolean })?.finishFlow
  })
  return matched?.[0] || ''
}

const getFinishFlowText = (flow) => {
  const operatorId = getFinishFlowOperatorId(flow)
  if (!operatorId) {
    return ''
  }
  return `${getUserName(operatorId)}（${i18next.t('ProcessTimeline.finishFlowed')}）`
}

const getTimeoutAutoSource = (item) => {
  const mergedSource = getTimeoutAutoFlowSource(item)
  if (mergedSource) {
    return mergedSource
  }

  const metas = item.data?.metas
  if (!metas) {
    return null
  }

  if ((item.type === 'approval_temp' || item.type === 'transact_temp') && item.operator) {
    const operatorMeta = metas[item.operator]
    return ['submit', 'back'].includes(operatorMeta?.timeoutAutoAction) ? operatorMeta : null
  }

  return Object.values(metas).find((meta: any) => {
    return ['submit', 'back'].includes(meta?.timeoutAutoAction)
  }) || null
}

const getTimeoutAutoDirector = (flow) => {
  const robotName = i18next.t('ProcessTimeline.systemRobot')

  switch (flow.type) {
    case 'approval_temp':
    case ProcessNodeType.APPROVAL: {
      const status =
        flow.status === ProcessNodeStatus.BACK
          ? i18next.t('ProcessTimeline.rolledBack')
          : flow.status === ProcessNodeStatus.REJECTED
            ? i18next.t('ProcessTimeline.rejected')
            : i18next.t('ProcessTimeline.approved')
      return `${robotName}（${status}）`
    }

    case 'transact_temp':
    case ProcessNodeType.TRANSACT: {
      const status =
        flow.status === ProcessNodeStatus.BACK
          ? i18next.t('ProcessTimeline.rolledBack')
          : flow.status === ProcessNodeStatus.IN_PROGRESS
            ? i18next.t('ProcessTimeline.handling')
            : i18next.t('ProcessTimeline.handled')
      return `${robotName}（${status}）`
    }

    case ProcessNodeType.REPORT_DATA: {
      const status = flow.status === ProcessNodeStatus.FINISHED
        ? i18next.t('ProcessTimeline.filled')
        : i18next.t('ProcessTimeline.filling')
      return `${robotName}（${status}）`
    }

    default:
      return robotName
  }
}

const getDataProcessingStatusText = (status?: ProcessNodeStatus) => {
  if (status === ProcessNodeStatus.IN_PROGRESS) {
    return i18next.t('ProcessTimeline.handling')
  }
  return status === ProcessNodeStatus.FINISHED
    ? i18next.t('ProcessTimeline.finished')
    : i18next.t('ProcessTimeline.pending')
}

const getFlowDirector = (flow) => {
  const process = flow.data

  if (flow.status === ProcessNodeStatus.CANCELED) {
    if ([ProcessNodeType.TRIGGER_DATA_CHANGE, ProcessNodeType.TRIGGER_OPERATION].includes(flow.type)) {
      const operatorName = getUserName(process?.operators?.[0]) || getUserName(process?.paddingOperators?.[0])
      return operatorName
        ? operatorName + i18next.t('ProcessTimeline.revokedText')
        : i18next.t('ProcessTimeline.revoked')
    }
    return i18next.t('ProcessTimeline.revoked')
  }

  // 没有数据直接返回空
  if (!process && !['approval_temp', 'transact_temp', 'notify_temp'].includes(flow.type)) {
    return ''
  }

  if(flow.status === ProcessNodeStatus.SKIPPED) {
    return i18next.t('commonNocode.skipped')
  }

  if(flow.status === ProcessNodeStatus.TRANSFERED) {
    return `${getUserName(process.transferRecords[0].from)}（${i18next.t('ProcessTimeline.transferredTo')}${getUserName(process.transferRecords[0].to)}）`
  }

  if (getTimeoutAutoSource(flow)) {
    return getTimeoutAutoDirector(flow)
  }

  // 临时节点
  const finishFlowText = getFinishFlowText(flow)
  if (finishFlowText) {
    return finishFlowText
  }
  switch (flow.type) {
  case 'approval_temp':
    return `${getUserName(flow.operator)}（${
      flow.status === ProcessNodeStatus.FINISHED ?
        i18next.t('ProcessTimeline.approved') :
        flow.status === ProcessNodeStatus.BACK ? i18next.t('ProcessTimeline.rolledBack') : i18next.t('ProcessTimeline.rejected')
    }）`

  case 'transact_temp': {
    const status =
        flow.status === ProcessNodeStatus.FINISHED
          ? i18next.t('ProcessTimeline.handled')
          : flow.status === ProcessNodeStatus.BACK
            ? i18next.t('ProcessTimeline.rolledBack')
            : i18next.t('ProcessTimeline.handling')
    return `${getUserName(flow.operator)}（${status}）`
  }

  case 'notify_temp':
    return `${i18next.t('ProcessTimeline.cced')}${flow.data?.paddingOperators?.length}${i18next.t('ProcessTimeline.person')}`

  case 'condition-check': {
    const text = flow.data?.parent === 'transact' ? i18next.t('ProcessTimeline.handle') : i18next.t('ProcessTimeline.fill')
    return `${flow.status === ProcessNodeStatus.FINISHED ? `${text}${i18next.t('ProcessTimeline.condMeet')}，${text}${i18next.t('ProcessTimeline.complete')}` : `${text}${i18next.t('ProcessTimeline.condNotMeetContinue')}${text}`}`
  }
  }

  // 正式节点
  switch (flow.type) {
  case 'approval': {
    if (process.status === ProcessNodeStatus.IN_PROGRESS) {
      const approvalText =
          flow.options.categoryRule !== ApprovalCategoryRule.NORMAL || flow.options.approverType === ApproverType.SEQUENTIAL
            ? i18next.t('ProcessTimeline.passByOrderApproval')
            : flow.options.approverType === ApproverType.AND
              ? i18next.t('ProcessTimeline.needAllApproval')
              : i18next.t('ProcessTimeline.oneApprovalEnough')

      return `${(process.paddingOperators?.length || 0) - (process.operators?.length || 0)}${i18next.t('ProcessTimeline.approving')}${approvalText}`
    }

    if (flow.options.category !== ApprovalCategory.MANUAL) {
      return flow.options.category === ApprovalCategory.AUTO_APPROVE ? i18next.t('ProcessTimeline.autoApproved') : i18next.t('ProcessTimeline.autoRejected')
    }

    const number = process.paddingOperators?.length || 0
    const type =
        flow.options.categoryRule === ApprovalCategoryRule.STEP_BY_STEP
          ? i18next.t('ProcessTimeline.stepApproval')
          : flow.options.approverType === ApproverType.AND
            ? i18next.t('ProcessTimeline.jointSign')
            : flow.options.approverType === ApproverType.SEQUENTIAL
              ? i18next.t('ApprovalOption.sequentialApproval').replace(/\s*\(.+\)$/, '')
              : i18next.t('ProcessTimeline.orSign')
    return `${number}${i18next.t('ProcessTimeline.person')}${type}`
  }

  case 'transact': {
    if(flow.data?.children?.length) {
      return i18next.t('ProcessTimeline.passByHandleCond')
    }

    if (process.status === ProcessNodeStatus.BACK) {
      const userName = getUserName(process?.operators?.[0]) || getUserName(process?.paddingOperators?.[0])
      return `${userName}（${i18next.t('ProcessTimeline.rolledBack')}）`
    }

    if (process.status === ProcessNodeStatus.IN_PROGRESS) {
      const transactText =
          flow.options.transactorType === 'and'
            ? i18next.t('ProcessTimeline.needAllHandle')
            : flow.options.transactorType !== 'or'
              ? i18next.t('ProcessTimeline.passByOrderHandle')
              : i18next.t('ProcessTimeline.oneHandleEnough')

      return `${(process.paddingOperators?.length || 0) - (process.operators?.length || 0)}${i18next.t('ProcessTimeline.handlingPerson')}${transactText}`
    }

    const number = process.paddingOperators?.length || 0
    const type =
        flow.options.transactorType === 'and'
          ? i18next.t('ProcessTimeline.jointSign')
          : flow.options.transactorType !== 'or'
            ? i18next.t('ProcessTimeline.handleInTurn')
            : i18next.t('ProcessTimeline.orSign')
    return `${number}${i18next.t('ProcessTimeline.person')}${type}`
  }

  case 'notify': {
    const number = process.paddingOperators?.length || process.operators?.length
    return process.status === ProcessNodeStatus.FINISHED
      ? `${i18next.t('ProcessTimeline.cced')}${number}${i18next.t('ProcessTimeline.person')}`
      : `${i18next.t('ProcessTimeline.cc')}${number}${i18next.t('ProcessTimeline.person')}`
  }

  case 'add-data': {
    return getDataProcessingStatusText(flow.status)
  }

  case 'edit-data': {
    return getDataProcessingStatusText(flow.status)
  }

  case 'delete-data': {
    return getDataProcessingStatusText(flow.status)
  }

  case 'parallel-branch': {
    return i18next.t('ProcessTimeline.condMeetEnterBranch')
  }

  case 'condition-branch': {
    return i18next.t('ProcessTimeline.condMeetEnterBranch')
  }

  case 'end': {
    return i18next.t('ProcessTimeline.flowCompleted')
  }

  case 'trigger-data-change': {
    return getUserName(process?.operators?.[0]) || getUserName(process?.paddingOperators?.[0])
  }

  case 'trigger-operation': {
    return getUserName(process?.operators?.[0]) || getUserName(process?.paddingOperators?.[0])
  }

  case 'report-data': {
    if(flow.data?.children?.length) {
      return i18next.t('ProcessTimeline.passByFillCond')
    }
    if(flow.status && flow.status !== ProcessNodeStatus.NOT_STARTED) {
      const status = flow.status === ProcessNodeStatus.FINISHED ? i18next.t('ProcessTimeline.filled') : i18next.t('ProcessTimeline.filling')
      return getUserName(process?.operators?.[0]) || getUserName(process?.paddingOperators?.[0]) + `（${status}）`
    }
  }
  }

  // 兜底：返回第一个操作者
  return getUserName(process?.operators?.[0]) || getUserName(process?.paddingOperators?.[0])
}

const getUserName = (id: string) => {
  if (!id) {
    return null;
  }
  const user = organizeUtil.users.find(item => item.id === id)
  return getUserDisplayName(user)
}

const getPaddingOperators = (flow) => {
  const process = flow.data
  if(process) {
    if(flow.type === 'notify') {
      return process.paddingOperators || []
    }
    const result = process.paddingOperators?.filter(item => !process.operators?.includes(item))
    return result || []
  } else {
    return []
  }
}

const getTableName = (uid) => {
  const tables = nocode?.value?.body?.formData?.tables ?? []
  const table = tables.find(item => item.uid === uid)
  return table?.alias ?? ''
}

const getOpinionSource = (item) => {
  if (item.data?.opinionRecord) {
    return item.data.opinionRecord
  }

  if (isTimeoutAutoFlowItem(item) && item.timeoutAutoSource) {
    return item.timeoutAutoSource
  }

  const metas = item.data?.metas
  if (!metas) return null

  if ((item.type === 'approval_temp' || item.type === 'transact_temp') && item.operator && metas[item.operator]) {
    return metas[item.operator]
  }

  return Object.values(metas).find((meta: any) => {
    return meta?.comment || meta?.commentImages?.length || meta?.commentFiles?.length
  })
}

const getFlowOpinionDetail = (item) => {
  const source = getOpinionSource(item)
  if (!source) return null

  const comment = `${source.comment || ''}`.trim()
  const images = (source.commentImages || []).filter((file) => file?.name && file?.url)
  const files = (source.commentFiles || []).filter((file) => file?.name && file?.url)

  if (!comment && !images.length && !files.length) {
    return null
  }

  return {
    comment,
    images,
    files,
  }
}

const getFlowOpinionComment = (item) => {
  return getFlowOpinionDetail(item)?.comment || ''
}

const getFlowOpinionImages = (item): any[] => {
  return getFlowOpinionDetail(item)?.images || []
}

const getFlowOpinionFiles = (item) => {
  return getFlowOpinionDetail(item)?.files || []
}

const getFlowOpinionImageUrls = (item) => {
  return getFlowOpinionImages(item).map((file) => file.url)
}

const getTimeoutAutoOperationText = (item) => {
  const source = getTimeoutAutoSource(item)
  if (!source?.timeoutAutoAction) {
    return ''
  }
  if (!['submit', 'back'].includes(source.timeoutAutoAction)) {
    return ''
  }
  return i18next.t('ProcessTimeline.timeoutAutoOperation')
}

const escapeHtml = (value: unknown) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const getRawCommentHtml = (item) => {
  const metas = item.data?.metas
  const type = item.type

  if(type === 'add-data' || type === 'edit-data' || type === 'delete-data') {
    const optionTargetUID = item.options?.targetTableUID
    if(metas) {
      for(const key of Object.keys(metas)) {
        const targetTableUID = metas[key].targetTableUID
        const comment = metas[key].comment
        const tip = metas[key].tip
        if(comment) {
          return `${i18next.t('ProcessTimeline.targetForm')}${escapeHtml(getTableName(targetTableUID))}<br>${i18next.t('ProcessTimeline.completeStatusFail')}<br>${i18next.t('ProcessTimeline.failReason')}${escapeHtml(comment).replace(/\n/g, '<br>')}`
        }
        if(tip) {
          return `${i18next.t('ProcessTimeline.targetForm')}${escapeHtml(getTableName(targetTableUID))}<br>${i18next.t('ProcessTimeline.completeStatusSuccess')}<br>${i18next.t('ProcessTimeline.tipLabel')}${escapeHtml(tip).replace(/\n/g, '<br>')}`
        }
        if(targetTableUID) {
          return `${i18next.t('ProcessTimeline.targetForm')}${escapeHtml(getTableName(targetTableUID))}<br>${i18next.t('ProcessTimeline.completeStatusSuccess')}`
        }
      }
    } else if(optionTargetUID){
      return `${i18next.t('ProcessTimeline.targetForm')}${escapeHtml(getTableName(optionTargetUID))}`
    }
  }

  return ''
}

const hasFlowDetail = (item) => {
  return !!getTimeoutAutoOperationText(item) || !!getFlowOpinionDetail(item) || !!getRawCommentHtml(item)
}

const downloadFlowFile = async (file) => {
  if (!file?.url) return
  const response = await fetch(file.url)
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = file.name || 'download'
  document.body.appendChild(link)
  link.click()
  URL.revokeObjectURL(blobUrl)
  link.remove()
}

const getUserRelationSign = (type) => {
  const signMap = {
    [ApproverType.AND]: '+',
    [ApproverType.OR]: '/',
    [ApproverType.SEQUENTIAL]: '›',

  }
  return signMap[type]
}

const foldData = ref([])

const expandFlow = (flow, nodeType) => {
  const operators = Array.isArray(flow.data?.operators) ? flow.data.operators : []
  const typeKey = nodeType === 'approval_temp' ? 'approverType' : 'transactorType'
  const { manualOperatorIds, autoOperatorIds } = splitFlowOperatorsByTimeoutAutoAction(flow)
  const manualOperatorIdSet = new Set(manualOperatorIds)
  const autoOperatorIdSet = new Set(autoOperatorIds)
  const timeoutAutoSource = autoOperatorIds
    .map(userId => flow.data?.metas?.[userId])
    .find(source => ['submit', 'back'].includes(source?.timeoutAutoAction))

  const createManualNode = (operator) => ({
    ...flow,
    uid: unique(),
    type: nodeType,
    status: ProcessNodeStatus.FINISHED,
    operator,
    data: {
      ...flow.data,
      operators: [],
      paddingOperators: [],
    }
  })
  const createTimeoutAutoNode = () => ({
    ...flow,
    uid: unique(),
    type: nodeType,
    status: ProcessNodeStatus.FINISHED,
    operator: '',
    timeoutAutoOperatorIds: autoOperatorIds,
    timeoutAutoSource,
    data: {
      ...flow.data,
      operators: [],
      paddingOperators: [],
    }
  })

  const newNodes = []
  let timeoutAutoInserted = false
  for (const operator of operators) {
    if (autoOperatorIdSet.has(operator)) {
      if (!timeoutAutoInserted && timeoutAutoSource) {
        newNodes.push(createTimeoutAutoNode())
        timeoutAutoInserted = true
      }
      continue
    }
    if (manualOperatorIdSet.has(operator)) {
      newNodes.push(createManualNode(operator))
    }
  }
  if (!timeoutAutoInserted && timeoutAutoSource) {
    newNodes.push(createTimeoutAutoNode())
  }

  if (flow.status === ProcessNodeStatus.FINISHED) {
    if (flow.options[typeKey] === 'or') {
      let notifyData = props.processesData.find(
        p => p.flowId === flow.uid && p.type === ProcessNodeType.NOTIFY
      )
      if (notifyData) {
        notifyData = {
          ...notifyData,
          operators: [],
          paddingOperators: notifyData.operators,
        }
        const notifyFlow = {
          ...flow,
          uid: unique(),
          type: 'notify_temp',
          data: notifyData,
          status: ProcessNodeStatus.FINISHED,
          options: {
            ...flow.options,
            name: i18next.t('ProcessTimeline.autoCc'),
          }
        }
        newNodes.push(notifyFlow)
      }
    }
    return { replace: true, nodes: newNodes }
  }
  if(flow.status === ProcessNodeStatus.REJECTED) {
    const index = newNodes.findIndex(item => flow.data?.metas?.[item.operator]?.reject)
    if(index != -1) {
      const [item] = newNodes.splice(index, 1)
      newNodes.push({
        ...item,
        status: ProcessNodeStatus.REJECTED
      })
    }
    let notifyData = props.processesData.find(
      p => p.flowId === flow.uid && p.type === ProcessNodeType.NOTIFY
    )
    if (notifyData) {
      notifyData = {
        ...notifyData,
        operators: [],
        paddingOperators: notifyData.operators,
      }
      const notifyFlow = {
        ...flow,
        uid: unique(),
        type: 'notify_temp',
        data: notifyData,
        status: ProcessNodeStatus.FINISHED,
        options: {
          ...flow.options,
          name: i18next.t('ProcessTimeline.autoCc'),
        }
      }
      newNodes.push(notifyFlow)
    }
    return { replace: true, nodes: newNodes }
  }
  if(flow.status === ProcessNodeStatus.BACK) {
    const index = newNodes.findIndex(item => {
      if (isTimeoutAutoFlowItem(item)) {
        return Boolean(item.timeoutAutoSource?.back)
      }
      return flow.data?.metas?.[item.operator]?.back
    })
    if(index != -1) {
      const [item] = newNodes.splice(index, 1)
      newNodes.push({
        ...item,
        status: ProcessNodeStatus.BACK
      })
    }
    return { replace: true, nodes: newNodes }
  }
  if(flow.status === ProcessNodeStatus.CANCELED) {
    newNodes.push({
      ...flow,
      data: {
        ...flow.data,
        operators: [],
        paddingOperators: [],
      }
    })
    return { replace: true, nodes: newNodes }
  }

  // 未完成节点：在前面插入 newNodes，保留原节点
  return { replace: false, nodes: newNodes }
}

const flowLine = computed(() => {
  const processValue = deepClone(props.processesData)
  const result = []
  for(const process of processValue) {
    const flow = process.type === ProcessNodeType.TRIGGER_DATA_CHANGE ? processValue[0] : process
    const options = flow.options || {}
    const status = process.status || ProcessNodeStatus.NOT_STARTED
    const type = flow.type
    const uid = flow.flowId

    result.push({
      data: flow,
      options,
      status,
      type,
      uid,
      isStashed: process.isStashed,
      stashTime: process.stashTime,
      stashOperatorId: process.stashOperatorId,
    })
  }
  return result
});

const showFlowData = computed(() => {
  const result = deepClone(flowLine.value)

  // 遍历处理
  for (let i = 0; i < result.length; i++) {
    const flow = result[i]

    if(flow.status === ProcessNodeStatus.NOT_STARTED) {
      continue
    }
    if(flow.type === 'transact_temp' && !isTimeoutAutoFlowItem(flow)) {
      flow.operator = resolveTransactTempOperator(flow)
    }
    if(flow.type === 'condition-check') {
      flow.options.name = flow.data.flowName
    }
    if (
      (flow.type === ProcessNodeType.APPROVAL && flow.options.category === ApprovalCategory.MANUAL) ||
      (flow.type === ProcessNodeType.TRANSACT && !flow.data?.submitRecords?.length)
    ) {
      const { replace, nodes } = expandFlow(flow, `${flow.type}_temp`)
      result.splice(i, replace ? 1 : 0, ...nodes)
      if (!replace) i += nodes.length;
    }
    // 处理生成转交记录节点
    if(flow.data?.transferRecords?.length && flow.type.split('_').length === 1) {
      const transferNodes = flow.data.transferRecords.map((record, index) => ({
        ...flow,
        uid: unique(),
        type: `${flow.type}_temp`,
        status: ProcessNodeStatus.TRANSFERED,
        data: {
          ...flow.data,
          paddingOperators: [],
          transferRecords: [{
            ...record,
          }]
        }
      }))
      result.splice(i, 0, ...transferNodes)
      i += transferNodes.length
    }
  }

  // 过滤原先的自动抄送数据
  for (let i = 0; i < result.length - 1; i++) {
    if (
      result[i].type === 'notify_temp' && 
      result[i + 1].type === 'notify' && 
      result[i].data.flowId === result[i+1].data.flowId
    ) {
      result.splice(i + 1, 1)
      i--
    }
  }

  foldData.value = result.map(i => {
    if(i.status === ProcessNodeStatus.NOT_STARTED) {
      return true
    }
    return false
  })
  return result
})
</script>

<style lang='scss' scoped>
.process-timeline {
  position: relative;

  .custom-dot {
    position: absolute;
    width: 32px;
    height: 32px;
    background-color: #1f77fc;
    border-radius: 50%;
    left: -10px;
    top: -3px;
    display: flex;
    justify-content: center;
    align-items: center;

    .el-icon {
      color: var(--color-white);
      font-size: 16px;
    }

    &.start {
      background-color: #82bd53;
    }

    &.trigger-data-change {
      background-color: #82bd53;
    }

    &.trigger-operation {
      background-color: #4d8bfd;
    }

    &.trigger-time-task {
      background-color: #33b4c2;
    }


    &.approval {
      background-color: #fa9830;
    }

    &.notify {
      background-color: #398bfc;
    }

    &.transact {
      background-color: #f9704a;
    }

    &.add-data {
      background-color: #f3b635;
    }

    &.edit-data {
      background-color: #4c86eb;
    }

    &.delete-data {
      background-color: #f9706c;
    }

    &.condition-branch {
      background-color: #dc84c6;
    }

    &.parallel-branch { 
      background-color: #d4c042;
    }

    &.end {
      background-color: #D0D0D0;
    }

    &.report-data {
      background-color: #00A38D;
    }

    &.condition-check {
      background-color: #36a7fd;
    }

    .dot-icon {
      position: absolute; 
      top: -8px;
      right: -8px;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;

      .skip-badge {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background-color: #bfbfbf;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 0 2px #fff;
      }

      .skip-line {
        width: 8px;
        height: 2px;
        border-radius: 999px;
        background-color: #fff;
      }
    }
  }

  .item-header {
    font-size: 12px;
    display: flex;
    margin: 0px 0px 8px 0px;

    .type {
      color: var(--text-color-regular);
      display: flex;
      align-items: center;
      text-wrap: nowrap;

      .stash-tag {
        margin-left: 4px;
        padding: 0 4px;
        height: 16px;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 2px;
        color: #1677ff;
        background-color: #eff6ff;
        text-wrap: nowrap;
      }

      div {
        margin-left: 4px;
        background-color: var(--color-primary-light-7);
        padding: 0px 4px;
        height: 16px;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 2px;
        color: var(--color-primary);
        text-wrap: nowrap;
      }
    }

    .time {
      color: var(--text-color-secondary);
      margin-left: auto;
    }
  }

  .item-status {
    display: flex;
    font-size: 12px;
    align-items: center;
    margin-bottom: 8px;
    min-width: 216px;
    
    .name {
      color: var(--text-color-placeholder);
      text-wrap: nowrap;
    }

    .el-icon {
      margin-left: auto;
      cursor: pointer;
    }
    
    .is-read {
      color: var(--color-primary);
      margin-left: 8px;
    }
  }

  .item-body {
    height: auto;
    background-color: var(--bg-color-overlay);
    border-radius: 4px;
    font-size: 12px;
    padding: 8px;
    color: var(--text-color-placeholder);
    line-height: 16px;
    min-width: 216px;

    ul {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;

      li {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px;

        .user-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          width: 24px;

          .avatar {
            width: 24px;
            height: 24px;
            margin-bottom: 4px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 14px;
            color: var(--color-white);
            overflow: hidden;
          }

          .name {
            width: 35px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: center;
          }
        }

        .relation-text {
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 20px;
          padding-bottom: 16px;
        }
      }
    }

    &.detail-body {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .comment-text {
        white-space: pre-wrap;
        word-break: break-word;
      }

      .detail-section {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .section-label {
          color: var(--text-color-regular);
        }
      }

      .image-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .image-item {
          width: 72px;
          position: relative;

          .el-image {
            width: 72px;
            height: 72px;
            border-radius: 4px;
            overflow: hidden;
            cursor: var(--cursor-pointer);
          }
        }
      }

      .file-list {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .file-item {
          display: flex;
          align-items: center;
          gap: 8px;

          .file-name {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }

      .download-btn {
        width: 20px;
        height: 20px;
        min-height: 20px;
        padding: 0;
        border-radius: 999px;
      }

      .image-download-btn {
        position: absolute;
        right: 4px;
        top: 4px;
        background-color: rgb(0 0 0 / 45%);
        color: var(--color-white);
      }

      .file-download-btn {
        margin-left: auto;
        color: var(--text-color-secondary);
      }
    }
  }
}

:deep(.is-last > .el-timeline-item__tail) {
  display: none !important;
}

:deep(.not-last > .el-timeline-item__tail) {
  display: unset !important;
}

:deep(.is-started > .el-timeline-item__tail) {
  border-left: 2px solid var(--border-color);
}

:deep(.not-started > .el-timeline-item__tail) {
  border-left: 2px dashed var(--border-color);
}
</style>
