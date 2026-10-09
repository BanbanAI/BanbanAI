<template>
  <el-popover
    placement="right-start"
    :width="256"
    trigger="hover"
    :show-arrow="false"
    popper-class="recharge-fee-detail-popover"
  >
    <template #reference>
      <i class="fee-tip-icon">i</i>
    </template>
    <div class="fee-detail-container">
      <div class="fee-detail-header">{{ $t('RechargeFeeDetailPopover.feeDetail') }}</div>
      
      <div class="fee-detail-section">
        <div class="fee-detail-item">
          <span class="label">{{ $t('RechargeFeeDetailPopover.inputTokens') }}</span>
          <span class="value">{{ formatTokenCount(data.inputTokens) }}</span>
        </div>
        <div class="fee-detail-item">
          <span class="label">{{ $t('RechargeFeeDetailPopover.outputTokens') }}</span>
          <span class="value">{{ formatTokenCount(data.outputTokens) }}</span>
        </div>
        <div class="fee-detail-item">
          <span class="label">{{ $t('RechargeFeeDetailPopover.cachedTokens') }}</span>
          <span class="value">{{ formatTokenCount(data.cachedTokens) }}</span>
        </div>
        <div class="fee-detail-item total-row">
          <span class="label">{{ $t('RechargeFeeDetailPopover.tokens') }}</span>
          <span class="value">{{ formatTokenCount(data.tokens) }}</span>
        </div>
      </div>

      <div class="fee-detail-divider"></div>

      <div class="fee-detail-section">
        <div class="fee-detail-item">
          <span class="label">{{ $t('RechargeFeeDetailPopover.inputCost') }}</span>
          <span class="value">{{ (inputCost).toFixed(4) }}</span>
        </div>
        <div class="fee-detail-item">
          <span class="label">{{ $t('RechargeFeeDetailPopover.outputCost') }}</span>
          <span class="value">{{ (outputCost).toFixed(4) }}</span>
        </div>
        <div class="fee-detail-item">
          <span class="label">{{ $t('RechargeFeeDetailPopover.cachedCost') }}</span>
          <span class="value">{{ (cachedCost).toFixed(4) }}</span>
        </div>
      </div>

      <div class="fee-detail-divider"></div>

      <!-- <div class="fee-detail-section">
        <div class="fee-detail-item">
          <span class="label">输入单价</span>
          <span class="value">{{ data.inputUnitPrice.toFixed(4) }} / 1M Token</span>
        </div>
        <div class="fee-detail-item">
          <span class="label">输出单价</span>
          <span class="value">{{ data.outputUnitPrice.toFixed(4) }} / 1M Token</span>
        </div>
      </div>

      <div class="fee-detail-divider"></div> -->

      <div class="fee-detail-section no-margin">
        <div class="fee-detail-item total-cost-row">
          <span class="label">{{ $t('RechargeFeeDetailPopover.totalCost') }}</span>
          <span class="value">{{ (totalCost).toFixed(4) }}</span>
        </div>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from "vue";

export interface FeeDetailData {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  tokens: number;
  coin: number;
  inputTokenPricePerMillion: number;
  outputTokenPricePerMillion: number;
}

const props = withDefaults(
  defineProps<{
    data?: FeeDetailData;
  }>(),
  {
    data: () => ({
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      tokens: 0,
      coin: 0,
      inputTokenPricePerMillion: 0,
      outputTokenPricePerMillion: 0,
    }),
  },
);

const formatTokenCount = (value?: number) =>
  Number(value || 0).toLocaleString();

const calculateCost = (tokens?: number, pricePerMillion?: number) => {
  return (Number(tokens || 0) * Number(pricePerMillion || 0)) / 1000000;
};

const inputCost = computed(() => {
  return calculateCost(
    props.data.inputTokens,
    props.data.inputTokenPricePerMillion,
  );
});

const outputCost = computed(() => {
  return calculateCost(
    props.data.outputTokens,
    props.data.outputTokenPricePerMillion,
  );
});

const totalCost = computed(() => Number(props.data.coin || 0));

const cachedCost = computed(() => {
  const remainCost = totalCost.value - inputCost.value - outputCost.value;
  return remainCost > 0 ? remainCost : 0;
});
</script>

<style lang="scss">
.el-popover.recharge-fee-detail-popover {
  background-color: #fff;
  padding: 9px 12px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e6eb;
}

.fee-detail-container {
  .fee-detail-header {
    font-size: 14px;
    font-weight: 500;
    color: #1d2129;
    margin-bottom: 14px;
    line-height: 20px;
  }

  .fee-detail-section {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: 8px;

    &.no-margin {
      margin-bottom: 0;
    }
  }

  .fee-detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    line-height: 28px;

    .label {
      color: #86909c;
    }

    .value {
      color: #1d2129;
      font-weight: 400;
      margin-left: 16px;
      text-align: right;
      white-space: nowrap;
    }
  }

  .fee-detail-divider {
    height: 1px;
    background-color: #e5e6eb;
    margin: 8px -8px;
  }
}

.fee-tip-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #c9cdd4;
  color: #86909c;
  font-size: 10px;
  line-height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-style: normal;
  cursor: help;
  margin-left: 0;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}
</style>
