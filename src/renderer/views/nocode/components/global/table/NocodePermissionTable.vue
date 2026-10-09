<template>
  <NocodeDataManagementTable ref="nocodeTableRef" :nocodeId="nocodeId" :tableUID="tableUID" 
    :isAddDataAble="isAvailable(attrs?.isAddDataAble) ? attrs?.isAddDataAble : getAddPermission" 
    :isImportDataAble="isAvailable(attrs?.isImportDataAble) ? attrs?.isImportDataAble : getAddPermission"
    :isEditDataAble="isAvailable(attrs?.isEditDataAble) ? attrs?.isEditDataAble : getOtherPermission.update" 
    :isDeleteDataAble="isAvailable(attrs?.isDeleteDataAble) ? attrs?.isDeleteDataAble : getOtherPermission.delete"
    :isShowMoreMenu="isAvailable(attrs?.isShowMoreMenu) ? attrs?.isShowMoreMenu : !isAggregateTable"
    :clickRowShowDetail="isAvailable(attrs?.clickRowShowDetail) ? attrs?.clickRowShowDetail : !isAggregateTable"
    :isShowAggregateRow="isShowAggregateRow"
    v-bind="attrs">
    <template
      v-for="(_, name) in slots"
      :key="name"
      #[name]="slotProps"
    >
      <slot :name="name" v-bind="slotProps" />
    </template>
    </NocodeDataManagementTable>
</template>

<script lang="ts" setup>
import { TableUID } from '@common/types/project';
import { getAllRelatedDepartments } from '@common/utils';
import { usePassportStore } from '@renderer/stores';
import { NOCODE, ORGANIZE_UTIL } from '@renderer/types';
import { isEmpty } from '@common/utils/object';
import { computed, reactive, useSlots } from 'vue';
import { inject } from 'vue';
import { useAttrs } from 'vue';
import axios from "axios";
import { NocodeBody } from '@common/types/nocode';
import { ref } from 'vue';
import { Ref } from 'vue';
import { onMounted } from 'vue';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { buildAggregateRuntimeTables, type AggregateRuntimeSource } from '@renderer/utils/aggregateTable';
import { useRoute } from 'vue-router';
import { isPublicDataPermissionBypassedRoute } from '@renderer/views/nocode/utils/data-permission';
import NocodeDataManagementTable from './NocodeDataManagementTable.vue';

const props = withDefaults(defineProps<{
  nocodeId: string,
  tableUID: TableUID,
  isShowAggregateRow?: boolean,
}>(), {
  isShowAggregateRow: false,
});

const attrs = useAttrs();
const slots = useSlots();
const organizeUtil = inject(ORGANIZE_UTIL, new OrganizeUtil());
const nocode = inject<any>(NOCODE, null);
const passportState = usePassportStore();
const nocodeBody: Ref<NocodeBody> = ref();
const getAggregateRuntimeSources = () => {
  const sources: AggregateRuntimeSource[] = [];
  if (nocodeBody.value?.formData?.uid) {
    sources.push({
      uid: nocodeBody.value.formData.uid,
      nocodeId: props.nocodeId,
      tables: nocodeBody.value.formData.tables || [],
      aggregateTables: nocodeBody.value.formData.aggregateTables || [],
    });
  }
  (nocodeBody.value?.otherDataSources || []).forEach(source => {
    if (!source?.uid) return;
    sources.push({
      uid: source.uid,
      nocodeId: source.nocodeId,
      tables: source.tables || [],
      aggregateTables: source.aggregateTables || [],
    });
  });
  return sources;
}
const aggregateRuntimeTables = computed(() => {
  const runtimeSources = getAggregateRuntimeSources();
  return runtimeSources.flatMap(source => buildAggregateRuntimeTables(source, runtimeSources));
});
const table = computed(() => {
  const currentTables = nocodeBody.value?.formData?.tables || [];
  const otherTables = (nocodeBody.value?.otherDataSources || []).flatMap(source => source.tables || []);
  return [...currentTables, ...otherTables, ...aggregateRuntimeTables.value].find(table => table.uid === props.tableUID);
});
const isAggregateTable = computed(() => {
  return aggregateRuntimeTables.value.some(table => table.uid === props.tableUID);
});
const nocodeTableRef = ref();
const route = useRoute();
const isPublicVisit = computed(() => isPublicDataPermissionBypassedRoute(route));

// 获取提交数据权限
const getAddPermission = computed(() => {
  if (isPublicVisit.value) return false;
  if (!nocodeBody.value) return false;
  if (isAggregateTable.value) return false;
  if (!table.value?.uid) return false;
  const addPermission = nocodeBody.value?.permissions?.data?.[table.value.uid]?.add;
  if (!addPermission) return true;
  const account = passportState.account
  const departments = getAllRelatedDepartments(organizeUtil.departments, account.departments);

  if (addPermission?.rangeType === 'custom' && !account.isAdmin) {
    if (addPermission.range.users.includes(account.id)) {
      return true
    }
    if (addPermission.range.roles.some(role => account.roles.includes(role))) {
      return true
    }
    if (addPermission.range.departments.some(dep => departments.includes(dep))) {
      return true
    }

    return false
  }
  return true
})

const getOtherPermission = computed(() => {
  if (isAggregateTable.value) {
    return { delete: false, update: false }
  }
  if (isPublicVisit.value) {
    return { delete: false, update: false }
  }
  if (!table.value?.uid) {
    return { delete: false, update: false }
  }
  const account = passportState.account
  if (account.isAdmin) {
    return { delete: true, update: true }
  }

  if (isEmpty(nocodeBody.value?.permissions?.data?.[table.value.uid]?.other?.length)) {
    return { delete: true, update: true }
  }

  const result = {
    delete: false,
    update: false
  }
  const departments = getAllRelatedDepartments(organizeUtil.departments, account.departments);

  // 规则：默认没有权限，如有一个条件指明他有这个权限他就有
  const permissions = nocodeBody.value?.permissions?.data?.[table.value.uid]?.other ?? []
  for (const permission of permissions) {
    const needHandle = (permission.handleRange.delete && !result.delete) || (permission.handleRange.update && !result.update);
    if (!needHandle) continue;
    if (
      permission.memberRange?.rangeType === 'all' ||
      permission.memberRange?.range?.users?.includes(account.id) ||
      permission.memberRange?.range?.roles?.some(role => account.roles?.includes(role)) ||
      permission.memberRange?.range?.departments?.some(dep => departments.includes(dep))
    ) {
      result.delete = result.delete || permission.handleRange?.delete
      result.update = result.update || permission.handleRange?.update
    }
    if (result.delete && result.update) break;
  }

  return result
})

const isAvailable = (value: any) => {
  return value !== undefined && value !== null;
}

const getInjectedNocodeBody = () => {
  const injectedBody = nocode?.value?.body;
  const injectedNocodeId = nocode?.value?.meta?.id;
  if (!injectedBody?.formData) return null;
  if (injectedNocodeId && props.nocodeId && injectedNocodeId !== props.nocodeId) {
    return null;
  }
  return injectedBody as NocodeBody;
}

const getNocodeBody = async () => {
  const injectedBody = getInjectedNocodeBody();
  if (injectedBody) {
    return injectedBody;
  }
  return await axios.get(`project/get-nocode-body/${props.nocodeId}`).then(({ data }) => data).catch(() => null);
}


const init = async () => {
  nocodeBody.value = await getNocodeBody();
}

init();

const exposed = reactive({})
onMounted(async () => {
  if (nocodeTableRef.value) {
    // 获取nocodeTableRef的所有方法和属性
    Object.keys(nocodeTableRef.value).forEach(key => {
      // 使用Object.defineProperty确保属性可枚举
      Object.defineProperty(exposed, key, {
        value: nocodeTableRef.value[key],
        enumerable: true,
        writable: true,
        configurable: true
      })
    })
  }
  if (isPublicVisit.value) {
    return;
  }
  if (!organizeUtil.departments?.length) {
    await organizeUtil.getDepartments();
  }
  if (!organizeUtil.roleList?.length) {
    await organizeUtil.getRoles();
  }
  if (!organizeUtil.users?.length) {
    await organizeUtil.getUsers();
  }
})

defineExpose(exposed)
</script>

<style></style>
