<template>
  <div class="valid-rule-form">
    <div class="title">
      <span class="title-left">
        {{ $t('ValidConditions.verifyCondition') }}
      </span>
      <div class="add-button" @click="addValidCondition">
        <el-icon>
          <i-ep-plus></i-ep-plus>
        </el-icon>
        <span>{{ $t('ValidConditions.addGroup') }}</span>
      </div>
    </div>
    <div class="tips">
      <el-icon size="16"><Warning /></el-icon>
      <div class="text">{{ $t('ValidConditions.conditionDesc') }}</div>
    </div>

    <template v-for="(condition, index) in props.validConditions">
      <span class="group-division" v-if="index !== 0">{{ $t('ValidConditions.orMeet') }}</span>

      <div class="form-container">
        <div class="header">
          <span class="form-name">
            {{ $t('ValidConditions.conditionGroup') }}{{ index + 1 }}
          </span>
          <el-icon class="delete" @click="deleteCondition(index)">
            <i-ep-delete />
          </el-icon>
        </div>
        <el-form :rules="rules" :model="condition" ref="formRef" class="body">
          <div class="group-submit-settings">
            <div class="setting-row">
              <span class="setting-label">{{ $t('ValidConditions.submitMode') }}</span>
              <el-switch
                size="small"
                v-model="condition.submitMode"
                :active-value="FormSubmitValidMode.ALLOW"
                :inactive-value="FormSubmitValidMode.BLOCK"
              />
            </div>
            <div class="setting-row" v-if="condition.submitMode === FormSubmitValidMode.ALLOW">
              <span class="setting-label">{{ $t('ValidConditions.allowNoticeMode') }}</span>
              <el-radio-group v-model="condition.allowNoticeMode" class="setting-radio-group">
                <el-radio
                  v-for="item in allowNoticeModeOptions"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </el-radio>
              </el-radio-group>
            </div>
          </div>
          <div class="error-text">
            <span class="error-text-label">{{ $t('ValidConditions.verifyFailTip') }}</span>
            <el-form-item prop="errorText" :style="{ flex: '1' }">
              <el-input style="width: 100%;" v-model="condition.errorText" clearable />
            </el-form-item>
          </div>

          <el-divider />
          <condition-setting-item ref="conditionRef" :tableUID="table?.uid" :validRule="condition" :sourceTables="sourceTables"></condition-setting-item>
        </el-form>
      </div>
    </template>
  </div>
</template>

<script lang='ts' setup>
import { ConditionalGroup, FormSubmitAllowNoticeMode, FormSubmitValidMode, SourceTable, Table, TableUID } from "@common/types/project";
import { ref} from "vue";
import { Warning } from '@element-plus/icons-vue';
import i18next from "i18next";

const props = defineProps<{
  targetTableUid: TableUID,
  validConditions: ConditionalGroup[],
  sourceTables: SourceTable[],
  table: Table
}>();

const rules = {
  errorText: [{
    required: true,
    get message() { return i18next.t('ValidConditions.inputVerifyTip') },
    trigger: 'change'
  }]
}
const formRef = ref()
const conditionRef = ref()
const allowNoticeModeOptions = [
  {
    value: FormSubmitAllowNoticeMode.DIALOG,
    get label() { return i18next.t('ValidConditions.allowNoticeModeDialog') },
  },
  {
    value: FormSubmitAllowNoticeMode.TOAST,
    get label() { return i18next.t('ValidConditions.allowNoticeModeToast') },
  },
]

const deleteCondition = (index) => {
  props.validConditions.splice(index,1)
}

const addValidCondition = () => {
  props.validConditions.push({
    errorText: i18next.t('ValidConditions.submitFailTip'),
    conditions: [],
    submitMode: FormSubmitValidMode.BLOCK,
    allowNoticeMode: FormSubmitAllowNoticeMode.DIALOG,
  })
}

const validate = async () => {
  if (!props.validConditions?.length) {
    return true;
  }

  if (Array.isArray(formRef.value)) {
    // 多个子表单逐个校验
    const validationResults = await Promise.all(
      formRef.value.map((form, index) => 
        new Promise<boolean>((resolve) => form.validate(resolve))
          .then(isFormValid => {
            if (!isFormValid) return false;
            const conditionComponent = conditionRef.value?.[index];
            if (conditionComponent) {
              return conditionComponent.validate();
            }
            return false;
          })
          .catch(() => false)
      )
    )
    return validationResults.every(Boolean)
  } else {
    // 单个表单
    const isFormValid = await new Promise<boolean>((resolve) => {
      formRef.value.validate(resolve);
    });
    if (!isFormValid) return false;

    const conditionComponent = conditionRef.value;
    if (conditionComponent) {
      return conditionComponent.validate();
    }
    return false;
  }
}

defineExpose({
  validate,
})
</script>

<style lang='scss' scoped>
.valid-rule-form {
  display: flex;
  flex-direction: column;
  gap: 12px;

  :deep(.el-input__wrapper) {
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
        box-shadow: unset;

        &:hover {
          box-shadow: 0 0 0 1px var(--border-color) inset;
        }

        &.is-focus {
          box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
        }

        .el-input__inner {
          font-size: 14px;
          height: 32px;

          &::placeholder {
            font-size: 14px;
          }
        }
      }

  .title {
    display: flex;

    .title-left {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    span {
      font-weight: 500;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
    }

    .add-button {
      margin-left: auto;
      color: var(--color-primary);
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;

      .el-icon {
        font-size: 16px;
      }

      span {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
      }
    }
  }

  .tips {
    width: 100%;
    height: 38px;
    background-color: rgb(255, 251, 232);
    color: var(--el-color-warning);
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding-left: 12px;
    .text {
      margin-left: 3px;
      font-size: 14px;
      line-height: 22px;
    }
  }

  .group-division {
    font-size: 14px;
    color: var(--text-color-placeholder);
  }

  .form-container {
    width: 100%;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    overflow: hidden;

    .header {
      background-color: var(--bg-color-overlay);
      display: flex;
      align-items: center;
      padding: 8px;
      border-bottom: 1px solid var(--border-color);

      .form-name {
        display: flex;
        align-items: center;
      }

      span {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
      }

      .edit-pen {
        margin-left: 8px;
      }

      .status-tag {
        margin-left: auto;
        background-color: #52C41A;
        color: var(--color-white);
        padding: 2px 4px;
        border-radius: 2px;
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0%;
      }

      .el-icon {
        font-size: 16px;
        cursor: pointer;
        color: var(--text-color-secondary);
      }

      .delete {
        margin-left: auto;
      }
    }

    .body {
      display: flex;
      flex-direction: column;
      padding: 8px;
      gap: 12px;

      .group-submit-settings {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .setting-row {
        display: flex;
        align-items: center;
        min-height: 32px;
        gap: 16px;
      }

      .setting-label {
        width: 132px;
        flex: none;
        font-size: 14px;
        line-height: 22px;
        color: var(--text-color);
      }

      .setting-radio-group {
        display: flex;
        align-items: center;
        gap: 24px;
        min-height: 32px;
      }

      .error-text {
        display: flex;
        flex-direction: column;
        align-items: start;
        width: 100%;

        .error-text-label {
          line-height: 32px;
          margin-bottom: 4px;
        }
        .el-form-item {
          width: 100%;
        }
        span {
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
        }

        :deep(.el-input) {
          flex: 1;
        }
      }

      .el-divider--horizontal {
        margin: 4px 0 16px;
      }
    }

    :deep(.el-form) {
      .el-form-item {
        margin-bottom: 0px;
      }
    }

    :deep(.el-radio) {
      margin-right: 0;
      height: 32px;
    }

    :deep(.el-radio__label) {
      font-size: 14px;
      color: var(--text-color);
    }

    :deep(.el-switch) {
      --el-switch-on-color: var(--color-primary);
    }
  }
}

:deep(.el-form-item__content) {
  flex-direction: column;
  align-items: start;

  .el-form-item__error {
    position: static;
    display: block;
    margin-top: 4px;
    line-height: 1;
    font-size: 12px;
    color: var(--color-danger);
    transition: all 0.3s ease;

    &.el-fade-in-enter-active,
    &.el-fade-in-leave-active {
      transition: opacity 0.3s ease;
    }

    &.el-fade-in-enter-from,
    &.el-fade-in-leave-to {
      opacity: 0;
    }
  }
}
</style>
