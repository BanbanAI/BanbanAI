<template>
  <div class="album-view" :class="{'mobile': isMobileDevice}">
    <div class="wrapper">
      <NocodeDataManagementTable
        v-if="isShowTable"
        :active="props.active"
        :nocodeId="nocode.meta?.id"
        :tableUID="table.uid"
        :uid="currentTOC?.uid"
        :viewId="currentTOC?.uid"
        :actions="currentTOC?.actions || []"
        :isAlbum="isAlbum"
        :hideColumnsAble="!isAlbum"
        :isAddDataAble="getAddPermission"
        :isImportDataAble="getAddPermission"
        :isEditDataAble="getOtherPermission.update"
        :isDeleteDataAble="getOtherPermission.delete"
        :isChangeFilterDisplayMode="true"
        :preViewFilterRules="currentViewFilterRules"
        :preHiddenColumns="currentTOC?.hiddenColumns"
        :preColumnOrders="currentTOC?.columnOrders"
        :enableShareLinkColumn="true"
        ref="nocodeTableRef"
        @submitted="emit('submitted')"
      />
      <el-button
        v-if="isMobileDevice"
        type="primary"
        circle
        class="add-data-button"
        @click="handleAddData">
        <el-icon size="24"><i-ep-plus/></el-icon>
      </el-button>
    </div>

    <teleport
      :to="viewSettingDrawerSlotRef"
      :disabled="!viewSettingDrawerSlotRef"
    >
      <album-setting-panel
        v-if="isAlbumViewSettingVisible"
        :table="table"
        :currentTOC="currentTOC"
      ></album-setting-panel>
    </teleport>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, ref, watch } from "vue";
import { useFormTable } from "./hooks";
import { NOCODE, VIEW_ACTIVE_UID, VIEW_SETTING_DRAWER_SLOT } from "@renderer/types";
import { usePassportStore } from '@renderer/stores';
import { ORGANIZE_UTIL } from '@renderer/types';
import { CatalogViewSetting } from "@common/types/nocode";
import { isEmpty } from '@common/utils/object';
import { isMobile } from "@renderer/utils";
import { FormMode } from "@renderer/views/nocode/components/global/table/types";
import { getAllRelatedDepartments } from "@common/utils";
import NocodeDataManagementTable from "../../../components/global/table/NocodeDataManagementTable.vue";

const isMobileDevice = isMobile();

const viewSettingDrawerSlotRef = inject(VIEW_SETTING_DRAWER_SLOT)

const props = defineProps<{
  active: boolean;
  currentTOC: CatalogViewSetting;
}>();
const emit = defineEmits<{
  (event: 'submitted'): void;
}>();
const table = useFormTable();
const nocode = inject(NOCODE);
const passportState = usePassportStore()
const organizeUtil = inject(ORGANIZE_UTIL)
const activeTab = inject(VIEW_ACTIVE_UID)

// 引入表格组件的引用
const nocodeTableRef = ref()
const isShowTable = ref(false)

const isAlbum = computed(() => {
  return props.currentTOC?.type === "album" && props.currentTOC?.uid === activeTab.value;
});
const isAlbumViewSettingVisible = computed(() => {
  return !!table.value
    && !isMobileDevice
    && !!viewSettingDrawerSlotRef?.value
    && isAlbum.value;
});
const currentViewFilterRules = computed(() => {
  const filterRules = props.currentTOC?.viewFilterRules;
  if (!filterRules?.conditions?.length) {
    return undefined;
  }
  return [filterRules];
});

watch(() => props.active, (value) => {
  if (value && !isShowTable.value) {
    isShowTable.value = true;
  }
}, { immediate: true })

// 获取提交数据权限
const getAddPermission = computed(() => {
  const addPermission = nocode.value.body.permissions?.data?.[table.value.uid]?.add;
  if (!addPermission) return true;
  const account = passportState.account
  const departments = getAllRelatedDepartments(organizeUtil.departments, account.departments)

  if(addPermission?.rangeType === 'custom' && !account.isAdmin) {
    if(addPermission.range.users.includes(account.id)) {
      return true
    }
    if(addPermission.range.roles.some(role => account.roles.includes(role))) {
      return true
    }
    if(addPermission.range.departments.some(dep => departments.includes(dep))) {
      return true
    }

    return false
  }
  return true
})

// 获取删除编辑权限
const getOtherPermission = computed(() => {
  const account = passportState.account
  if(account.isAdmin) {
    return { delete: true, update: true }
  }

  if(isEmpty(nocode.value?.body?.permissions?.data?.[table.value.uid]?.other?.length)) {
    return { delete: true, update: true }
  }

  const result = {
    delete: false,
    update: false
  }
  const departments = getAllRelatedDepartments(organizeUtil.departments, account.departments);

  // 规则：默认没有权限，如有一个条件指明他有这个权限他就有
  const permissions = nocode.value?.body?.permissions?.data?.[table.value.uid]?.other ?? []
  for(const permission of permissions) {
    const needHandle = (permission.handleRange.delete && !result.delete) || (permission.handleRange.update && !result.update);
    if(!needHandle) continue;
    if(
      permission.memberRange?.rangeType === 'all' ||
      permission.memberRange?.range?.users?.includes(account.id) || 
      permission.memberRange?.range?.roles?.some(role => account.roles?.includes(role)) ||
      permission.memberRange?.range?.departments?.some(dep => departments.includes(dep))
    ) {
      result.delete = result.delete || permission.handleRange?.delete
      result.update = result.update || permission.handleRange?.update
    }
    if(result.delete && result.update) break;
  }
  
  return result
})

const handleAddData = () => {
  // 调用子组件的方法来显示添加数据的表单
  if (nocodeTableRef.value) {
    nocodeTableRef.value.showFormRowDialog(FormMode.Add)
  }
}
</script>

<style lang="scss" scoped>
.album-view {
  width: 100%;
  height: 100%;
  padding: 16px;

  .wrapper {
    height: 100%;
    background-color: var(--bg-color-page);
  }
}

.album-view.mobile {
  padding: 0 10px;

  .add-data-button {
    width: 48px;
    height: 48px;
    position: absolute;
    right: 40px;
    bottom: 100px;
    -webkit-tap-highlight-color: transparent;
  }
}
</style>
