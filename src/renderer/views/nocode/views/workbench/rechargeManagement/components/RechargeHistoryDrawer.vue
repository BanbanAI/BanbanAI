<template>
  <el-drawer
    v-model="visible"
    :title="$t('RechargeHistoryDrawer.rechargeHistory')"
    direction="rtl"
    size="960px"
    class="recharge-history-drawer"
    :destroy-on-close="true"
  >
    <div class="history-content">
      <div class="history-table-wrapper">
        <el-table
          :data="pagedHistoryList"
          table-layout="fixed"
          style="width: 100%"
          :header-cell-style="{ background: '#F7F8FA', color: '#1D2129', fontSize: '14px', fontWeight: '500', height: '44px' }"
          :cell-style="{ color: '#1D2129', fontSize: '14px', height: '48px' }"
          :empty-text="$t('RechargeHistoryDrawer.noData')"
        >
          <el-table-column prop="title" :label="$t('RechargeHistoryDrawer.title')"></el-table-column>
          <el-table-column prop="amount" :label="$t('RechargeHistoryDrawer.amount')">
            <template #default="{ row }">
              <span :class="['amount-text', row.amount >= 0 ? 'positive' : 'negative']">
                {{ row.amount >= 0 ? '+' : '' }}{{ Number(row.amount).toFixed(2) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" :label="$t('RechargeHistoryDrawer.time')"></el-table-column>
        </el-table>
      </div>
      <div class="history-pagination">
        <el-config-provider :locale="elementPlusLocale">
          <el-pagination
            background
            layout="sizes, total, prev, pager, next"
            :current-page="currentPage"
            :page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="totalCount"
            @current-change="handleCurrentChange"
            @size-change="handleSizeChange"
          />
        </el-config-provider>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import dayjs from 'dayjs';
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale';

type RechargeHistoryRecord = {
  id: number;
  title: string;
  money: number;
  chargeBy: string;
  transactionId: string;
  number: string;
  timeCreate: number;
  timePay: number;
};

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const currentPage = ref(1);
const pageSize = ref(10);

const historyRecords = ref<RechargeHistoryRecord[]>([]);
const totalCount = ref(0);
const loading = ref(false);
const formatHistoryTime = (time: number) => {
  if (!time) {
    return '-';
  }
  return dayjs.unix(time).format('YYYY-MM-DD HH:mm:ss');
};

const fetchHistoryList = async () => {
  if (!visible.value) return;
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
    };
    const res = await axios.get("/user/user-recharge-list", { params });
    if (res.data) {
      historyRecords.value = res.data.list || [];
      totalCount.value = res.data.total || 0;
    }
  } catch (error) {
    console.error("fetchHistoryList error", error);
  } finally {
    loading.value = false;
  }
};

watch(visible, (val) => {
  if (val) {
    currentPage.value = 1;
    fetchHistoryList();
  }
});

watch([currentPage, pageSize], () => {
  fetchHistoryList();
});

const pagedHistoryList = computed(() => historyRecords.value.map((item) => ({
  ...item,
  title: item.title || '-',
  createdAt: formatHistoryTime(item.timePay || item.timeCreate),
  amount: Number(item.money || 0),
})));

const handleCurrentChange = (page: number) => {
  currentPage.value = page;
};

const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
};
</script>

<style lang="scss">
.recharge-history-drawer {
  background-color: #fff;
  max-width: min(100%, 960px);
  
  .el-drawer__header {
    height: 48px;
    margin-bottom: 0;
    padding: 16px 24px;
    border-bottom: 1px solid #E5E6EB;
    
    span {
      font-size: 16px;
      font-weight: 600;
      color: #1D2129;
    }
  }

  .el-drawer__body {
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .history-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 24px;
  }

  .history-table-wrapper {
    flex: 1;
    min-height: 0;
    border: 1px solid #E5E6EB;
    border-radius: 5px;
    overflow: hidden;
    background: #ffffff;

    .amount-text {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #4e5969;
    }

    .el-table {
      --el-table-border-color: #E5E6EB;
      --el-table-header-bg-color: #f7f8fa;
      --el-table-row-hover-bg-color: #f2f3f5;
      height: 100%;

      .el-table__header th.el-table__cell,
      .el-table__body td.el-table__cell {
        border-right: 1px solid #E5E6EB;
      }

      .el-table__header th.el-table__cell:last-child,
      .el-table__body td.el-table__cell:last-child {
        border-right: none;
      }
      
      tr {
        background-color: #fff;
      }

      .el-table__header {
        th {
          border-bottom: 1px solid #E5E6EB;
        }
      }

      .el-table__row {
        td {
          border-bottom: 1px solid #f2f3f5;
        }
      }
    }

    .el-table__inner-wrapper::before {
      display: none;
    }
  }

  .amount-text {
    font-weight: 500;
    &.positive {
      color: #1D2129;
    }
    &.negative {
      color: #F53F3F;
    }
  }

  .history-pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;

    .el-pagination {
      --el-pagination-button-bg-color: #ffffff;
      --el-pagination-hover-color: var(--color-primary);
      --el-pagination-text-color: #4e5969;
      --el-pagination-button-color: #4e5969;
      --el-pagination-border-radius: 4px;
      --el-border-radius-base: 4px;
      font-weight: 400;

      .el-select {
        width: 102px;
      }

      .el-pagination__total {
        margin-right: 16px;
        color: #86909c;
      }

      .el-pagination__jump {
        margin-left: 16px;
        color: #86909c;
      }

      .btn-prev,
      .btn-next,
      .el-pager li {
        background-color: #ffffff;
        border: 1px solid #e5e6eb;
        margin: 0 4px;

        &:hover {
          border-color: var(--color-primary);
        }

        &.is-active {
          background-color: var(--color-primary);
          border-color: var(--color-primary);
          color: #ffffff;
        }

        &:disabled {
          background-color: #f7f8fa;
          border-color: #e5e6eb;
          color: #c9cdd4;
        }
      }
    }
  }
}
</style>
