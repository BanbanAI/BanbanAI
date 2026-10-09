<template>
  <div class="b2-option-group-overflow" @click.stop="emit('click')" v-if="!visible">
    <el-icon v-if="locked" size="16"><i-ep-lock /></el-icon>
    <el-icon v-else size="16" style="transform: rotate(90deg);"><i-ep-more-filled /></el-icon>
  </div>
  <el-popover v-else :visible="visible" popper-class="b2-option-group-overflow-popper">
    <div v-for="item in items">
      <div @click="handleAction(item.role)" :class="(item.role === 'lock' && alwaysLocked) ? 'disabled' : ''" :key="item.role" class="overflow-item">
        <el-icon size="16"><component :is="item.icon"></component></el-icon>
        <span>{{ item.label }}</span>
      </div>
    </div>
    <template #reference>
      <div class="b2-option-group-overflow" @click.stop="emit('click')">
        <el-icon v-if="locked" size="16"><i-ep-lock /></el-icon>
        <el-icon v-else size="16" style="transform: rotate(90deg);"><i-ep-more-filled /></el-icon>
      </div>
    </template>
  </el-popover>
</template>

<script lang="ts" setup>
import { ElMessage } from 'element-plus';
import { computed, inject, ref } from 'vue';
import { ParsedOptionGroups, DefinedOption, DefinedOptionSubgroup, DefinedOptionCluster, isOptionCluster, isOptionSubgroup, DefinedOptionGroup } from './types';
import { Element } from '@renderer/b2/controllers/element';
import { BULK_UPDATE_VALUE } from './inject';
import i18next from 'i18next';

const props = defineProps<{
  element: Element,
  visible: boolean,
  group: GetElementType<ParsedOptionGroups>,
}>();
const emit = defineEmits(['click', 'hide']);
const bulkUpdateValue = inject(BULK_UPDATE_VALUE);

const groupName = props.group.group;
const groupLockedStatus = props.element.getGroupStatus(groupName)?.locked;
const alwaysLocked = ref(groupLockedStatus === "always-locked");
const locked = ref(alwaysLocked.value || groupLockedStatus === 'locked' || groupLockedStatus === true || false);

const items = computed(() => [
  { label: locked.value ? i18next.t("optionGroupUnlock") : i18next.t("optionGroupLock"), icon: locked.value ? IEpUnlock : IEpLock, role: 'lock' },
  { label: i18next.t("optionGroupReset"), icon: IAntDesignRollbackOutlined, role: 'reset' }
]);

const handleAction = (role) => {
  if (alwaysLocked.value) {
    ElMessage.warning(i18next.t("optionGroupNotSupportUnlock"));
  } else if (role === 'lock') {
    locked.value = !locked.value;
    bulkUpdateValue((element) => {
      element.setGroupStatus(groupName, "locked", locked.value ? "locked" : "unLocked");
    })
  } else if (role === 'reset') {
    for(const child of props.group.children){
      resetOption(child);
    }
  }
  emit('hide');
}
const resetOption = (option: DefinedOption | DefinedOptionSubgroup | DefinedOptionCluster) => {
  if(isOptionCluster(option)){
    props.element.unsetOption(option.name);
  }else if(isOptionSubgroup(option)){
    for(const child of option.children){
      resetOption(child);
    }
  }else{
    props.element.unsetOption(option.name);
  }
}
</script>

<style lang="scss" scoped>
.b2-option-group-overflow {
  position: relative;
  margin-left: 5px;
}
</style>

<style lang="scss">
.el-popover.el-popper.b2-option-group-overflow-popper {
  padding: 5px 0;
  .overflow-item {
    padding: 5px 10px;
    display: flex;
    align-items: center;
    cursor: pointer;

    i {
      margin-right: 10px;
    }

    &:hover {
      background-color: var(--bg-color-hover);
    }

    &.disabled{
      opacity: 0.4;
    }
  }
}
</style>