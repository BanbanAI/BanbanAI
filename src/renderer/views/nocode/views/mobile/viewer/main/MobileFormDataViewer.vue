<template>
  <div class="mobile-form-data-viewer">
    <submit-form-layer
      :active="true"
      :currentTOC="viewInfo"
      v-if="viewInfo?.type === 'form'"
      @draft-saved="emit('draft-saved')"
      @form-submitted="handleFormSubmitted"
    />
    <DataManagementV2
      ref="dataManagementRef"
      :active="true"
      :uid="viewInfo?.uid || tableId"
      :currentTOC="viewInfo"
      v-if="viewInfo?.type === 'table'"
      @submitted="emit('submitted')"
      @draft-saved="emit('draft-saved')"
    />
    <album-view
      v-if="viewInfo?.type === 'album'"
      :active="true"
      :currentTOC="viewInfo"
      @submitted="emit('submitted')"
    />
  </div>
</template>

<script lang='ts' setup>
import { NOCODE, FORM_DATA_VIEWER_EMITTER } from '@renderer/types';
import { computed, inject, markRaw, watch, ref, shallowRef, toRaw, nextTick, Ref, onMounted, provide, onUnmounted } from 'vue';
import { provideFormData, provideFormTable } from '../../../editor/form/hooks';
import { Nocode, ViewSetting } from '@common/types/nocode';
import { unique } from '@common/utils/unique';
import { provideRuntime } from '@renderer/utils';
import { FormTableRuntime } from "@common/types/nocode";
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { ORGANIZE_UTIL, VIEW_SETTING_DRAWER_REF, VIEW_SETTING_DRAWER_SLOT } from '@renderer/types';
import { Events, EventBusEvents } from '../../../viewer/main/formDataViewerEmitter';
import mitt, { Emitter } from "mitt";
import i18next from 'i18next';
import DataManagementV2 from '../../../editor/form/DataManagementV2.vue';

const props = defineProps<{
  tableId: string,
  viewInfo: ViewSetting
}>();

const emit = defineEmits<{
  (event: "draft-saved")
  (event: "form-submitted", dataUid: string)
  (event: "submitted")
}>();

const formDataViewerEmitter: Emitter<EventBusEvents> = mitt<EventBusEvents>();

const nocode: Ref<Nocode> = inject(NOCODE);
const organizeUtil = new OrganizeUtil()
provide(ORGANIZE_UTIL, organizeUtil)

const viewSettingDrawerRef = ref(null)
const viewSettingDrawerSlotRef = ref<HTMLElement>(null)
const dataManagementRef = ref<{ refreshData?: () => void | Promise<void> } | null>(null)
provide(FORM_DATA_VIEWER_EMITTER, formDataViewerEmitter)
provide(VIEW_SETTING_DRAWER_REF, viewSettingDrawerRef)
provide(VIEW_SETTING_DRAWER_SLOT, viewSettingDrawerSlotRef)
onMounted(async () => {
  await organizeUtil.getDepartments();
})

const formData = computed(() => {
  return nocode?.value?.body?.formData;
});

const table = computed(() => {
  return formData.value?.tables?.find(t => t.uid === props.tableId);
})

provideFormData(formData);
provideFormTable(table);

const initViewData = () => {
  if(!nocode.value.body.views) {
    nocode.value.body.views = {}
  }
  if (!(props.tableId in nocode.value.body.views)) {
    nocode.value.body.views[props.tableId] = [
      {
        uid: unique(),
        name: i18next.t('MobileFormDataViewer.form'),
        type: "form"
      },
      {
        uid: unique(),
        name: i18next.t('MobileFormDataViewer.dataManagementTable'),
        type: "table"
      },
    ]
  }
}
initViewData()

watch(() => props.tableId, (newVal, oldVal) => {
  initViewData()
});

const handleFormSubmitted = (dataUid) => { 
  emit("form-submitted", dataUid)
}

provideRuntime(FormTableRuntime.FORM_VIEWER);

defineExpose({
  refreshActiveDataView: () => dataManagementRef.value?.refreshData?.(),
});

onUnmounted(() => {
  formDataViewerEmitter.all.clear()
})
</script>

<style lang='scss' scoped>
.mobile-form-data-viewer {
  width: 100%;
  height: 100%;
}
</style>
