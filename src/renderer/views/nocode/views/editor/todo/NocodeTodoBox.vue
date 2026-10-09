<template>
  <div class="nocode-todo-box" :class="{ 'is-embedded': !isShowTab }">
    <div class="standalone-header" v-if="isShowTab">
      <div class="standalone-header__left">
        <el-button class="back-button" text :title="$t('NocodeTodoBox.backToDashboard')" @click="router.push('/')" v-if="isShowSearch">
          <el-icon size="16" class="arrow">
            <i-ep-arrow-left />
          </el-icon>
        </el-button>
        <el-icon color="#fff" :size="24" class="title-icon">
          <i-workbench-pending-approval></i-workbench-pending-approval>
        </el-icon>
        <span>{{ $t('NocodeTodoBox.processCenter') }}</span>
      </div>
      <div class="standalone-header__right">
        <div class="standalone-header__tab">
          <!-- <span>
            {{ visibleCategoryData.find(item => item.category === activeCategory)?.name }}
          </span> -->
          <work-bench-user-card />
        </div>
      </div>
    </div>
    <div class="content">
      <div class="category-tabs">
        <div
          v-for="item in visibleCategoryData"
          :key="item.category"
          :class="['category-tab', { active: activeCategory === item.category }]"
          @click="handleSwitchCategory(item.category)"
        >
          <div class="category-tab__label">
            <el-icon :size="16">
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.name }}</span>
          </div>
          <div class="category-tab__badge" v-if="item.category === TodoCategory.MY_TODO && myTodoCount">
            {{ myTodoCount > 99 ? '99+' : myTodoCount }}
          </div>
        </div>
      </div>
      <div class="table-container">
        <div class="table-container-header-menu" v-if="activeCategory !== TodoCategory.INITIATE_PROCESS">
          <div class="table-container-menu-body">
            <el-popover v-if="!nocodeId" trigger="click" placement="bottom-start" popper-class="nocode-todo-box-menu-popper" :show-arrow="false" append-to=".table-container-header-menu" :teleported="false">
              <template #reference>
                <el-button class="menu-button-right nocode-todo-box-btn" text :title="allNocodeDatas.find(item => item.id === selectedNocode)?.name">
                  <span class="nocode-todo-box-btn-span">{{ allNocodeDatas.find(item => item.id === selectedNocode)?.name }}</span>
                  <el-icon size="16"><i-ep-arrow-down /></el-icon>
                </el-button>
              </template>
              <template #default>
                <el-scrollbar class="menu" max-height="228px">
                  <div class="menu-item" :title="item.name" :class="{'active': selectedNocode === item.id}" v-for="item in allNocodeDatas" :key="item.id" @click="handleSelectNocode(item.id)">
                    <div class="icon">
                      <div v-if="item?.icon" :style="{ width: '16px', height: '16px', background: item.iconColor, 'border-radius': '4px' }">
                        <el-icon :size="16" color="#fff">
                          <component :is="item.icon" />
                        </el-icon>
                      </div>
                      <el-image loading="lazy" fit="cover" :src="getCoverImageURL(item?.id)" v-else>
                        <template #error>
                          <img src="@renderer/assets/image/report-default-cover.png" alt="">
                        </template>
                      </el-image>
                    </div>
                    <span>{{ item.name }}</span>
                  </div>
                </el-scrollbar>
              </template>
            </el-popover>
            <el-select
              v-if="activeCategory === TodoCategory.MY_TODO"
              v-model="todoPendingFilterValue"
              class="todo-pending-filter-select"
              popper-class="todo-pending-filter-select-popper"
              append-to=".table-container-header-menu"
              :teleported="false"
              @change="handleTodoPendingFilterChange"
            >
              <el-option
                v-for="item in todoPendingFilterOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
                <div class="todo-pending-filter-option">
                  <el-icon size="16">
                    <component :is="item.icon" />
                  </el-icon>
                  <span>{{ item.label }}</span>
                </div>
              </el-option>
            </el-select>

            <div class="line" v-if="!nocodeId || activeCategory === TodoCategory.MY_TODO"></div>

            <el-popover :visible="filterPopoverVisible" placement="bottom-start" popper-class="nocode-todo-filter-menu-popper"
              :show-arrow="false" append-to=".table-container-header-menu" :teleported="false" @before-leave="filterPopoverHide">
              <template #reference>
                <el-button class="menu-button-left" :class="{ 'filter-active': filterConditions.length }" text @click="showFilterPopover">
                  <el-icon size="16"><i-table-filter /></el-icon>
                  {{ $t('NocodeTodoBox.filter') }}
                </el-button>
              </template>
              <template #default>
                <div class="filter-container">
                  <div class="filter-main-box">
                    <div class="filter-title">{{ $t('NocodeTodoBox.filter') }}</div>
                    <el-scrollbar max-height="330px">
                      <el-config-provider :locale="elementPlusLocale">
                        <div class="filter-item" v-for="(item, index) in filterConditions" :key="index">
                          <el-select v-model="item.column" clearable :no-data-text="$t('NocodeTodoBox.noData')" :placeholder="$t('NocodeTodoBox.plsSelect')" style="width: 160px" @change="handleChangeColumn(item)">
                            <el-option v-for="optionItem in columnOptions()" :key="optionItem.value" :value="optionItem.value" :label="optionItem.label"
                             :disabled="filterConditions.find(c => c.column === optionItem.value) ? true : false"></el-option>
                          </el-select>
                          <el-select v-model="item.func" :placeholder="$t('NocodeTodoBox.plsSelect')" clearable :no-data-text="$t('NocodeTodoBox.noData')" style="width: 160px" @change="handleChangeFunc(item)">
                            <el-option v-for="(value, key) in filterMenus(item)" :key="key" :label="RuleFuncTextMapping[key]" :value="key" />
                          </el-select>
                          <el-date-picker :class="{'invalid-field': !item.value}" v-if="item.column === SystemField.CREATE_TIME" class="filter-item-value" :disabled="[RuleFunc.EMPTY, RuleFunc.NOT_EMPTY].includes(item.func)" :format="'YYYY-MM-DD'"
                            :value-format="'x'" v-model="item.value" :type="item.func === RuleFunc.TIME_BETWEEN ? 'daterange' : 'date'" />
                          <el-select class="filter-item-value" :disabled="[RuleFunc.EMPTY, RuleFunc.NOT_EMPTY].includes(item.func)" v-else v-model="item.value" clearable
                            :no-data-text="$t('NocodeTodoBox.noData')" :placeholder="$t('NocodeTodoBox.plsSelect')" :multiple="isMultipleFilterValue(item.func)">
                            <template #tag v-if="isMultipleFilterValue(item.func) && item.column === SystemField.STATUS">
                              <el-tag v-for="tagValue in item.value?.filter((item, index) => index < 3)" :hit="false" effect="dark" style="border: none;"
                                :color="getFilterValueOptions(item).find(status => status.value === tagValue)?.color">
                                {{ getFilterValueOptions(item).find(status => status.value === tagValue)?.label }}
                              </el-tag>
                            </template>
                            <template #label="scope" v-else>
                              <el-tag v-if="item.column === SystemField.STATUS" :hit="false" effect="dark" style="border: none;"
                                :color="getFilterValueOptions(item).find(status => status.value === scope.value)?.color">
                                {{ getFilterValueOptions(item).find(status => status.value === scope.value)?.label }}
                              </el-tag>
                              <span v-else>{{ getFilterValueOptions(item).find(status => status.value === scope.value)?.label }}</span>
                            </template>
                            <el-option v-for="(optionValue, key) in getFilterValueOptions(item)" :value="optionValue.value">
                              <el-tag v-if="item.column === SystemField.STATUS" :hit="false" effect="dark" :color="optionValue.color" style="border: none;">{{ optionValue.label }}</el-tag>
                              <span v-else>{{ optionValue.label }}</span>
                            </el-option>
                          </el-select>
                          <el-button link @click="handleDeleteFilter(index)"><el-icon size="16"><i-workbench-delete /></el-icon></el-button>
                        </div>
                      </el-config-provider>
                    </el-scrollbar>
                  </div>
                  <div class="filter-footer">
                    <el-button class="add-button" type="primary" link @click="handleAddFilter">
                      <el-icon size="16"><i-ep-plus /></el-icon>
                      {{ $t('NocodeTodoBox.addCondition') }}
                    </el-button>
                    <div class="submit-button-group">
                      <el-button text bg @click="handleResetFilter">{{ $t('NocodeTodoBox.clear') }}</el-button>
                      <el-button type="primary" @click="filterPopoverVisible = false" style="color: #fff;">{{ $t('NocodeTodoBox.filter') }}</el-button>
                    </div>
                  </div>
                </div>
              </template>
            </el-popover>
            <el-popover trigger="click" placement="bottom-start" popper-class="sort-menu-popper" :show-arrow="false" append-to=".table-container-header-menu" :teleported="false">
              <template #reference>
                <el-button class="menu-button-left" text>
                  <el-icon size="16"><i-ven-sort /></el-icon>
                  {{ $t('NocodeTodoBox.sort') }}
                </el-button>
              </template>
              <template #default>
                <el-scrollbar class="menu" max-height="228px">
                  <div class="menu-item" :class="{'active': sortOrder === item.value}" v-for="item in sortMenuDatas" :key="item.value" @click="handleSortMenu(item.value)">
                    <span>{{ item.label }}</span>
                  </div>
                </el-scrollbar>
              </template>
            </el-popover>
            <el-button v-if="activeCategory !== TodoCategory.MY_TODO" class="menu-button-left" :class="{ 'is-active': showBatchOperation }" text @click="handleBatchOperation">
              <el-icon size="16"><i-ven-multiple-select /></el-icon>
              {{ showBatchOperation ? $t('NocodeTodoBox.cancelOperation') : $t('NocodeTodoBox.batchOperation') }}
            </el-button>

            <div class="line" v-if="selectedRows.length > 0"></div>

            <el-button class="menu-button-left" text v-if="selectedRows.length > 0" @click="onbeforeBatchDeleteData">
              <el-icon size="16"><i-workbench-delete /></el-icon>
              {{ $t('NocodeTodoBox.delete') }}
            </el-button>

            <el-input :placeholder="$t('NocodeTodoBox.inputContent')" v-model="searchValue" clearable class="search-input" @change="handleSearchChange">
              <template #prefix>
                <el-icon><i-workbench-search /></el-icon>
              </template>
            </el-input>
          </div>
        </div>
        <div class="table-container-body">
          <process-list v-if="activeCategory === TodoCategory.INITIATE_PROCESS" :data="allProcess"/>
          <div
            v-else
            class="table-box"
            v-loading="todoListLoading"
            :element-loading-text="$t('NocodeTodoBox.loading')"
            element-loading-background="rgba(255, 255, 255, 0.88)"
          >
            <el-table 
              ref="tableRef"
              :data="allTodos?.[activeCategory]?.todos || []" 
              :style="{
                width: '100%',
                flex: 1,
              }" 
              row-class-name="row-gap"
              @row-click="handleRowClick"
              @selection-change="handleSelectionChange"
            >
              <template #empty>
                <div style="text-align:center;">
                  <todo-empty :category="activeCategory" v-if="!allTodos?.[activeCategory]?.count " />
                </div>
              </template>
              <el-table-column type="selection" :selectable="selectable" width="55"></el-table-column>
              <el-table-column min-width="180" prop="formName" :label="$t('NocodeTodoBox.title')">
                <template #default="scope">
                  <span class="table-title">
                    {{ scope.row?.formName }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column min-width="180" prop="name" :label="$t('NocodeTodoBox.summary')">
                <template #default="scope">
                  <ul class="table-content" :class="{ 'has-no-form-data': !!getSingleOnceNoFormDataText(scope.row) }">
                    <li v-if="getSingleOnceNoFormDataText(scope.row)" class="empty-content no-form-data">
                      {{ getSingleOnceNoFormDataText(scope.row) }}
                    </li>
                    <li 
                      v-for="i in Math.min(3, renderData(scope.row).length)" 
                      :key="i"
                      v-if="!getSingleOnceNoFormDataText(scope.row) && renderData(scope.row).length > 0"
                    >
                      <span class="lable">
                        {{ renderData(scope.row)[i - 1].label }}{{ getI18nLabelColon() }}
                      </span>
                      <span :title="renderData(scope.row)[i - 1].value || ' --'">
                        {{ renderData(scope.row)[i - 1].value || ' --' }}
                      </span>
                    </li>
                    <li v-else class="empty-content">——</li>
                  </ul>
                </template>
              </el-table-column>
              <el-table-column min-width="180" prop="address" :label="$t('NocodeTodoBox.initiator')">
                <template #default="scope">
                  <div style="display: flex;">
                    <div class="avatar">
                      {{ creator(scope.row)?.[0] }}
                    </div>
                    <span>{{ creator(scope.row) || '' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column min-width="180" prop="createTime" :label="$t('NocodeTodoBox.initiateTime')">
                <template #default="scope">
                  <div class="time">
                    {{ formatDate(scope.row.flowStartTime) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column min-width="180" :label="$t('NocodeTodoBox.processingTime')">
                <template #default="scope">
                  <div class="processing-time-cell">
                    <div
                      v-if="getTodoProcessingTimeTagType(scope.row)"
                      class="processing-time-tag"
                      :class="`is-${getTodoProcessingTimeTagType(scope.row)}`"
                      :title="getTodoProcessingTimeTitle(scope.row)"
                    >
                      <el-icon size="16"><i-ep-alarm-clock /></el-icon>
                      <span>{{ getTodoProcessingTimeText(scope.row) }}</span>
                    </div>
                    <div v-else class="time">
                      {{ getTodoProcessingTimeText(scope.row) }}
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column min-width="180" :label="$t('NocodeTodoBox.completeTime')">
                <template #default="scope">
                  <div class="time">
                    {{ scope.row?.endTime ? formatDate(scope.row?.endTime) : '--' }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column min-width="180" prop="address" :label="$t('NocodeTodoBox.processStatus')">
                <template #default="scope">
                  <div class="status" v-if="scope.row?.status === ProcessNodeStatus.IN_PROGRESS">
                    <div class="status-main">
                      <span
                        :style="{backgroundColor: getStatusText(scope.row)?.color}"
                        class="tag"
                      >
                        {{ getStatusText(scope.row)?.name }}
                      </span>
                      <span v-if="scope.row?.isStashed" class="stash-tag">
                        {{ $t('NocodeTodoBox.stash') }}
                      </span>
                      <span v-if="transactor(scope.row)">
                        {{ transactor(scope.row) }}
                      </span>
                      <span
                        v-if="scope.row?.type === 'trigger-data-change' ? $t('NocodeTodoBox.submit') : scope.row?.flowName"
                        class="flow-name"
                        :title="scope.row?.type === 'trigger-data-change' ? $t('NocodeTodoBox.submit') : scope.row?.flowName"
                      >
                        {{ scope.row?.type === 'trigger-data-change' ? $t('NocodeTodoBox.submit') : scope.row?.flowName }}
                      </span>
                    </div>
                    <span
                      v-if="scope.row?.upstream?.termination"
                      class="upstream-tag"
                      :class="`is-${scope.row.upstream.termination}`"
                    >
                      <el-icon><i-ep-warning-filled /></el-icon>
                      {{ scope.row.upstream.termination === 'canceled'
                        ? $t('NocodeTodoBox.upstreamCanceled')
                        : $t('NocodeTodoBox.upstreamRejected') }}
                    </span>
                  </div>
                  <div class="status end" v-else>
                    <div class="status-main">
                      <span class="tag" :style="{backgroundColor: getStatusText(scope.row)?.color}">
                        {{ getStatusText(scope.row)?.name }}
                      </span>
                      <span v-if="scope.row?.isStashed" class="stash-tag">
                        {{ $t('NocodeTodoBox.stash') }}
                      </span>
                    </div>
                    <span
                      v-if="scope.row?.upstream?.termination"
                      class="upstream-tag"
                      :class="`is-${scope.row.upstream.termination}`"
                    >
                      <el-icon><i-ep-warning-filled /></el-icon>
                      {{ scope.row.upstream.termination === 'canceled'
                        ? $t('NocodeTodoBox.upstreamCanceled')
                        : $t('NocodeTodoBox.upstreamRejected') }}
                    </span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column min-width="180" :label="$t('NocodeTodoBox.operation')">
                <template #default="scope">
                  <div class="todo-actions" v-if="!validateTodo(scope.row) && !showBatchOperation">
                    <el-button class="danger" @click.stop="onBeforeDelete(scope.row)">{{ $t('NocodeTodoBox.delete') }}</el-button>
                  </div>
                  <div class="todo-actions" v-else-if="activeCategory === TodoCategory.MY_TODO && !showBatchOperation">
                    <el-button class="primary" @click.stop="handleRowClick(scope.row)">
                      {{ $t('NocodeTodoBox.view') }}
                    </el-button>
                  </div>
                  <div class="todo-actions" v-else-if="!filterPopoverVisible">
                    <el-button
                      class="danger"
                      v-if="isShowCanceled(scope.row)"
                      @click.stop="handleCancel(scope.row)"
                    >
                      {{ $t('NocodeTodoBox.revoke') }}
                    </el-button>
                    <span
                      v-if="scope.row?.status === ProcessNodeStatus.IN_PROGRESS && !isShowCanceled(scope.row)"
                      style="padding-left: 24px;"
                    >--</span>
                    <el-button
                      class="danger"
                      v-if="scope.row?.status !== ProcessNodeStatus.IN_PROGRESS"
                      :disabled="showBatchOperation"
                      @click.stop="onBeforeDelete(scope.row)"
                    >
                      {{ $t('NocodeTodoBox.delete') }}
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <el-config-provider :locale="elementPlusLocale">
              <el-pagination
                class="page-container"
                :page-sizes="[20, 30, 40, 50, 100]"
                :total="totalCount"
                layout="sizes, total, prev, pager, next"
                size="large"
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                @size-change="getTodos()"
                @current-change="getTodos()"
              />
            </el-config-provider>
          </div>
        </div>
      </div>
    </div>
    <template v-if="allTodos?.[activeCategory]?.count">
      <nocode-process-dialog
        v-model="dialogState.todoDialogVisible"
        :editable="todoEditable"
        :category="activeCategory"
        :todo="dialogState.getArgs('todoDialogVisible')"
        :hideFormData="shouldHideSingleOnceFormData(dialogState.getArgs('todoDialogVisible'))"
        :row="rowData"
        :fullscreen="isFullscreen"
        :processInfoFolded="processInfoFolded"
        @submit="handleRefresh"
        @stash="handleRefresh"
        @back="handleRefresh"
        @cancel="handleRefresh"
        @transfer="handleRefresh"
        @toDrawer="(row) => changeDrawerState(true, row)"
        @reInitiate="handleReInitiate"
        @openForm="handleOpenTodoForm"
        @deleteTodo="handleRefresh"
        @update:fullscreen="isFullscreen = $event"
        @update:processInfoFolded="processInfoFolded = $event"
        v-if="!isDrawer"
      />
      <nocode-process-drawer
        v-model="dialogState.todoDialogVisible"
        :editable="todoEditable"
        :category="activeCategory"
        :todo="dialogState.getArgs('todoDialogVisible')"
        :hideFormData="shouldHideSingleOnceFormData(dialogState.getArgs('todoDialogVisible'))"
        :row="rowData"
        :fullscreen="isFullscreen"
        :processInfoFolded="processInfoFolded"
        @submit="handleRefresh"
        @stash="handleRefresh"
        @back="handleRefresh"
        @cancel="handleRefresh"
        @transfer="handleRefresh"
        @toDialog="(row) => changeDrawerState(false, row)"
        @reInitiate="handleReInitiate"
        @openForm="handleOpenTodoForm"
        @deleteTodo="handleRefresh"
        @update:fullscreen="isFullscreen = $event"
        @update:processInfoFolded="processInfoFolded = $event"
        v-else
      >
        <template #tool>
          <!-- <div class="tool-container"></div> -->
        </template>
      </nocode-process-drawer>
    </template>
    <process-initiate-dialog
      v-if="reInitiateTableUID && reInitiateDialogVisible"
      :modelValue="reInitiateDialogVisible"
      :tableUID="reInitiateTableUID"
      :nocodeID="reInitiateNocodeId"
      :tableName="reInitiateTableName"
      :row="reInitiateRow"
      :message="$t('NocodeTodoBox.reInitiateSuccess')"
      @close="handleReInitiateClose"
      @submitted="handleRefresh"
    />
    <nocode-todo-box-dialog ref="todoBoxDialogRef" :title="nocodeTodoBoxDialogStaticText.title" :tipText="nocodeTodoBoxDialogStaticText.tipText" :btnColor="nocodeTodoBoxDialogStaticText.btnColor"></nocode-todo-box-dialog>
    <!-- <delete-confirm-dialog v-model="deleteConfirmDialogVisible" :text="$t('NocodeTodoBox.confirmDeleteRecord')" :tip="$t('NocodeTodoBox.deleteRecordWarn')" @confirm="onDeleteConfirm"></delete-confirm-dialog> -->
    <delete-confirm-dialog v-model="deleteConfirmDialogVisible" :text=singleDeleteInfo.text :tip=singleDeleteInfo.tip @confirm="onDeleteConfirm"></delete-confirm-dialog>
  </div>
</template>

<script lang='ts' setup>
import { ref, reactive, inject, computed, onMounted, nextTick, watch, toRaw, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ClickOutside as vClickOutside, ElMessage } from 'element-plus';
import { GetTodosParams, GetTodosResult, NocodeProcessItem, RuleFunc, RuleFuncTextMapping, TODO, TodoCategory, TodoProcess } from '@common/types/nocode';
import type { OptionTableUID, Row } from '@common/types/project';
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
import { useDialogStore, usePassportStore } from '@renderer/stores';
import dayjs from 'dayjs';
import { canRollbackFlow, isSystemField, getFlowById, SystemField, getSystemColumnConfigurations, transformCondition } from '@common/utils';
import { ProcessNodeStatus, ProcessNodeType } from '@common/types/project'
import { formFlowApi, getOperationEmptyRowDisplayText, isOperationEmptyRowDisplayTodo, isSingleOnceTimeTaskDisplayTodo } from '@renderer/views/nocode/utils';
import { FormMode } from '@renderer/types/base';
import { provideFormMode } from '@renderer/views/nocode/components/global/table/hooks';
import ProcessInitiateDialog from '../form/dialogs/ProcessInitiateDialog.vue';
import { equals, isEmpty } from '@common/utils/object';
import i18next from 'i18next';
import { cloneDeep as deepClone } from "lodash";
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale';
import { getI18nLabelColon } from '@common/utils/i18n';

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
});

const emit = defineEmits<{
  (event: 'count-refreshed', count: number): void
  (event: 'initialized'): void
}>();

type ProcessCard = TodoProcess & {
  fold: boolean,
}

const rowData = ref(null)
const router = useRouter();
const route = useRoute();
const dialogState = useDialogStore();
const activeCategory = ref(route.query.category as TodoCategory || TodoCategory.MY_TODO);
const activeTag = ref(1);
// const organizeUtil = inject(ORGANIZE_UTIL);
const nocodeId = inject(NOCODE_ID);
const isDrawer = ref(true)
const passportState = usePassportStore()
passportState.syncSubAccounts()
const isFullscreen = ref(false);
const processInfoFolded = ref(false);
const allTodos = reactive<Partial<Record<TodoCategory, GetTodosResult>>>({});
const formMode = computed(() => FormMode.Edit);
provideFormMode(formMode);
const currentPage = ref(1)
const pageSize = ref(20)
const totalCount = computed(() => allTodos[activeCategory.value]?.count || 0)
const myTodoCount = ref(0);

const selectedNocode = ref(null)
const allNocodeDatas = ref<{
  name: string;
  id: string;
  icon?: string;
  iconColor?: string;
}[]>([
  {
    get name() { return i18next.t('NocodeTodoBox.allApp') },
    id: null,
  }
])
const coverVersion = ref(0);
const sortMenuDatas = [
  {
    get label() { return i18next.t('NocodeTodoBox.descTodoByStartTime') },
    value: "DESC",
  },
  {
    get label() { return i18next.t('NocodeTodoBox.ascTodoByStartTime') },
    value: "ASC",
  },
]
const sortOrder = ref<'ASC' | 'DESC'>('DESC')

watch(() => dialogState.todoDialogVisible, (visible) => {
  if (!visible) {
    rowData.value = null
    isFullscreen.value = false;
    processInfoFolded.value = false;
  }
})

const changeDrawerState = (visible: boolean, row?: TODO) => {
  rowData.value = row || null
  isFullscreen.value = false;
  isDrawer.value = visible
}

const handleOpenTodoForm = async ({ nocodeId, tableId }: { nocodeId: string, tableId: string }) => {
  await router.push({
    path: `/app/${nocodeId}/`,
    query: {
      form: tableId,
    },
  });
  dialogState.hide('todoDialogVisible');
  rowData.value = null;
  isFullscreen.value = false;
  processInfoFolded.value = false;
}

const usePaddingOperators = ref([])

const formatDate = (timestamp) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
}

const isTodoProcessingUnderOneMinute = (todo?: TODO) => {
  if (!todo?.processingTime?.deadlineAt) {
    return false;
  }
  const restTime = Math.abs(todo.processingTime.deadlineAt - Date.now());
  return restTime < 60 * 1000;
}

const getTodoProcessingTimeText = (todo?: TODO) => {
  const deadlineAt = todo?.processingTime?.deadlineAt;
  if (!deadlineAt) {
    return todo?.flowStartTime ? formatDate(todo.flowStartTime) : '--';
  }
  if (isTodoProcessingUnderOneMinute(todo)) {
    return i18next.t('NocodeTodoBox.lessThanOneMinute');
  }
  const restTime = Math.abs(deadlineAt - Date.now());
  const totalMinutes = Math.floor(restTime / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const segments: string[] = [];

  if (days > 0) {
    segments.push(`${days}${i18next.t('NodeTimeoutSetting.day')}`);
  }
  if (hours > 0) {
    segments.push(`${hours}${i18next.t('NodeTimeoutSetting.hour')}`);
  }
  if (minutes > 0 || !segments.length) {
    segments.push(`${minutes}${i18next.t('NodeTimeoutSetting.minute')}`);
  }

  return segments.join('');
}

const getTodoProcessingTimeTagType = (todo?: TODO) => {
  const deadlineAt = todo?.processingTime?.deadlineAt;
  if (!deadlineAt) return "";
  return deadlineAt > Date.now() ? "countdown" : "overtime";
}

const getTodoProcessingTimeTitle = (todo?: TODO) => {
  if (todo?.processingTime?.deadlineAt && todo.processingTime.deadlineAt <= Date.now()) {
    return i18next.t('NocodeTodoBox.overtime');
  }
  return i18next.t('NocodeTodoBox.remainingProcessingTime');
}

const categoryData = reactive([
  {
    get name() { return i18next.t('NocodeTodoBox.myTodo') },
    category: TodoCategory.MY_TODO,
    icon: IWorkbenchNocodeTodoMyTodoIcon,
  },
  {
    get name() { return i18next.t('NocodeTodoBox.myInitiated') },
    category: TodoCategory.MY_INITIATED,
    icon: IWorkbenchNocodeTodoMyInitiatedIcon,
  },
  {
    get name() { return i18next.t('NocodeTodoBox.myProcessed') },
    category: TodoCategory.MY_PROCESSED,
    icon: IWorkbenchNocodeTodoMyProcessedIcon,
  },
  {
    get name() { return i18next.t('NocodeTodoBox.ccToMe') },
    category: TodoCategory.CC_ME,
    icon: IWorkbenchNocodeTodoCcMeIcon,
  },
]);
const initiateProcessData = reactive([
  {
    get name() { return i18next.t('NocodeTodoBox.initiateProcess') },
    category: TodoCategory.INITIATE_PROCESS,
    icon: IWorkbenchNocodeTodoInitiateProcessIcon,
  }
])

const showInitiateProcessTab = computed(() => props.isShowTab);
const visibleCategoryData = computed(() => {
  return showInitiateProcessTab.value ? [...categoryData, ...initiateProcessData] : [...categoryData];
});
const sanitizeFilterConditions = (category: TodoCategory, conditions = filterConditions.value) => {
  if (category === TodoCategory.MY_TODO) {
    return conditions;
  }
  return conditions.filter(item => item.column !== 'isStashed');
};
const normalizeCategory = (category?: TodoCategory) => {
  if (visibleCategoryData.value.some(item => item.category === category)) {
    return category as TodoCategory;
  }
  return TodoCategory.MY_TODO;
}
const updateDocumentTitle = () => {
  document.title = visibleCategoryData.value.find(item => item.category === activeCategory.value)?.name || categoryData[0].name;
}

activeCategory.value = normalizeCategory(activeCategory.value);
updateDocumentTitle();

const todoEditable = computed(() => {
  return activeCategory.value === TodoCategory.MY_TODO;
})

const tableRef = ref()
const searchValue = ref()
const todoListLoading = ref(false)
const todoPendingFilterValue = ref<"all" | "overtime">("all")
const todoPendingFilterOptions = [
  {
    get label() { return i18next.t('NocodeTodoBox.allPending') },
    value: "all" as const,
    icon: IWorkbenchNocodeTodoMyTodoIcon,
  },
  {
    get label() { return i18next.t('NocodeTodoBox.overtime') },
    value: "overtime" as const,
    icon: IEpDocument,
  },
]
const getTodos = async (category = activeCategory.value) => {
  if (category !== TodoCategory.MY_TODO && filterConditions.value.some(item => item.column === 'isStashed')) {
    filterConditions.value = sanitizeFilterConditions(category);
  }
  todoListLoading.value = true;
  try {
    const filter: GetTodosParams["filter"] = {};
    if (!isEmpty(filterConditions.value)) {
      for (const condition of filterConditions.value) {
        if (condition.column === SystemField.CREATE_OWNER) {
          if (condition.func === RuleFunc.EQUAL) {
            Object.assign(filter, { operators: { $eq: condition.value } });
          } else {
            Object.assign(filter, transformCondition({ uid: "operators", func: condition.func, value: condition.value }));
          }
        } else if (condition.column === SystemField.CREATE_TIME) {
          Object.assign(filter, transformCondition({ uid: "startTime", func: condition.func, value: condition.value, tFormat: "x" }))
        } else if (condition.column === 'isStashed') {
          Object.assign(filter, transformCondition({ uid: "isStashed", func: condition.func, value: condition.value }));
        } else { // SystemField.STATUS
          Object.assign(filter, transformCondition({ uid: "status", func: condition.func, value: condition.value }));
        }
      }
    }

    const res = await formFlowApi.getTodos({
      nocodeId: nocodeId ? nocodeId : selectedNocode.value,
      category,
      filter,
      searchValue: searchValue.value,
      orderBy: sortOrder.value,
      page: currentPage.value || 1,
      pageSize: pageSize.value || 20,
      todoPendingFilter: category === TodoCategory.MY_TODO ? todoPendingFilterValue.value : "all",
    });
    if (!res) return;
    allTodos[category] = res;

    if (category === TodoCategory.MY_TODO) {
      myTodoCount.value = res.count
      emit("count-refreshed", res.count);
    }
  } finally {
    todoListLoading.value = false;
  }
}

const getTodoCount = async () => {
  try {
    const res = await formFlowApi.getAllCategoryTodoCount({
      "categories[0]": TodoCategory.MY_TODO,
      nocodeId: nocodeId ? nocodeId : selectedNocode.value,
    });
    if (!res) return;
    myTodoCount.value = res[TodoCategory.MY_TODO];
  } catch (err) {
    console.log(err, "Failed to get the count of Todos")
  }
}

const usersData = ref<string[]>([])
const getTodoStartUsers = async () => {
  try {
    usersData.value = await formFlowApi.getStartTodoOwners({ category: activeCategory.value, nocodeId: nocodeId ? nocodeId : selectedNocode.value }) || [];
  } catch (err) {
    console.log(err, "Failed to get the start users of Todos")
  }
}

// 所以可发起的流程
const allProcess = ref<NocodeProcessItem[]>([]);
const getAllProcess = async () => {
  allProcess.value = await formFlowApi.getAllProcess({
    nocodeId,
  });
}


const handleSwitchCategory = (category: TodoCategory) => {
  const nextCategory = normalizeCategory(category);
  if (activeCategory.value === nextCategory) return;
  isCategorySwitching.value = true;
  filterPopoverVisible.value = false;
  activeCategory.value = nextCategory;
  currentPage.value = 1;
  todoPendingFilterValue.value = "all";
  updateDocumentTitle();
  selectedNocode.value = null;
  showBatchOperation.value = false;
  selectedRows.value = [];
  filterConditions.value = sanitizeFilterConditions(nextCategory, []);
  router.replace({
    query: {
      ...route.query,
      category: nextCategory
    }
  });
  if (nextCategory === TodoCategory.INITIATE_PROCESS) {
    getAllProcess();
  } else {
    getTodos();
  }
  nextTick(() => {
    isCategorySwitching.value = false;
  });
}

const handleTodoPendingFilterChange = (value: "all" | "overtime") => {
  todoPendingFilterValue.value = value;
  currentPage.value = 1;
  getTodos();
}
const validateTodo = (todo: TODO) => {
  const flow = getFlowById(todo?.flows || [], todo?.currentFlowId || todo?.flowId || '');
  return !!flow;
}

const handleRowClick = (todo: TODO) => {
  // 如果当前是批量操作状态，则不弹出详情
  if (showBatchOperation.value || filterPopoverVisible.value) return;
  if (!validateTodo(todo)) return ElMessage.error(i18next.t('NocodeTodoBox.todoNodeDeletedTips'));
  dialogState.show('todoDialogVisible', todo);
}


defineExpose({
  handleSwitchCategory
})

const handleRefresh = async () => {
  await getTodos();
}


const handleAutoOpenTodo = async (preferRemote = false) => {
  const { todoId, tableId, uuid } = route.query;
  if (todoId && tableId && uuid) {
    try {
      const targetNocodeId = (nocodeId || route.params.nocodeId || selectedNocode.value) as string;
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
        isDrawer.value = false;
        isFullscreen.value = true;
        dialogState.show('todoDialogVisible', todo);
      }
    } catch (err) {
      console.error('Failed to auto-open todo dialog:', err);
    }
  }
}

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
  return isOperationEmptyRowDisplayTodo(todo) || (activeCategory.value === TodoCategory.CC_ME && isSingleOnceTimeTaskDisplayTodo(todo));
}

const getSingleOnceNoFormDataText = (todo: TODO) => {
  if (!shouldHideSingleOnceFormData(todo)) return '';
  if (isOperationEmptyRowDisplayTodo(todo)) {
    return getOperationEmptyRowDisplayText(
      todo,
      'NocodeTodoBox.operationEmptyRowPrefix',
      'NocodeTodoBox.operationEmptyRowSuffix',
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

const getStatusText = (item: ProcessCard) => {
  const statusMapping = {
    [ProcessNodeStatus.IN_PROGRESS]: {
      name: i18next.t('NocodeTodoBox.processing'),
      color: '#f6ab28'
    },
    [ProcessNodeStatus.FINISHED]: {
      name: i18next.t('NocodeTodoBox.approved'),
      color: '#5ec431'
    },
    [ProcessNodeStatus.BACK]: {
      name: i18next.t('NocodeTodoBox.rolledBack'),
      color: '#f9484e'
    },
    [ProcessNodeStatus.REJECTED]: {
      name: i18next.t('NocodeTodoBox.rejected'),
      color: '#f9484e'
    },
    [ProcessNodeStatus.CANCELED]: {
      name: i18next.t('NocodeTodoBox.revoked'),
      color: '#A1A1A1'
    },
    [ProcessNodeStatus.CC]: {
      name: i18next.t('NocodeTodoBox.cc'),
      color: 'var(--color-primary-light-3)'
    },
  }
  return statusMapping[item.status];
}

const isShowCanceled = (todo: TODO) => {
  return activeCategory.value === TodoCategory.MY_INITIATED
    && todo?.status === ProcessNodeStatus.IN_PROGRESS
    && todo?.flowStartOperator === passportState.account.id
    && todo?.allowCancel === true;
}

const currentTodo = ref<TODO>(null)

const handleCancel = async (todo: TODO) => {
  nocodeTodoBoxDialogStaticText.value = {
    title: i18next.t('NocodeTodoBox.revoke'),
    tipText: i18next.t('NocodeTodoBox.confirmRevoke'),
    btnColor: "primary"
  }
  const isCancel = await todoBoxDialogRef.value.confirm();
  if(isCancel) await cancelFlow(todo)
}

const reInitiateDialogVisible = ref(false);
const reInitiateRow = ref<Row | null>(null);
const reInitiateTableUID = ref<OptionTableUID | null>(null);
const reInitiateNocodeId = ref('');
const reInitiateTableName = ref('');

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
const cancelFlow = async (todo: TODO) => {
  currentTodo.value = todo;
  try {
    await formFlowApi.cancelTodo({
      nocodeId: todo.nocodeId,
      tableId: todo.tableId,
      uuid: todo.uuid,
      todoId: todo.todoId,
      flowId: todo.currentFlowId || todo.flowId,
      id: todo.id,
    })
    getTodos()
  } catch (err) {
    ElMessage.error(err?.message || i18next.t('formFlowService.statusChangedRefreshTips'));
  }
}

const nocodeTodoBoxDialogStaticText = ref({
  title: "",
  tipText: "",
  btnColor: "primary"
})
const todoBoxDialogRef = ref()

const deleteConfirmDialogVisible = ref(false);
const singleDeleteInfo = ref({
  text: '',
  tip: '',
})
let deletingRow = null;
const onBeforeDelete = async (todo: TODO) => {
  if (showBatchOperation.value || filterPopoverVisible.value) return;
  deletingRow = todo;
  singleDeleteInfo.value = {
    text: i18next.t('NocodeTodoBox.confirmDeleteRecord'),
    tip: i18next.t('NocodeTodoBox.deleteRecordWarn'),
  }
  deleteConfirmDialogVisible.value = true;
}
const onDeleteConfirm = async () => {
  if (showBatchOperation.value) {
    const deleteRows = selectedRows.value.map(row => {
      return {
        nocodeId: row.nocodeId,
        tableId: row.tableId,
        todoId: row.todoId,
        uuid: row.uuid,
        flowId: row.currentFlowId || row.flowId,
        id: row.id,
      }
    })
    await formFlowApi.deleteTodos({ options: deleteRows });
  } else {
    await formFlowApi.deleteTodo({
      nocodeId: deletingRow.nocodeId,
      tableId: deletingRow.tableId,
      todoId: deletingRow.todoId,
      uuid: deletingRow.uuid,
      flowId: deletingRow.currentFlowId || deletingRow.flowId,
      id: deletingRow.id,
    })
  }
  getTodos()
}

const handleSortMenu = (value) => {
  sortOrder.value = value;
  getTodos();
}


const handleSelectNocode = (nocodeId) => {
  selectedNocode.value = nocodeId;
  getTodos();
}

const getCoverImageURL = (nocodeId: string) => {
  return `project/get-nocode-snapshot/${nocodeId}?t=${coverVersion.value}`;
};
const getProcessNocodeSimplifyDatas = async () => {
  const res = await formFlowApi.getProcessNocodeSimplifyDatas();
  if (!res) return;
  allNocodeDatas.value.push(...res);
}

const showBatchOperation = ref(false);
const handleBatchOperation = () => {
  showBatchOperation.value = !showBatchOperation.value;
  tableRef.value!.clearSelection();
}

// 只有流程结束的流程才可以被选中
const batchOperableStatuses = [
  ProcessNodeStatus.FINISHED,
  ProcessNodeStatus.REJECTED,
];

const selectable = (row) => {
  return batchOperableStatuses.includes(row.status);
}

const selectedRows = ref([]);
const handleSelectionChange = (selection) => {
  selectedRows.value = selection;
}

const onbeforeBatchDeleteData = () => {
  singleDeleteInfo.value = {
    text: i18next.t('NocodeTodoBox.confirmBatchDeleteRecords', { count: selectedRows.value.length }),
    tip: i18next.t('NocodeTodoBox.deleteRecordWarn'),
  }
  deleteConfirmDialogVisible.value = true;
}

const handleSearchChange = () => {
  getTodos();
}

const handleAddFilter = () => {
  filterConditions.value.push({
    column: null,
    func: null,
    value: null,
  })
}

const handleResetFilter = () => {
  filterConditions.value = [];
}

const stashColumnOption = {
  get label() { return i18next.t('NocodeTodoBox.stashStatus') },
  value: 'isStashed',
};
const columnOptions = () => {
  if (activeCategory.value === TodoCategory.MY_TODO) {
    return [...allColumnOptions.filter(item => item.value !== SystemField.STATUS), stashColumnOption];
  } else if (activeCategory.value === TodoCategory.MY_INITIATED) {
    return allColumnOptions.filter(item => item.value !== SystemField.CREATE_OWNER);
  }
  return allColumnOptions;
}
const allColumnOptions = [
  {
    get label() { return i18next.t('NocodeTodoBox.initiator') },
    value: SystemField.CREATE_OWNER,
  },
  {
    get label() { return i18next.t('NocodeTodoBox.initiateTime') },
    value: SystemField.CREATE_TIME,
  },
  {
    get label() { return i18next.t('NocodeTodoBox.processStatus') },
    value: SystemField.STATUS,
  }
]

const handleChangeColumn = (condition) => {
  condition.func = !isEmpty(filterMenus(condition)) ? Object.keys(filterMenus(condition))[0] : null;
  handleChangeFunc(condition);
}

const filterMenus = (condition) => {
  if (!condition) return {};
  if (condition.column === 'isStashed') {
    return {
      [RuleFunc.EQUAL]: true,
    };
  }
  const configurations = getSystemColumnConfigurations(condition.column);
  const info = deepClone(configurations?.funcInfo || {});
  delete info[RuleFunc.EMPTY];
  delete info[RuleFunc.NOT_EMPTY];
  return info;
}

const handleChangeFunc = (condition) => {
  condition.value = null;
}

const getFilterValueOptions = (condition) => {
  if (!condition?.column) return [];
  let tempOptions: {
    label: string,
    value: any,
    color?: string
  }[] = [];

  if (condition.column === SystemField.STATUS) {
    tempOptions = [
      {
        value: ProcessNodeStatus.IN_PROGRESS,
        label: i18next.t('NocodeTodoBox.processing'),
        color: '#f6ab28',
      },
      {
        value: ProcessNodeStatus.FINISHED,
        label: i18next.t('NocodeTodoBox.approved'),
        color: '#5ec431',
      },
      {
        value: ProcessNodeStatus.REJECTED,
        label: i18next.t('NocodeTodoBox.rejected'),
        color: '#f9484e',
      },
      {
        value: ProcessNodeStatus.CANCELED,
        label: i18next.t('NocodeTodoBox.revoked'),
        color: '#a1a1a1',
      },
    ];
  } else if (condition.column === 'isStashed') {
    tempOptions = [
      { label: i18next.t('NocodeTodoBox.isStashed'), value: true },
      { label: i18next.t('NocodeTodoBox.notStashed'), value: false },
    ];
  } else if (condition.column === SystemField.CREATE_OWNER) {
    // 这里要根据接口获取流程的创建人
    tempOptions = usersData.value.map(item => {
      const account = passportState.subAccounts.find(accountItem => accountItem.id === item);
      const creatorName = account?.realname ||  account?.user;
      if (!creatorName) return null;
      return {
        label: creatorName,
        value: item,
      }
    })?.filter(Boolean);
  }
  return tempOptions;
}

const isMultipleFilterValue = (func) => {
  if ([RuleFunc.IN, RuleFunc.NOT_IN].includes(func)) {
    return true;
  } else {
    return false;
  }
}

const filterPopoverVisible = ref(false);
const showFilterPopover = () => {
  filterPopoverVisible.value = true;
  getTodoStartUsers();
}

const filterConditions = ref<{
  column: string;
  func: RuleFunc;
  value: any;
}[]>([]);

const handleDeleteFilter = (index: number) => {
  filterConditions.value.splice(index, 1);
}

const isValidFilterConditions = computed(() => {
  return filterConditions.value.every(item => isValidCondition(item));
});
const isValidCondition = (item) => {
  if (!item.column) return false;

  if (!item.func) return false;

  if (item.value === null || item.value === undefined) {
    return false;
  }

  if (isMultipleFilterValue(item.func) && Array.isArray(item.value)) {
    return item.value.length > 0;
  }

  if (Array.isArray(item.value)) {
    return item.value.length > 0;
  }

  if (typeof item.value === 'string') {
    return item.value.trim().length > 0;
  }

  return true;
}

const oldFilterConditions = ref();
const isCategorySwitching = ref(false);
const filterPopoverHide = () => {
  if (isCategorySwitching.value) {
    return;
  }
  
  if (!isValidFilterConditions.value && filterConditions.value.length > 0) {
    filterPopoverVisible.value = true;
    ElMessage.error(i18next.t('NocodeTodoBox.filterNotComplete'));
    return;
  }

  if (equals(oldFilterConditions.value, filterConditions.value)) {
    return;
  }

  getTodos();

  oldFilterConditions.value = JSON.parse(JSON.stringify(filterConditions.value));
}

const onClickFilterPopoverOutside = (ev) => {
  if (!filterPopoverVisible.value) return;
  if (isCategorySwitching.value) return;
  const target: HTMLElement = ev.target;
  let noHidenArr = []
  const innerPopovers = document.querySelectorAll(".nocode-todo-filter-menu-popper");
  if (innerPopovers) {
    noHidenArr.push(...innerPopovers);
  }

  const popovers = document.querySelectorAll('.el-popper');
  if (popovers) {
    noHidenArr.push(...popovers);
  }

  const categoryMenus = document.querySelectorAll('.category-item, .category-tab');
  if (categoryMenus) {
    noHidenArr.push(...categoryMenus);
  }
  
  for (const item of noHidenArr) {
    if (item.contains(target)) return;
  }
  filterPopoverVisible.value = false;
}
onMounted(() => {
  document.addEventListener('click', onClickFilterPopoverOutside, true);
})
onUnmounted(() => {
  document.removeEventListener('click', onClickFilterPopoverOutside, true);
})

const init = async () => {
  try {
    if(!nocodeId) {
      getTodoCount();
      await getProcessNocodeSimplifyDatas();
    }
    const routeCategory = route.query.category as TodoCategory || TodoCategory.MY_TODO;
    activeCategory.value = normalizeCategory(routeCategory);
    updateDocumentTitle();
    if (route.query.category && route.query.category !== activeCategory.value) {
      router.replace({
        query: {
          ...route.query,
          category: activeCategory.value,
        }
      });
    }
    if (activeCategory.value === TodoCategory.INITIATE_PROCESS) {
      await getAllProcess();
    } else {
      await getTodos();
      await handleAutoOpenTodo();
    }
  } finally {
    emit('initialized');
  }
}
init();
</script>

<style scoped lang='scss'>
.nocode-todo-box {
  color: #333;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%; // 添加视口高度限制
  overflow: hidden; // 隐藏溢出内容

  .standalone-header {
    width: 100%;
    height: 60px;
    display: flex;
    flex-shrink: 0;

    .standalone-header__left {
      width: 300px;
      padding: 4px 8px;
      display: flex;
      align-items: center;
      min-width: 0;
      background-color: var(--bg-color-page);
      border-bottom: 1px solid var(--border-color);

      .back-button {
        height: 32px;
        width: 32px;
        border-radius: 4px;
        margin: 0 10px 0 0;
        padding: 0 !important;
        color: var(--text-color-primary);
        transition: all 0.3s ease;
        background-color: transparent;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          background-color: var(--el-fill-color-light);
        }
      }

      .title-icon {
        margin-right: 10px;
      }

      span {
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        letter-spacing: 0%;
      }
    }

    .standalone-header__right {
      flex: 1;
      min-width: 0;
      padding: 12px 16px;
      background-color: var(--bg-color-page);
      border-bottom: 1px solid var(--border-color);

      .standalone-header__tab {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-end;

        span {
          font-size: 16px;
          margin-right: auto;
        }

        :deep(.user-container) {
          height: 36px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          flex-shrink: 0;
        }
      }
    }
  }

  .aside {
    width: 300px;
    height: 100%;
    background-color: var(--bg-color-page);
    border-right: 1px solid var(--border-color);

    .title {
      height: 60px;
      display: flex;
      align-items: center;
      padding: 4px 8px;
      border-bottom: 1px solid var(--border-color);

      .back-button {
        height: 32px;
        width: 32px;
        border-radius: 4px;
        margin: 0 10px 0 0;
        padding: 0 !important;
        color: var(--text-color-primary);
        transition: all 0.3s ease;
        background-color: transparent;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          background-color: var(--el-fill-color-light);
        }
      }

      span {
        
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        letter-spacing: 0%;
        margin-left: 10px;
      }

      button {
        width: 60px;
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
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      .aside-line {
        width: calc(100% - 24px);
        height: 1px;
        background-color: #e5e6eb;
        margin: 4px 12px;
      }
      li {
        padding: 7px 8px 7px 12px;
        height: 36px;
        display: flex;
        align-items: center;
        transition: all 0.3s ease;
        font-family: Inter;
        font-weight: 400;
        font-size: 14px;
        line-height: 150%;
        letter-spacing: -1.1%;
        border-radius: 4px;
        color: #4E5969;
        cursor: pointer;

        &:hover {
          background-color: rgba(237, 237, 240, 1);
        }

        &.active {
          background-color: #e8f6ff;
          color: var(--color-primary);
        }

        .count {
          display: flex;
          align-items: center;
          margin-left: auto;
        }
      }
    }
  }

  .content {
    flex: 1;
    min-width: 0; // 允许内容收缩
    min-height: 0;
    display: flex;
    flex-direction: column; // 垂直排列
    overflow: hidden;

    .header {
      height: 60px;
      width: 100%;
      padding: 12px 16px;
      background-color: var(--bg-color-page);
      border-bottom: 1px solid var(--border-color);

      .tab {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        :deep(.user-container) {
          height: 36px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
        }

        span {
          font-size: 16px;
          margin-right: auto;
        }
      }

      .label {
        margin-top: 16px;
        height: 29px;
        display: flex;
        align-items: center;
        padding-right: 32px;

        ul {
          display: flex;

          li {
            margin-right: 14px;
            height: 29px;
            padding: 0px 16px 0px 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: rgba(0, 0, 0, 0.2) 1px solid;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              border: rgba(8, 115, 255, 0.4) 1px solid;
              color: rgba(8, 115, 255, 1);
            }

            &.active {
              background-color: rgba(8, 115, 255, 1);
              border: rgba(8, 115, 255, 1) 1px solid;
              color: #fff;
            }
          }
        }

        .search {
          display: flex;
          align-items: center;
          margin-left: auto;

          .filter {
            position: relative;
            display: flex;
            align-items: center;
            transition: all 0.2s ease;
            color: rgba(30, 30, 30, 1);
            font-size: 16px;
            margin-left: 16px;

            span {
              width: 68px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 8px;
              cursor: pointer;
              margin-left: 4px;

              &:hover {
                background-color: #ededf0;
              }
            }

            .filter-dropdown {
              z-index: 10;
              position: absolute;
              top: 48px;
              left: -260px;
              width: 420px;
              height: 576px;
              background-color: #ffffff;
              box-shadow: 0px 8px 12px 0px #8E8D991A;
              box-shadow: 0px 2px 8px 0px #8E8D991A;
              border-radius: 8px;
              padding: 32px 16px;

              h1 {
                width: 388px;
                height: 24px;
                
                font-weight: 400;
                font-size: 16px;
                line-height: 24px;
                letter-spacing: 0%;
                margin: 0px 0px 8px 0px
              }

              .item {
                margin-bottom: 32px;
              }

            }

            .sort-dropdown {
              z-index: 10;
              position: absolute;
              top: 48px;
              left: -104px;
              width: 200px;
              height: 80px;
              background-color: #ffffff;
              box-shadow: 0px 8px 12px 0px #8E8D991A;
              box-shadow: 0px 2px 8px 0px #8E8D991A;
              border-radius: 8px;
              padding: 8px;

              h1 {
                width: 184px;
                height: 32px;
                border-radius: 4px;
                gap: 8px;
                display: flex;
                align-items: center;
                transition: all 0.2s ease;
                
                font-weight: 400;
                font-size: 16px;
                line-height: 150%;
                letter-spacing: -1.1%;
                padding-left: 8px;
                cursor: pointer;
                color: #1E1E1E;

                &:hover {
                  background-color: #eeeef0;
                }
              }
            }
          }
        }
      }
    }

    .body {
      overflow: hidden;
      width: 100%;
      flex: 1;
      margin-bottom: auto;

      &.empty {
        :deep(.el-scrollbar__view) {
          height: 100%;

          .todo-empty {
            margin-top: -8px;
          }
        }
      }
    }

    .table-container {
      padding: 16px; 
      overflow: hidden;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      .table-container-header-menu {
        width: 100%;
        height: 60px;
        padding: 12px 16px 16px 16px;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        background-color: var(--color-white);
        .table-container-menu-body {
          width: 100%;
          height: 100%;
          background-color: var(--color-white);
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          position: relative;
          .el-button {
            border-radius: 4px;
            display: flex;
            font-size: 14px;
            color: #4e5969;
            margin: 0;
          }
          .menu-button-left {
            .el-icon {
              margin-right: 4px;
            }
          }
          .filter-active {
            color: var(--color-primary);
          }
          .menu-button-right {
            .el-icon {
              margin-left: 4px;
            }
          }
          :deep(.todo-pending-filter-select) {
            width: 112px;
            min-width: 112px;

            .el-select__wrapper {
              width: 112px;
              min-height: 32px;
              height: 32px;
              padding: 0 12px;
              border-radius: 4px;
              background: transparent;
              box-shadow: none;
              border: none;
            }

            .el-select__selection {
              font-size: 14px;
              line-height: 22px;
              color: #4e5969;
            }

            .el-select__selected-item {
              width: 100%;
              display: flex;
              align-items: center;
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
            }

            .el-select__selected-item {
              color: #4e5969;
            }

            .el-select__selected-item-text {
              display: block;
              width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .el-select__placeholder {
              color: #4e5969;
            }

            .el-select__caret {
              color: #4e5969;
            }

            .el-select__suffix {
              margin-left: 4px;
            }

            &:hover .el-select__wrapper,
            &.is-focus .el-select__wrapper {
              box-shadow: none;
              border: none;
            }
          }
          .line {
            width: 1px;
            height: 12px;
            background-color: var(--text-color-placeholder);
          }

          .is-active {
            color: var(--color-primary);
            background-color: #e7e7e7;
          }
          :deep(.nocode-todo-box-btn) {
            max-width: 106px;
            span {
              width: 100%;
              .nocode-todo-box-btn-span {
                display: inline-block;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
            }
          }

          :deep(.search-input) {
            width: 240px;
            height: 32px;
            position: absolute;
            right: 0;

            .el-input__wrapper {
              box-shadow: unset;
              background-color: #F2F3F5;
              border-radius: 4px;
              font-size: 14px;
              line-height: 22px;
            }
            &:hover {
              box-shadow: 0 0 0 1px var(--border-color) inset;
            }
            &.is-focus {
              box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
              background-color: #FFF;
            }
          }
        }

        :deep(.nocode-todo-box-menu-popper),
        :deep(.sort-menu-popper),
        :deep(.nocode-todo-filter-menu-popper) {
          background-color: var(--color-white);
          padding: 6px;
          border-radius: 8px;
          border: 1px solid var(--border-2, #e5e6eb);
          box-shadow: 0px 4px 10px #0000001a;
          .menu {
            .el-scrollbar__view {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              .menu-item {
                max-width: 100%;
                height: 36px;
                display: flex;
                align-items: center;
                padding: 0 12px;
                border-radius: 4px;
                font-size: 12px;
                line-height: 22px;
                gap: 8px;
                span {
                  max-width: 100%;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
                .icon {
                  width: 16px;
                  height: 16px;
                  border-radius: 4px;
                  .el-image img {
                    width: 100%;
                    height: 100%;
                    border-radius: 4px;
                  }
                }
  
                &:hover {
                  background-color: #f2f3f5;
                  cursor: pointer;
                }
  
                &.active {
                  color: var(--color-primary);
                }
              }
            }
          }
        }

        :deep(.sort-menu-popper) {
          width: 160px !important;
        }

        :deep(.nocode-todo-box-menu-popper) {
          width: 200px !important;
        }

        :deep(.nocode-todo-filter-menu-popper) {
          width: 680px !important;
          padding: 0;
          .filter-container {
            width: 100%;
            display: flex;
            flex-direction: column;

            .filter-main-box {
              flex: 1;
              padding: 24px 20px;
              .filter-title {
                font-size: 16px;
                line-height: 24px;
                margin-bottom: 12px;
              }

              .el-scrollbar {
                .el-scrollbar__view {
                  display: flex;
                  flex-direction: column;
                  gap: 8px;
                  .filter-item {
                    width: 100%;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    .el-select {
                      .el-select__wrapper {
                        border-radius: 4px;
                      }
                    }
                    .filter-item-value {
                      flex: 1;
                      .el-input__wrapper {
                        border-radius: 4px;
                      }
                    }
                  }
                }
              }
            }

            .filter-footer {
              width: 100%;
              height: 64px;
              padding: 16px 20px;
              position: relative;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-top: 1px solid #e5e6eb;
              .add-button {
                color: var(--color-primary);
                .el-icon {
                  margin-right: 4px;
                }
              }
              .submit-button-group {
                width: fit-content;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
              }
            }
          }
        }
      }

      .table-container-body {
        overflow: hidden;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        :deep(.el-table) {
          --el-table-border: 0px;
          th {
            background-color: var(--color-white);
            color: var(--text-color-regular);
            font-size: 16px;
          }
  
          tr {
            background-color: var(--color-white);
            color: var(--text-color-regular);
            font-size: 14px;
            cursor: pointer;
  
            th {
              padding: 16px 8px;
            }
          }
          .el-scrollbar {
            border-top: 1px solid var(--text-color-placeholder);
            
  
            .el-scrollbar__view {
              height: 100%;
            }
          }
  
          .el-table__empty-block {
            width: 100% !important;
          }
        }
  
  
        :deep(.el-table--border::before),
        :deep(.el-table--border::after),
        :deep(.el-table__inner-wrapper::before),
        :deep(.el-table__inner-wrapper::after) {
          display: none;
        }
  
        :deep(.el-table__body) {
  
          .row-gap {
            background-color: var(--color-white);
            border-radius: 8px;
            overflow: hidden;
            margin-top: 8px;
            height: 84px;
  
            &:hover {
              .more-filled {
                opacity: 1;
              }
            }
          }
          
        }
        .table-box {
          border-radius: 4px;
          overflow: hidden;
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background-color: #fff;
          padding: 12px 16px;

          :deep(.el-table-column--selection) {
            padding: 14px 8px;
            .el-checkbox {
              display: v-bind("showBatchOperation ? 'flex' : 'none'");
            }
          }
  
          .table-title {
            
            font-weight: 400;
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%;
            color: var(--text-color-regular);
          }
  
          .table-content {
            &.has-no-form-data > li:not(.no-form-data) {
              display: none;
            }

            li {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              color: var(--text-color-regular);
  
              .lable {
                color: var(--text-color-secondary);
              }
            }
            
            .empty-content {
              padding-left: 10px;
            }

            .no-form-data {
              white-space: normal;
              line-height: 20px;
            }
          }
  
          .avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: #1f77fc;
            margin-right: 8px;
            color: var(--color-white);
            display: flex;
            justify-content: center;
          }
  
          .time {
            font-weight: 400;
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%;
            color: var(--text-color-regular);
            padding-left: 12px;
          }

          .processing-time-cell {
            padding-left: 12px;

            >.time {
              padding-left: 0;
            }
          }

          .processing-time-tag {
            width: fit-content;
            max-width: 100%;
            height: 28px;
            padding: 0 10px;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 14px;
            line-height: 20px;
            font-weight: 400;

            &.is-countdown {
              color: #0873ff;
              background: #e8f3ff;
            }

            &.is-overtime {
              color: #e37318;
              background: #fff7e8;
            }
          }
  
          .status {
            min-width: 0;

            .status-main {
              display: flex;
              gap: 10px;
              align-items: center;
              min-width: 0;
              width: 100%;
            }
  
            span {
              font-weight: 400;
              font-size: 14px;
              line-height: 20px;
              letter-spacing: 0%;
              margin-right: 3px;
            }
  
            .flow-name {
              flex: 1;
              min-width: 0;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
  
            .tag {
              border-radius: 2px;
              color: var(--color-white);
              display: flex;
              padding: 2px 8px;
              font-weight: 400;
              font-size: 14px;
              line-height: 20px;
              letter-spacing: 0%;
              flex-shrink: 0;
              white-space: nowrap;
            }

            .stash-tag {
              color: var(--color-primary);
            }

            .upstream-tag {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              margin-top: 6px;
              border-radius: 4px;
              border: 1px solid;
              padding: 3px 8px;
              font-size: 12px;
              line-height: 18px;
              white-space: nowrap;

              &.is-canceled {
                color: var(--el-color-warning-dark-2);
                background: var(--el-color-warning-light-9);
                border-color: var(--el-color-warning-light-5);
              }

              &.is-rejected {
                color: var(--el-color-danger);
                background: var(--el-color-danger-light-9);
                border-color: var(--el-color-danger-light-5);
              }
            }
          }
  
          .todo-actions {
            display: flex;
            flex-wrap: nowrap;
            gap: 4px;
  
            .more-filled {
              display: inline-block;
              height: 24px;
              line-height: 24px;
              transform: translateY(2px);
              opacity: 0;
              transition: opacity 0.3ms ease;
            }
  
            .container {
              display: flex;
              gap: 10px;
              align-items: center;
            }
  
            .el-button {
              height: 24px;
              border-radius: 4px;
              gap: 4px;
              padding: 0px 12px;
              font-weight: 400;
              font-size: 14px;
              line-height: 20px;
              letter-spacing: 0%;
              margin: 0px;
  
              &.primary {
                border: 1px solid var(--color-primary);
                color: var(--color-primary);
              }
              &.danger {
                color: var(--color-danger);
                border-color: var(--color-danger);
              }

              &.is-disabled {
                color: var(--el-disabled-text-color);
                border-color: var(--el-disabled-border-color);
                background-color: var(--el-disabled-bg-color);
                cursor: not-allowed;
              }

              &:hover {
                background-color: var(--color-white);
              }

              &.is-disabled:hover {
                background-color: var(--el-disabled-bg-color);
              }
            }
  
            .el-icon {
              margin: 0px 7px;
            }
          }
          
          :deep(.page-container) {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            height: 32px;
  
            .el-select {
              width: 102px;
  
              .el-select__wrapper {
                min-height: 32px;
                width: 102px;
                border-radius: 4px;
              }
            }
  
            .el-pager {
              .is-active {
                background-color: var(--color-primary);
                color: var(--color-white);
              }
  
              li {
                min-width: 32px;
                height: 32px;
              }
            }
  
            .btn-prev {
              margin: 0px;
            }
  
            .el-pagination__total {
              color: #86909C;
            }
          }
        }
  
  
        :deep(.el-popper) {
          padding: 0px;
          background-color: var(--color-white);
        }
      }
    }
    // .more-menu {
    //   li {
    //     padding: 10px 12px;
    //     cursor: pointer;
    //     font-weight: 400;
    //     font-size: 14px;
    //     line-height: 20px;
    //     letter-spacing: 0%;
    //     display: flex;
    //     align-items: center;
    //     gap: 8px;
    //     border-radius: 2px;
    //     transition: all 0.3s ease;

    //     &:hover {
    //       background-color: var(--bg-color-overlay);
    //     }
    //   }
    // }
  }

  .category-tabs {
    display: flex;
    align-items: stretch;
    gap: 8px;
    padding: 4px;
    margin: 16px 16px 0;
    border-radius: 8px;
    background-color: var(--color-white);
    overflow-x: auto;
    flex-shrink: 0;
  }

  .category-tab {
    min-width: 160px;
    height: 32px;
    padding: 0 16px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #4e5969;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
    flex: 1 0 0;

    &:hover {
      background-color: #f7f8fa;
    }

    &.active {
      background: #e8f3ff;
      color: var(--color-primary);
    }

    .category-tab__label {
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14px;
      line-height: 20px;
      white-space: nowrap;
    }

    .category-tab__badge {
      min-width: 18px;
      height: 18px;
      padding: 0 6px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f53f3f;
      color: #fff;
      font-size: 12px;
      line-height: 18px;
      flex-shrink: 0;
    }
  }

  .tool-container {
    display: flex;
    align-items: center;
    height: 40px;
    border-bottom: 1px solid var(--border-color);
  }

  :deep(.nocode-todo-box-popover) {
    width: 144px;
    --el-popover-padding: 4px;

    .more-menu {
      .more-menu-item {
        height: 36px;
        display: flex;
        align-items: center;
        column-gap: 8px;
        padding: 0px 12px;
        cursor: pointer;
        border-radius: 4px;
        &:hover {
          background-color: var(--bg-color-hover);
        }
      }
    }
  }

  :deep(.todo-pending-filter-select-popper) {
    width: 112px !important;
    padding: 0;
    border-radius: 8px;
    border: 1px solid #e5e6eb;
    box-shadow: 0px 8px 20px 0px #0000001a;
    overflow: hidden;

    .el-select-dropdown {
      padding: 0;
      border: none;
      border-radius: 0;
      box-shadow: none;
      background: transparent;
    }

    .el-select-dropdown__wrap {
      padding: 0;
    }

    .el-scrollbar {
      width: 100%;
      padding: 8px 0;
      background: #fff;
    }

    .el-select-dropdown__item {
      height: 36px;
      padding: 0 16px;
      color: #1d2129;
      font-size: 14px;
      line-height: 22px;

      &.is-hovering,
      &:hover {
        background: #f2f3f5;
      }

      &.is-selected {
        color: #0873ff;
        font-weight: 400;
      }
    }

    .todo-pending-filter-option {
      height: 100%;
      display: flex;
      align-items: center;
      gap: 10px;

      .el-icon {
        color: #4e5969;
        flex-shrink: 0;
      }
    }

    .el-select-dropdown__item.is-selected {
      .todo-pending-filter-option {
        color: #0873ff;

        .el-icon {
          color: #0873ff;
        }
      }
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
