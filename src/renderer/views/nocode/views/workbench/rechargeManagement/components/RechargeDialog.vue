<template>
  <el-dialog
    v-model="visible"
    :title="$t('RechargeDialog.recharge')"
    width="544px"
    class="recharge-dialog"
    :align-center="true"
    :destroy-on-close="true"
  >
    <div class="recharge-dialog-content">
      <div class="amount-input-container">
        <div class="amount-label">{{ $t('RechargeDialog.rechargeAmount') }}</div>
        <div class="amount-input-wrapper">
          <span class="currency-symbol">¥</span>
          <!-- <input
            type="number"
            v-model="rechargeAmount"
            class="amount-input"
            :placeholder="$t('RechargeDialog.rechargeAmountTip')"
            @input="handleInput"
          /> -->
          <div class="amount-input">{{ rechargeAmount }}</div>
        </div>
      </div>

      <div class="quick-amounts">
        <div
          v-for="amount in predefinedAmounts"
          :key="amount"
          class="quick-amount-item"
          :class="{ active: Number(rechargeAmount) === amount }"
          @click="selectAmount(amount)"
        >
          <div class="amount-val">¥ {{ amount }}</div>
          <div class="points-val">
            <el-icon :size="12" color="#3793ff"><i-ven-ai-score-icon /></el-icon>
            <span>{{ amount * 100 }}{{ $t('RechargeDialog.score') }}</span>
          </div>
        </div>
      </div>

      <el-button
        type="primary"
        class="submit-recharge-btn"
        :disabled="!rechargeAmount || +rechargeAmount <= 0"
        @click="handleSubmit"
      >
        {{ $t('RechargeDialog.rechargeNow') }}
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', amount: number): void;
}>();

const visible = ref(false);
const rechargeAmount = ref<number | string>(10);
const predefinedAmounts = [10, 50, 100, 200, 500, 1000];

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    rechargeAmount.value = 10;
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const selectAmount = (amount: number) => {
  rechargeAmount.value = amount;
};

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  rechargeAmount.value = target.value;
};

const handleSubmit = () => {
  const amount = Number(rechargeAmount.value);
  if (amount > 0) {
    emit('submit', amount);
    visible.value = false;
  }
};
</script>

<style lang="scss">
$bd-color: #E5E6EB;

.recharge-dialog {
  border-radius: 12px !important;
  overflow: hidden;
  padding: 0;
  background-color: #fff;

  .el-dialog__header {
    height: 48px;
    padding: 0 24px;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid $bd-color;

    .el-dialog__title {
      font-size: 16px;
      font-weight: 600;
      color: #1d2129;
      line-height: normal;
    }
  }

  .el-dialog__body {
    padding: 24px 20px;
  }
}

.recharge-dialog-content {
  display: flex;
  flex-direction: column;

  .amount-input-container {
    padding: 12px 16px;
    border: 1px solid $bd-color;
    border-radius: 8px;
    background: #fff;

    .amount-label {
      font-size: 14px;
      line-height: 22px;
      color: #86909c;
      margin-bottom: 16px;
    }

    .amount-input-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;

      .currency-symbol {
        font-size: 28px;
        font-weight: 600;
        color: #1d2129;
      }

      .amount-input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 28px;
        font-weight: 600;
        color: #1d2129;
        padding: 0;
        background: transparent;

        &::placeholder {
          color: #c9cdd4;
          font-weight: 400;
          font-size: 18px;
        }

        /* 移除 number input 的箭头 */
        &::-webkit-outer-spin-button,
        &::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      }
    }
  }

  .quick-amounts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 16px;

    .quick-amount-item {
      height: 64px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      border: 1px solid $bd-color;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      --svg-gradient-start: #86909c;
      --svg-gradient-end: #86909c;

      .amount-val {
        font-size: 16px;
        color: #4e5969;
        line-height: 22px;
      }

      .points-val {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #86909C;
        line-height: 18px;
      }

      &:hover {
        background: #f7f8fa;
        border-color: #c9cdd4;
      }

      &.active {
        $primary: var(--el-color-primary, var(--color-primary, #0873FF));
        
        background: #E8F6FF;
        border-color: $primary;

        --svg-gradient-start: #0873FF;
        --svg-gradient-end: #62B0FF;

        .amount-val {
          color: #4E5969;
          font-weight: 500;
        }

        .points-val {
          color: $primary;
        }
      }
    }
  }

  .submit-recharge-btn {
    height: 48px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    margin-top: 48px;
  }
}
</style>