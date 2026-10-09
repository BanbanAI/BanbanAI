<template>
  <div class="select-users" @click="handleShowSelectUsersDialog">
    <div class="empty" v-if="!users.length">
      <el-icon :size="16"><i-ep-plus /></el-icon>
      {{ $t('SelectUsers.selectUser') }}
    </div>
    <el-scrollbar v-else>
      <div class="users-wrapper">
        <el-tag type="info" v-for="user in users" :key="user.id" closable @close="handleDelete(user)">{{ user.realname || user.user }}</el-tag>
      </div>
    </el-scrollbar>
    <workbench-select-users-dialog ref="selectUserToRoleDialogRef" @confirm="handleConfirm" @click.stop />
  </div>
</template>

<script lang='ts' setup>
import { NocodeUser } from '@common/types/account';
import { ORGANIZE_UTIL } from '@renderer/types';
import { computed, inject, ref } from 'vue';

const props = defineProps<{
  userIds: string[],
}>();

const emit = defineEmits<{
  (event: 'update:userIds', userIds: string[]): void,
}>();

const organizeUtil = inject(ORGANIZE_UTIL);

const selectUserToRoleDialogRef = ref();
const users = computed(() => {
  return organizeUtil?.allUsers.filter(user => props.userIds.includes(user.id)) || [];
});
const handleShowSelectUsersDialog = () => {
  selectUserToRoleDialogRef.value?.show(users.value);
}
const handleDelete = (user: NocodeUser) => {
  const ids = props.userIds.filter(id => id !== user.id);
  emit('update:userIds', ids);
}
const handleConfirm = (userIds: string[]) => {
  emit('update:userIds', userIds);
}
</script>

<style lang='scss' scoped>
.select-users {
  width: 100%;
  height: 88px;
  border-radius: 4px;
  background-color: var(--bg-color-page);
  border: 1px dashed var(--border-color);
  cursor: pointer;

  .empty {
    height: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    color: var(--text-color-secondary);
    font-size: 14px;

    i {
      margin-right: 2px;
    }

    &:hover {
      color: unset;
    }
  }

  .users-wrapper {
    padding: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

  }
}
</style>