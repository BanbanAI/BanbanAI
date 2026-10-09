<template>
  <div class="nocode-editor-wrapper">
    <div class="dialog-wrapper">
      <nocode-rename-dialog ref="renameNocodeDialogRef" :nocode-id="nocodeId" @closed="renameNocode"></nocode-rename-dialog>
      <nocode-node-rename-dialog ref="nodeRenameDialogRef" @confirm="handleNodeRenamed"></nocode-node-rename-dialog>
      <nocode-folder-create-dialog ref="nocodeFolderCreateDialogRef" :nocode-id="nocodeId" @create="handleFolderCreate" :groupData="parentOption"></nocode-folder-create-dialog>
      <save-as-dialog v-model="dialogStorage.saveAsDialogVisible" :args="dialogStorage.getArgs('saveAsDialogVisible')"></save-as-dialog>
      <nocode-create-data-dialog :groupData="parentOption" :default-group-id="createDataDefaultGroupId" :lock-group-selection="createDataGroupLocked" v-model="dialogState.nocodeCreateDataDialogVisible" ref="createDataRef" @closed="handleCreateDataClosed" @confirmed="createFormData" @importExcel="showImportExcelDialog"/>
      <nocode-form-copy-dialog v-model="nocodeFormCopyDialogVisible" :tableName="copyTableInfo?.table?.alias" :pageName="pageName" :showTip="hasSubForm(copyTableInfo.table)" :copyType="copyType" @confirmCopyForm="handleCopyTableConfirm" @confirmCopyPage="handleCopyPageConfirm" />
      <nocode-layer-create-dialog :groupData="parentOption" ref="nocodeCreateDialogRef" @create="onLayerCreate"></nocode-layer-create-dialog>
      <select-form-table-dialog v-model="dialogState.selectFormTableDialogVisible" :body="nocode?.body" :nocodeBody="nocode?.body" :organizeUtil="organizeUtil" @confirm="(...args: Parameters<SelectFormTableDialogArgs>) => dialogState.getArgs('selectFormTableDialogVisible')?.(...args)"></select-form-table-dialog>
      <nocode-preview v-model="nocodePreviewVisible" :nocodeId="nocodeId" :projectId="activeProjectId"></nocode-preview>
      <delete-confirm-dialog :text="deleteConfirmContext.text" :tip="deleteConfirmContext.tip" v-model="deleteConfirmContext.visible" @confirm="deleteConfirmContext.confirm"  />
      <import-excel-dialog
        v-if="importExcelDialogVisible"
        ref="importExcelDialogRef"
        v-model:dialogVisible="importExcelDialogVisible"
        :contentSource="'nocodeCreateDataDialogValue'" 
        :mode="importExcelDialogMode"
        class="import-excel-dialog"
        @createForm="handleCreateForm"
        @excelCreateCompleted="handleExcelCreateCompleted"
        @analysisConfirmed="handleExcelAnalysisConfirmed"
        @closeDialog="closeImportExcelDialog"
      />
      <!-- <empty-layer-dialog v-model:dialogVisible="emptyLayerDialogVisible" @newForm="handleCreateDataConfirmed"
        @importExcel="showImportExcelDialog" @newPage="showNocodeCreateDialog"
      ></empty-layer-dialog> -->
    </div>
    <el-container class="nocode-editor" v-if="nocode" v-show="editorInitialSelectionReady" @mouseup="handleUp">
      <el-header class="nocode-editor-header" height="52px">
        <div class="header-left">
          <el-button class="header-icon-button" text @click="handleBack" :title="$t('NocodeEditor.backToApp')">
            <el-icon :size="16">
              <i-ep-arrow-left-bold></i-ep-arrow-left-bold>
            </el-icon>
          </el-button>
          <div class="app-switcher" :class="{ 'is-app-shell': editorSelectionType === 'app' }">
            <template v-if="editorSelectionType === 'app'">
              <el-dropdown
                ref="appSwitcherDropdownRef"
                class="app-switcher__dropdown"
                trigger="click"
                :triggerKeys="[]"
                :hide-on-click="false"
                popper-class="nocode-app-switcher-popper"
                @visible-change="handleAppSwitcherVisibleChange"
              >
                <div
                  class="app-switcher-trigger"
                  :class="{ 'is-open': appSwitcherDropdownVisible, 'is-app-shell': true }"
                >
                  <span class="app-switcher-trigger__title-wrap" :title="nocode?.meta?.name || ''">
                    <span class="app-switcher-trigger__app-name">
                      {{ nocode?.meta?.name }}
                    </span>
                    <span v-if="hasAppUnsavedChanges" class="app-switcher-trigger__warning-dot"></span>
                  </span>
                  <el-icon :size="16" class="app-switcher-trigger__app-arrow">
                    <i-ep-arrow-down />
                  </el-icon>
                </div>
                <template #dropdown>
                  <div class="app-switcher-dropdown">
                    <div
                      class="app-switcher-dropdown__header"
                      :class="{ active: editorSelectionType === 'app', 'is-menu-open': isAppShellContextMenuOpen }"
                      @click="handleAppShellSelect"
                    >
                      <div class="app-switcher-dropdown__header-arrow">
                        <el-icon :size="16">
                          <i-ep-caret-bottom />
                        </el-icon>
                      </div>
                      <div class="app-switcher-dropdown__header-main">
                        <div
                          class="app-switcher-dropdown__header-icon"
                          :class="{ 'has-background': appShellIconHasBackground }"
                          :style="appShellIconWrapperStyle"
                        >
                          <el-icon :size="appShellIconHasBackground ? 12 : 16" :color="appShellIconColor" v-if="appShellIconComponent">
                            <component :is="appShellIconComponent" />
                          </el-icon>
                          <el-image class="app-default-icon" loading="lazy" style="width: 100%; height: 100%;" :src="coverImageURL" v-else>
                            <template #error>
                              <img src="@renderer/assets/image/report-default-cover.png" alt="">
                            </template>
                          </el-image>
                        </div>
                        <span class="app-switcher-dropdown__header-label">{{ nocode?.meta?.name }}</span>
                      </div>
                      <div class="app-switcher-dropdown__header-actions">
                        <el-icon
                          :size="16"
                          class="visible-menu"
                          @click.stop="handleAppShellMenuClick"
                        >
                          <i-ven-more-vertical />
                        </el-icon>
                      </div>
                    </div>
                    <div
                      v-if="homePage"
                      class="app-switcher-home-page"
                      :class="{ active: isHomeActive }"
                      @click="handleHomePageClick"
                    >
                      <el-icon :size="20"><i-ven-global-page-home /></el-icon>
                      <span>{{ $t('NocodeEditor.homePage') }}</span>
                      <el-popover v-model:visible="homePageSettingPopoverVisible" placement="bottom-start" trigger="click" :hide-after="0" :show-arrow="false" width="160" popper-class="nocode-home-page-setting-popper">
                        <ul class="app-switcher-home-page__menu" @pointerdown.stop @click.stop>
                          <li @click="openHomePageSettingDialog">
                            {{ $t('NocodeEditor.homePageSetting') }}
                          </li>
                        </ul>
                        <template #reference>
                          <el-icon class="visible-menu" :size="16" @click.stop><i-ven-more-vertical /></el-icon>
                        </template>
                      </el-popover>
                    </div>
                    <el-tree
                      ref="appTreeRef"
                      v-loading="structureSaving"
                      :data="structure"
                      :item-size="TREE_NODE_HEIGHT"
                      :indent="TREE_NODE_INDENT"
                      node-key="id"
                      :default-expanded-keys="defaultExpandedKeys"
                      :highlight-current="false"
                      :empty-text="$t('reportEditor.treeEmptyText')"
                      :props="{
                        label: 'name',
                        children: 'children',
                      }"
                      class="app-switcher-dropdown__scroll app-switcher-tree app-switcher-tree-scroll nocode-tree-content"
                      :draggable="!structureSaving"
                      :filter-node-method="filterNode"
                      :allow-drop="allowDrop"
                      :allow-drag="() => !structureSaving"
                      :icon="ArrowDownBold"
                      @dragover.prevent="handleDragOverDiv"
                      @node-click="handleAppSwitcherNodeClick"
                      @node-contextmenu="handleNodeContextMenu"
                      @node-collapse="handleNodeCollapse"
                      @node-expand="handleNodeExpand"
                      @node-drag-over="handleDragOver"
                      @node-drag-start="handleDragstart"
                      @node-drop="handleDrop"
                      @node-drag-end="handleDragEnd"
                    >
                      <template #default="{ node, data }">
                        <div
                          class="app-switcher-tree-node"
                          :class="{
                            active: data.id === currentActiveId && data.type !== NocodeStructureType.GROUP && !isHomeActive,
                            'is-group': data.type === NocodeStructureType.GROUP,
                            'is-drag-hover': data.id === activeFolderId && data.type === NocodeStructureType.GROUP,
                            'is-form': data.type === NocodeStructureType.FORM,
                            'is-board': data.type === NocodeStructureType.PAGE,
                            'is-menu-open': isContextMenuNodeOpen(data.id),
                          }"
                        >
                          <span
                            class="app-switcher-tree-node__indent"
                            :style="{ width: `${Math.max(Number(node?.level || 1) - 1, 0) * 24}px` }"
                            aria-hidden="true"
                          ></span>
                          <el-icon
                            v-if="data.type === NocodeStructureType.GROUP"
                            :size="20"
                            color="#63ca2d"
                          >
                            <i-ven-global-page-folder-open v-if="node.expanded" />
                            <i-ven-global-page-folder v-else />
                          </el-icon>
                          <el-icon
                            v-else-if="data.type === NocodeStructureType.FORM"
                            :size="20"
                            color="#157cff"
                          >
                            <i-ven-global-page-form />
                          </el-icon>
                          <el-icon
                            v-else
                            :size="20"
                            color="#f98a4f"
                          >
                            <i-ven-global-page-document />
                          </el-icon>
                          <span
                            class="app-switcher-tree-node__label"
                            :class="{
                              active: data.id === currentActiveId && !isHomeActive,
                              focus: isContextMenuNodeOpen(data.id),
                            }"
                            :title="data.name"
                          >
                            {{ data.name }}
                          </span>
                          <div
                            class="app-switcher-tree-node__actions"
                            :class="{ 'is-group': data.type === NocodeStructureType.GROUP }"
                          >
                            <el-icon
                              :size="16"
                              class="visible-menu"
                              :title="isDisable(node) ? $t('NocodeEditor.showInApp') : $t('NocodeEditor.hideInApp')"
                              @click.stop="handleVisibleClick(node)"
                            >
                              <i-ven-disable v-if="isDisable(node)" />
                              <i-ven-enable v-else />
                            </el-icon>
                            <el-icon
                              :size="16"
                              class="visible-menu"
                              @click.stop="handleNodeMenuClick($event, data)"
                            >
                              <i-ven-more-vertical />
                            </el-icon>
                          </div>
                        </div>
                      </template>
                    </el-tree>
                  </div>
                </template>
              </el-dropdown>
            </template>
            <template v-else>
              <button
                type="button"
                class="app-switcher-trigger app-switcher-trigger--app-link"
                @click="handleAppShellSelect"
              >
                <span class="app-switcher-trigger__title-wrap" :title="nocode?.meta?.name || ''">
                  <span class="app-switcher-trigger__app-name">
                    {{ nocode?.meta?.name }}
                  </span>
                  <span v-if="hasAppUnsavedChanges" class="app-switcher-trigger__warning-dot"></span>
                </span>
              </button>
              <el-icon :size="16" class="app-switcher-trigger__crumb-arrow app-switcher-trigger__crumb-arrow--static">
                <i-ep-arrow-right />
              </el-icon>
              <el-dropdown
                ref="appSwitcherDropdownRef"
                class="app-switcher__dropdown app-switcher__dropdown--current"
                trigger="click"
                :triggerKeys="[]"
                :hide-on-click="false"
                popper-class="nocode-app-switcher-popper"
                @visible-change="handleAppSwitcherVisibleChange"
              >
                <div
                  class="app-switcher-trigger app-switcher-trigger--current-only"
                  :class="{ 'is-open': appSwitcherDropdownVisible }"
                >
                  <div class="app-switcher-trigger__current" :title="currentEditorTitle">
                    <span class="app-switcher-trigger__title-wrap">
                      <span class="app-switcher-trigger__current-name">
                        {{ currentEditorTitle }}
                      </span>
                      <span v-if="hasCurrentEditorWarning" class="app-switcher-trigger__warning-dot"></span>
                    </span>
                    <el-icon :size="16" class="app-switcher-trigger__current-arrow">
                      <i-ep-arrow-down />
                    </el-icon>
                  </div>
                </div>
                <template #dropdown>
                  <div class="app-switcher-dropdown">
                    <div
                      class="app-switcher-dropdown__header"
                      :class="{ 'is-menu-open': isAppShellContextMenuOpen }"
                      @click="handleAppShellSelect"
                      >
                      <div class="app-switcher-dropdown__header-arrow">
                        <el-icon :size="16">
                          <i-ep-caret-bottom />
                        </el-icon>
                      </div>
                      <div class="app-switcher-dropdown__header-main">
                        <div
                          class="app-switcher-dropdown__header-icon"
                          :class="{ 'has-background': appShellIconHasBackground }"
                          :style="appShellIconWrapperStyle"
                        >
                          <el-icon :size="appShellIconHasBackground ? 12 : 16" :color="appShellIconColor" v-if="appShellIconComponent">
                            <component :is="appShellIconComponent" />
                          </el-icon>
                          <el-image class="app-default-icon" loading="lazy" style="width: 100%; height: 100%;" :src="coverImageURL" v-else>
                            <template #error>
                              <img src="@renderer/assets/image/report-default-cover.png" alt="">
                            </template>
                          </el-image>
                        </div>
                        <span class="app-switcher-dropdown__header-label">{{ nocode?.meta?.name }}</span>
                      </div>
                      <div class="app-switcher-dropdown__header-actions">
                        <el-icon
                          :size="16"
                          class="visible-menu"
                          @click.stop="handleAppShellMenuClick"
                        >
                          <i-ven-more-vertical />
                        </el-icon>
                      </div>
                    </div>
                    <div
                      v-if="homePage"
                      class="app-switcher-home-page"
                      :class="{ active: isHomeActive }"
                      @click="handleHomePageClick"
                    >
                      <el-icon :size="20"><i-ven-global-page-home /></el-icon>
                      <span>{{ $t('NocodeEditor.homePage') }}</span>
                      <el-popover v-model:visible="homePageSettingPopoverVisible" placement="bottom-start" trigger="click" :hide-after="0" :show-arrow="false" width="160" popper-class="nocode-home-page-setting-popper">
                        <ul class="app-switcher-home-page__menu" @pointerdown.stop @click.stop>
                          <li @click="openHomePageSettingDialog">
                            {{ $t('NocodeEditor.homePageSetting') }}
                          </li>
                        </ul>
                        <template #reference>
                          <el-icon class="visible-menu" :size="16" @click.stop><i-ven-more-vertical /></el-icon>
                        </template>
                      </el-popover>
                    </div>
                    <el-tree
                      ref="appTreeRef"
                      v-loading="structureSaving"
                      :data="structure"
                      :item-size="TREE_NODE_HEIGHT"
                      :indent="TREE_NODE_INDENT"
                      node-key="id"
                      :default-expanded-keys="defaultExpandedKeys"
                      :highlight-current="false"
                      :empty-text="$t('reportEditor.treeEmptyText')"
                      :props="{
                        label: 'name',
                        children: 'children',
                      }"
                      class="app-switcher-dropdown__scroll app-switcher-tree app-switcher-tree-scroll nocode-tree-content"
                      :draggable="!structureSaving"
                      :filter-node-method="filterNode"
                      :allow-drop="allowDrop"
                      :allow-drag="() => !structureSaving"
                      :icon="ArrowDownBold"
                      @dragover.prevent="handleDragOverDiv"
                      @node-click="handleAppSwitcherNodeClick"
                      @node-contextmenu="handleNodeContextMenu"
                      @node-collapse="handleNodeCollapse"
                      @node-expand="handleNodeExpand"
                      @node-drag-over="handleDragOver"
                      @node-drag-start="handleDragstart"
                      @node-drop="handleDrop"
                      @node-drag-end="handleDragEnd"
                    >
                      <template #default="{ node, data }">
                        <div
                          class="app-switcher-tree-node"
                          :class="{
                            active: data.id === currentActiveId && data.type !== NocodeStructureType.GROUP && !isHomeActive,
                            'is-group': data.type === NocodeStructureType.GROUP,
                            'is-drag-hover': data.id === activeFolderId && data.type === NocodeStructureType.GROUP,
                            'is-form': data.type === NocodeStructureType.FORM,
                            'is-board': data.type === NocodeStructureType.PAGE,
                            'is-menu-open': isContextMenuNodeOpen(data.id),
                          }"
                        >
                          <span
                            class="app-switcher-tree-node__indent"
                            :style="{ width: `${Math.max(Number(node?.level || 1) - 1, 0) * 24}px` }"
                            aria-hidden="true"
                          ></span>
                          <el-icon
                            v-if="data.type === NocodeStructureType.GROUP"
                            :size="20"
                            color="#63ca2d"
                          >
                            <i-ven-global-page-folder-open v-if="node.expanded" />
                            <i-ven-global-page-folder v-else />
                          </el-icon>
                          <el-icon
                            v-else-if="data.type === NocodeStructureType.FORM"
                            :size="20"
                            color="#157cff"
                          >
                            <i-ven-global-page-form />
                          </el-icon>
                          <el-icon
                            v-else
                            :size="20"
                            color="#f98a4f"
                          >
                            <i-ven-global-page-document />
                          </el-icon>
                          <span
                            class="app-switcher-tree-node__label"
                            :class="{
                              active: data.id === currentActiveId && !isHomeActive,
                              focus: isContextMenuNodeOpen(data.id),
                            }"
                            :title="data.name"
                          >
                            {{ data.name }}
                          </span>
                          <div
                            class="app-switcher-tree-node__actions"
                            :class="{ 'is-group': data.type === NocodeStructureType.GROUP }"
                          >
                            <el-icon
                              :size="16"
                              class="visible-menu"
                              :title="isDisable(node) ? $t('NocodeEditor.showInApp') : $t('NocodeEditor.hideInApp')"
                              @click.stop="handleVisibleClick(node)"
                            >
                              <i-ven-disable v-if="isDisable(node)" />
                              <i-ven-enable v-else />
                            </el-icon>
                            <el-icon
                              :size="16"
                              class="visible-menu"
                              @click.stop="handleNodeMenuClick($event, data)"
                            >
                              <i-ven-more-vertical />
                            </el-icon>
                          </div>
                        </div>
                      </template>
                    </el-tree>
                  </div>
                </template>
              </el-dropdown>
            </template>
          </div>
          <div class="header-divider"></div>
          <el-dropdown
            ref="headerCreateDropdownRef"
            class="header-create-dropdown"
            trigger="click"
            :triggerKeys="[]"
            popper-class="nocode-header-create-popper"
          >
            <el-button class="header-icon-button" text :title="$t('NocodeEditor.createNew')">
              <el-icon :size="16">
                <i-ep-plus />
              </el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item class="header-create-item is-form" @click="handleQuickCreate('add-form')">
                  <el-icon class="header-create-icon" :size="20" color="#157cff"><i-ven-nocode-page-form /></el-icon>
                  <span>{{ $t('NocodeEditor.createForm') }}</span>
                </el-dropdown-item>
                <el-dropdown-item class="header-create-item is-board" @click="handleQuickCreate('add-page')">
                  <el-icon class="header-create-icon" :size="20" color="#f98a4f"><i-ven-nocode-page-document /></el-icon>
                  <span>{{ $t('NocodeEditor.createDashboard') }}</span>
                </el-dropdown-item>
                <el-dropdown-item class="header-create-item is-folder" @click="handleQuickCreate('add-folder')">
                  <el-icon class="header-create-icon" :size="20" color="#63ca2d"><i-ven-nocode-page-folder /></el-icon>
                  <span>{{ $t('NocodeEditor.createGroup') }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="header-center">
          <div v-if="editorSelectionType === 'app'" class="header-mode-switch">
            <button type="button" class="mode-item is-active">{{ $t('NocodeEditor.blueprint') }}</button>
            <button type="button" class="mode-item" @click="handleOpenSettingDrawer()">{{ $t('NocodeEditor.setting') }}</button>
          </div>
          <div v-else-if="editorSelectionType === 'form'" class="header-mode-switch">
            <button type="button" class="mode-item" :class="{ 'is-active': formShellTab === 'form-design' }" @click="handleFormHeaderTabClick('form-design')">
              <span class="mode-item__label">
                {{ $t('NocodeEditor.form') }}
                <span v-if="hasFormTabWarning" class="mode-item__warning-dot"></span>
              </span>
            </button>
            <button type="button" class="mode-item" :class="{ 'is-active': formShellTab === 'process-setting' }" @click="handleFormHeaderTabClick('process-setting')">
              <span class="mode-item__label">
                {{ $t('NocodeEditor.workflow') }}
                <span v-if="hasProcessTabWarning" class="mode-item__warning-dot"></span>
              </span>
            </button>
            <button type="button" class="mode-item" :class="{ 'is-active': formShellTab === 'data-management' }" @click="handleFormHeaderTabClick('data-management')">{{ $t('NocodeEditor.data') }}</button>
            <button type="button" class="mode-item" @click="handleOpenSettingDrawer()">{{ $t('NocodeEditor.setting') }}</button>
          </div>
          <div v-else-if="editorSelectionType === 'board'" class="header-mode-switch">
            <button type="button" class="mode-item is-active">{{ $t('NocodeEditor.dashboard') }}</button>
            <button type="button" class="mode-item" @click="handleOpenSettingDrawer()">{{ $t('NocodeEditor.setting') }}</button>
          </div>
        </div>
        <div class="header-right">
          <el-button v-if="showPreviewButton" class="header-action icon" text @click="handleMenuClicked('preview')">
            <el-icon :size="16"><i-ven-form-preview /></el-icon>
          </el-button>
          <el-button v-if="showSaveButton" class="header-action" @click="handleSaveFromHeader">{{ $t('NocodeEditor.save') }}</el-button>
          <el-button class="header-action publish" type="success" @click="handleOpenSettingDrawer(SettingTab.PUBLISH)">{{ $t('NocodeEditor.published') }}</el-button>
        </div>
      </el-header>
      <el-main class="nocode-editor-main">
        <div class="nocode-main-layout">
          <div class="nocode-ai-panel-wrap" :class="{ hidden: !editorAiVisible }">
            <nocode-editor-ai-panel
              ref="editorAiPanelRef"
              class="nocode-editor-ai-sidebar"
              :visible="editorAiVisible"
              :closable="true"
              :nocode-id="nocodeId"
              :app-name="nocode?.meta?.name || ''"
              :blueprint-workbench-items="stageBlueprintItems"
              :blueprint-workbench-history-items="pendingStageBlueprintHistory"
              :runtime="nocodeEditorAiRuntime"
              :draft-persistence-state="aiDraftDisplayState"
              :flow-issue-runtime-verdict="liveFlowIssueRuntimeVerdict"
              @app-renamed="(name) => renameNocode(nocodeId, name)"
              @blueprint-applied="handleBlueprintApplied"
              @applied-blueprints-imported="loadAppliedBlueprints"
              @start-excel-form-create="showImportExcelDialog"
              @start-excel-file-analysis="showExcelAnalysisDialog"
              @update:visible="editorAiVisible = $event"
              @staged-state-change="handleAiStageStateChange"
              @flow-issue-state-change="handleAiFlowIssueStateChange"
            />
          </div>
          <div class="nocode-main-stage">
            <vn-stack v-if="editorSelectionType === 'app'" key="app-stage-shell" class="nocode-stage-shell nocode-stage-stack" v-model="stageViewTab">
              <div class="nocode-stage-toolbar">
                <button
                  type="button"
                  class="stage-tool stage-tab"
                  :class="{ 'is-active': editorAiVisible }"
                  @click="editorAiVisible = !editorAiVisible"
                >
                  <el-icon color="#3793ff" :size="16"><i-ven-ai-score-icon /></el-icon>
                  <span class="stage-tool__label">{{ $t('NocodeEditor.aiAssistant') }}</span>
                </button>
                <vn-stack-tab class="stage-tool stage-tab" name="blueprint" v-show="false">
                  <el-icon :size="16"><i-ven-nocode-blueprint /></el-icon>
                  <span class="stage-tool__label">{{ $t('NocodeEditor.blueprint') }}</span>
                  <el-icon v-if="stageBlueprintLoading" :size="14" class="stage-tool__loading is-loading"><i-ep-loading /></el-icon>
                </vn-stack-tab>
              </div>
              <div class="nocode-stage-body" :class="`is-${stageViewTab}`">
                <vn-stack-layer name="blueprint" class="stage-tab-panel" :lazy="true">
                  <nocode-editor-ai-blueprint-shelf
                    :items="stageBlueprintItems"
                    :history-items="pendingStageBlueprintHistory"
                    show-all-statuses
                    :flow-artifact-blocks="stageFlowArtifactBlocks"
                    :loading="stageBlueprintLoading"
                    :loading-message="stageBlueprintLoadingMessage"
                    :app-name="nocode?.meta?.name || ''"
                    :refreshing-applied="refreshingAppliedBlueprints"
                    :applying-id="applyingStageBlueprintId"
                    :show-batch-apply-action="stageShowBatchApplyAction"
                    :get-confirmation-response-drafts="getStageBlueprintConfirmationResponseDrafts"
                    :get-active-confirmation-input-question-ids="getStageBlueprintActiveConfirmationInputQuestionIds"
                    :get-inline-confirmation-note-question-ids="getStageBlueprintInlineConfirmationNoteQuestionIds"
                    :get-flow-confirmation-response-drafts="getStageFlowConfirmationResponseDrafts"
                    :get-flow-active-confirmation-input-question-ids="getStageFlowActiveConfirmationInputQuestionIds"
                    :get-flow-inline-confirmation-note-question-ids="getStageFlowInlineConfirmationNoteQuestionIds"
                    :can-apply-flow-artifact="canApplyStageFlowArtifact"
                    :is-applying-flow-artifact="isApplyingStageFlowArtifact"
                    :submitting-confirmation="stageBlueprintConfirmationSubmitting"
                    @refresh-applied="handleRefreshAppliedBlueprints"
                    @apply="handleApplyStageBlueprint"
                    @apply-pending-batch="handleApplyStageBlueprintBatch"
                    @open-generated-page="handleOpenGeneratedBlueprintPage"
                    @continue="handleContinueStageBlueprintAdjustment"
                    @apply-flow="handleApplyStageFlow"
                    @continue-flow-defaults="handleContinueStageFlowDefaults"
                    @select-confirmation-option="handleSelectStageBlueprintConfirmationOption"
                    @toggle-note-input="handleToggleStageBlueprintInlineConfirmationInput"
                    @update-note="handleUpdateStageBlueprintInlineConfirmationNote"
                    @submit-confirmation-responses="handleSubmitStageBlueprintConfirmationResponses"
                    @toggle-flow-note-input="handleToggleStageFlowInlineConfirmationInput"
                    @update-flow-note="handleUpdateStageFlowInlineConfirmationNote"
                    @submit-flow-confirmation-responses="handleSubmitStageFlowConfirmationResponses"
                    @locate-draft-issue="handleLocateDraftIssue"
                  />
                </vn-stack-layer>
              </div>
            </vn-stack>
            <div v-else-if="editorSelectionType === 'form'" key="form-stage-shell" class="selection-stage-shell">
              <div class="selection-stage-toolbar">
                <div class="selection-stage-toolbar__group">
                  <button
                    type="button"
                    class="stage-tool stage-tab"
                    :class="{ 'is-active': editorAiVisible }"
                    @click="editorAiVisible = !editorAiVisible"
                  >
                    <el-icon color="#3793ff" :size="16"><i-ven-ai-score-icon /></el-icon>
                    <span class="stage-tool__label">{{ $t('NocodeEditor.aiAssistant') }}</span>
                  </button>
                  <button
                    type="button"
                    class="stage-tool stage-action"
                    v-if="showFormDesignToolbarActions"
                    :class="{ 'is-active': formFieldCatalogVisible }"
                    :disabled="formDesignerBlueprintReadonly"
                    @click="handleFormFieldCatalogClick"
                  >
                    <el-icon :size="16"><i-ep-document-add /></el-icon>
                    <span class="stage-tool__label">{{ $t('NocodeEditor.addField') }}</span>
                  </button>
                  <button
                    type="button"
                    class="stage-tool stage-action"
                    v-if="showFormDesignToolbarActions"
                    :disabled="formDesignerBlueprintReadonly"
                    @click="handleFormRecycleClick"
                  >
                    <el-icon :size="16"><i-ep-delete /></el-icon>
                    <span class="stage-tool__label">{{ $t('NocodeEditor.recycleBin') }}</span>
                  </button>
                </div>
                <button
                  type="button"
                  class="stage-tool stage-action"
                  v-if="showFormDesignToolbarActions"
                  :class="{ 'is-active': formPropertyPanelVisible }"
                  :disabled="formDesignerBlueprintReadonly"
                  @click="handleFormPropertyClick"
                >
                  <el-icon :size="16"><i-ep-operation /></el-icon>
                  <span class="stage-tool__label">{{ $t('NocodeEditor.propertySettings') }}</span>
                </button>
              </div>
              <div class="nocode-stage-body selection-stage-body is-form">
                <form-create
                  v-show="isShowFormCreate"
                  :save="handleSaveFormData"
                  v-model:sidebarFolded="isHideSidebar"
                  :embedded="true"
                  :visible-tab="formShellTab"
                  :ai-flow-issue-state="activeAiFlowIssueState"
                  :field-catalog-visible="formFieldCatalogVisible"
                  :property-panel-visible="formPropertyPanelVisible"
                  :blueprint-applying-readonly="formDesignerBlueprintReadonly"
                  @update:field-catalog-visible="formFieldCatalogVisible = $event"
                  @update:property-panel-visible="formPropertyPanelVisible = $event"
                  @exit-form-mode="handleExitFormMode"
                  @rename-table="handleRenameTable"
                  @update-nocode="handleUpdateNocodeInfo"
                  @update-table="handleUpdateTables"
                  @open-setting="handleOpenSettingDrawer"
                  @active-tab-change="handleFormActiveTabChange"
                  @draft-persistence-state-change="handleFormDraftPersistenceStateChange"
                  ref="formCreateRef"
                />
              </div>
            </div>
            <nocode-board-editor
              v-else
              key="board-stage-shell"
              ref="projectEditorRef"
              :project-id="activeProjectId"
              :project-name="activeProjectName"
              :nocode-id="nocodeId"
              :form-data="formData"
              v-model:ai-visible="editorAiVisible"
              @saved="onPageSaved(activeProjectId)"
              @open-setting="handleOpenSettingDrawer"
              @dataSourceViewer="showDataSourceViewer"
            />
            <div v-if="defaultFormulaOverlay.visible" class="form-default-formula-overlay" @click.stop>
              <form-default-value-formula-dialog
                ref="defaultFormulaOverlayPanelRef"
                :modelValue="defaultFormulaOverlay.visible"
                :widget="defaultFormulaOverlay.widget"
                :value="defaultFormulaOverlay.value"
                :isLimitSubform="defaultFormulaOverlay.componentProps.isLimitSubform"
                :includeSelf="defaultFormulaOverlay.componentProps.includeSelf"
                embedded
                @update:modelValue="handleDefaultFormulaOverlayVisibleChange"
                @update="handleDefaultFormulaOverlayUpdate"
              />
            </div>
          </div>
        </div>
      </el-main>
    </el-container>
    <el-tree
      v-show="false"
      ref="treeRef"
      :data="structure"
      node-key="id"
      :props="{
        label: 'name',
        children: 'children',
      }"
      :filter-node-method="filterNode"
    />
    <el-drawer
      v-model="settingVisible"
      direction="rtl"
      size="70%"
      :with-header="false"
      body-class="setting-drawer-body"
      destroy-on-close
      close-on-click-modal
      :before-close="handleSettingDrawerBeforeClose"
    >
    <nocode-view-setting v-if="settingVisible" ref="nocodeViewSettingRef" @close="handleSettingDrawerClose" @update-nocode="handleUpdateNocodeInfo" @aggregate-tables-updated="handleAggregateTablesUpdated" @update-table="handleUpdateTables" @published="handlePublishSettingPublished" :isComponent="true"></nocode-view-setting>
    </el-drawer>
    <nocode-home-page-setting-dialog v-if="homePageSettingDialogVisible" v-model="homePageSettingDialogVisible" />
    <single-context-menu
      ref="contextMenuRef"
      :menus="contextMenu.menus"
      :event="contextMenu.event"
      v-model="contextMenu.visible"
      menu-class="nocode-editor-tree-context-menu"
      :menu-width="160"
      :menu-item-height="36"
    />
    <form-save-tip-dialog ref="saveProjectDialogRef" :title="$t('NocodeEditor.confirmSavePage')"></form-save-tip-dialog>
    <data-source-dialog
      ref="dataSourceDialogRef"
      v-model="isShowDataSourceDialog"
      :title="dataSourceDialogTitle"
      @handle-edit="showFormCreate"
    >
  </data-source-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, provide, inject, watch, nextTick, markRaw, computed, toRaw, reactive, onBeforeUnmount, watchEffect, Ref, onMounted, defineAsyncComponent, ComputedRef } from "vue";
import { WarnTriangleFilled } from '@element-plus/icons-vue'
import axios from "axios";
import { ElContainer, ElIcon, ElMessage, AllowDropFunction, TreeInstance  } from "element-plus";
import {  PARENT_ID,OPEN_PROJECT, PROJECT_PARAMS, FieldOptionContext, FIELD_OPTION_CONTEXTS, ACTIVE_FIELD_OPTION, ALL_FIELD_OPTION_CONTEXTS, PROJECT_TABLE_DRAGGING, EDIT_PROJECT_MODULE, GET_DELETE_LIST, UPDATE_REPORT_LIST, HANDLE_NOCODE_RENAMED, NOCODE_ID, NOCODE, CLOSE_NOCODE, ORGANIZE_UTIL, NOCODE_THEME_COLOR, HANDLE_DELETE_TABLE, ClientTheme, NOCODE_THEME, UPDATE_OPENING_PROJECT_LIST, CLOSE_NOCODE_LAYER, PREVIEW_NOCODE_LAYER, SelectFormTableDialogArgs, HANDLE_SYNC_FORM_TABLE, SYNC_FORM_DATA, NOCODE_SIGN_IS_LATEST, UPDATE_NOCODE_SIGN } from "@renderer/types";
import { Connection, FolderMeta, SettingTab, Table, TableColumn, UseThemeOptions } from "@common/types/project";
import type { AiAttachmentUploadHandle } from "@common/types/aiAttachment";
import type { AiExcelAnalysisConfirmPayload } from "@common/types/aiExcelAnalysis";
import { usePassportStore, useProjectDialogStore, useSettingStore } from "@renderer/stores";
import { useDialogStore } from "@renderer/stores";
import { unique } from "@common/utils/unique";
import i18next, { t } from "i18next";
import { useResizeObserver } from "@vueuse/core";
import { isEmpty } from "@common/utils/object";
import { AggregateTable, FormDataColumn, FormDataTableExtra, Nocode, NocodeFormData, NocodeStructure, NocodeStructureType } from "@common/types/nocode";
import type { NocodeEditorAiConfirmQuestionOption } from "@common/types/nocodeEditorConfirmation";
import { formDataApi, OrganizeUtil } from "@renderer/views/nocode/utils";
import { getAllForms, getAllPages, getNocodeHomePage, getUUIDSystemField, shouldMarkProjectManualChanged, SystemField } from "@common/utils";
import type { NocodeDataSourceConnection } from "@common/utils/connection";
import type Node from 'element-plus/es/components/tree/src/model/node'
import { useRoute, useRouter } from "vue-router";
import { formDesignerPanelState, setFormDesignerPanelVisible } from "./editorPanelPinning";
import type { FormElement } from "@renderer/b2/controllers/form";
import type { FormulaConfig } from "@common/utils/formula";
import { ArrowDownBold } from '@element-plus/icons-vue'
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError, closeNocodeSyncConflictMessage, showNocodeSyncConflictMessage } from "@renderer/utils/nocodeSyncMessage";
import NocodeEditorAiPanel from "./ai/NocodeEditorAiPanel.vue";
import { buildCurrentAppBlueprint, mergeBlueprintWithCurrent, useNocodeEditorAiHostRuntime } from "./ai/useNocodeEditorAiHostRuntime";
import {
  buildScopedAppliedBlueprintIdentityKey,
  buildScopedBlueprintByApplyResult,
} from "./ai/blueprintApplyScope";
import { buildNocodeEditorRelationContextFromTables } from "@common/utils/nocodeEditorRelationContext";
import {
  isBlueprintStagedPhase,
  normalizeAppliedBlueprintPhase,
} from "@common/utils/nocodeEditorBlueprintLifecycle";
import { getNocodeEditorBlueprintFormApplyTargetIdentity } from "@common/utils/nocodeEditorBlueprintFormNormalization";
import {
  isSameAiExcelImportSourceInstance,
  resolveAiExcelImportSourceInstance,
  type AiExcelImportSourceInstance,
} from "@common/utils/aiExcelCreateFormState";
import { finalizeExcelCreatedFormState } from "./excelCreateFormFinalization";
import type { AiArtifactConfirmationQuestion } from "@renderer/views/nocode/components/ai/artifactBlock";
import NocodeEditorAiBlueprintShelf from "./ai/components/NocodeEditorAiBlueprintShelf.vue";
import type { NocodeEditorAiConfirmationResponseDraftMap } from "./ai/components/confirmationInteraction";
import { saveWithRelationContextDegradation } from "./relationContextSaveDegradation";
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiAppliedBlueprintSnapshot,
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiBlueprintApplyScope,
  NocodeEditorAiBlueprintApplyResult,
  NocodeEditorAiAppliedBlueprintRecord,
  NocodeEditorAiDraftActionIssue,
  NocodeEditorAiDraftPersistenceState,
  NocodeEditorAiFlowIssueState,
  NocodeEditorAiGeneratedBlueprintPageTarget,
  NocodeEditorAiStageBlueprintDisplayItem,
  NocodeEditorAiSettingContext,
  NocodeEditorAiSettingTargetContext,
  NocodeEditorAiTaskContext,
} from "./ai/types";
import { resolveNocodeEditorStageViewTab, type NocodeEditorStageViewTab } from "./ai/stageViewTab";
import {
  EditorSelectionType,
  getPreviewDrawerMode,
  resolveEditorSelectionType,
  shouldShowPreviewButton,
  shouldShowSaveButton,
} from "./editorSelectionState";
import { resolveNocodeEditorSyncNocodeId } from "./syncNocodeId";
import {
  isDraftPersistenceStateDraftOnly,
  shouldBlockNavigationForDraftPersistenceState,
} from "./ai/draftIssueActionList";
import { AI_WARMUP_ACTIVITY_REPORTER } from "../../utils/aiWarmupActivityReporter";

enum StackTab {
  PAGE = "page",
  LAYER = "layer",
}

type StartExcelFormCreatePayload = Pick<AiAttachmentUploadHandle, 'fullPath' | 'sessionId' | 'originFilePath'> & {
  name?: string
  formName?: string
  group?: string
  attachmentId?: string
}

type StartExcelFileAnalysisPayload = StartExcelFormCreatePayload & {
  name?: string
  visibleUserContent: string
  requestMetadata?: Record<string, unknown>
}

type ExcelCreateCompletedPayload = {
  tableId: string
  formName: string
  importFieldCount: number
  successCount: number
  totalCount: number
  failedCount: number
  sourceInstance: AiExcelImportSourceInstance
  attachmentId?: string
}

type ImportExcelDialogHandle = {
  setFormInfo: (name?: string, group?: string) => void
  prefillUploadedExcel?: (payload: StartExcelFormCreatePayload) => Promise<boolean>
}

const ProjectEditor = defineAsyncComponent(() => import("@renderer/views/main/project/ProjectEditor.vue"));
const loadFormCreate = () => import("./form/FormCreate.vue");
const loadNocodeBoardEditor = () => import("./components/NocodeBoardEditor.vue");
const FormCreate = defineAsyncComponent(loadFormCreate);
const NocodeBoardEditor = defineAsyncComponent(loadNocodeBoardEditor);
const FormDefaultValueFormulaDialog = defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/formula/FormDefaultValueFormulaDialog.vue"));
const NocodeHomePageSettingDialog = defineAsyncComponent(() => import("@renderer/views/nocode/components/NocodeHomePageSettingDialog.vue"));
const ImportExcelDialog = defineAsyncComponent(() => import("@renderer/views/nocode/components/ImportExcelDialog.vue"));
const NocodeViewSetting = defineAsyncComponent(() => import("@renderer/views/nocode/views/viewer/NocodeViewSetting.vue"));

const route = useRoute();
const router = useRouter();

const renameNocodeDialogRef = ref();
const nocodeCreateDialogRef = ref();

const settingState = useSettingStore();
const nocode = ref<Nocode>();
const editorInitialSelectionReady = ref(false);
const nocodeSignIsLatest = ref(true);
const nocodeId = route.params.nocodeId as string;
const resolvedNocodeId = computed(() => resolveNocodeEditorSyncNocodeId(nocode.value, nocodeId));
const aiWarmupActivityReporter = inject(AI_WARMUP_ACTIVITY_REPORTER, null);
provide(NOCODE_ID, nocodeId);
provide(NOCODE_SIGN_IS_LATEST, nocodeSignIsLatest);
const nocodeFolderCreateDialogRef = ref();
const treeRef = ref<TreeInstance>();
const appTreeRef = ref<TreeInstance>();
const appSwitcherDropdownRef = ref<any>(null);
const appSwitcherDropdownVisible = ref(false);
const contextMenuRef = ref();
const headerCreateDropdownRef = ref<any>(null);
const leftMainContainerRef = ref();
const activeProjectId = ref("");
const activeProjectName = ref("");

const isSearching = ref(false);
const searchValue = ref("");
const searchInputRef = ref();
const activeStack = ref<StackTab>(StackTab.PAGE);

const NocodeAddIcon = IVenPlus;
const settingVisible = ref(false);
const homePageSettingDialogVisible = ref(false);
const homePageSettingPopoverVisible = ref(false);

const copyType = ref("")
const pageName = ref("")
const nocodeViewSettingRef = ref();

const isHideSidebar = ref(false);

const coverVersion = ref(Date.now());
const coverImageURL = computed(() => {
  return `project/get-nocode-snapshot/${resolvedNocodeId.value}?t=${coverVersion.value}`;
});

const buildDefaultEditorReturnPath = () => {
  let routePath = `/app/${nocodeId}`;
  if (currentActiveId.value) {
    const currentNode = treeRef.value?.getNode(currentActiveId.value);
    if (currentNode) {
      if (currentNode.data.type === NocodeStructureType.FORM) {
        routePath = `/app/${nocodeId}?form=${currentActiveId.value}`;
      } else if (currentNode.data.type === NocodeStructureType.PAGE) {
        routePath = `/app/${nocodeId}?project=${currentActiveId.value}`;
      }
    }
  }
  return routePath;
}

const resolveInternalEditorReturnPath = (value?: string | null, fallback = '/') => {
  const text = String(value || '').trim();
  if (text.startsWith('/') && !text.startsWith('//')) {
    return text;
  }
  return fallback.startsWith('/') && !fallback.startsWith('//')
    ? fallback
    : '/';
}

const handleBack = async () => {
  const routePath = resolveInternalEditorReturnPath(
    String(route.query.returnTo || ''),
    buildDefaultEditorReturnPath(),
  );

  if (preventClose.value) {
    const isSave = await saveProjectDialogRef.value.confirm();
    if (isSave) {
      await projectEditorRef.value?.saveProject(true);
      const exited = await hideFormCreate(true);
      if (!exited) {
        return;
      }
      router.replace(routePath);
    } else {
      const exited = await hideFormCreate(false);
      if (!exited) {
        return;
      }
      router.replace(routePath);
    }
  } else {
    router.replace(routePath);
  }
}
const isEmptyLayer = computed(() => {
  if (!nocode.value) return false;
  const forms = getAllForms(structure.value);
  const pages = getAllPages(structure.value);
  const r = isEmpty(forms) && isEmpty(pages);
  if (r && !formData.value) emptyLayerDialogVisible.value = true;
  return r;
})

const emptyLayerDialogVisible = ref<boolean>(false);

const activeData = ref('internal')

const isEmptyExternal = computed(() => {
  const externalConnection = nocode.value.body.connections;
  console.log(111111, externalConnection, nocode.value);
  
  return externalConnection.length === 0;
})

const toggleSearch = () => {
  isSearching.value = !isSearching.value;
  if (!isSearching.value) searchValue.value = "";
  else {
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
}

const nocodeAddOperate = [
  {
    get label() { return i18next.t("reportEditor.addForm") },
    type: "add-form"
  },
  {
    get label() { return i18next.t("reportEditor.addPage") },
    // icon: IVenReportAddDashboard,
    type: "add-page",
    // get visible() {
    //   return !!passportState.user.staff;
    // }
  },
  {
    get label() { return i18next.t("reportEditor.addFolder") },
    // icon: IVenReportAddGrouping,
    type: "add-folder"
  },
];

const currentActiveId = ref(""); //菜单栏中选中的项目或者文件夹

const syncTreeActiveIdToOpenedNode = () => {
  currentActiveId.value = activeFormId.value || activeProjectId.value || "";
}

const waitForFormCreateInstance = async () => {
  if (formCreateRef.value) return formCreateRef.value;

  await new Promise<void>((resolve) => {
    const stop = watch(formCreateRef, (instance) => {
      if (!instance) return;
      stop();
      resolve();
    }, { flush: "post" });
  });
  return formCreateRef.value;
}

const parentId = computed<string>(() => {
  if (!currentActiveId.value) return "";
  const node = treeRef.value?.getNode(currentActiveId.value);
  if (!node) return "";
  return node.data.type === NocodeStructureType.GROUP ? node.data.id : (node.parent?.data.id ?? "");
})
provide(PARENT_ID, parentId);

const themeColor = ref("#0089ff")
provide(NOCODE_THEME_COLOR, themeColor);

const organizeUtil = new OrganizeUtil();
provide(ORGANIZE_UTIL, organizeUtil);

const passportState = usePassportStore();
passportState.init();
const projectDialogState = useProjectDialogStore();
const dialogStorage = projectDialogState.initStorage(nocodeId);

const dialogState = useDialogStore();
const treeHeight = ref(0);
const treeContainer = ref(null);
useResizeObserver(treeContainer, (entries)=>{
  const entry = entries[0];
  treeHeight.value = entry.contentRect.height;
});

const defaultExpandedKeys = ref([]);
const TREE_NODE_INDENT = 24;
const TREE_NODE_HEIGHT = 36;

const draggingNodeRef = ref();
const dropNodeRef = ref();
const isRootDir = ref(false);
const allowDrop: AllowDropFunction = (draggingNode, dropNode, type) => {
  if (searchValue.value) return false;
  if (dropNode.data.type !== NocodeStructureType.GROUP && type === 'inner') {
    dropNodeRef.value = dropNode;
    return false;
  }
  return true;
}

const handleDragstart = (draggingNode: Node) => {
  draggingNodeRef.value = draggingNode;
}

const activeFolderId = ref('');
const clearActiveFolderHighlight = () => {
  if (!activeFolderId.value && !isRootDir.value) return;
  activeFolderId.value = '';
  isRootDir.value = false;
}

const resolveDragHoverGroupId = (dropNode: Node | null) => {
  let currentNode = dropNode;
  while (currentNode) {
    if (currentNode.data?.type === NocodeStructureType.GROUP) {
      return currentNode.data.id ?? '';
    }
    currentNode = currentNode.parent;
  }
  return '';
}

const handleDragOver = (draggingNode: Node, dropNode: Node, ev) => {
  activeFolderId.value = resolveDragHoverGroupId(dropNode);
  if (!isRootDir.value) return;
  isRootDir.value = false;
}

const getTreeNodeContentElement = (nodeKey: string | number) => {
  if (!nodeKey) return null;
  const treeRootElement = (appTreeRef.value?.$el || treeRef.value?.$el) as HTMLElement | null;
  if (!treeRootElement) return null;
  const key = window.CSS?.escape ? window.CSS.escape(String(nodeKey)) : String(nodeKey).replace(/"/g, '\\"');
  return treeRootElement.querySelector(`.el-tree-node[data-key="${key}"] > .el-tree-node__content`) as HTMLElement | null;
}

const getLastVisibleDescendant = (node: Node): Node => {
  if (!node.expanded || !node.childNodes?.length) return node;
  return getLastVisibleDescendant(node.childNodes[node.childNodes.length - 1]);
}

const shouldAppendToGroupTail = (dropNode: Node, dropType: 'before' | 'after' | 'inner' | 'none', event: DragEvent) => {
  if (dropType !== 'after' || dropNode.data.type !== NocodeStructureType.GROUP || !dropNode.expanded || !dropNode.childNodes?.length) {
    return false;
  }

  const dropContentElement = getTreeNodeContentElement(dropNode.key ?? dropNode.data.id);
  const lastVisibleDescendant = getLastVisibleDescendant(dropNode);
  const lastDescendantContentElement = getTreeNodeContentElement(lastVisibleDescendant.key ?? lastVisibleDescendant.data.id);
  if (!dropContentElement || !lastDescendantContentElement) return false;

  const childLevelLeft = dropContentElement.getBoundingClientRect().left + TREE_NODE_INDENT;
  const isDroppedBelowVisibleDescendants = event.clientY >= lastDescendantContentElement.getBoundingClientRect().bottom - 6;
  const isPointerStillInsideGroup = event.clientX >= childLevelLeft - 4;
  return isDroppedBelowVisibleDescendants && isPointerStillInsideGroup;
}

const appendDraggedNodeToGroupTail = (draggingNode: Node, dropNode: Node) => {
  const currentDraggingNode = treeRef.value?.getNode(draggingNode.data.id);
  if (!currentDraggingNode || !treeRef.value) return;

  const draggingData = currentDraggingNode.data as NocodeStructure;
  treeRef.value.remove(currentDraggingNode);
  treeRef.value.append(draggingData, dropNode);
}

const handleDrop = async (draggingNode: Node, dropNode: Node, dropType: 'before' | 'after' | 'inner' | 'none', event: DragEvent) => {
  if (shouldAppendToGroupTail(dropNode, dropType, event)) {
    appendDraggedNodeToGroupTail(draggingNode, dropNode);
  }
  updateStructure();
  clearActiveFolderHighlight();
}

const handleDragEnd = () => {
  clearActiveFolderHighlight();
}

const handleNodeExpand = (data: NocodeStructure) => {
  defaultExpandedKeys.value.push(data.id);
}
const handleNodeCollapse = (data: NocodeStructure) => {
  defaultExpandedKeys.value.indexOf(data.id) > -1 && defaultExpandedKeys.value.splice(defaultExpandedKeys.value.indexOf(data.id), 1);
}
const handleDragOverDiv = (ev) => {
  if (activeFolderId.value) {
    activeFolderId.value = "";
  }
  if (isRootDir.value) return;
  isRootDir.value = true;
}

let closeNocode: Function;
let handleNocodeRenamed: (nocodeId: string, name: string) => void;
let getDeleteList = inject(GET_DELETE_LIST);
let updateOpeningList: (type: 'open' | 'close', projectId: string) => void;
getDeleteList = async () => {
    if (window.opener) {
      window.opener.postMessage({
        type: 'getDeleteList',
      }, window.opener.origin);
    }
}
closeNocode = window.close;
handleNocodeRenamed = (nocodeId: string, name: string) => {
    document.title = `${name} - ${i18next.t("productName")}`;
    if (window.opener) {
      window.opener.postMessage({
        type: 'nocode-rename',
        data: {
          nocodeId: nocodeId,
          name,
        }
      }, window.opener.origin);
    }
}
updateOpeningList = (type: 'open' | 'close', projectId: string) => {
    if (window.opener) {
      window.opener.postMessage({
        type: 'updateOpening',
        data: {
          type,
          projectId,
        }
      }, window.opener.origin);
    }
}

const openProject = async (id: string, name: string)=>{
  const exited = await hideFormCreate();
  if (!exited) {
    return;
  }
  await loadNocodeBoardEditor();
  currentActiveId.value = id;
  if (activeProjectId.value !== id) {
    await checkProjectSave();
    activeProjectId.value = id;
    activeProjectName.value = name;
  }
}

const checkProjectSave = async ()=>{
  if (projectEditorRef.value?.projectChanged) {
    const isSave = await saveProjectDialogRef.value.confirm();
    if (isSave) {
      await projectEditorRef.value?.saveProject(true);
    }
  }
};

const editProjectModule = async (): Promise<boolean> => {
  return true;
}

provide(OPEN_PROJECT, async (projectId: string, autoFullScreen: boolean=false, shareInEditor: boolean = false) => {
  //先传一个空方法
});

provide(PROJECT_TABLE_DRAGGING, ref(false));

const structure = ref<NocodeStructure[]>([]);
const structureSaving = ref(false);

const updateStructure = (tree = (appTreeRef.value?.data as NocodeStructure[]) || (treeRef.value?.data as NocodeStructure[]) || structure.value) => {
  const deepReplace = (nodes) => {
    return nodes?.map(node => {
      return {
        id: node.id,
        children: node.children ? deepReplace(node.children) : undefined,
      };
    });
  }
  structure.value = deepReplace(tree);
  saveStructure();
}

const filterNode = (searchValue: string, data: NocodeStructure) => {
  return data.name.includes(searchValue) && editPermission(data.id);
}

let timer = null;
const searchNocodeTree = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    treeRef.value?.filter(searchValue.value);
    appTreeRef.value?.filter(searchValue.value);
  }, 300);
}

const saveStructure = async (useLoading = true) => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return false;
  structure.value = (appTreeRef.value?.data as NocodeStructure[]) || (treeRef.value?.data as NocodeStructure[]) || structure.value;
  if (useLoading) {
    structureSaving.value = true;
  }

  return await saveWithRelationContextDegradation({
    saveMain: () => axios.post('/project/save-nocode-structure', {
      nocodeId: nocodeId,
      structure: structure.value,
    }, {
      headers: {
        'x-sign': nocode.value.body.sign,
      },
    }),
    applyMainSideEffects: ({ headers }) => {
      const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
      if (mainSign) {
        handleUpdateNocodeSign(mainSign);
      }
      aiWarmupActivityReporter?.report('save');
    },
    syncRelationContext: syncRelationContextFromCurrentApp,
    observeRelationContextError: (error) => {
      console.error('Sync relation context after saving structure failed:', error);
    },
  })
    .catch((error) => {
      if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return false;
      ElMessage.error(error.message);
      return false;
    })
    .finally(() => {
      if (useLoading) {
        structureSaving.value = false;
      }
    });
}

const nocodeTheme = ref<ClientTheme>(ClientTheme.Light);

const getNocode = async (): Promise<Nocode> => {
  return await axios.get(`/project/get-nocode?nocodeId=${nocodeId}&includePageBodies=0`).then(({ data }) => data).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
  });
}
const initNocode = async () => {
  const data = await getNocode();
  const theNocode: Nocode = data;
  nocode.value = theNocode;
  themeColor.value = theNocode.body.themeColor;
  nocodeTheme.value = theNocode.body.theme;
  structure.value = theNocode.body?.structure || [];
  document.title = `${theNocode.meta.name} - ${i18next.t("productName")}`;
}

const editPermission = (id) => {
  const hasIntersection = (rangeData, accountData) => accountData.some(item => rangeData.includes(item));
  const allDepartments = organizeUtil.departments;
  const account = passportState.account
  const departmentMap = new Map(allDepartments.map(dep => [dep.id, dep.parent]));
  let departments: string[] = [];

  for (const depId of account.departments) {
    let parentId: string | undefined = depId;
    const visited = new Set<string>(); // 防止循环

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      departments.push(parentId);
      parentId = departmentMap.get(parentId);
    }
  }
  // 去重
  departments = [...new Set(departments)];


  if (passportState.account.isAdmin) {
    return true;
  }
  const body = nocode.value.body
  if(!body.permissions?.page[id]) {
    return true
  }
  if(body.permissions?.page[id].get.rangeType === 'all') {
    return true
  }
  if(body.permissions?.page[id].get.range.users.includes(account.id)) {
    return true
  }
  if(hasIntersection(body.permissions?.page[id].get.range.departments, departments)) {
    return true
  }
  if(hasIntersection(body.permissions?.page[id].get.range.roles, account.roles)) {
    return true
  }
  return false
}

const handleUpdateNocodeInfo = async () => {
  const activeId = currentActiveId.value;
  const currentPageBodies = nocode.value?.pageBodies;
  const data = await getNocode();
  data.body.connections = nocode.value.body.connections;
  if (currentPageBodies) {
    data.pageBodies = currentPageBodies;
  }
  nocode.value = data;
  if (activeId) {
    await expandTreeToNode(activeId);
  }
}

const asyncFormData = async () => {
  await handleUpdateNocodeInfo();
  await formCreateRef.value?.syncConnection(nocode.value.body.formData);
}
provide(SYNC_FORM_DATA, asyncFormData);

const syncFormAggregateTables = (aggregateTables: AggregateTable[]) => {
  formCreateRef.value?.syncAggregateTables(aggregateTables);
}

const handleAggregateTablesUpdated = async (aggregateTables: AggregateTable[]) => {
  syncFormAggregateTables(aggregateTables);
  await handleUpdateNocodeInfo();
  syncFormAggregateTables(nocode.value.body.formData?.aggregateTables || []);
}

const getExpandedKeys = (structure: NocodeStructure[], targetId: string): string[] => {
  const stack: { node: NocodeStructure; path: string[] }[] = [];

  for (const node of structure) {
    stack.push({ node, path: [] });
  }

  while (stack.length > 0) {
    const { node, path } = stack.pop()!;
    if (node.id === targetId) {
      return path;
    }
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], path: [...path, node.id] });
      }
    }
  }
  return [];
}

const expandTreeToNode = async (targetId: string) => {
  if (!targetId) return;
  await nextTick();
  const currentStructure = (appTreeRef.value?.data as NocodeStructure[]) || (treeRef.value?.data as NocodeStructure[]) || structure.value;
  const parentKeys = getExpandedKeys(currentStructure, targetId);
  defaultExpandedKeys.value = [...new Set([...defaultExpandedKeys.value, ...parentKeys])];
  await nextTick();
  parentKeys.forEach((key) => {
    const node = appTreeRef.value?.getNode(key)
      || appTreeRef.value?.store?.nodesMap?.[key]
      || treeRef.value?.getNode(key)
      || treeRef.value?.store?.nodesMap?.[key];
    if (node) {
      node.expanded = true;
    }
  });
}
const init = async () => {
  await Promise.all([
    organizeUtil.getDepartments(),
    organizeUtil.getUsers(),
    organizeUtil.getRoles(),
  ]);
  try {
    await initNocode();
  } catch(err) {
    console.log("get nocode error", err);
    ElMessage.error(err.message);
  }
};
provide(NOCODE_THEME, nocodeTheme);

const onPageSaved = (id: string) => {
  const page = nocode.value.pageBodies?.find(item => item.id === id);
  if (shouldMarkProjectManualChanged(nocode.value.meta, page)) {
    page.manualChanged = true;
  }
}

const openFirstProject = async ()=>{
  // 打开第一个项目
  const findPage = (_structures = structure.value): NocodeStructure => {
    let i = 0;
    while (i < _structures.length) {
      if (_structures[i].type === NocodeStructureType.GROUP) {
        const page = findPage(_structures[i].children);
        if (page && editPermission(page.id)) return page;
      } else {
        if (editPermission(_structures[i].id)) return _structures[i];
      }
      i ++;
    }
  }
  const page = homePage.value && editPermission(homePage.value.id)
    ? homePage.value
    : findPage();
  if (page) {
    await handleNodeClick(page, page.id === homePage.value?.id);
  }
  return page;
}

const findTreeNode = (targetId, nodes = structure.value) => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.id === targetId) {
      return node;
    } else if (node.children) {
      const found = findTreeNode(targetId, node.children);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const resolveRouteNodeId = (value: unknown): string => {
  if (Array.isArray(value)) {
    return String(value[value.length - 1] || '').trim();
  }
  return String(value || '').trim();
};

const findEditorNode = (targetId: string): NocodeStructure | null => {
  if (!targetId) return null;
  const node = findTreeNode(targetId);
  if (node) return node;

  const table = formData.value?.tables?.find(item => item.uid === targetId);
  if (!table) return null;
  return {
    id: table.uid,
    name: table.alias || table.uid,
    type: NocodeStructureType.FORM,
  };
};

const currentEditorTitle = computed(() => {
  const node = currentActiveId.value ? findTreeNode(currentActiveId.value) : null;
  return node?.name || nocode.value?.meta?.name || '';
});

const homePage = computed(() => getNocodeHomePage(
  structure.value,
  nocode.value?.body?.settings?.homePage,
));
const isHomeActive = computed(() => (
  route.query.home === '1'
  && route.query.id === homePage.value?.id
));

const APP_SHELL_ICON_FALLBACK_COLOR = '#4080ff';

const appShellIconComponent = computed(() => nocode.value?.body?.snapshot?.icon);
const appShellIconHasBackground = computed(() => Boolean(nocode.value?.body?.snapshot?.icon));
const appShellIconBackgroundColor = computed(() => nocode.value?.body?.snapshot?.color || APP_SHELL_ICON_FALLBACK_COLOR);
const appShellIconColor = computed(() => appShellIconHasBackground.value ? '#ffffff' : APP_SHELL_ICON_FALLBACK_COLOR);
const appShellIconWrapperStyle = computed(() => appShellIconHasBackground.value ? {
  backgroundColor: appShellIconBackgroundColor.value,
} : undefined);

init().then(async () => {
  try {
    let id = resolveRouteNodeId(route.query.id);
    const targetNode = findEditorNode(id);
    if (targetNode && editPermission(targetNode.id)) {
      await handleNodeClick(targetNode, route.query.home === '1' && id === homePage.value?.id)
    } else {
      const page = await openFirstProject();
      page && (id = page.id);
    }

    if (!defaultExpandedKeys.value.length) {
      defaultExpandedKeys.value = getExpandedKeys(structure.value, id);
    }
  } finally {
    editorInitialSelectionReady.value = true;
  }
});

const handleNodeClick = async (data: NocodeStructure, fromHome = false) => {
  if(data.type != 'group') {
    router.replace({
      path: route.path,
      query: {
        ...route.query,
        id: data.id,
        home: fromHome === true ? '1' : undefined,
      }
    });
  }

  if (data.type === NocodeStructureType.PAGE) {
    await openProject(data.id, data.name);
  } else if (data.type === NocodeStructureType.FORM) {
    const table = formData.value?.tables?.find(t => t.uid === data.id);
    if (!table) return;
    projectEditorRef.value?.refresh?.();
    const isShow = await showFormCreate(table);
    if (!isShow) {
      return;
    }
  }
  // 只有在非分组类型时才设置当前激活ID
  if (data.type !== NocodeStructureType.GROUP) {
    currentActiveId.value = data.id;
  }
}

const closeAppSwitcherDropdown = () => {
  contextMenu.visible = false;
  appSwitcherDropdownVisible.value = false;
  appSwitcherDropdownRef.value?.handleClose?.();
};

const handleAppSwitcherVisibleChange = (visible: boolean) => {
  appSwitcherDropdownVisible.value = visible;
  if (!visible) {
    contextMenu.visible = false;
  }
};

const handleAppSwitcherNodeClick = async (data: NocodeStructure, fromHome = false) => {
  await handleNodeClick(data, fromHome);
  if (data.type !== NocodeStructureType.GROUP) {
    closeAppSwitcherDropdown();
  }
};

const handleHomePageClick = async () => {
  if (!homePage.value) return;
  await handleAppSwitcherNodeClick(homePage.value, true);
};

const openHomePageSettingDialog = () => {
  homePageSettingPopoverVisible.value = false;
  homePageSettingDialogVisible.value = true;
};

const resolveStructureNode = (nodeId: string) => {
  const node = treeRef.value?.getNode(nodeId) || appTreeRef.value?.getNode(nodeId);
  return node || null;
};

type AppSwitcherContextMenuMode = 'node' | 'app-shell';

const showContextMenu = (mode: AppSwitcherContextMenuMode, event: MouseEvent, node = null) => {
  const shouldSyncPosition = contextMenu.visible;
  contextMenu.mode = mode;
  contextMenu.node = node;
  contextMenu.event = event;
  contextMenu.visible = true;
  if (shouldSyncPosition) {
    nextTick(() => {
      contextMenuRef.value?.syncPosition?.();
    });
  }
};

const isContextMenuNodeOpen = (nodeId: string) => (
  contextMenu.visible
  && contextMenu.mode === 'node'
  && contextMenu.node?.data?.id === nodeId
);

const isAppShellContextMenuOpen = computed(() => (
  contextMenu.visible && contextMenu.mode === 'app-shell'
));

const handleNodeMenuClick = (ev: MouseEvent, data: NocodeStructure) => {
  const node = resolveStructureNode(data.id);
  if (!node) return;
  showContextMenu('node', ev, node);
};

const handleAppShellMenuClick = (ev: MouseEvent) => {
  showContextMenu('app-shell', ev);
};

const nodeRenameDialogRef = ref();
const getContextMenuGroupId = () => {
  return contextMenu.node?.data?.type === NocodeStructureType.GROUP ? contextMenu.node.data.id : '';
};
const contextMenu = reactive({
  visible: false,
  mode: 'node' as AppSwitcherContextMenuMode,
  node: null as any,
  menus: [
    {
      get label() { return i18next.t('NocodeEditor.copy') },
      icon: IEpCopyDocument,
      click: () => {
        if (contextMenu.node?.data?.type === NocodeStructureType.PAGE) {
          handleCopyPage();
        } else if (contextMenu.node?.data?.type === NocodeStructureType.FORM) {
          const table = formData.value?.tables?.find(t => t.uid === contextMenu.node.data.id);
          const connection = nocode.value.body.connections.find(conn => 
            conn.tables?.some(t => t.uid === contextMenu.node.data.id)
          );
          handleCopyTable(connection, table);
        }
      },
      get visible() {
        return contextMenu.mode === 'node'
          && (contextMenu.node?.data?.type === NocodeStructureType.PAGE
            || contextMenu.node?.data?.type === NocodeStructureType.FORM
          );
      }
    },
    {
      get label() { return i18next.t("reportEditor.rename") },
      icon: IUilEdit,
      click: () => {
        if (contextMenu.mode === 'app-shell') {
          closeAppSwitcherDropdown();
          renameNocodeDialogRef.value?.show(nocodeId, nocode.value?.meta?.name || '');
          return;
        }
        if (!contextMenu.node) return;
        const { data } = contextMenu.node;
        nodeRenameDialogRef.value?.show(data.name, data.type);
      },
      get visible() {
        return contextMenu.mode === 'app-shell' || Boolean(contextMenu.node);
      },
    },
    {
      get label() {
        return isDisable(contextMenu.node)
          ? i18next.t('NocodeEditor.showInApp')
          : i18next.t('NocodeEditor.hideInApp');
      },
      get icon() {
        return isDisable(contextMenu.node)
          ? IAntDesignEyeOutlined
          : IAntDesignEyeInvisibleOutlined;
      },
      click: () => {
        if (!contextMenu.node) return;
        handleVisibleClick(contextMenu.node);
      },
      get visible() {
        return contextMenu.mode === 'node'
          && (contextMenu.node?.data?.type === NocodeStructureType.PAGE || contextMenu.node?.data?.type === NocodeStructureType.FORM || contextMenu.node?.data?.type === NocodeStructureType.GROUP);
      }
    },
    {
      get label() { return i18next.t("reportEditor.addFolder") },
      icon: IVenGroup,
      click: () => {
        showFolderCreateDialog(getContextMenuGroupId(), true);
      },
      get visible() {
        return contextMenu.mode === 'node' && contextMenu.node?.data?.type === NocodeStructureType.GROUP;
      }
    },
    {
      get label() { return i18next.t("reportEditor.addForm") },
      icon: IVenForm,
      click: () => {
        showCreateDataDialog(getContextMenuGroupId(), true);
      },
      get visible() {
        return contextMenu.mode === 'node' && contextMenu.node?.data?.type === NocodeStructureType.GROUP;
      }
    },
    {
      get label() { return i18next.t("reportEditor.addPage") },
      icon: IVenBoard,
      click: () => {
        showNocodeCreateDialog(getContextMenuGroupId(), true);
      },
      get visible() {
        return contextMenu.mode === 'node' && contextMenu.node?.data?.type === NocodeStructureType.GROUP;
      }
    },
    {
      get label() { return i18next.t('NocodeEditor.delete') },
      icon: IEpDelete,
      className: 'has-divider',
      click: () => {
        handleDelete();
      },
      get visible() {
        return contextMenu.mode === 'node';
      },
    }
  ],
  event: null as MouseEvent | null,
});

const formData = computed(() => {
  return nocode.value?.body?.formData;
})

const handleNodeRenamed = async (name: string) => {
  contextMenu.node.data.name = name;
  if(contextMenu.node.data.type === NocodeStructureType.FORM) {
    structureSaving.value = true;
    try {
      await formCreateRef.value?.save?.(true);
      structure.value = (appTreeRef.value?.data as NocodeStructure[]) || (treeRef.value?.data as NocodeStructure[]) || structure.value;
      if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;

      const data = await axios.post("project/rename-nocode-form", {
        nocodeId,
        tableUID: contextMenu.node.data.id,
        name,
      }, {
        headers: {
          'x-sign': nocode.value.body.sign,
        },
      }).then(({ data, headers }) => {
        const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
        if (mainSign) {
          handleUpdateNocodeSign(mainSign);
        }
        return data;
      }).catch((error) => {
        handleNocodeSyncConflictError(error, nocodeSignIsLatest)
      });
      if (data) {
        nocode.value.body = data;
        await formCreateRef.value?.syncConnection?.(data.formData)
        ElMessage.success(i18next.t('NocodeEditor.modifySuccess'));
      }
    } finally {
      structureSaving.value = false;
    }
  } else  {
    if (contextMenu.node.data.type === NocodeStructureType.PAGE && activeProjectId.value) {
      activeProjectName.value = name;
    }
    await saveStructure();
    ElMessage.success(i18next.t('NocodeEditor.modifySuccess'));
    handleUpdateNocodeInfo();
  }
}

const handleNodeContextMenu = (ev: MouseEvent, data, node) => {
  showContextMenu('node', ev, node);
}


const insertStructure = (_structure: NocodeStructure) => {
  if (!createGoupId.value) {
    treeRef.value.data.push(_structure);
  } else {
    const node = treeRef.value.getNode(createGoupId.value);
    node.data.children.push(_structure);
    structure.value = (treeRef.value.data as NocodeStructure[]);
  }
  searchValue.value = "";
}
const onLayerCreate = async (name = i18next.t('NocodeEditor.myDashboard'), parent = 'none') => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;

  const id = unique();
  createGoupId.value = parent === 'none' ? '' : parent
  insertStructure({
    id,
    name,
    type: NocodeStructureType.PAGE,
  });
  const res = await axios.post("project/nocode-layer-create", {
    nocodeId,
    id,
    structure: structure.value,
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) {
      return;
    }
    ElMessage.error(error?.response?.data?.message || error?.message);
  });
  if (res) {
    const mainSign = Array.isArray(res.headers?.['x-sign']) ? res.headers['x-sign'][0] : res.headers?.['x-sign'];
    if (mainSign) {
      handleUpdateNocodeSign(mainSign);
    }
    await expandTreeToNode(id);
    await openProject(id, name);
    handleUpdateNocodeInfo();
  }
};

const handleFolderCreate = async (name: string, parent: string) => {
  createGoupId.value = parent === 'none' ? '' : parent
  const id = unique();
  insertStructure({
    id,
    name,
    type: NocodeStructureType.GROUP,
    children: [],
  })
  const res = await saveStructure();
  if (res) {
    syncTreeActiveIdToOpenedNode();
    await expandTreeToNode(id);
  }
}



const handleViewSetting = () => {
  saveNocodeSettings();
}
const projectEditorRef = ref();
const saveProjectDialogRef = ref();
const isShowFormCreate = ref(false);
const formCreateRef = ref();
const defaultFormulaOverlayPanelRef = ref();
const aiDraftChanged = ref(false);
const aiDraftDisplayState = ref<NocodeEditorAiDraftPersistenceState | null>(null);
const aiDraftBlockingState = ref<NocodeEditorAiDraftPersistenceState | null>(null);
const aiDraftSourceState = ref<NocodeEditorAiDraftPersistenceState | null>(null);
const activeAiFlowIssueState = ref<NocodeEditorAiFlowIssueState | null>(null);
const aiDraftBlockingClearedAt = ref(0);
const editorAiVisible = ref(true);
const editorAiPanelRef = ref<{
  refreshStagedState?: () => Promise<void>
  focusTextarea?: () => Promise<void>
  startNewConversation?: () => Promise<void>
  submitExcelFileAnalysis?: (
    payload: AiExcelAnalysisConfirmPayload,
    visibleUserContent: string,
    requestMetadata?: Record<string, unknown>,
  ) => Promise<'not_started' | 'completed' | 'aborted' | 'failed'>
  appendExcelCreateCompletionReply?: (payload: ExcelCreateCompletedPayload) => Promise<void>
  applyPendingBlueprint?: (item: NocodeEditorAiStageBlueprintDisplayItem) => Promise<NocodeEditorAiBlueprintApplyResult | undefined>
  applyPendingBlueprintBatch?: (payload: {
    items: NocodeEditorAiStageBlueprintDisplayItem[]
    scope: Exclude<NocodeEditorAiBlueprintApplyScope, 'single'>
  }) => Promise<void>
  continuePendingBlueprintAdjustment?: (item: NocodeEditorAiStageBlueprintDisplayItem) => Promise<void>
  openGeneratedBlueprintPage?: (payload: NocodeEditorAiGeneratedBlueprintPageTarget) => Promise<void>
  getPendingBlueprintConfirmationResponseDrafts?: (item: NocodeEditorAiStageBlueprintDisplayItem) => NocodeEditorAiConfirmationResponseDraftMap
  getPendingBlueprintActiveInputQuestionIds?: (item: NocodeEditorAiStageBlueprintDisplayItem) => string[]
  getPendingBlueprintInlineConfirmationNoteQuestionIds?: (item: NocodeEditorAiStageBlueprintDisplayItem) => string[]
  handleSelectPendingBlueprintConfirmationOption?: (payload: {
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
    option: NocodeEditorAiConfirmQuestionOption
  }) => void
  handleTogglePendingBlueprintInlineConfirmationInput?: (payload: {
    item: NocodeEditorAiStageBlueprintDisplayItem
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
  }) => void
  handleUpdatePendingBlueprintInlineConfirmationNote?: (payload: {
    item: NocodeEditorAiStageBlueprintDisplayItem
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
    note: string
  }) => void
  handleSubmitPendingBlueprintConfirmationResponses?: (payload: {
    item: NocodeEditorAiStageBlueprintDisplayItem
    block: NocodeEditorAiArtifactBlock
  }) => Promise<void>
  getConfirmationResponseDrafts?: (block: NocodeEditorAiArtifactBlock) => NocodeEditorAiConfirmationResponseDraftMap
  getActiveConfirmationInputQuestionIds?: (block: NocodeEditorAiArtifactBlock) => string[]
  getInlineConfirmationNoteQuestionIds?: (block: NocodeEditorAiArtifactBlock) => string[]
  canApplyFlowFromPreview?: (block: NocodeEditorAiArtifactBlock) => boolean
  isApplyingFlowArtifact?: (block: NocodeEditorAiArtifactBlock) => boolean
  handleContinueFlowWithDefaults?: (block: NocodeEditorAiArtifactBlock) => Promise<void>
  handleToggleFlowInlineConfirmationInput?: (payload: {
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
  }) => void
  handleUpdateFlowInlineConfirmationNote?: (payload: {
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
    note: string
  }) => void
  handleSubmitFlowConfirmationResponses?: (block: NocodeEditorAiArtifactBlock) => Promise<void>
  handleApplyFlowFromPreview?: (block?: NocodeEditorAiArtifactBlock | null) => Promise<unknown>
  handleSelectConfirmationOption?: (payload: {
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
    option: NocodeEditorAiConfirmQuestionOption
  }) => void
  isConfirmationSubmitting?: boolean
} | null>(null);
const stageViewTab = ref<NocodeEditorStageViewTab>('blueprint');
const formShellTab = ref<'form-design' | 'process-setting' | 'data-management'>('form-design');
const formFieldCatalogVisible = computed({
  get: () => formDesignerPanelState.fieldCatalogVisible,
  set: (visible: boolean) => setFormDesignerPanelVisible('fieldCatalog', visible),
});
const formPropertyPanelVisible = computed({
  get: () => formDesignerPanelState.propertyPanelVisible,
  set: (visible: boolean) => setFormDesignerPanelVisible('propertyPanel', visible),
});
const defaultFormulaOverlay: {
  visible: boolean;
  widget?: FormElement;
  value?: string | FormulaConfig;
  componentProps: Record<string, any>;
  onConfirm?: (value: FormulaConfig) => void;
} = reactive({
  visible: false,
  widget: undefined,
  value: undefined,
  componentProps: {},
  onConfirm: undefined,
});
const stageBlueprintApplying = ref(false);
const pendingStageBlueprints: Ref<NocodeEditorAiStageBlueprintDisplayItem[]> = ref([]);
const pendingStageBlueprintHistory: Ref<NocodeEditorAiStageBlueprintDisplayItem[]> = ref([]);
const stageFlowArtifactBlocks = ref<NocodeEditorAiArtifactBlock[]>([]);
const appliedBlueprintRecords = ref<NocodeEditorAiAppliedBlueprintRecord[]>([]);
const planningDisplayVersionByContextKey = ref<Record<string, number>>({});
const refreshingAppliedBlueprints = ref(false);
const applyingStageBlueprintId = ref('');
const stageBlueprintLoading = ref(false);
const stageBlueprintLoadingMessage = ref('');
const stageBlueprintConfirmationSubmitting = computed(() => Boolean(
  editorAiPanelRef.value?.isConfirmationSubmitting,
));
const stageShowBatchApplyAction = computed(() => (
  pendingStageBlueprints.value.some(item => isStagedBlueprintItem(item))
));
const editorSelectionType: ComputedRef<EditorSelectionType> = computed(() => resolveEditorSelectionType({
  isShowFormCreate: isShowFormCreate.value,
  activeProjectId: activeProjectId.value,
}));
const showFormDesignToolbarActions = computed(() => (
  editorSelectionType.value === 'form'
  && formShellTab.value === 'form-design'
));
const formDesignerBlueprintReadonly = computed(() => (
  editorSelectionType.value === 'form'
  && stageBlueprintApplying.value
));
const showPreviewButton = computed(() => shouldShowPreviewButton(editorSelectionType.value));
const showSaveButton = computed(() => shouldShowSaveButton(editorSelectionType.value));
const previewDrawerMode = computed(() => getPreviewDrawerMode(editorSelectionType.value));

const closeDefaultFormulaOverlay = () => {
  defaultFormulaOverlay.visible = false;
  defaultFormulaOverlay.widget = undefined;
  defaultFormulaOverlay.value = undefined;
  defaultFormulaOverlay.componentProps = {};
  defaultFormulaOverlay.onConfirm = undefined;
};

const persistAndCloseDefaultFormulaOverlay = () => {
  if (!defaultFormulaOverlay.visible) return;

  const value = defaultFormulaOverlayPanelRef.value?.getValue?.();
  if (value) {
    defaultFormulaOverlay.onConfirm?.(value);
  }

  closeDefaultFormulaOverlay();
};

const getCurrentEditorAiSettingContext = (): NocodeEditorAiSettingContext => {
  if (defaultFormulaOverlay.visible) {
    return defaultFormulaOverlayPanelRef.value?.getAiContext?.() || null;
  }

  return null;
};

const getCurrentEditorAiTaskContext = async (): Promise<NocodeEditorAiTaskContext> => {
  if (defaultFormulaOverlay.visible) {
    return defaultFormulaOverlayPanelRef.value?.getAiTaskContext?.() || null;
  }

  return await formCreateRef.value?.getAiDefaultFormulaTaskContext?.() || null;
};

const getCurrentEditorAiSettingTargetContext = (): NocodeEditorAiSettingTargetContext => {
  if (defaultFormulaOverlay.visible) {
    return defaultFormulaOverlayPanelRef.value?.getAiSettingTargetContext?.() || null;
  }

  return null;
};

const openDefaultFormulaOverlay = (payload: {
  formWidget: FormElement;
  value?: string | FormulaConfig;
  componentProps?: Record<string, any>;
  onConfirm: (value: FormulaConfig) => void;
}) => {
  if (editorSelectionType.value !== 'form') return false;

  defaultFormulaOverlay.visible = true;
  defaultFormulaOverlay.widget = payload.formWidget as any;
  defaultFormulaOverlay.value = payload.value;
  defaultFormulaOverlay.componentProps = payload.componentProps || {};
  defaultFormulaOverlay.onConfirm = payload.onConfirm;
  return true;
};

const applyDefaultFormulaOverlayDraft = async (payload: {
  widgetId: string;
  value: unknown;
  tableId?: string;
  tableName?: string;
  fieldName?: string;
}) => {
  const widgetId = String(payload?.widgetId || '').trim();
  const overlayTableId = String(defaultFormulaOverlay.widget?.topForm?.tableUID?.[1] || '').trim();
  const targetTableId = String(payload?.tableId || '').trim();
  const overlayWidgetId = String(defaultFormulaOverlay.widget?.uid || '').trim();
  if (!defaultFormulaOverlay.visible || !widgetId) {
    return null;
  }
  if (overlayWidgetId !== widgetId) {
    return null;
  }
  if (overlayTableId && targetTableId && overlayTableId !== targetTableId) {
    return null;
  }

  await nextTick();
  const applied = defaultFormulaOverlayPanelRef.value?.setAiFormulaDraft?.(payload.value);
  if (!applied) {
    return null;
  }

  const result = {
    tableId: overlayTableId || targetTableId || activeFormId.value || '',
    tableName: String(payload?.tableName || '').trim(),
    widgetId,
    fieldName: String(
      payload?.fieldName
      || defaultFormulaOverlay.widget?.getSoul?.()?.name
      || defaultFormulaOverlay.widget?.name
      || defaultFormulaOverlay.widget?.uid
      || '',
    ).trim(),
    draftOnly: true,
    overlayDraft: true,
  };
  return result;
};

const openAiFormulaResultTarget = async (input: {
  tableId: string;
  tableName?: string;
  widgetId: string;
}) => {
  const targetTableId = String(input?.tableId || '').trim();
  const widgetId = String(input?.widgetId || '').trim();
  if (!targetTableId || !widgetId) {
    return {
      ok: false,
      reason: 'invalid_target',
    };
  }

  if (activeFormId.value !== targetTableId || !isShowFormCreate.value) {
    const targetTable = formData.value?.tables?.find(item => item.uid === targetTableId);
    if (!targetTable) {
      return {
        ok: false,
        reason: 'form_not_found',
      };
    }
    const opened = await showFormCreate(targetTable, false);
    if (!opened) {
      return {
        ok: false,
        reason: 'open_form_failed',
      };
    }
  }

  const formulaTarget = await formCreateRef.value?.openAiFormulaPanel?.({ widgetId });
  const widget = formulaTarget?.widget as FormElement | undefined;
  if (!widget) {
    return {
      ok: false,
      reason: 'widget_not_found',
    };
  }

  const value = String(formulaTarget?.computeFormula || '').trim()
    ? formulaTarget?.computeFormula
    : formulaTarget?.defaultFormula;

  const handled = openDefaultFormulaOverlay({
    formWidget: widget,
    value,
    componentProps: {
      includeSelf: formulaTarget?.includeSelf,
      isLimitSubform: formulaTarget?.isLimitSubform,
    },
    onConfirm: () => undefined,
  });

  return {
    ok: Boolean(handled),
    ...(handled ? {} : { reason: 'open_formula_overlay_failed' }),
  };
};

const handleDefaultFormulaOverlayVisibleChange = (visible: boolean) => {
  if (visible) {
    defaultFormulaOverlay.visible = true;
    return;
  }

  closeDefaultFormulaOverlay();
};

const handleDefaultFormulaOverlayUpdate = (value: FormulaConfig) => {
  defaultFormulaOverlay.onConfirm?.(value);
};

watch(editorSelectionType, (selectionType) => {
  if (selectionType !== 'form' && defaultFormulaOverlay.visible) {
    persistAndCloseDefaultFormulaOverlay();
  }
});

const normalizeAppliedBlueprintDisplayItem = (
  record: NocodeEditorAiAppliedBlueprintRecord,
): NocodeEditorAiStageBlueprintDisplayItem | null => {
  const identityKey = String(record.blueprintId || record.blueprint?.id || record.recordId || '').trim();
  if (!identityKey || !record?.blueprint) {
    return null;
  }

  const itemKind = record.itemKind === 'current_form_snapshot'
    ? 'current_form_snapshot'
    : 'ai_blueprint';
  const phase = itemKind === 'current_form_snapshot'
    ? null
    : normalizeAppliedBlueprintPhase(record.phase) || 'applied_saved';
  const planningContextKey = String((record.blueprint as any)?.confirmation?.planningContextKey || '').trim();
  const displayRevision = planningContextKey
    ? Number(planningDisplayVersionByContextKey.value[planningContextKey] || 0) || undefined
    : undefined;
  const displayVersionLabel = displayRevision ? i18next.t('NocodeEditor.versionLabel', { version: displayRevision }) : undefined;

  return {
    itemKind,
    id: `applied:${String(record.recordId || identityKey).trim()}`,
    identityKey,
    phase,
    status: phase || 'current_form_snapshot',
    source: record.source || 'current-forms',
    title: String(record.title || record.blueprint?.title || i18next.t('NocodeEditor.blueprintTitle')).trim() || i18next.t('NocodeEditor.blueprintTitle'),
    summary: String(record.summary || record.blueprint?.summary || '').trim() || undefined,
    sortIndex: Number(record.sortIndex),
    createdAt: Number(record.createdAt || 0) || undefined,
    updatedAt: Number(record.updatedAt || record.appliedAt || record.createdAt || Date.now()),
    appliedAt: Number(record.appliedAt || record.updatedAt || 0) || undefined,
    displayRevision,
    displayVersionLabel,
    revision: Number(record.revision || 0) || undefined,
    stagedAt: Number(record.stagedAt || 0) || undefined,
    applyResult: itemKind === 'ai_blueprint' ? record.applyResult || null : null,
    draftPersistenceState: null,
    blueprint: record.blueprint,
  } as NocodeEditorAiStageBlueprintDisplayItem;
};

const isStagedBlueprintItem = (item?: NocodeEditorAiStageBlueprintDisplayItem | null) => (
  item?.itemKind === 'ai_blueprint'
  && isBlueprintStagedPhase(item.phase)
);

const cloneBlueprintValue = <T,>(value: T): T => (
  value == null ? value : JSON.parse(JSON.stringify(value))
);

const normalizeBlueprintFamilyToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')
  .replace(/[？?！!，,。、“”"'‘’：:；;（）()【】\[\]《》<>]/g, '');

const getBlueprintFormIdentityKey = (form: Partial<NocodeEditorAiAppBlueprintForm> | null | undefined) => (
  String(form?.formKey || '').trim()
  || normalizeBlueprintFamilyToken(form?.tableName)
);

const countBlueprintFields = (fields: NocodeEditorAiAppBlueprintField[] = []) => fields.reduce((total, field) => {
  const children = Array.isArray(field?.children) ? field.children : [];
  return total + 1 + countBlueprintFields(children);
}, 0);

const getBlueprintFieldCount = (blueprint: NocodeEditorAiAppBlueprint | null | undefined) => {
  if (!blueprint) {
    return 0;
  }

  return (Array.isArray(blueprint.forms) ? blueprint.forms : []).reduce((total, form) => {
    return total + countBlueprintFields(Array.isArray(form?.fields) ? form.fields : []);
  }, 0);
};

const shouldPreferBlueprintDisplayItem = (
  nextItem: NocodeEditorAiStageBlueprintDisplayItem,
  currentItem?: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  if (!currentItem) {
    return true;
  }

  const nextUpdatedAt = Number(nextItem.updatedAt || nextItem.appliedAt || nextItem.createdAt || 0);
  const currentUpdatedAt = Number(currentItem.updatedAt || currentItem.appliedAt || currentItem.createdAt || 0);
  if (nextUpdatedAt !== currentUpdatedAt) {
    return nextUpdatedAt > currentUpdatedAt;
  }

  const nextRevision = Number(nextItem.revision || 0);
  const currentRevision = Number(currentItem.revision || 0);
  if (nextRevision !== currentRevision) {
    return nextRevision > currentRevision;
  }

  const nextFieldCount = getBlueprintFieldCount(nextItem.blueprint);
  const currentFieldCount = getBlueprintFieldCount(currentItem.blueprint);
  if (nextFieldCount !== currentFieldCount) {
    return nextFieldCount > currentFieldCount;
  }

  return String(nextItem.identityKey || '').trim().length >= String(currentItem.identityKey || '').trim().length;
};

const buildOptimisticAppliedBlueprintRecord = (input: {
  pendingIdentityKey?: string
  pendingIdentityKeys?: string[]
  title?: string
  summary?: string
  createdAt?: number
  updatedAt?: number
  sortIndex?: number
  revision?: number
  stagedAt?: number
  blueprint: NocodeEditorAiAppBlueprint
},
  result?: NocodeEditorAiBlueprintApplyResult,
): NocodeEditorAiAppliedBlueprintRecord => {
  const now = Date.now();
  const resultForms = Array.isArray(result?.forms) ? result.forms : [];
  const nextBlueprint = buildScopedBlueprintByApplyResult(input.blueprint, result)
    || cloneBlueprintValue(input.blueprint);

  if (Array.isArray(nextBlueprint?.forms)) {
    nextBlueprint.forms = nextBlueprint.forms.map((form, index) => {
      const matchedResult = resultForms.find(entry => (
        String(entry.applyTargetKey || '').trim()
        && String(entry.applyTargetKey || '').trim() === getNocodeEditorBlueprintFormApplyTargetIdentity(form)
      ));

      if (!matchedResult) {
        return form;
      }

      return {
        ...form,
        formKey: String(matchedResult.tableId || form.formKey || '').trim() || form.formKey,
        tableName: String(matchedResult.tableName || form.tableName || '').trim() || form.tableName,
      };
    });
  }

  const identityKey = String(
    buildScopedAppliedBlueprintIdentityKey({
      pendingIdentityKey: input.pendingIdentityKey,
      pendingIdentityKeys: input.pendingIdentityKeys,
      blueprint: nextBlueprint,
      applyResult: result,
    }),
  ).trim() || `applied:${now}`;

  nextBlueprint.id = identityKey;

  return {
    recordId: identityKey,
    blueprintId: identityKey,
    itemKind: 'ai_blueprint',
    phase: result?.persistenceMode === 'draft_only' ? 'applied_draft' : 'applied_saved',
    status: result?.persistenceMode === 'draft_only' ? 'applied_draft' : 'applied_saved',
    source: 'ai-apply',
    title: String(
      input.title
      || nextBlueprint?.title
      || nextBlueprint?.forms?.[0]?.tableName
      || i18next.t('NocodeEditor.blueprintTitle')
    ).trim() || i18next.t('NocodeEditor.blueprintTitle'),
    summary: String(input.summary || nextBlueprint?.summary || '').trim() || undefined,
    sortIndex: Number.isFinite(Number(input.sortIndex)) ? Number(input.sortIndex) : undefined,
    revision: Number(input.revision || 0) || undefined,
    stagedAt: Number(input.stagedAt || 0) || undefined,
    createdAt: Number(input.createdAt || now) || now,
    updatedAt: Number(input.updatedAt || result?.finishedAt || now) || now,
    appliedAt: Number(result?.finishedAt || input.updatedAt || now) || now,
    applyResult: result || null,
    blueprint: nextBlueprint,
  };
};

const upsertLocalAppliedBlueprintRecord = (record: NocodeEditorAiAppliedBlueprintRecord) => {
  const nextRecord = cloneBlueprintValue(record);
  const identityKeys = new Set(
    [
      nextRecord.recordId,
      nextRecord.blueprintId,
      nextRecord.blueprint?.id,
    ]
      .map(value => String(value || '').trim())
      .filter(Boolean),
  );
  const currentRecords = [...appliedBlueprintRecords.value];
  const matchedIndex = currentRecords.findIndex(item => (
    [
      item.recordId,
      item.blueprintId,
      item.blueprint?.id,
    ]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .some(value => identityKeys.has(value))
  ));

  if (matchedIndex === -1) {
    currentRecords.push(nextRecord);
  } else {
    currentRecords[matchedIndex] = {
      ...currentRecords[matchedIndex],
      ...nextRecord,
    };
  }

  appliedBlueprintRecords.value = currentRecords;
};

const handleBlueprintApplied = async (payload: NocodeEditorAiAppliedBlueprintSnapshot) => {
  const pendingIdentityKeys = (
    Array.isArray(payload.pendingIdentityKeys)
      ? payload.pendingIdentityKeys
      : [payload.pendingIdentityKey]
  )
    .map(value => String(value || '').trim())
    .filter(Boolean);
  const pendingIdentityKeySet = new Set(pendingIdentityKeys);
  const optimisticRecord = buildOptimisticAppliedBlueprintRecord({
    pendingIdentityKey: String(payload.pendingIdentityKey || '').trim() || undefined,
    pendingIdentityKeys,
    title: payload.title,
    summary: payload.summary,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    sortIndex: payload.sortIndex,
    revision: payload.revision,
    stagedAt: payload.stagedAt,
    blueprint: payload.blueprint,
  }, payload.result);

  upsertLocalAppliedBlueprintRecord(optimisticRecord);

  if (pendingIdentityKeySet.size) {
    pendingStageBlueprints.value = pendingStageBlueprints.value.filter(entry => (
      !pendingIdentityKeySet.has(String(entry.identityKey || '').trim())
    ));
  }

  try {
    const { data } = await axios.post<NocodeEditorAiAppliedBlueprintRecord>(
      `/ai/nocode-editor/apps/${nocodeId}/applied-blueprints`,
      {
        recordId: optimisticRecord.recordId,
        blueprintId: optimisticRecord.blueprintId,
        source: optimisticRecord.source,
        itemKind: optimisticRecord.itemKind,
        phase: optimisticRecord.phase,
        title: optimisticRecord.title,
        summary: optimisticRecord.summary,
        sortIndex: optimisticRecord.sortIndex,
        revision: optimisticRecord.revision,
        stagedAt: optimisticRecord.stagedAt,
        appliedAt: optimisticRecord.appliedAt,
        applyResult: optimisticRecord.applyResult || null,
        blueprint: optimisticRecord.blueprint,
      },
    );
    if (data?.blueprint) {
      upsertLocalAppliedBlueprintRecord(data);
    }
  } catch (error) {
    console.error('Persist applied blueprint failed:', error);
    ElMessage.warning(i18next.t('NocodeEditor.blueprintSyncFailed'));
  }
};

const stageBlueprintItems = computed(() => {
  const appliedItems = appliedBlueprintRecords.value
    .map(record => normalizeAppliedBlueprintDisplayItem(record))
    .filter(Boolean)
    .sort((left, right) => {
      const leftSortIndex = Number((left as NocodeEditorAiStageBlueprintDisplayItem).sortIndex);
      const rightSortIndex = Number((right as NocodeEditorAiStageBlueprintDisplayItem).sortIndex);
      if (Number.isFinite(leftSortIndex) || Number.isFinite(rightSortIndex)) {
        if (!Number.isFinite(leftSortIndex)) return 1;
        if (!Number.isFinite(rightSortIndex)) return -1;
        if (leftSortIndex !== rightSortIndex) {
          return leftSortIndex - rightSortIndex;
        }
      }
      return Number((right as NocodeEditorAiStageBlueprintDisplayItem).updatedAt || 0) - Number((left as NocodeEditorAiStageBlueprintDisplayItem).updatedAt || 0);
    }) as NocodeEditorAiStageBlueprintDisplayItem[];
  const appliedIdentityKeySet = new Set(
    appliedItems.map(item => String(item.identityKey || '').trim()).filter(Boolean),
  );
  const dedupedPendingItemMap = new Map<string, NocodeEditorAiStageBlueprintDisplayItem>();
  for (const item of pendingStageBlueprints.value) {
    const identityKey = String(
      item.identityKey
      || item.blueprint?.id
      || item.id
      || ''
    ).trim();
    if (!identityKey || appliedIdentityKeySet.has(identityKey)) {
      continue;
    }

    const current = dedupedPendingItemMap.get(identityKey);
    if (!current || shouldPreferBlueprintDisplayItem(item, current)) {
      dedupedPendingItemMap.set(identityKey, item);
    }
  }
  const pendingItems = Array.from(dedupedPendingItemMap.values())
    .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
  return [...pendingItems, ...appliedItems];
});


const loadAppliedBlueprints = async () => {
  try {
    const { data } = await axios.get<NocodeEditorAiAppliedBlueprintRecord[]>(
      `/ai/nocode-editor/apps/${nocodeId}/applied-blueprints`,
    );
    appliedBlueprintRecords.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Load applied blueprints failed:', error);
  }
};

const buildAppliedBlueprintRecordsFromCurrentApp = () => {
  const currentBlueprint = buildCurrentAppBlueprint(
    formData.value?.tables || [],
    structure.value || [],
    formData.value?.formOptions || {},
    String(nocode.value?.meta?.name || '').trim(),
  );

  if (!currentBlueprint?.forms?.length) {
    return [];
  }

  const existingAppliedRecordMap = new Map<string, NocodeEditorAiAppliedBlueprintRecord>();
  appliedBlueprintRecords.value.forEach((record) => {
    const form = Array.isArray(record?.blueprint?.forms) ? record.blueprint.forms[0] : null;
    const identityKey = getBlueprintFormIdentityKey(form);
    if (identityKey) {
      existingAppliedRecordMap.set(identityKey, record);
    }
  });

  return currentBlueprint.forms.map((form, index) => {
    const blueprintId = String(form.formKey || `current-form-${index + 1}`).trim() || `current-form-${index + 1}`;
    const fieldCount = Array.isArray(form.fields) ? form.fields.length : 0;
    const identityKey = getBlueprintFormIdentityKey(form);
    const currentRecord = identityKey ? existingAppliedRecordMap.get(identityKey) || null : null;
    const nextBlueprint: NocodeEditorAiAppBlueprint = {
      id: blueprintId,
      title: String(form.tableName || '').trim() || i18next.t('NocodeEditor.unnamedFormWithIndex', { index: index + 1 }),
      summary: String(form.description || '').trim() || undefined,
      forms: [form],
      assumptions: [],
      openQuestions: [],
    };
    const mergedBlueprint = currentRecord?.blueprint
      ? mergeBlueprintWithCurrent(nextBlueprint, cloneBlueprintValue(currentRecord.blueprint) as NocodeEditorAiAppBlueprint)
      : nextBlueprint;

    return {
      recordId: String(currentRecord?.recordId || blueprintId).trim() || blueprintId,
      blueprintId: String(currentRecord?.blueprintId || blueprintId).trim() || blueprintId,
      itemKind: 'current_form_snapshot' as const,
      phase: null,
      status: 'current_form_snapshot' as const,
      source: 'current-forms' as const,
      title: String(form.tableName || '').trim() || i18next.t('NocodeEditor.unnamedFormWithIndex', { index: index + 1 }),
      summary: String(form.description || '').trim() || i18next.t('NocodeEditor.fieldCountSummary', { count: fieldCount }),
      sortIndex: index,
      createdAt: currentRecord?.createdAt,
      updatedAt: currentRecord?.updatedAt,
      appliedAt: currentRecord?.appliedAt,
      applyResult: null,
      blueprint: mergedBlueprint,
    };
  });
};

const replaceAppliedBlueprints = async (items: ReturnType<typeof buildAppliedBlueprintRecordsFromCurrentApp>) => {
  const { data } = await axios.post<NocodeEditorAiAppliedBlueprintRecord[]>(
    `/ai/nocode-editor/apps/${nocodeId}/applied-blueprints/replace`,
    {
      items,
    },
  );
  appliedBlueprintRecords.value = Array.isArray(data) ? data : [];
  return appliedBlueprintRecords.value;
};

const buildCurrentRelationContext = () => {
  return buildNocodeEditorRelationContextFromTables({
    appId: nocodeId,
    appName: String(nocode.value?.meta?.name || '').trim(),
    tables: formData.value?.tables || [],
    structure: structure.value || [],
  });
};

const syncRelationContextFromCurrentApp = async () => {
  await axios.post(`/ai/nocode-editor/apps/${nocodeId}/relation-context/sync`, {
    context: buildCurrentRelationContext(),
  });
};

const syncAppliedBlueprintsFromCurrentApp = async (options?: { silent?: boolean }) => {
  if (refreshingAppliedBlueprints.value) {
    return appliedBlueprintRecords.value;
  }

  refreshingAppliedBlueprints.value = true;
  try {
    const records = buildAppliedBlueprintRecordsFromCurrentApp();
    const nextRecords = await replaceAppliedBlueprints(records);
    await syncRelationContextFromCurrentApp();
    if (!options?.silent) {
      ElMessage.success(i18next.t('NocodeEditor.blueprintContextSynced'));
    }
    return nextRecords;
  } catch (error) {
    console.error('Sync applied blueprints failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (!options?.silent) {
      ElMessage.error(message || i18next.t('NocodeEditor.updateBlueprintFailed'));
    }
    throw error;
  } finally {
    refreshingAppliedBlueprints.value = false;
  }
};

const handleRefreshAppliedBlueprints = () => {
  void syncAppliedBlueprintsFromCurrentApp().catch(() => {});
};

const getStageBlueprintConfirmationResponseDrafts = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
): NocodeEditorAiConfirmationResponseDraftMap => {
  const panel = editorAiPanelRef.value;
  if (!panel?.getPendingBlueprintConfirmationResponseDrafts) {
    return {};
  }

  return panel.getPendingBlueprintConfirmationResponseDrafts(item);
};

const getStageBlueprintActiveConfirmationInputQuestionIds = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
): string[] => {
  const panel = editorAiPanelRef.value;
  if (!panel?.getPendingBlueprintActiveInputQuestionIds) {
    return [];
  }

  return panel.getPendingBlueprintActiveInputQuestionIds(item);
};

const getStageBlueprintInlineConfirmationNoteQuestionIds = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
): string[] => {
  const panel = editorAiPanelRef.value;
  if (!panel?.getPendingBlueprintInlineConfirmationNoteQuestionIds) {
    return [];
  }

  return panel.getPendingBlueprintInlineConfirmationNoteQuestionIds(item);
};

const getStageFlowConfirmationResponseDrafts = (
  block: NocodeEditorAiArtifactBlock,
): NocodeEditorAiConfirmationResponseDraftMap => {
  const panel = editorAiPanelRef.value;
  if (!panel?.getConfirmationResponseDrafts) {
    return {};
  }

  return panel.getConfirmationResponseDrafts(block);
};

const getStageFlowActiveConfirmationInputQuestionIds = (
  block: NocodeEditorAiArtifactBlock,
): string[] => {
  const panel = editorAiPanelRef.value;
  if (!panel?.getActiveConfirmationInputQuestionIds) {
    return [];
  }

  return panel.getActiveConfirmationInputQuestionIds(block);
};

const getStageFlowInlineConfirmationNoteQuestionIds = (
  block: NocodeEditorAiArtifactBlock,
): string[] => {
  const panel = editorAiPanelRef.value;
  if (!panel?.getInlineConfirmationNoteQuestionIds) {
    return [];
  }

  return panel.getInlineConfirmationNoteQuestionIds(block);
};

const canApplyStageFlowArtifact = (
  block: NocodeEditorAiArtifactBlock,
): boolean => {
  const panel = editorAiPanelRef.value;
  if (!panel?.canApplyFlowFromPreview) {
    return false;
  }

  return panel.canApplyFlowFromPreview(block);
};

const isApplyingStageFlowArtifact = (
  block: NocodeEditorAiArtifactBlock,
): boolean => {
  const panel = editorAiPanelRef.value;
  if (!panel?.isApplyingFlowArtifact) {
    return false;
  }

  return panel.isApplyingFlowArtifact(block);
};

const handleSelectStageBlueprintConfirmationOption = (payload: {
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
  option: NocodeEditorAiConfirmQuestionOption
}) => {
  const panel = editorAiPanelRef.value;
  if (!panel?.handleSelectPendingBlueprintConfirmationOption) {
    ElMessage.error(i18next.t('NocodeEditor.blueprintConfirmNotReady'));
    return;
  }

  panel.handleSelectPendingBlueprintConfirmationOption(payload);
};

const handleToggleStageBlueprintInlineConfirmationInput = (payload: {
  item: NocodeEditorAiStageBlueprintDisplayItem
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
}) => {
  const panel = editorAiPanelRef.value;
  if (!panel?.handleTogglePendingBlueprintInlineConfirmationInput) {
    ElMessage.error(i18next.t('NocodeEditor.blueprintConfirmNotReady'));
    return;
  }

  panel.handleTogglePendingBlueprintInlineConfirmationInput(payload);
};

const handleUpdateStageBlueprintInlineConfirmationNote = (payload: {
  item: NocodeEditorAiStageBlueprintDisplayItem
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  const panel = editorAiPanelRef.value;
  if (!panel?.handleUpdatePendingBlueprintInlineConfirmationNote) {
    ElMessage.error(i18next.t('NocodeEditor.blueprintConfirmNotReady'));
    return;
  }

  panel.handleUpdatePendingBlueprintInlineConfirmationNote(payload);
};

const handleSubmitStageBlueprintConfirmationResponses = async (payload: {
  item: NocodeEditorAiStageBlueprintDisplayItem
  block: NocodeEditorAiArtifactBlock
}) => {
  const panel = editorAiPanelRef.value;
  if (!panel?.handleSubmitPendingBlueprintConfirmationResponses) {
    ElMessage.error(i18next.t('NocodeEditor.blueprintConfirmNotReady'));
    return;
  }

  try {
    await panel.handleSubmitPendingBlueprintConfirmationResponses(payload);
  } catch (error) {
    console.error('Submit pending blueprint confirmation failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    ElMessage.error(message || i18next.t('NocodeEditor.submitBlueprintConfirmationFailed'));
  }
};

const handleApplyStageFlow = async (block: NocodeEditorAiArtifactBlock) => {
  const panel = editorAiPanelRef.value;
  if (!panel?.handleApplyFlowFromPreview) {
    ElMessage.error(i18next.t('NocodeEditor.flowApplyNotReady'));
    return;
  }

  try {
    await panel.handleApplyFlowFromPreview(block);
  } catch (error) {
    console.error('Apply staged flow failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    ElMessage.error(message || i18next.t('NocodeEditor.applyFlowFailed'));
  }
};

const handleContinueStageFlowDefaults = async (block: NocodeEditorAiArtifactBlock) => {
  const panel = editorAiPanelRef.value;
  if (!panel?.handleContinueFlowWithDefaults) {
    ElMessage.error(i18next.t('NocodeEditor.flowConfirmNotReady'));
    return;
  }

  try {
    await panel.handleContinueFlowWithDefaults(block);
  } catch (error) {
    console.error('Continue flow with defaults failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    ElMessage.error(message || i18next.t('NocodeEditor.continueWithDefaultFailed'));
  }
};

const handleToggleStageFlowInlineConfirmationInput = (payload: {
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
}) => {
  const panel = editorAiPanelRef.value;
  if (!panel?.handleToggleFlowInlineConfirmationInput) {
    ElMessage.error(i18next.t('NocodeEditor.flowConfirmNotReady'));
    return;
  }

  panel.handleToggleFlowInlineConfirmationInput(payload);
};

const handleUpdateStageFlowInlineConfirmationNote = (payload: {
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  const panel = editorAiPanelRef.value;
  if (!panel?.handleUpdateFlowInlineConfirmationNote) {
    ElMessage.error(i18next.t('NocodeEditor.flowConfirmNotReady'));
    return;
  }

  panel.handleUpdateFlowInlineConfirmationNote(payload);
};

const handleSubmitStageFlowConfirmationResponses = async (block: NocodeEditorAiArtifactBlock) => {
  const panel = editorAiPanelRef.value;
  if (!panel?.handleSubmitFlowConfirmationResponses) {
    ElMessage.error(i18next.t('NocodeEditor.flowConfirmNotReady'));
    return;
  }

  try {
    await panel.handleSubmitFlowConfirmationResponses(block);
  } catch (error) {
    console.error('Submit flow confirmation failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    ElMessage.error(message || i18next.t('NocodeEditor.submitFlowConfirmationFailed'));
  }
};

const handleApplyStageBlueprint = async (item: NocodeEditorAiStageBlueprintDisplayItem) => {
  if (!isStagedBlueprintItem(item) || applyingStageBlueprintId.value) {
    return;
  }

  const panel = editorAiPanelRef.value;
  if (!panel?.applyPendingBlueprint) {
    ElMessage.error(i18next.t('NocodeEditor.blueprintNotReady'));
    return;
  }

  applyingStageBlueprintId.value = item.id;
  try {
    await panel.applyPendingBlueprint(item);
  } catch (error) {
    console.error('Apply pending blueprint failed:', error);
  } finally {
    applyingStageBlueprintId.value = '';
  }
};

const handleApplyStageBlueprintBatch = async (payload: {
  items: NocodeEditorAiStageBlueprintDisplayItem[]
  scope: Exclude<NocodeEditorAiBlueprintApplyScope, 'single'>
}) => {
  if (applyingStageBlueprintId.value) {
    return;
  }

  const pendingItems = payload.items.filter(item => isStagedBlueprintItem(item));
  if (!pendingItems.length) {
    return;
  }

  const panel = editorAiPanelRef.value;
  if (!panel?.applyPendingBlueprintBatch) {
    ElMessage.error(i18next.t('NocodeEditor.batchBlueprintNotReady'));
    return;
  }

  applyingStageBlueprintId.value = 'batch';
  try {
    await panel.applyPendingBlueprintBatch({
      items: pendingItems,
      scope: payload.scope,
    });
  } catch (error) {
    console.error('Apply pending blueprint batch failed:', error);
  } finally {
    applyingStageBlueprintId.value = '';
  }
};

const handleContinueStageBlueprintAdjustment = async (item: NocodeEditorAiStageBlueprintDisplayItem) => {
  if (!isStagedBlueprintItem(item)) {
    return;
  }

  editorAiVisible.value = true;

  const panel = editorAiPanelRef.value;
  if (!panel?.continuePendingBlueprintAdjustment) {
    ElMessage.error(i18next.t('NocodeEditor.blueprintAdjustNotReady'));
    return;
  }

  try {
    await panel.continuePendingBlueprintAdjustment(item);
  } catch (error) {
    console.error('Continue pending blueprint adjustment failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    ElMessage.error(message || i18next.t('NocodeEditor.adjustBlueprintFailed'));
  }
};

const handleOpenGeneratedBlueprintPage = async (payload: NocodeEditorAiGeneratedBlueprintPageTarget) => {
  const panel = editorAiPanelRef.value;
  if (!panel?.openGeneratedBlueprintPage) {
    ElMessage.error(i18next.t('NocodeEditor.cannotOpenGeneratedPage'));
    return;
  }

  try {
    await panel.openGeneratedBlueprintPage(payload);
  } catch (error) {
    console.error('Open generated blueprint page failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    ElMessage.error(message || i18next.t('NocodeEditor.submitBlueprintConfirmationFailed'));
  }
};

const handleAiStageStateChange = (payload: {
  formPlanOutline?: Record<string, unknown> | null
  appPlanOutline?: Record<string, unknown> | null
  blueprint?: NocodeEditorAiAppBlueprint | null
  pendingBlueprints?: NocodeEditorAiStageBlueprintDisplayItem[]
  pendingBlueprintHistory?: NocodeEditorAiStageBlueprintDisplayItem[]
  planningDisplayVersionByContextKey?: Record<string, number>
  flowArtifactBlocks?: NocodeEditorAiArtifactBlock[]
  blueprintDraftPersistenceState?: NocodeEditorAiDraftPersistenceState | null
  blueprintApplying?: boolean
  blueprintLoading?: boolean
  blueprintLoadingMessage?: string
}) => {
  pendingStageBlueprints.value = Array.isArray(payload?.pendingBlueprints) ? payload.pendingBlueprints : [];
  pendingStageBlueprintHistory.value = Array.isArray(payload?.pendingBlueprintHistory) ? payload.pendingBlueprintHistory : [];
  planningDisplayVersionByContextKey.value = payload?.planningDisplayVersionByContextKey || {};
  stageFlowArtifactBlocks.value = Array.isArray(payload?.flowArtifactBlocks) ? payload.flowArtifactBlocks : [];
  stageBlueprintApplying.value = Boolean(payload?.blueprintApplying);
  stageBlueprintLoading.value = Boolean(payload?.blueprintLoading);
  stageBlueprintLoadingMessage.value = String(payload?.blueprintLoadingMessage || '');
  if (Object.prototype.hasOwnProperty.call(payload, 'blueprintDraftPersistenceState')) {
    handleFormDraftPersistenceStateChange(payload.blueprintDraftPersistenceState || null);
  }
  stageViewTab.value = resolveNocodeEditorStageViewTab({
    currentTab: stageViewTab.value,
    hasSolutionOutline: false,
    hasBlueprint: Boolean(stageBlueprintItems.value.length),
    frameLoading: false,
    blueprintLoading: stageBlueprintLoading.value,
  });
};

const handleLocateDraftIssue = async (issue: NocodeEditorAiDraftActionIssue) => {
  try {
    const result = await nocodeEditorAiRuntime.locateDraftIssue(issue);
    if (result.ok) {
      formShellTab.value = 'form-design';
      return;
    }
    ElMessage.warning(result.message || i18next.t('NocodeEditor.locateConfigUnavailable'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ElMessage.error(message || i18next.t('NocodeEditor.locateConfigFailed'));
  }
};

const buildDisplayOnlyDraftPersistenceState = (
  state: NocodeEditorAiDraftPersistenceState | null,
): NocodeEditorAiDraftPersistenceState | null => (
  isDraftPersistenceStateDraftOnly(state) && state?.dirty !== false
    ? {
      ...state,
      dirty: false,
    }
    : state
)

const shouldIgnoreHistoricalBlockingDraftState = (
  state: NocodeEditorAiDraftPersistenceState | null,
) => {
  if (!shouldBlockNavigationForDraftPersistenceState(state)) {
    return false;
  }
  if (Boolean(formCreateRef.value?.hasLocalChanges)) {
    return false;
  }
  const updatedAt = Number(state?.updatedAt || 0);
  return Boolean(
    aiDraftBlockingClearedAt.value
    && updatedAt
    && updatedAt <= aiDraftBlockingClearedAt.value
  );
}

const hasDraftSourceMarker = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => Boolean(state?.sourceBlueprintVersionKey || state?.sourceBlueprintIdentityKey);

const withCurrentDraftSourceForm = (
  state: NocodeEditorAiDraftPersistenceState,
): NocodeEditorAiDraftPersistenceState => ({
  ...state,
  sourceFormId: String(activeFormId.value || state.sourceFormId || '').trim() || undefined,
});

const updateAiDraftSourceState = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => {
  if (!state || !hasDraftSourceMarker(state)) {
    return;
  }
  aiDraftSourceState.value = withCurrentDraftSourceForm(state);
};

const handleFormDraftPersistenceStateChange = (state: NocodeEditorAiDraftPersistenceState | null) => {
  const nextBlockingState = isDraftPersistenceStateDraftOnly(state) ? state : null;
  if (shouldIgnoreHistoricalBlockingDraftState(nextBlockingState)) {
    aiDraftDisplayState.value = buildDisplayOnlyDraftPersistenceState(nextBlockingState);
    aiDraftBlockingState.value = null;
    updateAiDraftSourceState(state);
    aiDraftChanged.value = false;
    return;
  }
  aiDraftBlockingState.value = nextBlockingState;
  updateAiDraftSourceState(state);
  if (aiDraftBlockingState.value) {
    aiDraftDisplayState.value = aiDraftBlockingState.value;
  } else if (isDraftPersistenceStateDraftOnly(aiDraftDisplayState.value) && aiDraftDisplayState.value?.dirty !== false) {
    aiDraftDisplayState.value = {
      ...aiDraftDisplayState.value,
      dirty: false,
    };
  }
  aiDraftChanged.value = Boolean(
    aiDraftBlockingState.value
    && aiDraftBlockingState.value?.dirty !== false
  );
  if (!shouldBlockNavigationForDraftPersistenceState(aiDraftBlockingState.value) && !formCreateRef.value?.hasLocalChanges) {
    aiDraftBlockingClearedAt.value = Date.now();
  }
};

const handleAiFlowIssueStateChange = (state: NocodeEditorAiFlowIssueState | null) => {
  activeAiFlowIssueState.value = state;
};

const liveFlowIssueRuntimeVerdict = computed(() => (
  formCreateRef.value?.flowIssueRuntimeVerdict || null
));

const hasFormTabWarning = computed(() => (
  aiDraftChanged.value
  && Boolean(aiDraftBlockingState.value?.actionIssues?.some(issue => issue.targetKind === 'form_field'))
));

const hasProcessTabWarning = computed(() => (
  Boolean(
    activeAiFlowIssueState.value?.mode === 'flow_issue'
    ||
    (aiDraftChanged.value && aiDraftBlockingState.value?.actionIssues?.some(issue => issue.targetKind === 'process_node'))
    || formCreateRef.value?.currentFlowIssueState?.mode === 'flow_issue'
  )
));

const hasAppUnsavedChanges = computed(() => (
  Boolean(projectEditorRef.value?.projectChanged)
));

const hasBlockingDraftPersistenceState = computed(() => (
  shouldBlockNavigationForDraftPersistenceState(aiDraftBlockingState.value)
));

const hasCurrentEditorWarning = computed(() => (
  hasFormTabWarning.value
  || hasProcessTabWarning.value
  || Boolean(formCreateRef.value?.hasLocalChanges)
  || hasBlockingDraftPersistenceState.value
));

const hasEditorUnsavedChangesForCloseGuard = computed(() => (
  hasAppUnsavedChanges.value
  || Boolean(formCreateRef.value?.hasLocalChanges)
  || hasBlockingDraftPersistenceState.value
));

watch(stageBlueprintItems, () => {
  stageViewTab.value = resolveNocodeEditorStageViewTab({
    currentTab: stageViewTab.value,
    hasSolutionOutline: false,
    hasBlueprint: Boolean(stageBlueprintItems.value.length),
    frameLoading: false,
    blueprintLoading: stageBlueprintLoading.value,
  });
});

const handleFormActiveTabChange = (tab: string) => {
  const shouldPersistFormulaOverlay = defaultFormulaOverlay.visible && formShellTab.value !== tab;
  if (tab === 'form-design' || tab === 'process-setting' || tab === 'data-management') {
    formShellTab.value = tab;
    if (shouldPersistFormulaOverlay) {
      persistAndCloseDefaultFormulaOverlay();
    }
  }
};

const handleFormHeaderTabClick = async (tab: 'form-design' | 'process-setting' | 'data-management') => {
  const currentTab = formShellTab.value;
  if (defaultFormulaOverlay.visible && currentTab !== tab) {
    persistAndCloseDefaultFormulaOverlay();
  }
  const shouldSkipBeforeLeave = currentTab === 'data-management' && tab !== 'data-management';
  const switched = await formCreateRef.value?.switchEditorTab?.(tab, shouldSkipBeforeLeave ? {
    skipBeforeLeave: true,
  } : undefined);
  if (switched) {
    formShellTab.value = tab;
    if (tab === 'form-design') {
      await formCreateRef.value?.restoreDesignValidationErrors?.();
    }
  }
};

const handleFormFieldCatalogClick = async () => {
  const switched = await formCreateRef.value?.switchEditorTab?.('form-design');
  if (switched === false) return;
  formShellTab.value = 'form-design';
  formFieldCatalogVisible.value = !formFieldCatalogVisible.value;
};

const handleFormRecycleClick = async () => {
  const switched = await formCreateRef.value?.switchEditorTab?.('form-design');
  if (switched === false) return;
  formShellTab.value = 'form-design';
  formCreateRef.value?.openRecycleBin?.();
};

const handleFormPropertyClick = async () => {
  const switched = await formCreateRef.value?.switchEditorTab?.('form-design');
  if (switched === false) return;
  formShellTab.value = 'form-design';
  formPropertyPanelVisible.value = !formPropertyPanelVisible.value;
};

const handleAppShellSelect = async () => {
  const exited = await hideFormCreate();
  if (!exited) {
    return;
  }
  await closeNocodeLayer();
  currentActiveId.value = "";
  closeAppSwitcherDropdown();
};

const preventClose = computed(()=>{
  if (hasEditorUnsavedChangesForCloseGuard.value) {
    return true;
  }
  return false;
})
const windowCloseListener = (e) => {
  updateOpeningList('close', nocodeId);

  e.returnValue = i18next.t("reportEditor.saveNotSavedTip");
  return i18next.t("reportEditor.saveNotSavedTip");
};
watch(()=>preventClose.value, (value, prev) => {
    if (prev === value) return;
    if (value) {
      window.addEventListener('beforeunload', windowCloseListener);
    } else {
      window.removeEventListener('beforeunload', windowCloseListener);
    }
});

const deleteConfirmContext = reactive({
  text: "",
  tip: "",
  visible: false,
  confirm: null as Function,
})

const handleDelete = async ()=>{
  const _delete = async () => {
    treeRef.value.remove(contextMenu.node);
    const res = await saveStructure();
    if (contextMenu.node.data.type === NocodeStructureType.FORM) {
      const delTable = formData.value?.tables?.find(table => table.uid === contextMenu.node.data.id);
      handleDeleteTable(delTable)
    } else if (res) {
      ElMessage.success(i18next.t('NocodeEditor.deleteSuccess'));
      if (activeProjectId.value === contextMenu.node.data.id) {
        activeProjectId.value = "";
        openFirstProject()
      }
      handleUpdateNocodeInfo()
    }
  }
  if (contextMenu.node.data.type === NocodeStructureType.GROUP) {
    if (!isEmpty(contextMenu.node?.data?.children)) {
      ElMessage.warning(i18next.t('NocodeEditor.deleteGroupTips'));
      return;
    }
    _delete();
  } else if (contextMenu.node.data.type === NocodeStructureType.FORM) {
    deleteConfirmContext.text = i18next.t('NocodeEditor.confirmDeleteForm')
    deleteConfirmContext.tip = i18next.t('NocodeEditor.deleteFormWarn')
    deleteConfirmContext.visible = true;
    deleteConfirmContext.confirm = _delete;
  }  else {
    deleteConfirmContext.text = i18next.t('NocodeEditor.confirmDeleteDashboard')
    deleteConfirmContext.tip = i18next.t('NocodeEditor.deleteDashboardWarn')
    deleteConfirmContext.visible = true;
    deleteConfirmContext.confirm = _delete;
  }
};

const onDeleteTable = (connection: Connection, table: Table) => {
  deleteConfirmContext.text = i18next.t('NocodeEditor.confirmDeleteForm')
  deleteConfirmContext.tip = i18next.t('NocodeEditor.deleteFormWarn')
  deleteConfirmContext.visible = true;
  deleteConfirmContext.confirm = handleDeleteTable.bind(null, connection, table);
}

// #region 拖拽数据区域高度
const dataAreaHeight = ref(50);
let isMoving = false;
let startY = null;
let containerHeight = null;
const isCollapsed = ref(true);

const handleMoving = (ev: MouseEvent) => {
  if (!isMoving) return;
  let disY = ev.y - startY;
  let height = dataAreaHeight.value - disY / containerHeight * 100;
  if (height >= 70) {
    height = 70;
  } else if (height <= 10) {
    height = 10;
  }
  dataAreaHeight.value = height;
  startY = ev.y;
};
const handleUp = () => {
  isMoving = false;
};
const handleDown = (ev: MouseEvent) => {
  isMoving = true;
  startY = ev.y;
  containerHeight = leftMainContainerRef.value?.clientHeight ?? leftMainContainerRef.value?.$el?.clientHeight;
}

// #endregion


const clientId = unique(32);

const activeFormId = ref("");
watch(activeFormId, (nextActiveFormId) => {
  const sourceFormId = String(aiDraftSourceState.value?.sourceFormId || '').trim();
  if (sourceFormId && sourceFormId !== String(nextActiveFormId || '').trim()) {
    aiDraftSourceState.value = null;
  }

  if (!defaultFormulaOverlay.visible) return;

  const overlayFormId = defaultFormulaOverlay.widget?.topForm?.tableUID?.[1];
  if (overlayFormId && nextActiveFormId && overlayFormId !== nextActiveFormId) {
    persistAndCloseDefaultFormulaOverlay();
  }
});
const showFormCreate = async (table: Table, askSave = true) => {
  isShowDataSourceDialog.value = false;
  if (table.meta?.extra?.primaryTable) return false;

  const currentFormulaOverlayFormId = activeFormId.value || defaultFormulaOverlay.widget?.topForm?.tableUID?.[1];
  if (askSave && defaultFormulaOverlay.visible && (!currentFormulaOverlayFormId || currentFormulaOverlayFormId !== table.uid)) {
    persistAndCloseDefaultFormulaOverlay();
  }

  await loadFormCreate();
  if (!isShowFormCreate.value) {
    await closeNocodeLayer();
    isShowFormCreate.value = true;
  }

  const formCreate = await waitForFormCreateInstance();
  const isCheck = await formCreate.applyForEnterFormMode(formData.value, table, askSave);
  if (!isCheck) {
    if (activeFormId.value !== table.uid) {
      isShowFormCreate.value = false;
    }
    return false;
  }
  isShowFormCreate.value = true;
  currentActiveId.value = table.uid;
  activeFormId.value = table.uid;
  projectEditorRef.value?.activity?.(table);
  return true
}
const normalizeAiGroupToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '');

const findAiGroupNodeByName = (nodes: NocodeStructure[] = [], groupName: string): NocodeStructure | null => {
  const target = normalizeAiGroupToken(groupName);
  if (!target) return null;
  for (const node of nodes) {
    if (node.type === NocodeStructureType.GROUP && normalizeAiGroupToken(node.name) === target) {
      return node;
    }
    const children = Array.isArray(node.children) ? node.children : [];
    const matchedChild = findAiGroupNodeByName(children, groupName);
    if (matchedChild) {
      return matchedChild;
    }
  }
  return null;
}

const findAiGroupNameByFormTableId = (
  nodes: NocodeStructure[] = [],
  tableId: string,
  parentGroupName = '',
): string => {
  const targetTableId = String(tableId || '').trim();
  if (!targetTableId) return '';
  for (const node of nodes) {
    if (!node) continue;
    if (node.type === NocodeStructureType.GROUP) {
      const matched = findAiGroupNameByFormTableId(
        Array.isArray(node.children) ? node.children : [],
        targetTableId,
        String(node.name || '').trim(),
      );
      if (matched) {
        return matched;
      }
      continue;
    }
    if (node.type === NocodeStructureType.FORM && String(node.id || '').trim() === targetTableId) {
      return parentGroupName;
    }
  }
  return '';
}

const ensureAiGroup = async (groupName: string) => {
  const normalizedGroupName = String(groupName || '').trim();
  if (!normalizedGroupName) {
    return {
      ok: true,
      groupId: '',
      groupName: '',
      created: false,
    };
  }

  const existingGroup = findAiGroupNodeByName((treeRef.value?.data as NocodeStructure[]) || structure.value || [], normalizedGroupName);
  if (existingGroup?.id) {
    if (!defaultExpandedKeys.value.includes(existingGroup.id)) {
      defaultExpandedKeys.value.push(existingGroup.id);
    }
    return {
      ok: true,
      groupId: existingGroup.id,
      groupName: existingGroup.name,
      created: false,
    };
  }

  createGoupId.value = '';
  const id = unique();
  insertStructure({
    id,
    name: normalizedGroupName,
    type: NocodeStructureType.GROUP,
    children: [],
  });
  const saved = await saveStructure();
  if (!saved) {
    return {
      ok: false,
      reason: 'create_group_failed',
      groupId: '',
      groupName: normalizedGroupName,
      created: false,
    };
  }
  if (!defaultExpandedKeys.value.includes(id)) {
    defaultExpandedKeys.value.push(id);
  }
  return {
    ok: true,
    groupId: id,
    groupName: normalizedGroupName,
    created: true,
  };
}

const createAiForm = async (input: { tableName?: string; groupName?: string }) => {
  const tableName = String(input?.tableName || '').trim();
  const groupName = String(input?.groupName || '').trim();
  if (!tableName) {
    return {
      ok: false,
      reason: 'table_name_required',
    };
  }

  const targetFormKey = getNocodeEditorBlueprintFormApplyTargetIdentity({
    tableName,
    groupName,
  });
  const existingTable = formData.value?.tables?.find((item) => {
    if (item?.meta?.extra?.primaryTable) {
      return false;
    }
    const existingGroupName = findAiGroupNameByFormTableId(
      (treeRef.value?.data as NocodeStructure[]) || structure.value || [],
      String(item?.uid || '').trim(),
    );
    return getNocodeEditorBlueprintFormApplyTargetIdentity({
      tableName: item.alias,
      groupName: existingGroupName || undefined,
    }) === targetFormKey;
  });
  if (existingTable) {
    if (activeFormId.value === existingTable.uid && isShowFormCreate.value) {
      return {
        ok: true,
        tableId: existingTable.uid,
        tableName: existingTable.alias,
        groupId: parentId.value || '',
        groupName: groupName || '',
        reusedExisting: true,
      };
    }
    const groupResult = await ensureAiGroup(groupName);
    if (!groupResult?.ok) {
      return {
        ok: false,
        reason: groupResult?.reason || 'create_group_failed',
      };
    }
    const opened = await showFormCreate(existingTable, false);
    return {
      ok: opened,
      reason: opened ? '' : 'open_form_failed',
      tableId: existingTable.uid,
      tableName: existingTable.alias,
      groupId: groupResult.groupId || parentId.value || '',
      groupName: groupResult.groupName || groupName,
      reusedExisting: true,
    };
  }

  const groupResult = await ensureAiGroup(groupName);
  if (!groupResult?.ok) {
    return {
      ok: false,
      reason: groupResult?.reason || 'create_group_failed',
    };
  }

  createGoupId.value = groupResult.groupId || parentId.value || '';
  const { formData: newFormData, table } = await formDataApi.addTable({
    formData: formData.value,
    name: tableName,
  });
  const syncedFormData = await handleSyncFormTable(newFormData, table);
  if (!syncedFormData) {
    throw new Error(i18next.t('NocodeEditor.createFormSyncFailed'));
  }

  await createForm(table.uid, table.alias || tableName);
  formCreateRef.value?.syncConnection(syncedFormData);
  const opened = await showFormCreate(table, false);
  if (!opened) {
    return {
      ok: false,
      reason: 'open_form_failed',
      tableId: table.uid,
      tableName: table.alias || tableName,
    };
  }

  return {
    ok: true,
    tableId: table.uid,
    tableName: table.alias || tableName,
    groupId: createGoupId.value || '',
    groupName: groupResult.groupName || groupName,
  };
}
const nocodeEditorAiRuntime = useNocodeEditorAiHostRuntime({
  nocodeId,
  nocode,
  structure,
  settingVisible,
  isShowFormCreate,
  activeFormId,
  currentActiveId,
  activeProjectId,
  aiDraftDirty: aiDraftChanged,
  aiDraftStatus: aiDraftBlockingState,
  aiDraftSourceStatus: aiDraftSourceState,
  formCreateRef,
  projectEditorRef,
  formulaOverlayHost: ref(openDefaultFormulaOverlay),
  formulaOverlayDraftHost: ref(applyDefaultFormulaOverlayDraft),
  getCurrentTaskContext: getCurrentEditorAiTaskContext,
  createForm: createAiForm,
  showFormCreate,
  hideFormCreate: (...args) => hideFormCreate(...args),
  openProject,
  handleSyncConflict: (error) => handleNocodeSyncConflictError(error, nocodeSignIsLatest),
  markAiDraftDirty: (dirty) => {
    aiDraftChanged.value = dirty;
  },
  markAiDraftStatus: (state) => {
    const nextState = isDraftPersistenceStateDraftOnly(state) ? state : null;
    if (shouldIgnoreHistoricalBlockingDraftState(nextState)) {
      aiDraftDisplayState.value = buildDisplayOnlyDraftPersistenceState(nextState);
      aiDraftBlockingState.value = null;
      updateAiDraftSourceState(state);
      aiDraftChanged.value = false;
      return;
    }
    aiDraftDisplayState.value = nextState;
    aiDraftBlockingState.value = nextState;
    updateAiDraftSourceState(state);
    aiDraftChanged.value = Boolean(
      nextState
      && nextState?.dirty !== false
    );
  },
});

const isShowDataSourceDialog =ref(false)
const dataSourceDialogTitle = ref('')
const dataSourceDialogRef = ref();

const showDataSourceViewer = async (connection: NocodeDataSourceConnection, table: Table) => {
  const tableTitle = connection?.uid === formData.value?.uid || !connection?.name
    ? table.alias
    : `${connection.name}-${table.alias}`;
  dataSourceDialogTitle.value = `${tableTitle}${i18next.t('NocodeEditor.dataOf')}`
  isShowDataSourceDialog.value = true;
  nextTick(() => {
    dataSourceDialogRef.value.getTableInfo(connection, table);
  })
}

const hideFormCreate = async (showChangeTip = true) => {
  if (!isShowFormCreate.value) return true;
  persistAndCloseDefaultFormulaOverlay();
  const exited = await formCreateRef.value?.applyForExitFormMode(showChangeTip);
  if (!exited) {
    return false;
  }
  activeFormId.value = "";
  return true;
}
const nocodePreviewVisible = ref(false);
const previewNocodeLayer = () => {
  nocodePreviewVisible.value = true;
}
provide(PREVIEW_NOCODE_LAYER, previewNocodeLayer);

const nocodeFormCopyDialogVisible = ref(false);
const copyTableInfo = ref({
  connection: null as Connection,
  table: null as Table,
});
const hasSubForm = (table: Table) => {
  if (!table) return false;
  return table.fields.some(field => field.meta?.subType === "subForm");
}

const handleCopyPage = async ()=>{
  const originalNode = contextMenu.node.data;
  pageName.value = originalNode.name
  copyType.value = 'page'
  nocodeFormCopyDialogVisible.value = true;
}

const handleCopyTable = async (connection: Connection, table: Table) => {
  copyTableInfo.value = { connection, table };
  copyType.value = 'form'
  nocodeFormCopyDialogVisible.value = true;
}

const handleRenameTable = async (status) => {
  await saveNocodeConnections();
  if (status === 'success') {
    ElMessage.success(i18next.t('NocodeEditor.dataFormNameUpdateSuccess'))
  } else {
    ElMessage.error(i18next.t('NocodeEditor.dataFormNameUpdateFail'))
  }
}

// 复制看板
const handleCopyPageConfirm = async (pageName: string) => { 
  const originalNode = contextMenu.node.data;
  structureSaving.value = true;
  try {
  
  // 创建新的节点结构
  const newNode = {
    id: unique(), // 生成新的唯一ID
    name: pageName, // 复制后的新名称
    type: originalNode.type,
  };

  // 将新节点添加到与原节点同级的位置
  treeRef.value.insertAfter(newNode, contextMenu.node);
  
  structure.value = treeRef.value.data as NocodeStructure[];

  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;

  const res = await axios.post('/project/copy-page', {
    nocodeId: nocodeId,
    sourcePageId: originalNode.id,
    copyPageId: newNode.id,
    structure: structure.value,
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
  if(res) {
    nocode?.value?.pageBodies?.push(res?.data?.pageBody);
    const mainSign = Array.isArray(res.headers?.['x-sign']) ? res.headers['x-sign'][0] : res.headers?.['x-sign'];
    if (mainSign) {
      handleUpdateNocodeSign(mainSign);
    }
    ElMessage.success(i18next.t('NocodeEditor.copySuccess'));
  }
  } finally {
    structureSaving.value = false;
  }
}

// 复制表单
const handleCopyTableConfirm = async (tableName: string) => {
  const originalNode = contextMenu.node.data;
  structureSaving.value = true;
  try {
  
  const res = await axios.post('/form-data/copy-table', {
    nocodeId: nocodeId,
    sourceFormId: originalNode.id,
    copyName: tableName,
  }).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
  });
  if(res) {
    nocode.value.body.formData = res.data.formData;
    await saveNocodeConnections();
    ElMessage.success(i18next.t('NocodeEditor.copySuccess'));

    // 构建structure
    // 创建新的节点结构
    const newNode = {
      id: res.data.table.uid,
      name: tableName, // 复制后的新名称
      type: originalNode.type,
    };
    // 将新节点添加到与原节点同级的位置
    treeRef.value.insertAfter(newNode, contextMenu.node);
    await saveStructure(false);

    formCreateRef.value?.syncConnection?.(formData.value);
  }
  } finally {
    structureSaving.value = false;
  }
}

const handleSyncFormTable = async (
  formData: NocodeFormData,
  table: Table,
  save = true,
  options: { preserveAiDraftState?: boolean; beforeWrite?: () => void } = {},
) => {
  const syncNocodeId = resolvedNocodeId.value;
  const data = await formDataApi.sync({
    formData,
    nocodeId: syncNocodeId,
    tableUIDs: [table.uid],
  });
  if (!data) return;
  options.beforeWrite?.();
  const index = formData.tables.findIndex(t => t.uid === table.uid);
  if (index >= 0 && data.tables[0]) {
    const hadTitleField = formData.tables[index]?.fields?.some(field => field.meta?.name === SystemField.DATA_TITLE);
    const titleField = data.tables[0].fields?.find(field => field.meta?.name === SystemField.DATA_TITLE);
    formData.tables[index] = data.tables[0];
    if (!hadTitleField && titleField) {
      formData.metas = formData.metas || {};
      formData.metas[table.uid] = {
        ...(formData.metas[table.uid] || {}),
        hiddenColumns: Array.from(new Set([
          ...(formData.metas[table.uid]?.hiddenColumns || []),
          titleField.uid,
        ])),
      };
    }
  }

  nocode.value.body.formData = formData;
  if (save) {
    const saved = await saveNocodeConnections({
      preserveAiDraftState: options.preserveAiDraftState,
      beforeWrite: options.beforeWrite,
    });
    if (!saved) {
      return undefined;
    }
  }
  return formData;
}
provide(HANDLE_SYNC_FORM_TABLE, handleSyncFormTable);
provide('nocode-editor-ai-draft-dirty', aiDraftChanged);
provide('nocode-editor-ai-draft-status', aiDraftBlockingState);
const handleSaveFormData = async (_formData: NocodeFormData, _table: Table, noMessage?: boolean) => {
  const syncedFormData = await handleSyncFormTable(_formData, _table);
  if (!syncedFormData) {
    return false;
  }
  if (!noMessage) ElMessage.success(i18next.t("reportEditor.saveSuccess"));
  return true;
}

const handleExitFormMode = (clean: boolean) => {
  persistAndCloseDefaultFormulaOverlay();
  isShowFormCreate.value = false;
  if (clean) {
    currentActiveId.value = "";
    activeProjectId.value = "";
  }
}
const saveNocodeSettings = async () => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;

  const res = await axios.post("/project/save-nocode-settings", {
    nocodeId: resolvedNocodeId.value,
    themeColor: themeColor.value,
    theme: nocodeTheme.value,
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).then(({ headers }) => {
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      handleUpdateNocodeSign(mainSign);
    }
    aiWarmupActivityReporter?.report('save');
    aiDraftChanged.value = false;
    aiDraftDisplayState.value = null;
    aiDraftBlockingState.value = null;
    aiDraftSourceState.value = null;
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
}
const saveNocodeConnections = async (options: { preserveAiDraftState?: boolean; beforeWrite?: () => void } = {}) => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return false;

  return await saveWithRelationContextDegradation({
    saveMain: () => axios.post("/project/save-nocode-connections", {
      nocodeId: resolvedNocodeId.value,
      connections: toRaw(nocode.value.body.connections),
      formData: toRaw(nocode.value.body.formData),
    }, {
      headers: {
        'x-sign': nocode.value.body.sign,
      },
    }),
    applyMainSideEffects: ({ headers }) => {
      options.beforeWrite?.();
      const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
      if (mainSign) {
        handleUpdateNocodeSign(mainSign);
      }
      aiWarmupActivityReporter?.report('save');
      if (!options.preserveAiDraftState) {
        aiDraftChanged.value = false;
        aiDraftDisplayState.value = null;
        aiDraftBlockingState.value = null;
        aiDraftSourceState.value = null;
      }
    },
    syncRelationContext: syncRelationContextFromCurrentApp,
    observeRelationContextError: (error) => {
      console.error('Sync relation context after saving nocode connections failed:', error);
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
    return false;
  });
}
const handleUpdateTables = async (tables: Table[]) => { 
  if (formData.value && !isEmpty(tables)) {
    for (const table of tables) {
      const index = formData.value.tables.findIndex(t => t.uid === table.uid);
      if (index >= 0) {
        formData.value.tables[index] = table;
      }
    }
  }
}

// const saveNocode = async () => {
//   await saveNocodeConnections().then(() => {
//     ElMessage.success(i18next.t("nocodeEditor.saveSuccess"));
//   });
// }

const isRefreshing = ref(false);
const refreshData = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  // await getConnectionData();
  isRefreshing.value = false;
  ElMessage.success(i18next.t("reportEditor.dataRefreshSuccess"));
}

// #endregion

const isDisable = (node: Node) => {
  if (!node || node?.level === 0) return false;
  if (node.data.disable) return true;
  return isDisable(node.parent);
}

const handleVisibleClick = async (node: Node) => {
  if (isDisable(node.parent)) return;
  node.data.disable = !node.data.disable;
  await saveStructure();
}


const handleAddEmbeddedData = () => {
  showCreateDataDialog();
}

const handleCreateDataClosed = () => {
  createDataDefaultGroupId.value = '';
  createDataGroupLocked.value = false;
  dialogState.nocodeCreateDataDialogVisible = false;
}

const createDataDefaultGroupId = ref('')
const createDataGroupLocked = ref(false)
const createGoupId = ref('')
const createFormData = (data) => {
  const {name, group} = data
  createGoupId.value = group
  handleCreateDataConfirmed(name)
}

const handleCreateDataConfirmed = async (tableName: string) => {
  const { formData: newFormData, table } = await formDataApi.addTable({
    formData: formData.value,
    name: tableName,
  });
  const syncedFormData = await handleSyncFormTable(newFormData, table);
  if (!syncedFormData) {
    return;
  }
  ElMessage.success(i18next.t('NocodeEditor.addSuccess'));
  await createForm(formData.value.tables?.at(-1).uid, tableName)
  formCreateRef.value?.syncConnection?.(syncedFormData);
  // 进入表单模式
  showFormCreate(formData.value.tables?.at(-1));
  dialogState.nocodeCreateDataDialogVisible = false;
}

const handleCreateForm = async (
  tableName: string,
  columns: TableColumn[],
  subformColumns: Record<string, TableColumn[]>,
  callback: (formData: NocodeFormData, table: Table) => void,
  group
) => {
  createGoupId.value = group
  let newFormData: NocodeFormData, table: Table;
  try {
    // 创建表单
    ({ formData: newFormData, table } = await formDataApi.addTable({
      formData: formData.value,
      name: tableName,
    }));
    const uuidField = getUUIDSystemField(table.fields);

    for (const colUid in subformColumns) {
    // 创建表单
      const formColumn = columns.find(col => col.uid === colUid);
      let subtable: Table;
      const sbCols = subformColumns[colUid];
      sbCols.unshift({
        name: SystemField.KEY,
        uid: uuidField.meta.uid,
        type: "string",
      });
      ({ formData: newFormData, table: subtable } = await formDataApi.addTable({
        formData: newFormData,
        name: `${table.alias}--${i18next.t('NocodeEditor.subForm')}(${formColumn?.alias}-${formColumn?.uid})`,
        extra: { primaryTable: [newFormData.uid, table.uid] } as any,
      }));
      newFormData = await formDataApi.syncTableColumns({
        formData: newFormData,
        tableUID: subtable.uid,
        columns: sbCols,
      });
      newFormData = await handleSyncFormTable(newFormData, subtable);
      if (!newFormData) {
        return;
      }

      // 父表对应字段关联子表单
      if (formColumn) {
        formColumn.extra.subTableUID = [newFormData.uid, subtable.uid];
        formColumn.extra.subColumns = sbCols;
      };
    }

    newFormData = await formDataApi.syncTableColumns({
      formData: newFormData,
      tableUID: table.uid,
      columns: columns,
    })
    newFormData = await handleSyncFormTable(newFormData, table);
    if (!newFormData) {
      return;
    }
    ElMessage.success(i18next.t('NocodeEditor.addSuccess'));

    // 进入表单模式
    await createForm(table.uid, tableName);
    await showFormCreate(table);
    dialogState.nocodeCreateDataDialogVisible = false;

    // 自动触发FormCreate中的save函数
    // 确保在formCreateRef完全初始化后再调用save
    await nextTick();
    if (formCreateRef.value) {
      const result = await formCreateRef.value.save(true);
      if (result === 'blocked' || result === 'failed' || result === false) {
        newFormData = undefined;
        return;
      }
    }
  } finally {
    // 确保无论成功还是失败都调用回调函数
    if (callback && newFormData && table) callback(newFormData, table);
  }
}

const handleDeleteTable = async (table: Table, options: { beforeWrite?: () => void } = {}) => {
  const _formData = await formDataApi.deleteTable({
    nocodeId,
    formData: formData.value,
    table,
  })
  if (!_formData) return;
  options.beforeWrite?.();
  nocode.value.body.formData = _formData;
  const saved = await saveNocodeConnections({
    beforeWrite: options.beforeWrite,
  });
  if (!saved) {
    return;
  }
  formCreateRef.value?.syncConnection?.(_formData);
  if (isShowFormCreate.value && activeFormId.value === table.uid) {
    await hideFormCreate(false);
    openFirstProject();
  }
  ElMessage.success(i18next.t('NocodeEditor.deleteSuccess'));
}
provide(HANDLE_DELETE_TABLE, handleDeleteTable);

const createForm = async (tableUid: string, tableName: string) => {
  insertStructure({
    id: tableUid,
    name: tableName,
    type: NocodeStructureType.FORM,
  });
  const res = await saveStructure();
  if (res) {
    await expandTreeToNode(tableUid);
  }
}

const handleMenuClicked = async (type: string) => {
  if (type === 'refresh') {
    await refreshData();
  } else if (type === 'setting') {
    console.log('setting');
  } else if (type === 'add-page') {
    showNocodeCreateDialog();
  } else if (type === 'add-folder') {
    showFolderCreateDialog();
  } else if (type === 'add-form') {
    showCreateDataDialog();
  } else if (type === "preview") {
    if (previewDrawerMode.value === 'form') {
      await formCreateRef.value?.preview?.();
      return;
    }
    if (previewDrawerMode.value === 'board') {
      await projectEditorRef.value?.previewPage?.();
      return;
    }
  }
}

const handleQuickCreate = (type: 'add-form' | 'add-page' | 'add-folder') => {
  headerCreateDropdownRef.value?.handleClose?.();
  void handleMenuClicked(type);
}

const handleSaveFromHeader = async () => {
  if (editorSelectionType.value === 'form') {
    await formCreateRef.value?.save?.();
    return;
  }

  if (editorSelectionType.value === 'board') {
    await projectEditorRef.value?.saveProject?.();
  }
}

const importExcelDialogVisible = ref<boolean>(false);
const importExcelDialogRef = ref<ImportExcelDialogHandle | null>(null)
const importExcelDialogMode = ref<'default' | 'analysis'>('default')
const activeExcelCreateContext = ref<{
  attachmentId?: string
  sourceInstance?: AiExcelImportSourceInstance | null
  shouldAppendReply: boolean
} | null>(null)
const pendingExcelAnalysisRequest = ref<{
  visibleUserContent: string
  requestMetadata?: Record<string, unknown>
} | null>(null)

async function prepareExcelCreatePayload(data?: StartExcelFormCreatePayload) {
  if (!data?.fullPath) {
    return data
  }

  const importSourcePath = String(data.originFilePath || '').trim()
  if (!importSourcePath) {
    return data
  }

  try {
    const response = await axios.post('/nocode/create-import-session-from-path', {
      fullPath: importSourcePath,
      filename: String(data.name || '').trim() || undefined,
    })
    const fullPath = String(response?.data?.data?.fullPath || '').trim()
    if (!fullPath) {
      ElMessage.warning(i18next.t('NocodeEditor.fileExpiredUploadAgain'))
      return null
    }

    return {
      ...data,
      fullPath,
      sessionId: String(response?.data?.data?.sessionId || '').trim() || undefined,
      originFilePath: String(response?.data?.data?.originFilePath || importSourcePath).trim() || undefined,
    }
  } catch (error) {
    ElMessage.error(String(error?.response?.data?.message || error?.message || i18next.t('NocodeEditor.prepareExcelFailed')))
    return null
  }
}

async function showImportExcelDialog(data?: StartExcelFormCreatePayload){
  importExcelDialogMode.value = 'default'
  activeExcelCreateContext.value = {
    attachmentId: String(data?.attachmentId || '').trim() || undefined,
    sourceInstance: resolveAiExcelImportSourceInstance(data),
    shouldAppendReply: Boolean(data?.fullPath),
  }
  importExcelDialogRef.value?.setFormInfo(data?.formName || data?.name, data?.group ?? createDataDefaultGroupId.value)
  createDataDefaultGroupId.value = '';
  importExcelDialogVisible.value = true;
  if (data?.fullPath) {
    const preparedPayload = await prepareExcelCreatePayload(data)
    if (!preparedPayload?.fullPath) {
      activeExcelCreateContext.value = null
      return
    }
    if (activeExcelCreateContext.value) {
      activeExcelCreateContext.value = {
        ...activeExcelCreateContext.value,
        sourceInstance: resolveAiExcelImportSourceInstance(preparedPayload),
      }
    }
    await nextTick()
    await importExcelDialogRef.value?.prefillUploadedExcel?.(preparedPayload)
  }
}

async function showExcelAnalysisDialog(data?: StartExcelFileAnalysisPayload){
  importExcelDialogMode.value = 'analysis'
  pendingExcelAnalysisRequest.value = {
    visibleUserContent: String(data?.visibleUserContent || '').trim() || (
      String(data?.name || '').trim()
        ? i18next.t('NocodeEditor.analyzeExcelWithName', { name: data?.name })
        : i18next.t('NocodeEditor.analyzeExcel')
    ),
    requestMetadata: data?.requestMetadata || (
      data?.name
        ? { uploadedFileName: data.name }
        : undefined
    ),
  }
  importExcelDialogRef.value?.setFormInfo(data?.name, '')
  importExcelDialogVisible.value = true
  if (data?.fullPath) {
    await nextTick()
    await importExcelDialogRef.value?.prefillUploadedExcel?.(data)
  }
}

async function handleExcelAnalysisConfirmed(payload: AiExcelAnalysisConfirmPayload){
  const request = pendingExcelAnalysisRequest.value || {
    visibleUserContent: i18next.t('NocodeEditor.analyzeExcel'),
  }
  pendingExcelAnalysisRequest.value = null
  await editorAiPanelRef.value?.submitExcelFileAnalysis?.(
    payload,
    request.visibleUserContent,
    request.requestMetadata,
  )
}

async function handleExcelCreateCompleted(payload: ExcelCreateCompletedPayload){
  await nextTick()
  const finalization = await finalizeExcelCreatedFormState({
    completedFormId: payload.tableId,
    currentFormId: activeFormId.value,
    hasLocalChanges: () => Boolean(formCreateRef.value?.hasLocalChanges),
    save: async () => await formCreateRef.value?.save(true, true) ?? false,
  })
  if (finalization.status === 'failed') {
    ElMessage.warning('表单和数据已创建，但当前表单状态未能自动保存，请先手动保存后再继续。')
  }

  if (!activeExcelCreateContext.value?.shouldAppendReply) {
    return
  }

  await editorAiPanelRef.value?.appendExcelCreateCompletionReply?.({
    ...payload,
    attachmentId: isSameAiExcelImportSourceInstance(
      payload.sourceInstance,
      activeExcelCreateContext.value?.sourceInstance
    ) ? activeExcelCreateContext.value?.attachmentId : undefined,
  })
  activeExcelCreateContext.value = null
}

function closeImportExcelDialog(){
  importExcelDialogVisible.value = false;
  importExcelDialogMode.value = 'default'
  activeExcelCreateContext.value = null
  pendingExcelAnalysisRequest.value = null
  createDataDefaultGroupId.value = '';
  createDataGroupLocked.value = false;
}

function showCreateDataDialog(groupId = '', lockGroupSelection = false){
  const targetGroupId = typeof groupId === 'string' ? groupId : '';
  createDataDefaultGroupId.value = targetGroupId || '';
  createDataGroupLocked.value = !!targetGroupId && lockGroupSelection;
  dialogState.show('nocodeCreateDataDialogVisible');
}

function showFolderCreateDialog(groupId = '', lockGroupSelection = false){
  const targetGroupId = typeof groupId === 'string' ? groupId : '';
  nocodeFolderCreateDialogRef?.value.show(targetGroupId || 'none', !!targetGroupId && lockGroupSelection);
}

function showNocodeCreateDialog(groupId = '', lockGroupSelection = false){
  const targetGroupId = typeof groupId === 'string' ? groupId : '';
  nocodeCreateDialogRef?.value.show(targetGroupId || 'none', !!targetGroupId && lockGroupSelection);
}

const closeNocodeLayer = async () => {
  await checkProjectSave();
  currentActiveId.value = "";
  activeProjectId.value = "";
}

const activeFieldOption = ref<FieldOptionContext>({});
const allFieldOptionContexts = ref<Record<string, Record<string, FieldOptionContext>>>({});
const fieldOptionContexts = computed(() => allFieldOptionContexts.value[activeProjectId.value] || {});

// whenever(and(or(Meta_S, Ctrl_S)), saveNocode);
provide(ACTIVE_FIELD_OPTION, activeFieldOption);
provide(FIELD_OPTION_CONTEXTS, fieldOptionContexts);
provide(ALL_FIELD_OPTION_CONTEXTS, allFieldOptionContexts);

provide(PROJECT_PARAMS, computed(() => ({}))); // TODO 参数
provide(NOCODE, nocode);
provide(EDIT_PROJECT_MODULE, editProjectModule);
provide(CLOSE_NOCODE, () => closeNocode(nocodeId));
provide(CLOSE_NOCODE_LAYER, closeNocodeLayer);
provide('nocode-editor-default-formula-overlay-host', openDefaultFormulaOverlay);
provide('nocode-editor-ai-setting-context-host', {
  getCurrentTaskContext: getCurrentEditorAiTaskContext,
  getCurrentSettingTargetContext: getCurrentEditorAiSettingTargetContext,
  getCurrentSettingContext: getCurrentEditorAiSettingContext,
});

let validSyncTimer: ReturnType<typeof setInterval> | null = null;
let mainJsonSaveRequestInterceptorId: number | null = null;
let mainJsonSaveResponseInterceptorId: number | null = null;
const mainJsonSavingTokenKey = '__mainJsonSavingToken';
const isSavingMainJson = ref(new Set<symbol>());

const clearValidSyncTimer = () => {
  if (!validSyncTimer) return;

  clearInterval(validSyncTimer);
  validSyncTimer = null;
};

const validateNocodeSync = async () => {
  if (!resolvedNocodeId.value || !nocode.value?.body?.sign) return;
  if (isSavingMainJson.value.size) return;

  const requestSign = nocode.value.body.sign;

  axios.post("/project/validate-sync", {
    nocodeId: resolvedNocodeId.value,
  }, {
    headers: {
      'x-sign': requestSign,
    },
  }).then(async ({data}) => {
    if (requestSign !== nocode.value?.body?.sign) return;
    if (isSavingMainJson.value.size) return;

    nocodeSignIsLatest.value = data;

    if (!data) {
      showNocodeSyncConflictMessage();
      clearValidSyncTimer();
    }
  }).catch(err => {
    if (requestSign !== nocode.value?.body?.sign) return;
    if (isSavingMainJson.value.size) return;

    ElMessage.error(err.message);
  });
};

const startValidSyncTimer = () => {
  clearValidSyncTimer();
  if (isSavingMainJson.value.size) return;
  validSyncTimer = setInterval(validateNocodeSync, 60 * 1000);
};

const handleEditorBeforeUnload = () => {
  isSavingMainJson.value.clear();
  updateOpeningList('close', nocodeId);
  clearValidSyncTimer();
};

onMounted(() => {
  aiWarmupActivityReporter?.report('editor');
  void loadAppliedBlueprints();
  mainJsonSaveRequestInterceptorId = axios.interceptors.request.use((config) => {
    const headers = config?.headers;
    const sign = typeof headers?.get === 'function' ? (headers as any).get('x-sign') : headers?.['x-sign'];
    const method = String(config?.method || 'get').toLowerCase();
    const url = String(config?.url || '');

    if (sign && method !== 'get' && !url.includes('validate-sync')) {
      const mainJsonSavingToken = Symbol(url || 'main-json-save');
      (config as any)[mainJsonSavingTokenKey] = mainJsonSavingToken;
      isSavingMainJson.value.add(mainJsonSavingToken);
      clearValidSyncTimer();
    }

    return config;
  });
  mainJsonSaveResponseInterceptorId = axios.interceptors.response.use((response) => {
    const mainJsonSavingToken = (response.config as any)?.[mainJsonSavingTokenKey] as symbol | undefined;

    if (mainJsonSavingToken) {
      isSavingMainJson.value.delete(mainJsonSavingToken);
      if (!isSavingMainJson.value.size) {
        startValidSyncTimer();
      }
    }

    return response;
  }, (error) => {
    const config = error?.response?.config ?? error?.config;
    const mainJsonSavingToken = (config as any)?.[mainJsonSavingTokenKey] as symbol | undefined;

    if (mainJsonSavingToken) {
      isSavingMainJson.value.delete(mainJsonSavingToken);
      if (!isSavingMainJson.value.size) {
        startValidSyncTimer();
      }
    }

    return Promise.reject(error);
  });

  startValidSyncTimer();

  window.addEventListener('beforeunload', handleEditorBeforeUnload);
});

onBeforeUnmount(() => {
  clearValidSyncTimer();
  isSavingMainJson.value.clear();

  if (mainJsonSaveRequestInterceptorId !== null) {
    axios.interceptors.request.eject(mainJsonSaveRequestInterceptorId);
    mainJsonSaveRequestInterceptorId = null;
  }

  if (mainJsonSaveResponseInterceptorId !== null) {
    axios.interceptors.response.eject(mainJsonSaveResponseInterceptorId);
    mainJsonSaveResponseInterceptorId = null;
  }

  window.removeEventListener('beforeunload', handleEditorBeforeUnload);
});
watch(() => [structure.value, searchValue.value], () => {
  searchNocodeTree();
}, { deep: true });
watchEffect(() => {
  if ((activeProjectId.value !== currentActiveId.value || (!activeProjectId.value && !currentActiveId.value)) && activeStack.value === StackTab.LAYER) {
    activeStack.value = StackTab.PAGE;
  }
})
const setActiveProject = (projectId: string)=>{
  activeProjectId.value = projectId;
}

const renameNocode = (id: string, name: string) => {
  if(!id){
    return;
  }
  nocode.value.meta.name = name;
  handleNocodeRenamed(id, name);
}

const parentOption = computed(() => {
  const getParent = (data) => {
    const result = []
    for(const item of data) {
      if(item.type === 'group') {
        result.push({
          label: item.name,
          value: item.id
        })

        result.push(...getParent(item.children || []))
      }
    }
    return result
  }
  return getParent(structure.value || [])
})

const canContinueAfterFormalSave = (result: unknown) => (
  result !== false
  && result !== 'blocked'
  && result !== 'failed'
)

const getActiveDraftPersistenceState = () => {
  if (shouldBlockNavigationForDraftPersistenceState(aiDraftBlockingState.value)) {
    return aiDraftBlockingState.value;
  }
  return null;
}

const confirmSettingDrawerLeave = async () => {
  const result = await nocodeViewSettingRef.value?.confirmLeave?.();
  return result !== false;
}

const handleSettingDrawerBeforeClose = async (done: () => void) => {
  if (await confirmSettingDrawerLeave()) done();
}

const handleSettingDrawerClose = async () => {
  if (await confirmSettingDrawerLeave()) settingVisible.value = false;
}

const handleOpenSettingDrawer = async (settingTab?: SettingTab) => {
  const activeDraftState = getActiveDraftPersistenceState();
  if (settingTab === SettingTab.PUBLISH && activeDraftState) {
    ElMessage.warning(activeDraftState.summary || i18next.t('NocodeEditor.completeDraftBeforePublish'));
    return;
  }
  if (settingTab === SettingTab.PUBLISH && formCreateRef.value?.save) {
    const result = await formCreateRef.value.save(true);
    if (!canContinueAfterFormalSave(result)) {
      return;
    }
  }
  settingVisible.value = true;

  if (settingTab === undefined) return;

  await nextTick();
  nocodeViewSettingRef.value?.switchTab(settingTab);
}

const handlePublishSettingPublished = () => {
  aiWarmupActivityReporter?.report('publish');
}

const handleUpdateNocodeSign = (sign) => {
  nocode.value.body.sign = sign;
  nocodeSignIsLatest.value = true;
  closeNocodeSyncConflictMessage();
}
provide(UPDATE_NOCODE_SIGN, handleUpdateNocodeSign);
</script>

<style lang="scss" scoped>
.nocode-editor-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 1200px;

  :deep(.setting-drawer-body) {
    padding: 0px;
  }
}
.nocode-editor {
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background-color: #f2f3f5;

  :deep(.nocode-editor-ai-sidebar) {
    width: 400px;
    flex: 0 0 400px;
    min-width: 400px;
    height: 100%;
    background-color: #fff;
    border-radius: 8px;
    border: 1px solid #e5e6eb;
    overflow: hidden;
  }
}

.nocode-editor-header {
  position: relative;
  z-index: 2;
  height: 52px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e6eb;
  background-color: #fff;

  .header-left,
  .header-center,
  .header-right {
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .header-left {
    flex: 1;
    gap: 4px;
  }

  .header-right {
    flex: 1;
    gap: 8px;
  }

  .header-center {
    justify-content: center;
    flex: none;
  }

  .header-right {
    justify-content: flex-end;
  }

  .header-icon-button {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    color: #4e5969;
  }

  .header-divider {
    width: 1px;
    height: 12px;
    background-color: #e5e6eb;
  }

  .app-switcher {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 4px;
    max-width: min(360px, calc(100% - 44px));
  }

  .app-switcher__dropdown {
    min-width: 0;
    display: flex;
    max-width: 100%;
  }

  .app-switcher__dropdown--current {
    flex: 1 1 auto;
  }

  .app-switcher-trigger {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-width: 0;
    gap: 4px;
    padding: 4px 6px 4px 8px;
    border: none;
    background: transparent;
    appearance: none;
    font: inherit;
    text-align: left;
    border-radius: 4px;
    cursor: pointer;
    max-width: min(360px, 100%);
    transition: background-color 0.18s ease;

    &:hover,
    &.is-open {
      background-color: #f2f3f5;
    }

    .app-switcher-trigger__app-name,
    .app-switcher-trigger__current-name {
      display: block;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .app-switcher-trigger__title-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      min-width: 0;
      max-width: 100%;
    }

    .app-switcher-trigger__app-name {
      max-width: min(144px, 100%);
      color: #86909c;
      font-size: 16px;
      line-height: 24px;
    }

    .app-switcher-trigger__crumb-arrow {
      flex-shrink: 0;
      color: #c9cdd4;
    }

    .app-switcher-trigger__current {
      min-width: 0;
      max-width: 100%;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #1d2129;
    }

    .app-switcher-trigger__current-name {
      max-width: min(188px, 100%);
      color: #1d2129;
      font-size: 16px;
      line-height: 24px;
      font-weight: 400;
    }

    .app-switcher-trigger__current-arrow,
    .app-switcher-trigger__app-arrow {
      color: #86909c;
      flex-shrink: 0;
      transition: transform 0.18s ease;
    }

    .app-switcher-trigger__warning-dot {
      position: absolute;
      right: -8px;
      top: 1px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #fa8c16;
      box-shadow: 0 0 0 2px #fff;
    }

    &.is-app-shell {
      .app-switcher-trigger__app-name {
        color: #1d2129;
        font-weight: 400;
      }
    }

    &.is-open {
      .app-switcher-trigger__current-arrow,
      .app-switcher-trigger__app-arrow {
        transform: rotate(180deg);
      }
    }
  }

  .app-switcher-trigger--app-link {
    flex-shrink: 1;
  }

  .app-switcher-trigger--current-only {
    max-width: 100%;
  }

  .app-switcher-trigger__crumb-arrow--static {
    pointer-events: none;
  }

  .header-mode-switch {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border-radius: 16px;
    padding: 3px;
    background-color: #f2f3f5;

    .mode-item {
      border: none;
      background: transparent;
      height: 28px;
      padding: 0 10px;
      border-radius: 16px;
      color: #86909c;
      font-size: 14px;
      line-height: 22px;
      cursor: pointer;
      transition: background-color 0.18s ease, color 0.18s ease;

      &:hover:not(.is-active) {
        color: #1d2129;
        background-color: #ffffff;
      }

      &.is-active {
        color: #1d2129;
        background-color: #fff;
      }

      .mode-item__label {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .mode-item__warning-dot {
        position: absolute;
        right: -10px;
        top: 1px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #fa8c16;
        box-shadow: 0 0 0 2px #fff;
      }
    }
  }

  .header-action {
    min-width: 56px;
    height: 28px;
    border-radius: 4px;
    border-color: #e5e6eb;
    color: #1d2129;
    background-color: #f2f3f5;

    &:hover {
      background-color: var(--el-fill-color-light); 
    }

    &.icon {
      min-width: 32px;
      width: 32px;
      padding: 0;
    }

    &.publish {
      background-color: #52c41a;
      border-color: #52c41a;
      color: #fff;
    }
  }
}

.nocode-editor-main {
  flex: 1;
  min-height: 0;
  padding: 0;
  background-color: #f2f3f5;
}

.nocode-main-layout {
  width: 100%;
  height: 100%;
  min-width: 0;
  display: flex;
  gap: 12px;
}

.nocode-ai-panel-wrap {
  width: 400px;
  flex: 0 0 400px;
  min-width: 400px;
  height: 100%;
  overflow: hidden;

  &.hidden {
    width: 0;
    min-width: 0;
    flex-basis: 0;
  }
}

.nocode-main-stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.nocode-aside-content {
  &:hover {
    .fold-button {
      display: flex !important;
    }
  }
}
.nocode-aside{
  font-size: 12px;
  color: var(--text-color-primary);
  text-indent: 4px;
  background-color: var(--bg-color-page);
  height: 100%;
  line-height: 38px;
  position: relative;
  border-left: 1px solid var(--border-color-light);

  .toolbar{
    width: 100%;
    display: flex;
    align-items: center;
    top: 0;
    left: 0;
    z-index: 9;
    padding: 0 12px;
    border-bottom: 1px solid var(--border-color-light);

    .toolbar-content {
      width: 100%;
      height: 38px;
      display: flex;
      align-items: center;

      .content-left {
        display: flex;
        flex: auto;
        align-items: center;
        min-width: 0px;

        .back-button {
          padding: 0;
          width: 32px;
          min-width: 32px;
          border-radius: 4px;
        }

        .content-left-dropdown {
          height: 24px;
          .content {
            display: flex;
            align-items: center;
            justify-content: center;
            column-gap: 4px;
            cursor: pointer;
            padding: 0 4px;

            &:hover,
            &[aria-expanded=true] {
              background-color: var(--bg-color-overlay);
            }
          }
        }

        .content-left-title {
          display: flex;
          align-items: center;
          min-width: 0px;
          padding-right: 2px;
          font-size: 16px;
          color: var(--text-color-regular);

          .title-name {
            display: block;
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
          }

          .title-icon {
            margin-left: 5px;
            cursor: pointer;
          }
        }
      }

      .fold-button {
        padding: 0;
        width: 32px;
        border-radius: 4px;
        display: none;
      }

      .content-right {
        display: flex;
        flex: none;
        align-items: center;
        column-gap: 4px;

        .publish {
          width: 48px;
          height: 24px;
          border-radius: 2px;
        }
      }
    }
  }
  .left-main-container {
    height: calc(100% - 40px);
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    .stacks {
      height: 100px;
      flex: 1;
      .stack-header {
        height: 40px;
        display: flex;
        justify-content: space-between;
        padding: 0 8px;
        background-color: var(--bg-color-overlay);
        color: var(--text-color-regular);

        .tabs {
          text-indent: 0;
          display: flex;
          column-gap: 8px;
          .tab {
            padding: 0 8px;
            border-bottom: 2px solid transparent;
            cursor: var(--cursor-pointer);
            &.active {
              color: var(--text-color-primary);
              border-bottom-color: var(--color-primary);
            }
          }
        }
        .menus {
          display: flex;
          align-items: center;
          column-gap: 4px;
          .el-button {
            width: 32px;
            &.searching {
              background-color: var(--el-fill-color-light);

              &:hover {
                background-color: var(--el-fill-color-light);
                color: var(--color-primary);
              }
            }

            &:hover {
              background-color: unset;
              color: var(--color-primary);
            }
          }
        }
      }
      .stack-content {
        height: calc(100% - 40px);
        padding: 0;

        .vn-stack-layer {
          height: 100%;

          .search-wrapper {
            width: 100%;
            height: 56px;
            display: flex;
            align-items: center;
            padding: 6px 8px;
            column-gap: 8px;
            .el-input {
              height: 28px;
      
            }
          }
          .el-scrollbar {
            flex: 1;
          }
          :deep(.el-tree-container) {
            overflow-y: hidden;
            border-top: 1px solid var(--border-color-light);

            .is-horizontal {
              display: none;
            }

            .el-scrollbar__view:has(.el-tree__empty-block) {
              height: 100%;
              position: relative;

              .nocode-tree-content {
                position: absolute;
                width: 100%;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
              }
            }

            .el-tree-node {
              .el-tree-node__content {
                .el-tree-node__expand-icon {
                  position: absolute;
                  visibility: hidden;

                  &.expanded {
                    transform: rotate(180deg);
                  }
                }
              }
            }

            .expand-icon {
              transition: all 0.3s ease;

              &.expanded {
                transform: rotate(90deg);
              }
            }

          }
      
          :deep(.nocode-tree-content) {
            .el-tree-node__content {
              padding: 0;
              column-gap: 2px;
              position:relative;
              width: 100%;
              box-sizing: border-box;
      
              .node-row {
                padding-right: 6px;
                display: flex;
                align-items: center;
                width: 100%;
                height: 100%;
                position: relative;

                &.active {
                  background-color: var(--el-color-primary-light-9);
                  color: var(--color-primary);
                }

                &.focus {
                  background-color: var(--bg-color-hover);
                }

                .visible-menu {
                  position:absolute;
                  right:10px;
                  border-radius: 5px;
                  line-height: 22px;
                  width: 22px;
                  height: 22px;
                  vertical-align: middle;
                  text-align: center;
                  visibility: hidden;

                  &.isGroup {
                    right: 24px;
                  }
                  &:hover{
                    background-color:var(--color-white);
                    color:var(--color-primary);
                  }
                }
              }

              &:hover .visible-menu,
              .visible-menu.show {
                visibility: visible;
              }
            }
      
            .el-tree-node {
              // &:has(>.el-tree-node__content>span.drag-enter-background) {
              //   background-color: #323334 !important;
              // }
              &:focus > .el-tree-node__content {
                background-color: unset;
              }
              
              .el-tree-node__content {
                height: 35px !important;
      
                .node-row > span {
                  display: inline-block;
                  white-space: nowrap;
                  text-overflow: ellipsis;
                  overflow: hidden;
                  max-width: 100%;
                  user-select: none;
                  font-size: 12px;
                }
      
                &:hover {
                  background-color: var(--el-tree-node-hover-bg-color);
                }
              }
        
            }
          }

          &.layer-wrapper {
            :deep(.project-editor-the-left) {
              width: 100%;
            }
          }
        }
      }
    }
    .data-view {
      height: 50%;
      max-height: 70%;
      min-height: 38px;

      .vn-stack {
        height: 100%;
      }

      .data-view-tabs {
        background-color: var(--bg-color);
        height: 38px;
        line-height: 38px;
        color: var(--text-color-primary);
        padding: 6px 10px;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top: 1px solid var(--border-color-light);
        border-bottom: 1px solid var(--border-color-light);

        .refresh-btn {
          cursor: pointer;

          &.refreshing {
            animation: refreshing 0.5s linear infinite;
          }
        }

        .tabs {
          display: flex;
          
          .active {
            .tab {
              color: var(--text-color-primary);
            }
          }

          .tab {
            cursor: var(--cursor-pointer);
            color: var(--text-color-secondary);
            margin-right: 8px;
          }
        }

        .menus {
          display: flex;
          align-items: center;
          .el-icon {
            width: 28px;
            height: 28px;
            cursor: var(--cursor-pointer);
            color: var(--text-color-primary);
            outline: none;
            transition: all 0.3s ease-in-out;

            &:hover {
              color: var(--color-primary);
            }
          }
        }
      }

      .el-scrollbar {
        height: calc(100% - 38px);

        :deep(.el-scrollbar__view) {
          height: 100%;

          .data-view-layer {
            height: 100%;

            .vn-stack-layer {
              height: 100%;
            }
          }
        }
      }
    }
  }
}
.el-button,.el-button + .el-button{
  margin-left: 0;
}

.nocode-editor-ai-open-btn {
  position: absolute;
  left: 16px;
  top: 16px;
  z-index: 10;
}

.nocode-stage-shell,
.selection-stage-shell {
  width: 100%;
  height: 100%;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 16px 0;
}

.nocode-stage-stack {
  :deep(.vn-stack-layer) {
    min-height: 0;
  }
}

.nocode-stage-toolbar,
.selection-stage-toolbar {
  width: 100%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid #e5e6eb;
  background-color: #ffffff;

  .stage-tool {
    border: none;
    outline: none;
    background: transparent;
    height: 30px;
    padding: 0 10px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 14px;
    line-height: 22px;
    color: #4e5969;
    cursor: pointer;
    transition: background-color 0.18s ease, color 0.18s ease;

    .stage-tool__label {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    }

    &:disabled {
      cursor: not-allowed;
      color: #86909c;
      background-color: transparent;
    }

    &:hover:not(.is-active):not(.active) {
      color: #1d2129;
      background-color: #f2f3f5;
    }

    &:hover:disabled {
      color: #86909c;
      background-color: transparent;
    }

    &.is-active,
    &.active {
      color: #0873ff;
      background-color: #e8f6ff;

    }
  }
}

.selection-stage-toolbar {
  justify-content: space-between;
}

.selection-stage-toolbar__group {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.nocode-stage-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  position: relative;
  border-radius: 8px;
  overflow: hidden;

  > .layer-wrapper {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 0;
    overflow: hidden;
    z-index: 3;
  }

  .form-create {
    position: absolute;
    inset: 0;
    z-index: 5;
  }

  :deep(.project-editor) {
    width: 100%;
    height: 100%;
    border-left: none;
    background-color: transparent;
  }
}

.form-default-formula-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  box-sizing: border-box;
  background-color: transparent;
  pointer-events: auto;
}

.selection-stage-body {
  .stage-empty-state {
    min-height: 100%;
  }
}

.legacy-editor-stage {
  position: absolute;
  inset: 0;
}

.stage-tab-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.stage-artifact-board {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  :deep(.ai-flowchart) {
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  :deep(.ai-blueprint-board) {
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
}

.stage-artifact-board.ai-blueprint-board {
  overflow: auto;
  scrollbar-gutter: stable;
}

.stage-loading-state,
.stage-empty-state {
  width: 100%;
  min-height: 100%;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.stage-loading-state__inner,
.stage-empty-state__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.stage-loading-state__icon,
.stage-empty-state__icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: #e8f6ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  img {
    width: 24px;
    height: 24px;
  }
}

.stage-loading-state__title {
  font-size: 14px;
  line-height: 22px;
  font-weight: 600;
  color: #1d2129;
}

.stage-loading-state__description {
  max-width: 320px;
  text-align: center;
  font-size: 12px;
  line-height: 18px;
  color: #86909c;
}

.stage-empty-state__text {
  font-size: 12px;
  line-height: 18px;
  color: #86909c;
}

.stage-tool__loading {
  margin-left: 4px;
  color: #2d6fe8;
}

.empty-layer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f2f3f5;
}

.empty-layer-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-layer-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background-color: #e8f6ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  img {
    width: 40px;
    height: 40px;
  }
}

.empty-layer-text {
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  color: #86909c;
}

.project-close-btn{
  padding: 0 4px;
  margin-left: 5px;
}

@keyframes refreshing {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(-360deg);
  }
}
</style>

<style lang="scss">
.nocode-editor-dropdown {
  .el-dropdown-menu {
    .el-dropdown-menu__item {
      padding: 5px 32px 5px 12px;
    }
  }
}

.nocode-app-switcher-popper {
  width: 300px !important;
  padding: 5px !important;
  border-radius: 8px !important;
  border: 1px solid #e5e6eb !important;
  background: #ffffff !important;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1) !important;

  .app-switcher-dropdown {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .app-switcher-dropdown__header {
    height: 36px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px 0 0;
    color: #1d2129;
    font-size: 14px;
    line-height: 22px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.18s ease, color 0.18s ease;

    &:hover {
      background-color: #f7f8fa;
    }

    &.is-menu-open:not(.active) {
      background-color: #f7f8fa;
    }

    &.active {
      background-color: #e8f6ff;
      color: #157cff;
    }
    .app-switcher-dropdown__header-arrow {
      color: #c9cdd4;
      width: 24px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }



  .app-switcher-dropdown__header-main {
    min-width: 0;
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .app-switcher-dropdown__header-actions {
    margin-left: 8px;
    opacity: 0;
    transition: opacity 0.15s ease;
    display: flex;
    align-items: center;
  }

  .app-switcher-dropdown__header:hover,
  .app-switcher-dropdown__header.is-menu-open {
    .app-switcher-dropdown__header-actions {
      opacity: 1;
    }
  }

  .app-switcher-dropdown__header-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-switcher-home-page {
    height: 36px;
    padding: 0 12px 0 24px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    > span {
      flex: 1;
    }

    .visible-menu {
      opacity: 0;
    }

    &:hover,
    &.active {
      background-color: #f7f8fa;

      .visible-menu {
        opacity: 1;
      }
    }

    &.active {
      color: #157cff;
    }
  }

  .app-switcher-dropdown__header-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;

    &.has-background {
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
    }

    .app-default-icon img {
      width: 100%;
    }
  }

  .app-switcher-dropdown__scroll {
    min-height: 0;
    max-height: min(60vh, 324px);
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .app-switcher-tree {
    background-color: transparent;
    --el-tree-node-hover-bg-color: transparent;
    --el-tree-node-content-height: 36px;

    .el-tree-node__expand-icon {
      position: absolute;
      visibility: hidden;

      &.expanded {
        transform: rotate(180deg);
      }
    }

    .el-tree-node__content {
      height: 36px;
      padding: 0 !important;
      border-radius: 4px;
      background: transparent !important;
    }

    .el-tree-node:focus > .el-tree-node__content {
      background-color: unset;
    }

    .app-switcher-tree-node {
      width: 100%;
      min-width: 0;
      height: 36px;
      display: flex;
      align-items: center;
      padding-left: 24px;
      // padding-right: 12px;
      border-radius: 4px;
      color: #1d2129;
      transition: background-color 0.18s ease, color 0.18s ease;

      &:hover {
        background-color: #f7f8fa;
      }

      &.active {
        background-color: #e8f6ff;
      }

      &.is-group.is-drag-hover {
        background-color: #e8f6ff;
      }

      &>.el-icon {
        margin-right: 8px;
      }
      &.is-group {
      }
    }

    .app-switcher-tree-node__indent {
      height: 1px;
      flex-shrink: 0;
      // margin-left: 12px;
    }


    .app-switcher-tree-node__label {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      line-height: 22px;
      font-weight: 400;
    }

    .app-switcher-tree-node__actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      opacity: 0;
      transition: opacity 0.15s ease;

      &.is-group {
        margin-right: 0;
      }
    }

    .visible-menu {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      color: #4e5969;
      cursor: pointer;
      transition: background-color 0.18s ease, color 0.18s ease;

      &:hover {
        background-color: rgba(78, 89, 105, 0.08);
        color: #1d2129;
      }
    }

    .app-switcher-tree-node:hover,
    .app-switcher-tree-node.is-menu-open {
      .app-switcher-tree-node__actions {
        opacity: 1;
      }
    }

    .app-switcher-tree-node.is-menu-open:not(.active) {
      background-color: #f7f8fa;
    }

    .app-switcher-tree-node__label.active {
      color: #157cff;
      font-weight: 500;
    }

    .app-switcher-tree-node__label.focus {
      color: #1d2129;
    }
  }
}

.nocode-home-page-setting-popper {
  padding: 0 !important;
  border-radius: 8px;

  .app-switcher-home-page__menu {
    margin: 0;
    padding: 4px;
    list-style: none;
    background-color: #fff;
    border-radius: 8px;

    li {
      height: 32px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 4px;
      cursor: pointer;

      &:hover {
        background-color: #f7f8fa;
      }
    }
  }
}

.nocode-header-create-popper {
  width: 168px !important;
  padding: 6px !important;
  border-radius: 10px !important;
  border: 1px solid #e5e6eb !important;
  background: #ffffff !important;
  box-shadow: 0 8px 24px rgba(29, 33, 41, 0.12), 0 2px 6px rgba(29, 33, 41, 0.06) !important;

  .el-dropdown-menu {
    padding: 0;
    border: 0;
    box-shadow: none;
    background: transparent;
  }

  .el-dropdown-menu__item {
    height: 40px;
    border-radius: 8px;
    gap: 10px;
    color: #1d2129;
    font-size: 14px;
    line-height: 22px;
    font-weight: 500;
    padding: 0 10px;
    transition: background-color 0.18s ease, color 0.18s ease;
  }

  .header-create-icon {

  }

  .el-dropdown-menu__item:not(.is-disabled):hover {
    background-color: #f2f3f5;
  }

  .el-dropdown-menu__item:not(.is-disabled):focus {
    background-color: #f2f3f5;
    color: #1d2129;
  }
}
</style>
