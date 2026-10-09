<template>
  <div class="option-group-control">
    <div class="multiple-vector-group" :class="isMultiple ? 'multiple' : ''" v-for="tuple, tupleIndex in tupleValue">
      <div v-for="(generic, index) in Object.keys(option.generics)" class="option-group-tuple" :style="{ width: tupleWidth }" :key="generic">
        <el-tooltip placement="top" :content="generic" :disabled="!option.args?.hasOwnProperty('hideGeneric')" effect="light" :hide-after="0" :show-arrow="false" :offset="3"
          :style="{border: '1px solid #3a3b40', background: 'var(--el-bg-color)'}">
          <el-input v-model="tupleValue[tupleIndex][index]"
            :title="tupleValue[tupleIndex][index]" @input="handleInput(tupleIndex, index, $event)" :name="generic" type="number" step="any" size="small" @blur="updateValue(tupleIndex, index, tupleValue[tupleIndex][index])" @keyup.enter.native="inputEnterBlur" @wheel.stop>
            <template v-if="!option.args?.hasOwnProperty('hideGeneric')" #prepend>{{ generic }}</template>
            <template v-if="option.args?.unit" #suffix>{{ option.args.unit }}</template>
          </el-input>
        </el-tooltip>
      </div>
      <div class="ration-icon" @click="toggleLock()" v-if="islock">
        <el-icon size="14" :title="islockRatio ? $t('lockRatio') : $t('unlockRatio')" v-if="!tupleIndex">
          <i-ant-design-link-outlined v-if="islockRatio" />
          <i-ant-design-disconnect-outlined v-else/>
        </el-icon>
      </div>
      <div class="delete-icon" v-if="isMultiple" @click="deleteTarget(tupleIndex)"><i class="fs fs-delete"></i></div>
    </div>
    <el-button @click="addVectorOption" size="small" v-if="isMultiple">+</el-button>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION, GET_DEFAULT_OPTION_VALUE, OPTION_ELEMENT } from "../inject";
import { INPUT_ENTER_BLUR } from '@renderer/types';
import { computed, inject, ref, unref, watch } from 'vue';
import { DefinedOptionWithParsedType } from '../types';
import { deepClone, isEmpty } from '@common/utils/object';
import { multiplyWithPrecision } from '../utils/vectorPrecision';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const element = inject(OPTION_ELEMENT);
const isMultiple = props.option.args.hasOwnProperty('multiple');
const islock = props.option.args.hasOwnProperty('lockRatio')
const islockRatio = ref(islock)

// 输入时置为true 用来防止option值与v-model值之间的联动
// 主要用来实现边输入边预览效果
let doNotSyncInput = false;

const tupleValue = ref([[]]);
const tempTupleValue = ref([[]]);
const originTupleValue = ref([[]]);
watch(()=>getOptionValue(), (value)=>{
  // 正在输入时阻止option值与v-model值之间的联动
  if (!doNotSyncInput) {
    if (!isMultiple) {
      tupleValue.value = [[...(value ?? [])]];
    } else {
      tupleValue.value = [...(value ?? [])];
    }
    originTupleValue.value = deepClone(tupleValue.value);
  } else {
    doNotSyncInput = false;
  }
}, {immediate: true});

const updateValue = (tupleIndex: number, index: number, value: string, type?: 'transient') => {
  let formattedValue = formatters[index](value) || 0;
  if (islockRatio.value && !isEmpty(formattedValue)) {
    let ratio: number;
    if (originTupleValue.value[tupleIndex][index] === 0) {
      ratio = 1;
    } else {
      ratio = formattedValue / originTupleValue.value[tupleIndex][index];
    }
    //当所有值为0时，不进行比例计算，使用一比一的比例
    if (originTupleValue.value[tupleIndex].every(val => val == 0)) {
      tupleValue.value[tupleIndex] = tupleValue.value[tupleIndex].map(() => Number(value));
    } else {
      tupleValue.value[tupleIndex] = originTupleValue.value[tupleIndex].map(val => {
        return multiplyWithPrecision(val, ratio);
      })
    }
  }
  // 阻止联动
  if (!doNotSyncInput) {
    tupleValue.value[tupleIndex][index] = formattedValue;
    tempTupleValue.value = deepClone(tupleValue.value);
  } else {
    tempTupleValue.value = deepClone(tupleValue.value);
    tempTupleValue.value[tupleIndex][index] = formattedValue;
  }

  if ((props.option as any).beforeChange) {
    const valueToEmit = !isMultiple ? tempTupleValue.value[0] : tempTupleValue.value;
    const shouldChange = (props.option as any).beforeChange(unref(element), valueToEmit);
    if (shouldChange === false) {
      // 还原值
      const original = getOptionValue();
      if (!isMultiple) {
        tempTupleValue.value = [[...(original ?? [])]];
      } else {
        tempTupleValue.value = [...(original ?? [])];
      }
      if (!doNotSyncInput) {
        tupleValue.value = deepClone(tempTupleValue.value);
      }
      doNotSyncInput = false;
      return;
    }
  }

  if (value !== getOptionValue()[tupleIndex][index]) {
    if (!isMultiple) {
      updateOption(tempTupleValue.value[0], type);
    } else {
      updateOption(tempTupleValue.value, type);
    }
  } else {
    doNotSyncInput = false;
  }
}

const getDefaultValue = inject(GET_DEFAULT_OPTION_VALUE);
const deleteTarget = (index: number) => {
  tupleValue.value.splice(index, 1);
  const defaultValue = getDefaultValue();
  if (tupleValue.value.length === 0) {
    if (defaultValue && Array.isArray(defaultValue[0])) {
      tupleValue.value = [defaultValue[0]];
    } else {
      tupleValue.value = [new Array(types.length).fill(0)];
    }
  }
  updateOption(tupleValue.value);
}

const toggleLock = () => {
  islockRatio.value = !islockRatio.value
}

const addVectorOption = () => {
  const defaultValue = getDefaultValue();
  if (defaultValue && Array.isArray(defaultValue[0])) {
    tupleValue.value.push(defaultValue[0]);
  } else {
    tupleValue.value.push(new Array(types.length).fill(0));
  }
  updateOption(tupleValue.value);
}

const tupleWidth = computed(() => {
  const generics = Object.keys(props.option.generics);
  let columns = props.option.args.columns ? parseInt(props.option.args.columns) : 0;
  if (columns > generics.length) {
    columns = generics.length;
  }
  if (columns <= 0) {
    if (generics.length === 1) {
      columns = 1;
    } else if (generics.length === 3) {
      columns = 3;
    } else {
      columns = 2;
    }
  }
  if (isMultiple && islock) {
    return `${Math.round(85 / columns - 1)}%`;
  }
  if (isMultiple || islock) {
    return `${Math.round(90 / columns - 1)}%`;
  } else {
    return `${Math.round(100 / columns - 1)}%`;
  }
});

function getFormatter(type: string) {
  switch (type) {
    case "int": return parseInt;
    case "float": return parseFloat;
    default: return parseInt;
  }
}
const types = Object.values(props.option.generics);
const formatters: ((string: string) => number)[] = [];
const defaultFormatter = getFormatter(types?.[0]);
for (let key of types) {
  if (key && key !== "true") {
    formatters.push(getFormatter(key));
  } else {
    formatters.push(defaultFormatter);
  }
}
const handleInput = (tupleIndex: number, index: number, value: string) => {
  doNotSyncInput = true;
  updateValue(tupleIndex, index, value, 'transient');
}

const inputEnterBlur = inject(INPUT_ENTER_BLUR)
</script>

<style lang="scss" scoped>
.option-group-control {
  .multiple-vector-group{
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    &.multiple{
      padding-bottom: 10px;
      align-items: center;
      .delete-icon{
        width: 15px;
        height: 15px;
        text-align: center;
        line-height: 15px;
        .fs{
          font-size: 12px;
        }

        &:hover{
          cursor: var(--cursor-pointer);
        }
      }
    }

    .option-group-tuple {
      display: flex;

      :deep(.el-input) {
        .el-input__wrapper {
          padding: 0 6px;
        }
        .el-input-group__prepend {
          padding: 0 5px;
          text-align: center;
          background-color: var(--bg-color);
        }
      }

      .option-group-tuple-label {
        width: 20px;
        margin-right: 5px;
      }

    }
   
    .ration-icon {
      display: flex;
      &:hover{
        cursor: var(--cursor-pointer);
      }
    }
  }

  .el-input {
    :deep(.el-input__inner::-webkit-inner-spin-button) {
      all: unset;
    }
  }

  .el-button {
    display: block;
    width: 100%;
    line-height: 0;
    cursor: var(--cursor-pointer);
  }
}
</style>
