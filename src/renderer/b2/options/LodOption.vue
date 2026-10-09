<template>
  <div class="range-option">
    <div class="range-item">
      <div class="label">Lod0 :</div>
      <div class="range-input">
        <div>0</div>
      </div>
      <el-icon size="14"><i-ant-design-line-outlined /></el-icon>
      <div class="range-input">
        <el-input-number :controls="false" :min="1" v-model="values[0]" @change="updateRange" @wheel.stop />
      </div>
    </div>
    <div class="range-item" v-for="value, index in values">
      <div class="label">Lod{{ index + 1 }} :</div>
      <div class="range-input">
        <el-input-number :controls="false" :min="values[index - 1] ? values[index - 1] + 1 : 1" v-model="values[index]" @change="updateRange" @wheel.stop />
      </div>
      <el-icon size="14"><i-ant-design-line-outlined /></el-icon>
      <div class="range-input">
        <div v-if="index === (values.length - 1)">∞</div>
        <el-input-number :controls="false" :min="values[index] + 1" v-model="values[index + 1]" @change="updateRange"  @wheel.stop v-else />
      </div>
      <div class="btn delete" v-if="index !== (values.length - 1)">
        <el-icon @click.stop="deleteRange(index)"><i-ep-delete /></el-icon>
      </div>
    </div>
    <el-button class="add-btn" @click="addRangeOption" size="small" v-if="!cannotAdd">+</el-button>
  </div>
</template>
<script lang="ts" setup>
import { ref, watch, inject, computed } from 'vue';
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { DefinedOptionWithParsedType } from '../types';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);

const optionValue = ref<number[]>([]);
const values = ref<number[]>([]);
const cannotAdd = computed(() => !!props.option.args?.cannotAdd);

const valuesSort = () => {
  values.value = values.value.sort((a, b) => a - b);
}

const deleteRange = (index: number) => {
  values.value.splice(index, 1);
  updateOption(values.value);
}

const updateRange = () => {
  updateOption(values.value);
}

const addRangeOption = () => {
  values.value.push(Number(values.value[values.value.length - 1]) + 1);
  updateOption(values.value);
}

// 初始化
const init = () => {
  const optionDefaultValue = getOptionValue();
  if (Array.isArray(optionDefaultValue)) {
    optionValue.value = optionDefaultValue?.sort?.((a: number, b: number) => a - b);
  } else {
    optionValue.value = [100];
  }
  values.value = optionValue.value.filter(value => value !== 0);
  valuesSort();
}

init();
watch(() => getOptionValue(), (value) => {
  optionValue.value = value?.sort?.((a: number, b: number) => a - b) || [100];
  values.value = optionValue.value.filter(value => value !== 0);
});
</script>

<style lang="scss" scoped>
.range-option {
  position: relative;
  width: 100%;
  user-select: none;
  display: flex;
  flex-direction: column;

  .range-item{
    display: flex;
    margin-bottom: 10px;
    height: 24px;
    align-items: center;

    .label{
      margin-right: 10px;
    }

    .el-icon{
      margin: 0 10px;
    }
    .range-input {
      display: flex;
      align-items: center;
      width: 35px;
      justify-content: space-around;

      :deep(.el-input) {
        width: 35px;
        .el-input__wrapper{
          padding: 0;
        }
      }

      span {
        margin: 0 2px;
      }
    }

    .btn{
      width: 25px;
      display: flex;
      align-items: center;
      justify-content: space-around;
      cursor: var(--cursor-pointer);
      color: #ebebeb;
      &:hover{
        color: #fff;
      }
    }
  }
  :deep(.el-button).add-btn{
    width: 138px;
  }
  :deep(.el-input__inner::-webkit-inner-spin-button) {
    all: unset;
  }
}
</style>
