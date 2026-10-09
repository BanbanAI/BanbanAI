<template>
  <div class="data-source-viewer">
    <div class="body">
      <div class="container">
        <div class="container-top">
          <el-icon class="container-top-icon"><i-table-data-viewer /></el-icon>
          <div class="container-top-info">
            <div class="title">
              <span>{{ table?.alias }}{{ $t('DataSourceViewer.dataOf') }}</span>
            </div>
            <div class="sub-title">
              <span>{{$t('DataSourceViewer.fromForm')}}{{ table?.alias }}</span>
              <span>{{ dayjs(connection?.createTime).format('YYYY-MM-DD HH:mm') }}</span>
            </div>
          </div>
          <div class="container-top-info-btn" @click="handleEdit">
            <el-icon><i-ven-data-viewer-edit /></el-icon>
            {{ $t('DataSourceViewer.openForm') }}
          </div>
        </div>
        <el-scrollbar class="sheet-container" wrap-style="overflow-x: auto;">
          <div class="scroll-content">
          </div>
        </el-scrollbar>
        <vn-stack>
          <div class="container-info">
            <div class="tabs">
              <vn-stack-tab name="data"><span>{{ $t('DataSourceViewer.dataDetails') }}</span></vn-stack-tab>
              <vn-stack-tab name="type"><span>{{ $t('DataSourceViewer.dataStructure') }}</span></vn-stack-tab>
            </div>
            <div class="tabs-info">
              {{$t('DataSourceViewer.all')}}{{ tableData?.rows?.length || 0 }}{{$t('DataSourceViewer.item')}}，{{$t('DataSourceViewer.preview')}}{{ tableData?.rows?.length > 100 ? 100 : tableData?.rows?.length }}{{ $t('DataSourceViewer.item') }}
            </div>
            <div class="tabs-warning">
              <el-icon size="16"><i-ep-warning-filled /></el-icon>
              {{ $t('DataSourceViewer.previewTips') }}
            </div>
          </div>
          <vn-stack-layer name="data" class="data-layer">
            <el-table
              :data="tableData?.rows.slice(0, 100) || []"
              :cell-style="{borderColor:'var(--border-color)'}"
              :header-cell-style="{borderColor:'var(--border-color)'}"
              height="100%"
              :empty-text="$t('DataSourceViewer.noData')"
              border
            >
              <el-table-column
                v-for="(item, index) in filterFields || []"
                :key="item.uid"
                :prop="item.uid"
                :label="item.alias"
                min-width="120"
                show-overflow-tooltip
                style="height: 100px;"
              />
            </el-table>
          </vn-stack-layer>
          <vn-stack-layer name="type" class="type-layer">
            <div class="type-internal">
              <el-table
                :data="filterFields || []"
                :cell-style="{borderColor:'var(--border-color)'}"
                :header-cell-style="{borderColor:'var(--border-color)',textAlign: 'center'}"
                border
                height="100%"
              >
                <el-table-column
                  prop="alias"
                  :label="$t('DataSourceViewer.fieldName')"
                />
                <el-table-column
                  prop="type"
                  :label="$t('DataSourceViewer.fieldType')"
                >
                  <template #default="{ row }">
                    <span>
                      {{
                        {
                          string: $t('DataSourceViewer.string'),
                          number: $t('DataSourceViewer.number'),
                          array: $t('DataSourceViewer.array'),
                          object: $t('DataSourceViewer.object')
                        }[row.type] || row.type
                      }}
                    </span>
                  </template>
                </el-table-column>
              </el-table>
            </div>

          </vn-stack-layer>
        </vn-stack>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue';
import { isSystemField } from '@common/utils';
import { NOCODE } from '@renderer/types';
import { Table } from "@common/types/project";
import { useSettingStore } from '@renderer/stores';
import dayjs from 'dayjs';
import type { NocodeDataSourceConnection } from '@common/utils/connection';
import { formDataApi } from "@renderer/views/nocode/utils";

const nocode = inject(NOCODE)
const connection = ref()
const table = ref()
const tableData = ref()
const filterFields = ref()
const settingState = useSettingStore();


const emit = defineEmits<{
  (event: "handle-edit", table: Table),
}>(); 

defineExpose({
  async getTableInfo(c: Connection | NocodeDataSourceConnection, t: Table) {
    await settingState.getDomainPort().catch(() => undefined);
    connection.value = c;
    table.value = t;
    const buckets = await formDataApi.getData({
      nocodeId: (c as NocodeDataSourceConnection)?.nocodeId || nocode.value?.meta?.id,
      tableUIDs: [table.value.uid],
      options: {
        transformFormData: true,
      }
    });
    tableData.value = buckets[0]
    filterFields.value = tableData.value.fields.filter((item) => !isSystemField(item))
  }
})

const handleEdit = () => {
  emit("handle-edit", table.value);
}

</script>

<style scoped lang='scss'>
.data-source-viewer {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;

  .body {
    height: calc(100% - 40px);
    width: 100%;
    background-color: var(--bg-color-overlay);
    padding: 16px;
    border-radius: 4px;

    .container {
      width: 100%;
      height: 100%;
      background-color: var(--color-white);
      border-radius: 4px;
      padding: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;

      :deep(.el-table) {
        width: 100%; 
        border: 1px solid var(--border-color); 
        border-radius: 4px;
      }

      .container-top {
        width: 100%;
        height: 48px;
        min-height: 48px;
        display: flex;
        align-items: center;
        margin-bottom: 16px;
        overflow: hidden;

        img {
          margin-right: 16px;
        }

        .container-top-icon {
          font-size: 48px;
          color: #00000000;
          margin-right: 16px;
        }

        .container-top-info {
          .title {
            display: flex;
            align-items: center;

            span {
              max-width: 800px;
              
              font-weight: 400;
              font-size: 16px;
              line-height: 24px;
              letter-spacing: 0%;
              margin-right: 4px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .el-icon {
              font-size: 14px;
              color: var(--text-color-placeholder);
            }

            .rename {
              cursor: var(--cursor-pointer);
            }
          }

          .sub-title {
            display: flex;
            align-items: center;
            span {
              max-width: 400px;
              
              font-weight: 400;
              font-size: 12px;
              line-height: 16px;
              letter-spacing: 0%;
              color: var(--text-color-secondary);
              margin-right: 16px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }
        
        .container-top-info-btn {
          width: 112px;
          height: 32px;
          margin-left: auto;
          border-radius: 4px;
          padding: 6px 20px 6px 16px;
          
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          background-color: var(--color-primary);
          cursor: pointer;
          color: var(--color-white);
          display: flex;
          justify-content: center;
          align-items: center;
          transition: all 0.3s ease; 
          
          .el-icon {
            padding-top: 2px;
            margin-right: 4px;
          }
        }

        .external-button {
          margin-left: auto;
          display: flex;

          div {
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 16px;
            border-radius: 4px;
            background-color: var(--color-primary);
            color: var(--color-white);
            border: 1px solid var(--color-primary);
            margin-left: 8px;
            cursor: var(--cursor-pointer);
            min-width: 114px;

            &.delete {
              background-color: var(--color-white);
              color: var(--color-danger);
              border: 1px solid var(--color-danger);  
            }

            .el-icon {
              margin-right: 4px;
            }
          }
        }
      }

      .sheet-container {
        width: 100%;
        height: 33px;
        min-height: 33px;
        display: flex;
        border-bottom: 1px solid var(--border-color);

        :deep(.el-scrollbar__wrap) {
          overflow-x: auto !important;
          overflow-y: hidden;
        }

        .scroll-content {
          display: flex;
          white-space: nowrap;
        }

        span {
          margin-right: 32px;
          
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: var(--cursor-pointer);
          height: 32px;
          transition: color 0.3s ease;

          &.active {
            color: var(--primary-color);
            border-bottom: 2px solid var(--primary-color);
            border-top: 2px solid transparent;
          }
        }
      }

      hr {
        margin-top: 32px;
        border: none;
        border-bottom: 1px solid var(--border-color);
      }

      .container-info {
        width: 100%;
        height: 28px;
        display: flex;
        margin-top: 16px;
        margin-bottom: 16px;
        align-items: center;
        white-space: nowrap;
        overflow: hidden;

        .tabs {
          width: 144px;
          display: flex;
          margin-right: 16px;

          .vn-stack-tab {

            &.active {
              span {
                background-color: var(--primary-color);
                color: var(--color-white);
                border-top: 1px solid var(--primary-color);
                border-bottom: 1px solid var(--primary-color);
              }
            }

            span {
              width: 72px;
              height: 28px;
              display: block;
              background-color: var(--bg-color-overlay);
              display: flex;
              justify-content: center;
              align-items: center;
              cursor: var(--cursor-pointer);
              border-top: 1px solid var(--border-color);
              border-bottom: 1px solid var(--border-color);
              color: var(--text-color-secondary);
              transition: all 0.3s ease;
            }
          }
          

          .vn-stack-tab:first-child {
            span {           
              border-left: 1px solid var(--border-color);
              border-radius: 4px 0px 0px 4px;
            }

            &.active {
              span {
                border-left: 1px solid var(--primary-color);
              }
            }
          }

          .vn-stack-tab:nth-child(2) {
            span {            
              border-right: 1px solid var(--border-color);
              border-radius: 0px 4px 4px 0px;
            }

            &.active {
              span {
                border-right: 1px solid var(--primary-color);
              }
            }
          }
        }
        
        .tabs-info {
          font-family: Noto Sans S Chinese;
          font-weight: 400;
          font-size: 12px;
          line-height: 16px;
          letter-spacing: 0%;
          color: var(--text-color-secondary);
        }

        .tabs-warning {
          display: flex;
          align-items: center;
          margin-left: auto;
          
          font-weight: 400;
          font-size: 12px;
          line-height: 16px;
          letter-spacing: 0%;
          color: var(--color-warning);

          .el-icon {
            margin-right: 4px;
          }
        }
      }

      .vn-stack {
        height: 100%;
      }

      .data-layer {
        height: calc(100% - 156px);
        position: relative;
        overflow-x: auto;
        overflow-y: hidden;

        :deep(.el-table__row) {
          height: 48px;
        }
        
        :deep(th.el-table__cell) {
          background-color: var(--bg-color-overlay);
          
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          color: var(--text-color-regular);
        }

        :deep(td.el-table__cell) {
          
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          color: var(--text-color-regular);
          background-color: var(--color-white);
        }

        :deep(.el-table__header) {
          height: 48px;
        }
        
      }

      .type-layer {
        height: calc(100% - 156px);
        position: relative;
        overflow-x: auto;
        overflow-y: hidden;

        :deep(th.el-table__cell) {
          background-color: var(--bg-color-overlay);
          
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          color: var(--text-color-regular);
        }

        .type-internal {
          :deep(.el-table__row) {
            height: 48px;
          }
      
          :deep(td.el-table__cell) {
            
            font-weight: 400;
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%;
            color: var(--text-color-placeholder);
            background-color: var(--bg-color-overlay);
            padding: 8px;

            .cell {
              padding: 8px;
              background-color: var(--color-white);
              border: 1px solid var(--border-color);
            }
          }

          :deep(.el-table__header) {
            height: 48px;
          }
        }

        .type-external {
          height: 100%;
        }
        
      }

      .type-table {
        border-radius: 4px;
        overflow: hidden;
      }
    }
  }
}
</style>
