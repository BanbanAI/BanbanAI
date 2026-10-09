<template>
  <div class="nocode-form-dialog">
    <el-dialog
      class="mobile-nocode-form-dialog"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)" 
      @opened="emit('opened')" 
      align-center
      :show-close="false"
      destroy-on-close
      ref="dialogRef"
    >
      <div class="container">
        <div class="title">
          <div class="title-left" @click="handleBack">
            <el-icon>
              <i-ep-arrow-left/>
            </el-icon>
            {{ props.formName }}
          </div>
          <div class="title-right" v-show="drafts.length !== 0" @click.stop="openDraftBox">
            <img class="icon" src="@renderer/assets/icons/mobile/viewer/drafts.svg" alt="">
            <span class="text">{{ $t('MobileNocodeFormDialog.draftBox') }}</span>
            <el-badge :value="drafts.length" :show-zero="false" style="display: flex;margin-left: 4px;">
            </el-badge>
          </div>
        </div>
        <div class="view-options">
          <el-select
            popper-class="mobile-view-select-popper"
            v-if="viewOptions.length > 0"
            v-model="viewValue"
            placeholder="Select"
            style="width: 150px"
            :show-arrow="false"
            @change="handleSelectView">
            <el-option
              v-for="item in viewOptions || []"
              :key="item.uid"
              :label="item.name"
              :value="item.uid"
            />
          </el-select>
        </div>
        <div class="formdata-viewer">
          <mobile-form-data-viewer
            ref="formDataViewerRef"
            :key="activeFormId"
            :tableId="activeFormId"
            :viewInfo="selectedView"
            @draft-saved="handleDraftSaved"
            @submitted="emit('submitted')"
          />
        </div>
      </div>
    </el-dialog>
  </div>
  <mobile-form-draft-list-dialog
    v-model="draftBoxListVisible"
    :drafts="drafts"
    :table="table"
    :enable-clear="true"
    @delete="handleDeleteDraft"
    @clear="handleClearDrafts"
    @submitted="handleDraftSubmitted"
    @updated="handleDraftSaved"
  />
</template>

<script lang="ts" setup>
import { ref, computed, inject, watch, Ref, provide, onMounted } from 'vue'
import { Row } from '@common/types/project';
import { Nocode, ViewSetting } from '@common/types/nocode';
import { NOCODE, VIEW_ACTIVE_UID } from '@renderer/types';
import { formDataApi, getVisibleViewsForCurrentAccount, OrganizeUtil } from '@renderer/views/nocode/utils';
import { useRoute } from 'vue-router';
import { ElMessage } from "element-plus";
import { SystemField } from '@common/utils';
import i18next from 'i18next';
import { usePassportStore } from '@renderer/stores';

const props = defineProps<{
  modelValue: boolean,
  formName: string,
  activeFormId: string, // tableId
}>();
const emit = defineEmits<{
  (event: "closed"),
  (event: "opened"),
  (event: "submit"),
  (event: "back"),
  (event: 'cancel'),
  (event: "update:modelValue", value: boolean),
  (event: "submitted"),
}>();

const nocode: Ref<Nocode> = inject(NOCODE);
const passportState = usePassportStore();
const organizeUtil = new OrganizeUtil();
const updateNocodeMainSign = (sign: string) => {
  nocode.value.body.sign = sign;
};
const formData = computed(() => {
  return nocode.value?.body?.formData;
})
const table = computed(() =>{
  return formData.value?.tables?.find(table => table.uid === props.activeFormId);
})

const mobileViews = ['form', 'table', 'album'];
const selectedView = ref<ViewSetting>();
const viewValue = ref<string | null>(null);
const viewOptions = computed(() => {
  const views = getVisibleViewsForCurrentAccount({
    views: nocode.value?.body?.views?.[props.activeFormId],
    tableId: props.activeFormId,
    permissions: nocode.value?.body?.permissions?.view,
    account: passportState.account,
    departments: organizeUtil.departments,
  });
  return views.filter(view => mobileViews.includes(view.type));
})

const drafts = ref<Row[]>([]);
let draftsLoadedKey = "";
const draftsPromises = new Map<string, Promise<void>>();
const draftBoxListVisible = ref(false)
const formDataViewerRef = ref<{ refreshActiveDataView?: () => void | Promise<void> } | null>(null)
const openDraftBox = () => {
  draftBoxListVisible.value = true;
}
const route = useRoute();
const nocodeId = route.params.nocodeId as string;
const ensureDepartmentsLoaded = async () => {
  if (organizeUtil.departments.length) return;
  await organizeUtil.getDepartments();
}
const getDrafts = async () => {
  const draftKey = `${nocodeId}:${props.activeFormId}`;
  if (draftsLoadedKey === draftKey) return;
  let draftsPromise = draftsPromises.get(draftKey);
  if (!draftsPromise) {
    draftsPromise = formDataApi.getDrafts({
      nocodeId,
      tableUID: props.activeFormId,
    }).then((data) => {
      if (data) {
        drafts.value = data;
        draftsLoadedKey = draftKey;
        if (!data?.length) draftBoxListVisible.value = false;
      }
    }).finally(() => draftsPromises.delete(draftKey));
    draftsPromises.set(draftKey, draftsPromise);
  }
  await draftsPromise;
}
const handleDraftSaved = async () => {
  draftsLoadedKey = "";
  await getDrafts();
}
onMounted(() => {
  void ensureDepartmentsLoaded();
});

watch(() => props.modelValue, (visible) => {
  if (!visible) return;
  void ensureDepartmentsLoaded();
}, { immediate: true });

watch(() => props.activeFormId, () => {
  getDrafts()
})
const handleSelectView = (value: string) => {
  const view = viewOptions.value.find(view => view.uid === value);
  if (view) {
    selectedView.value = view;
  }
}
const deleteDraftRows = async (rows: Row[]) => {
  if (!rows.length) return false;
  const table = formData.value?.tables?.find(table => table.uid === props.activeFormId);
  if (!table) return;
  const uuidField = table.fields.find(field => field.meta.name === SystemField.UUID);
  if (!uuidField) return;
  return await formDataApi.deleteDraft({
    nocodeId,
    tableUID: props.activeFormId,
    rows,
    keys: [ [formData.value.uid, table.uid, uuidField.uid] ],
    sign: nocode.value.body.sign,
    onMainSign: updateNocodeMainSign,
  })
}
const handleDeleteDraft = async (row: Row) => {
  const res = await deleteDraftRows([ row ]);
  if (res) {
    ElMessage.success(i18next.t('MobileNocodeFormDialog.deleteSuccess'));
    drafts.value = drafts.value.filter(item => item[SystemField.UUID] !== row[SystemField.UUID]);
    if (!drafts.value.length) draftBoxListVisible.value = false;
  }
}
const handleClearDrafts = async () => {
  const res = await deleteDraftRows([ ...drafts.value ]);
  if (res) {
    ElMessage.success(i18next.t('MobileNocodeFormDialog.clearDraftSuccess'));
    drafts.value = [];
    draftBoxListVisible.value = false;
  }
}
const handleDraftSubmitted = async () => {
  draftsLoadedKey = "";
  await Promise.all([
    getDrafts(),
    formDataViewerRef.value?.refreshActiveDataView?.(),
  ]);
  emit('submitted');
}
const handleBack = async () => {
  emit('update:modelValue', false);
}

watch(viewOptions, (views) => {
  if (!views.length) {
    selectedView.value = undefined;
    viewValue.value = null;
    return;
  }

  const currentView = views.find(view => view.uid === viewValue.value);
  const nextView = currentView || views[0];
  selectedView.value = nextView;
  if (viewValue.value !== nextView.uid) {
    viewValue.value = nextView.uid;
  }
}, { immediate: true });

provide(VIEW_ACTIVE_UID, viewValue);
</script>

<style lang="scss" scoped>
.nocode-form-dialog {
  :deep(.el-dialog.mobile-nocode-form-dialog) {
    width: 100%;
    height: 100%;
    overflow: hidden;
    padding: 0;
    background-color: var(--bg-color-page);
    > .el-dialog__header {
      display: none;
    }
    > .el-dialog__body {
      width: 100%;
      height: 100%;
    }
  }
  .container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;

    .title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 44px;
      min-height: 44px;
      padding: 16px;
      padding-top: 24px;
      box-sizing: content-box;

      .title-left {
        font-size: 16px;
        font-weight: 500;
        display: flex;
        align-items: center;
        color: var(--text-color-primary);
        .el-icon {
          margin-right: 8px;
        }
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .title-right {
        display: flex;
        align-items: center;
        .icon {
          width: 16px;
          height: 16px;
          margin-right: 4px;
        }
        .text {
          font-size: 12px;
          font-weight: 400;
        }
      }
    }
    .view-options {
      padding: 0 16px;
      :deep(.el-select) {
        width: 100% !important;
        -webkit-tap-highlight-color: transparent;
        .el-select__wrapper {
          border-radius: 4px;
        }
      }
    }
    .formdata-viewer {
      margin-top: 8px;
      width: 100%;
      flex: 1;
      overflow-y: auto;
      padding: 0 6px 16px;
    }

    .submit-success-wrapper {
      width: 100%;
      height: 100%;
      background: #fff;

      i {
        color: #0873FF;
      }

      .submit-success {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        position: relative;
        top: 20%;
        .tip {
          margin-top: 8px;
          font-size: 20px;
        }
        .btns {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 24px;
          .el-button {
            width: 120px;
            height: 32px;
            border-radius: 4px;
            font-size: 14px;
          }
          .view-data {
            margin-top: 8px;
            margin-right: 11.5px;
          }
        }  
      }
    }
  }
}
</style>
<style lang="scss">
.el-popper.mobile-view-select-popper {
  background-color: var(--bg-color-page);
  border-radius: 4px;
  border: 1px solid var(--border-color);

  .el-select-dropdown__list {
    .el-select-dropdown__item {
      -webkit-tap-highlight-color: transparent;
      &:active {
        background-color: var(--bg-color-overlay);
      }
    }
    .is-selected {
      background-color: var(--bg-color-overlay);
    }
  }
}
</style>
