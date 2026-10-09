<template>
  <div class="form-select">
    <el-select
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
      v-bind="attrs"
      popper-class="global-form-select-popper"
      :multiple="multiple"
    >
      <template #prefix v-if="$slots.prefix">
        <slot name="prefix"></slot>
      </template>

      <template #header v-if="filterable">
        <el-input v-model="searchValue" clearable :placeholder="$t('FormSelect.search')">
          <template #prefix>
            <el-icon :size="16">
              <i-ep-search></i-ep-search>
            </el-icon>
          </template>
        </el-input>
      </template>
      <template #default>
          <el-option-group 
            v-for="group in filterGroups"
            :key="group.label"
            :disabled="group.disabled"
          >
            <span class="el-select-group__title" style="padding-right: 0px;">{{ group.label }}</span>
            <el-option
              v-for="item in group.options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
              :disabled="item.disabled"
            >
              <el-checkbox
                :modelValue="(modelValue as FormSelectOption['value'][])?.includes(item.value)"
                v-if="multiple"
              />
              <slot name="option-icon" :item="item"></slot>
              {{ item.label }}
            </el-option>
          </el-option-group>
      </template>
    </el-select>
  </div>
</template>

<script lang='ts' setup>
import { FormSelectGroupOption, FormSelectOption } from '@renderer/b2/types';
import { computed, ref, useAttrs } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: FormSelectOption['value'] | FormSelectOption['value'][],
  filterable?: boolean,
  multiple?: boolean,
  options?: FormSelectGroupOption[],
}>(), {
  filterable: true,
  multiple: false,
  options: () => [],
});
const emit = defineEmits<{
  (event: "update:modelValue", value: string): void
  (event: "change", value: string): void
}>();

const attrs = useAttrs();
const searchValue = ref<string>('');

const filterGroups = computed(() => {
  if (!props.filterable) return props.options;
  return props.options.map(item => {
    return {
      ...item,
      options: item.options?.filter(option => option.label.includes(searchValue.value))
    };
  });
})

</script>

<style lang='scss' scoped>
.field-select {
  width: 100%;
}
</style>
<style lang="scss">
.global-form-select-popper {
  --el-bg-color-overlay: var(--bg-color-page);
  .el-select-dropdown__header {
    padding: 8px;
  }
  .el-select-dropdown__item {
    display: flex;
    align-items: center;
    column-gap: 8px;

    &::after {
      display: none;
    }
  }
}
</style>
