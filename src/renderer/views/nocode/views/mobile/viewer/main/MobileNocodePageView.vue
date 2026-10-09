<template>
  <div class="app-detail">
    <div class="header">
      <router-link to="/">
        <el-button class="back" text :title="$t('MobileNocodePageView.backToDashboard')">
          <el-icon size="16" class="arrow">
            <i-ep-arrow-left />
          </el-icon>
        </el-button>
        <div class="title-text">{{ nocode?.meta?.name }}</div>
      </router-link>
    </div>
    <div class="project-search-box">
      <el-input
        v-model="searchVal"
        :placeholder="$t('MobileNocodePageView.search')"
        :prefix-icon="Search"
      />
    </div>
    <div class="approval-container">
      <div class="approval-body">
        <div v-for="item in approvalList" :key="item.icon" class="approval-item" @click="handleClickTodoCategory(item)">
          <el-badge :value="todoCount" :max="999" class="item" :hidden="!(item.category === TodoCategory.MY_TODO && todoCount > 0)">
            <img :src="item.icon" alt="">
          </el-badge>
          <div style="font-size: 14px; font-weight: 400; margin-top: 8px;">
            {{ item.label }}
          </div>
        </div>
      </div>
    </div>
    <div class="todo-container" v-if="isTodo">
      <mobile-nocode-todo-box ref="todoBoxRef" type="appTodo" @count-refreshed="handleTodoRefreshed" @backClick="handleBackClick" />
    </div>
    <div class="app-detail-container">
      <div class="scroll-container">
        <el-tree
          :data="nocode.body.structure"
          @node-click="handleNodeClick"
          ref="treeRef"
          node-key="id" 
          :filter-node-method="filterTree"
          :empty-text="$t('MobileNocodePageView.noContent')"
          :icon="ArrowDownBold"
          :indent="24"
        >
        <template #default="{ node, data }">
          <div class="custom-tree-node">
            <div :class="['node-icon', data.type]">
              <el-icon size="20"
                v-if="data.type === NocodeStructureType.GROUP">
                <i-ven-global-page-folder />
              </el-icon>
              <el-icon size="20" v-else-if="data.type === NocodeStructureType.PAGE">
                <i-ven-global-page-document />
              </el-icon>
              <el-icon size="20" v-else-if="data.type === NocodeStructureType.FORM">
                <i-ven-global-page-form />
              </el-icon>
            </div>
            <span :title="data.name">{{ data.name }}</span>
          </div>
        </template>
        </el-tree>
      </div>
    </div>
  </div>

  <!-- 表单详情弹窗 -->
  <mobile-nocode-form-dialog
    :modelValue="formDialogVisible"
    :formName="formName"
    :activeFormId="activeFormId"
    @update:modelValue="handleFormDialogVisible"
    @submitted="getTodoCount"
  />
  <!-- 看板详情弹窗 -->
  <mobile-nocode-page-dialog
    v-model="pageDialogVisible"
    :pageName="pageName"
    :activePageId="activePageId"
    :project="project"
    :nocode="nocode"
    :nocodeId="nocodeId"
    :webshare="true"
    :key="activePageId"
  />
</template>

<script lang='ts' setup>
import { Ref, ref, inject, computed, watch, onMounted, provide } from 'vue';
import { NOCODE } from '@renderer/types';
import { ArrowDownBold, Search } from '@element-plus/icons-vue';
import { useDialogStore, usePassportStore } from '@renderer/stores';
import { TodoCategory, NocodeStructureType, NocodeStructure, TODO, PermissionFilterMode } from '@common/types/nocode';
import { useRoute, useRouter } from 'vue-router';
import { ORGANIZE_UTIL } from '@renderer/types';
import { formDataApi, formFlowApi, OrganizeUtil } from '@renderer/views/nocode/utils';
import myTodoIcon from '@renderer/assets/icons/mobile/workbench/my-todo.svg';
import myInitiatedIcon from '@renderer/assets/icons/mobile/workbench/my-initiated.svg';
import ccMeIcon from '@renderer/assets/icons/mobile/workbench/cc-me.svg';
import myProcessedIcon from '@renderer/assets/icons/mobile/workbench/my-processed.svg';
import i18next from 'i18next';

const dialogState = useDialogStore();
const route = useRoute();
const nocodeId = route.params.nocodeId as string;
const router = useRouter();
const nocode = inject(NOCODE);
const organizeUtil = new OrganizeUtil();
const searchVal = ref('');
const activeName = ref('');
const activeID = ref('');
const treeRef = ref();
const todoBoxRef = ref();

const formDialogVisible = ref(false);
const pageDialogVisible = ref(false);
const formName = ref('');
const pageName = ref('');
const activeFormId = ref('');
const activePageId = ref('');
const project = ref()

const isTodo = ref(false);
const allTodoCount: Ref<Record<TodoCategory, number>> = ref({} as any);
const approvalList = computed(() => {
  return [
    { icon: myTodoIcon, label: i18next.t('MobileNocodePageView.myTodo'), category: TodoCategory.MY_TODO },
    { icon: myInitiatedIcon, label: i18next.t('MobileNocodePageView.myInitiated'), category: TodoCategory.MY_INITIATED },
    { icon: myProcessedIcon, label: i18next.t('MobileNocodePageView.myProcessed'), category: TodoCategory.MY_PROCESSED },  
    { icon: ccMeIcon, label: i18next.t('MobileNocodePageView.ccToMe'), category: TodoCategory.CC_ME },
  ]
});

interface Tree {
  [key: string]: any
}

const filterTree = (value: string, data: Tree) => {
  if (!value) return true
  return data.name.includes(value)
}

provide(ORGANIZE_UTIL, organizeUtil);

watch(() => searchVal.value, (val) => {
  treeRef.value?.filter(val);
});

const handleClickTodoCategory = async (item) => {
  todoBoxRef.value?.handleSwitchCategory(item.category);
  activeName.value = item.name;
  activeID.value = item.category;
  await router.push({
    query: {
      category: item.category,
    }
  })
  isTodo.value = true;
}

const handleNodeClick = (data: NocodeStructure) => {
  if (data.type === NocodeStructureType.GROUP) return;
  if (data.type === NocodeStructureType.PAGE) {
    // router.push(`project/${data.id}`);
    pageName.value = data.name;
    activePageId.value = data.id;
    project.value = nocode.value.pageBodies.filter(item => item.id === activePageId.value)[0];
    pageDialogVisible.value = true;
  } else if (data.type === NocodeStructureType.FORM) {
    // router.push(`form/${data.id}`);
    formName.value = data.name;
    activeFormId.value = data.id;
    formDialogVisible.value = true;
  }
  activeName.value = data.name;
  activeID.value = data.id;
}
const todoCount = ref(0);

const handleTodoRefreshed = (count: number) => {
  todoCount.value = count;
}
const getTodoCount = async () => {
  try {
    const res = await formFlowApi.getAllCategoryTodoCount({
      "categories[0]": TodoCategory.MY_TODO,
      nocodeId,
    });
    if (!res) return;
    handleTodoRefreshed(res?.[TodoCategory.MY_TODO]);
  } catch (err) {

  }
}
const handleBackClick = () => {
  isTodo.value = false;
}

const handleFormDialogVisible = (visible: boolean) => {
  formDialogVisible.value = visible;
  if (!visible) getTodoCount();
}

const init = () => {
  if (route.query.category && Object.values(TodoCategory).includes(route.query.category as TodoCategory)) {
    isTodo.value = true;
    activeID.value = route.query.category as string;
    activeName.value = approvalList.value.find(item => item.category === route.query.category)?.label || '';
  }
}

onMounted(async () => {
  init();
  getTodoCount();
});
</script>

<style lang='scss' scoped>
.app-detail {
  width: 100%;
  height: 100%;
  padding: 16px;
  padding-top: 24px;
  background-color: #f5f5f7;
  display: flex;
  flex-direction: column;

  .header {
    display: flex;
    align-items: center;
    height: 44px;
    min-height: 44px;
    a {
      display: flex;
      align-items: center;
      color: inherit;
      -webkit-tap-highlight-color: transparent;
      &:hover {
        color: inherit;
      }
    }
    .el-button {
      padding: 0;
      background-color: transparent;
    }
    .title-text {
      font-size: 16px;
      font-weight: 500;
      margin-left: 8px;
      color: var(--text-color-primary);
    }
  }

  .project-search-box {
    margin-top: 16px;

    :deep(.el-input) {
      height: 40px;
      .el-input__wrapper {
        border-radius: 8px;
        box-shadow: none;
      }
    }
  }

  .approval-container {
    background-color: var(--bg-color-page);
    border-radius: 8px;
    margin-top: 8px;
    padding: 12px 8px;

    .approval-body {
      display: flex;
      justify-content: space-around;
      .approval-item {
        width: 72px;
        height: 76px;
        padding: 8px;
        border-radius: 5px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        user-select: none;
        &:active {
          background: var(--bg-color-overlay);
        }
        :deep(.el-badge) {
          .el-badge__content {
            width: 18px;
            height: 18px;
          }
        }
      }
    }
  }

  .app-detail-container {
    height: 100%;
    margin-top: 8px;
    overflow: hidden;
    position: relative;
    z-index: 1;

    .scroll-container {
      height: 100%;
      padding: 8px;
      background-color: var(--bg-color-page);
      border-radius: 8px;
      overflow-y: auto;
      &::-webkit-scrollbar {
        display: none;
      }
      scrollbar-width: none;
      -ms-overflow-style: none;

      :deep(.el-tree) {
        height: calc(100% - 40px);
        
        .el-tree-node__content {
          height: 40px;
          line-height: 40px;
          padding: 4px 0;
          box-sizing: content-box;
          user-select: none;
          transition: all 0.3s ease;
          -webkit-tap-highlight-color: transparent;
          flex: 1;
          position: relative;

          .el-tree-node__expand-icon {
            position: absolute;
            right: 19px;
            padding: 0px;
            color: var(--icon-default-color);
            z-index: 100;

            &.expanded {
              transform: rotate(180deg);
            }
          }

          &:has(> .custom-tree-node.active) {
            background-color: var(--bg-color-overlay) !important;
          }

          .el-tree-node__expand-icon.is-leaf {
            padding: 0;
            margin-right: 4px
          }

          .custom-tree-node {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center; 
            position: relative;
            border-radius: 4px;

            &:active {
              background: var(--bg-color-overlay);
            }
            .node-icon {
              width: 20px;
              height: 20px;
              border-radius: 4px;
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 3px;
              margin-right: 8px;
              margin-left: 16px;
            }

            .tree-node-icon {
              color: var(--icon-default-color);
            }

            span {
              width: calc(100% - 80px);
              z-index: 1;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .more-button {
              margin-right: 8px;
              color: var(--icon-default-color);
              opacity: 0;
              transition: all 0.3s ease;
              width: 20px;
              height: 20px;
              border-radius: 4px;

              &:hover {
                background-color: var(--color-white);
              }
            }

            .edit-button {
              color: var(--icon-default-color);
              opacity: 0;
              transition: all 0.3s ease;
              width: 20px;
              height: 20px;
              border-radius: 4px;

              &:hover {
                background-color: var(--color-white);
              }
            }

            .edit-box {
              opacity: 0;
              transition: all 0.3s ease;
              width: 20px;
              height: 20px;
              border-radius: 4px;
            }

            &:hover {
              .more-button {
                opacity: 1;
              }

              .edit-button {
                opacity: 1;
              }
            }
          }
        }

        .el-tree-node:focus,
        .el-tree-node:focus-visible,
        .el-tree-node.is-focusable {
          .el-tree-node__content {
            background-color: unset;
          }
        }
      }
    }
  }

  // todo
  .todo-container {
    position: absolute;
    width: 100%;
    height: 100%;
    background-color: var(--bg-color-page);
    top: 0;
    left: 0;
    z-index: 10;
  }
}
</style>
