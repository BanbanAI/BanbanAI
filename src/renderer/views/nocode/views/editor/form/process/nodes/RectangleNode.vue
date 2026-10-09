<template>
  <div
    class="rectangle-node" 
    :class="[
      props.node.type,
      {
        active: false,
        inValid: hasHardError,
        softIssue: hasSoftIssue,
      }
    ]"
  >
    <div class="error-box">
      <el-tooltip :content="visualErrorMessage" placement="top" effect="light">
        <el-icon :size="24">
          <i-ep-warning-filled/>
        </el-icon>
      </el-tooltip>
    </div>
    <div class="label-box" v-if="!isRename">
      <div class="label"  @click="clickRenameButton" @click.stop>
        <div class="label-text">
          {{ props.node.title }}
        </div>
        <el-icon>
          <i-nocode-flow-edit-pen/>
        </el-icon>
      </div>
      <div v-if="structureEditable" class="close-btn" :title="$t('RectangleNode.delete')" @click.stop="emit('delete', node)">
        <el-icon><i-ep-close/></el-icon>
      </div>
      <div class="subtitle">{{ $t('RectangleNode.priority') }}</div>
    </div>
    <el-input v-else v-model="renameValue" ref="inputRef" @keydown.enter="handleRenameEnter()" @blur="handleRename()" @click.stop></el-input>
    <hr>
    <div class="content-box">
      <div class="content" :title="props.node.content">
        {{ props.node.content }}
      </div>
      <el-icon><i-ep-arrow-right/></el-icon>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { computed, nextTick, ref } from 'vue';
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
const visualErrorMessage = computed(() => (
  props.node.errorMsg
  || processNodeIssueMap.value?.[props.node.uid]
  || ''
))
const hasHardError = computed(() => !props.node.valid)
const hasSoftIssue = computed(() => props.node.valid && Boolean(processNodeIssueMap.value?.[props.node.uid]))

const clickRenameButton = () => {
  isRename.value = true
  renameValue.value = props.node.title;
  nextTick(() => {
    inputRef.value.focus()
  })
}

const handleRenameEnter = () => {
  if(isRename.value) {
    inputRef.value.blur()
  }
}

const handleRename = () => {
  isRename.value = false
  if(renameValue.value.trim() != "") {
    props.node.options.name = renameValue.value
    props.node.parent.updateHistory();
  }
}

</script>

<style lang='scss' scoped>
.rectangle-node {
  padding: 4px;
  width: 240px;
  border-radius: 8px;
  background-color: var(--color-white);
  border: 1px solid var(--border-color);
  cursor: pointer;
  position: relative;

  .error-box {
    position: absolute;
    width: 24px;
    height: 24px;
    right: -35px;
    top: 0;
    color: var(--color-danger);
    display: none;
  }

  @mixin node-label-box {
    .label-box {

      .label {
        color: var(--color-white);
        display: flex;
        min-width: none;
        align-items: center;
        gap: 4px;

        .label-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          max-width: 150px;
        }
  
        &:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
      }
  
      .close-btn {
        color: var(--color-white);
      }
  
      .subtitle {
        display: none;
      }
    }

    :deep(.el-input__wrapper) {
      border: 0 !important;
    }

    hr {
      display: none;
    }
  }

  /* 外层边框 */
  &::after {
    content: "";
    position: absolute;
    top: -8px;   /* 往外扩 8px */
    left: -8px;
    right: -8px;
    bottom: -8px;
    pointer-events: none; /* 避免影响点击事件 */
    z-index: -10;
    border-radius: 16px;
    background-color: transparent;
    transition: all 0.3s ease;
  }

  &.trigger-data-change {
    background-color: #6cb238;
    border: none;
    @include node-label-box;

    &:hover::after {
      background-color: rgba(114, 178, 66, 0.2);
    }
  }

  &.trigger-time-task {
    background-color: #13b3c2 ;
    border: none;
    @include node-label-box;

    &:hover::after {
      background-color: rgba(19, 179, 194, 0.2);
    }
  }

  &.trigger-operation {
    background: linear-gradient(180deg, #c79aef 0%, #bb8ce8 100%);
    border: none;
    box-shadow: 0 10px 24px rgba(187, 140, 232, 0.18);
    @include node-label-box;

    &:hover::after {
      background-color: rgba(187, 140, 232, 0.32);
    }

    .content-box {
      box-shadow: inset 0 0 0 1px rgba(187, 140, 232, 0.18);

      .el-icon {
        color: #6f4aa6;
      }
    }
  }

  &.approval {
    background-color: #fa8515;
    border: none;
    @include node-label-box;

    &:hover::after {
      background-color: rgba(245, 131, 32, 0.2);
    }
  }

  &.notify {
    background-color: #1f77fc;
    border: none;
    @include node-label-box;
    &:hover::after {
      background-color: rgba(31, 119, 252, 0.2);
    }



    :deep(.el-input__wrapper) {
      border: 0 !important;
    }

    hr {
      display: none;
    }
  }

  &.transact {
    background-color: #f9572b;
    border: none;
    @include node-label-box;

    &:hover::after {
      background-color: #f9572b33;
    }
  }

  &.add-data {
    background-color: #f5ab00;
    border: none;
    @include node-label-box;

    &:hover::after {
      background-color: #f5ab0033;
    }
  }

  &.edit-data {
    background-color: #266eeb;
    border: none;
    @include node-label-box;

    &:hover::after {
      background-color: #266eeb33;
    }
  }

  &.delete-data {
    background-color: #ff5a52;
    border: none;
    @include node-label-box;

    &:hover::after {
      background-color: #ff5a5233;
    }
  }

  &.report-data {
    background-color: #00A38D;
    border: none;
    @include node-label-box;

    &:hover::after {
      background-color: #00a38d33;
    }
  }

  &.inValid {
    border: 1px solid #FF4D4F;

    &::after {
      background-color: #FF4D4F33 !important;
    }

    .error-box {
      display: block;
    }
  }

  &.softIssue {
    border: 1px solid #FAAD14;

    &::after {
      background-color: rgba(250, 173, 20, 0.2) !important;
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
      color: var(--text-color-secondary);
      padding: 4px 8px;
      display: inline-block;

      .el-icon {
        opacity: 0;
      }

      &:hover {
        background-color: rgba(245, 246, 247, 1);
        border-radius: 4px;
        transition: all 0.2s ease;
      }
    }

    .close-btn {
      width: 18px;
      height: 18px;
      margin-left: auto;
      color: var(--text-color-secondary);
      opacity: 0;
      margin-right: 8px;
      font-size: 14px;
      display: flex;
      gap: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
      &:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
    }

    .subtitle {
      margin-right: 8px;
      color: var(--text-color-secondary);
    }
  }

  &:hover {
    .label .el-icon {
      opacity: 1;
    }

    .close-btn {
      opacity: 1;
    }

    .subtitle {
      display: none;
    }
  }

  hr {
    border: 0; /* 先清除默认 */
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
      color: var(--text-color-regular);
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
