<template>
  <div class="table-container">
    <el-table :data="tableData" border :scrollbar-always-on="true">
      <el-table-column class-name="index-column" type="index" :index="indexMethod" :width="55"/>
      <template v-if="columns.length > 0">
        <el-table-column v-for="(col, index) in columns" :key="index" :prop="col[prop]" :label="col[label]">
          <template #header="{ row, column, $index }">
            <slot name="columnHeader" :row="row" :column="column" :$index="$index - 1">{{ column.label }}</slot>
          </template>
        </el-table-column>
      </template>
    </el-table>
    <slot name="tablefooter"></slot>
  </div>
</template>

<script lang="ts" setup>
  withDefaults(defineProps<{
    columns: object[],
    tableData: object[],
    prop?: string,
    label?: string,
  }>(), {
    prop: 'value',
    label: 'name',
  })
  const indexMethod = (index:number) => index+1;

</script>

<style scoped setup lang="scss">
  .table-container {
    height: 100%;
    :deep(.el-table) {
      .index-column .cell {
        padding: 0;
        text-align: center;
      }
    }

    .el-table, .el-table__inner-wrapper {
      --text-color: #c5c5c5;
      height: 100%;
      display: flex;
      flex-direction: column;
      .el-table__body-wrapper {
        height: calc( 100% - 40px );
      }
    }

    .el-table__inner-wrapper::before {
      display: none
    }
  }
</style>