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
      :class="{ 'is-chat-active': active, 'is-btn-active': isBtnActive }"
      @click.stop
    >
      <el-icon size="12"><i-ep-more-filled /></el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="toggle-pinned">
          <el-icon size="16"><i-ven-ai-pin /></el-icon>
          {{ pinned ? $t('WorkbenchAiNavChatDropdown.cancelPin') : $t('WorkbenchAiNavChatDropdown.pin') }}
        </el-dropdown-item>
        <el-dropdown-item command="rename">
          <el-icon size="16"><i-ven-ai-whrite /></el-icon>
          {{ $t('WorkbenchAiNavChatDropdown.rename') }}
        </el-dropdown-item>
        <el-dropdown-item command="hide">
          <el-icon size="16"><i-ant-design-eye-invisible-outlined /></el-icon>
          {{ $t('WorkbenchAiNavChatDropdown.hide') }}
        </el-dropdown-item>
        <el-dropdown-item command="delete" divided>
          <el-icon size="16"><i-ven-ai-delete /></el-icon>
          {{ $t('WorkbenchAiNavChatDropdown.delete') }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang='ts'>
import { ref } from 'vue';

defineProps({
  pinned: {
    type: Boolean,
    default: false,
  },
  active: {
    type: Boolean,
    default: false,
  },
});

const isBtnActive = ref(false);

const emit = defineEmits(['command', 'visible-change']);

const handleVisibleChange = (visible: boolean) => {
  isBtnActive.value = visible;
  emit('visible-change', visible);
};

const handleCommand = (command: string | number | object) => {
  emit('command', command);
};
</script>

<style scoped lang='scss'>
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

  &.is-chat-active {
    color: #165dff;
    
    &.is-btn-active {
      background-color: #d4e8ff;
    }

    &:hover {
      background-color: #d4e8ff;
    }
  }
}
</style>

<style lang="scss">
.el-popper.ai-nav__chat-dropdown-popper {
  --el-dropdown-menuItem-hover-color: inherit;
  --el-dropdown-menuItem-hover-fill: #F2F3F5;
  margin-top: -5px;
  
  border: 1px solid #E5E6EB;
  border-radius: 8px !important;
  padding: 0;
  background-color: #fff;
  box-shadow: 0 8px 24px rgba(29, 33, 41, 0.12) !important;
  .el-dropdown-menu {
    min-width: 132px;
    background-color: #fff;
    padding: 4px;
    border-radius: 8px !important;
  }
  .el-dropdown-menu__item {
    border-radius: 4px;
    padding-left: 12px;
  }
  .el-dropdown-menu__item:hover {
    background-color: #F2F3F5;
  }
  .el-dropdown-menu__item--divided {
    margin: 4px 0;
  }
}
</style>
