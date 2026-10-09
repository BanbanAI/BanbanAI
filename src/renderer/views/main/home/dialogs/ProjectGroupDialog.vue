<template>
  <div class="group-container">
    <div class="group-dialog">
      <el-dialog :title="$t('projectGroupDialog.dialogHeader')" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" width="400px" top="30vh" 
        destroy-on-close :close-on-click-modal="false" @open="refreshDialog" @closed="closeDialog" draggable align-center>
        <div class="group-management">
          <!-- 左侧分组列表 -->
          <div class="left-panel">
            <div class="left-panel-header">
              <div class="group-item" :class="{ 'active': ungroupedApp?.isActive }" @click="handleUnGroupedAppClick()">{{ $t('projectGroupDialog.noGroupApps') }}</div>
            </div>
            <div class="left-panel-content">
              <div class="content-header">
                <div class="organization">{{ $t('projectGroupDialog.group') }}</div>
                <el-icon :size="16" class="add-button" @click="handleCreate()"><i-workbench-add /></el-icon>
              </div>
              <div class="content-body">
                <vue-draggable 
                  v-model="panelContentGroupList" 
                  item-key="id"
                  animation="300"
                  @end="handleDragEnd"
                >
                  <template #item="{ element: group }">
                    <div
                      class="group-item" 
                      :class="{ 'active': group.isActive || group?.id === activeGroup?.id }" 
                      @click="handleGroupItemClick(group)"
                    >
                      <div class="group-item-name">
                        {{ group.name }}
                      </div>
                      <div class="group-item-more">
                        <el-popover
                          popper-class="group-page-viewer-tree-popover"
                          placement="bottom-start"
                          trigger="click"
                        >
                          <ul @click.stop style="display: flex;flex-direction: column;">
                            <li @click="handleRename(group)">
                              <el-icon>
                                <i-ven-page-view-rename/>
                              </el-icon>
                              {{ $t('projectGroupDialog.rename') }}
                            </li>
                            <li class="delete" @click="handleDelete(group)">
                              <el-icon>
                                <i-ep-delete/>
                              </el-icon>
                              {{ $t('projectGroupDialog.delete') }}
                            </li>
                          </ul>
                          <template #reference>
                            <el-icon class="more-button" @click.stop>
                              <i-ep-more-filled></i-ep-more-filled>
                            </el-icon>
                          </template>
                        </el-popover>
                      </div>
                    </div>
                  </template>
                </vue-draggable>
              </div>
            </div>
          </div>

          <!-- 右侧应用列表 -->
          <div class="right-panel">
            <div class="right-panel-header">
              <div style=" font-weight: 400; font-size: 14px; line-height: 20px;">{{ activeGroup?.name }}</div>
              <div>
                <el-button @click="handleMoveToGroup" style="color: var(--primary-color); border-color: var(--primary-color);">{{ $t('projectGroupDialog.moveAppToGroup') }}</el-button>
                <el-button @click="handleAddApplication" v-if="!ungroupedApp?.isActive" style="color: var(--primary-color); border-color: var(--primary-color);">
                  <el-icon :size="16" style="margin-left: 0;margin-right: 3px;"><i-workbench-add /></el-icon>
                  {{ $t('projectGroupDialog.addApplication') }}
                </el-button>
              </div>
            </div>
            <vue-draggable
              class="apps-container"
              v-if="activeGroup?.nocodes && activeGroup?.nocodes?.length"
              v-model="activeGroup.nocodes"
              item-key="id"
              animation="300"
              @end="handleNocodeDragEnd"
            >
              <template #item="{ element: nocode }">
                <group-nocode-box
                  :nocode="nocode"
                  :snapshot="nocodeSnapshots[nocode.id]"
                  :cover="nocodeCovers[nocode.id]"
                  @changeSelect="handleNocodeChange"
                  class="nocode-box"
                ></group-nocode-box>
              </template>
            </vue-draggable>
          </div>
        </div>
      </el-dialog>
    </div>

    <div class="move-group-dialog">
      <el-dialog v-model="createDialogVisible" :title="$t('projectGroupDialog.createGroup')" top="30vh" destroy-on-close draggable align-center>
        <div class="move-to-group">
          <div class="dialog-body">
            <div class="select-group-title">{{ $t('projectGroupDialog.newCreateGroupName') }}{{ getI18nLabelColon() }}</div>
            <div class="group-list">
              <el-input v-model="createGroupName" style="width: 325px" :placeholder="$t('projectGroupDialog.groupNamePlaceholder')" />
            </div>
          </div>
          <div class="dialog-footer">
            <el-button type="default" @click="handleCancelCreateGroup">{{ $t("projectGroupDialog.cancelGroup") }}</el-button>
            <el-button type="primary" @click="handleSaveCreateGroup">{{ $t("projectGroupDialog.confirmMove") }}</el-button>
          </div>
        </div>
      </el-dialog>
    </div>

    <div class="move-group-dialog">
      <el-dialog v-model="renameDialogVisible" :title="$t('projectGroupDialog.renameGroup')" top="30vh" destroy-on-close draggable align-center>
        <div class="move-to-group">
          <div class="dialog-body">
            <div class="select-group-title">{{ $t('projectGroupDialog.newGroupName') }}{{ getI18nLabelColon() }}</div>
            <div class="group-list">
              <el-input v-model="newGroupName" style="width: 325px" :placeholder="$t('projectGroupDialog.newGroupNamePlaceholder')" />
            </div>
          </div>
          <div class="dialog-footer">
            <el-button type="default" @click="handleCancelRenameGroup">{{ $t("projectGroupDialog.cancelGroup") }}</el-button>
            <el-button type="primary" @click="handleSaveRenameGroup">{{ $t("projectGroupDialog.confirmMove") }}</el-button>
          </div>
        </div>
      </el-dialog>
    </div>

    <div class="move-group-dialog">
      <el-dialog v-model="moveToGroupDialogVisible" :title="$t('projectGroupDialog.moveAppToGroup')" top="30vh" destroy-on-close draggable align-center>
        <div class="move-to-group">
          <div class="dialog-body">
            <div class="select-group-title">{{ $t('projectGroupDialog.selectGroup') }}{{ getI18nLabelColon() }}</div>
            <div class="group-list">
              <el-select v-model="moveGroupId" :placeholder="$t('projectGroupDialog.selectGroupPlaceholder')" style="width: 325px">
                <el-option
                  v-for="group in groupStructure"
                  :key="group.id"
                  :label="group.name"
                  :value="group.id"
                />
              </el-select>
            </div>
          </div>
          <div class="dialog-footer">
            <el-button type="default" @click="handleCancelMoveGroup">{{ $t("projectGroupDialog.cancelGroup") }}</el-button>
            <el-button type="primary" @click="handleSaveMoveGroup">{{ $t("projectGroupDialog.confirmMove") }}</el-button>
          </div>
        </div>
      </el-dialog>
    </div>

    <div class="add-app-dialog">
      <el-dialog v-model="addApplicationDialogVisible" :title="$t('projectGroupDialog.addApplicationDialogTitle')" top="30vh" destroy-on-close draggable align-center>
        <div class="add-app">
          <div class="app-list">
            <div class="current-group">
              <div class="title"><span>{{ $t('projectGroupDialog.currentGroup') }}{{ getI18nLabelColon() }}</span><span class="name">{{ activeGroup?.name }}</span></div>
              <div class="search-group">
                <!-- <el-input
                  style="width: 365px"
                  placeholder="搜索"
                  :prefix-icon="Search"
                /> -->
              </div>
            </div>
            <div class="group-app-list">
              <div class="ungrouped-apps">
                <div class="ungrouped-apps-title">{{ $t('projectGroupDialog.noGroupApps') }}{{ getI18nLabelColon() }}</div>
                <div class="ungrouped-apps-list">
                  <el-checkbox-group v-model="selectedUnGroupedAppsList" v-if="ungroupedApp?.nocodes" class="ungrouped-checkbox-group">
                      <el-checkbox v-for="nocode in ungroupedApp?.nocodes" :key="nocode.id" :value="nocode.id" :label="nocode.name" class="ungrouped-checkbox" />
                  </el-checkbox-group>
                </div>
              </div>
              <div class="grouped-apps">
                <div class="grouped-apps-title">{{ $t('projectGroupDialog.groupedApps') }}{{ getI18nLabelColon() }}</div>
                <div class="grouped-apps-list" v-for="group in addAppGroupedList" :key="group.id">
                  <div @click="toggleGroup(group)" class="title">
                    <div class="icon">
                      <el-icon size="16" class="arrow" v-if="!group.isOpen">
                        <i-ep-caret-right />
                      </el-icon>
                      <el-icon size="16" class="arrow" v-else>
                        <i-ep-caret-bottom />
                      </el-icon>
                    </div>
                    <div class="name">
                      {{ group.name }}
                    </div>
                  </div>
                  <div v-show="group.isOpen" class="app-list">
                    <el-checkbox-group v-model="selectedGroupedAppIdList" class="grouped-checkbox-group">
                      <el-checkbox v-for="nocode in group.nocodes" :key="nocode.id" :value="nocode.id" :label="nocode.name" class="grouped-checkbox" />
                    </el-checkbox-group>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button type="default" @click="handleCancelAddAppGroup">{{ $t("projectGroupDialog.cancelGroup") }}</el-button>
          <el-button type="primary" @click="handleSaveAddAppGroup">{{ $t("projectGroupDialog.confirmMove") }}</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { ref } from 'vue';
import { NocodeBody, NocodeCoverSummary, NocodeMeta } from '@common/types/nocode';
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue'
import axios from 'axios';
import { unique } from '@common/utils/unique';
import { useDialogStore, useShareNocodeCacheStore, type ShareNocodeSummary } from '@renderer/stores';
import VueDraggable from 'vuedraggable';
import i18next from 'i18next';
import { getI18nLabelColon } from '@common/utils/i18n';

const props = defineProps<{
  modelValue: boolean,
  args?: string,
}>();
const emit = defineEmits(["closed", "created", "update:modelValue", "refresh"]);

const dialogState = useDialogStore();
const shareNocodeCacheStore = useShareNocodeCacheStore();
type GroupNocodeSummary = ShareNocodeSummary;
type GroupNocodeSnapshot = NocodeBody['snapshot'];

const nocodes = ref<NocodeMeta[]>([]);
const nocodeSnapshots = ref<Record<string, GroupNocodeSnapshot | undefined>>({});
const nocodeCovers = ref<Record<string, NocodeCoverSummary | undefined>>({});

// 存储选中的nocode列表
const selectedNocodes = ref<NocodeMeta[]>([]);

// 未分组应用
const ungroupedApp = ref();

const moveToGroupDialogVisible = ref(false);
const addApplicationDialogVisible = ref(false);
const moveGroupId = ref()

const renameDialogVisible = ref(false)
const newGroupName = ref('')
const createDialogVisible = ref(false)
const createGroupName = ref('')

const selectedUnGroupedAppsList = ref([])
const selectedGroupedAppIdList = ref([])

const activeGroup = ref()

const popoverGroup = ref()

const groupStructure = ref()
const panelContentGroupList = ref();

const syncNocodeSnapshots = (nocodeList: GroupNocodeSummary[]) => {
  const snapshotMap: Record<string, GroupNocodeSnapshot | undefined> = {};
  const coverMap: Record<string, NocodeCoverSummary | undefined> = {};
  nocodeList.forEach((item) => {
    snapshotMap[item.meta.id] = item.snapshot;
    coverMap[item.meta.id] = item.cover;
  });
  nocodeSnapshots.value = snapshotMap;
  nocodeCovers.value = coverMap;
}

const getNocodes = async () => {
  const res = await shareNocodeCacheStore.getShareNocodeSummaries() as GroupNocodeSummary[];
  syncNocodeSnapshots(res);
  nocodes.value = res.map((item) => item.meta);
}

// 构建分组结构
const getGroupStructure = async () => {
  await axios.get("/project/get-all-nocode-groups").then(({ data }) => {
    groupStructure.value = buildGroupStructure(data, nocodes.value);
    panelContentGroupList.value = groupStructure.value.filter(item => item.isUngrouped !== true)
  }).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  });
}

function buildGroupStructure(groups, nocodes) {
  // 1. 复制分组数组并为每个分组初始化nocodes为空数组
  const groupMap = new Map();
  const groupIdSet = new Set();
  const groupStructure = groups.map(group => {
    const groupItem = {
      ...group,
      nocodes: []
    };
    groupMap.set(group.id, groupItem);
    groupIdSet.add(group.id);
    return groupItem;
  });
  // 2. 为每个分组添加对应的nocodes
  const ungroupedNocodes: NocodeMeta[] = [];
  nocodes.forEach(nocode => {
    // 找到对应的分组
    if (!nocode.groupId || !groupIdSet.has(nocode.groupId)) {
      ungroupedNocodes.push(nocode);
      return;
    }
    const group = groupMap.get(nocode.groupId);
    if (group) {
      group.nocodes.push(nocode);
    }
  });
  // 3. 收集未分组的nocodes（groupId为null或不存在对应分组）
  // 4. 添加未分组应用项
  ungroupedApp.value = {
    id: unique(),
    name: `${i18next.t("projectGroupDialog.noGroupApps")}`,
    isActive: true,
    isUngrouped: true,
    nocodes: ungroupedNocodes
  }
  groupStructure.push(ungroupedApp.value);

  return groupStructure;
}

const init = async () => {
  await getNocodes();
  await getGroupStructure();
}


// 处理子组件的选中状态变化
const handleNocodeChange = (nocode: NocodeMeta, isSelected: boolean) => {
  if (isSelected) {
    // 如果选中且不在列表中，则添加
    if (!selectedNocodes.value.some(item => item.id === nocode.id)) {
      selectedNocodes.value.push(nocode);
    }
  } else {
    // 如果取消选中，则从列表中移除
    selectedNocodes.value = selectedNocodes.value.filter(
      item => item.id !== nocode.id
    );
  }
};

const handleUnGroupedAppClick = () => {
  // 清除以前选中的nocode
  selectedNocodes.value = []
  // 需要单选效果（只有一个激活项）
  groupStructure.value.forEach(i => {
    i.isActive = false;
  });
  ungroupedApp.value.isActive = true;
  // 重新获取右侧应用列表
  activeGroup.value = ungroupedApp.value;
}

function handleGroupItemClick(group) {
  // 清除以前选中的nocode
  selectedNocodes.value = []
  // 需要单选效果（只有一个激活项）
  groupStructure.value.forEach(i => {
    i.isActive = false;
  });
  group.isActive = true;
  // 重新获取右侧应用列表
  activeGroup.value = groupStructure.value.find(item => item.name === group.name);
}

function handleMoveToGroup() {
  if(selectedNocodes.value.length !== 0){
    moveToGroupDialogVisible.value = true;
  } else {
    ElMessage({
      message: `${i18next.t("projectGroupDialog.selectAppFirst")}`,
      type: 'warning',
    })
  }
}

const addAppGroupedList = ref()
function handleAddApplication() {
  const filteredList = panelContentGroupList.value.filter(item => {
    // 条件1：name属性不等于"activeGroup"
    const nameCondition = item.name !== activeGroup.value.name;
    // 条件2：nocodes属性存在且不是空数组
    const nocodesCondition = item.nocodes.length > 0;
    
    // 返回同时满足两个条件的元素
    return nameCondition && nocodesCondition;
  });

  addAppGroupedList.value = filteredList.map(group => ({
    ...group,       // 复制原有属性
    isOpen: false   // 添加新的状态属性
  }));

  selectedUnGroupedAppsList.value = []
  selectedGroupedAppIdList.value = []

  addApplicationDialogVisible.value = true;
}

async function handleCancelGroup() {
  dialogState.hide('groupDialogVisible');
}
async function handleSaveGroup() {
  dialogState.hide('groupDialogVisible');
}

async function handleCancelCreateGroup() {
  createGroupName.value = ''
  createDialogVisible.value = false;
}

async function handleSaveCreateGroup() {
  // 分组名不允许重复
  const isNameDuplication =  groupStructure.value.some(item => item.name === createGroupName.value);

  if(!isNameDuplication) {
    const res = await axios.post("/project/create-nocode-group",{
      name: createGroupName.value
    }).then(({ data }) => data).catch(({ response }) => {
      ElMessage.error(response.data.message);
      return [];
    })

    await init()

    // 清除以前选中的nocode
    selectedNocodes.value = []
    panelContentGroupList.value = groupStructure.value.filter(item => item.isUngrouped !== true)
    // 需要单选效果（只有一个激活项）
    panelContentGroupList.value.forEach(item => {
      if (item.name === createGroupName.value) {
        item.isActive = true;
      } else {
        item.isActive = false;
      }
    });
    // 重新获取右侧应用列表
    activeGroup.value = groupStructure.value.find(item => item.name === createGroupName.value);
    ungroupedApp.value.isActive = false;

    createGroupName.value = ''
    createDialogVisible.value = false;
  } else {
    ElMessage({
      message: `${i18next.t("projectGroupDialog.groupNameRepeat")}`,
      type: 'warning',
    })
  }
}

async function handleCancelRenameGroup() {
  renameDialogVisible.value = false;
}

async function handleSaveRenameGroup() {
  // 分组名不允许重复
  const isNameDuplication =  groupStructure.value.some(item => item.name === newGroupName.value);

  if(!isNameDuplication) {
    const res = await axios.get("/project/rename-nocode-group", {
      params: {
        id: popoverGroup.value.id,
        name: newGroupName.value
      }
    }).then(({ data }) => data).catch(({ response }) => {
      ElMessage.error(response.data.message);
      return [];
    });
    await init()
    renameDialogVisible.value = false;
  } else {
    ElMessage({
      message: `${i18next.t("projectGroupDialog.groupNameRepeat")}`,
      type: 'warning',
    })
  }
}

async function handleCancelMoveGroup() {
  moveToGroupDialogVisible.value = false;
  moveGroupId.value = null
}

async function handleSaveMoveGroup() {
  if (moveGroupId.value) {
    const nocodeIds = selectedNocodes.value.map(nocode => nocode.id)
    if(moveGroupId.value !== ungroupedApp.value.id) {
      const res = await axios.post("/project/move-nocodes-to-group", {
        nocodeIds: nocodeIds,
        groupId: moveGroupId.value
      }).then(({ data }) => data).catch(({ response }) => {
        ElMessage.error(response.data.message);
        return [];
      })
    } else { // 将nocode移到未分组
      const res = await axios.post("/project/remove-nocodes-from-group", {
        nocodeIds: nocodeIds,
      }).then(({ data }) => data).catch(({ response }) => {
        ElMessage.error(response.data.message);
        return [];
      })
    }
    shareNocodeCacheStore.markAllDirty()
    await init()
    // 重新获取右侧应用列表
    activeGroup.value = groupStructure.value.find(item => item.name === activeGroup.value.name);
    ungroupedApp.value.isActive = false;
    if(activeGroup.value.isUngrouped){
      ungroupedApp.value.isActive = true
    }
    // 清除以前选中的nocode
    selectedNocodes.value = []
    moveToGroupDialogVisible.value = false
    moveGroupId.value = null
  } else {
    ElMessage({
      message: `${i18next.t("projectGroupDialog.placeSelectGroup")}`,
      type: 'warning',
    })
  }
}

async function handleCancelAddAppGroup() {
  addApplicationDialogVisible.value = false
}

async function handleSaveAddAppGroup() {
  // 拼接选中的未分组和已分组应用的id
  const addNocodeIds = [...selectedUnGroupedAppsList.value, ...selectedGroupedAppIdList.value]
  if(activeGroup.value.id !== ungroupedApp.value.id ) {
    const res = await axios.post("/project/move-nocodes-to-group", {
      nocodeIds: addNocodeIds,
      groupId: activeGroup.value.id
    }).then(({ data }) => data).catch(({ response }) => {
      ElMessage.error(response.data.message);
      return [];
    })
  } else {  // 移到未分组
    const res = await axios.post("/project/remove-nocodes-from-group", {
      nocodeIds: addNocodeIds,
    }).then(({ data }) => data).catch(({ response }) => {
      ElMessage.error(response.data.message);
      return [];
    })
  }
  shareNocodeCacheStore.markAllDirty()
  await init()
  // 重新获取右侧应用列表
  activeGroup.value = groupStructure.value.find(item => item.name === activeGroup.value.name);
  ungroupedApp.value.isActive = false;
  addApplicationDialogVisible.value = false
}

function refreshDialog() {
  // 初始获取右侧应用列表
  init().then(() => {
    activeGroup.value = ungroupedApp.value;
  })
}

function closeDialog() {
  emit("refresh");
  // 清除以前选中的nocode
  selectedNocodes.value = []
  // 需要单选效果（只有一个激活项）
  groupStructure.value.forEach(i => {
    i.isActive = false;
  });
  ungroupedApp.value.isActive = true;
  // 重新获取右侧应用列表
  activeGroup.value = ungroupedApp.value;
}

function handleCreate() {
  createDialogVisible.value = true

}

function handleRename(group) {
  newGroupName.value = group.name
  renameDialogVisible.value = true
  popoverGroup.value = group
}

async function handleDelete(group) {
  const res = await axios.get("/project/delete-nocode-group", {
    params: {
      groupId: group.id
    }
  }).then(({ data }) => data).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  })

  shareNocodeCacheStore.markAllDirty()
  await init()

  // 清除以前选中的nocode
  selectedNocodes.value = []
  // 需要单选效果（只有一个激活项）
  groupStructure.value.forEach(i => {
    i.isActive = false;
  });
  ungroupedApp.value.isActive = true;
  // 重新获取右侧应用列表
  activeGroup.value = ungroupedApp.value;

}

const toggleGroup = (group)=> {
  group.isOpen = !group.isOpen; // 只修改当前点击分组的状态
}

// 拖拽结束事件
const handleDragEnd = async () => {
  // 保存新的排序信息
  const newSortInfo = panelContentGroupList.value.map((item, index) => {
    return {
      id: item.id,
      sort: index,
    }
  })

  // 更新group信息
  const res = await axios.post("/project/update-group-sort",{
    newSort: newSortInfo
  }).then(({ data }) => data).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  })
}

// 应用拖拽结束事件
const handleNocodeDragEnd = async () => {
  // 保存新的排序信息
  const newSortInfo = activeGroup.value.nocodes.map((item, index) => {
    return {
      id: item.id,
      sort: index,
    }
  })
  // 更新nocode信息
  const res = await axios.post("/project/update-nocode-sort",{
    newSort: newSortInfo
  }).then(({ data }) => data).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  })
  shareNocodeCacheStore.markAllDirty()
}
</script>
<style scoped lang='scss'>
.group-container {
  // position: absolute;

  :deep(.el-button) {
    border-radius: 4px;
  }
  
  .group-dialog {
    :deep(.el-dialog) {
      width: 1008px;
      // height: 648px;
      border-radius: 4px;
      font-weight: 400;
      padding: 0; /* 关键：清除Dialog的内边距 */
      background-color: white;
      .el-dialog__header{
        display: flex;
        justify-content: center;
        padding: 8px 0; /* 调整标题区域的内边距 */
        margin: 0; /* 清除标题区域的外边距 */
        margin-bottom: 0; /* 移除之前设置的底部外边距 */
        height: 40px;

        .el-dialog__title{
          font-size: 14px;
        }

        &::after{
          content: "";
          display: block;
          position: absolute;
          top: 40px;
          width: 100%;
          height: 1px;
          left: 0px;
          background-color: #D9D9D9;
        }

        /* 关键：清除内容区域的内边距 */
        .el-dialog__body {
          padding: 0;
          margin: 0;
        }
        
        /* 清除底部区域的内边距和边框 */
        .el-dialog__footer {
          padding: 16px;
          margin: 0;
          border-top: none;
        }
      }
    }

    .group-management {
      display: flex;
      height: 600px;
      border: 1px solid #ccc;

      /* 左侧面板样式 */
      .left-panel {
        width: 200px;
        padding: 10px;
        border-right: 1px solid #ccc;

        .group-item {
          padding: 8px;
          cursor: pointer;
          margin-bottom: 5px;
        }

        .group-item.active {
          background-color: #fff;
          // font-weight: bold;
        }

        .add-group-btn {
          color: #999999;
          font-size: 32px;
          cursor: pointer;
        }

        .left-panel-header {
          .group-item {
            /* 过渡效果让状态变化更平滑 */
            transition: background-color 0.2s ease;
          }
          /* 鼠标悬浮时 */
          .group-item:hover {
            background-color: #F5F6F7;
          }
          /* 鼠标点击时 */
          .group-item.active {
            background-color: #F5F6F7;
          }
        }

        .left-panel-content {
          border-top: 1px solid #ccc;

          .content-header {
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
            margin-bottom: 6px;

            .organization {
              font-size: 12px;
              font-weight: 400;
              margin-left: 8px;
            }

            .add-button {
              cursor: pointer;

              &:hover {
                color: var(--primary-color);
              }
            }

          }

          .content-body {
            max-height: 510px;
            overflow-y: auto;

            .group-item {
              display: flex;
              justify-content: space-between;
              /* 过渡效果让状态变化更平滑 */
              transition: background-color 0.2s ease;           
              .group-item-more {
                visibility: hidden;
                .more-button {
                  transform: rotate(-90deg);
                }
              }
            }
            /* 鼠标悬浮时 */
            .group-item:hover {
              background-color: #F5F6F7;

              .group-item-more {
                visibility: visible;
              }
            }
            /* 鼠标点击时 */
            .group-item.active {
              background-color: #F5F6F7;
            }
          }
        }
      }

      /* 右侧面板样式 */
      .right-panel {
        flex: 1;
        display: flex;
        flex-direction: column;

        .right-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding: 10px;
        }

        .apps-container {
          display: flex;
          flex-wrap: wrap;
          padding: 10px;
          // gap: 10px;
          overflow-y: auto;

          .nocode-box {
            margin: 5px;
          }
        }

        .dialog-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;
          padding: 10px;
          border-top: 1px solid #ccc;
        }
      }
    }
  }

  .move-group-dialog {
    :deep(.el-dialog) {
      width: 384px;
      border-radius: 4px;
      font-weight: 400;
      padding: 0; /* 关键：清除Dialog的内边距 */
      background-color: white;
      .el-dialog__header{
        display: flex;
        justify-content: center;
        padding: 8px 0; /* 调整标题区域的内边距 */
        margin: 0; /* 清除标题区域的外边距 */
        margin-bottom: 0; /* 移除之前设置的底部外边距 */

        .el-dialog__title{
          font-size: 14px;
        }

        &::after{
          content: "";
          display: block;
          position: absolute;
          top: 40px;
          width: 100%;
          height: 1px;
          left: 0px;
          background-color: #D9D9D9;
        }
      }
    }

    .move-to-group {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      .dialog-body {

        .select-group-title {
            margin-top: 20px;
            margin-left: 30px;
        }

        .group-list {
            margin-top: 10px;
            margin-left: 30px;
        }
      }

      .dialog-footer {
        display: flex;
        justify-content: flex-end;
        margin: 40px 15px 20px;
      }
    }
  }

  .add-app-dialog {
    :deep(.el-dialog) {
      width: 400px;
      border-radius: 4px;
      font-weight: 400;
      padding: 0; /* 关键：清除Dialog的内边距 */
      background-color: white;
      .el-dialog__header{
        display: flex;
        justify-content: center;
        padding: 8px 0; /* 调整标题区域的内边距 */
        margin: 0; /* 清除标题区域的外边距 */
        margin-bottom: 0; /* 移除之前设置的底部外边距 */

        .el-dialog__title{
          font-size: 14px;
        }

        &::after{
          content: "";
          display: block;
          position: absolute;
          top: 40px;
          width: 100%;
          height: 1px;
          left: 0px;
          background-color: #D9D9D9;
        }
      }
      .el-dialog__footer {
        display: flex;
        justify-content: flex-end;
        border-top: 1px solid #ccc;
        padding: 10px;
      }
    }

    .add-app {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 450px;

      .app-list {
        padding: 0px 15px;
        flex: 1; /* 占满剩余高度 */
        overflow-y: auto;

        .current-group {
          margin-top: 15px;

          .title {
            font-size: 14px;
            font-weight: 600;

            .name{
              color: var(--primary-color);
            }
          }

          .search-group {
            margin-top: 10px;
            margin-bottom: 20px;
          }
        }

        .group-app-list {
          --group-app-list-scrollbar-offset: 15px;

          :deep(.el-checkbox) {
            .el-checkbox__input.is-checked + .el-checkbox__label {
              color: inherit;
            }
          }
          max-height: 400px;
          overflow-y: auto;
          width: calc(100% + var(--group-app-list-scrollbar-offset));
          margin-right: calc(var(--group-app-list-scrollbar-offset) * -1);
          padding-right: calc(var(--group-app-list-scrollbar-offset) + var(--scrollbar-size));
          box-sizing: border-box;
          scrollbar-width: none;

          &::-webkit-scrollbar {
            width: 0;
          }

          &:hover {
            scrollbar-width: thin;
          }

          &:hover::-webkit-scrollbar {
            width: var(--scrollbar-size);
          }
          
          .ungrouped-apps {
            :deep(.el-checkbox) {
              width: 350px;
            }
            .ungrouped-apps-title {
              margin-bottom: 10px;
              font-size: 14px;
              font-weight: 600;
            }
            .ungrouped-apps-list {
              .ungrouped-checkbox-group {
                
                .ungrouped-checkbox {
                  display: flex;
                  padding-left: 9px;
                  align-items: center;

                  :deep(.el-checkbox__label) {
                    font-size: 12px;
                  }
                  
                }
                .ungrouped-checkbox:hover {
                  background-color: #f5f6f7;
                  border-radius: 4px;
                  transition: background-color 0.2s;
                }
              }
            }
          }

          .grouped-apps {
            :deep(.el-checkbox) {
              width: 315px;
            }
            .grouped-apps-title {
              margin: 15px 0px 10px;
              font-size: 14px;
              font-weight: 600;
            }
            .grouped-apps-list {

              .title {
                display: flex;
                align-items: center;
                margin-top: 15px;
                cursor: pointer;

                .icon {
                  font-size: 12px;
                  font-weight: 400;
                  margin-right: 3px;
                }
                .name {
                  font-size: 12px;
                  font-weight: 400;
                }

              }

              .app-list {

                .grouped-checkbox-group {

                  .grouped-checkbox {
                    display: flex;
                    align-items: center;
                    padding-left: 9px;

                    :deep(.el-checkbox__label) {
                      font-size: 12px;
                    }
                  }
                  /* 同时修改整个复选框区域的背景色 */
                  .grouped-checkbox:hover {
                    background-color: #f5f6f7;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>

<style lang="scss">
.group-page-viewer-tree-popover {
  --el-popover-padding: 0;
  --el-bg-color-overlay: var(--bg-color-page);
  ul {
    display: flex;
    flex-direction: column;

    li {
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
      height: 32px;
      padding: 12px;
      display: flex;
      align-items: center;
      transition: all 0.3s ease;
      cursor: pointer;

      .el-icon {
        padding-top: 2px;
        margin-right: 8px;
      }

      &.delete {
        color: var(--color-danger);
      }

      &:hover {
        background-color: var(--bg-color-overlay);
      }
    }
  }
}
</style>
