<template>
  <div class="mobile-select-drawer">
    <el-drawer
      :modelValue="modelValue"
      direction="btt"
      size="60%"
      :show-close="false"
      :before-close="handleClose"
      @update:modelValue="emit('update:modelValue', $event)"
      close-on-click-modal
    >
      <template #header>
        <span @click="handleClear" style="font-size: 14px; font-weight: 400; color: var(--color-primary);">{{ $t('clear') }}</span>
      </template>
      <div class="container">
        <div class="search">
          <el-input :placeholder="i18next.t('search')" v-model="searchValue" clearable>
            <template #prefix>
              <el-icon :size="16"><i-ep-search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="select-list">
          <el-radio-group class="radio-group" :modelValue="selectedKeyRef">
            <el-radio
              class="radio-item"
              v-for="item in filteredData"
              :key="item.id"
              :value="item.id"
              :label="item.label"
              @click="handleClickRadio(item.id)"
            >
              {{ item.value }}
            </el-radio>
          </el-radio-group>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script lang='ts' setup>
import { ref, watch, computed } from 'vue';
import IEpSearch from "~icons/ep/search";
import { MenuItem } from "./types";
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: boolean,
  dataList: MenuItem[],
  selectedItemKey: string,
}>();

const emit = defineEmits<{
  (event: "selectConfirm", value: string | undefined);
  (event: "update:modelValue", value: boolean): void;
  (event: "clean");
}>();

const searchValue = ref('');
const selectedKeyRef = ref(props.selectedItemKey);

const filteredData = computed(() => {
  if (!searchValue.value) {
    return props.dataList;
  }
  return props.dataList.filter(item =>
    item.value.includes(searchValue.value)
  );
});

const handleClose = () => {
  emit('selectConfirm', selectedKeyRef.value);
}

const handleClear = () => {
  selectedKeyRef.value = undefined;
}

const handleClickRadio = (itemKey: string) => {
  if (selectedKeyRef.value === itemKey) {
    handleClear();
  } else {
    selectedKeyRef.value = itemKey;
  }
  handleClose();
}

watch(() => props.modelValue, (val) => {
  selectedKeyRef.value = props.selectedItemKey;
  searchValue.value = '';
})
</script>

<style lang='scss' scoped>
.mobile-select-drawer {
  width: 100%;
  height: 100%;
  :deep(.el-drawer) {
    background-color: var(--color-white);
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;

    .el-drawer__header {
      margin-bottom: 0;
      display: none;
    }

    .container {
      width: 100%;
      height: 100%;

      .search {
        margin-bottom: 8px;

        .el-input {
          width: 100%;
          height: 40px;

          .el-input__wrapper {
            border-radius: 8px;
            background-color: var(--color-white);
          }
        }
      }

      .select-list {
        width: 100%;
        height: calc(100% - 50px);
        overflow-y: auto;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;

        .radio-group {
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          flex-wrap: nowrap;

          .el-radio.radio-item {
            width: 100%;
            height: auto;
            min-height: 40px;
            padding: 8px 0;
            border-bottom: 1px solid var(--border-color);
            box-sizing: content-box;
            margin-right: 0;
            -webkit-tap-highlight-color: transparent;

            &:active {
              background-color: var(--bg-color-overlay);
            }

            .el-radio__label {
              height: auto;
              line-height: 1.25em;
              white-space: wrap;
              word-break: break-all;
            }
          }
          .el-radio:last-child {
            left: 1px;
            border-bottom: none;
          }
        }
      }

    }
  }
}
</style>