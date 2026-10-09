<template>
  <div class="recharge-user-tree-select-wrapper">
    <el-popover
      trigger="click"
      placement="bottom-end"
      :width="300"
      :persistent="true"
      popper-class="custom-select-tree-popper recharge-user-tree-select-popper"
      @show="handleShow"
      @hide="handleHide"
    >
      <template #reference>
        <button
          type="button"
          class="recharge-user-tree-select"
          :class="{ 'is-active': visible }"
        >
          <span
            class="select-value"
            :class="{ 'is-placeholder': !displayText }"
          >
            {{ displayText || placeholder }}
          </span>
          <el-icon class="select-arrow">
            <i-ep-arrow-down />
          </el-icon>
        </button>
      </template>
      <div class="recharge-user-tree-select-dropdown">
        <div class="select-all-row">
          <el-checkbox
            :model-value="isAllChecked"
            :indeterminate="isAllIndeterminate"
            @change="handleCheckAllChange"
          >
            {{ $t('RechargeUserTreeSelect.all') }}
          </el-checkbox>
        </div>
        <el-scrollbar max-height="220px">
          <el-checkbox-group
            class="user-list"
            :model-value="selectedValues"
            @change="handleGroupChange"
          >
            <div v-for="item in data" :key="item.value" class="user-option-row">
              <el-checkbox :label="item.value">
                {{ item.label }}
              </el-checkbox>
            </div>
          </el-checkbox-group>
        </el-scrollbar>
      </div>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import i18next from "i18next";
import { computed, ref } from "vue";

type ConsumptionMemberOption = {
  label: string;
  value: string;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string[];
    data?: ConsumptionMemberOption[];
    placeholder?: string;
  }>(),
  {
    modelValue: () => [],
    data: () => [],
    placeholder: () => i18next.t('RechargeUserTreeSelect.userSelect'),
  },
);

const emit = defineEmits<{
  (event: "update:modelValue", value: string[]): void;
}>();

const visible = ref(false);
const allOptionValues = computed(() => props.data.map((item) => item.value));
const labelMap = computed<Record<string, string>>(() => {
  return props.data.reduce<Record<string, string>>((result, item) => {
    result[item.value] = item.label;
    return result;
  }, {});
});
const selectedValues = computed(() => {
  return allOptionValues.value.filter((value) => props.modelValue.includes(value));
});
const displayText = computed(() => {
  return selectedValues.value
    .map((value) => labelMap.value[value])
    .filter(Boolean)
    .join("、");
});
const isAllChecked = computed(() => {
  return !!allOptionValues.value.length && selectedValues.value.length === allOptionValues.value.length;
});
const isAllIndeterminate = computed(() => {
  return selectedValues.value.length > 0 && selectedValues.value.length < allOptionValues.value.length;
});

const handleShow = () => {
  visible.value = true;
};

const handleHide = () => {
  visible.value = false;
};

const handleGroupChange = (value: string[]) => {
  emit("update:modelValue", value);
};

const handleCheckAllChange = (value: boolean) => {
  const checkedKeys = value ? allOptionValues.value : [];
  emit("update:modelValue", checkedKeys);
};
</script>

<style scoped lang="scss">
.recharge-user-tree-select-wrapper {
  width: 100%;
}

.recharge-user-tree-select {
  width: 100%;
  min-height: 32px;
  padding: 0 10px 0 12px;
  border: 0;
  border-radius: 4px;
  background: #f2f3f5;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: var(--cursor-pointer);

  &:hover {
    box-shadow: 0 0 0 1px #c9cdd4 inset;
  }

  &.is-active {
    background: #ffffff;
    box-shadow: 0 0 0 1px var(--color-primary) inset;

    .select-arrow {
      color: #4e5969;
      transform: rotate(180deg);
    }
  }
}

.select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  color: #1d2129;
  font-size: 14px;
  line-height: 20px;

  &.is-placeholder {
    color: #86909c;
  }
}

.select-arrow {
  flex-shrink: 0;
  color: #86909c;
  font-size: 12px;
  transition: transform 0.2s ease;
}
</style>

<style lang="scss">
.recharge-user-tree-select-popper {
  width: 300px !important;
  padding: 0 !important;
  border: 1px solid #e5e6eb !important;
  border-radius: 6px !important;
  overflow: hidden;
  background: #ffffff !important;
  box-shadow: 0 6px 20px rgba(29, 33, 41, 0.08) !important;

  .el-scrollbar__view {
    padding: 0 !important;
    background: #ffffff;
  }

  .recharge-user-tree-select-dropdown {
    padding: 4px;
    background: #ffffff;
    border-radius: 6px;
  }

  .select-all-row {
    min-height: 32px;
    margin-bottom: 4px;
    padding: 0 8px 4px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid #f2f3f5;
  }

  .user-list {
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #1d2129;
    --el-checkbox-checked-bg-color: var(--color-primary);
    --el-checkbox-checked-input-border-color: var(--color-primary);
    --el-checkbox-input-border-color-hover: var(--color-primary);
  }

  .user-option-row {
    min-height: 32px;
    border-radius: 4px;
    padding: 0 8px;
    display: flex;
    align-items: center;
  }

  .user-option-row:hover {
    background: #f2f3f5 !important;
  }

  .user-option-row:has(.el-checkbox.is-checked) {
    background: #f2f3f5;
  }

  .user-option-row .el-checkbox {
    width: 100%;
    margin: 0;
  }

  .user-option-row .el-checkbox__inner {
    width: 14px;
    height: 14px;
    border-radius: 2px;
  }

  .user-option-row .el-checkbox__label {
    padding-left: 8px;
    color: #1d2129;
    font-size: 13px;
    line-height: 20px;
  }
}
</style>
