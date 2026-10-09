<template>
  <div class="api-setting">
    <el-form ref="elFormRef" class="setting-form" :model="settingForm" label-position="left" label-width="auto">
      <el-form-item :label="$t('ApiSetting.enableApi')" prop="apiEnabled">
        <el-switch v-model="settingForm.apiEnabled" />
      </el-form-item>

      <el-form-item :label="$t('ApiSetting.appId')" prop="id">
        <el-input v-model="settingForm.id" class="noborder-input id-input" readonly style="width: 192px;" />
      </el-form-item>

      <el-form-item prop="apiAlias" :rules="settingFormRules.apiAlias">
        <template #label>
          <span>{{ $t('ApiSetting.appAlias') }}</span>
          <el-tooltip placement="bottom" effect="light">
            <template #content>
              {{ $t('ApiSetting.appAliasRule') }}
            </template>
            <el-icon class="icon-circle-question"><i-nocode-circle-question /></el-icon>
          </el-tooltip>
        </template>
        <el-input v-model="settingForm.apiAlias" class="noborder-input" clearable style="width: 420px;" />
      </el-form-item>

      <el-form-item :label="$t('ApiSetting.appApiUrl')" prop="apiUrl">
        <el-input ref="apiUrlInputRef" v-model="apiUrl" class="noborder-input" readonly style="width: 420px;">
          <template #suffix>
            <el-icon class="icon-copy" @click="copyApiUrl()"><i-nocode-copy /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-table :data="apiTableInfo" show-overflow-tooltip class="setting-table">
        <el-table-column prop="name" :label="$t('ApiSetting.formName')" width="180"></el-table-column>
        <el-table-column prop="id" :label="$t('ApiSetting.formId')" width="180"></el-table-column>

        <el-table-column prop="apiAlias" width="180">
          <template #header>
            <span>{{ $t('ApiSetting.formAlias') }}</span>
            <el-tooltip placement="bottom" effect="light">
              <template #content>
                {{ $t('ApiSetting.formAliasRule') }}<br>{{ $t('ApiSetting.formAliasRule2') }}
              </template>
              <el-icon class="icon-circle-question"><i-nocode-circle-question /></el-icon>
            </el-tooltip>
          </template>
          <template #default="scope">
            <el-form-item :prop="`apiTableInfo[${scope.$index}].apiAlias`"
              :rules="settingFormRules.apiTableInfo.apiAlias">
              <el-input v-model="scope.row.apiAlias" size="small" clearable />
            </el-form-item>
          </template>
        </el-table-column>

        <el-table-column prop="public" width="180">
          <template #header>
            <span>{{ $t('ApiSetting.publicRead') }}</span>
            <el-tooltip placement="bottom" effect="light">
              <template #content>
                {{ $t('ApiSetting.publicReadTip') }}
              </template>
              <el-icon class="icon-circle-question"><i-nocode-circle-question /></el-icon>
            </el-tooltip>
          </template>
          <template #default="scope">
            <el-form-item :prop="`apiTableInfo[${scope.$index}].public`" class="table-switch-item">
              <el-switch v-model="scope.row.public" />
            </el-form-item>
          </template>
        </el-table-column>

      </el-table>
    </el-form>
    <div class="bottom-container">
      <el-button type="primary" class="save-btn" @click="handleSave">{{ $t('ApiSetting.save') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AliasType, ApiSetting, ApiTableSetting } from '@main/modules/project/types';
import { computed, inject, Ref, ref, shallowRef, watch, nextTick } from 'vue';
import axios from 'axios';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useSettingStore } from '@renderer/stores/setting';
import { useClipboard } from '@vueuse/core';
import { TableUID } from '@common/types/project';
import i18next from 'i18next';

const route = useRoute();
const settingState = useSettingStore();
settingState.getDomainPort();
const nocodeId: string = route.params.nocodeId as string;
const { copy } = useClipboard({ legacy: true });

const isChanged = inject<Ref<boolean>>('isChanged');

const elFormRef = shallowRef();
const settingForm = ref<ApiSetting>({
  id: '',
  apiEnabled: false,
  apiAlias: '',
  apiTableInfo: []
});
const apiTableInfo = computed<ApiTableSetting[]>({
  get: () => settingForm.value.apiTableInfo,
  set: () => { }
});

const apiUrl = computed<string>(() => {
  const saasDomain = settingState.saas.domain;
  let appSign: string = settingForm.value.apiAlias || settingForm.value.id;
  return `${saasDomain}/api/v1/${appSign}`;
});

const aliasPattern = /^[a-zA-Z0-9_-]*$/;
const settingFormRules = ref({
  apiAlias: [
    { validator: appAliasValidator, trigger: 'blur' }
  ],
  apiTableInfo: {
    apiAlias: [
      { validator: tableAliasValidator, trigger: 'blur' }
    ]
  }
});

async function getApiSetting() {
  await axios.get(`project/api-setting/${nocodeId}`).then(res => {
    settingForm.value = res.data.data;
  });
}

function copyApiUrl() {
  try {
    copy(apiUrl.value).then(res => {
      ElMessage.success(i18next.t('ApiSetting.copySuccess'));
    });
  } catch (error) {
    console.error('Failed to copy: ', error);
  }
}

async function appAliasValidator(rule: any, value: string, callback: any) {
  if (!aliasPattern.test(value)) {
    callback(new Error(i18next.t('ApiSetting.formatError')));
  } else if (value == '' || value == null) {
    callback();
  } else {
    const valid = await validAlias(value, 'app', settingForm.value.id);
    if (!valid) callback(new Error(i18next.t('ApiSetting.appAliasRepeat')));
    else callback();
  }
}
async function tableAliasValidator(rule: any, value: string, callback: any) {
  if (!aliasPattern.test(value)) {
    callback(new Error(i18next.t('ApiSetting.formatError')));
  } else if (value === '' || value == null) {
    callback();
  } else {
    const appId: string = settingForm.value.id;
    const match = rule.fullField.match(/apiTableInfo\[(\d+)\]/);
    const tableIndex = Number(match[1]);
    const tableId: TableUID = settingForm.value.apiTableInfo[tableIndex].id;

    const valid = await validAlias(value, 'table', appId, tableId);
    if (!valid) callback(new Error(i18next.t('ApiSetting.formAliasRepeat')));
    else callback();
  }
}

async function validAlias(alias: string, type: AliasType, appId: string, tableId?: TableUID) {
  const res = await axios.post('project/api-alias-valid', { alias, type, appId, tableId });
  return res.data.valid;
}

async function handleSave() {
  elFormRef.value.validate(async (valid: boolean, fields: any) => {
    if (!valid) return;
    await axios.post('project/api-setting', settingForm.value).then(res => {
      settingForm.value = res.data.data;
      ElMessage.success(i18next.t('ApiSetting.saveSuccess'));
      nextTick(() => {
        isChanged.value = false;
      });
    });
  });
}

watch(() => settingForm.value, (newVal, oldVal) => {
  if (oldVal.id) isChanged.value = true;
}, { deep: true });

getApiSetting();

defineExpose({
  savePermissions: handleSave
});
</script>

<style lang="scss" scoped>
.api-setting {
  width: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.el-form.setting-form) {
  font-weight: 400;
  font-size: 14px;
  color: #373737;
  padding: 16px;
  flex-grow: 1;
  overflow: auto;

  .el-form-item {
    .el-form-item__label {
      display: flex;
      align-items: center;
    }

    .noborder-input {
      .el-input__wrapper {
        box-shadow: unset;
        background-color: var(--bg-color-overlay);
        border-radius: 4px;
      }
    }
    .id-input .el-input__inner{
      color: #A1A1A1;
    }
  }

  .el-table.setting-table {
    max-width: fit-content;
    border: 1px solid #D9D9D9;
    border-radius: 4px;
    padding: 8px;
    color: #373737;

    .el-table__inner-wrapper {
      gap: 8px;

      &::before {
        height: 0px;
      }
    }

    .el-table__header-wrapper {
      .cell .icon-circle-question {
        position: relative;
        top: 2px;
        left: 2px;
      }
    }

    .el-table__body-wrapper {
      .el-table__cell {
        border-bottom: none;
        padding: 2px 0px;
      }

      .el-table__body tr:hover>td.el-table__cell {
        background-color: #F5F6F7;
        --radius: 4px;

        &:first-child {
          border-top-left-radius: var(--radius);
          border-bottom-left-radius: var(--radius);
        }

        &:last-child {
          border-top-right-radius: var(--radius);
          border-bottom-right-radius: var(--radius);
        }
      }
    }

    .el-table__cell {
      text-align: center;
    }

    thead {
      color: inherit;
      th {
        font-weight: 400;
      }
    }

    tr,
    .el-table__cell {
      background-color: transparent;
    }

    .el-form-item{
      margin-bottom: 0px;
      .el-form-item__content{
        justify-content: center;
      }
    }

    .el-input__wrapper {
      border-radius: 2px;
    }
  }

  .icon-circle-question {
    cursor: pointer;
    color: white;
  }

  .icon-copy {
    cursor: pointer;
  }
}

:deep(.el-button.el-button--primary){
  background-color: #0873FF;
  border-radius: 4px;
}

.bottom-container {
  width: 100%;
  padding: 16px;
  border-top: 1px solid #D9D9D9;
}
</style>