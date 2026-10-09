<template>
  <div class="submit-form-layer" v-loading="loading" element-loading-custom-class="detail-loading-mask" :element-loading-text="$t('SubmitFormLayer.loading')">
    <div class="wrapper-scrollbar">
      <div class="wrapper" :class="isMobileDevice ? 'bg-hidden' : ''">
        <x-widget :widget="widget" v-if="widget" @draft-saved="emit('draft-saved')" @form-submitted="handleFormSubmitted" @view-data="handleViewData" />
      </div>
    </div>
  </div>
  <template v-if="dialogVisible">
    <mobile-view-data-dialog
      v-if="isMobileDevice"
      v-model="dialogVisible"
      :table="table"
      :uuid="viewDataUid"
      :fieldsAuth="props.fieldsAuth"
    />
    <view-data-dialog
      v-else
      v-model="dialogVisible"
      :table="table"
      :uuid="viewDataUid"
      :fieldsAuth="props.fieldsAuth"
      :isAddDataAble="hasAddPermission"
      @submitted="handleDetailSubmitted"
      @deleted="handleDetailDeleted"
    />
  </template>
  <teleport
    :to="viewSettingDrawerSlotRef"
    :disabled="!viewSettingDrawerSlotRef"
  >
    <form-setting-panel
      v-if="isFormViewSettingVisible"
      :table="table"
      :currentView="props.currentTOC"
    />
  </teleport>
</template>

<script lang='ts' setup>
import { FieldAuthValue, FormViewConfig, PermissionRangeType, ViewSetting } from '@common/types/nocode';
import { getAllRelatedDepartments } from '@common/utils';
import { ProjectContext } from '@renderer/b2/types';
import { Board } from '@renderer/b2/controllers/board';
import { FormElement } from '@renderer/b2/controllers/form';
import { Widget } from '@renderer/b2/controllers/widget';
import type { PropType, ShallowRef } from 'vue';
import { computed, inject, nextTick, onBeforeUnmount, provide, reactive, ref, shallowRef, watch } from 'vue';
import { FORM_VIEW_CONFIG, FormMode, HAS_WIDGET_MOUNTED, HOVER_WIDGET, NOCODE, ORGANIZE_UTIL, VIEW_ACTIVE_UID, VIEW_SETTING_DRAWER_SLOT, VISIBLE } from '@renderer/types';
import { usePassportStore } from '@renderer/stores';
import { formDataApi } from '@renderer/views/nocode/utils';
import { OrganizeUtil } from '@renderer/views/nocode/utils/organize.util';
import { useFormData, useFormTable } from '../../editor/form/hooks';
import { isMobile, useRuntime } from "@renderer/utils";
import { getBoardConnectionsByNocodeBody, getNocodeDataSourceByUID } from '@common/utils/connection';
import { isDataChangeTriggerStashEnabled } from '@common/utils';
import FormSettingPanel from '../dialog/components/FormSettingPanel.vue';
import { DataChangeType } from '@common/types/project';
import { WORKBENCH_AI_FORM_FILL_SCOPE } from '@renderer/views/nocode/views/workbench/AI/workbenchAiFormFillContext';

const isMobileDevice = isMobile();
type SubmitFormWidget = FormElement & {
  fieldsAuth?: Record<string, FieldAuthValue> | "all";
  setFieldsAuth?: (fieldsAuth?: Record<string, FieldAuthValue> | "all") => void;
};

const props = defineProps({
  active: {
    type: Boolean,
    required: true,
  },
  fieldsAuth: {
    type: [Object, String] as PropType<Record<string, FieldAuthValue> | "all">,
    default: undefined,
  },
  currentTOC: {
    type: Object as PropType<ViewSetting>,
    default: undefined,
  },
  formViewConfig: {
    type: Object as PropType<FormViewConfig>,
    default: undefined,
  },
});

const emit = defineEmits(['draft-saved', 'form-submitted']);

const runtime = useRuntime();
const connection = useFormData();
const table = useFormTable();
const nocode = inject(NOCODE);
const organizeUtil = inject<OrganizeUtil | null>(ORGANIZE_UTIL, null);
const activeTab = inject(VIEW_ACTIVE_UID, null);
const viewSettingDrawerSlotRef = inject(VIEW_SETTING_DRAWER_SLOT, null);
const passportState = usePassportStore();
const board = ref<Board>();
const widget = ref<FormElement>();
const loading = ref(true);
let isUnmounted = false;
const dialogVisible = ref(false);
const createFormFillContextId = () => `submit-form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formFillContextId = ref(createFormFillContextId());
provide(WORKBENCH_AI_FORM_FILL_SCOPE, {
  contextId: formFillContextId,
  active: computed(() => props.active),
});

const viewDataUid = ref();
const hasAddPermission = computed(() => {
  if (!props.currentTOC) {
    return true;
  }
  const currentTable = table.value;
  const addPermission = currentTable?.uid
    ? nocode.value?.body?.permissions?.data?.[currentTable.uid]?.add
    : null;
  if (!addPermission) {
    return true;
  }
  const account = passportState.account;
  if (!account) {
    return false;
  }
  if (account.isAdmin) {
    return true;
  }
  if (addPermission.rangeType === PermissionRangeType.CUSTOM) {
    const departments = getAllRelatedDepartments(organizeUtil?.departments || [], account.departments || []);
    if (addPermission.range.users.includes(account.id)) {
      return true;
    }
    if (addPermission.range.roles.some(role => account.roles?.includes(role))) {
      return true;
    }
    if (addPermission.range.departments.some(dep => departments.includes(dep))) {
      return true;
    }
    return false;
  }
  return true;
});
const runtimeFormViewConfig = computed<FormViewConfig>(() => {
  const baseConfig = props.formViewConfig || props.currentTOC?.formViewConfig as FormViewConfig | undefined;
  const currentTable = table.value;
  const process = currentTable?.uid
    ? connection.value?.formOptions?.[currentTable.uid]?.process
    : undefined;
  const stashVisibleByContext = !!props.currentTOC;
  const stashVisibleByConfig = baseConfig?.buttons?.stash?.visible !== false;
  return {
    ...(baseConfig || {}),
    buttons: {
      ...(baseConfig?.buttons || {}),
      stash: {
        ...(baseConfig?.buttons?.stash || {}),
        visible: stashVisibleByContext
          && stashVisibleByConfig
          && hasAddPermission.value
          && isDataChangeTriggerStashEnabled(process, DataChangeType.ADD),
      },
    },
  };
});
const isFormViewSettingVisible = computed(() => {
  return !isMobileDevice
    && !!viewSettingDrawerSlotRef?.value
    && props.currentTOC?.type === "form"
    && activeTab?.value === props.currentTOC?.uid;
});

const init = async () => {
  board.value = new Board(reactive({ type: "board", options: {
    "container-layout": "fluid",
  } }), {
    typography: "page",
    get nocodeId() {
      return nocode.value?.meta?.id;
    },
    get runtime(){
      return runtime;
    },
    get formMode() {
      return FormMode.Add;
    },
    getElementByUID(uid: string[]) {
      if (!uid?.length) return undefined;
      const [, widgetUID] = uid;
      if (!widgetUID) return undefined;
      return board.value.getWidgetByUID(widgetUID);
    },
    getBoards() {
      return [board]
    },
    getConnections() {
      return getBoardConnectionsByNocodeBody(nocode.value?.body, {
        nocodeId: nocode.value?.meta?.id,
        name: nocode.value?.meta?.name,
      });
    },
    async readDataByOptions(optionTableUID, options) {
      if (!optionTableUID) return;
      const dataSource = getNocodeDataSourceByUID(nocode?.value?.body, optionTableUID[0], {
        nocodeId: nocode.value?.meta?.id,
        name: nocode.value?.meta?.name,
      });
      const formData = dataSource || nocode?.value?.body?.formData;
      if (!formData) return;
      const buckets = await formDataApi.getData({
        nocodeId: dataSource?.nocodeId || nocode.value?.meta?.id,
        tableUIDs: [optionTableUID[1]],
        options,
      });
      return buckets[0];
    },
  } as unknown as ProjectContext);
}

const initTableElement = async () => {
  if (isUnmounted || !board.value || !connection.value?.uid || !table.value?.uid) return;
  loading.value = true;
  try {
    board.value.widgets.map(w => board.value.container.removeWidget(w.uid));
    widget.value = null;
    await nextTick();
    if (isUnmounted || !board.value) return;
    const theWidget = await board.value.container.addWidget({
      type: "widget.form.submitform",
      uid: table.value.uid,
    }, 0) as SubmitFormWidget;
    theWidget.setTableOptionValue([connection.value.uid, table.value.uid]);
    theWidget.setFieldsAuth?.(props.fieldsAuth);
    if (!theWidget.setFieldsAuth) {
      theWidget.fieldsAuth = props.fieldsAuth || "all";
    }
    widget.value = theWidget;
  } catch (error) {
    console.error('[SubmitFormLayer] init submit form failed', error);
  } finally {
    loading.value = false;
  }
}
const handleFormSubmitted = (dataUid: string) => {
  emit("form-submitted", dataUid);
}
const handleViewData = (dataUid: string) => {
  viewDataUid.value = dataUid;
  dialogVisible.value = true;
}
const handleDetailSubmitted = () => {
  handleFormSubmitted(viewDataUid.value);
}
const handleDetailDeleted = async () => {
  viewDataUid.value = undefined;
  await initTableElement();
}

watch(() => {
  if (!props.active || !board.value?.isReady()) return null;
  return table.value?.uid;
}, (value) => {
  if (value) {
    void initTableElement();
  }
}, { immediate: true });

watch(() => props.active, (active, previousActive) => {
  if (active && !previousActive) {
    formFillContextId.value = createFormFillContextId();
  }
}, { immediate: true });

init();

onBeforeUnmount(() => {
  isUnmounted = true;
  const currentBoard = board.value;
  board.value = undefined;
  widget.value = undefined;
  currentBoard?.destroy();
});

const visibleRef = computed(() => true);
provide(VISIBLE, visibleRef);
const hoverWidget: ShallowRef<Widget> = shallowRef();
provide(HOVER_WIDGET, hoverWidget);
const hasWidgetMounted = ref(false);
provide(HAS_WIDGET_MOUNTED, hasWidgetMounted);
provide(FORM_VIEW_CONFIG, runtimeFormViewConfig);

</script>

<style lang='scss' scoped>
.submit-form-layer {
  width: 100%;
  height: 100%;
  overflow: hidden;

  .wrapper-scrollbar {
    height: 100%;
    overflow: hidden;
  }

  .wrapper {
    min-height: 100%;
    height: 100%;
    overflow: hidden;
    background-color: var(--bg-color-page);
    &.bg-hidden {
      background: none;
    }
  }
}
</style>
