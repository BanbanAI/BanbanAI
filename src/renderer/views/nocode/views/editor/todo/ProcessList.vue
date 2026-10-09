<template>
  <div class="process-list">
    <el-scrollbar v-if="data.length > 0">
      <div class="process-item" v-for="item in data" :key="item.id">
        <span class="process-title">
          {{ item.name }}
        </span>
        <div class="table-container">
          <el-scrollbar>
            <div class="scrollbar-flex-content">
              <div class="table-item" v-for="table in item.tables" :key="table.uid">
                <span class="table-title" :title="table.alias">{{ table.alias }}</span>
                <span class="table-detail" @click="handleCreate(table, item)">
                  {{ $t('ProcessList.initiateProcess') }}
                  <el-icon>
                    <i-ep-arrow-right/>
                  </el-icon>
                </span>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </el-scrollbar>

    <div v-else class="empty-box">
      <div class="empty-container">
        <img src="@renderer/assets/image/nocode/todo/todo-empty.png" alt="">
        <span>
          {{ $t('ProcessList.noProcess') }}
        </span>
      </div>
    </div>
  </div>

  <process-initiate-dialog 
    v-model="initDialogVisible" 
    @close="initDialogVisible = false" 
    :tableName="tableName" 
    :nocodeID="nocodeId" 
    :tableUID="tableUID" 
    :key="tableUID"
  />
</template>

<script lang='ts' setup>
import { NocodeProcessItem } from '@common/types/nocode';
import { provideFormMode } from '@renderer/views/nocode/components/global/table/hooks';
import { computed, ref } from 'vue';
import { FormMode } from '@renderer/types/base';

const props = withDefaults(defineProps<{
  data: NocodeProcessItem[]
}>(), {
  data: () => []
});

const nocodeId = ref()
const tableUID = ref()
const initDialogVisible = ref(false)
const tableName = ref()

provideFormMode(computed(() => FormMode.Add));  

const handleCreate = (table, nocode) => {
  tableUID.value = [nocode.formDataUID, table.uid]
  nocodeId.value = nocode.id
  tableName.value = table.alias
  initDialogVisible.value = true
}


</script>

<style lang='scss' scoped>
.process-list {
  height: 100%;

  .process-item {
    width: 100%;
    min-height: 136px;
    background-color: var(--color-white);
    border-radius: 4px;
    padding: 16px;
    margin-bottom: 16px;

    .process-title {
      display: block;
      height: 20px;
      
      font-weight: 400;
      
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
      margin-bottom: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .table-container {
      width: 100%;

      .scrollbar-flex-content {
        height: 100%;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 16px;
        width: 100%;

        .table-item {
          display: block;
          height: 100%;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          border-left: 4px solid var(--primary-color);
          padding: 8px;

          .table-title {
            display: block;
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            
            font-weight: 400;
            
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%;
            margin-bottom: 16px;
          }

          .table-detail {
            
            font-weight: 400;
            
            font-size: 12px;
            display: flex;
            cursor: pointer;
            color: var(--text-color-inactive);
            transition: color 0.3s ease;

            .el-icon {
              margin-left: 4px;
            }

            &:hover {
              color: var(--primary-color);
            }
          }
        }
      }
    }
  }

  :deep(.el-scrollbar) {
    height: 100%;
  }

  .empty-box {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;

    .empty-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 10px;

      img {
        width: 120px;
      }

      span {
        color: var(--text-color-inactive);
      }
    }
  }
}
</style>