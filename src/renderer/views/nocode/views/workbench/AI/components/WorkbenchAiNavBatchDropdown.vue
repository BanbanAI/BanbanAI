<template>
  <el-dropdown
    trigger="click"
    placement="bottom-start"
    :show-arrow="false"
    popper-class="ai-nav__chat-dropdown-popper"
    @visible-change="handleVisibleChange"
    @command="handleCommand"
  >
    <button
      type="button"
      class="ai-nav__chat-more-btn"
      :class="{ 'is-btn-active': isBtnActive }"
      @click.stop
    >
      <el-icon size="12"><i-ep-more-filled /></el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="delete-unshared">
          <el-icon size="16"><i-ven-ai-delete /></el-icon>
          {{ $t('WorkbenchAiNavBatchDropdown.deleteUnshared') }}
        </el-dropdown-item>
        <el-dropdown-item command="unhide-all" divided>
          <el-icon size="16"><i-ant-design-eye-outlined /></el-icon>
          {{ $t('WorkbenchAiNavBatchDropdown.showAllConversations') }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
  <tip-dialog
    ref="deleteUnsharedDialogRef"
    :title="$t('WorkbenchAiNavBatchDropdown.deleteUnsharedTitle')"
    :content="$t('WorkbenchAiNavBatchDropdown.deleteUnsharedTip')"
    :confirmText="$t('WorkbenchAiNavBatchDropdown.deleteUnsharedConfirm')"
    :cancelText="$t('WorkbenchAiNavBatchDropdown.cancelText')"
    :closeOnClickModal="true"
  />
  <tip-dialog
    ref="unhideAllDialogRef"
    :title="$t('WorkbenchAiNavBatchDropdown.showAllTitle')"
    :content="$t('WorkbenchAiNavBatchDropdown.showAllTip')"
    :confirmText="$t('WorkbenchAiNavBatchDropdown.showAllConfirm')"
    :cancelText="$t('WorkbenchAiNavBatchDropdown.cancelText')"
    :closeOnClickModal="true"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TipDialog from '@renderer/views/nocode/dialog/TipDialog.vue';

const isBtnActive = ref(false);
const deleteUnsharedDialogRef = ref();
const unhideAllDialogRef = ref();

const emit = defineEmits(['command', 'visible-change']);

const handleVisibleChange = (visible: boolean) => {
  isBtnActive.value = visible;
  emit('visible-change', visible);
};

const handleCommand = async (command: string | number | object) => {
  const normalizedCommand = String(command || '');
  if (normalizedCommand === 'delete-unshared') {
    const confirmed = await deleteUnsharedDialogRef.value?.confirm();
    if (confirmed) {
      emit('command', normalizedCommand);
    }
    return;
  }
  if (normalizedCommand === 'unhide-all') {
    const confirmed = await unhideAllDialogRef.value?.confirm();
    if (confirmed) {
      emit('command', normalizedCommand);
    }
  }
};
</script>

<style scoped lang="scss">
.ai-nav__chat-more-btn {
  width: 24px;
  height: 24px;
  margin-left: 4px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #4E5969;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;

  &:hover {
    background-color: #e5e6eb;
  }

  &.is-btn-active {
    background-color: #e5e6eb;
  }
}
</style>
