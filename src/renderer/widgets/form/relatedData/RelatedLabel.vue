<template>
  <div class="related-label" :class="{'in-subform': widget.isInSubForm}">
    <span v-if="!widget.isMultiple" :title="widget.dataRows[0]">{{ widget.dataRows[0] }}</span>
    <div class="tags-wrapper" v-else>
      <el-tag class="first-tag" type="info" closable @close="handleClose(0)" :title="widget.dataRows[0]">{{ widget.dataRows[0] }}</el-tag>
      <el-popover :popper-style="{
        width: 'max-content',
        maxWidth: '310px',
        padding: '5px 11px',
      }" trigger="hover" v-if="widget.dataRows.length > 1">
        <template #reference>
          <el-tag type="info" style="max-width: 100px;">+ {{ widget.dataRows.length - 1 }}</el-tag>
        </template>
        <div class="tags" style="display: flex; flex-wrap: wrap; gap: 6px">
          <el-tag type="info" v-for="(item, index) in widget.dataRows.slice(1)" :key="index" closable :title="item" @close="handleClose(index + 1)"
            style="max-width: 140px;"><span style="overflow: hidden; text-overflow: ellipsis; display: block; max-width: 104px;">{{ item }}</span></el-tag>
        </div>
      </el-popover>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { useWidget } from '@renderer/b2/types';
import { RelatedData } from './relatedData';

const widget = useWidget<RelatedData>();


const handleClose = (index: number) => {
  const key = Object.keys(widget.selectedRows)[index];
  if (!key) return;

  const nextSelectedRows = { ...widget.selectedRows };
  delete nextSelectedRows[key];
  void widget.onFillData(nextSelectedRows);
}
</script>

<style lang='scss' scoped>
.related-label {
  overflow: hidden;

  &.in-subform {
    padding-left: 10px;
    width: calc(100% - 30px);
    text-overflow: ellipsis;
  }
  .tags-wrapper {
    display: flex;
    align-items: center;
    column-gap: 6px;

    :deep(.first-tag) {
      max-width: 120px;
      display: flex;

      .el-tag__content {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}
</style>
