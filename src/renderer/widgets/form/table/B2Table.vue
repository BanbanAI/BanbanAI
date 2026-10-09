<template>
  <b2-widget>
    <div class="b2-table">
      <nocode-permission-table
        v-if="widget"
        ref="nocodeTableRef"
        :nocodeId="widget.nocodeId"
        :tableUID="tableUID"
        :uid="widget.uid"
        v-model:tableViewMeta="widget.tableViewMeta"
        :preHiddenColumns="widget.hiddenFieldsUid"
        :headerOptionsShowMode="'right-compact'"
        :headerVisibleOptionCount="5"
        :preFilterRule="widget.preFilterRule"
      />
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { Table } from './table';
import { useWidget } from "@renderer/b2/types";
import { computed, effectScope, onMounted, onUnmounted, ref, watch } from 'vue';
import { debounce } from 'lodash';

const widget = useWidget<Table>();
const tableUID = computed(() => {
  const formTableUID = widget.formTableUID;
  if (formTableUID) {
    return formTableUID[1];
  }
  return '';
})

const nocodeTableRef = ref();
const refreshData = () => nocodeTableRef.value?.refreshData(true) ?? Promise.resolve();
const scope = effectScope(true);
onMounted(() => {
  widget.emitter.on("refresh.data", refreshData);
  scope.run(() => {
    if (widget.isEditable) {
      const debouncedRefresh = debounce(() => {
        nocodeTableRef.value.refreshColumns();
      }, 300);

      watch(() => widget.hiddenFieldsUid, debouncedRefresh);
    }
  });
})

onUnmounted(() => {
  widget.emitter.off("refresh.data", refreshData);
  scope.stop();
});
</script>

<style lang="scss" scoped>
.b2-table {
  width: 100%;
  height: 100%;
  padding: 6px 12px;
  user-select: none;
  display: flex;
  flex-direction: column;
  row-gap: 16px;
}
</style>
