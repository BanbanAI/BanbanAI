<template>
  <div class="branch-setting-node" :class="{
    otherBranch: props.node.isOtherBranch,
    inValid: hasHardError,
    softIssue: hasSoftIssue,
  }">
    <div class="error-box">
      <el-tooltip :content="visualErrorMessage" placement="top" effect="light">
        <el-icon :size="24">
          <i-ep-warning-filled></i-ep-warning-filled>
        </el-icon>
      </el-tooltip>
    </div>
    <div class="label-box" v-if="!isRename">
      <div :class="['label', { other: props.node.isOtherBranch}]" @click.stop="clickRenameButton">
        <div class="label-text">
          {{ props.node.isOtherBranch ? $t('BranchSettingNode.otherBranch') : props.node.title }}
        </div>
        <el-icon v-if="!props.node.isOtherBranch">
          <i-nocode-flow-edit-pen />
        </el-icon>
      </div>
      <div class="menus" v-if="!props.node.isOtherBranch && structureEditable">
        <div class="btn" @click.stop="emit('copy', node)">
          <el-icon
            :title="$t('BranchSettingNode.copy')"><i-ep-copy-document></i-ep-copy-document></el-icon>
        </div>
        <div class="btn" @click.stop="emit('delete', node)">
          <el-icon
           :title="$t('BranchSettingNode.delete')"><i-ep-close></i-ep-close></el-icon>
        </div>
      </div>
      <div
        class="subtitle"
        v-if="!props.node?.isOtherBranch && props.node?.parent?.getOwner()?.getFlow()?.type != ProcessNodeType.PARALLEL_BRANCH"
      >
        {{$t('BranchSettingNode.priority')}}{{ props.node.branchIndex + 1 }}
      </div>
    </div>
    <el-input v-else v-model="renameValue" ref="inputRef" @keydown.enter="handleRenameEnter()" @blur="handleRename()"
      @click.stop></el-input>
    <hr>
    <div class="content-box">
      <div class="content" style="white-space: pre-line"
        :title="props.node.isOtherBranch ? $t('BranchSettingNode.otherBranchTip') : props.node.content">
        {{ props.node.isOtherBranch ? $t('BranchSettingNode.otherBranchTip') : props.node.content }}
      </div>
      <el-icon v-if="!props.node.isOtherBranch"><i-ep-arrow-right /></el-icon>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { ProcessNodeType } from '@common/types/project';
import i18next from 'i18next';
import { computed, nextTick, onMounted, ref } from 'vue';
import { ProcessNode } from '../process';
import { useProcessNodeIssueMap, useProcessStructureEditable } from '../../hooks';

const props = defineProps<{
  node: ProcessNode;
}>();

const emit = defineEmits<{
  (event: "copy", data: ProcessNode): void;
  (event: "delete", data: ProcessNode): void;
}>();

const isRename = ref(false)
const renameValue = ref('')
const inputRef = ref(null)
const structureEditable = useProcessStructureEditable();
const processNodeIssueMap = useProcessNodeIssueMap()
const hardErrorMessage = computed(() => (
  props.node.errorMsg
  || (!props.node.valid ? i18next.t('BranchSettingNode.setCondition') : '')
))
const softIssueMessage = computed(() => processNodeIssueMap.value?.[props.node.uid] || '')
const visualErrorMessage = computed(() => (
  hardErrorMessage.value
  || softIssueMessage.value
))
const hasHardError = computed(() => !props.node.valid)
const hasSoftIssue = computed(() => props.node.valid && Boolean(softIssueMessage.value))

const clickRenameButton = () => {
  if (props.node.isOtherBranch) {
    return
  }
  isRename.value = true
  renameValue.value = props.node.title;
  nextTick(() => {
    inputRef.value.focus()
  })
}

const handleRenameEnter = () => {
  if (isRename.value) {
    inputRef.value.blur()
  }
}

const handleRename = () => {
  isRename.value = false
  if (renameValue.value.trim() != "") {
    props.node.options.name = renameValue.value
    props.node.parent.updateHistory();
  }
}

</script>

<style lang='scss' scoped>
.branch-setting-node {
  padding: 4px;
  width: 240px;
  border-radius: 8px;
  background-color: var(--color-white);
  border: 1px solid var(--border-color);
  cursor: pointer;
  position: relative;

  &.otherBranch {
    .label-box {
      .label {
        color: var(--text-color-secondary);
      }
    }
  }

  /* 外层边框 */
  &::after {
    content: "";
    position: absolute;
    top: -8px;
    /* 往外扩 8px */
    left: -8px;
    right: -8px;
    bottom: -8px;
    pointer-events: none;
    /* 避免影响点击事件 */
    z-index: -10;
    border-radius: 16px;
    transition: all 0.3s ease;
    background-color: transparent;
  }

  &:hover::after {
    background-color: rgba(222, 224, 231, 0.5);
  }

  .error-box {
    position: absolute;
    width: 24px;
    height: 24px;
    right: -35px;
    top: 0;
    color: var(--color-danger);
    display: none;
  }

  &.inValid {
    border: 1px solid #FF4D4F;

    &::after {
      background-color: #FF4D4F33;
    }

    .error-box {
      display: block;
    }
  }

  &.softIssue {
    border: 1px solid #FAAD14;

    &::after {
      background-color: rgba(250, 173, 20, 0.2);
    }

    .error-box {
      color: #FA8C16;
      display: block;
    }
  }

  :deep(.el-input) {
    margin-bottom: 8px;
    height: 24px;
    border-radius: 4px;
    overflow: hidden;

    .el-input__wrapper {
      border-radius: 4px;
      border: #1f77fc 1px solid;
      box-shadow: none !important;
    }
  }

  .label-box {
    display: flex;
    align-items: center;
    margin-bottom: 8px;

    .label {
      
      font-weight: 400;
      
      font-size: 12px;
      line-height: 16px;
      letter-spacing: 0%;
      color: var(--color-primary-light-3);
      padding: 4px 8px;
      display: flex;
      min-width: none;
      align-items: center;
      gap: 4px;

      .label-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        max-width: 80px;
      }

      .el-icon {
        opacity: 0;
      }

      &:not(.other):hover {
        background-color: rgba(245, 246, 247, 1);
        border-radius: 4px;
        transition: all 0.2s ease;
      }
    }

    .menus {
      margin-left: auto;
      color: var(--text-color-secondary);
      opacity: 0;
      margin-right: 8px;
      font-size: 14px;
      display: flex;
      gap: 8px;

      .btn {
        width: 18px;
        height: 18px;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 2px;

        &:hover {
          background-color: var(--bg-color-overlay);
        }
      }
    }

    .subtitle {
      margin-right: 8px;
      color: var(--color-primary-light-3);
    }

    .subtitle-other {
      margin-left: auto;
      margin-right: 8px;
      color: var(--text-color-secondary);
    }
  }

  &:hover {
    .label .el-icon {
      opacity: 1;
    }

    .menus {
      opacity: 1;
    }

    .subtitle {
      display: none;
    }
  }

  hr {
    border: 0;
    /* 先清除默认 */
    border-top: 1px solid var(--border-color);
    margin-bottom: 8px;
  }

  .content-box {
    padding: 8px 4px 8px 8px;
    background-color: var(--color-white);
    border-radius: 4px;
    display: flex;
    align-items: center;

    .content {
      
      font-weight: 400;
      
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
      color: var(--text-color-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .el-icon {
      margin-left: auto;
      font-size: 14px;
    }
  }
}
</style>
