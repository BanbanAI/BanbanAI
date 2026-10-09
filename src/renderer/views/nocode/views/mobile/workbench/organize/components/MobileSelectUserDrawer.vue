<!-- MobileSelectUserDrawer -->
<template>
  <div class="mobile-select-user-drawer-overlay" @click="handleCancel">
    <div class="drawer-content" @click.stop>
      <!-- 头部 -->
      <div class="header">
        <span class="clear-btn" @click="handleClear">{{ $t('MobileSelectUserDrawer.clear') }}</span>
      </div>

      <!-- 搜索框 -->
      <div class="search-container">
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M192 448c0-141.152 114.848-256 256-256s256 114.848 256 256-114.848 256-256 256-256-114.848-256-256z m710.624 409.376l-206.88-206.88A318.784 318.784 0 0 0 768 448c0-176.736-143.264-320-320-320S128 271.264 128 448s143.264 320 320 320a318.784 318.784 0 0 0 202.496-69.248l206.88 206.88a32 32 0 1 0 45.248-45.248z" fill="#8e8e93"></path></svg>
          <input type="text" v-model="searchValue" :placeholder="$t('MobileSelectUserDrawer.search')" class="search-input" />
        </div>
      </div>

      <!-- 选择列表 -->
      <div class="list-container">
        <div class="list-item" @click="handleSelectAll" v-if="multiple">
           <el-checkbox
             :model-value="isSelectAll"
             :indeterminate="isIndeterminateAll"
             size="large"
           />
           <span class="item-name">{{ $t('MobileSelectUserDrawer.selectAll') }}</span>
        </div>
        <div class="list-item" v-for="user in displayUsers" :key="user.id" @click="handleUserClick(user)">
          <el-checkbox
            :model-value="isSelected(user.id)"
            :disabled="isDisabled(user.id)"
            size="large"
          />
          <span class="item-name">{{ user.realname || user['name'] }}</span>
        </div>
         <div v-if="displayUsers.length === 0" class="empty-list">
          {{ $t('MobileSelectUserDrawer.noMatchResult') }}
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="footer">
        <el-button class="btn cancel" type="default" @click="handleCancel">{{ $t('MobileSelectUserDrawer.cancel') }}</el-button>
        <el-button class="btn confirm" type="primary" :disabled="allUsers.length === 0" @click="handleConfirm">{{ $t('MobileSelectUserDrawer.transfer') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, inject, onMounted, nextTick, watch } from 'vue';
import { Account, NocodeUser } from '@common/types/account';
import { ORGANIZE_UTIL } from '@renderer/types';
import { deepClone } from '@common/utils/object';
import { OrganizeUtil } from '@renderer/views/nocode/utils';

const props = withDefaults(defineProps<{
  multiple?: boolean;
  disabledUid?: string[];
  users?: NocodeUser[] | null;
}>(), {
  multiple: false,
  disabledUid: () => [],
  users: null,
});

const emits = defineEmits(['confirm', 'cancel']);

const organizeUtil = inject(ORGANIZE_UTIL);
// const organizeUtil = new OrganizeUtil();

const searchValue = ref('');
const allUsers = ref<NocodeUser[]>([]);
const selectedUserIds = ref(new Set<string>());

const displayUsers = computed(() => {
  const search = searchValue.value.trim().toLowerCase();
  if (!search) {
    return allUsers.value;
  }
  return allUsers.value.filter(user => 
    (user.realname || user['name'] || '').toLowerCase().includes(search)
  );
});

const isSelectAll = computed(() => {
  const availableUsers = displayUsers.value.filter(u => !isDisabled(u.id));
  if (availableUsers.length === 0) return false;
  return availableUsers.every(u => selectedUserIds.value.has(u.id));
});

const isIndeterminateAll = computed(() => {
  const availableUsers = displayUsers.value.filter(u => !isDisabled(u.id));
  const selectedCount = availableUsers.filter(u => selectedUserIds.value.has(u.id)).length;
  return selectedCount > 0 && selectedCount < availableUsers.length;
});

const isSelected = (id: string) => selectedUserIds.value.has(id);
const isDisabled = (id: string) => props.disabledUid?.includes(id);

const initData = async () => {
  if (Array.isArray(props.users)) {
    allUsers.value = props.users;
    return;
  }
  await organizeUtil?.getUsers();
  allUsers.value = (organizeUtil?.users || []).filter((u: Account) => u.user !== 'admin');
}

watch(() => props.users, () => {
  initData();
}, {
  immediate: true,
  deep: true,
});

const handleUserClick = (user: NocodeUser) => {
  if (isDisabled(user.id)) return;

  if (props.multiple) {
    if (selectedUserIds.value.has(user.id)) {
      selectedUserIds.value.delete(user.id);
    } else {
      selectedUserIds.value.add(user.id);
    }
  } else {
    selectedUserIds.value.clear();
    selectedUserIds.value.add(user.id);
  }
};

const handleSelectAll = () => {
  if (!props.multiple) return;
  const availableUserIds = displayUsers.value.filter(u => !isDisabled(u.id)).map(u => u.id);
  if (isSelectAll.value) {
    availableUserIds.forEach(id => selectedUserIds.value.delete(id));
  } else {
    availableUserIds.forEach(id => selectedUserIds.value.add(id));
  }
};

const handleClear = () => {
  selectedUserIds.value.clear();
};

const handleCancel = () => {
  emits('cancel');
};

const handleConfirm = () => {
  const selectedUsers = allUsers.value.filter(u => selectedUserIds.value.has(u.id));
  emits('confirm', selectedUsers);
};

const reset = () => {
  handleClear();
  searchValue.value = '';
};

const serialize = () => {
  return Array.from(selectedUserIds.value);
};

const getTabList = () => {
  const result = deepClone(allUsers.value);
  return result;
}

const deserialize = (users: NocodeUser[]) => {
  allUsers.value = users;
}

defineExpose({ reset, serialize, deserialize, getTabList });
</script>

<style lang="scss" scoped>
.mobile-select-user-drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 2000;
}

.drawer-content {
  background-color: #fff;
  width: 100%;
  height: 60vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 16px;
}

.header {
  height: 24px;
  line-height: 24px;
  text-align: left;
  padding-bottom: 16px;
  flex-shrink: 0;
  box-sizing: content-box;
  .clear-btn {
    font-size: 14px;
    color: #007aff;
    cursor: pointer;
  }
}

.search-container {
  margin-bottom: 12px;
  flex-shrink: 0;
  .search-input-wrapper {
    height: 40px;
    display: flex;
    align-items: center;
    background-color: #f0f0f0;
    border-radius: 8px;
    padding: 8px 12px;
  }
  .search-icon {
    margin-right: 8px;
  }
  .search-input {
    border: none;
    outline: none;
    background-color: transparent;
    width: 100%;
    font-size: 16px;
  }
}

.list-container {
  flex-grow: 1;
  overflow-y: auto;
  .empty-list {
    text-align: center;
    color: #888;
    padding-top: 40px;
  }
}

.list-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:last-child {
    border-bottom: none;
  }
  .item-name {
    font-size: 16px;
    color: #333;
  }

  :deep(.el-checkbox) {
    margin-right: 16px;
    pointer-events: none;
  }
  :deep(.el-checkbox__label) {
    display: none;
  }
}

.footer {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  flex-shrink: 0;
  .el-button {
    flex: 1;
    height: 40px;
    border-radius: 4px;
    font-size: 14px;
    margin: 0;
  }
}
</style>
