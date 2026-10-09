<template>
  <div class="workbench-home-setting">
    <div class="workbench-home-setting-content">
      <div class="workbench-setting">
        <el-form>
          <el-form-item :label="$t('WorkbenchHomeSetting.themeColor') + getI18nLabelColon() + ' '" v-if="false">
            <el-select placeholder="$t('WorkbenchHomeSetting.selectTheme')">
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('WorkbenchHomeSetting.deletePrompt') + getI18nLabelColon() + ' '">
            <el-switch v-model="isDeleteTip" @change="deleteRemindFn"></el-switch>
            <span>
              {{ $t('WorkbenchHomeSetting.showPopupPrompt') }}
            </span>
          </el-form-item>
          <el-form-item :label="$t('WorkbenchHomeSetting.autoSave') + getI18nLabelColon() + ' '">
            <el-switch v-model="isAutoSave" @change="setSaveRegularly('switch')"></el-switch>
            <span>
              {{ $t('WorkbenchHomeSetting.interval') }}
            </span>
            <el-input @change="setSaveRegularly('delay')" v-model="autoSaveInterval" class="auto-save-interval"></el-input>
            <span>
              {{ $t('WorkbenchHomeSetting.intervalTime') }}
            </span>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { useSettingStore } from '@renderer/stores';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { ref, watch } from 'vue';
import { useLocalizedDocumentTitle } from '@renderer/hooks/useLocalizedDocumentTitle';
import { getI18nLabelColon } from '@common/utils/i18n';

useLocalizedDocumentTitle(() => `${i18next.t("WorkbenchHomeSetting.workbench")} - ${i18next.t("WorkbenchHomeSetting.setting")}`);

const settingState = useSettingStore();
const isDeleteTip = ref(settingState.ifDeleteRemind);
const isAutoSave = ref(false);
const autoSaveInterval = ref(10);

watch(() => settingState.ifDeleteRemind, (value) => {
  isDeleteTip.value = value;
});

// 删除提醒
const deleteRemindFn = async () => {
  if (!isDeleteTip.value) {
    // 关闭删除提醒
    settingState.offDeleteRemind();
    ElMessage.success(`${i18next.t("WorkbenchHomeSetting.deleteRemindClose")}`);
  } else {
    // 开启删除提醒
    settingState.openDeleteRemind();
    ElMessage.success(`${i18next.t("WorkbenchHomeSetting.deleteRemindOpen")}`);
  }
}

//自动保存项目
const checkAutoSaveProject = async () => { //检测自动保存功能是否开启
  await settingState.autoSaveProject();
  isAutoSave.value = settingState.isAutoSaveProject;
  autoSaveInterval.value = settingState.autoSaveInterval;
}

checkAutoSaveProject();
const setSaveRegularly = async (type: 'switch' | 'delay') => {
  await settingState.setAutoSaveProjectInfo({
    autoSaveInterval: autoSaveInterval.value,
    autoSaveProject: isAutoSave.value
  });
  if (type === 'switch') {
    const info = isAutoSave.value ? `${i18next.t("WorkbenchHomeSetting.autoSaveOpen")}` : `${i18next.t("WorkbenchHomeSetting.autoSaveClose")}`;
    ElMessage.success(info);
  } else {
    ElMessage.success(`${i18next.t("WorkbenchHomeSetting.autoSaveTimeSet")}`);
  }
}
</script>

<style scoped lang='scss'>
.workbench-home-setting {
  height: 100%;

  :deep(.el-input) {
    .el-input__wrapper {
      border-radius: 4px;
    }
  }

  :deep(.el-button) {
    border-radius: 4px;
  }

  .workbench-home-setting-content {
    height: 100%;
    min-height: 640px;
    margin: 0 auto;
    background-color: var(--bg-color-page);
    padding: 16px;
    border-radius: 4px;

    :deep(.title-panel) {
      height: auto;
      margin-bottom: 24px;
    }

    .icon-copy {
      cursor: pointer;
    }

    .workbench-setting {
      :deep(.el-form) {
        width: 512px;

        .el-form-item {
          .el-select {
            .el-select__wrapper {
              border-radius: 4px;
              box-shadow: unset;
              background-color: var(--bg-color-overlay);

              &:hover {
                box-shadow: 0 0 0 1px var(--border-color) inset;
              }

              &.is-focus {
                box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
              }
            }
          }

          .el-input {
            height: 24px;

            .el-input__wrapper {
              border-radius: 4px;
              padding: 4px;
            }

            .el-input-group__append {
              width: 48px;
              margin-left: 8px;
              background-color: var(--bg-color-overlay);
              border: unset;
              box-shadow: unset;
              color: var(--color-primary);
              border-radius: 4px;
              cursor: var(--cursor-pointer);
            }

            &.auto-save-interval {
              width: 32px;
              margin: 0 8px;

              .el-input__inner {
                text-align: center;
              }
            }
          }

          .el-switch {
            margin-right: 8px;
          }
        }
      }
    }
  }
}
</style>
