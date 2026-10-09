<template>
  <div class="field-selector">
    <el-popover v-model:visible="visible" trigger="click" :teleported="teleported" :persistent="false" :width="200" popper-class="global-field-selector-popover"
      :popper-style="{ '--el-popover-padding': 0, background: 'var(--bg-color-page)' }" :popper-options="popperOptions">
      <div class="select-field-wrapper">
        <el-input v-model="searchValue" :placeholder="$t('FieldSelector.search')" clearable>
          <template #prefix>
            <el-icon :size="16">
              <i-ep-search></i-ep-search>
            </el-icon>
          </template>
        </el-input>
        <el-scrollbar class="fields-scrollbar" max-height="150px" v-if="fields.length" noresize>
          <ul class="fields">
            <li :class="['field-item', { disabled: item.disabled }]" :style="item.style" :title="item.label" v-for="item in fields" :key="item.value" @click="handleClick(item)">
              <el-icon :size="16"><i-ven-field /></el-icon>
              <span>{{ item.label }}</span>
            </li>
          </ul>
        </el-scrollbar>
        <div class="empty" v-else>
          <slot name="empty">
            <span>{{ $t('FieldSelector.noData') }}</span>
          </slot>
        </div>
      </div>
      <template #reference>
        <el-button link type="primary">
          <slot name="prefix">
            <el-icon :size="16" style="margin-right: 4px"><i-ep-plus /></el-icon>
          </slot>
          <slot>
            {{ $t('FieldSelector.addCondition') }}
          </slot>
        </el-button>
      </template>
    </el-popover>
  </div>

</template>

<script lang='ts' setup>
import { Options } from 'element-plus';
import { computed, onBeforeUnmount, ref, StyleValue } from 'vue';

type FieldSelectorOption = {
  label: string;
  value: string;
  disabled?: boolean;
  style?: StyleValue
}

const props = withDefaults(defineProps<{
  options: FieldSelectorOption[],
  teleported?: boolean,
  closeOnSelect?: boolean;
  popperOptions?: Partial<Options>;
}>(), {
  options: () => [],
  teleported: true,
  closeOnSelect: false,
});

const emit = defineEmits<{
  (event: "select", value: FieldSelectorOption);
}>();

const visible = ref(false);

const searchValue = ref("");

const fields = computed(() => {
  return props.options.filter((c) => {
    return c.label.includes(searchValue.value);
  });
})

const handleClick = (field: FieldSelectorOption) => {
  // 可加多选逻辑
  if (field.disabled) return;
  emit("select", field);
  if (props.closeOnSelect) {
    visible.value = false;
  }
}

onBeforeUnmount(() => {
  visible.value = false;
});



</script>

<style lang="scss">
.global-field-selector-popover {
  .select-field-wrapper {
    .fields-scrollbar {

      .fields {
        padding: 4px;

        .field-item {
          height: 30px;
          display: flex;
          align-items: center;
          column-gap: 4px;
          cursor: pointer;
          padding: 0 8px;
          line-height: 30px;
          color: var(--text-color-regular);

          &:hover {
            background-color: var(--bg-color-hover);
          }

          &.disabled {
            pointer-events: none;
            color: var(--text-color-disabled);
          }

          span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }
    }

    .empty {
      height: 32px;
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--text-color-secondary);
    }
  }
}
</style>
