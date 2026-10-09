<template>
  <div class="option-group-control">
    <el-button class="btn" @click="handleButtonClick" :color="color" :size="size" :style="buttonStyle">{{ buttonText }}</el-button>
    <el-drawer
      class="option-group-control-drawer"
      v-model="drawerVisible"
      :title="title"
      direction="btt"
      size="90%"
      destroy-on-close
      close-on-click-modal
      append-to-body
    >
    <component :is="drawer.component" :widget="activeElement" :value="getOptionValue()" @update="updateOption" @close="handleClose" v-bind="componentProps" />
  </el-drawer>
  </div>
</template>
<script lang="ts">
export default {
  isBigContent: (args: any) => {
    return !!args?.bigButton;
  },
};
</script>
<script lang="ts" setup>

import { ACTIVE_ELEMENT } from '@renderer/types';
import { computed, inject, ref, } from 'vue';
import { DefinedOptionWithParsedType } from '../types';
import { GET_OPTION_VALUE, UPDATE_OPTION } from '@renderer/b2/inject';
import i18next from 'i18next';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
  paths: string[]
}>();

const activeElement = inject(ACTIVE_ELEMENT);
const updateOption = inject(UPDATE_OPTION);
const getOptionValue = inject(GET_OPTION_VALUE);

const drawerVisible = ref(false);
const size = computed(()=>{
  return props.option.args?.bigButton ? "default" : "small";
});
const color = computed(() => props.option.args?.color ?? "");

const drawer = computed(() => props.option?.drawer || {} as typeof props.option.drawer);

const buttonText = computed(() => {
  if (typeof drawer.value.buttonText === "function") {
    return drawer.value.buttonText(activeElement.value, props.paths);
  }
  return drawer.value?.buttonText || i18next.t("DrawerOption.set");
});

const buttonStyle = computed(() => {
  if (typeof drawer.value.buttonStyle === "function") {
    return drawer.value.buttonStyle(activeElement.value, props.paths);
  }
  return drawer.value?.buttonStyle || {}
})

const title = computed(() => {
  if (typeof drawer.value.title === "function") {
    return drawer.value.title(activeElement.value, props.paths);
  }
  return drawer.value?.title || i18next.t("DrawerOption.set");
});

const componentProps = computed(() => {
  if (typeof drawer.value.componentProps === "function") {
    return drawer.value.componentProps(activeElement.value, props.paths);
  }
  return drawer.value?.componentProps || {}
})

const handleButtonClick = async () => {
  drawerVisible.value = true;
}

const handleClose = () => {
  drawerVisible.value = false;
}

</script>

<style lang="scss" scoped>

.option-group-control {
  display: flex;
  position: relative;
  flex-direction: column;
  width: 100%;
}

</style>

<style lang="scss">
.option-group-control-drawer {
  .el-drawer__header {
    height: 60px;
    border-bottom: 1px solid var(--border-color);
    padding: 16px 20px;
    color: var(--text-color-primary);
    font-weight: bold;
    margin: 0;

    .el-drawer__title {
      text-align: center;
      font-size: 18px;
    }
  }

  .el-drawer__body {
    padding: 0;
  }
}
</style>