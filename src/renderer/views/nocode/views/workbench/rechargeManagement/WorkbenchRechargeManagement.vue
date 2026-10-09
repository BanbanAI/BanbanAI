<template>
  <div class="recharge-management" :class="{ 'is-embedded': embedded }">
    <div v-if="!embedded" class="recharge-management-header">
      <div class="header-left">
        <button type="button" class="back-button" @click="handleBack">
          <el-icon :size="24" color="var(--text-color-primary)">
            <i-workbench-back />
          </el-icon>
        </button>
        <div class="header-title">{{ $t('WorkbenchRechargeManagement.rechargeManagement') }}</div>
      </div>
      <div class="header-right">
        <WorkBenchUserCard></WorkBenchUserCard>
      </div>
    </div>
    <div class="recharge-management-content">
      <div v-if="rechargeTipVisible" class="recharge-notice">
        <div class="recharge-notice-content">
          <span class="recharge-notice-title">{{ $t('WorkbenchRechargeManagement.tipTitle') }}</span>
          <span>{{ $t('WorkbenchRechargeManagement.aiUsageTip') }}</span>
        </div>
        <button type="button" class="recharge-notice-close" @click="handleCloseRechargeTip">
          <el-icon :size="16" color="#86909C">
            <Close />
          </el-icon>
        </button>
      </div>
      <div class="summary-container">
        <div class="summary-card">
          <div class="summary-card-header">
            <div class="summary-card-label">
              <el-icon class="summary-card-icon" :size="20" color="#3793ff"><i-ven-ai-score-icon /></el-icon>
              <span>{{ $t('WorkbenchRechargeManagement.coin') }}</span>
            </div>
            <button v-if="!embedded" type="button" class="summary-card-tag" @click="handleOpenHistoryRecord">{{ $t('WorkbenchRechargeManagement.rechargeRecord') }}</button>
          </div>
          <div class="summary-card-value">
            <span class="value-text">{{ balanceValue }}</span>
          </div>
        </div>
        <el-button type="primary" class="summary-action" @click="handleRecharge">{{ $t('WorkbenchRechargeManagement.rechargeNow') }}</el-button>
      </div>
      <div class="record-container">
        <el-tabs v-if="embedded" v-model="activeRecordTab" class="record-tabs">
          <el-tab-pane :label="$t('WorkbenchRechargeManagement.consumptionRecord')" name="consumption" />
          <el-tab-pane :label="$t('WorkbenchRechargeManagement.rechargeRecord')" name="recharge" />
        </el-tabs>
        <div v-if="activeRecordTab === 'consumption'" class="record-header">
          <div v-if="!embedded" class="record-title">{{ $t('WorkbenchRechargeManagement.consumptionDetail') }}</div>
          <div class="record-filters">
            <recharge-user-tree-select
              v-if="showMemberFilter"
              v-model="selectedMembers"
              class="filter-select"
              :data="memberOptions"
            ></recharge-user-tree-select>
            <recharge-date-range-picker
              v-model="selectedDateRange"
              class="filter-date-range"
            ></recharge-date-range-picker>
          </div>
        </div>
        <div v-if="activeRecordTab === 'consumption'" class="record-table">
          <el-table
            :data="pagedRecordList"
            table-layout="fixed"
            height="100%"
            :empty-text="$t('WorkbenchRechargeManagement.noConsumptionRecord')"
            :header-cell-style="{ background: '#F7F8FA', color: '#1D2129', fontSize: '14px', fontWeight: '500', height: '44px' }"
            :cell-style="{ color: '#1D2129', fontSize: '14px', height: '48px' }"
          >
            <el-table-column prop="member" :label="$t('WorkbenchRechargeManagement.member')"></el-table-column>
            <el-table-column :label="$t('WorkbenchRechargeManagement.coinConsumption')">
              <template #default="{ row }">
                <div class="fee-cell">
                  <span>-{{ (row.fee).toFixed(4) }}</span>
                  <recharge-fee-detail-popover :data="row.feeDetailData"></recharge-fee-detail-popover>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="duration" :label="$t('WorkbenchRechargeManagement.duration')"></el-table-column>
            <el-table-column prop="createdAt" :label="$t('WorkbenchRechargeManagement.time')"></el-table-column>
          </el-table>
        </div>
        <div v-else class="record-table recharge-record-table">
          <el-table
            :data="rechargeRecordList"
            table-layout="fixed"
            height="100%"
            :empty-text="$t('WorkbenchRechargeManagement.noRechargeRecord')"
            :header-cell-style="{ background: '#F7F8FA', color: '#1D2129', fontSize: '14px', fontWeight: '500', height: '44px' }"
            :cell-style="{ color: '#1D2129', fontSize: '14px', height: '48px' }"
          >
            <el-table-column prop="createdAt" :label="$t('WorkbenchRechargeManagement.time')" />
            <el-table-column prop="amount" :label="$t('WorkbenchRechargeManagement.amount')">
              <template #default="{ row }">¥ {{ row.amount }}</template>
            </el-table-column>
          </el-table>
        </div>
        <div class="record-pagination">
          <el-config-provider :locale="elementPlusLocale">
            <el-pagination
              background
              layout="sizes, total, prev, pager, next"
              :current-page="activeRecordCurrentPage"
              :page-size="activeRecordPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="activeRecordTotal"
              @current-change="handleActiveCurrentPageChange"
              @size-change="handleActivePageSizeChange"
            >
              <span style="margin: 0 12px; font-size: 14px">
                {{ $t('WorkbenchRechargeManagement.total') }}{{ activeRecordTotal }}{{ $t('WorkbenchRechargeManagement.record') }}
              </span>
            </el-pagination>
          </el-config-provider>
        </div>
      </div>
    </div>
    <recharge-history-drawer v-if="!embedded" v-model="historyDrawerVisible" />
    <recharge-dialog v-model="rechargeDialogVisible" @submit="handleRechargeSubmit" />
    <recharge-payment-dialog 
      v-model="paymentDialogVisible" 
      :amount="pendingRechargeAmount"
      @success="handlePaymentSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Close } from "@element-plus/icons-vue";
import i18next from "i18next";
import axios from "axios";
import { resolveAccountDisplayName } from "@common/utils";
import { OrganizeUtil } from "@renderer/views/nocode/utils";
import { usePassportStore } from "@renderer/stores";
import { storeFactory } from "@renderer/utils/storage";
import type { NocodeUser } from "@common/types/account";
import RechargeDateRangePicker from "./components/RechargeDateRangePicker.vue";
import RechargeUserTreeSelect from "./components/RechargeUserTreeSelect.vue";
import RechargeFeeDetailPopover from "./components/RechargeFeeDetailPopover.vue";
import RechargeHistoryDrawer from "./components/RechargeHistoryDrawer.vue";
import RechargeDialog from "./components/RechargeDialog.vue";
import RechargePaymentDialog from "./components/RechargePaymentDialog.vue";
import { elementPlusLocale } from "@renderer/utils/elementPlusLocale";
import { useLocalizedDocumentTitle } from "@renderer/hooks/useLocalizedDocumentTitle";

type UserOrderRecord = {
  title?: string;
  payTime?: string | number;
  timeCostMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  tokens?: number;
  coin?: number;
  inputTokenPricePerMillion?: number;
  outputTokenPricePerMillion?: number;
  accountId?: string;
  account?: NocodeUser | string;
};

type ConsumptionMemberOption = {
  label: string;
  value: string;
};

type RechargeRecord = {
  id: number;
  money: number;
  timeCreate: number;
  timePay: number;
};

const props = defineProps({
  embedded: {
    type: Boolean,
    default: false,
  },
});
if (!props.embedded) {
  useLocalizedDocumentTitle(() => `${i18next.t("WorkbenchHomeUser.workbench")} - ${i18next.t('WorkbenchRechargeManagement.rechargeManagement')}`);
}
const embedded = computed(() => props.embedded);
const router = useRouter();
const passportState = usePassportStore();
passportState.init();
const organizeUtil = new OrganizeUtil();
const showMemberFilter = false;
const activeRecordTab = ref<'consumption' | 'recharge'>('consumption');
const selectedMembers = ref<string[]>([]);
const selectedDateRange = ref<[string, string] | null>([
  dayjs().subtract(2, "day").format("YYYY-MM-DD"),
  dayjs().format("YYYY-MM-DD"),
]);
const currentPage = ref(1);
const pageSize = ref(10);
const rechargeCurrentPage = ref(1);
const rechargePageSize = ref(10);
const historyDrawerVisible = ref(false);
const rechargeDialogVisible = ref(false);
const paymentDialogVisible = ref(false);
const pendingRechargeAmount = ref(0);
const memberOptions = ref<ConsumptionMemberOption[]>([]);
const rechargeManagementTipStore = storeFactory("WORKBENCH_RECHARGE_MANAGEMENT_TIP");
const rechargeTipVisible = ref(rechargeManagementTipStore.get() !== false);

const formatAmount = (value: number) => new Intl.NumberFormat(
  i18next.resolvedLanguage || i18next.language || "en",
  {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
).format(value);

const formatRechargeAmount = (amount: number) => {
  return formatAmount(amount * 100);
};

const formatRecordTime = (time?: string | number) => {
  if (!time) {
    return "-";
  }
  if (typeof time === "string") {
    if (/^\d+$/.test(time)) {
      return dayjs(Number(time) * 1000).format("YYYY-MM-DD HH:mm:ss");
    }
    return time;
  }
  return dayjs(time * 1000).format("YYYY-MM-DD HH:mm:ss");
};

const formatRecordDuration = (timeCostMs?: number) => {
  if (timeCostMs === undefined || timeCostMs === null) {
    return "-";
  }
  return `${(timeCostMs / 1000).toFixed(1)}s`;
};

const getRecordMemberName = (record: UserOrderRecord) => {
  return resolveAccountDisplayName({
    accountId: record.accountId,
    accountName: typeof record.account === "string" ? record.account : undefined,
    user: typeof record.account === "string" ? undefined : record.account,
    fallbackName: record.title,
  });
};

const recordList = ref<UserOrderRecord[]>([]);
const totalCount = ref(0);
const loading = ref(false);
const rechargeRecords = ref<RechargeRecord[]>([]);
const rechargeTotalCount = ref(0);

const balanceValue = computed(() => {
  const value = Number(passportState.user.coin || 0);
  return formatAmount(value);
});
const normalizeMemberOptions = (users: NocodeUser[]) => {
  return users
    .filter((item) => item.id && item.realname && item.user !== "admin")
    .map((item) => ({
      label: item.realname as string,
      value: item.id as string,
    }));
};

const fetchRecordList = async () => {
  loading.value = true;
  try {
    const params: {
      page: number;
      limit: number;
      timeStart?: number;
      timeEnd?: number;
      userIds?: string;
    } = {
      page: currentPage.value,
      limit: pageSize.value,
    };
    if (selectedDateRange.value?.[0]) {
      params.timeStart = dayjs(selectedDateRange.value[0]).startOf("day").unix();
    }
    if (selectedDateRange.value?.[1]) {
      params.timeEnd = dayjs(selectedDateRange.value[1]).endOf("day").unix();
    }
    if (showMemberFilter && selectedMembers.value.length) {
      params.userIds = selectedMembers.value.join(",");
    }
    const res = await axios.get("/user/user-order-list", { params });
    if (res.data) {
      recordList.value = res.data.list || [];
      totalCount.value = res.data.total || 0;
      passportState.updateUser({
        coin: res.data.coinBalance ?? passportState.user?.coin,
      })
    }
  } catch (error) {
    console.error("fetchRecordList error", error);
  } finally {
    loading.value = false;
  }
};

const fetchRechargeRecordList = async () => {
  if (!embedded.value) return;
  loading.value = true;
  try {
    const res = await axios.get('/user/user-recharge-list', {
      params: {
        page: rechargeCurrentPage.value,
        limit: rechargePageSize.value,
      },
    });
    rechargeRecords.value = res.data?.list || [];
    rechargeTotalCount.value = Number(res.data?.total || 0);
  } catch (error) {
    console.error('fetchRechargeRecordList error', error);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  try {
    await organizeUtil.getUsers();
    memberOptions.value = normalizeMemberOptions(organizeUtil.users);
  } catch {
    memberOptions.value = [];
  }
  fetchRecordList();
  fetchRechargeRecordList();
});

const pagedRecordList = computed(() => {
  return recordList.value.map((item) => ({
    ...item,
    member: getRecordMemberName(item),
    memberValue: item.accountId || "",
    fee: Number(item.coin || 0),
    duration: formatRecordDuration(item.timeCostMs),
    createdAt: formatRecordTime(item.payTime),
    feeDetailData: {
      inputTokens: Number(item.inputTokens || 0),
      outputTokens: Number(item.outputTokens || 0),
      cachedTokens: Number(item.cachedTokens || 0),
      tokens: Number(item.tokens || 0),
      coin: Number(item.coin || 0),
      inputTokenPricePerMillion: Number(item.inputTokenPricePerMillion || 0),
      outputTokenPricePerMillion: Number(item.outputTokenPricePerMillion || 0),
    },
  }));
});

const rechargeRecordList = computed(() => rechargeRecords.value.map(item => ({
  ...item,
  createdAt: formatRecordTime(item.timePay || item.timeCreate),
  amount: Number(item.money || 0).toFixed(2),
})));
const activeRecordCurrentPage = computed(() => activeRecordTab.value === 'consumption'
  ? currentPage.value
  : rechargeCurrentPage.value);
const activeRecordPageSize = computed(() => activeRecordTab.value === 'consumption'
  ? pageSize.value
  : rechargePageSize.value);
const activeRecordTotal = computed(() => activeRecordTab.value === 'consumption'
  ? totalCount.value
  : rechargeTotalCount.value);

watch(
  () => [selectedMembers.value.join(","), selectedDateRange.value?.[0], selectedDateRange.value?.[1]],
  () => {
    currentPage.value = 1;
    fetchRecordList();
  },
);

watch(
  () => [currentPage.value, pageSize.value],
  () => {
    fetchRecordList();
  }
);

watch(
  () => [rechargeCurrentPage.value, rechargePageSize.value],
  () => {
    fetchRechargeRecordList();
  },
);

const handleBack = async () => {
  if (embedded.value) return;
  await router.push("/");
};

const handleCurrentPageChange = (page: number) => {
  currentPage.value = page;
};

const handlePageSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
};

const handleActiveCurrentPageChange = (page: number) => {
  if (activeRecordTab.value === 'consumption') {
    handleCurrentPageChange(page);
    return;
  }
  rechargeCurrentPage.value = page;
};

const handleActivePageSizeChange = (size: number) => {
  if (activeRecordTab.value === 'consumption') {
    handlePageSizeChange(size);
    return;
  }
  rechargePageSize.value = size;
  rechargeCurrentPage.value = 1;
};

const handleOpenHistoryRecord = () => {
  historyDrawerVisible.value = true;
};

const handleRecharge = () => {
  rechargeDialogVisible.value = true;
};

const handleCloseRechargeTip = () => {
  rechargeTipVisible.value = false;
  rechargeManagementTipStore.set(false);
};

const handleRechargeSubmit = (amount: number) => {
  pendingRechargeAmount.value = amount;
  rechargeDialogVisible.value = false;
  paymentDialogVisible.value = true;
};

const handlePaymentSuccess = () => {
  ElMessage.success(`${i18next.t('WorkbenchRechargeManagement.rechargeSuccess')}: ${formatRechargeAmount(pendingRechargeAmount.value)}`);
  void fetchRecordList();
  void fetchRechargeRecordList();
};
</script>

<style scoped lang="scss">
.recharge-management {
  width: 100%;
  height: 100vh;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &.is-embedded {
    height: 100%;

    .recharge-management-content {
      padding: 12px 16px 16px;
      gap: 16px;
    }

    .record-header,
    .record-filters {
      width: 100%;
    }

    .record-filters {
      flex: 1;
      justify-content: space-between;
    }
  }

  .recharge-management-header {
    height: 48px;
    padding: 0 20px 0 24px;
    background: #ffffff;
    border-bottom: 1px solid #e5e6eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .back-button {
      width: 24px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: var(--cursor-pointer);

      &:hover {
        background: #f2f3f5;
      }
    }

    .header-title {
      color: var(--text-color-primary);
      font-size: 16px;
      line-height: 24px;
      font-weight: 500;
    }

    .header-right {
      display: flex;
      align-items: center;
    }
  }

  .recharge-management-content {
    flex: 1;
    min-height: 0;
    padding: 20px 24px 16px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .recharge-notice {
    height: 46px;
    padding: 0 16px;
    border-radius: 4px;
    background: #FFFBE8;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    .recharge-notice-content {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      column-gap: 4px;
      color: #CF870C;
      font-size: 14px;
      line-height: 22px;
    }

    .recharge-notice-title {
      font-weight: 500;
    }

    .recharge-notice-close {
      width: 16px;
      height: 16px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #86909c;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      cursor: var(--cursor-pointer);
    }
  }

  .summary-container {
    min-height: 76px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid #e5e6eb;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;

    .summary-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .summary-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .summary-card-label {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #4e5969;
      font-size: 14px;
      line-height: 20px;
      font-weight: 400;
    }

    .summary-card-icon {
      width: 20px;
      height: 20px;
      display: inline-block;
      object-fit: contain;
    }

    .summary-card-tag {
      min-width: 60px;
      height: 22px;
      padding: 0 10px;
      border: 0;
      border-radius: 4px;
      background: #f2f3f5;
      color: #4e5969;
      font-size: 12px;
      line-height: 22px;
      cursor: var(--cursor-pointer);
      transition: background-color 0.2s;

      &:hover {
        background: #e5e6eb;
      }
    }

    .summary-card-value {
      height: 36px;
      font-size: 28px;
      line-height: 36px;
      display: flex;
      align-items: baseline;
      gap: 4px;
      color: #1d2129;

      .currency-symbol {
        font-weight: 600;
        line-height: 28px;
      }

      .value-text {
        font-size: 28px;
        line-height: 36px;
        font-weight: 600;
      }
    }

    .summary-action {
      height: 40px;
      border-radius: 8px;
      flex-shrink: 0;
      font-size: 16px;
      padding: 0 24px;
    }
  }

  .record-container {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .record-tabs {
    flex: none;
    margin-bottom: 12px;

    :deep(.el-tabs__header) {
      margin: 0;
    }

    :deep(.el-tabs__item) {
      height: 36px;
      color: #4e5969;
      font-size: 14px;
    }

    :deep(.el-tabs__item.is-active) {
      color: var(--color-primary);
    }
  }

  .record-header {
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    .record-title {
      color: #1d2129;
      font-size: 16px;
      line-height: 24px;
      font-weight: 700;
    }

    .record-filters {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
  }

  .record-table {
    flex: 1;
    min-height: 0;
    border: 1px solid #e5e6eb;
    border-radius: 5px;
    overflow: hidden;
    background: #ffffff;

    .fee-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #4e5969;
    }

    :deep(.el-table) {
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
          border-bottom: 1px solid #E5E6EB;
        }
      }
    }

    :deep(.el-table__inner-wrapper::before) {
      display: none;
    }
  }

  .record-pagination {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;

    :deep(.el-pagination) {
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

.filter-select {
  width: 240px;
}
</style>
