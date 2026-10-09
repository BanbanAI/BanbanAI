<template>
  <aggregate-table-setting
    v-if="activeName === SettingTab.AGGREGATE && aggregateEditorVisible"
    ref="permissionRef"
    @back="handleAggregateEditorBack"
  ></aggregate-table-setting>

  <div v-else class="container" :style="{ minWidth: containerMinWidth }">
    <div class="aside-container">
      <div class="header">
        <el-button class="back" text :title="$t('NocodeViewSetting.backToApp')" @click="goPageViewer">
          <el-icon size="16" class="arrow">
            <i-ep-arrow-left />
          </el-icon>
        </el-button>
        <span :title="$t('NocodeViewSetting.appSetting')">{{ $t('NocodeViewSetting.appSetting') }}</span>
      </div>
      <el-menu
        :key="menuKey"
        :default-active="menuActiveIndex"
        :default-openeds="menuDefaultOpeneds"
        class="el-menu-vertical-demo"
      >
        <el-menu-item index="1" @click="clickMenuItem(SettingTab.BASIC)" :class="{ 'active': activeName === SettingTab.BASIC }">
          <template #title>
            <el-icon class="menu-icon"><i-ep-setting /></el-icon>
            <span>{{ tabTitles[SettingTab.BASIC] }}</span>
          </template>
        </el-menu-item>
        <el-sub-menu index="2" :class="{ 'active': isPublishTab(activeName) }">
          <template #title>
            <el-icon class="menu-icon"><i-ven-nocode-publish-setting /></el-icon>
            <span>{{ tabTitles[SettingTab.PUBLISH] }}</span>
          </template>
          <el-menu-item index="2-1" @click="clickMenuItem(SettingTab.INNER)" :class="{ 'active': activeName === SettingTab.INNER }">
            <el-icon class="menu-icon">
              <i-ven-nocode-inner-organization-publish />
            </el-icon>
            {{ tabTitles[SettingTab.INNER] }}
          </el-menu-item>
          <el-menu-item index="2-2" @click="clickMenuItem(SettingTab.PUBLIC)" :class="{ 'active': activeName === SettingTab.PUBLIC }">
            <el-icon class="menu-icon">
              <i-ven-nocode-public-publish />
            </el-icon>
            {{ tabTitles[SettingTab.PUBLIC] }}
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item index="3" @click="clickMenuItem(SettingTab.PRINTER)" :class="{ 'active': activeName === SettingTab.PRINTER }">
          <template #title>
            <el-icon class="menu-icon"><i-ep-printer /></el-icon>
            <span>{{ tabTitles[SettingTab.PRINTER] }}</span>
          </template>
        </el-menu-item>
        <el-sub-menu index="4" v-if="isAdmin">
          <template #title>
            <el-icon class="menu-icon"><i-ven-nocode-setting-permission/></el-icon>
            <span>{{ $t('NocodeViewSetting.permissionSetting') }}</span>
          </template>
          <el-menu-item index="3-1" @click="clickMenuItem(SettingTab.APPLICATION)" :class="{ 'active': activeName === SettingTab.APPLICATION }">
            <el-icon class="menu-icon">
              <i-ven-nocode-setting-permission-app/>
            </el-icon>
            {{ tabTitles[SettingTab.APPLICATION] }}
          </el-menu-item>
          <el-menu-item index="3-2" @click="clickMenuItem(SettingTab.PAGE)" :class="{ 'active': activeName === SettingTab.PAGE }">
            <el-icon class="menu-icon">
              <i-ven-nocode-setting-permission-page/>
            </el-icon>
            {{ tabTitles[SettingTab.PAGE] }}
          </el-menu-item>
          <el-menu-item index="3-3" @click="clickMenuItem(SettingTab.VIEW)" :class="{ 'active': activeName === SettingTab.VIEW }">
            <el-icon class="menu-icon">
              <i-ven-nocode-setting-permission-view/>
            </el-icon>
            {{ tabTitles[SettingTab.VIEW] }}
          </el-menu-item>
          <el-menu-item index="3-4" @click="clickMenuItem(SettingTab.OPERATION)" :class="{ 'active': activeName === SettingTab.OPERATION }">
            <el-icon class="menu-icon">
              <i-ven-nocode-setting-permission-view/>
            </el-icon>
            {{ tabTitles[SettingTab.OPERATION] }}
          </el-menu-item>
          <el-menu-item index="3-5" @click="clickMenuItem(SettingTab.FIELD)" :class="{ 'active': activeName === SettingTab.FIELD }">
            <el-icon class="menu-icon">
              <i-ven-nocode-setting-permission-field/>
            </el-icon>
            {{ tabTitles[SettingTab.FIELD] }}
          </el-menu-item>
          <el-menu-item index="3-6" @click="clickMenuItem(SettingTab.DATA)" :class="{ 'active': activeName === SettingTab.DATA }">
            <el-icon class="menu-icon">
              <i-ven-nocode-setting-permission-data/>
            </el-icon>
            {{ tabTitles[SettingTab.DATA] }}
          </el-menu-item>
        </el-sub-menu>

        <el-menu-item index="5" @click="clickMenuItem(SettingTab.API)" :class="{ 'active': activeName === SettingTab.API }" v-if="isAdmin">
          <template #title>
            <el-icon class="menu-icon"><i-nocode-app-setting-union /></el-icon>
            <span>{{ tabTitles[SettingTab.API] }}</span>
          </template>
        </el-menu-item>
        <el-menu-item index="6" @click="clickMenuItem(SettingTab.CROSS_APP)" :class="{ 'active': activeName === SettingTab.CROSS_APP }">
          <template #title>
            <el-icon class="menu-icon"><i-nocode-app-setting-union /></el-icon>
            <span>{{ tabTitles[SettingTab.CROSS_APP] }}</span>
          </template>
        </el-menu-item>
        <el-menu-item index="7" @click="clickMenuItem(SettingTab.AGGREGATE)" :class="{ 'active': activeName === SettingTab.AGGREGATE }">
          <template #title>
            <el-icon class="menu-icon"><i-ven-nocode-setting-aggregate /></el-icon>
            <span>{{ dataCenterTitle }}</span>
          </template>
        </el-menu-item>
      </el-menu>
    </div>

    <div class="main-wrapper">
      <div class="header">
        <span class="header-title" :title="tabTitles[activeName]">{{ tabTitles[activeName] }}</span>
        <el-tooltip
          v-if="activeName === SettingTab.OPERATION"
          :content="$t('NocodeViewSetting.operationPermissionTip')"
          placement="top"
          effect="light"
        >
          <el-icon class="operation-permission-tip">
            <i-ant-design-question-circle-outlined />
          </el-icon>
        </el-tooltip>
        <div v-if="showChangeFlag" class="change-flag"></div>
        <div class="header-right">
          <work-bench-user-card v-if="!props.isComponent"></work-bench-user-card>
          <el-icon v-else size="16" @click="goPageViewer">
            <i-ep-close></i-ep-close>
          </el-icon>
        </div>
      </div>
      <div class="body">
        <div v-if="activeName === SettingTab.BASIC" class="basic-container">
          <nocode-basic-setting @update="handleBasicSettingUpdated"></nocode-basic-setting>
        </div>
        <div v-else-if="activeName === SettingTab.APPLICATION" class="application-container">
          <nocode-project-permission ref="permissionRef"></nocode-project-permission>
        </div>
        <div v-else-if="activeName === SettingTab.PAGE" class="page-container">
          <nocode-page-permission ref="permissionRef"></nocode-page-permission>
        </div>
        <div v-else-if="activeName === SettingTab.VIEW" class="page-container">
          <nocode-view-permission ref="permissionRef"></nocode-view-permission>
        </div>
        <div v-else-if="activeName === SettingTab.OPERATION" class="page-container">
          <nocode-operation-permission ref="permissionRef"></nocode-operation-permission>
        </div>
        <div v-else-if="activeName === SettingTab.FIELD" class="page-container">
          <nocode-field-permission ref="permissionRef"></nocode-field-permission>
        </div>
        <div v-else-if="activeName === SettingTab.DATA" class="page-container">
          <nocode-form-permission ref="permissionRef"></nocode-form-permission>
        </div>
        <div v-else-if="activeName === SettingTab.API" class="page-container">
          <api-setting ref="permissionRef"></api-setting>
        </div>
        <div v-else-if="activeName === SettingTab.CROSS_APP" class="page-container">
          <cross-app-setting ref="permissionRef" @update-nocode="handleCrossAppSettingUpdated"></cross-app-setting>
        </div>
        <div v-else-if="activeName === SettingTab.AGGREGATE" class="page-container">
          <data-center-setting ref="permissionRef" @open-editor="handleOpenAggregateEditor"></data-center-setting>
        </div>
        <div v-else-if="activeName === SettingTab.PRINTER" class="page-container">
          <nocode-printer-setting ref="printerSettingRef"></nocode-printer-setting>
        </div>
        <div v-else-if="activeName === SettingTab.INNER" class="page-container">
          <nocode-publish-inner-page
            ref="publishInnerPageRef"
            :publishState="publishSettingState"
          ></nocode-publish-inner-page>
        </div>
        <div v-else-if="activeName === SettingTab.PUBLIC" class="page-container">
          <nocode-publish-public-page
            ref="publishPublicPageRef"
            :publishState="publishSettingState"
          ></nocode-publish-public-page>
        </div>
      </div>
    </div>
  </div>
  <setting-tips-dialog ref="settingTipsDialogRef"></setting-tips-dialog>
  <nocode-update-tip-dialog ref="aggregateUpdateTipDialogRef"></nocode-update-tip-dialog>
</template>

<script setup lang="ts">
import { ref, provide, inject, computed, watch, type Ref } from 'vue';

import { usePassportStore } from '@renderer/stores';
import { AggregateTable, Nocode, NocodeStructureType, PermissionRangeType, PermissionFilterMode } from '@common/types/nocode';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { NOCODE_THEME_COLOR, NOCODE, NOCODE_ID, NOCODE_SIGN_IS_LATEST, ClientTheme, ORGANIZE_UTIL } from '@renderer/types';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { ElMessage } from 'element-plus';
import { isEmpty } from '@common/utils/object';
import { getDefaultDataPermissionOther } from '@common/utils';
import { Table } from '@common/types/project';
import { SettingTab } from '@common/types/project'
import i18next from 'i18next';
import AggregateTableSetting from './main/AggregateTableSetting.vue';
import { usePublishSettingState } from './main/usePublishSettingState';

import CrossAppSetting from './main/CrossAppSetting.vue';
import DataCenterSetting from './main/DataCenterSetting.vue';
import { aggregateTableSettingContextKey, createAggregateTableSettingContext } from './main/aggregateTableSettingContext';
import { shouldShowSettingChangeFlag } from './settingChangeFlag';

const props = withDefaults(defineProps<{
  isComponent?: boolean,
}>(), {
  isComponent: false,
});

const organizeUtil = new OrganizeUtil()
provide(ORGANIZE_UTIL, organizeUtil)
const passportState = usePassportStore()
const router = useRouter()
const route = useRoute()
const nocodeId = route.params.nocodeId as string
const injectedNocode = inject(NOCODE, ref<Nocode>())
const nocode = props.isComponent ? injectedNocode : ref<Nocode>()
const dataCenterTitle = computed(() => i18next.t('NocodeViewSetting.dataCenter'))
type SettingTabName = SettingTab | typeof SettingTab[keyof typeof SettingTab]
const activeName = ref<SettingTabName>(SettingTab.BASIC)

passportState.init(nocodeId)
const isChanged = ref(false)
const aggregateEditorVisible = ref(false)
provide('isChanged', isChanged)
const settingTipsDialogRef = ref(null)
const permissionRef = ref(null)
const publishInnerPageRef = ref<{ checkUpdate: () => Promise<boolean | string> }>()
const publishPublicPageRef = ref<{ checkUpdate: () => Promise<boolean | string> }>()
const aggregateUpdateTipDialogRef = ref<{ confirm: () => Promise<'close' | 'cancel' | 'save'> }>()
const printerSettingRef = ref()

const tabTitles = {
  get [SettingTab.BASIC]() { return i18next.t('NocodeViewSetting.basicSetting') },
  get [SettingTab.PUBLISH]() { return i18next.t('NocodeViewSetting.publishSetting') },
  get [SettingTab.PRINTER]() { return i18next.t('NocodeViewSetting.printTemplate') },
  get [SettingTab.INNER]() { return i18next.t('NocodeViewSetting.publishInner') },
  get [SettingTab.PUBLIC]() { return i18next.t('NocodeViewSetting.publishPublic') },
  get [SettingTab.APPLICATION]() { return i18next.t('NocodeViewSetting.appPermission') },
  get [SettingTab.PAGE]() { return i18next.t('NocodeViewSetting.pagePermission') },
  get [SettingTab.VIEW]() { return i18next.t('NocodeViewSetting.viewPermission') },
  get [SettingTab.OPERATION]() { return i18next.t('NocodeViewSetting.operationPermission') },
  get [SettingTab.FIELD]() { return i18next.t('NocodeViewSetting.fieldPermission') },
  get [SettingTab.DATA]() { return i18next.t('NocodeViewSetting.dataPermission') },
  get [SettingTab.API]() { return i18next.t('NocodeViewSetting.apiSetting') },
  get [SettingTab.CROSS_APP]() { return i18next.t('NocodeViewSetting.crossAppSetting') },
  get [SettingTab.AGGREGATE]() { return i18next.t('NocodeViewSetting.dataCenter') },
}
const isAdmin = computed(() => !!passportState.account?.isAdmin);
const adminOnlyTabs = new Set<SettingTab>([
  SettingTab.APPLICATION,
  SettingTab.PAGE,
  SettingTab.VIEW,
  SettingTab.OPERATION,
  SettingTab.FIELD,
  SettingTab.DATA,
  SettingTab.API,
]);
const isAdminOnlyTab = (type: SettingTab) => adminOnlyTabs.has(type);

const containerMinWidth = computed(() => {
  if (
    activeName.value === SettingTab.VIEW
    || activeName.value === SettingTab.OPERATION
    || activeName.value === SettingTab.FIELD
    || activeName.value === SettingTab.DATA
    || activeName.value === SettingTab.CROSS_APP
    || activeName.value === SettingTab.AGGREGATE
  ) {
    return '1200px';
  } else {
    return '1000px'
  }
})

const getNocode = async (): Promise<Nocode> => {
  return await axios.get(`/project/get-nocode?nocodeId=${nocodeId}`).then(({ data }) => data).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
  });
}

const updateNocode = async () => {
  const theNocode: Nocode = await getNocode()
  nocode.value = theNocode
  emit('update-nocode')
}

const handleCrossAppSettingUpdated = async () => {
  if (props.isComponent) {
    emit('update-nocode');
    return;
  }

  await updateNocode();
}

const handleAggregateSettingUpdated = async () => {
  if (props.isComponent) {
    emit('aggregate-tables-updated', nocode.value.body.formData?.aggregateTables || []);
    return;
  }

  await updateNocode();
}

const handleBasicSettingUpdated = async () => {
  if (!props.isComponent) {
    await initNocode()
  }
  emit('update-nocode')
}

const initNocode = async () => {
  try {
    const themeColor = ref("#0089ff")
    provide(NOCODE_THEME_COLOR, themeColor)

    if (props.isComponent) {
      nocode.value = injectedNocode.value
    } else {
      nocode.value = await getNocode()
    }

    if (nocode.value.body.themeColor) {
      themeColor.value = nocode.value.body.themeColor
    }

    if (nocode.value?.body?.theme && nocode.value.body.theme === ClientTheme.Dark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }

    initPermission()
    await organizeUtil.getDepartments()
    await organizeUtil.getUsers()
    await organizeUtil.getAllUsers()
    await organizeUtil.getRoles()
    filterData()
    document.title = nocode.value?.meta?.name
  }catch(err) {
    console.log("get nocode error", err)
  }
}
initNocode()
provide(NOCODE, nocode)
provide(NOCODE_ID, nocodeId)

const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null)
const aggregateTableSettingContext = createAggregateTableSettingContext({
  editorVisible: aggregateEditorVisible,
  enabled: computed(() => activeName.value === SettingTab.AGGREGATE),
  isChanged,
  nocode: nocode as Ref<Nocode>,
  nocodeId,
  nocodeSignIsLatest,
  onUpdateNocode: handleAggregateSettingUpdated,
})
provide(aggregateTableSettingContextKey, aggregateTableSettingContext)

const emit = defineEmits<{
  (event: "close");
  (event: 'update-nocode'): void,
  (event: 'aggregate-tables-updated', aggregateTables: AggregateTable[]): void,
  (event: 'update-table', tables: Table[]),
  (event: 'published'): void,
}>();

const discardAggregateDraft = () => {
  if (activeName.value !== SettingTab.AGGREGATE) return
  aggregateTableSettingContext.resetDraftFromNocode()
  aggregateEditorVisible.value = false
}

const switchActiveTab = (type: SettingTabName) => {
  activeName.value = type
  if (type !== SettingTab.AGGREGATE) {
    aggregateEditorVisible.value = false
  }
}

const handleOpenAggregateEditor = () => {
  aggregateEditorVisible.value = true
}

const handleAggregateEditorBack = () => {
  aggregateEditorVisible.value = false
}

const publishSettingState = usePublishSettingState({
  nocode,
  onUpdateNocode: updateNocode,
  onUpdateTable: async (tables) => emit('update-table', tables),
  onPublishSuccess: async () => emit('published'),
})

const publishChanged = ref(false)
const showChangeFlag = computed(() => shouldShowSettingChangeFlag({
  activeName: activeName.value,
  isChanged: isChanged.value,
  publishChanged: publishChanged.value,
}))

watch(() => publishSettingState.isPageUpdate.value, (value) => {
  publishChanged.value = value
}, { immediate: true })

const getActivePublishRef = () => {
  return activeName.value === SettingTab.PUBLIC ? publishPublicPageRef.value : publishInnerPageRef.value
}

const checkPublishUpdate = async () => {
  const publishRef = getActivePublishRef()
  if (!publishRef) {
    return true
  }
  return await publishRef.checkUpdate()
}

const confirmPublishUpdate = async () => {
  if (!publishChanged.value) {
    return true
  }
  const shouldLeave = await checkPublishUpdate()
  if (shouldLeave === 'close') {
    return false
  }
  if (shouldLeave === 'cancel') {
    await publishSettingState.reset()
  }
  return true
}

const confirmAggregateUpdate = async () => {
  if (!isChanged.value) {
    return true
  }
  const shouldLeave = await aggregateUpdateTipDialogRef.value?.confirm()
  if (shouldLeave === 'close' || !shouldLeave) {
    return false
  }
  if (shouldLeave === 'cancel') {
    discardAggregateDraft()
    return true
  }
  return await aggregateTableSettingContext.handleSave()
}

const confirmSettingLeave = async () => {
  if (isPublishTab(activeName.value)) {
    return await confirmPublishUpdate()
  }
  if (activeName.value === SettingTab.AGGREGATE) {
    return await confirmAggregateUpdate()
  }
  return true
}

const goPageViewer = async () => {
  if(props.isComponent) {
    emit('close')
    return
  }
  if (isPublishTab(activeName.value)) {
    if (!(await confirmPublishUpdate())) {
      return
    }
    router.push({
      path: `/app/${nocodeId}`,
    })
    return
  }
  if (activeName.value === SettingTab.AGGREGATE && !(await confirmAggregateUpdate())) {
    return
  }
  if(activeName.value === SettingTab.BASIC || !isChanged.value) {
    isChanged.value = false
    aggregateEditorVisible.value = false
    router.push({
      path: `/app/${nocodeId}`,
    })
    return
  }
  if(activeName.value != SettingTab.BASIC && isChanged.value) {
    settingTipsDialogRef.value.confirm()
    const isSave = await settingTipsDialogRef.value.confirm()
    if (isSave) {
      await permissionRef.value.savePermissions()
      aggregateEditorVisible.value = false
      router.push({
        path: `/app/${nocodeId}`,
      })
    } else {
      discardAggregateDraft()
      isChanged.value = false
      router.push({
        path: `/app/${nocodeId}`,
      })
    }
  }
}

function initPermission() {
  if (!nocode.value.body.permissions) {
    nocode.value.body.permissions = { application: {
      get: {
        rangeType:  PermissionFilterMode.BLACK,
        blacklist: {
          departments: [],
          roles: [],
          users: [],
        },
        whitelist: {
          departments: [],
          roles: [],
          users: [],
        },
      },
      delete: {
        rangeType:  PermissionFilterMode.BLACK,
        blacklist: {
          departments: [],
          roles: [],
          users: [],
        },
        whitelist: {
          departments: [],
          roles: [],
          users: [],
        },
      },
      update: {
        rangeType:  PermissionFilterMode.BLACK,
        blacklist: {
          departments: [],
          roles: [],
          users: [],
        },
        whitelist: {
          departments: [],
          roles: [],
          users: [],
        },
      },
    }, page: {}, data: {}, view: {}, operation: {}, field: {} }
  }

  if(isEmpty(nocode.value.body.permissions.application)) {
    nocode.value.body.permissions.application = {
      get: {
        rangeType:  PermissionFilterMode.BLACK,
        blacklist: {
          departments: [],
          roles: [],
          users: [],
        },
        whitelist: {
          departments: [],
          roles: [],
          users: [],
        },
      },
      delete: {
        rangeType:  PermissionFilterMode.BLACK,
        blacklist: {
          departments: [],
          roles: [],
          users: [],
        },
        whitelist: {
          departments: [],
          roles: [],
          users: [],
        },
      },
      update: {
        rangeType:  PermissionFilterMode.BLACK,
        blacklist: {
          departments: [],
          roles: [],
          users: [],
        },
        whitelist: {
          departments: [],
          roles: [],
          users: [],
        },
      },
    }
  }

  function extractPages(tree) {
    const result = [];

    function traverse(nodes) {
      for (const node of nodes) {
        if(node.type != NocodeStructureType.GROUP && isEmpty(nocode.value.body.permissions?.page?.[node.id])) {
          nocode.value.body.permissions.page[node.id] = {
            get: {
              rangeType: PermissionRangeType.ALL,
              range: {
                departments: [],
                roles: [],
                users: [],
              }
            }
          }
        }
        if (node.type === NocodeStructureType.FORM && nocode.value.body.views[node.id]) {
          if (!nocode.value.body.permissions.view) {
            nocode.value.body.permissions.view = {
              [node.id]: {}
            };
          } else if (!nocode.value.body.permissions.view[node.id]) {
            nocode.value.body.permissions.view[node.id] = {}
          }

          for (const item of nocode.value.body.views[node.id]) {
            if (isEmpty(nocode.value.body.permissions?.view?.[node.id]?.[item.uid])) {
              nocode.value.body.permissions.view[node.id][item.uid] = {
                get: {
                  rangeType: PermissionRangeType.ALL,
                  range: {
                    departments: [],
                    roles: [],
                    users: [],
                  }
                }
              }
            }
            if (isEmpty(nocode.value.body.permissions.view[node.id][item.uid]?.get)) {
              nocode.value.body.permissions.view[node.id][item.uid].get = {
                rangeType: PermissionRangeType.ALL,
                range: {
                  departments: [],
                  roles: [],
                  users: [],
                }
              }
            }
          }
        }
        if (node.type === NocodeStructureType.FORM && isEmpty(nocode.value.body.permissions?.field?.[node.id])) {
          if (!nocode.value.body.permissions.field) {
            nocode.value.body.permissions.field = {};
          }
          nocode.value.body.permissions.field[node.id] = {
            get: [{
              get title(){ return i18next.t('NocodeViewSetting.fieldPermissionInitTitle') },
              get description(){ return i18next.t('NocodeViewSetting.fieldPermissionInitDescription') },
              memberRange: {
                rangeType: PermissionRangeType.ALL,
                range: {
                  departments: [],
                  roles: [],
                  users: [],
                }
              },
              fieldRange: {
                rangeType: PermissionRangeType.ALL,
                range: {}
              }
            }]
          }
        }
        if(node.type === NocodeStructureType.FORM && isEmpty(nocode.value.body.permissions?.data?.[node.id])) {
          nocode.value.body.permissions.data[node.id] = {
            add: {
              rangeType: PermissionRangeType.ALL,
              range: {
                departments: [],
                roles: [],
                users: [],
              }
            },
            other: getDefaultDataPermissionOther(),
          }
        } else if(node.type === NocodeStructureType.FORM) {
          if(isEmpty(nocode.value.body.permissions?.data?.[node.id].add)) {
            nocode.value.body.permissions.data[node.id].add = {
              rangeType: PermissionRangeType.ALL,
              range: {
                departments: [],
                roles: [],
                users: [],
              }
            }
          }
          if(isEmpty(nocode.value.body.permissions?.data?.[node.id]?.other?.length)) {
            nocode.value.body.permissions.data[node.id].other = getDefaultDataPermissionOther();
          }
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    }

    traverse(tree);
    return result;
  }
  extractPages(nocode.value.body.structure)
}

const isPublishTab = (tab: string) => {
  return tab === SettingTab.INNER || tab === SettingTab.PUBLIC
}
const permissionSettingTabs = new Set<SettingTab>([
  SettingTab.APPLICATION,
  SettingTab.PAGE,
  SettingTab.VIEW,
  SettingTab.OPERATION,
  SettingTab.FIELD,
  SettingTab.DATA,
])
const isPermissionSettingTab = (tab: SettingTabName) => permissionSettingTabs.has(tab as SettingTab)
const tabMenuIndexMap: Record<SettingTab, string> = {
  [SettingTab.BASIC]: '1',
  [SettingTab.PUBLISH]: '2',
  [SettingTab.APPLICATION]: '3-1',
  [SettingTab.PAGE]: '3-2',
  [SettingTab.VIEW]: '3-3',
  [SettingTab.OPERATION]: '3-4',
  [SettingTab.FIELD]: '3-5',
  [SettingTab.DATA]: '3-6',
  [SettingTab.API]: '5',
  [SettingTab.CROSS_APP]: '6',
  [SettingTab.AGGREGATE]: '7',
  [SettingTab.PRINTER]: '3',
  [SettingTab.INNER]: '2-1',
  [SettingTab.PUBLIC]: '2-2',
}

const menuActiveIndex = computed(() => tabMenuIndexMap[activeName.value as SettingTab] || '1')
const menuDefaultOpeneds = computed(() => {
  if (isPublishTab(activeName.value)) {
    return ['2']
  }
  if (isPermissionSettingTab(activeName.value) && isAdmin.value) {
    return ['4']
  }
  return []
})
const menuKey = computed(() => `${menuActiveIndex.value}:${menuDefaultOpeneds.value.join(',')}:${isAdmin.value}`)
const parseRouteTab = (value: unknown): SettingTab | null => {
  const tab = Array.isArray(value) ? value[0] : value
  if (typeof tab !== 'string') {
    return null
  }
  if (!(Object.values(SettingTab) as string[]).includes(tab)) {
    return null
  }
  return tab as SettingTab
}

watch(
  [() => route.query.tab, isAdmin],
  ([tab]) => {
    if (props.isComponent) {
      return
    }
    const targetTab = parseRouteTab(tab)
    if (!targetTab) {
      return
    }
    if (isAdminOnlyTab(targetTab) && !isAdmin.value) {
      return
    }
    switchActiveTab((targetTab === SettingTab.PUBLISH ? SettingTab.INNER : targetTab) as SettingTabName)
    if (route.query.tab) {
      const nextQuery = { ...route.query }
      delete nextQuery.tab
      router.replace({
        path: route.path,
        query: nextQuery,
      })
    }
  },
  { immediate: true }
)

const clickMenuItem = async (type: SettingTab) => {
  if (isAdminOnlyTab(type) && !isAdmin.value) {
    ElMessage.warning(i18next.t('NocodeViewSetting.isNotAdmin'));
    return;
  }

  const targetTab = (type === SettingTab.PUBLISH ? SettingTab.INNER : type) as SettingTabName

  if(targetTab === activeName.value) {
    return
  }

  const previousActiveName = activeName.value
  if (isPublishTab(previousActiveName)) {
    if (!(await confirmPublishUpdate())) {
      return
    }
    switchActiveTab(targetTab)
    return
  }

  if (previousActiveName === SettingTab.AGGREGATE) {
    if (!(await confirmAggregateUpdate())) {
      return
    }
    switchActiveTab(targetTab)
    return
  }

  if(previousActiveName === SettingTab.BASIC || !isChanged.value) {
    switchActiveTab(targetTab)
    isChanged.value = false
    return
  }

  if(previousActiveName != SettingTab.BASIC && isChanged.value) {
    settingTipsDialogRef.value.confirm()
    const isSave = await settingTipsDialogRef.value.confirm()
    if (isSave) {
      await permissionRef.value.savePermissions()
    } else if (previousActiveName === SettingTab.AGGREGATE) {
      discardAggregateDraft()
    }
    switchActiveTab(targetTab)
    isChanged.value = false
    return
  }

  switchActiveTab(targetTab)
}

function filterData() {
  const filterValidItems = (items, sourceList) => {
    return items.filter(item => sourceList.some(source => source.id === item));
  };
  const organizeUsers = organizeUtil.allUsers?.length ? organizeUtil.allUsers : organizeUtil.users;
  const dataKeys = Object.keys(nocode.value.body.permissions.data);
  dataKeys.forEach(key => {
    const targetData = nocode.value.body.permissions.data[key]
    targetData.add.range.departments = filterValidItems(targetData.add.range.departments, organizeUtil.departments)
    targetData.add.range.roles = filterValidItems(targetData.add.range.roles, organizeUtil.roles)
    targetData.add.range.users = filterValidItems(targetData.add.range.users, organizeUsers)

    targetData.other.forEach(item => {
      item.memberRange.range.departments = filterValidItems(item.memberRange.range.departments, organizeUtil.departments)
      item.memberRange.range.roles = filterValidItems(item.memberRange.range.roles, organizeUtil.roles)
      item.memberRange.range.users = filterValidItems(item.memberRange.range.users, organizeUsers)
      item.dataRange.customDepartment.departments = filterValidItems(item.dataRange.customDepartment.departments, organizeUtil.departments)
    });
  });
  const pageKeys = Object.keys(nocode.value.body.permissions.page);
  pageKeys.forEach(key => {
    const targetData = nocode.value.body.permissions.page[key].get.range
    targetData.departments = filterValidItems(targetData.departments, organizeUtil.departments)
    targetData.roles = filterValidItems(targetData.roles, organizeUtil.roles)
    targetData.users = filterValidItems(targetData.users, organizeUsers)
  })
}

defineExpose({
  switchTab: clickMenuItem,
  confirmLeave: confirmSettingLeave,
})
</script>

<style lang="scss" scoped>
.container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  // min-width: 1000px;

  .aside-container {
    width: 300px;
    height: 100%;
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    background-color: var(--color-white);

    .header {
      width: 100%;
      height: 64px;
      column-gap: 6px;
      border-bottom-width: 1px;
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;



      span {
        width: 200px;
        font-weight: 400;
        font-size: 20px;
        line-height: 32px;
        letter-spacing: 0%;
        margin-left: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .icon {
        min-width: 24px;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .back {
        height: 32px;
        width: 32px;
        color: var(--text-color-primary);
        transition: all 0.3s ease;
        border-radius: 4px;
      }

      .el-icon {
        height: 24px;
        width: 24px;

        &.logo {
          margin-left: 4px;
          margin-right: 8px;
        }
      }

      :deep(img) {
        width: 24px;
        height: 24px;
        border-radius: 4px;
      }
    }

    :deep(.el-menu) {
      border-right: 0px;
      display: flex;
      flex-direction: column;
      height: 100%;

      .el-menu-item {
        padding-left: 16px;

        &.active {
          background-color: var(--bg-color-overlay) !important;
        }

        &.is-active {
          color: unset;
        }

        &:hover {
          background-color: var(--bg-color-overlay) !important;
        }
      }

      .menu-icon {
        color: var(--color-primary);
        margin-right: 8px;
      }

      .el-sub-menu {
        .el-sub-menu__title {
          padding-left: 16px;
        }

        .el-menu-item {
          padding-left: 44px;
        }
      }

      .ai-settings-sub-menu {
        margin-top: auto;
      }
    }
  }


  .main-wrapper {
    width: calc(100% - 300px);
    background-color: var(--bg-color-overlay);
    height: 100%;
    display: flex;
    flex-direction: column;

    .header {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: 64px;
      padding: 0px 16px 0px 16px;
      border-bottom: 1px solid var(--border-color);
      border-bottom-width: 1px;
      background-color: var(--color-white);

      .change-flag {
        width: 8px;
        height: 8px;
        background-color: var(--color-warning);
        border-radius: 100px;
        margin-bottom: 18px;
        margin-left: 2px;
      }

      .header-title {
        font-weight: 400;
        font-size: 20px;
        line-height: 32px;
        letter-spacing: 0%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .operation-permission-tip {
        width: 18px;
        height: 18px;
        font-size: 18px;
        margin-left: 8px;
        color: var(--text-color-secondary);
      }

      .header-right {
        margin-left: auto;
        display: flex;

        .el-icon {
          cursor: pointer;
        }
      }
    }

    .body {
      flex: 1;
      height: 0px;
      width: 100%;
      padding: 16px;

      &>div {
        background-color: var(--color-white);
        width: 100%;
        height: 100%;
        border-radius: 4px;

        &:has(.api-setting) {
          padding: 0px;
        }
      }

      .basic-container {
        overflow: hidden;
        padding: 16px;
      }

      .page-container {
        display: flex;
      }

      .ai-placeholder-container {
        padding: 16px;
      }

      .ai-placeholder-panel {
        width: 100%;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 20px 24px;
      }

      .ai-placeholder-title {
        font-size: 16px;
        line-height: 24px;
        color: var(--text-color-primary);
      }

      .ai-placeholder-description {
        margin-top: 8px;
        font-size: 14px;
        line-height: 22px;
        color: var(--text-color-secondary);
      }
    }
  }
}
</style>


