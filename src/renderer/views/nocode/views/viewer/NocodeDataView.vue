<template>
  <div class="data-management" :class="{ 'mobile': isMobile() }">
    <div class="wrapper">
      <NocodeDataManagementTable
        :active="props.active"
        :nocodeId="nocode?.meta?.id"
        :tableUID="table.uid"
        v-if="isShowTable"
        :isAddDataAble="getAddPermission"
        :isImportDataAble="false"
        :isExportDataAble="false"
        :isShowMoreMenu="false"
        :clickRowChecked="true"
        rowDetailTrigger="dblclick"
        v-bind="attrs"
        :isEditDataAble="getOtherPermission.update"
        :isDeleteDataAble="getOtherPermission.delete"
        :preFilterRule="filter"
        :enableShareLinkColumn="true"
        ref="nocodeTableRef"
      />
      <el-button type="primary" circle class="add-data-button" @click="handleAddData" v-if="isMobile()">
        <el-icon size="24">
          <i-ep-plus/>
        </el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="layout">
import { ref, provide, computed, onMounted, nextTick, watch, useAttrs } from 'vue';
import { usePassportStore } from '@renderer/stores';
import { FormConditionValueType, LogicalOperator, Nocode } from '@common/types/nocode';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { NOCODE_THEME_COLOR, NOCODE, NOCODE_ID, ORGANIZE_UTIL, ClientTheme } from '@renderer/types';
import { provideFormTable } from '../editor/form/hooks';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { isEmpty } from '@common/utils/object';
import { formDataApi, isMobile } from "@renderer/utils";
import { FormMode } from "../../components/global/table/types";
import { getAllRelatedDepartments } from '@common/utils';
import NocodeDataManagementTable from "../../components/global/table/NocodeDataManagementTable.vue";

const props = withDefaults(defineProps<{
  active?: boolean,
  nocodeId?: string,
  tableId?: string,
  filterPath?: string,
}>(), {
  active: true,
})

const emit = defineEmits<{
  (event: 'title-change', value: string): void
}>()

const attrs = useAttrs();

const passportState = usePassportStore();

// 获取nocodeMeta，并设置title
const route = useRoute();
const nocodeId = props.nocodeId || route.params.nocodeId as string;
const tableId = props.tableId || route.params.layerId as string;
const filterPath = props.filterPath || route.query.filter as string;
const organizeUtil = new OrganizeUtil()

const nocode = ref<Nocode>();
passportState.init(nocodeId);

const table = computed(() => {
  return nocode.value?.body?.formData?.tables.find(item => item.uid === tableId)
})
const resolvedTableTitle = computed(() => String(table.value?.alias || table.value?.name || '').trim())

const filter = ref({
  logic: LogicalOperator.AND,
  conditions: [],
})
const filterReady = ref(false);
const initNocode = async () => {
  try {
    let res = await axios.get(`workbench/${nocodeId}/get-nocode-preview?filter=sharing`);
    const theNocode: Nocode = res.data;
    nocode.value = theNocode;
    document.title = nocode.value?.meta?.name;
  }catch(err) {
    console.log("get nocode error", err);
  }
}
const initFilter = async () => {
  if(!filterPath) {
    return
  }
  const base64 = window.atob(filterPath)
  const _f = JSON.parse(base64)

  const _tableUID = _f.tableUID
  const _fieldUID = _f.fieldUID
  const _rowUUID = _f.rowUUID
  const _subRowUUID = _f.subRowUUID
  const _mainTableUID = _f.mainTableUID
  const sourceNocodeId = _f.sourceNocodeId || nocodeId
  const sourceNocode = sourceNocodeId === nocodeId
    ? nocode.value
    : (await axios.get(`workbench/${sourceNocodeId}/get-nocode-preview?filter=sharing`)).data as Nocode
  const sourceTables = sourceNocode?.body?.formData?.tables || []

  const isInSubTable = _mainTableUID !== _tableUID

  const data = await formDataApi.getData({
    nocodeId: sourceNocodeId,
    tableUIDs: [_mainTableUID],
    options: {}
  })
  const row = data[0].rows.find(item => item[data[0].fields.find(f => f.meta?.name == "_uuid").uid] === _rowUUID)
  let subRow = null

  if(isInSubTable) {
    const subData = await formDataApi.getData({
      nocodeId: sourceNocodeId,
      tableUIDs: [_tableUID],
      options: {}
    })
    subRow = subData[0].rows.find(item => item[subData[0].fields.find(f => f.meta?.name == "_uuid").uid] === _subRowUUID)
  }

  const _table = sourceTables.find(item => item.uid === _mainTableUID)
  const _subTable = sourceTables.find(item => item.uid === _tableUID)
  const _field =(isInSubTable ? _subTable : _table)?.fields?.find(item => item.uid === _fieldUID)

  const dataFilter = _field?.meta?.extra?.linkFormFilter || {
    logic: LogicalOperator.AND,
    conditions: [],
  }

  for(let condition of dataFilter.conditions) {
    if((condition as any).fieldType === FormConditionValueType.FORM) {
      if(condition.value.split(".").length === 2) {
        condition.value = subRow[_subTable?.fields?.find(item => item.meta?.uid === condition.value.split(".")[1])?.uid]
      } else {
        condition.value = row[_table?.fields?.find(item => item.meta?.uid === condition.value)?.uid]
      }
    }
  }

  filter.value = dataFilter
}

onMounted(async () => {
  await initNocode()
  await organizeUtil.getDepartments()
  await organizeUtil.getUsers()
  await organizeUtil.getAllUsers()
  await organizeUtil.getRoles()
  try {
    await initFilter()
  } catch (err) {
    console.log("init filter error", err)
  } finally {
    filterReady.value = true;
    if (table.value?.uid) {
      await initTableElement();
    }
  }
})

provide(NOCODE, nocode);
provide(NOCODE_ID, nocodeId);
provideFormTable(table)
provide(ORGANIZE_UTIL, organizeUtil)
const themeColor = ref("#0089ff")
provide(NOCODE_THEME_COLOR, themeColor); 
// 引入表格组件的引用
const nocodeTableRef = ref()

const isShowTable = ref(false);
const initTableElement = async () => {
  isShowTable.value = false;
  await nextTick();
  isShowTable.value = true;
}

watch(() => {
  return table.value?.uid;
}, (value) => {
  if (value && filterReady.value) {
    initTableElement();
  }
}, { immediate: true });

watch(resolvedTableTitle, (value) => {
  emit('title-change', value)
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

<style lang='scss' scoped>
.data-management {
  width: 100%;
  height: 100%;
  padding: 16px;
  
  .wrapper {
    height: 100%;
    background-color: var(--bg-color-page);

    .add-data-button {
      width: 48px;
      height: 48px;
      position: absolute;
      right: 40px;
      bottom: 136px;
      -webkit-tap-highlight-color: transparent;
    }
  }

  &.mobile {
    padding: 0 10px;
    .wrapper {
      .add-data-button {
        bottom: 100px;
      }
    }
  }
}
</style>
