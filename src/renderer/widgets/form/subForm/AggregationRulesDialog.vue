<template>
  <div class="data-fill-rules-dialog">
    <el-dialog
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue',$event)"
      :title="$t('aggregationSettings')"
      width="680"
      align-center
      draggable
      :close-on-click-modal="false"
    >
      <el-scrollbar height="100%">
        <el-form class="container" :model="rule" ref="formRef">
          <div class="linkage-action">
            <div class="field-wrapper">
              <template v-for="(item, index) in rule" :key="index">
                <div class="fill-field-item">
                  <div class="current-field">
                    <p class="label" v-if="index === 0">{{ $t('aggregationField') }}</p>
                    <div class="field">
                      <el-form-item :prop="`rule.${index}.field`" :rules="getConditionFormRules(item.field,props.widget.children.filter(f => f.type === 'widget.form.numberInput'))">

                        <el-select
                          class="fill-field-select"
                          v-model="item.field"
                          :placeholder="$t('plsSelectField')"
                          filterable
                          :no-data-text="$t('noData')"
                          :no-match-text="$t('noData')"
                          popper-class="linkage-fill-select-popper"
                          disabled
                          :offset="4"
                          style="--el-select-disabled-color: #444;"
                        >
                          <el-option
                            v-for="field in props.widget.children.filter(f => f.type === 'widget.form.numberInput')"
                            :key="field.uid"
                            :label="field.title"
                            :value="field.uid"
                            :disabled="rule.some(f => f.field === field.uid)"
                          />
                          <template #label="{ label, value }">
                            <span :class="{ error: label === value }">
                              {{ label === value ? errorText : label }}
                            </span>
                          </template>
                        </el-select>
                      </el-form-item>
                    </div>
                  </div>

                  <div class="linkage-field">
                    <p class="label" v-if="index === 0">{{ i18next.t('aggregationMethod') }}</p>
                    <div class="field">
                      <el-form-item
                        :prop="`rule.${index}.type`"
                      >
                        <el-select
                          class="linkage-field-select"
                          popper-class="linkage-fill-select-popper"
                          v-model="item.type"
                          :placeholder="i18next.t('plsSelectAggregationMethod')"
                          filterable
                          :no-data-text="i18next.t('noData')"
                          :no-match-text="i18next.t('noData')"
                          :offset="4"
                        >
                          <el-option
                            v-for="t in AggregationType"
                            :key="t"
                            :label="aggregationTypeText[t]"
                            :value="t"
                          />
                        </el-select>
                      </el-form-item>
                    </div>
                  </div>
                  <!-- <div :class="['delete', { disabled: rule.length === 1 }]">
                    <el-icon :size="16" @click="rule.splice(index, 1)">
                      <i-ep-delete />
                    </el-icon>
                  </div> -->
                </div>
              </template>
            </div>

            <!-- <p class="label">
              <el-button
                type="primary"
                link
                @click="handleAddFillField"
              >
                <el-icon :size="16" style="margin-right: 4px;">
                  <i-ep-plus />
                </el-icon>
                添加字段
              </el-button>
            </p> -->
          </div>
        </el-form>
      </el-scrollbar>
      <template #footer>
        <div class="tip">
          <el-icon>
            <i-ep-warning />
          </el-icon>
          <span>
            {{ i18next.t('aggregationOnlyNumberTip') }}
          </span>
        </div>
        <el-button type="primary" @click="handleUpdate">{{ i18next.t('confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { SubForm } from './subForm';
import { AggregationRule, AggregationType } from './type';
import { ref, watch } from 'vue';
import { deepClone, isEmpty } from '@common/utils/object';
import IEpPlus from "~icons/ep/plus";
import IEpDelete from "~icons/ep/delete";
import IEpWarning from "~icons/ep/warning";
import { ElMessage } from 'element-plus';
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: boolean,
  value?: AggregationRule[];
  widget: SubForm;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "update", value: AggregationRule[]): void;
}>();

const errorText = i18next.t('fieldDeletedReSelect')

const aggregationTypeText = {
  [AggregationType.SUM]: i18next.t('aggregationSum'),
  [AggregationType.AVG]: i18next.t('aggregationAvg'),
  [AggregationType.MAX]: i18next.t('aggregationMax'),
  [AggregationType.MIN]: i18next.t('aggregationMin'),
  [AggregationType.NOTAGGRE]: i18next.t('aggregationNone'),
};

const rule = ref<AggregationRule[]>([
  {
    field: null,
    type: AggregationType.SUM,
  }
]);

const getConditionFormRules = (val, arr) => {
  return [
    {
      required: true,
      validator(rule, value, callback) {
        if (!val || !arr.some(f => f.uid === val)) return callback(new Error(''));
        // 请选择聚合字段
        callback();
      }
    }
  ]
}

watch(() => {
  return  {
    value: props.value,
    modelValue: props.modelValue,
  }
}, ({value}) => {
  if (value) {
    rule.value = deepClone(value);
  }
}, { immediate: true, deep: true })

const formRef = ref(null);

const handleUpdate = () => {
  formRef.value.validate((valid) => {
    if (!valid || isEmpty(rule.value)) {
      ElMessage.warning(i18next.t('pleaseCompleteAggregationRule'));
      return;
    }

    // 判断其他的限制
    emit("update", deepClone(rule.value));
    emit("update:modelValue", false);
  });
}

const handleAddFillField = () => {
  rule.value.push({
    field: null,
    type: AggregationType.SUM,
  })
}
</script>

<style lang='scss' scoped>
@mixin diy-select {
  width: max-content;
  min-width: 70px;
  max-width: 100%;
  border-radius: 4px;

  &:hover {
    background-color: var(--bg-color-hover);
  }

  .el-select__wrapper {
    box-shadow: none;
    border: none;
    padding: 0 4px 0 10px;
    background-color: transparent;
    gap: 4px;
    font-size: 12px;

    .el-select__placeholder {
      position: unset;
      transform: unset;
    }

    .el-select__input-wrapper {
      display: none;
    }
  }
}

@mixin common-select {
  &:has(.is-disabled) {
    cursor: not-allowed;
  }

  .el-select__wrapper {
    width: 100%;
    height: 32px;
    background-color: var(--bg-color-overlay);
    border-radius: 4px;
    box-shadow: 0 0 0 0px var(--border-color) inset;
    font-size: 12px;

    &:hover {
      box-shadow: 0 0 0 1px var(--border-color) inset;
    }

    &.is-focused {
      box-shadow: 0 0 0 1px var(--color-primary) inset !important;
    }
  }
}

@mixin delete {
  display: flex;
  align-items: center;
  cursor: pointer;

  &.disabled {
    cursor: not-allowed;
    pointer-events: none;
    opacity: 0.4;
  }

  .el-icon {
    &:hover {
      color: var(--color-danger);
    }
  }
}

.data-fill-rules-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    --el-dialog-padding-primary: 0;

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      line-height: 50px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        height: 50px;
        width: 50px;
        font-size: 16px;
        border-top-right-radius: 4px;
        top: 0;

        .el-dialog__close {
          font-size: 18px;
        }

      }
    }

    .el-dialog__body {
      // height: 640px;
      padding: 16px;

      .container {
        display: flex;
        flex-direction: column;
        row-gap: 16px;

        .el-form-item {
          margin: 0;
        }

        .linkage-form {
          .header {
            display: flex;
            align-items: center;
            margin-bottom: 16px;

            .label {
              color: var(--text-color-primary);
            }
          }

          .linkage-table-select {
            @include common-select;
          }

          .buttons {
            .el-button {
              font-size: 12px;
            }
          }
        }

        .trigger {
          .logic {
            display: flex;
            align-items: center;
            column-gap: 4px;
            color: var(--text-color-primary);

            .logic-select {
              width: 70px;
              @include diy-select;
              background-color: var(--bg-color-overlay);
            }
          }

          .condition-list {
            display: flex;
            flex-direction: column;
            row-gap: 8px;
            margin-top: 16px;

            .condition-item {
              display: flex;
              align-items: end;
              position: relative;

              .current-field-wrapper,
              .linkage-table-field-wrapper {
                display: flex;
                flex-direction: column;
                row-gap: 8px;
                width: 246px;

                .label {
                  color: var(--text-color-primary);
                  font-size: 12px;
                }

                .field-centent {
                  display: flex;
                  gap: 8px;
                  align-items: center;

                  .el-form-item {
                    flex: 1;
                  }

                  .type-select {
                    @include diy-select;
                    width: 90px;
                    height: 32px;
                    background-color: var(--bg-color-overlay);

                    .el-select__wrapper {
                      height: 100%;
                      border-radius: 4px;
                    }
                  }
                }

                .el-form-item__content {
                  display: flex;
                  gap: 8px;

                  .value-select,
                  .field-select,
                  .custom-input {
                    @include common-select;
                    width: 148px;
                    flex: 1;
                  }

                  .custom-input {
                    flex: 1;
                    background-color: var(--bg-color-overlay);
                    border-radius: 4px;
                    gap: 4px;
                    display: flex;
                    align-items: center;
                    height: 32px;

                    &:hover {
                      box-shadow: 0 0 0 1px var(--border-color) inset;
                    }

                    .el-input__wrapper,
                    .el-input-tag__wrapper {
                      width: 148px;
                      box-shadow: none;
                      border: none;
                      background: transparent;

                      .el-input__inner {
                        font-size: 12px;
                      }
                    }
                  }
                }
              }


              .rule-select-wrapper {
                width: 120px;
                text-align: center;

                .rule-select {
                  @include diy-select;
                }
              }

              .delete {
                height: 32px;
                @include delete;
                position: absolute;
                right: 8px;
              }
            }

          }
        }

        @mixin field {
          display: flex;
          column-gap: 8px;
          align-items: center;

          .el-select {
            width: 100%;
          }
        }

        .linkage-action {
          display: flex;
          flex-direction: column;
          gap: 16px;

          .label {
            display: flex;
            align-items: center;
            color: var(--text-color-primary);
            font-weight: 400;
            font-size: 14px;
          }

          .field-wrapper {
            display: flex;
            flex-direction: column;
            row-gap: 8px;

            .fill-field-item {
              display: flex;
              align-items: end;
              font-size: 12px;
              position: relative;
              justify-content: space-between;
              gap: 8px;

              .text {
                width: 120px;
                height: 32px;
                line-height: 32px;
                text-align: center;
              }

              .current-field,
              .linkage-field {
                width: 100%;
                display: flex;
                flex-direction: column;
                row-gap: 16px;
              }

              .current-field .field {
                @include field;

                .el-form-item {
                  width: 100%;
                }
              }

              .linkage-field .field {
                display: flex;
                align-items: center;
                column-gap: 8px;
                .el-select {
                  width: 100%;
                }

                .el-form-item {
                  // flex: 1;
                  width: 100%;
                  margin-right: 8px;
                }
              }

              .delete {
                @include delete;
                height: 32px;
                right: 8px;
              }
            }

            .fill-field-select, .linkage-field-select {
              @include common-select();
              width: 208px;
            }
          }

          .sub-form-field-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            margin-left: 24px;
            padding: 8px;
            position: relative;
            .left-line {
              width: 12px;
              height: 50%;
              position: absolute;
              top: 0;
              left: -12px;
              border-left: 1px solid var(--border-color);
              border-bottom: 1px solid var(--border-color);
            }

            .field-item-title {
              display: flex;
              flex-direction: row;
              .label {
                color: var(--text-color-primary);
                font-size: 12px;
              }
              .current-field-title {
                width: 224px;
              }
              .linkage-field-title {
                width: 248px;
                margin-left: 112px;
              }
            }

            .sub-field-wrapper {
              display: flex;
              flex-direction: column;
              row-gap: 8px;
              .field-item {
                display: flex;
                align-items: end;
                font-size: 12px;

                .field {
                  @include field;
                }

                .text {
                  width: 120px;
                  height: 32px;
                  line-height: 32px;
                  text-align: center;
                }
                .current-sub-field {
                  width: 216px;
                  display: flex;
                  flex-direction: column;
                  row-gap: 8px;
                  .field {
                    display: flex;
                    column-gap: 8px;
                    align-items: center;

                    .el-select {
                      width: 216px;
                    }
                  }
                }

                .linkage-sub-field {
                  width: 248px;
                  display: flex;
                  flex-direction: column;
                  row-gap: 8px;
                  .field {
                    display: flex;
                    align-items: center;
                    column-gap: 8px;
                    .el-select {
                      width: 200px;
                    }

                    .el-form-item {
                      width: 200px;
                      margin-right: 8px;
                    }
                  }
                }
                .delete {
                  @include delete;
                  height: 32px;
                  font-size: 16px;
                  position: absolute;
                  right: 8px;
                }
              }
            }

            .add-sub-field {
              display: flex;
              align-items: center;
              gap: 4px;
              color: var(--color-primary);
              padding: 2px;
              cursor: pointer;
              width: fit-content;

              &:hover {
                color: var(--el-color-primary-light-5);
              }
            }
          }
        }
      }
    }

    .el-dialog__footer {
      padding: 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 8px;

      .tip {
        margin-right: auto;
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--text-color-secondary);
        font-size: 14px;
      }
    }
  }
}

:deep(.el-select) {
  .el-select__wrapper {
    .el-select__selected-item {
      span {
        &.error {
          color: var(--color-danger);
        }
      }
    }
  }
}
</style>
