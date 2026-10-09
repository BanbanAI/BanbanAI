<template>
  <el-dialog
    v-model="visible"
    width="400px"
    class="recharge-payment-dialog"
    :align-center="true"
    :destroy-on-close="true"
    @close="handleClose"
  >
    <div class="payment-title">{{ $t('RechargePaymentDialog.scanPay') }}</div>
    <div class="payment-dialog-content">
      <div v-if="paymentStatus === 'expired'" class="payment-status-msg">{{ $t('RechargePaymentDialog.qrCodeInvalidPleaseRetry') }}</div>
      <div v-else class="payment-timer">{{ formatTime(timeLeft) }}</div>
      
      <div class="payment-amount-info">
        {{ $t('RechargePaymentDialog.payAmount') }}: <span class="amount-value">¥ {{ amount }}</span>
      </div>

      <div class="qrcode-container">
        <div v-if="loading" class="qrcode-loading">
          <el-icon class="is-loading"><i-ep-loading /></el-icon>
          <span>{{ $t('RechargePaymentDialog.generatingQrCode') }}</span>
        </div>
        <template v-else>
          <qrcode-vue
            :value="qrCodeUrl"
            :size="172"
            level="H"
            class="payment-qrcode"
          />
          <div v-if="paymentStatus === 'success'" class="payment-success-overlay">
            <el-icon color="#67C23A" :size="60"><i-ep-circle-check-filled /></el-icon>
            <span>{{ $t('RechargePaymentDialog.paySuccess') }}</span>
          </div>

          <!-- 支付中遮罩 -->
          <div v-if="paymentStatus === 'paying'" class="payment-paying-overlay">
            <el-icon class="is-loading paying-icon" color="var(--color-primary)" :size="48"><i-ven-ai-loading /></el-icon>
            <span class="paying-text">{{ $t('RechargePaymentDialog.paying') }}</span>
          </div>

          <!-- 支付失效遮罩 -->
          <div v-if="paymentStatus === 'expired'" class="payment-expired-overlay">
            <span class="expired-text">{{ $t('RechargePaymentDialog.qrCodeInvalid') }}</span>
            <el-button type="primary" class="refresh-btn" @click="handleRefresh">{{ $t('RechargePaymentDialog.clickRefresh') }}</el-button>
          </div>
        </template>
      </div>

      <div class="payment-footer">
        <div class="footer-tip">{{ $t('RechargePaymentDialog.scanPayTip') }}</div>
        <div class="payment-methods">
          <img src="@renderer/assets/image/ai/zfb-icon.png" alt="Alipay" class="method-icon" />
          <img src="@renderer/assets/image/ai/wx-icon.png" alt="WeChat Pay" class="method-icon" />
        </div>
      </div>
    </div>
  </el-dialog>

  <!-- 支付结果弹窗 -->
  <el-dialog
    v-model="resultVisible"
    :width="360"
    class="payment-result-dialog"
    :show-close="true"
    :align-center="true"
    :append-to-body="true"
    @close="handleResultClose"
  >
    <div class="result-content">
      <div class="result-icon">
        <el-icon v-if="resultStatus === 'success'" color="#52C41A" :size="32">
          <i-ep-circle-check-filled />
        </el-icon>
        <el-icon v-else color="#FF4D4F" :size="32">
          <i-ep-circle-close-filled />
        </el-icon>
      </div>
      <div class="result-text">
        {{ resultStatus === 'success' ? $t('RechargePaymentDialog.paySuccessTip') : $t('RechargePaymentDialog.payFailed') }}
      </div>
      <el-button type="primary" class="result-btn" @click="handleResultAction">
        {{ resultStatus === 'success' ? $t('RechargePaymentDialog.confirm') : $t('RechargePaymentDialog.retry') }}
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import axios from 'axios';
import { ref, watch, onUnmounted } from 'vue';
import QrcodeVue from 'qrcode.vue';
import { ElMessage } from 'element-plus';
import { unique } from '@common/utils/unique';
import { usePassportStore } from '@renderer/stores';
import i18next from 'i18next';

const props = defineProps<{
  modelValue: boolean;
  amount: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

type RechargePollingStatus = 'pending' | 'paying' | 'success' | 'expired' | 'fail';

const passportState = usePassportStore();
passportState.init();
const visible = ref(false);
const loading = ref(true);
const qrCodeUrl = ref('');
const timeLeft = ref(900); // 15分钟
const paymentStatus = ref<'pending' | 'paying' | 'success' | 'expired'>('pending');
const resultVisible = ref(false);
const resultStatus = ref<'success' | 'fail'>('success');
const orderNumber = ref('');
let timer: number | null = null;
let pollTimer: number | null = null;

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    startPaymentFlow();
  } else {
    stopTimers();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const resolvePollingStatus = (data: Record<string, any> = {}): RechargePollingStatus => {
  const status = data?.charge?.status;
  switch (status) {
    case 'SCANNED':
      return 'paying';
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'fail';
    default:
      return 'pending';
  }
};

const startPaymentFlow = async () => {
  stopTimers();
  loading.value = true;
  paymentStatus.value = 'pending';
  resultVisible.value = false;
  timeLeft.value = 900;
  qrCodeUrl.value = '';
  orderNumber.value = unique(16);
  
  try {
    const res = await axios.post('/user/get-recharge-payment-url', {
      number: orderNumber.value,
      title: i18next.t('RechargePaymentDialog.rechargeCoin', { coin: props.amount * 100 }),
      money: props.amount,
    });
    qrCodeUrl.value = res.data;
    loading.value = false;

    startCountdown();
    startPolling();
  } catch (_error) {
    loading.value = false;
    ElMessage.error(i18next.t('RechargePaymentDialog.getQrCodeFailed'));
    visible.value = false;
  }
};

const startCountdown = () => {
  stopTimers();
  timer = window.setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--;
    } else {
      paymentStatus.value = 'expired';
      stopTimers();
    }
  }, 1000);
};

const startPolling = () => {
  pollTimer = window.setInterval(async () => {
    if (!orderNumber.value || paymentStatus.value === 'success') {
      return;
    }
    try {
      const res = await axios.post('/user/charge-polling', {
        number: orderNumber.value,
      });
      const nextStatus = resolvePollingStatus(res.data);
      if (res.data?.user) {
        passportState.updateUser(res.data.user);
      }
      if (nextStatus === 'success') {
        paymentStatus.value = 'success';
        stopTimers();
        showResult('success');
        return;
      }
      if (nextStatus === 'paying') {
        paymentStatus.value = 'paying';
      }
      if (nextStatus === 'expired' || nextStatus === 'fail') {
        paymentStatus.value = 'expired';
        stopTimers();
        showResult('fail');
      }
    } catch (_error) {
      // 轮询失败先保持当前状态，避免网络抖动时直接打断支付流程。
    }
  }, 2500);
};

const handleRefresh = () => {
  startPaymentFlow();
};

const stopTimers = () => {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const showResult = (status: 'success' | 'fail') => {
  resultStatus.value = status;
  resultVisible.value = true;
};

const handleResultAction = () => {
  if (resultStatus.value === 'success') {
    resultVisible.value = false;
    visible.value = false;
  } else {
    resultVisible.value = false;
    handleRefresh();
  }
};

const handleResultClose = () => {
  if (resultStatus.value === 'success') {
    emit('success');
    visible.value = false;
  }
};

const handleClose = () => {
  stopTimers();
  orderNumber.value = '';
};

onUnmounted(() => {
  stopTimers();
});
</script>

<style lang="scss">
.recharge-payment-dialog {
  width: 328px;
  border-radius: 12px !important;
  padding: 0;
  overflow: hidden;
  background-color: #fff;

  .el-dialog__header {
    margin-right: 0;
    padding: 0;
    text-align: center;

    .el-dialog__title {
      display: none;
    }
  }

  .el-dialog__body {
    padding: 32px 24px;
  }
}

.payment-title {
  height: 24px;
  line-height: 24px;
  margin: 0 auto;
  font-size: 16px;
  font-weight: 600;
  color: #1d2129;
  text-align: center;
}

.payment-dialog-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  .payment-timer,
  .payment-status-msg {
    font-size: 12px;
    margin-top: 4px;
    height: 20px;
    line-height: 20px;
    color: #71757A;
  }

  .payment-amount-info {
    height: 32px;
    font-size: 14px;
    color: #36393D;
    margin-top: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    .amount-value {
      font-size: 24px;
      font-weight: bold;
      color: #FF4D4F;
    }
  }

  .qrcode-container {
    width: 200px;
    height: 200px;
    padding: 14px;
    margin-top: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    background: #fff;

    .qrcode-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #86909c;
      font-size: 14px;
    }

    .payment-qrcode {
      display: block;
    }

    .payment-success-overlay,
    .payment-expired-overlay,
    .payment-paying-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      font-size: 16px;
      line-height: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 10;
    }

    .payment-success-overlay {
      background: rgba(255, 255, 255, 0.8);
      span {
        font-size: 16px;
        font-weight: 600;
        color: #67c23a;
      }
    }

    .payment-expired-overlay,
    .payment-paying-overlay {
      background: rgba(0, 0, 0, 0.8);
    }

    .payment-expired-overlay {
      .expired-text {
        font-size: 16px;
        color: #fff;
      }

      .refresh-btn {
        height: 36px;
        padding: 0 20px;
        line-height: 22px;
        border-radius: 4px;
        font-size: 14px;
      }
    }

    .payment-paying-overlay {
      gap: 12px;
      .paying-text {
        font-size: 16px;
        color: #fff;
      }
    }
  }

  .payment-footer {
    margin-top: 12px;

    .footer-tip {
      font-size: 14px;
      color: #71757A;
    }
    
    .payment-methods {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;

      .method-icon {
        width: 24px;
        height: 24px;
        object-fit: contain;
      }
    }
  }
}

.payment-result-dialog {
  width: 328px;
  height: 220px;
  padding: 48px 0;
  border-radius: 12px !important;
  
  .el-dialog__header {
    padding: 0;
  }

  .el-dialog__body {
    padding: 0 24px 32px 24px !important;
  }

  .result-content {
    display: flex;
    flex-direction: column;
    align-items: center;

    .result-text {
      font-size: 16px;
      line-height: 24px;
      font-weight: 600;
      color: #1d2129;
      margin-top: 8px;
    }

    .result-btn {
      height: 36px;
      font-size: 14px;
      padding: 0 24px;
      border-radius: 6px;
      margin-top: 22px;
    }
  }
}
</style>
