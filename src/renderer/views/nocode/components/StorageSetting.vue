<template>
  <nocode-panel :title="$t('StorageSetting.storageSetting')" max-height="300px" class="storage-setting">
    <nocode-base-setting-panel v-if="env.inClient()" :title="$t('StorageSetting.storagePath')">
      <div class="setting-item common-path">
        <span class="title">{{ $t('StorageSetting.saveDir') }}</span>
        <div class="wrapper">
          <el-input readonly :model-value="rootDir" :title="rootDir" />
          <el-button class="btn-common" @click.stop="editStoragePathVisible = true">
            {{ $t('commmonSetting.changeDir') }}
          </el-button>
        </div>
      </div>
    </nocode-base-setting-panel>
    <nocode-base-setting-panel :title="$t('StorageSetting.dbSetting')">
      <div class="setting-item db-category">
        <span class="title">{{ $t('StorageSetting.database') }}{{ getI18nLabelColon() }}</span>
        <div class="wrapper">
          <el-checkbox :model-value="dbCategory === DBCategory.EMBEDDED" @update:model-value="handleSwitchToEmbeddedDB">{{ $t('StorageSetting.embeddedDB') }}</el-checkbox>
          <div class="external-db">
            <el-checkbox :model-value="dbCategory === DBCategory.EXTERNAL" @update:model-value="handleSwitchToExternalDB">
              {{ $t('StorageSetting.externalDB') }}
            </el-checkbox>
            <template v-if="dbCategory === DBCategory.EXTERNAL">
              <span>|</span>
              <el-button type="primary" class="" link @click="handleEditDbInfo">{{ $t('StorageSetting.setting')}}</el-button>
            </template>
          </div>
        </div>
      </div>
      <template v-if="dbCategory === DBCategory.EXTERNAL">
        <div class="setting-item">
          <span class="title">{{ $t('StorageSetting.dbType') }}{{ getI18nLabelColon() }}</span>
          <div class="wrapper">
            <el-input readonly :model-value="dbNameLabelMapping[settingState.dbInfo?.type]"></el-input>  
          </div>
        </div>
        <div class="setting-item">
          <span class="title">{{ $t('StorageSetting.dbHost') }}{{ getI18nLabelColon() }}</span>
          <div class="wrapper">
            <el-input readonly :model-value="settingState.dbInfo?.host"></el-input>  
          </div>
        </div>
        <div class="setting-item">
          <span class="title">{{ $t('StorageSetting.dbPort') }}{{ getI18nLabelColon() }}</span>
          <div class="wrapper">
            <el-input readonly :model-value="settingState.dbInfo?.port"></el-input>  
          </div>
        </div>
        <div class="setting-item">
          <span class="title">{{ $t('StorageSetting.dbUsername') }}{{ getI18nLabelColon() }}</span>
          <div class="wrapper">
            <el-input readonly :model-value="settingState.dbInfo?.username"></el-input>  
          </div>
        </div>
        <div class="setting-item">
          <span class="title">{{ $t('StorageSetting.dbPassword') }}{{ getI18nLabelColon() }}</span>
          <div class="wrapper">
            <el-input type="password" readonly model-value="123456789"></el-input>  
          </div>
        </div>
      </template>
    </nocode-base-setting-panel>
    <edit-db-dialog v-model="editDbVisible" :isToEmbedded="editDbCategory === DBCategory.EMBEDDED" @confirm="handleDbEditConfirm" />
    <edit-storage-path-dialog v-if="env.inClient()" v-model="editStoragePathVisible" @confirm="handleEditStoragePathConfirm" />
  </nocode-panel>
</template>

<script lang='ts' setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useSettingStore } from '@renderer/stores';
import { FormDatabaseType } from '@common/types/nocode';
import { getI18nLabelColon } from '@common/utils/i18n';
import { env } from '@renderer/utils/env';

enum DBCategory {
  EMBEDDED = "embedded",
  EXTERNAL = "external",
}

const editDbVisible = ref(false);
const editDbCategory = ref(DBCategory.EXTERNAL);
const editStoragePathVisible = ref(false);
const rootDir = ref('');
const settingState = useSettingStore();

onMounted(() => {
  void settingState.getDbInfo();
  if (env.inClient()) {
    void axios.get('/get-root-dir').then(({ data }) => { rootDir.value = data || ''; });
  }
});

const dbNameLabelMapping = {
  [FormDatabaseType.MONGODB]: "MongoDB",
}
const dbCategory = computed(() => {
  const type = settingState.dbInfo?.type;
  const res = (type !== FormDatabaseType.EMBEDDED) ? DBCategory.EXTERNAL : DBCategory.EMBEDDED;
  console.log("dbCategory", res)
  return res;
})
console.log("settingState", settingState, dbCategory)
const handleSwitchToExternalDB = async () => {
  if (dbCategory.value === DBCategory.EXTERNAL) return;
  editDbCategory.value = DBCategory.EXTERNAL;
  editDbVisible.value = true;
}

const handleSwitchToEmbeddedDB = async () => {
  if (dbCategory.value === DBCategory.EMBEDDED) return;
  editDbCategory.value = DBCategory.EMBEDDED;
  editDbVisible.value = true;
}

const handleEditDbInfo = () => {
  editDbCategory.value = DBCategory.EXTERNAL;
  editDbVisible.value = true;
}
const handleDbEditConfirm = async () => {
  await settingState.getDbInfo(true);
}

const handleEditStoragePathConfirm = async () => {
  await axios.post('/relaunch');
}
</script>

<style lang='scss' scoped>
.storage-setting {
  .setting-item {
    margin-bottom: 16px;
    width: 100%;
    // height: 32px;
    display: flex;
    align-items: center;

    .title {
      display: inline-block;
      font-size: 14px;
      width: 70px;
      line-height: 20px;
      margin-right: 16px;
      color: var(--text-color-regular);

      &.system-dll-miss {
        margin-bottom: 45px;
      }
    }

    .el-button {
      width: 100px;
      height: 32px;
      border-radius: 4px;
      padding-top: 8px;
    }

    .local-import {
      background-color: var(--bg-color-overlay);
      border: none;
    }

    .tip {
      font-weight: 400;
      font-size: 12px;
      line-height: 20px;
      letter-spacing: 0%;

      height: 100%;
      margin-left: 8px;
      white-space: nowrap;
      display: flex;
      align-items: flex-end;

      &.error {
        color: #f9484e;
      }

      &.success {
        color: #5ec431;
      }
    }

    .wrapper {
      flex: 1;
      height: 100%;
      display: flex;
      gap: 8px;

      .btn-common {
        width: 60px;
        border: none;
        background-color: var(--bg-color-overlay);
      }
    }

    .radio-container {
      display: flex;
      justify-content: flex-start;

      .radio-item {
        margin-right: 30px;
        height: 30px;
        line-height: 30px;
        user-select: none;
        display: flex;
        justify-content: center;
        align-items: center;

        .checkbox {
          width: 18px;
          height: 18px;
          margin-right: 8px;
          vertical-align: middle;
          color: transparent;

          &::before {
            content: "\2714";
            display: block;
            width: 100%;
            height: 100%;
            background-color: var(--bg-color-overlay);
            border: 1px solid var(--border-color);
            line-height: 18px;
            text-align: center;
            font-size: 18px;
            box-sizing: border-box;
          }
        }

        .https-btn {
          display: flex;
          cursor: pointer;
          border-left: 1px solid var(--border-color);
          padding: 0px;
          line-height: 13px;
          margin-left: 8px;
          padding-left: 8px;
          color: var(--color-primary);
          transition: all 0.3s ease;

          &:hover {
            opacity: 0.7;
          }
        }

        &.checked {
          .checkbox {
            color: var(--color-primary);
          }
        }

        span {
          font-size: 12px;
          font-weight: 400;
          color: var(--text-color-regular);
        }
      }
    }

    .startup-body {
      .starting {
        .el-button {
          background-color: #fff;
        }
      }

      .start-success {
        .el-button {
          background-color: #fff;
        }

        .el-icon {
          margin-right: 2px;
        }
      }

      .restart {
        .el-icon {
          margin-right: 2px;
        }

        .dll-tip {
          margin-top: 8px;
          line-height: 14px;
          color: var(--el-color-danger);

          a {
            color: #0089ff;
          }
        }

        .error-tip {
          margin-left: 8px;
          position: relative;
          top: 5px;
          font-size: 12px;
          color: var(--el-color-danger);
        }
      }
    }
  }

  .db-category {
    .wrapper {
      column-gap: 32px;
      .external-db {
        display: flex;
        align-items: center;
        column-gap: 7px;

        .el-button {
          width: auto;
          padding: 0;

          &:focus-visible {
            outline: none;
          }
        }
      }
    }
  }

  :deep(.el-input) {
    .el-input__wrapper {
      box-shadow: none;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
    }
  }
}
</style>
