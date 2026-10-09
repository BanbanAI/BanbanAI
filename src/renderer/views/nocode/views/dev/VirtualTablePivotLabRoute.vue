<template>
  <div class="virtual-table-pivot-route">
    <div class="virtual-table-pivot-route__header">
      <div class="virtual-table-pivot-route__title">
        <strong>Virtual Table Pivot Lab</strong>
        <span>用于验证 Vue3 虚拟表格透视表能力和 ali-react-table 对齐表现</span>
      </div>
    </div>
    <pivot-table-lab class="virtual-table-pivot-route__content" />
  </div>
</template>

<script setup lang="ts">
import PivotTableLab from "@renderer/components/virtual-table/pivot/PivotTableLab.vue";
</script>

<style scoped lang="scss">
.virtual-table-pivot-route {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f7f9fc 0%, #eef3fa 100%);
}

.virtual-table-pivot-route__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.virtual-table-pivot-route__title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #303133;
}

.virtual-table-pivot-route__title strong {
  font-size: 16px;
}

.virtual-table-pivot-route__title span {
  font-size: 12px;
  color: #606266;
}

.virtual-table-pivot-route__content {
  flex: 1;
  min-height: 0;
}
</style>
