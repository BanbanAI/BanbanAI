<template>
  <div
    class="table-header"
    ref="headerRef"
    :class="{
      'is-compact': isCompact || tableProps.headerOptionsShowMode === 'right-compact',
      'is-disabled': props.disabled,
    }"
  >
    <input type="file" accept=".xlsx,.xls,.csv" ref="uploadInputRef" style="display: none;" />
    
    <!-- Default 显示模式 -->
    <template v-if="headerOptionsShowMode === 'default'">
      <!-- 左侧options -->
      <div class="button-wrapper" v-if="!isMobileDevice || tableProps.isAddDataAble">
        <el-button @click="emit('addData')" type="primary" v-if="tableProps.isAddDataAble && !isMobileDevice">
          <el-icon :size="16" style="margin-right: 4px;"><i-ep-plus></i-ep-plus></el-icon>
          {{ $t('TableHeader.add') }}
        </el-button>
        
        <template v-if="!isMobileDevice">
        <el-button class="btns import-btn" @click="importExcel" link v-if="showImportButton">
          <el-icon :size="16" style="margin-right: 4px;"><i-table-import /></el-icon>
          {{ $t('TableHeader.import') }}
        </el-button>

        <el-dropdown class="export-dropdown" trigger="click" :persistent="false" :teleported="false" @command="handleExportData" @visible-change="(value) => exportDropdownVisible = value" v-if="showExportButton">
          <el-button class="export-btn" link>
            <el-icon :size="16" style="margin-right: 4px;"><i-table-export /></el-icon>
            {{ $t('TableHeader.export') }}
            <el-icon class="export-icon export-icon--down" v-if="!exportDropdownVisible"><ArrowDown /></el-icon>
            <el-icon class="export-icon export-icon--up" v-else><ArrowUp /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :command="ExportType.FilteredData" :disabled="!widget.filterRule?.conditions?.length">{{ $t('TableHeader.filterData') }}</el-dropdown-item>
              <el-dropdown-item :command="ExportType.SelectedData" :disabled="!checkRows?.length">{{ $t('TableHeader.selectedData') }}</el-dropdown-item>
              <el-dropdown-item :command="ExportType.AllData">{{ $t('TableHeader.allData') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <table-menu trigger="click" :menus="menus" v-if="tableProps.isShowMoreMenu">
          <template #title>
            <el-icon :size="16"><i-table-more></i-table-more></el-icon>
            <span>{{ $t('TableHeader.more') }}</span>
          </template>
        </table-menu>

        </template>
      </div>
      <!-- 右侧options -->
      <div class="filter-wrapper" v-if="!isMobileDevice">
        <view-action-button-group
          v-if="viewActionItems.length"
          class="view-actions"
          :items="viewActionItems"
          :maxVisible="2"
          size="small"
          @execute="emit('executeViewAction', $event)"
        />
        <el-input :placeholder="$t('TableHeader.searchData')" v-model="searchValue" clearable @change="searchValueChange" v-if="tableProps.searchable" v-click-outside="onClickSearchOutside">
          <template #prefix>
            <el-icon :size="16"><i-ep-search /></el-icon>
          </template>
          <template #append>
          <el-popover :visible="searchFieldsPopoverVisible" :persistent="false" popper-class="search-select-field-popover" trigger="click" :teleported="false" append-to="filter-wrapper">
            <template #reference>
              <el-button class="trigger-select-field-popover-btn" @click="handlePopoverVisibleChange()" >
                <el-icon :size="16" v-if="!searchFieldsPopoverVisible"><ArrowDown /></el-icon>
                <el-icon :size="16" v-else><ArrowUp /></el-icon>
              </el-button>
            </template>
            <template #default>
              <el-scrollbar max-height="236" noresize>
                <div class="field-item" v-for="field in searchFields" :key="field.uid">
                  <el-checkbox :label="field.alias" :model-value="activeSearchField.includes(field.uid)" @click="handleChangeSearchField(field.uid)"></el-checkbox>
                </div>
              </el-scrollbar>
            </template>
          </el-popover>
        </template>
      </el-input>
        <table-filter v-if="tableProps.filterable && widget.filterDisplayMode === 'popover'" />
        <table-display-fields v-if="tableProps.hideColumnsAble" />
        <table-sort v-if="tableProps.sortable" />
        <el-dropdown v-if="tableProps.changeRowHeightAble && tableProps.searchable && !tableProps.isAlbum" placement="bottom-end" :teleported="false" :persistent="false" trigger="click" ref="rowHeightDropdownRef">
          <div class="resize-button" :title="$t('TableHeader.rowHeight')">
            <el-icon>
              <i-icon-park-outline-row-height></i-icon-park-outline-row-height>
            </el-icon>
          </div>
          <template #dropdown>
            <ul class="menu">
              <li class="menu-item"
                @click="changeRowHeight(FormTableRowHeight.LARGE)"
                :class="{active: rowHeightLevel === FormTableRowHeight.LARGE}"
              >
                {{ $t('TableHeader.high') }}
              </li>
              <li class="menu-item"
                @click="changeRowHeight(FormTableRowHeight.MEDIUM)"
                :class="{active: rowHeightLevel === FormTableRowHeight.MEDIUM}"
              >
                {{ $t('TableHeader.medium') }}
              </li>
              <li class="menu-item"
                @click="changeRowHeight(FormTableRowHeight.SMALL)"
                :class="{active: rowHeightLevel === FormTableRowHeight.SMALL}"
              >
                {{ $t('TableHeader.low') }}
              </li>
              <li class="menu-item"
                @click="changeRowHeight(FormTableRowHeight.AUTO)"
                :class="{active: rowHeightLevel === FormTableRowHeight.AUTO}"
              >
                {{ $t('TableHeader.showAll') }}
              </li>
            </ul>
          </template>
        </el-dropdown>
        <div
          v-if="tableProps.isShowAggregateFieldButton"
          class="resize-button aggregate-field-button"
          :class="{ active: tableProps.aggregateFieldActive }"
          :title="$t('TableHeader.aggregateFields') + ''"
          @click="emit('toggleAggregateFields')"
        >
          <span class="aggregate-field-button__icon"><el-icon class="menu-icon"><i-ven-nocode-table-aggregate /></el-icon></span>
        </div>
        <div
          class="resize-button refresh-button"
          :title="$t('TableHeader.refresh')"
          @click="widget.refreshData()"
        >
          <el-icon>
            <i-ep-refresh />
          </el-icon>
        </div>
      </div>
    </template>
    
    <!-- Right Compact 显示模式 -->
    <template v-else>
      <div class="button-wrapper" v-if="!isMobileDevice || tableProps.isAddDataAble">
        <el-button @click="emit('addData')" type="primary" v-if="tableProps.isAddDataAble">
          <el-icon :size="16" style="margin-right: 4px;"><i-ep-plus></i-ep-plus></el-icon>
          {{ $t('TableHeader.add') }}
        </el-button>
      </div>
      <div class="filter-wrapper right-compact">
        <div class="compact-popover-container" :class="{['visible-count-'+headerVisibleOptionCount]: true}">
          <!-- 不显示触发按钮, 仅用于显示弹窗 -->
          <table-filter ref="tableFilterRef" v-if="tableProps.filterable" />
          <table-display-fields ref="tableDisplayFieldsRef" v-if="tableProps.hideColumnsAble" />
          <table-sort ref="tableSortRef" v-if="tableProps.sortable" />
          <el-dropdown class="popover-item row-height-hidden-dropdown"
            v-if="tableProps.changeRowHeightAble && !tableProps.isAlbum"
            placement="bottom-end"
            :teleported="false"
            :persistent="false"
            trigger="click"
            ref="rowHeightDropdownRef"
            @visible-change="rowHeightVisible = $event"
          >
            <span class="el-dropdown-link"></span>
            <template #dropdown>
              <ul class="menu">
                <li class="menu-item" @click="changeRowHeight(FormTableRowHeight.LARGE)" :class="{active: rowHeightLevel === FormTableRowHeight.LARGE}">{{ $t('TableHeader.high') }}</li>
                <li class="menu-item" @click="changeRowHeight(FormTableRowHeight.MEDIUM)" :class="{active: rowHeightLevel === FormTableRowHeight.MEDIUM}">{{ $t('TableHeader.medium') }}</li>
                <li class="menu-item" @click="changeRowHeight(FormTableRowHeight.SMALL)" :class="{active: rowHeightLevel === FormTableRowHeight.SMALL}">{{ $t('TableHeader.low') }}</li>
                <li class="menu-item" @click="changeRowHeight(FormTableRowHeight.AUTO)" :class="{active: rowHeightLevel === FormTableRowHeight.AUTO}">{{ $t('TableHeader.showAll') }}</li>
              </ul>
            </template>
          </el-dropdown>
          <div class="popover-item import" v-if="showImportButton"></div>
          <el-dropdown class="popover-item export-dropdown" :teleported="false"
            @command="handleExportData"
            v-if="showExportButton"
            ref="exportDropdownRef"
            :persistent="false"
            @visible-change="exportDataVisible = $event"
          >
            <el-button class="export-btn" link>
              <el-icon :size="16" style="margin-right: 4px;"><i-table-export /></el-icon>
              {{ $t('TableHeader.export') }}
              <el-icon class="export-icon export-icon--down"><ArrowDown /></el-icon>
              <el-icon class="export-icon export-icon--up"><ArrowUp /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="ExportType.FilteredData" :disabled="!widget.filterRule?.conditions?.length">{{ $t('TableHeader.filterData') }}</el-dropdown-item>
                <el-dropdown-item :command="ExportType.SelectedData" :disabled="!checkRows?.length">{{ $t('TableHeader.selectedData') }}</el-dropdown-item>
                <el-dropdown-item :command="ExportType.AllData">{{ $t('TableHeader.allData') }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <!-- 外部options -->
        <template v-for="item in visibleOptions" :key="item.index">
          <el-popover
            v-if="item.key === 'search'"
            :persistent="false"
            :teleported="false"
            placement="bottom-end"
            trigger="click"
            :width="240"
            :visible="searchVisible"
            popper-class="compact-search-popover"
            :popper-style="{'border':'none','backgroundColor':'#fff'}"
            @show="handleSearchShow"
          >
            <template #reference>
              <div class="compact-btn" ref="searchBtnRef" @click="handleCompactSearchToggle">
                <el-icon :size="16"><component :is="item.icon" /></el-icon>
              </div>
            </template>
            <div ref="compactSearchPanelRef">
              <el-input 
                :placeholder="$t('TableHeader.searchData')" 
                v-model="searchValue" 
                clearable 
                @change="searchValueChange" 
                :ref="(el) => compactSearchInputRef = el"
                :style="{'--el-input-border-radius':'4px'}"
              >
                <template #prefix>
                  <el-icon :size="16"><i-ep-search /></el-icon>
                </template>
                <template #append>
                  <el-popover
                    :visible="searchFieldsPopoverVisible"
                    :persistent="false"
                    popper-class="search-select-field-popover"
                    trigger="click"
                    placement="bottom-end"
                    :show-arrow="false"
                    :offset="4"
                    :teleported="false"
                  >
                    <template #reference>
                      <el-button class="trigger-select-field-popover-btn" @click.stop="handlePopoverVisibleChange()">
                        <el-icon :size="16" v-if="!searchFieldsPopoverVisible"><ArrowDown /></el-icon>
                        <el-icon :size="16" v-else><ArrowUp /></el-icon>
                      </el-button>
                    </template>
                    <template #default>
                      <div ref="compactSearchFieldsPopoverContentRef">
                        <el-scrollbar max-height="236" noresize>
                          <div class="field-item" v-for="field in searchFields" :key="field.uid">
                            <el-checkbox :label="field.alias" :model-value="activeSearchField.includes(field.uid)" @click="handleChangeSearchField(field.uid)"></el-checkbox>
                          </div>
                        </el-scrollbar>
                      </div>
                    </template>
                  </el-popover>
                </template>
              </el-input>
            </div>
          </el-popover>
          <div v-else class="compact-btn" @click.stop="item.click">
            <el-icon :size="16"><component :is="item.icon" /></el-icon>
          </div>
        </template>
        <div
          v-if="tableProps.isShowAggregateFieldButton"
          class="compact-btn aggregate-field-btn"
          :class="{ active: tableProps.aggregateFieldActive }"
          @click.stop="emit('toggleAggregateFields')"
        >
          <span class="aggregate-field-btn__icon">Σ</span>
        </div>
        <!-- 更多options -->
        <table-menu trigger="click" :menus="hiddenOptions" v-if="hiddenOptions.length">
          <template #title>
            <el-icon :size="16"><i-table-more></i-table-more></el-icon>
            <!-- <span>{{ $t('TableHeader.more') }}</span> -->
          </template>
        </table-menu>
        <div
          class="compact-btn refresh-button"
          :title="$t('TableHeader.refresh')"
          @click.stop="widget.refreshData()"
        >
          <el-icon :size="16">
            <i-ep-refresh />
          </el-icon>
        </div>
      </div>
    </template>

    <!-- 移动端 -->
    <div class="mobile-filter-wrapper" v-if="isMobileDevice">
      <div 
        class="search search-wrapper" 
        v-if="searchVisible && tableProps.searchable" 
        ref="searchContainerRef"
        v-click-outside="onClickSearchOutside"
      >
        <div ref="popoverRef" class="popover-anchor-point"></div>
        
        <el-input
          :placeholder="$t('TableHeader.searchData')"
          v-model="searchValue"
          ref="searchInputRef"
          clearable
          @change="searchValueChange"
        >
          <template #prefix>
            <el-icon :size="16"><i-ep-search /></el-icon>
          </template>
          
          <template #append>
            <el-button 
              class="trigger-select-field-popover-btn" 
              @click.stop="handlePopoverVisibleChange()"
            >
              <el-icon :size="12" v-if="!searchFieldsPopoverVisible"><ArrowDown /></el-icon>
              <el-icon :size="12" v-else><ArrowUp /></el-icon>
            </el-button>
          </template>
        </el-input>

        <el-popover
          :visible="searchFieldsPopoverVisible"
          :virtual-ref="searchInputRef"
          virtual-triggering
          trigger="click"
          placement="bottom"
          popper-class="search-select-field-popover"
          :teleported="false"
          :show-arrow="false"
          append-to="filter-wrapper"
        >
          <template #default>
            <el-scrollbar max-height="236" noresize>
              <div class="field-item" v-for="field in searchFields" :key="field.uid">
                <el-checkbox :label="field.alias" :model-value="activeSearchField.includes(field.uid)" @click="handleChangeSearchField(field.uid)"></el-checkbox>
              </div>
            </el-scrollbar>
          </template>
        </el-popover>
        <el-button class="cancel-text" type="primary" link @click="searchVisible = !searchVisible">{{ $t('TableHeader.cancel') }}</el-button>
      </div>
      <div class="others" v-else ref="othersRef">
        <view-action-button-group
          v-if="viewActionItems.length"
          class="view-actions mobile-view-actions"
          :items="viewActionItems"
          :maxVisible="1"
          size="small"
          @execute="emit('executeViewAction', $event)"
        />
        <el-button class="search-btn" :title="$t('TableHeader.searchData')" link @click="searchVisible = !searchVisible" v-if="tableProps.searchable">
          <el-icon class="search-icon" :size="16"><i-ep-search /></el-icon>
          {{ $t('TableHeader.search') }}
        </el-button>
        <mobile-table-filter v-if="tableProps.filterable && itemVisibility.filter" />
        <mobile-table-display-fields v-if="tableProps.hideColumnsAble && itemVisibility.display" />
        <div class="sort-button" v-if="tableProps.sortable && itemVisibility.sort">
          <div style="display: flex; align-items: center;" @click="handleClickSort">
            <img src="@renderer/assets/icons/mobile/nocode/mobile-sort.svg" alt="" style="margin-right: 4px;"><span>{{ $t('TableHeader.sort') }}</span>
          </div>
        </div>
        <div class="row-height" v-if="tableProps.changeRowHeightAble && itemVisibility.rowheight" style="display: flex; align-items: center;">
          <div @click="handleClickRowHeight" style="width: 100%; display: flex; align-items: center;">
            <el-icon style="margin-left: 2px;">
              <i-icon-park-outline-row-height></i-icon-park-outline-row-height>
            </el-icon>
            <span style="margin-left: 4px;">{{ $t('TableHeader.height') }}</span>
          </div>
        </div>
        <el-popover
          :visible="morePopoverVisible"
          :persistent="false"
          :teleported="false"
          :width="144"
          trigger="click"
          placement="bottom"
          popper-class="more-popover"
          popper-style="background-color: #fff;"
          :show-arrow="false"
        >
          <template #reference>
            <div class="more-button" @click="morePopoverVisible = !morePopoverVisible">
              <el-icon :size="16"><i-table-more></i-table-more></el-icon>
              {{ $t('TableHeader.more') }}
            </div>
          </template>
          <template #default>
            <div class="more-menu">
              <div class="more-menu-item" v-if="overflowedItems.includes('filter')">
                <mobile-table-filter/>
              </div>
              <div class="more-menu-item" v-if="overflowedItems.includes('display')">
                <mobile-table-display-fields />
              </div>
              <div class="more-menu-item" v-if="overflowedItems.includes('sort')" @click="handleClickSort">
                 <img src="@renderer/assets/icons/mobile/nocode/mobile-sort.svg" alt="" style="margin-right: 4px;"/>
                 <span>{{ $t('TableHeader.sort') }}</span>
              </div>
              <div class="more-menu-item row-height" v-if="overflowedItems.includes('rowheight')" style="display: flex; align-items: center;">
                <div @click="handleClickRowHeight" style="width: 100%; display: flex; align-items: center;">
                  <el-icon style="margin-left: 2px;">
                    <i-icon-park-outline-row-height></i-icon-park-outline-row-height>
                  </el-icon>
                  <span style="margin-left: 4px;">{{ $t('TableHeader.height') }}</span>
                </div>
              </div>
              <div class="more-menu-item refresh-menu-item" @click="morePopoverVisible = false; widget.refreshData()">
                <el-icon :size="16"><i-ep-refresh /></el-icon>
                <span>{{ $t('TableHeader.refresh') }}</span>
              </div>
            </div>
          </template>
        </el-popover>
        <mobile-table-sort v-if="tableProps.sortable" v-model="sortDrawerVisible" />
        <el-drawer 
          class="row-height-drawer"
          v-model="rowHeightVisible" 
          :teleported="false"
          direction="btt" 
          size="40%" 
          :show-close="false"
          :with-header="false"
          close-on-click-modal
        >
          <div class="container">
            <el-radio-group v-model="rowHeightRadio">
              <el-radio :value="1" @click="changeRowHeight(FormTableRowHeight.SMALL)">{{ $t('TableHeader.low') }}</el-radio>
              <el-radio :value="2" @click="changeRowHeight(FormTableRowHeight.MEDIUM)">{{ $t('TableHeader.medium') }}</el-radio>
              <el-radio :value="3" @click="changeRowHeight(FormTableRowHeight.LARGE)">{{ $t('TableHeader.high') }}</el-radio>
              <el-radio :value="4" @click="changeRowHeight(FormTableRowHeight.AUTO)">{{ $t('TableHeader.showAll') }}</el-radio>
            </el-radio-group>
          </div>
        </el-drawer>
      </div>
    </div>
  </div>
  <teleport to='body'>
    <table-delete-data-dialog
      v-if="deleteTipDialogVisible"
      v-model="deleteTipDialogVisible"
      @deleteTableData="deleteTableData"
      :title="$t('TableHeader.batchDel')"
      :dataText="getDelTxt()"
      :deleteTip="$t('TableHeader.deleteConfirmTip')"
      :deleteWarningText="$t('TableHeader.deleteToRecycleBinWarning')"
      :unfinishedProcessCount="unfinishedProcessCount"
    ></table-delete-data-dialog>
    <!-- 导入Excel数据弹窗 -->
    <ImportExcelDialog
      v-if="importDialogReady"
      ref="importExcelDialogRef"
      v-model:dialogVisible="excelDialogVisible"
      :contentSource="'tableHeaderValue'"
      :runtime="runtime" 
      :formFields="formFields"
      :table="table"
      class="import-excel-dialog"
      @closeDialog="handleCloseDialog"
      @importCompleted="handleImportCompleted"
    />
  
    <!-- 导出Excel数据弹窗 -->
    <ExportDataDialog
      v-if="exportDialogReady"
      ref="exportDataDialogRef"
      v-model:dialogVisible="exportDialogVisible"
      :fields="fields"
      :exportType="exportType"
      @closeDialog="handleCloseExportDialog"
    />

    <template v-if="tableProps.isShowMoreMenu">
      <!-- 系统打印弹窗 -->
      <SystemPrintDialog
        v-if="printDialogsReady"
        v-model="systemPrintDialogVisible"
        :title="$t('TableHeader.sysPrint')"
      />
  
      <!-- 合并打印确认弹窗 -->
      <MergeDialog
        v-if="printDialogsReady"
        v-model="mergePrintDialogVisible"
        @confirm="mergePrintDialogConfirm"
      />
      
      <!-- 打印弹窗 -->
      <PrintDialog
        v-if="printDialogsReady"
        v-model="printDialogVisible"
        :title="$t('TableHeader.print')"
        v-bind="printingInfo"
        @closed="closePrintingDialog"
      />
  
      <!-- 打印记录弹窗 -->
      <PrintRecordDialog
        v-if="printDialogsReady"
        v-model="printRecordDialogVisible"
        :title="$t('TableHeader.printRecord')"
        :nocodeId="nocode.meta.id"
        :table="table"
      />
      
      <!-- 打印结束调用弹窗 -->
      <OfficePrintPreview
        v-if="printDialogsReady"
        v-model="visibleOfPreview"
        :uploadTemplateName="uploadTemplateName"
        :preViewPath="previewPath"
        :nocodeId="widget.nocodeId"
        :tableId="widget.formTableUID"
        :recordId="templateRecord?.uid"
        :isTemporary="templateRecord?.isTemporary ?? false"
        @download="downloadPrintTemplate"
        @closed="closePreviewDialog"
      />
      <WordPrintPreview
        v-if="printDialogsReady"
        v-model="visibleOfWordPreview"
        :uploadTemplateName="uploadTemplateName"
        :preViewPath="previewPath"
        :nocodeId="widget.nocodeId"
        :tableId="widget.formTableUID"
        :recordId="templateRecord?.uid"
        :isTemporary="templateRecord?.isTemporary ?? false"
        @download="downloadPrintTemplate"
        @closed="closePreviewDialog"
      />
    </template>
  </teleport>
</template>

<script lang='ts' setup>
import TableMenu from './table-menu/TableMenu.vue';
import TableFilter from './TableFilter.vue';
import TableSort from './TableSort.vue';
import TableDisplayFields from './TableDisplayFields.vue';
import TableDeleteDataDialog from './TableDeleteDataDialog.vue';
import ViewActionButtonGroup from "./ViewActionButtonGroup.vue";
import { Menus } from './table-menu/types';
import { computed, defineAsyncComponent, nextTick, onMounted, onBeforeUnmount, ref, inject, watch, reactive, Ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useTable, useTableProps } from '../hooks';
import { useFormTable } from '../../../../views/editor/form/hooks';
import { FormTableRowHeight, PrintTemplateType, PrintTemplateMode, ExportType, PrintedTemplateRecord, PrintTemplate, RuleFunc, FormWidgetType, PermissionRangeType, ViewAction, ViewActionConditionScope, ViewActionTarget, ViewActionTriggerMode, ViewActionViewConditionMode, ViewOperationPermissionKey } from "@common/types/nocode";
import { getViewActionTriggerMode, isViewActionSelectedTarget, isViewActionViewTarget } from "@common/utils/viewAction";
import { getAllRelatedDepartments, getStatusSystemField, getUUIDSystemField, isBusinessField, isSystemField, SystemField } from '@common/utils';
import { Field, ProcessNodeStatus } from '@common/types/project';
import { useRuntime } from '@renderer/utils';
import { isMobile } from "@renderer/utils";
import { useResizeObserver } from '@vueuse/core';
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { NOCODE } from '@renderer/types';
import { usePassportStore } from '@renderer/stores';
import { doDownload } from "@renderer/utils";
import { projectApi } from '@renderer/utils/api/project';
import i18next from 'i18next';
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { ClickOutside as vClickOutside } from 'element-plus'
import { useRoute } from 'vue-router';
import { getCurrentAccountViewOperationPermissions } from '@renderer/views/nocode/utils';
import { getDeleteResultMessage, hasDeleteFailures } from '../delete-result-message';

const ImportExcelDialog = defineAsyncComponent(() => import('@renderer/views/nocode/components/ImportExcelDialog.vue'));
const ExportDataDialog = defineAsyncComponent(() => import('@renderer/views/nocode/components/ExportDataDialog.vue'));
const SystemPrintDialog = defineAsyncComponent(() => import('./SystemPrintDialog.vue'));
const MergeDialog = defineAsyncComponent(() => import('./MergeDialog.vue'));
const PrintDialog = defineAsyncComponent(() => import('./PrintDialog.vue'));
const PrintRecordDialog = defineAsyncComponent(() => import('./PrintRecordDialog.vue'));
const OfficePrintPreview = defineAsyncComponent(() => import('@renderer/views/nocode/views/viewer/main/OfficePrintPreview.vue'));
const WordPrintPreview = defineAsyncComponent(() => import('@renderer/views/nocode/views/viewer/main/WordPrintPreview.vue'));

const isMobileDevice = isMobile();
const route = useRoute();
const isPublicVisit = computed(() => route.matched?.some(record => record.meta?.isPublicShare === true || record.meta?.isPublicRowShare === true) || route.meta?.isPublicShare === true || route.meta?.isPublicRowShare === true || route.name === 'PublicQuery');

interface Props {
  rowHeightLevel: FormTableRowHeight;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<Props>(),
  {}
);

const emit = defineEmits<{
  (event: "addData");
  (event: "importCompleted");
  (event: "changeRowHeight", value: FormTableRowHeight);
  (event: "openBatchEditDialog");
  (event: "openAssignOwnerDialog");
  (event: "toggleAggregateFields");
  (event: "openRecycleBin");
  (event: "executeViewAction", action: ViewAction);
}>();

const exportDropdownVisible = ref(false);
const importExcelDialogRef = ref()
const widget = useTable();
const table = useFormTable();
const tableProps = useTableProps();
const passportState = usePassportStore();
const uploadInputRef = ref<HTMLInputElement>();
const morePopoverVisible = ref(false);
const sortDrawerVisible = ref(false);
const rowHeightDropdownRef = ref();
const exportDropdownRef = ref();
const rowHeightVisible = ref(false);
const exportDataVisible = ref(false);
const rowHeightRadio = ref(1);
const headerRef = ref<HTMLElement>();
const isCompact = ref(false);
const searchBtnRef = ref<HTMLElement>();

const { stop: stopHeaderResizeObserver } = useResizeObserver(headerRef, (entries) => {
  const entry = entries[0];
  const { width } = entry.contentRect;
  isCompact.value = width <= 830;
});
const searchInputRef = ref();

const printingInfo = reactive({
  loading: false,
  status: "success" as "success" | "fail",
});

const nocode = inject(NOCODE);
const filteredPrintTemplate = ref([])
const importDialogReady = ref(false);
const exportDialogReady = ref(false);
const printDialogsReady = ref(false);

const printTemplateType = ref<PrintTemplateType>()
const visibleOfPreview = ref(false);
const visibleOfWordPreview = ref(false);
const previewArrayBuffer = ref<ArrayBuffer | Blob | null>(null);
const previewPathStr = ref<string | null>(null);
const templateRecord: Ref<PrintedTemplateRecord> = ref();
const previewPath = computed(()=>{
  if (previewArrayBuffer.value) {
    return previewArrayBuffer.value;
  }
  return previewPathStr.value ? previewPathStr.value : '';
});
const uploadTemplateName = ref('');

const searchVisible = ref(false)

const hasViewActionPermission = (action: ViewAction) => {
  const permission = nocode?.value?.body?.permissions?.operation?.[tableProps.tableUID]?.[action.id];
  const account = passportState.account;
  if (!permission || permission.rangeType !== PermissionRangeType.CUSTOM || account?.isAdmin) {
    return true;
  }
  if (!account) {
    return false;
  }

  const departments = getAllRelatedDepartments(widget.organizeUtil?.departments || [], account?.departments || []);
  return permission.range?.users?.includes(account.id)
    || permission.range?.roles?.some(roleId => account.roles?.includes(roleId))
    || permission.range?.departments?.some(departmentId => departments.includes(departmentId));
}

const currentViewOperationPermissions = computed(() => {
  return getCurrentAccountViewOperationPermissions({
    permission: nocode?.value?.body?.permissions?.view?.[tableProps.tableUID]?.[tableProps.viewId],
    account: passportState.account,
    departments: widget.organizeUtil?.departments || [],
  });
});
const showImportButton = computed(() => {
  return tableProps.isImportDataAble && currentViewOperationPermissions.value[ViewOperationPermissionKey.IMPORT];
});
const showExportButton = computed(() => {
  return tableProps.isExportDataAble
    && tableProps.operationSettings?.export !== false
    && currentViewOperationPermissions.value[ViewOperationPermissionKey.EXPORT];
});
const showBatchEditButton = computed(() => {
  return tableProps.isEditDataAble && currentViewOperationPermissions.value[ViewOperationPermissionKey.BATCH_UPDATE];
});
const showBatchDeleteButton = computed(() => {
  return tableProps.isDeleteDataAble && currentViewOperationPermissions.value[ViewOperationPermissionKey.BATCH_DELETE];
});
const showBatchPrintButton = computed(() => {
  return tableProps.isPrintDataAble !== false
    && tableProps.operationSettings?.print !== false
    && currentViewOperationPermissions.value[ViewOperationPermissionKey.BATCH_PRINT];
});

const getViewActionDisabled = (action: ViewAction) => {
  if (!isViewActionViewTarget(action.target) || action.executeCondition.scope !== ViewActionConditionScope.VIEW || !action.executeCondition.enabled) {
    return false;
  }
  const isSelectedTarget = isViewActionSelectedTarget(action.target);
  if (isSelectedTarget && !(checkRows.value?.length || 0)) {
    return false;
  }
  const currentCount = isSelectedTarget
    ? (checkRows.value?.length || 0)
    : widget.total;
  if (getViewActionTriggerMode(action) === ViewActionTriggerMode.EACH_RECORD) {
    return currentCount <= 0;
  }
  if (action.executeCondition.mode === ViewActionViewConditionMode.HAS_DATA) {
    return currentCount <= 0;
  }
  if (action.executeCondition.mode === ViewActionViewConditionMode.NO_DATA) {
    return currentCount > 0;
  }
  return false;
}

const viewActionItems = computed(() => {
  return (tableProps.actions || [])
    .filter(action => isViewActionViewTarget(action.target))
    .filter(action => hasViewActionPermission(action))
    .sort((left, right) => (left.order || 0) - (right.order || 0))
    .map(action => ({
      action,
      disabled: getViewActionDisabled(action),
      tip: action.executeCondition?.tip || "",
    }));
})

const exportType = ref<ExportType>(ExportType.AllData);

const searchValue = ref('');

function searchValueChange() {
  if (activeSearchField.value.length === 0) {
    ElMessage.error(i18next.t('TableHeader.searchFieldEmpty'));
    return;
  }
  if (!searchValue.value) {
    widget.searchValue = null;
  } else {
    widget.searchValue = []
    for (const activeItem of activeSearchField.value) {
      const currentOption = searchFields.value.find((item) => item.uid === activeItem);
      if (currentOption?.self?.subType === 'number') {
        widget.searchValue.push({
          uid: currentOption.uid,
          func: RuleFunc.EQUAL,
          value: Number(searchValue.value)
        });
      } else {
        widget.searchValue.push({
          uid: currentOption.uid,
          func: RuleFunc.CONTAIN,
          value: searchValue.value
        });
      }
    }
  }
  widget.refreshData();
}

const runtime = useRuntime();
const deleteTipDialogVisible = ref(false);
const systemPrintDialogVisible = ref(false);
const mergePrintDialogVisible = ref(false)
const printDialogVisible = ref(false);
const printRecordDialogVisible = ref(false);
// 是否需要合并打印
const mergePrint = ref(false)
let afterPrintFun = null
const checkRows = computed(() => {
  return widget.checkboxRow || []
});

const deleteType = ref<'check' | 'filter' | 'all'>();
const unfinishedProcessCount = computed(() => {
  if (deleteType.value !== 'check') {
    return 0;
  }
  const statusFieldUid = getStatusSystemField(table.value?.fields || [])?.uid;
  if (!statusFieldUid) {
    return 0;
  }
  return (checkRows.value || []).filter(row => row?.[statusFieldUid] === ProcessNodeStatus.IN_PROGRESS).length;
});
const deleteCheckRowsData = async () => {
  if(!checkRows.value?.length){
    ElMessage.error(i18next.t('TableHeader.selectRowFirst'));
    return;
  }
  try {
    const result = await widget.removeRows(checkRows.value, runtime);
    const message = getDeleteResultMessage(result, i18next.t('TableHeader.delSuccess'));
    if (hasDeleteFailures(result)) {
      ElMessage.warning(message);
    } else {
      ElMessage.success(message);
    }
  } catch (err) {
    ElMessage.error(err.message);
  }
}

const othersRef = ref<HTMLDivElement | null>(null);
const itemVisibility = ref({
  filter: true,
  display: true,
  sort: true,
  rowheight: true,
});

// 列出 更多 菜单中的项
const overflowedItems = computed(() => {
  const items = [];
  if (tableProps.filterable && !itemVisibility.value.filter) items.push('filter');
  if (tableProps.hideColumnsAble && !itemVisibility.value.display) items.push('display');
  if (tableProps.sortable && !itemVisibility.value.sort) items.push('sort');
  if (!itemVisibility.value.rowheight) items.push('rowheight');
  return items;
});

// 计算哪些控件应该显示出来
const calculateVisibility = () => {
  if (!isMobileDevice || !othersRef.value || !othersRef.value.children) return;

  const containerWidth = othersRef.value.clientWidth;
  const children = Array.from(othersRef.value.children) as HTMLElement[];
  
  let requiredWidth = 0;
  children.forEach(child => {
    if(child.style.display !== 'none') {
       requiredWidth += child.offsetWidth;
    }
  });

  const GAP = 18;
  if (children.length > 1) {
    requiredWidth += (children.length - 1) * GAP;
  }

  const newVisibility = { ...itemVisibility.value };
  
  // 将控件移至 更多 菜单的顺序
  const hidePriority = ['rowheight', 'sort', 'display', 'filter'];

  if (requiredWidth > containerWidth) {
    for (const id of hidePriority) {
        // 找到对应的元素获取宽度
        const element = children.find(el => {
            if (id === 'sort') return el.classList.contains('sort-button');
            if (id === 'filter') return el.classList.contains('table-filter');
            if (id === 'display') return el.classList.contains('table-display-fields');
            if (id === 'rowheight') return el.classList.contains('row-height');
            return false;
        });

        if (element && newVisibility[id]) {
            requiredWidth -= (element.offsetWidth + GAP);
            newVisibility[id] = false;
            
            // 如果宽度足够
            if (requiredWidth <= containerWidth) {
                break;
            }
        }
    }
  }

  itemVisibility.value = newVisibility;
};
// 触发控件行的重新计算
const updateLayout = () => {
  itemVisibility.value = { filter: true, display: true, sort: true, rowheight: true };
  nextTick(() => {
    calculateVisibility();
  });
};

const deleteFilterRowsData = async () => {
}

const deleteAllRowsData = async () => {
  try {
    // 把数据表清空
    const result = await widget.removeAllRows(runtime);
    const message = getDeleteResultMessage(result, i18next.t('TableHeader.delSuccess'));
    if (hasDeleteFailures(result)) {
      ElMessage.warning(message);
    } else {
      ElMessage.success(message);
    }
  } catch (err) {
    ElMessage.error(err.message);
  }
}

const deleteTableData = async () => {
  switch (deleteType.value) {
    case 'check':
      await deleteCheckRowsData();
      break;
    case 'filter':
      await deleteFilterRowsData();
      break;
    case 'all':
      await deleteAllRowsData();
      break;
    default:
      break;
  }

}

const getFilteredPrintTemplate = async() => { 
  if (isPublicVisit.value) {
    filteredPrintTemplate.value = [];
    return;
  }
  const data = await widget.getFilteredPrintTemplatesCached(nocode.value.meta.id, tableProps.tableUID).catch(err => {
    ElMessage.error(err.message);
    return null;
  });
  if (data) {
    filteredPrintTemplate.value = Array.isArray(data) ? data.filter(item => item.enabled) : [];
  }
}

const closePrintingDialog = () => {
  printingInfo.loading = false;
  printingInfo.status = "success";
}

const generatePrintFile = async (printTemplateUID, selectRowUids) => { 
  const res = await projectApi.generatePrintFile({
    nocodeId: nocode.value.meta.id,
    tableId: table.value.uid,
    printTemplateUID: printTemplateUID,
    selectRowUids: selectRowUids,
    mergePrint: typeof mergePrint.value === 'boolean' ? mergePrint.value : false,
  }).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
  });
  return res;
}
const mergePrintDialogConfirm = async (value: boolean) => {
  mergePrint.value = value
  await afterPrintFun()
}

const closePreviewDialog = () => {
  previewArrayBuffer.value = null;
  previewPathStr.value = null;
  uploadTemplateName.value = '';
};

const downloadPrintTemplate = async(downloadSrc) => { 
  if(typeof downloadSrc === 'string') {  // 如果是字符串url
    doDownload({
      url: downloadSrc,
      name: uploadTemplateName.value,
    })
  } else if (downloadSrc instanceof Blob || downloadSrc instanceof ArrayBuffer) {  // 如果是Blob或者Arraybuffer
    const blob = new Blob([downloadSrc], {type: printTemplateType.value === PrintTemplateType.EXCEL ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const url = URL.createObjectURL(blob);
    doDownload({
      url: url,
      name: uploadTemplateName.value,
    })
  } else {  // 如果是File对象
    const url = URL.createObjectURL(downloadSrc);
    doDownload({
      url: url,
      name: uploadTemplateName.value,
    })
  }
};

const menus = computed((): Menus => {
  return [
    {
      index: "1",
      title: i18next.t('TableHeader.batchEdit'),
      icon: ITableBatchModify,
      get visible() {
        return showBatchEditButton.value;
      },
      children: [
        {
          index: "1-1",
          title: i18next.t('TableHeader.editSelected', { count: checkRows.value?.length || 0 }),
          click: () => {
            emit('openBatchEditDialog');
          },
          disabled: !checkRows.value?.length,
        },
        {
          index: "1-2",
          title: i18next.t('TableHeader.assignSelected', { count: checkRows.value?.length || 0 }),
          click: () => {
            emit('openAssignOwnerDialog');
          },
          disabled: !checkRows.value?.length,
          visible: !!passportState.account?.isAdmin,
        },
        {
          index: "1-3",
          title: i18next.t('TableHeader.editFilterNone'),
          visible: false,
          click: () => {

          }
        },
        {
          index: "1-4",
          title: i18next.t('TableHeader.editAll'),
          visible: false,
          click: () => {

          }
        }
      ]
    },
    {
      index: "2",
      title: i18next.t('TableHeader.batchDel'),
      icon: IEpDelete,
      get visible() {
        return showBatchDeleteButton.value;
      },
      children: [
        {
          index: "2-1",
          get title() {
            return i18next.t('TableHeader.delSelected', { count: checkRows.value?.length || 0 });
          },
          get disabled() {
            return !checkRows.value?.length;
          },
          click: async () => {
            if(!checkRows.value?.length){
              ElMessage.error(i18next.t('TableHeader.selectRowAlert'));
              return;
            }
            deleteType.value = 'check';
            deleteTipDialogVisible.value = true;
          }
        },
        {
          index: "2-2",
          title: i18next.t('TableHeader.delFilterNone'),
          click: () => {
            deleteType.value = 'filter';
            deleteTipDialogVisible.value = true;
          },
          get disabled() {
            return true;
          },
          visible: false,
        },
        {
          index: "2-3",
          title: i18next.t('TableHeader.clearAll'),
          click: () => {
            deleteType.value = 'all';
            deleteTipDialogVisible.value = true;
          },
        }
      ]
    },
    {
      index: "3",
      title: i18next.t('TableHeader.batchPrint'),
      icon: ITablePrint,
      get visible() {
        return showBatchPrintButton.value;
      },
      children: [
        {
          index: "3-1",
          title: i18next.t('TableHeader.sysPrint'),
          get disabled() {
            return !checkRows.value?.length;
          },
          click: () => {
            printDialogsReady.value = true;
            systemPrintDialogVisible.value = true;
          }
        },
        ...(Object.keys(filteredPrintTemplate.value).map((key, index) => ({
          index: `3-${index + 2}`,
          title: filteredPrintTemplate.value[key]?.name,
          visible: true,
          get disabled() {
            return !checkRows.value?.length;
          },
          click: async() => {
            afterPrintFun = async () => {
              printDialogsReady.value = true;
              printingInfo.loading = true;
              printDialogVisible.value = true;
              const uuidField = getUUIDSystemField(table.value.fields)
              const selectRowUIDs = checkRows.value.map((row) => row[uuidField.uid]); 
              const res = await generatePrintFile(filteredPrintTemplate.value[key].uid, selectRowUIDs)
              printingInfo.loading = false;
              if (!res) {
                printingInfo.status = "fail";
                return;
              }
              templateRecord.value = res.record;
              printTemplateType.value = filteredPrintTemplate.value[key].type;
              if(filteredPrintTemplate.value[key].mode === PrintTemplateMode.SINGLE){
                previewPathStr.value = `${window.location.origin}${templateRecord.value.url}`;
                uploadTemplateName.value = templateRecord.value.name;
                if (filteredPrintTemplate.value[key].type === PrintTemplateType.EXCEL) {
                  visibleOfPreview.value = true;
                } else {
                  visibleOfWordPreview.value = true;
                }
              } else if (filteredPrintTemplate.value[key].mode === PrintTemplateMode.MULTIPLE) {
                doDownload({
                  url: res.record.url,
                  name: res.record.name,
                })
              }
              afterPrintFun = null
            }

            const checkNum = checkRows.value?.length ?? 0
            if (checkNum > 1) {
              mergePrint.value = false
              printDialogsReady.value = true;
              mergePrintDialogVisible.value = true
            } else {
              await afterPrintFun?.()
            }
          },
        })))
      ]
    },
    {
      index: "4",
      title: i18next.t('TableHeader.uploadFile'),
      icon: ITableDownload,
      visible: false,
      children: [
        {
          index: "4-1",
          title: i18next.t('TableHeader.uploadToSelected', { count: 2 }),
          click: () => {

          },
        },
        {
          index: "4-2",
          title: i18next.t('TableHeader.uploadToFilterNone'),
          click: () => {

          },
          get disabled() {
            return true;
          }
        },
        {
          index: "4-3",
          title: i18next.t('TableHeader.uploadToAll'),
          click: () => {

          }
        }
      ]
    },
    {
      index: "5",
      title: i18next.t('TableHeader.downloadFile'),
      icon: ITableDownload,
      visible: false,
      children: [
        {
          index: "5-1",
          title: i18next.t('TableHeader.downloadSelected', { count: 2 }),
          click: () => {

          }
        },
        {
          index: "5-2",
          title: i18next.t('TableHeader.downloadFilterNone'),
          click: () => {

          },
          get disabled() {
            return true;
          }
        },
        {
          index: "5-3",
          title: i18next.t('TableHeader.downloadToAll'),
          click: () => {

          }
        }
      ]
    },
    {
      index: "6",
      title: i18next.t('TableHeader.optRecord'),
      icon: ITableRecord,
      visible: true,
      children: [
        {
          index: "6-1",
          title: i18next.t('TableHeader.printLog'),
          click: () => {
            printDialogsReady.value = true;
            printRecordDialogVisible.value = true;
          }
        },
        {
          index: "6-2",
          title: i18next.t('TableHeader.editRecord'),
          visible: false,
          click: () => {

          }
        }
      ]
    },
    {
      index: "7",
      title: i18next.t('TableHeader.recycleBin'),
      icon: IWorkbenchRecycle,
      get visible() {
        return tableProps.showRecycleBinEntry;
      },
      click: () => {
        emit('openRecycleBin');
      }
    }
  ]
})

// =============== 右侧紧凑模式 ===============
const headerOptionsShowMode = computed(() => tableProps.headerOptionsShowMode || 'default');
const headerVisibleOptionCount = computed(() => tableProps.headerVisibleOptionCount || 4);
const compactSearchInputRef = ref();
const compactSearchPanelRef = ref<HTMLElement>();
const compactSearchFieldsPopoverContentRef = ref<HTMLElement>();
const tableFilterRef = ref();
const tableSortRef = ref();
const tableDisplayFieldsRef = ref();

const handleSearchShow = () => {
  nextTick(() => {
    compactSearchInputRef.value?.focus();
  });
};

const compactAllMenus = computed(() => {
  const list = [];
  if (headerOptionsShowMode.value !== 'right-compact') {
    return [];
  }
  
  // 搜索
  if (tableProps.searchable) {
    list.push({
      key: 'search',
      title: i18next.t('TableHeader.searchData'),
      icon: IEpSearch,
      click: () => {},
    });
  }

  // 过滤
  if (tableProps.filterable) {
    list.push({
      key: 'filter',
      title: i18next.t('TableFilter.filter'),
      icon: ITableFilter,
      click: () => {
        tableFilterRef.value?.open();
      },
    });
  }

  // 显示字段
  if (tableProps.hideColumnsAble) {
    list.push({
      key: 'display',
      title: i18next.t('TableDisplayFields.displayField'),
      icon: ITableDisplayFields,
      click: () => {
        tableDisplayFieldsRef.value?.open();
      },
    });
  }

  // 排序
  if (tableProps.sortable) {
    list.push({
      key: 'sort',
      title: i18next.t('TableSort.sort'),
      icon: ITableSort,
      click: () => {
        tableSortRef.value?.open();
      },
    });
  }

  // 行高
  if (tableProps.changeRowHeightAble && !tableProps.isAlbum) {
    list.push({
      key: 'rowHeight',
      title: i18next.t('TableHeader.rowHeight'),
      icon: IIconParkOutlineRowHeight,
      click: () => {
        nextTick(() => {
          rowHeightVisible.value = !rowHeightVisible.value;
          if (rowHeightVisible.value) {
            rowHeightDropdownRef.value?.handleOpen();
          } else {
            rowHeightDropdownRef.value?.handleClose();
          }
        })
      },
    });
  }

  // 导入
  if (showImportButton.value && !isMobileDevice) {
    list.push({
      key: 'import',
      title: i18next.t('TableHeader.import'),
      icon: ITableImport,
      click: importExcel,
    });
  }

  // 导出
  if (showExportButton.value && !isMobileDevice) {
    let exportDataVisible = false;
    list.push({
      key: 'export',
      title: i18next.t('TableHeader.export'),
      icon: ITableExport,
      click: () => {
        if (visibleOptions.value.find(item => item.key === 'export')) {
          exportDataVisible = !exportDataVisible;
          if (exportDataVisible) {
            exportDropdownRef.value?.handleOpen();
          } else {
            exportDropdownRef.value?.handleClose();
          }
        }
      },
      children: [
        {
          index: 'export-1',
          title: i18next.t('TableHeader.filterData'),
          disabled: !widget.filterRule?.conditions?.length,
          click: () => handleExportData(ExportType.FilteredData),
        },
        {
          index: 'export-2',
          title: i18next.t('TableHeader.selectedData'),
          disabled: !checkRows.value?.length,
          click: () => handleExportData(ExportType.SelectedData),
        },
        {
          index: 'export-3',
          title: i18next.t('TableHeader.allData'),
          click: () => handleExportData(ExportType.AllData),
        },
      ]
    });
  }

  // 批量操作
  if (tableProps.isShowMoreMenu) {
    menus.value.forEach(menu => {
      if (menu.visible !== false) {
        list.push({
          key: menu.index,
          ...menu
        });
      }
    });
  }
  return list.map((item, idx) => ({ ...item, index: `compact-${idx}` }));
});

const visibleOptions = computed(() => {
  return compactAllMenus.value.slice(0, headerVisibleOptionCount.value);
});

const hiddenOptions = computed(() => {
  return compactAllMenus.value.slice(headerVisibleOptionCount.value);
});

// =============== 右侧紧凑模式结束 ===============


// 导入功能
let uploadInputElement: HTMLInputElement | undefined;
let activeFileReader: FileReader | undefined;
const dealRowList = (rowList) => {
  const newRows = rowList.filter((row) => {
    return widget.allColumns.every((columnInfo) => {
      return row[columnInfo.alias] !== void 0 || row[columnInfo.uid] !== void 0;
    });
  }).map((row) => {
    for (const columnInfo of widget.allColumns) {
      if (row[columnInfo.uid] !== void 0) continue;
      row[columnInfo.uid] = row[columnInfo.alias];
    }
    return row;
  });
  if (newRows.length) {
    widget.addRows(newRows);
  } else {
    ElMessage.error(i18next.t('TableHeader.importNoValid'));
  }
  if (uploadInputElement) uploadInputElement.value = "";
};

const handleUploadChange = (ev: Event) => {
  const target = ev.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const fileType = file.name.split(".")[1];
  const dataRowList = [];
  try {
    const reader = new FileReader();
    activeFileReader = reader;
    reader.onloadend = () => {
      if (activeFileReader === reader) activeFileReader = undefined;
    };
    if (fileType === "csv") {
      reader.onload = (e) => {
        const csvData = e.target?.result as string;
        const rows = csvData.replaceAll("\r", "").split("\n");
        const headers = rows[0].split(",");
        for (let i = 1; i < rows.length; i++) {
          const values = rows[i].split(",");
          const rowData = {};
          for (let j = 0; j < headers.length; j++) {
            rowData[headers[j]] = values[j];
          }
          dataRowList.push(rowData);
        }
        dealRowList(dataRowList);
      };
      reader.readAsText(file, "utf-8");
    } else if (["xlsx", "xls"].includes(fileType)) {
      reader.onload = async (e) => {
        try {
          const XLSX = await import("xlsx");
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const dataRowList = XLSX.utils.sheet_to_json(worksheet, { skipHidden: true });
          dealRowList(dataRowList);
        } catch {
          if (uploadInputElement) uploadInputElement.value = "";
          ElMessage.error(i18next.t('TableHeader.importFormatErr'));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      if (uploadInputElement) uploadInputElement.value = "";
      ElMessage.error(i18next.t('TableHeader.importFormatUnsupp'));
    }
  } catch {
    if (uploadInputElement) uploadInputElement.value = "";
    ElMessage.error(i18next.t('TableHeader.importFormatErr'));
  }
};

onMounted(() => {
  uploadInputElement = uploadInputRef.value;
  uploadInputElement?.addEventListener("change", handleUploadChange);

  updateLayout();
  if (tableProps.isShowMoreMenu) {
    getFilteredPrintTemplate();
  }
})

const getDelTxt = () => {
  if(deleteType.value === 'all') {
    return i18next.t('TableHeader.totalData')
  } else if (deleteType.value === 'filter') {
    return i18next.t('TableHeader.totalFilterData')
  } else if (deleteType.value === 'check') {
    return `${checkRows.value?.length}${i18next.t('TableHeader.dataCount')}`
  } else {
    return i18next.t('TableHeader.singleData')
  }
}

// 导入Excel数据
const excelDialogVisible = ref(false);

const formFields = ref([]);
const importExcel = () => {
  importDialogReady.value = true;
  excelDialogVisible.value = true;
  const filteredtableFields: Field[] = table.value.fields.filter(field => isBusinessField(field));
  formFields.value = [...filteredtableFields];
}

const handleCloseDialog = () => {
  excelDialogVisible.value = false;
}

const handleImportCompleted = () => {
  emit('importCompleted')
}

const changeRowHeight = (type: FormTableRowHeight) => {
  emit('changeRowHeight', type)
  rowHeightDropdownRef.value?.handleClose();
}

// 导出功能
const exportDialogVisible = ref(false);
const fields = ref([])

const handleExportData = async (type)=>{
  exportDialogReady.value = true;
  fields.value = widget.allColumns.filter(c => ![SystemField.UUID, SystemField.RELATED_SUB_FORM].includes(c.name as any));
  exportType.value = type;
  exportDialogVisible.value = true;
}

const handleCloseExportDialog = () => {
  exportDialogVisible.value = false;
}

const handleClickRowHeight = () => {
  rowHeightVisible.value = !rowHeightVisible.value;
  morePopoverVisible.value = false;
}
const handleClickSort = () => {
  sortDrawerVisible.value = !sortDrawerVisible.value;
  morePopoverVisible.value = false;
}

const handleCompactSearchToggle = () => {
  if (searchVisible.value) {
    onClickSearchOutside();
    searchVisible.value = false;
    return;
  }
  searchVisible.value = true;
}

const onClickOutside = (ev) => {
  morePopoverVisible.value = false;

  if (headerOptionsShowMode.value === 'right-compact' && searchVisible.value) {
    const target = ev.target as HTMLElement;
    const compactSearchInput = compactSearchInputRef.value?.$el;
    const compactSearchPanel = compactSearchPanelRef.value;
    const searchFieldPopover = compactSearchFieldsPopoverContentRef.value;
    if (searchBtnRef.value?.contains?.(target) || compactSearchInput?.contains?.(target) || compactSearchPanel?.contains?.(target) || searchFieldPopover?.contains?.(target)) return;
    onClickSearchOutside();
    searchVisible.value = false;
  }
}
document.addEventListener('click', onClickOutside, true);

// 监听rowHeightLevel变化并设置对应的rowHeightRadio值
const stopRowHeightWatch = watch(() => props.rowHeightLevel, (newVal) => {
  switch (newVal) {
    case FormTableRowHeight.SMALL:
      rowHeightRadio.value = 1;
      break;
    case FormTableRowHeight.MEDIUM:
      rowHeightRadio.value = 2;
      break;
    case FormTableRowHeight.LARGE:
      rowHeightRadio.value = 3;
      break;
    case FormTableRowHeight.AUTO:
      rowHeightRadio.value = 4;
      break;
  }
});

const stopLayoutWatch = watch(
  () => [tableProps.filterable, tableProps.hideColumnsAble, tableProps.sortable],
  updateLayout,
  { deep: true }
);

const { stop: stopOthersResizeObserver } = useResizeObserver(othersRef, updateLayout);

const searchFieldsPopoverVisible = ref(false)
const handlePopoverVisibleChange = () => {
  searchFieldsPopoverVisible.value = !searchFieldsPopoverVisible.value;
}
const activeSearchField = ref([]);
const noSearchFieldsTypes = [FormWidgetType.RELATED_DATA, FormWidgetType.DEPARTMENT_SELECT, FormWidgetType.MEMBER_SELECT, FormWidgetType.DATE_PICKER, FormWidgetType.DATE_RANGE_PICKER, FormWidgetType.SELECT_DATA, FormWidgetType.RICH_TEXT_EDITOR, FormWidgetType.MARKDOWN_EDITOR, FormWidgetType.SPLIT_LINE, FormWidgetType.FILE_UPLOADER, FormWidgetType.IMAGE_UPLOADER, FormWidgetType.TITLE_BAR, FormWidgetType.IMAGE_TEXT_SHOW]
const searchFields = computed(() => {
  const tempTableFields = widget.allColumns.filter(f => !isSystemField({ meta: { name: f.name } } as any) && !noSearchFieldsTypes.includes(f.extra?.widgetType)).map(item => {
    if (item.subColumns) {
      return item.subColumns.filter(sf => !isSystemField({ meta: { name: sf.name } } as any) && !noSearchFieldsTypes.includes(sf.extra?.widgetType)).map(sf => {
        return {
          uid: `${item.uid}.${sf.uid}`,
          alias: `${item.alias}.${sf.alias}`,
          self: sf
        }
      })
    }
    return {
      uid: item.uid,
      alias: item.alias,
      self: item
    }
  });
  return tempTableFields.flat(Infinity) as any[];
})

const stopWatch = watch(() => searchFields.value, (value) => {
  if (!isEmpty(widget.searchFieldIds)) {
    activeSearchField.value = deepClone(widget.searchFieldIds);
  } else if (isEmpty(activeSearchField.value) && !isEmpty(value)) {
    activeSearchField.value = [value[0].uid];
    nextTick(() => {
      stopWatch();
    })
  }
}, { immediate: true, deep: true });

onBeforeUnmount(() => {
  activeFileReader?.abort();
  activeFileReader = undefined;
  uploadInputElement?.removeEventListener("change", handleUploadChange);
  uploadInputElement = undefined;
  morePopoverVisible.value = false;
  searchFieldsPopoverVisible.value = false;
  searchVisible.value = false;
  rowHeightVisible.value = false;
  sortDrawerVisible.value = false;
  rowHeightDropdownRef.value?.handleClose?.();
  exportDropdownVisible.value = false;
  exportDataVisible.value = false;
  exportDropdownRef.value?.handleClose?.();
  excelDialogVisible.value = false;
  exportDialogVisible.value = false;
  systemPrintDialogVisible.value = false;
  mergePrintDialogVisible.value = false;
  printDialogVisible.value = false;
  printRecordDialogVisible.value = false;
  visibleOfPreview.value = false;
  visibleOfWordPreview.value = false;
  afterPrintFun = null;
  stopWatch();
  stopRowHeightWatch();
  stopLayoutWatch();
  stopHeaderResizeObserver();
  stopOthersResizeObserver();
  document.removeEventListener('click', onClickOutside, true);
});

const handleChangeSearchField = (uid) => {
  if (activeSearchField.value.includes(uid)) {
    activeSearchField.value = activeSearchField.value.filter(item => item !== uid);
  } else {
    activeSearchField.value.push(uid);
  }
  widget.searchFieldIds = deepClone(activeSearchField.value);
}

const onClickSearchOutside = () => {
  searchFieldsPopoverVisible.value = false;
  const currentSearchUIDs = widget.searchValue?.map(item => item.uid);
  if (searchValue.value && !isEmpty(activeSearchField.value) && !equals(currentSearchUIDs, activeSearchField.value)) {
    searchValueChange();
  }
}
</script>

<style lang='scss' scoped>
.table-header{
  display: flex;
  align-items: center;
  justify-content: space-between;

  &.is-disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .button-wrapper {
    display: flex;
    column-gap: 8px;
    width: auto;
    .el-button{
      width: 64px;
      height: 32px;
      margin: 0;
      border-radius: 4px;

      &:hover {
        color: var(--color-primary);
        background-color: var(--bg-color-overlay);
      }
    }

    .el-button.is-link {
      color: var(--ep-color-primary);
      padding: 5px 8px;

      &:hover {
        background-color: var(--bg-color-overlay);
      }
    }

    :deep(.el-sub-menu) {
      border-radius: 4px;
      .el-icon {
        margin-right: 4px;
        width: auto;
      }
      &:hover {
        background-color: var(--bg-color-overlay);
      }
    }

    .import-btn {
      color: var(--text-color-primary) !important;
    }

    .export-dropdown {
      color: var(--text-color-primary);

      .export-btn {
        width: 80px;
      }
      .export-icon {
        display: inline-block;
        margin-left: 4px;
      }
    }
  }

  .filter-wrapper {
    display: flex;
    align-items: center;
    column-gap: 8px;

    .view-actions {
      flex-shrink: 0;

      :deep(.action-button),
      :deep(.more-button) {
        height: 32px;
        min-height: 32px;
        border-radius: 4px;
      }
    }

    :deep(.el-input) {
      --el-input-border-radius: 4px;
      width: 272px;

      .el-input-group__append {
        padding: 0 16px !important;
        .trigger-select-field-popover-btn {
          width: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 -16px;
        }
      }
    }

    .resize-button {
      width: 32px;
      height: 32px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: var(--text-color-regular);
      
      &:hover {
        background-color: var(--bg-color-overlay);
      }
    }

    .aggregate-field-button {
      color: var(--text-color-regular);

      &:hover {
        color: var(--color-primary);
        background-color: var(--bg-color-overlay);
      }

      .aggregate-field-button__icon {
        font-size: 16px;
        line-height: 1;
      }
    }
    
    // 右侧紧凑模式
    &.right-compact {
      position: relative;
      
      .compact-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s;
        
        &:hover {
          background-color: var(--bg-color-overlay);
          color: var(--color-primary);
        }
      }

      .aggregate-field-btn {
        color: var(--text-color-regular);

        &.active {
          color: var(--color-primary);
          background-color: var(--color-primary-light-9);
        }

        .aggregate-field-btn__icon {
          font-size: 18px;
          line-height: 1;
        }
      }
      
      .compact-search-popover {
        :deep(.el-input__wrapper) {
          border-radius: 4px;
        }

        .el-input-group__append {
          padding: 0 16px !important;
          background-color: var(--color-white);

          .trigger-select-field-popover-btn {
            width: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 -16px;
          }
        }
      }

      .compact-popover-container {
        position: absolute;
        display: flex;
        gap: 8px;
        padding-left: 40px; // 搜索按钮

        > div {
          width: 32px;
          height: 32px;
          opacity: 0;
          pointer-events: none;
        }

        // 用于给"更多"列表中的弹出框定位
        &.visible-count-2 > div:nth-child(n+3),
        &.visible-count-3 > div:nth-child(n+4),
        &.visible-count-4 > div:nth-child(n+5),
        &.visible-count-4 > div:nth-child(n+6),
        &.visible-count-6 > div:nth-child(n+7),
        &.visible-count-7 > div:nth-child(n+8) {
          position: absolute;
          right: 0;
        }
        .row-height-hidden-dropdown {
          opacity: 1;
          pointer-events: all;
          .el-dropdown-link {
            display: block;
            width: 0;
            height: 0;
          }
        }
      }
      
      :deep(.table-menu) {
        width: 32px;
        overflow: hidden;
        border-radius: 4px;
        position: relative;

        .el-sub-menu:hover {
          background-color: var(--bg-color-overlay);
        }
        .el-icon {
          width: auto;
        }
      }
    }

    :deep(.el-popper) {
      inset: 35px 0px auto auto !important;

      .menu {
        padding: 2px;
        border-radius: 8px;
        background-color: var(--color-white);
        display: flex;
        flex-direction: column;

        .menu-item {
          transition: all 0.3s ease;
          width: 96px;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 8px 12px;
          font-weight: 400;
          font-size: 14px;


          .el-icon {
            margin-right: 8px;
          }

          &:hover {
            background-color: var(--bg-color-overlay);
            color: unset;
          }

          &.active {
            background-color: var(--color-primary-light-9);
            color: var(--color-primary);
          }
        }
      }
    }
  }

  // 只显示icon
  &.is-compact {
    .button-wrapper {
      width: auto;
      
      .import-btn, 
      .export-btn {
        width: auto;
        font-size: 0 !important;
        padding: 0;
        aspect-ratio: 1 / 1;
        
        .el-icon {
          margin-right: 0 !important;
          font-size: 16px !important;
        }
      }
      
      .export-btn {
        width: auto !important;
        
        .export-icon {
          display: none !important;
        }
      }
      
      :deep(.table-menu) {
        .el-sub-menu__title {
          span { display: none; }
          .el-icon { margin-right: 0 !important; }
        }
      }
    }

    .filter-wrapper {
      :deep(.table-filter), 
      :deep(.table-display-fields), 
      :deep(.table-sort) {
        .btn {
          font-size: 0 !important;
          padding: 6px;
          
          .el-icon {
            font-size: 16px !important;
            margin-right: 0 !important;
          }
        }
      }
    }
  }

  .mobile-filter-wrapper {
    width: 100%;
    .search {
      height: 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;

      :deep(.el-input) {
        width: 100%;
        height: 100%;
        .el-input__wrapper { 
          border-radius: 8px 0 0 8px;
        }

        .el-input-group__append {
          padding: 0 20px !important;
          border-radius: 0 8px 8px 0;
          background-color: var(--color-white);

          .trigger-select-field-popover-btn {
            width: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 -16px;
            -webkit-tap-highlight-color: transparent;
          }
        }
      }

      :deep(.el-popover.search-select-field-popover) {
        width: calc(100% - 40px - 42px) !important;
        border-radius: 8px;
        display: inline-flex;
        flex-direction: column;
        gap: 4px;
        background: #ffffff;
        padding: 5px;
        margin-left: -18px;
        margin-top: -8px;

        .field-item {
          height: 36px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0px 12px;
          border-radius: 4px;
          -webkit-tap-highlight-color: transparent;
          
          label {
            width: 100%;
          }
          .el-checkbox {
            width: 100%;
          }
          &:hover {
            background: #f2f3f5;
          }
        }
      }

      .cancel-text {
        font-size: 14px;
        font-weight: 400;
        margin-left: 8px;
      }
    }

    .others {
      display: flex;
      align-items: center;
      column-gap: 8px;
      padding: 0 5px;
      overflow: hidden;

      .mobile-view-actions {
        flex-shrink: 0;
      }

      > * {
        width: auto !important;
        height: 40px !important;
        display: flex !important;
        margin: 0 !important;
        padding: 0 8px 0 4px !important;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
      }

      .search-btn {
        width: 60px;
        .search-icon {
          margin-right: 4px;
        }
      }

      .sort-button, .more-button {
        width: 60px;
        min-width: 60px;
        display: flex;
        align-items: center;
        column-gap: 4px;
      }

      :deep(.el-popover) {
        .more-menu {
          .row-height {
            :deep(.el-drawer) {
              background-color: #fff;
              border-radius: 4px;
              .el-drawer__header {
                margin-bottom: 0;
              }
              .container {
                .menu {
                  .menu-item {
                    margin-bottom: 80px;
                  }
                }
              }
            }
          }
        }
      }
      :deep(.el-drawer.row-height-drawer) {
        background-color: #fff;
        border-radius: 4px;
        
        .el-drawer__header {
          margin-bottom: 0;
        }
        .el-drawer__body {
          padding-top: 8px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: flex-start;

          .container {
            width: 100%;
          }
          
          &::-webkit-scrollbar {
            display: none;
          }
          scrollbar-width: none;
          -ms-overflow-style: none;

          .el-radio-group {
            width: 100%;
          }

          .el-radio {
            height: 40px;
            width: 100%;
            padding: 8px 0;
            margin: 0;
            font-size: 14px;
            border-bottom: 1px solid #E6E6E6;
            box-sizing: content-box;
            -webkit-tap-highlight-color: transparent;
            &.is-checked .el-radio__label {
              color: inherit;
            }
          }
        }
      }
    }
  }
}

.more-menu-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  cursor: pointer;
  font-size: 14px;
  gap: 4px;

  &:hover {
    background-color: var(--bg-color-overlay);
  }

  :deep(> *) {
    margin: 0 !important;
    padding: 0 !important;
  }
}
</style>

<style lang='scss'>
.el-popover.search-select-field-popover {
  width: 240px !important;
  border-radius: 8px;
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  background: #ffffff;
  padding: 5px;

  .field-item {
    height: 36px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0px 12px;
    border-radius: 4px;

    .el-checkbox {
      width: 100%;
    }

    &:hover {
      background: #f2f3f5;
    }
  }
}
</style>
