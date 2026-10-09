<template>
  <div class="setting-body-wrapper">
    <div class="setting-body">
      <el-form :model="form" :rules="rules" ref="formRef">
        <el-form-item v-for="item in formItems" :key="item.name" :prop="item.name" :label="`${item.label}:`">
          <el-input :type="item.inputType" v-model="form[item.name]" v-if="item.type === 'input'" :placeholder="$t('nocodeLoginDialog.inputTip')"/>
          <el-select v-model="form[item.name]" v-else-if="item.type === 'select'">
            <el-option v-for="option, index in item.options" :key="index" :value="option.value" :label="option.label" />
          </el-select>
        </el-form-item>
      </el-form>
    </div>
    <el-button class="btn-confirm" @click="saveProxy">{{ $t("nocodeLoginDialog.confirm") }}</el-button>
  </div>
</template>

<script setup lang='ts'>
import { onBeforeMount, reactive, ref } from 'vue';
import i18next from 'i18next';
import { FormRules, FormInstance, ElMessage } from 'element-plus';
import { ProxyOptions } from '@common/types/user';
import { useSettingStore } from '@renderer/stores';

const props = withDefaults(defineProps<{
  showHeader?: boolean,
}>(), {
  showHeader: true,
});
// communication
const emit = defineEmits(['goBack']);

// data
const settingState = useSettingStore();
const formRef = ref<FormInstance>();
const formItems = [
  {
    name: 'on',
    get label() { return i18next.t("proxySetting.proxyType") },
    type: 'select',
    options: [
      { get label() { return i18next.t("proxySetting.noProxy") }, value: false },
      { get label() { return i18next.t("proxySetting.httpProxy") }, value: true },
    ]
  },
  {
    name: 'host',
    get label() { return i18next.t("proxySetting.proxyHost") },
    type: 'input',
  },
  {
    name: 'port',
    get label() { return i18next.t("proxySetting.proxyPort") },
    type: 'input',
    inputType: 'number',
  },
  {
    name: 'username',
    get label() { return i18next.t("proxySetting.proxyUsername") },
    type: 'input',
    get placeholder() { return i18next.t("proxySetting.proxyUsernamePlaceholder") }
  },
  {
    name: 'password',
    get label() { return i18next.t("proxySetting.proxyPassword") },
    type: 'input',
    get placeholder() { return i18next.t("proxySetting.proxyPasswordPlaceholder") }
  }
];
const form = reactive<ProxyOptions>({
  ...settingState.proxy,
})

const checkHost = (rule: any, value: any, callback: any) => {
  if (form.on && !value) {
    return callback(new Error(i18next.t("proxySetting.hostNotEmpty")));
  }
  callback();
}
const checkPort = (rule: any, value: any, callback: any) => {
  if (form.on && !value) {
    return callback(new Error(i18next.t("proxySetting.portNotEmpty")));
  }
  callback();
}

const rules = reactive<FormRules<typeof form>>({
  host: [{ validator: checkHost, trigger: 'blur' }],
  port: [{ validator: checkPort, trigger: 'blur' }],
});

const saveProxy = async () => {
  const valid = await formRef.value.validate().then(() => true).catch(() => false);
  if (!valid) return;
  const res = await settingState.setProxyOptions({ ...form });
  if (res) {
    ElMessage.success(i18next.t("proxySetting.saveSuccess"));
  } else {
    ElMessage.error(i18next.t("proxySetting.proxyConnectionFailed"));
  }
}

onBeforeMount(async () => {
  await settingState.getProxyOptions();
  Object.assign(form, settingState.proxy);
  formRef.value?.resetFields();
})
</script>

<style scoped lang='scss'>
.setting-body-wrapper {
  .setting-body {
    :deep(.el-form) {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;

      .el-form-item {
        width: 100%;
        display: flex;
        align-items: center;
        margin-bottom: 16px;
        
        &:first-child {
          margin-top: 32px;
        }

        .el-form-item__label {
          font-size: 14px;
          color: var(--text-color-primary);
          line-height: 14px;
          height: 14px;
          margin-bottom: 0;
          margin-right: 16px;
          width: auto;
          flex-shrink: 0;
        }

        .el-form-item__content {
          display: flex;
          flex: 1;
          width: auto;

          .el-select {
            width: 100%;
          }

          .el-select .el-select__wrapper,
          .el-input .el-input__wrapper {
            background-color: var(--bg-color-overlay);
            font-size: 14px;
            border-radius: 4px;
            box-shadow: none;
            border: none;
          }
        }
      }
    }
  }

  .btn-confirm {
    width: 100%;
    height: 40px;
    border-radius: 4px;
    background-color: #0873FF;
    color: var(--color-white);
    margin: 32px 0 24px 0;
    
    &:hover {
      background-color: #3091FF;
    }
  }
}
</style>
