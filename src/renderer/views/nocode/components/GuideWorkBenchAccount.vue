<template>
  <guide-content class="guide-content" :title="$t('WorkBenchAccount.title')" :subtitle="$t('WorkBenchAccount.subtitle')">
    <template #main>
      <el-form ref="passwordFormRef" class="form-password" :model="formData" :rules="passFormRules" label-width="auto" >
        <el-form-item :label="$t('WorkBenchAccount.companyName')" label-position="left" prop="companyName" :rules="companyNameRules">
          <el-input v-model="companyName" :readonly="!passportState.companyNameEditable" :placeholder="$t('WorkBenchAccount.companyNamePlaceholder')"/>
        </el-form-item>
        <el-form-item class="not-required" :label="$t('WorkBenchAccount.admin')" label-position="left" prop="username">
          <el-input v-model="formData.username" readonly/>
        </el-form-item>
        <el-form-item :label="$t('WorkBenchAccount.password')" label-position="left" prop="password">
          <el-input type="password" v-model="formData.password" :placeholder="$t('WorkBenchAccount.passwordPlaceholder')" show-password/>
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <div class="footer-content">
        <el-button type="primary" @click="handleCompletedInit">{{ $t('WorkBenchAccount.completed') }}</el-button>
      </div>
    </template>
  </guide-content>
</template>

<script setup lang='ts'>
import { ElMessage, ElButton, FormRules, FormItemRule } from 'element-plus';
import { ref, toRaw, computed } from 'vue';
import axios from "axios";
import i18next from "i18next";
import { usePassportStore, useSettingStore } from '@renderer/stores';

const passportState = usePassportStore();
const settingState = useSettingStore();
const emit = defineEmits<{
  (event: 'completed', openWorkBench: boolean)
}>();

const passwordFormRef = ref()
const submitLoading = ref(false)
const formData = ref({ companyName: '', username: 'admin', password: '' });
const companyName = computed({
  get() {
    if (!passportState.companyNameEditable) {
      return settingState.companyName;
    }
    return formData.value.companyName || settingState.companyName;
  },
  set(val) {
    if (!passportState.companyNameEditable) return;
    formData.value.companyName = val;
  }
})

const passFormRules: FormRules = {
  username: [
    {
      get message() { return i18next.t('nocodeLoginDialog.notUsernameTip') },
      trigger: 'blur'
    }
  ],
  password: [
    {
      required: true,
      get message() { return i18next.t('nocodeLoginDialog.notPasswordTip') },
      trigger: 'blur'
    }
  ]
};

const companyNameRules: FormItemRule[] = [
  {
    required: true,
    validator(rule, value, callback, source, options) {
      if (!passportState.companyNameEditable) return callback();
      if (!value) {
        return callback(new Error(i18next.t('nocodeLoginDialog.notCompanyNameTip')));
      }
      callback();
    },
    trigger: 'blur'
  }
]

const handleCompletedInit = async () => {
  submitLoading.value = true;

  passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      const res = await axios.post('/workbench/completed-init', toRaw(formData.value)).catch(({ response }) => {
        ElMessage.error(response.data.message)
      }).finally(() => {
        submitLoading.value = false;
      });

      if (res) {
        emit('completed', true);
      }
    } else {
      ElMessage.warning(i18next.t('nocodeLoginDialog.errorPasswordTip'));
    }
  });
}
</script>
<style scoped lang='scss'>
.guide-content {
  .form-password {
    :deep(.el-input__wrapper) {
      font-size: 16px;
      height: 40px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;

      .el-input__inner::placeholder {
        font-size: 16px;
      }
    }

    :deep(.el-form-item) {
      margin-bottom: 16px;
      &:last-child {
        margin-bottom: 0;
      }

      .el-form-item__error {
        position: static;
        transition: all 0.3s;
        margin-top: 8px;
        padding-top: 0;
        color: #FF4D4F;
      }

      .el-form-item__label {
        line-height: 40px;

          &::before {
            margin-left: -8px !important;
            margin-right: 0;
            font-size: 16px;
            width: 8px;
          }
        }
      }
    }

  .footer-content {
    padding-top: 48px;

    .el-button {
      width: 100%;
      height: 40px;
      border-radius: 4px;
    }

    .tip-wrapper {
      margin-top: 8px;
      width: 100%;
      display: flex;
      justify-content: center;

      .agreement-tip {
        height: 24px;
        font-size: 14px;
        line-height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-color-primary);

        a {
          color: var(--color-primary);
          cursor: var(--cursor-pointer);
          line-height: 14px;
          display: flex;
          align-items: center;

          &.baseline {
            text-decoration: underline;
          }
        }

        .el-button {
          color: var(--color-primary);
          cursor: var(--cursor-pointer);
          margin-top: 24px;
        }

        .checkbox {
          width: 16px;
          height: 16px;
          margin-right: 4px;
          cursor: var(--cursor-pointer);
        }
      }
    }
  }
}
</style>
