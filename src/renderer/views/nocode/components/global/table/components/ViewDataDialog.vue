<template>
  <data-form-dialog
    v-if="detailReady"
    v-model="visible"
    :title="table.alias"
    :nocodeFormProps="nocodeFormProps"
    :form-mode="FormMode.Edit"
    :modal-only="true"
    @copy="openCopyDialog"
    @submitted="handleSubmitted"
    @deleted="handleDeleted"
  />
  <data-form-dialog
    v-if="detailReady"
    v-model="copyDialogVisible"
    :title="table.alias"
    :nocodeFormProps="copyNocodeFormProps"
    :form-mode="FormMode.Add"
    :modal-only="true"
    @submitted="handleCopySubmitted"
  />
</template>

<script lang="ts" setup>
import { computed, inject, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Row, Table as ProjectTable } from '@common/types/project';
import { FieldAuthValue } from '@common/types/nocode';
import { NOCODE, ORGANIZE_UTIL } from '@renderer/types';
import { useRuntime } from '@renderer/utils';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { provideFormMode, provideTable, provideTableProps } from '../hooks';
import { Table } from '../table';
import { FormMode, TableProps } from '../types';
import { provideFormTable } from '@renderer/views/nocode/views/editor/form/hooks';

const props = defineProps<{
  modelValue: boolean,
  table: ProjectTable,
  uuid: string,
  fieldsAuth?: Record<string, FieldAuthValue> | "all",
  isAddDataAble: boolean,
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void,
  (e: 'submitted'): void,
  (e: 'deleted'): void,
}>();

const route = useRoute();
const runtime = useRuntime();
const nocode = inject(NOCODE);
const injectedOrganizeUtil = inject<OrganizeUtil | null>(ORGANIZE_UTIL, null);
const organizeUtil = injectedOrganizeUtil || new OrganizeUtil();
const isPublicShare = computed(() => {
  return route.matched.some(record => record.meta?.isPublicShare === true || record.meta?.isPublicRowShare === true)
    || route.meta?.isPublicShare === true
    || route.meta?.isPublicRowShare === true
    || route.name === 'PublicQuery';
});
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});
const tableProps = reactive<TableProps>({
  nocodeId: '',
  tableUID: props.table?.uid || '',
  isAddDataAble: props.isAddDataAble,
  isImportDataAble: false,
  isExportDataAble: false,
  isPrintDataAble: true,
  isDeleteDataAble: false,
  isShowMoreMenu: false,
  isEditDataAble: false,
  searchable: false,
  filterable: false,
  isChangeFilterDisplayMode: false,
  isTableCellEditable: false,
  sortable: false,
  hideColumnsAble: true,
  changeRowHeightAble: false,
  isShowHeader: false,
  isShowTableHeaderMenu: false,
  updateColumnDataAble: false,
  isShowCheck: false,
  isMultiple: false,
  clickRowShowDetail: false,
  clickRowChecked: false,
  isShowFooter: false,
  isShowAggregateRow: false,
  isShowPagination: false,
  isAlbum: false,
  uid: `submit-detail-${props.table?.uid || ''}`,
});
const tableWidget = new Table(tableProps);
tableWidget.getMainSign = () => nocode?.value?.body?.sign;
tableWidget.setMainSign = (sign: string) => {
  if (nocode?.value?.body) {
    nocode.value.body.sign = sign;
  }
};
const detailReady = ref(false);
const formMode = computed(() => FormMode.Edit);
const copyDialogVisible = ref(false);

provideTable(tableWidget);
provideTableProps(tableProps);
provideFormMode(formMode);
provideFormTable(computed(() => props.table));

const nocodeFormProps = computed(() => ({
  nocodeId: nocode?.value?.meta?.id,
  tableUID: [nocode?.value?.body?.formData?.uid || '', props.table?.uid],
  uuid: props.uuid,
  fieldsAuth: props.fieldsAuth,
}));
const copyNocodeFormProps = computed(() => ({
  nocodeId: nocode?.value?.meta?.id,
  tableUID: [nocode?.value?.body?.formData?.uid || '', props.table?.uid],
  fieldsAuth: props.fieldsAuth,
}));

const initDetailContext = () => {
  const nocodeBody = nocode?.value?.body;
  if (!nocodeBody || !props.table?.uid) {
    detailReady.value = false;
    return;
  }

  tableProps.nocodeId = nocode.value?.meta?.id || '';
  tableProps.tableUID = props.table.uid;
  tableProps.isAddDataAble = props.isAddDataAble;
  tableProps.isEditDataAble = !isPublicShare.value;
  tableProps.isDeleteDataAble = !isPublicShare.value;
  tableWidget.init({
    runtime,
    nocodeBody,
    organizeUtil,
    meta: {},
  });
  detailReady.value = true;
};

const openCopyDialog = (row: Row) => {
  tableProps.addNewRowData = row;
  copyDialogVisible.value = true;
};

const handleCopySubmitted = () => {
  copyDialogVisible.value = false;
  tableProps.addNewRowData = undefined;
};

const handleSubmitted = () => {
  visible.value = false;
  emit('submitted');
};

const handleDeleted = () => {
  visible.value = false;
  emit('deleted');
};

watch(
  () => [props.table?.uid, nocode?.value?.body, isPublicShare.value],
  () => initDetailContext(),
  { immediate: true },
);
</script>
