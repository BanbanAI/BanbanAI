<template>
  <el-drawer
    class="mobile-address-drawer"
    :model-value="modelValue"
    :with-header="false"
    direction="btt"
    @close="emit('update:modelValue', false)"
    destroy-on-close
    append-to-body
    close-on-click-modal
  >
    <van-cascader
      v-model="code"
      :title="$t('plsSelectRegion')"
      :field-names="fieldNames"
      :options="options"
      :closeable="false"
      @change="emit('change', $event)"
      @finish="handleFinish"
    />
  </el-drawer>
</template>

<script lang="ts" setup>
import { ref, watch, computed } from "vue";
import { getChinaAddressData, type ChinaAddressNode } from "@renderer/utils/township";
import { CascaderOption, Cascader as vanCascader } from "vant";
import "vant/lib/index.css";
import "vant/lib/cascader/index.css";
import "vant/lib/cascader/style";
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: boolean,
  defaultValue?: string,
  level: number
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "confirm", value: string): void;
  (event: "change", data: {
      value: string | number;
      selectedOptions: CascaderOption[];
      tabIndex: number
  }): void;
}>();

const CHINADATA = ref<ChinaAddressNode[]>([]);

const limitDepth = (nodes: any[], depth: number, maxDepth: number) => {
  return nodes.map(node => {
    const newNode = { ...node };
    if (depth >= maxDepth) {
      delete newNode.children;
    } else if (newNode.children && newNode.children.length > 0) {
      newNode.children = limitDepth(newNode.children, depth + 1, maxDepth);
    }
    return newNode;
  });
};

const options = computed(() => {
  if (!props.level) return CHINADATA.value;
  return limitDepth(CHINADATA.value, 1, props.level);
});

const code = ref("");

const fieldNames = {
  text: 'label',
  value: 'value',
  children: 'children',
};

const handleFinish = ({ selectedOptions }) => {
  const selectedValue = selectedOptions.map((option) => option.label).join('/');
  emit("confirm", selectedValue);
  emit("update:modelValue", false);
}

watch(() => props.defaultValue, (newValue) => {
  if (newValue) {
    const arr = newValue.split('/');
    const maxLevel = props.level || 4;
    const index = Math.min(arr.length, maxLevel) - 1;
    code.value = arr[index] || "";
  } else {
    code.value = "";
  }
});

watch(() => props.modelValue, async (visible) => {
  if (visible && !CHINADATA.value.length) {
    CHINADATA.value = await getChinaAddressData();
  }
}, { immediate: true });
</script>

<style lang="scss" scoped>
:deep(.van-cascader__options) {
  &::-webkit-scrollbar {
    display: none;
  }
  scrollbar-width: none;
  -ms-overflow-style: none;
}
</style>
<style lang="scss">
.el-drawer.mobile-address-drawer {
  height: auto !important;
}
</style>
