<template>
  <div class="mobile-workbench-home-main">
    <div class="approval-container">
      <div class="approval-header">
        <el-icon color="var(--color-primary)" :size="20"><i-workbench-approval /></el-icon>
        <div class="approval-header-text">{{ $t('MobileWorkbenchHomeMain.approvalTodo') }}</div>
      </div>
      <div class="approval-body">
        <div v-for="item in approvalList" :key="item.icon" class="approval-item" @click="handleClickTodoCategory(item)">
          <el-badge :value="item.count" class="item" :max="999" :hidden="!(item.category === 'my_todo' && item.count > 0)">
            <img :src="item.icon" alt="">
          </el-badge>
          <div style="font-size: 14px; font-weight: 400; margin-top: 8px;">
            {{ item.label }}
          </div>
        </div>
      </div>
    </div>
    <div class="manage-container">
      <div class="manage-header">
        <el-icon color="var(--color-primary)" :size="20"><i-workbench-manage /></el-icon>
        <div class="manage-header-text">{{ $t('MobileWorkbenchHomeMain.myApps') }}</div>
      </div>
      <div class="manage-body" v-if="isShowNocodes">
        <template v-for="group in groupStructure" :key="group.id">
          <div class="nocode-group" v-if="group.nocodes.length > 0">
            <div class="group-title" v-if="hasGroup">{{ group.name }}</div>
            <div class="group-body">
              <div class="nocode-item" v-for="nocode in group.nocodes" :key="nocode.id">
                <mobile-workbench-nocode-box
                  :nocode="nocode"
                  @preview="handlePreviewNocode(nocode)"
                  >
                </mobile-workbench-nocode-box>
              </div>
            </div>
          </div>
        </template>
      </div>
      <el-empty :description="$t('MobileWorkbenchHomeMain.noApps')" v-if="!isShowNocodes">
        <template #image>
          <img src="@renderer/assets/image/mobile/workbench/empty.png" alt="">
        </template>
      </el-empty>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, Ref, ref } from 'vue';
import { NocodeMeta, TodoCategory } from '@common/types/nocode';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { unique } from '@common/utils/unique';
import { formFlowApi } from '../../../utils';
import { useRouter } from 'vue-router';
import { useShareNocodeCacheStore } from '@renderer/stores';
import myTodoIcon from '@renderer/assets/icons/mobile/workbench/my-todo.svg';
import myInitiatedIcon from '@renderer/assets/icons/mobile/workbench/my-initiated.svg';
import ccMeIcon from '@renderer/assets/icons/mobile/workbench/cc-me.svg';
import myProcessedIcon from '@renderer/assets/icons/mobile/workbench/my-processed.svg';
import i18next from 'i18next';

const router = useRouter();
const shareNocodeCacheStore = useShareNocodeCacheStore();
const allTodoCount: Ref<Record<TodoCategory, number>> = ref({} as any);
const approvalList = computed(() => {
  return [
    { icon: myTodoIcon, label: i18next.t('MobileWorkbenchHomeMain.myTodo'), count: allTodoCount.value?.[TodoCategory.MY_TODO] || 0, category: TodoCategory.MY_TODO },
    { icon: myInitiatedIcon, label: i18next.t('MobileWorkbenchHomeMain.myInitiated'), count: allTodoCount.value?.[TodoCategory.MY_INITIATED] || 0, category: TodoCategory.MY_INITIATED },
    { icon: myProcessedIcon, label: i18next.t('MobileWorkbenchHomeMain.myProcessed'), count: allTodoCount.value?.[TodoCategory.MY_PROCESSED] || 0, category: TodoCategory.MY_PROCESSED },  
    { icon: ccMeIcon, label: i18next.t('MobileWorkbenchHomeMain.ccToMe'), count: allTodoCount.value?.[TodoCategory.CC_ME] || 0, category: TodoCategory.CC_ME },
  ]
});
const getAllCategoryTodoCount = async () => {
  allTodoCount.value = await formFlowApi.getAllCategoryTodoCount({
    "categories[0]": TodoCategory.MY_TODO,
  });
}
getAllCategoryTodoCount();

const nocodes = ref<NocodeMeta[]>([]);
const isShowNocodes = computed(() => nocodes.value.length > 0);
const getNocodes = async () => {
  nocodes.value = await shareNocodeCacheStore.getShareNocodeMetas();
}
const groupStructure = ref();
// 有数据的分组数量
const hasGroup = ref(false)
const ungroupedApp = ref();
// 构建分组结构
const buildGroupStructure = async () => {
  await axios.get("/project/get-all-nocode-groups").then(({ data }) => {
    groupStructure.value = buildStructure(data, nocodes.value);

    // 统计 groupStructure 中 nocodes 不为空数组的元素个数
    hasGroup.value = groupStructure.value.filter(item => {
      return item.nocodes.length > 0 && !item.isUngrouped;
    }).length > 0;
  }).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  });
}
function buildStructure(groups, nocodes) {
  // 1. 复制分组数组并为每个分组初始化nocodes为空数组
  const groupStructure = groups.map(group => ({
    ...group,
    nocodes: []
  }));
  // 2. 为每个分组添加对应的nocodes
  nocodes.forEach(nocode => {
    // 找到对应的分组
    const group = groupStructure.find(g => g.id === nocode.groupId);
    if (group) {
        group.nocodes.push(nocode);
    }
  });
  // 3. 收集未分组的nocodes（groupId为null或不存在对应分组）
  const ungroupedNocodes = nocodes.filter(nocode => {
    return !nocode.groupId || !groups.some(g => g.id === nocode.groupId);
  });
  // 4. 添加未分组应用项
  ungroupedApp.value = {
    id: unique(),
    name: i18next.t('MobileWorkbenchHomeMain.ungroupedApps'),
    isUngrouped: true,
    nocodes: ungroupedNocodes
  }
  groupStructure.push(ungroupedApp.value);

  return groupStructure;
}

// 获取我的应用分组结构
const getGroupStructure = async () => {
  await getNocodes();
  await buildGroupStructure();
}
getGroupStructure()

const handlePreviewNocode = (nocodeMeta: NocodeMeta) => {
  router.push({
    path: `/app/${nocodeMeta.id}/`,
  });
}

const handleClickTodoCategory = (type) => {
  router.push({
    path: '/process',
    query: { category: type.category }
  })
}

</script>

<style lang="scss" scoped>
.mobile-workbench-home-main {
  height: 100%;
  display: flex;
  flex-direction: column;
  
  .approval-container {
    padding: 12px 8px;
    background-color: var(--bg-color-page);
    border-radius: 8px;
    margin-top: 24px;

    .approval-header {
      display: flex;
      align-items: center;
      border-bottom: 1px solid #e6e6e6;
      padding-bottom: 12px;
      
      .approval-header-text {
        font-size: 16px;
        font-weight: 500;
        margin-left: 8px;
      }
    }

    .approval-body {
      display: flex;
      justify-content: space-around;
      padding-top: 12px;
      overflow-y: auto;

      .approval-item {
        width: 72px;
        height: 76px;
        padding: 8px;
        border-radius: 5px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        &:active {
          background: var(--bg-color-overlay);
        }
        :deep(.el-badge) {
          .el-badge__content {
            min-width: 18px;
            height: 18px;
          }
        }
      }
    }
  }
  
  .manage-container {
    padding: 12px 8px;
    background-color: var(--bg-color-page);
    border-radius: 8px;
    margin-top: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    .manage-header {
      display: flex;
      align-items: center;
      border-bottom: 1px solid #e6e6e6;
      height: 24px;
      box-sizing: content-box;
      padding-bottom: 12px;

      .manage-header-text {
        font-size: 16px;
        font-weight: 500;
        margin-left: 8px;
      }
    }

    .manage-body {
      height: 100%;
      padding-top: 16px;
      padding-bottom: 16px;
      overflow-y: auto;
      &::-webkit-scrollbar {
        display: none;
      }
      scrollbar-width: none;
      -ms-overflow-style: none;

      .nocode-group {
        margin-bottom: 24px;
        .group-title {
          font-size: 14px;
          font-weight: 400;
        }
        .group-body {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
          gap: 8px;

          // display: flex;
          // flex-wrap: wrap;

          padding-top: 8px;

          .nocode-item {
            // width: 25%;
            display: flex;
            justify-content: center;
          }

          .nocode-box-content {
            margin-top: 8px;
            max-width: 78px;
          }

          @media (min-width: 1024px) {
            .nocode-box-content {
              margin-top: 12px;
            }
          }
        }
      }
      .nocode-group:last-child {
        margin-bottom: 0;
      }
    }

    img {
      width: 40px;
      height: 40px;
    }
  }
}
</style>
