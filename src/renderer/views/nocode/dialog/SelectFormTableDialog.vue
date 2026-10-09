<template>
  <div class="select-form-table-dialog">
    <el-dialog :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)"
      :close-on-press-escape="false" :title="$t('SelectFormTableDialog.selectForm')" width="30%" :close-on-click-modal="false" align-center
      @closed="onClosed">
      <el-tree-select v-model="selectedTable" :data="tableChoices" :render-after-expand="false" :placeholder="$t('SelectFormTableDialog.selectForm')" />
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="handleConfirm">
            {{ $t('SelectFormTableDialog.confirm') }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref } from 'vue';
import { Connection, OptionTableUID } from '@common/types/project';
import { ElMessage } from 'element-plus';
import { NocodeBody, NocodeFormData } from '@common/types/nocode';
import i18next from 'i18next';
import { getNocodeDataSourceConnections, isValidNocodeDataSourceTable } from '@common/utils/connection';
import { buildBoardConnectionsWithAggregateTables } from '@renderer/utils/aggregateTable';
import { extendConnectionsWithTableAggregateFields } from '@renderer/utils/tableAggregateField';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { canReadNocodeTableDataByBody } from '@renderer/views/nocode/utils/data-permission';

const props = defineProps<{
  modelValue: boolean,
  formData?: NocodeFormData,
  body?: Pick<NocodeBody, "formData" | "otherDataSources">,
  nocodeBody?: NocodeBody,
  organizeUtil?: OrganizeUtil,
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "confirm", value: OptionTableUID): void
}>();


const selectedTable = ref<string>(null);

const dataSourceBody = computed(() => {
  if (props.body) return props.body;
  if (props.formData) {
    return {
      formData: props.formData,
    };
  }
  return undefined;
})

const displayDataSourceConnections = computed(() => {
  const sources = getNocodeDataSourceConnections(dataSourceBody.value);
  const connectionsWithAggregateTable = buildBoardConnectionsWithAggregateTables(
    sources as unknown as Connection[],
    sources,
  );

  return extendConnectionsWithTableAggregateFields(
    connectionsWithAggregateTable,
    sources,
  );
});

const tableChoices = computed(() => {
  const departments = props.organizeUtil?.departments || [];

  return displayDataSourceConnections.value.flatMap(source => {
    return (source.tables || [])
      .filter(t => isValidNocodeDataSourceTable(t, source))
      .filter(t => canReadNocodeTableDataByBody(props.nocodeBody, t.uid, departments))
      .map(t => {
        return {
          label: t.alias,
          value: [source.uid, t.uid].join(","),
        };
      });
  })
});
const handleConfirm = () => {
  if (!selectedTable.value) return ElMessage.warning(i18next.t('SelectFormTableDialog.plsSelectForm'));
  emit('confirm', selectedTable.value?.split(",") as OptionTableUID);
  emit('update:modelValue', false);
}

const onClosed = () => {
  selectedTable.value = null;
}
</script>

<style lang='scss' scoped></style>
