<template>
  <div class="nocode-todo-box">
    <div class="aside" v-if="isShowTab">
      <div class="title" @click="handleBackClick">
        <el-icon class="back-button"><i-ep-arrow-left /></el-icon>
        <span>{{ $t('MobileNocodeTodoBox.todoApproval') }}</span>
        <button v-if="false">
          <el-icon :size="11" color="#fff">
            <i-ven-plus></i-ven-plus>
          </el-icon>
          {{ $t('MobileNocodeTodoBox.initiate') }}
        </button>
      </div>
      <ul>
        <li :class="{ 'active': activeCategory == item.category }" @click="handleSwitchCategory(item.category)" v-for="item in categoryData" :key="item.category">
          {{ item.name }}
        </li>
      </ul>
    </div>
    <el-scrollbar class="table-container">
      <div v-if="allTodos?.[activeCategory]?.count">
        <div class="table-box"  v-for="item in allTodos?.[activeCategory]?.todos || []" @click="handleClickTableBox(item)">
          <div class="header">
            <div class="header-name">
              {{ item.formName }}
            </div>
            <div class="header-status" v-if="item?.status === ProcessNodeStatus.IN_PROGRESS">
              <span v-if="item?.isStashed" class="flow-name stash-tag">
                {{ $t('MobileNocodeTodoBox.stash') }}
              </span>
              <span
                v-if="item?.type === 'trigger-data-change' ? $t('MobileNocodeTodoBox.submit') : item?.flowName"
                class="flow-name"
                :title="item?.type === 'trigger-data-change' ? $t('MobileNocodeTodoBox.submit') : item?.flowName"
              >
                {{ item?.type === 'trigger-data-change' ? $t('MobileNocodeTodoBox.submit') : item?.flowName }}
              </span>
              <span
                :style="{backgroundColor: getStatusText(item)?.color}"
                class="tag"
              >
                {{ getStatusText(item)?.name }}
              </span>
              <span v-if="transactor(item)">
                {{ transactor(item) }}
              </span>
            </div>
            <div class="header-status end" v-else>
              <span v-if="item?.isStashed" class="flow-name stash-tag">
                {{ $t('MobileNocodeTodoBox.stash') }}
              </span>
              <span class="tag" :style="{backgroundColor: getStatusText(item)?.color}">
                {{ getStatusText(item)?.name }}
              </span>
            </div>
          </div>
          <div class="body">
            <div class="body-item">
              <span>{{ $t('MobileNocodeTodoBox.initiator') }}</span>
              <div class="user-info">
                <div class="avatar">
                  {{ creator(item)?.[0] }}
                </div>
                <span class="name">
                  {{ creator(item) }}
                </span>
              </div>
            </div>
            <div class="body-item">
              <span>{{ $t('MobileNocodeTodoBox.initTime') }}</span>
              <div>
                {{ formatDate(item.flowStartTime) }}
              </div>
            </div>
            <div class="body-item">
              <span>{{ $t('MobileNocodeTodoBox.completeTime') }}</span>
              <div>
                {{ item.endTime ? formatDate(item.endTime) : '—' }}
              </div>
            </div>
          </div>

          <hr>

          <div class="footer">
            <div v-if="getSingleOnceNoFormDataText(item)" class="footer-item no-form-data">
              <div>
                {{ getSingleOnceNoFormDataText(item) }}
              </div>
            </div>

            <template v-else-if="renderData(item).length > 0">
              <div
                class="footer-item"
                v-for="i in Math.min(3, renderData(item).length)"
              >
                <span>{{ renderData(item)[i - 1].label  }}</span>
                <div>
                  {{ renderData(item)[i - 1].value || ' --' }}
                </div>
              </div>
            </template>

            <div class="footer-item" v-else>
              <span>--</span>
              <div>
                --
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 默认底图 -->
      <div v-if="isGetTodo && !allTodos?.[activeCategory]?.count" class="empty-placeholder">
        <img src="@renderer/assets/image/nocode/todo/todo-empty.png" :alt="$t('MobileNocodeTodoBox.noTodo')">
        <span>{{ $t('MobileNocodeTodoBox.noTodo') }}</span>
      </div>
    </el-scrollbar>
    <el-config-provider :locale="elementPlusLocale">
      <el-pagination
        class="page-container"
        :page-sizes="[20, 30, 40, 50, 100]"
        :total="totalCount"
        layout="sizes, total, prev, pager, next"
        size="small"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        @size-change="getTodos()"
        @current-change="getTodos()"
        :pager-count="5"
      />
    </el-config-provider>
    <template v-if="allTodos?.[activeCategory]?.count">
      <mobile-nocode-process-dialog
        v-model="dialogState.todoDialogVisible"
        :editable="todoEditable"
        :todo="dialogState.getArgs('todoDialogVisible')"
        :category="activeCategory"
        :hideFormData="shouldHideSingleOnceFormData(dialogState.getArgs('todoDialogVisible'))"
        @submit="handleRefresh"
        @stash="handleRefresh"
        @back="handleRefresh"
        @cancel="handleRefresh"
        @transfer="handleRefresh"
        @toDrawer="isDrawer = true"
        @reInitiate="handleReInitiate"
        @deleteTodo="handleRefresh"
      />
    </template>
    <process-initiate-dialog
      v-if="reInitiateTableUID && reInitiateDialogVisible"
      :modelValue="reInitiateDialogVisible"
      :tableUID="reInitiateTableUID"
      :nocodeID="reInitiateNocodeId"
      :tableName="reInitiateTableName"
      :row="reInitiateRow"
      :message="$t('MobileNocodeTodoBox.reInitiateSuccess')"
      @close="handleReInitiateClose"
      @submitted="handleRefresh"
    />
    <nocode-approval-opinion-dialog
      ref="approvalOpinionDialogRef"
      :title="title"
      :isBackNode="isBackNode"
      :requireComment="requireComment"
      :todo="currentTodo"
    />
    <nocode-select-transfer-user-dialog
      ref="nocodeSelectTransferUserDialogRef"
      :disabledUid="usePaddingOperators"
      :todo="currentTodo"
    ></nocode-select-transfer-user-dialog>
  </div>
</template>

<script lang='ts' setup>
import { ref, reactive, inject, computed, onMounted, Ref, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { GetTodosResult, NocodeProcessItem, TODO, TodoCategory, TodoProcess } from '@common/types/nocode';
import type { OptionTableUID, Row } from '@common/types/project';
import { NOCODE_ID } from '@renderer/types';
import { useDialogStore, usePassportStore } from '@renderer/stores';
import dayjs from 'dayjs';
import { isSystemField, getFlowById, isTriggerNode, getCreateOwnerSystemField, SystemField } from '@common/utils';
import { ProcessNodeStatus, ProcessNodeType } from '@common/types/project';
import { formFlowApi, getOperationEmptyRowDisplayText, isOperationEmptyRowDisplayTodo, isSingleOnceTimeTaskDisplayTodo } from '@renderer/views/nocode/utils';
import ProcessInitiateDialog from '@renderer/views/nocode/views/editor/form/dialogs/ProcessInitiateDialog.vue';
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { useLocalizedDocumentTitle } from '@renderer/hooks/useLocalizedDocumentTitle';

const props = defineProps({
  isShowSearch: {
    type: Boolean,
    required: false
  },
  isShowTab: {
    type: Boolean,
    required: false,
    default: true
  },
  type: {
    type: String,
    required: false,
    default: 'processTodo'
  }
});

const emit = defineEmits<{
  (event: 'backClick'): void
  (event: 'count-refreshed', count: number): void
  (event: 'initialized'): void
}>();


const router = useRouter();
const route = useRoute();
const dialogState = useDialogStore();
const activeCategory = ref(route.query.category as TodoCategory || TodoCategory.MY_TODO);
const activeTag = ref(1);
const nocodeId = inject(NOCODE_ID);
const isDrawer = ref(true)
const passportState = usePassportStore()
passportState.syncSubAccounts()
const allTodos = reactive<Partial<Record<TodoCategory, GetTodosResult>>>({});
const isGetTodo = ref(false);
const totalCount = computed(() => {
  return allTodos?.[activeCategory.value]?.count || 0;
});
const currentPage = ref(1);
const pageSize = ref(20);

const nocodeSelectTransferUserDialogRef = ref(null)
const usePaddingOperators = ref([])
const reInitiateDialogVisible = ref(false)
const reInitiateRow = ref<Row | null>(null)
const reInitiateTableUID = ref<OptionTableUID | null>(null)
const reInitiateNocodeId = ref('')
const reInitiateTableName = ref('')

const formatDate = (timestamp: any) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
}

const handleReInitiate = async ({ row, tableUID }: { row: Row, tableUID: OptionTableUID }) => {
  const todo = dialogState.getArgs('todoDialogVisible');
  reInitiateRow.value = row;
  reInitiateTableUID.value = tableUID;
  reInitiateNocodeId.value = todo?.nocodeId || '';
  reInitiateTableName.value = todo?.formName || '';
  dialogState.todoDialogVisible = false;
  await nextTick();
  reInitiateDialogVisible.value = true;
}

const handleReInitiateClose = () => {
  reInitiateDialogVisible.value = false;
  reInitiateRow.value = null;
  reInitiateTableUID.value = null;
  reInitiateNocodeId.value = '';
  reInitiateTableName.value = '';
}

const categoryData = reactive([
  {
    get name() { return i18next.t('MobileNocodeTodoBox.myTodo') },
    category: TodoCategory.MY_TODO,
    icon: IWorkbenchNocodeTodoMyTodo,
  },
  {
    get name() { return i18next.t('MobileNocodeTodoBox.myInitiated') },
    category: TodoCategory.MY_INITIATED,
    icon: IWorkbenchNocodeTodoMyInitiated,
  },
  {
    get name() { return i18next.t('MobileNocodeTodoBox.myProcessed') },
    category: TodoCategory.MY_PROCESSED,
    icon: IWorkbenchNocodeTodoMyProcessed,
  },
  {
    get name() { return i18next.t('MobileNocodeTodoBox.ccToMe') },
    category: TodoCategory.CC_ME,
    icon: IWorkbenchNocodeTodoCcMe,
  },
  // {
  //   name: "发起流程",
  //   category: TodoCategory.INITIATE_PROCESS,
  //   icon: IWorkbenchNocodeTodoInitiateProcess,
  // }
]);
const getDocumentTitle = () => categoryData.find(item => item.category === activeCategory.value)?.name || '';
useLocalizedDocumentTitle(getDocumentTitle);

const todoEditable = computed(() => {
  return activeCategory.value === TodoCategory.MY_TODO;
})

// 返回
const handleBackClick = () => {
  if (props.type === 'processTodo') {
    router.push('/');
  } else if (props.type === 'appTodo') {
    emit("backClick");
  } else {
    router.push('/');
  }
}

const tableRef = ref()
const getTodos = async (category = activeCategory.value) => {
  const res = await formFlowApi.getTodos({
    nocodeId,
    category,
    page: currentPage.value || 1,
    pageSize: pageSize.value || 20,
  });
  if (!res) return;
  isGetTodo.value = true;
  allTodos[category] = res;
  // todos[category] = data.map(todo => {
  //   return {
  //   ...todo,
  //   createTime: todo.flowStartTime,
  // }
  // });
  // totalCount.value = res.count;

  if (category === TodoCategory.MY_TODO) {
    emit("count-refreshed", res.count);
  }

  nextTick(() => {
    tableRef.value?.sort('createTime', 'descending')
  })
}

// 所以可发起的流程
const allProcess = ref<NocodeProcessItem[]>([]);
const getAllProcess = async () => {
  allProcess.value = await formFlowApi.getAllProcess({
    nocodeId,
  });
}


const handleSwitchCategory = (category: TodoCategory) => {
  activeCategory.value = category;
  document.title = getDocumentTitle();
  router.replace({
    query: {
      ...route.query,
      category
    }
  });
  isGetTodo.value = false;
  if (category === TodoCategory.INITIATE_PROCESS) {
    getAllProcess();
  } else {
    getTodos();
  }
}

const validateTodo = (todo: TODO) => {
  const flow = getFlowById(todo?.flows || [], todo?.currentFlowId || todo?.flowId || '');
  return !!flow;
}

const handleClickTableBox = (todo: TODO) => { 
  if (!validateTodo(todo)) return ElMessage.error(i18next.t('MobileNocodeTodoBox.todoNodeDelTips'));
  dialogState.show('todoDialogVisible', todo)
}

defineExpose({
  handleSwitchCategory
})

const handleClickTag = (id: number) => {
  if (id !== activeTag.value) {
    activeTag.value = id;
  }
}

const handleRefresh = async () => {
  await getTodos();
}


// const tagData = reactive([
//   {
//     name: '全部',
//     id: 1,
//     count: 3
//   },
//   {
//     name: '已超时',
//     id: 2,
//     count: 2
//   },
//   {
//     name: '即将超时',
//     id: 3,
//     count: 1
//   },
// ])

onMounted(async () => {
  try {
    activeCategory.value = route.query.category as TodoCategory || TodoCategory.MY_TODO;
    if (activeCategory.value === TodoCategory.INITIATE_PROCESS) {
      getAllProcess();
    } else {
      await getTodos();
      if (!allTodos[TodoCategory.MY_TODO]) {
        getTodos(TodoCategory.MY_TODO);
      }
      await handleAutoOpenTodo();
    }
  } finally {
    emit('initialized');
  }
})

const handleAutoOpenTodo = async (preferRemote = false) => {
  const { todoId, tableId, uuid } = route.query;
  if (todoId && tableId && uuid) {
    try {
      const targetNocodeId = String(nocodeId || route.params.nocodeId || '').trim();
      if (!targetNocodeId) return;
      let todo = null;
      if (!preferRemote) {
        todo = allTodos[activeCategory.value]?.todos?.find(item => item.uuid === uuid);
      }
      if (!todo) {
        todo = (await formFlowApi.getTodo({
          nocodeId: targetNocodeId,
          tableUID: tableId as any,
          uuid: uuid as string,
          todoId: todoId as string,
        })) as any;
      }
      if (!todo && preferRemote) {
        todo = allTodos[activeCategory.value]?.todos?.find(item => item.uuid === uuid);
      }
      if (todo) {
        dialogState.show('todoDialogVisible', todo);
      }
    } catch (err) {
      console.error('Failed to auto-open todo dialog:', err);
    }
  }
}

// const isFilter = ref(false);
// const isSort = ref(false);
// const handleFilter = () => {
//   isFilter.value = !isFilter.value;
//   isSort.value = false;
// }

// const handleSort = () => {
//   isSort.value = !isSort.value;
//   isFilter.value = false;
// }

// const filterOutside = () => {
//   isFilter.value = false;
// }

// const sortOutside = () => {
//   isSort.value = false;
// }

const renderData = (todo: TODO) => { 
  const allowWidgetTypes = ['widget.form.textInput', 'widget.form.numberInput', 'widget.form.radioGroup', 'widget.form.treeSelect', 'widget.form.serialNumber']
  const fields = todo.fields?.filter(f => !isSystemField(f) && (f.type === 'string' || f.type === 'number') && allowWidgetTypes.includes(f.meta?.extra?.widgetType)) || []
  return fields.map(f => {
    return {
      label: f.alias,
      value: (todo.reportData || todo.data)?.[f.uid],
    }
  })
}

const shouldHideSingleOnceFormData = (todo?: TODO) => {
  return isOperationEmptyRowDisplayTodo(todo) || (activeCategory.value === TodoCategory.CC_ME && isSingleOnceTimeTaskDisplayTodo(todo))
}

const getSingleOnceNoFormDataText = (todo: TODO) => {
  if (!shouldHideSingleOnceFormData(todo)) return '';
  if (isOperationEmptyRowDisplayTodo(todo)) {
    return getOperationEmptyRowDisplayText(
      todo,
      'MobileNocodeTodoBox.operationEmptyRowPrefix',
      'MobileNocodeTodoBox.operationEmptyRowSuffix',
    );
  }
  return '--';
}

const creator = (data: TODO) => {
  const creatorUid = data.flowStartOperator;
  const account = passportState.subAccounts.find(item => item.id === creatorUid)
  const creatorName = account?.realname ||  account?.user
  return creatorName
}

const transactor = (data: TODO) => {
  const uid = data.fields.find(item => item.meta.name === SystemField.CURRENT_OWNER)?.uid;
  if (!uid) return "";
  let transactorUid = data.data?.[uid];
  if (!Array.isArray(transactorUid)) transactorUid = String(transactorUid).split(',');
  const accounts = passportState.subAccounts.filter(item => transactorUid?.includes(item.id));
  return accounts.map(account => account?.realname || account?.user).join(',')
}

const getStatusText = (item: TODO) => {
  const statusMapping = {
    [ProcessNodeStatus.IN_PROGRESS]: {
      name: i18next.t('MobileNocodeTodoBox.processing'),
      color: '#f6ab28'
    },
    [ProcessNodeStatus.FINISHED]: {
      name: i18next.t('MobileNocodeTodoBox.approved'),
      color: '#5ec431'
    },
    [ProcessNodeStatus.BACK]: {
      name: i18next.t('MobileNocodeTodoBox.rolledBack'),
      color: '#f9484e'
    },
    [ProcessNodeStatus.REJECTED]: {
      name: i18next.t('MobileNocodeTodoBox.rejected'),
      color: '#f9484e'
    },
    [ProcessNodeStatus.CANCELED]: {
      name: i18next.t('MobileNocodeTodoBox.revoked'),
      color: '#A1A1A1'
    },
    [ProcessNodeStatus.CC]: {
      name: i18next.t('MobileNocodeTodoBox.cc'),
      color: 'var(--color-primary-light-3)'
    },
  }
  return statusMapping[item.status];
}

// const getCreateTime = (item) => {
//   let fUid
//   for(const field of item.fields) {
//     if(field.meta.name === '_create_time') {
//       fUid = field.uid
//     }
//   }
//   const createTime = item.data[fUid]
//   return createTime
// }

// const isShowReject = (todo: TODO) => {
//   const flow = getFlowById(todo?.flows || [], todo?.flowId || '');
//   const allowReject = flow?.options?.allowReject
//   return todo?.status === ProcessNodeStatus.IN_PROGRESS && todo?.type === ProcessNodeType.APPROVAL && allowReject;
// }

// const isShowBack = (todo) => {
//   const flow = getFlowById(todo?.flows || [], todo?.flowId || '');
//   const allowRevert = flow?.options?.allowRevert
//   return todo?.status === ProcessNodeStatus.IN_PROGRESS && todo?.type === ProcessNodeType.APPROVAL && allowRevert;
// }

// const isShowTransfer = (todo: TODO) => {
//   const flow = getFlowById(todo?.flows || [], todo?.flowId || '');
//   const allowTransfer = flow.options.allowTransfer
//   return todo?.status === ProcessNodeStatus.IN_PROGRESS && allowTransfer && todoEditable.value
// }

// const isShowDelete = (todo: TODO) => {
//   return ![
//     ProcessNodeStatus.IN_PROGRESS,
//   ].includes(todo?.status) && !todoEditable.value
// }

// const buttonData = computed(() => {
//   return [
//     {
//       name: "转交",
//       icon: INocodeProcessFlowForward,
//       visible: (todo: TODO) => {
//         return isShowTransfer(todo)
//       },
//       click: (todo: TODO) => {
//         transfer(todo)
//       }
//     },
//     {
//       name: "退回",
//       icon: INocodeProcessFlowBack,
//       visible: (todo) => {
//         return isShowBack(todo)
//       },
//       click: (todo) => {
//         back(todo)
//       }
//     },
//     {
//       name: "评论",
//       icon: INocodeProcessFlowComment,
//       visible: (todo) => {
//         return false
//       },
//       click: (todo) => {
        
//       }
//     },
//     {
//       name: "撤销",
//       icon: INocodeProcessFlowRevoke,
//       visible: (todo: TODO) => {
//         return isTriggerNode(todo.type)
//       },
//       click: (todo: TODO) => {
//         handleCancel(todo)
//       }
//     },
//     {
//       name: "删除",
//       icon: INocodeFlowDeleteData, 
//       visible: (todo: TODO) => {
//         return isShowDelete(todo)
//       },
//       click: (todo: TODO) => {
//         onBeforeDelete(todo)
//       }
//     },
//     {
//       name: "更多",
//       icon: IEpMoreFilled,
//       visible: (todo) => {
//         return false
//       },
//       click: (todo) => {

//       }
//     }
//   ]
// })

const title = ref('')
const isBackNode = ref(false)
const approvalOpinionDialogRef = ref(null)
const currentTodo = ref(null)
const requireComment = ref(false)

// const reject = async(todo) => {
//   currentTodo.value = todo;
//   title.value = "拒绝";
//   isBackNode.value = false;
//   approvalOpinionDialogRef.value.confirm().then(async(resolve) => {
//     if (!resolve.state) return;
//     await formFlowApi.rejectTodo({
//       nocodeId: todo.nocodeId,
//       tableId: todo.tableId,
//       uuid: todo.uuid,
//       flowId: todo.flowId,
//       id: todo.id,    
//       todoId: todo.todoId,
//       comment: resolve.suggestion
//     })
//     getTodos()
//   })
// }

// const submit = async(todo) => {
//   currentTodo.value = todo;
//   title.value = "审批意见";
//   if (todo.type === ProcessNodeType.TRANSACT) {
//     title.value = "办理意见";
//   }
//   isBackNode.value = false;
//   let resolve = null;
//   if ([ProcessNodeType.TRANSACT, ProcessNodeType.APPROVAL].includes(todo.type)) {
//     resolve = await approvalOpinionDialogRef.value.confirm()
//     if (!resolve?.state) return;
//   }
//   const row = todo.data
//   await formFlowApi.submitTodo({
//     nocodeId: todo.nocodeId,
//     tableId: todo.tableId,
//     uuid: todo.uuid,
//     flowId: todo.flowId,
//     todoId: todo.todoId,
//     id: todo.id,
//     row: todo.type === ProcessNodeType.REPORT_DATA ? row : {
//       ...todo.data,
//       ...row
//     },
//     comment: resolve?.suggestion
//   })
//   getTodos()
// }
// const transfer = async (todo: TODO) => {
//   usePaddingOperators.value = todo.paddingOperators
//   nocodeSelectTransferUserDialogRef.value.confirm().then(async (result) => {
//     if (!result || !result.state || !result.transferOwner) return;

//     await formFlowApi.transferTodo({
//       nocodeId: todo.nocodeId,
//       tableId: todo.tableId,
//       uuid: todo.uuid,
//       todoId: todo.todoId,
//       flowId: todo.flowId,
//       id: todo.id,
//       transferOwner: result.transferOwner,
//     });

//     getTodos()
//   })
// }

// const back = async(todo) => {
//   currentTodo.value = todo;
//   title.value = "退回";
//   isBackNode.value = true;
//   approvalOpinionDialogRef.value.confirm().then(async(resolve) => {
//     if (!resolve.state) return;
//     await formFlowApi.backTodo({
//       nocodeId: todo.nocodeId,
//       tableId: todo.tableId,
//       uuid: todo.uuid,
//       flowId: todo.flowId,
//       id: todo.id,
//       todoId: todo.todoId,
//       row: todo.data,
//       backId: resolve.backNode,
//       comment: resolve.suggestion
//     })
//     getTodos()
//   })
// }

// const handleCancel = async (todo: TODO) => {
//   nocodeTodoBoxDialogStaticText.value = {
//     title: "撤销",
//     tipText: "是否确认撤销？",
//     btnColor: "primary"
//   }
//   const isCancel = await todoBoxDialogRef.value.confirm();
//   if(isCancel) await cancelFlow(todo)
// }
// const cancelFlow = async (todo: TODO) => {
//   await formFlowApi.cancelTodo({
//     nocodeId: todo.nocodeId,
//     tableId: todo.tableId,
//     uuid: todo.uuid,
//     todoId: todo.todoId,
//     flowId: todo.flowId,
//     id: todo.id,
//   })
//   getTodos()
// }

// const nocodeTodoBoxDialogStaticText = ref({
//   title: "",
//   tipText: "",
//   btnColor: "primary"
// })
// const todoBoxDialogRef = ref()

// const deleteConfirmDialogVisible = ref(false);
// let deletingRow = null;
// const onBeforeDelete = async (todo: TODO) => {
//   deletingRow = todo;
//   deleteConfirmDialogVisible.value = true;
// }
// const onDeleteConfirm = async () => {
//   await formFlowApi.deleteTodo({
//     nocodeId: deletingRow.nocodeId,
//     tableId: deletingRow.tableId,
//     todoId: deletingRow.todoId,
//     uuid: deletingRow.uuid,
//     flowId: deletingRow.flowId,
//     id: deletingRow.id,
//   })
//   getTodos()
// }

// const sortCreateTime = (a: any, b: any) => {
//   const getTime = (row: any) => new Date(row.createTime).getTime()
//   return getTime(a) - getTime(b)
// }
</script>

<style scoped lang='scss'>
.nocode-todo-box {
  color: #333;
  display: flex;
  width: 100%;
  height: 100%; // 添加视口高度限制
  overflow: hidden; // 隐藏溢出内容
  flex-direction: column;
  padding: 16px;
  padding-top: 24px;
  background-color: var(--bg-color-overlay);

  .aside {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .title {
      height: 44px;
      display: flex;
      align-items: center;
      padding-right: 12px;
      gap: 8px;

      .back-button {
        color: var(--text-color-primary);
        font-size: 16px;
        cursor: pointer;
      }

      span {
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        letter-spacing: 0px;
      }

      button {
        width: 64px;
        height: 28px;
        margin-left: auto;
        border-radius: 8px;
        padding-top: 4px;
        padding-right: 12px;
        padding-bottom: 4px;
        padding-left: 8px;
        background-color: var(--color-primary);
        color: var(--color-white);
        box-shadow: none;
        border: none;
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
        cursor: pointer;
        transition: all 0.1s ease;

        &:hover {
          background-color: var(--color-primary-light-3);
        }
      }
    }

    ul {
      display: flex;
      height: 40px;
      border-bottom: 1px solid var(--border-color);

      li {
        display: flex;
        align-items: center;
        transition: all 0.3s ease;
        font-weight: 400;
        font-size: 14px; 
        line-height: 20px;
        letter-spacing: 0%;
        flex: 1;
        justify-content: center;
        border-top: 2px solid transparent; 
        border-bottom: 2px solid transparent; 

        &.active {
          border-bottom: 2px solid var(--color-primary);
          color: var(--color-primary);
        }
      }
    }
  }

  .table-container {
    padding: 16px 0px 0px; 
    width: 100%;
    overflow: hidden;
    flex: 1;
    height: 100%;
    

    .table-box {
      width: 100%;
      overflow: auto;
      background-color: #fff;
      border-radius: 8px;
      padding: 16px 12px;
      margin-bottom: 16px;

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 20px;
        margin-bottom: 8px;

        .header-name {
          font-weight: 700;
          font-size: 14px;
          line-height: 20px;
        }

        .header-node {
          margin-left: auto;
          font-weight: 400;
          font-size: 12px;
          line-height: 16px;
          letter-spacing: 0%;
          color: var(--text-color-secondary);
          margin-right: 8px;
        }

        .header-status {
          height: 16px;
          color: var(--color-white);
          display: flex;
          align-items: center;
          gap: 8px;

          .flow-name {
            font-size: 12px;
            line-height: 16px;
            color: #6E6F70;
          }

          .tag {
            padding: 0px 4px;
            height: 16px;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 2px;
          }

          .stash-tag {
            color: var(--color-primary);
          }
        }
      }

      .body {
        margin-bottom: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;

        .body-item {
          font-weight: 400;
          font-size: 12px;
          line-height: 16px;
          letter-spacing: 0%;
          display: flex;
          justify-content: flex-end;
          color: var(--text-color-secondary);

          .user-info {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            
            .avatar {
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background-color: var(--color-primary);
              color: var(--color-white);
              display: flex;
              justify-content: center;
              align-items: center;
            }

            .name {
              color: var(--text-color-primary);
            }
          }

          span {
            margin-right: auto;
          }
        }
      }

      .footer {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;

        .footer-item {
          font-weight: 400;
          font-size: 12px;
          line-height: 16px;
          letter-spacing: 0%;
          display: flex;
          justify-content: flex-end;
          color: var(--text-color-secondary);

          &.no-form-data {
            justify-content: flex-start;

            div {
              white-space: normal;
            }
          }

          .user-info {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            
            .avatar {
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background-color: var(--color-primary);
            }

            .name {
              color: var(--text-color-primary);
            }
          }

          span {
            margin-right: auto;
          }
        }
      }

      hr {
        border: none;
        border-top: 1px solid var(--border-color);
      }
    }
  }

  .page-container {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }

  .tool-container {
    display: flex;
    align-items: center;
    height: 40px;
    border-bottom: 1px solid var(--border-color);
  }

  .empty-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 120px;

    img {
      width: 120px;
      height: auto;
    }
    span {
      margin-top: 16px;
      font-size: 14px;
      color: #909399;
    }
  }
}

/* 滚动条整体样式 */
::-webkit-scrollbar {
  width: 14px;
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(205, 206, 207, 1);
  border-radius: 8px;
  width: 6px;
  border-right: 4px solid transparent;
  border-left: 4px solid transparent;
  background-clip: content-box;
}
</style>
