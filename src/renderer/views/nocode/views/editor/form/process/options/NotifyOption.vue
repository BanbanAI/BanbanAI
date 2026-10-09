<template>
  <el-form class="notify-option" :model="options" :rules="rules" ref="formRef">
    <el-tabs>
      <el-tab-pane :label="$t('NotifyOption.ccPerson')">
        <option-item :title="$t('NotifyOption.ccPerson')">
          <operator-option
            v-model:nodeOwner="props.options.notifier"
            ref="operatorRef"
          />
        </option-item>
      </el-tab-pane>
      <el-tab-pane :label="$t('NotifyOption.formPermission')">
        <field-auth-option :isNotify="true"></field-auth-option>
      </el-tab-pane>
    </el-tabs>
  </el-form>
</template>

<script lang='ts' setup>
import { NotifyOptions, ProcessNodeOwnerType } from '@common/types/project';
import { FormInstance, FormRules } from 'element-plus';
import { ref, reactive, onMounted, nextTick, watch } from 'vue';
import i18next from 'i18next';
import { ProcessNode } from '../process';

const props = defineProps<{
  node: ProcessNode,
  options: NotifyOptions,
}>();

const formRef = ref<FormInstance>();
const rules = reactive<FormRules<NotifyOptions>>({
  [`notifier.${ProcessNodeOwnerType.ASSIGNEE}`]: [
    {
      validator: (rule, value, callback) => {
        // value 就是 options.transactor[ASSIGNEE] 对象
        if (!value) {
          return callback();
        }
        const hasRole = value.roles?.length > 0;
        const hasUser = value.users?.length > 0;

        if (hasRole || hasUser) {
          callback(); // 校验通过
        } else {
          callback(new Error(i18next.t('NotifyOption.selectRoleOrUser')));
        }
      },
      trigger: 'change'
    }
  ],
  [`notifier.${ProcessNodeOwnerType.FORM_MEMBER}`]: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          return callback();
        }
        const hasMember = value.length > 0
        if(hasMember) {
          callback()
        } else {
          callback(new Error(i18next.t('NotifyOption.selectMemberField')));
        }
      },
      trigger: 'change'
    }
  ],
  [`notifier.${ProcessNodeOwnerType.FORM_DEPARTMENT}`]: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          return callback();
        }
        const hasDepart = value.value != null
        if(hasDepart) {
          callback()
        } else {
          callback(new Error(i18next.t('NotifyOption.selectDeptField')));
        }
      },
      trigger: 'change'
    }
  ]
})


const containerAssigneeRef = ref(null)
const visibleAssigneeCount = ref(0)
const operatorRef = ref(null)

const updateAssigneeVisible = () => {
  visibleAssigneeCount.value = 1000000000
  nextTick(() => {
    const container = containerAssigneeRef.value
    if (!container) return

    const maxWidth = container.offsetWidth - 150
    let used = 0
    let count = 0
    const children = container.querySelectorAll(".tag-item-assignee")
    children.forEach((el) => {
      const w = el.offsetWidth + 8 // 包含 margin
      if (used + w <= maxWidth) {
        used += w
        count++
      }
    })
    visibleAssigneeCount.value = count
  })
}

onMounted(() => {
  nextTick(() => {
    if (containerAssigneeRef.value) {
      updateAssigneeVisible()
      const resizeObserver = new ResizeObserver(() => updateAssigneeVisible())
      resizeObserver.observe(containerAssigneeRef.value)
    }
  })
})

watch(() => props.options?.notifier?.[ProcessNodeOwnerType.ASSIGNEE], () => {
  nextTick(() => {
    updateAssigneeVisible()
  })
},{ deep: true })

const save = async () => {
  const valid = await operatorRef.value?.validate()
  return new Promise((resolve, reject) => {
    formRef.value?.validate((isValid) => {
      if (isValid && valid) {
        resolve(true)
      } else {
        resolve(false)
      }
    })
  })
}
defineExpose({
  save,
})
</script>

<style lang='scss' scoped>
.notify-option {
  width: 100%;
  padding: 12px;

  .tips {
    span {
      color: var(--text-color-secondary);
    }
  }

  :deep(.approval-type) {
    .el-select {
      height: 24px;
      .el-select__wrapper {
        border-radius: 2px;
        height: 24px;
        min-height: 24px;
        border: none;
        box-shadow: none;
        background-color: var(--bg-color-overlay);
        padding: 0px 4px 0px 8px;

        .el-select__selected-item {
          span {
            
            font-weight: 400;
            
            font-size: 12px;
            line-height: 16px;
            letter-spacing: 0%;
            text-align: right;
          }
        }
      }
    }
  }

  .data-change-checkbox-group {
    // height: 20px;
    --el-checkbox-height: 20px;
  }

  :deep(.el-form-item__content) {
    display: flex;
    flex: unset;
    width: 100%;
  }

  :deep(.el-tabs) {
    .el-tabs__header {
      display: flex !important;
      border-radius: 4px;
    }

    .el-tabs__nav-wrap {
      border-radius: 4px;
    }

    .el-tabs__item {
      flex: 1 !important;
      text-align: center;
      height: 32px;
      border-radius: 4px;
      transition: all 0.3s ease;

      &.is-active {
        background-color: #1f77fc;
        color: var(--color-white);
      }
    }

    .el-tabs__nav {
      width: 100%;
      height: 32px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    .el-tabs__active-bar {
      display: none;
    }
  }

  .range-option {
    padding: 0px 8px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-color);

    :deep(.el-select__wrapper) {
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      overflow: hidden;
      box-shadow: none;
    }
  }

  .approver-option {
    width: 100%;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--border-color);

    .checkbox-container {
      padding: 12px 16px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      display: flex;
      flex-wrap: wrap;

      .el-form-item {
        flex: 0 0 33%;
        box-sizing: border-box;
        margin-bottom: 0px;
      }
    }

    .approver-option-item {
      margin: 16px 0px;

      .title {
        
        font-weight: 500;
        font-style: Medium;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
        display: flex;
        align-items: center;
        color: var(--text-color-regular);

        .user {
          margin-right:  4px;
          font-size: 16px;
        }

        .delete {
          margin-left: auto;
          color: var(--text-color-secondary);
          font-size: 16px; 
          cursor: pointer;
        }
      }

      .container {
        height: 48px;
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
        margin-top: 8px;
        padding: 8px;
        display: flex;
        gap: 8px;
        width: 100%;

        .add-button {
          background-color: var(--color-white);
          min-width: 68px;
          height: 32px;
          border-radius: 4px;
          display: flex;
          justify-content: center;
          align-items: center;
          
          font-weight: 400;
          
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          text-align: right;
          color: var(--color-primary);
          cursor: pointer;

          .el-icon {
            margin-right: 3px;
          }
        }

        :deep(.el-tag) {
          height: 32px;
          border: none;
          background-color: var(--color-white);
          
          .el-tag__content {
            
            font-weight: 400;
            
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%;
            color: var(--text-color-regular);
            text-align: right;
          }

          .el-tag__close {
            color: var(--text-color-regular);

            &:hover {
              background-color: var(--bg-color-overlay);
            }
          }
        }
      }

      .select-container {
        margin-top: 8px;
        display: flex;
        align-items: center;
        width: 100%;

        :deep(.el-select) {
          flex: 1;

          .el-select__wrapper {
            background-color: var(--bg-color-overlay);
            overflow: hidden;
            box-shadow: none;
            border-radius: 4px;
          }
        }
      }
    }
  }

  :deep(.empty-approver) {
    .el-form-item__content {
      display: block;
    }
    .approver-option-item {
      .title {
        
        font-weight: 500;
        font-style: Medium;
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0%;
        display: flex;
        align-items: center;
        color: var(--text-color-regular);
      }

      .container {
        height: 48px;
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
        margin-top: 8px;
        padding: 8px;
        display: flex;
        gap: 8px;

        .add-button {
          background-color: var(--color-white);
          min-width: 68px;
          height: 32px;
          border-radius: 4px;
          display: flex;
          justify-content: center;
          align-items: center;
          
          font-weight: 400;
          
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          text-align: right;
          color: var(--color-primary);
          cursor: pointer;

          .el-icon {
            margin-right: 3px;
          }
        }

        .el-tag {
          height: 32px;
          border: none;
          background-color: var(--color-white);
          
          .el-tag__content {
            
            font-weight: 400;
            
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%;
            color: var(--text-color-regular);
            text-align: right;
          }

          .el-tag__close {
            color: var(--text-color-regular);

            &:hover {
              background-color: var(--bg-color-overlay);
            }
          }
        }
      }

      .select-container {
        margin-top: 8px;
        display: flex;
        align-items: center;

        .el-select {
          flex: 1;

          .el-select__wrapper {
            background-color: var(--bg-color-overlay);
            overflow: hidden;
            box-shadow: none;
            border-radius: 4px;
          }
        }
      }
    }

    .empty-approver-item {
      margin-top: 12px;
    }
  }

  hr {
    border: none;
    margin: 24px 0px 0px;
  }

  .vertical-radio {
    display: flex;
    flex-direction: column;
    justify-content: left;

    .el-radio {
      display: block;   /* 每个单选按钮占一行 */
      margin: 5px 0;
      width: 100%;
    }
  }
   

  .select-header {
    display: flex;
    font-size: 13px;

    .mode {
      color: var(--text-color-secondary);
    }

    .switch-btn {
      margin-left: auto;
      cursor: pointer;
      display: flex;
      align-items: center;
      color: var(--color-primary);

      .el-icon {
        margin-right: 4px;
      }
    }
  }

  :deep(.el-form-item__error) {
    position: unset;
  }
}
</style>
