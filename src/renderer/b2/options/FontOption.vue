<template>
  <div class="option-group-control">
    <div class="font-row" v-for="(options, key) in defaultOptions" :key="key">
      <template v-for="(value, key) in options" :key="key">
        <el-select v-if="value['type'] === 'select'" :modelValue="value['value']" filterable
          @update:modelValue="updateValue($event, 'family')" size="small" :title="$t('optionsFont')" class="font-family" fit-input-width
          popper-class="option-group-popper" :name="option.name">
          <el-option v-for="font in fontList" :key="font.name" :label="font.name" :value="font.value" :title="font.name" />
        </el-select>
        <el-input v-else-if="value['type'] === 'number'" :model-value="(value['value'] as number)" :style="{'display': props.option.args?.noSize ? 'none' : 'block'}"
          @update:modelValue="updateValue($event, 'size')" :title="$t('optionsFontSize')" type='number' size='small' class="font-size"  @wheel.stop>
          <template #suffix>px</template>
        </el-input>
        <color-option v-else-if="value['type'] === 'color'" :option="{ name: 'text-color', type: 'color', parsedType: 'color', generics: {}, args: {gradient: value['gradient']} }" />
        <div v-else-if="value['type'] === 'boolean'" :class="{ btn: true, active: value['value'], disable: value['disabled'] }"
          @click="updateValue(!value['value'], key)" :title="value['title']">
          <el-icon :size="16">
            <i-ant-design-bold-outlined v-if="key === 'bold'" />
            <i-ant-design-italic-outlined v-else-if="key === 'italic'" />
            <i-ant-design-underline-outlined v-else-if="key === 'underline'" />
            <i-ant-design-strikethrough-outlined v-else-if="key === 'line-through'" />
          </el-icon>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { inject, provide, ref, watch, computed } from 'vue';
import { DefinedOptionWithParsedType } from "../types";
import axios from "axios";
import i18next from 'i18next';

let fontList = ref([{ value: '', get name() { return i18next.t("optionsFontSystem") } }])

// 在服务端获取系统字体列表
async function fetchFont() {
  const res = await axios.get("/project/font-list").catch((err) => {
    console.log('get font list failed: ', err);
  });
  if (res) {
    res.data.forEach(fontItem => {
      fontList.value.push({
        value: `"${fontItem}"`,
        name: fontItem
      })
    });
  }
}
fetchFont();

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();

const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);

const disableItem = props.option.args?.disable?.split('&');

const defaultOptions = computed(() => {
  let opt1 = {
    "row-1": {
      family: {
        type: 'select',
        value: '',
        title: i18next.t("optionsFont")
      },
      size: {
        type: 'number',
        value: 12,
        title: i18next.t("optionsFontSize")
      }
    },
    "row-2": {
      color: {
        type: 'color',
        value: '#fff',
        title: i18next.t("optionsFontColor"),
        gradient: props.option.args?.gradient === "true" ? "true" : "false"
      },
      bold: {
        type: 'boolean',
        value: false,
        title: i18next.t("optionsFontBold"),
        disabled: props.option.args?.bold !== undefined ? props.option.args?.bold === "false" : false
      },
      italic: {
        type: 'boolean',
        value: false,
        title: i18next.t("optionsFontItalic"),
        disabled: props.option.args?.italic !== undefined ? props.option.args?.italic === "false" : false
      },
      underline: {
        type: 'boolean',
        value: false,
        title: i18next.t("optionsFontUnderline"),
        disabled: props.option.args?.underline !== undefined ? props.option.args?.underline === "false" : true
      },
      "line-through": {
        type: 'boolean',
        value: false,
        title: i18next.t("optionsFontStrikethrough"),
        disabled: props.option.args?.['line-through'] !== undefined ? props.option.args?.['line-through'] === "false" : true
      }
    }
  }
  for(let rowKey in opt1) {
    const opt = opt1[rowKey];
    for(let key in opt){
      if(fontValue.value[key] !== undefined){
        opt[key]["value"] = fontValue.value[key];
      }
    }
  }
  return opt1;
})

const fontValue = ref({
  family: '',
  size: 12,
  color: '#fff',
  bold: false,
  italic: false,
  underline: false,
  "line-through": false,
});
const updateValue = (value, type) => {
  if(type === "size") value = Number(value);
  fontValue.value[type] = value;
  updateOption(fontValue.value);
}

watch(() => getOptionValue(), (value) => {
  if (typeof value !== 'object') {
    value = {}
  }
  fontValue.value = {
    ...fontValue.value,
    ...value
  };
}, {
  deep: true,
  immediate: true
});

const colorGetOptionValue = () => {
  return fontValue.value.color;
}
const colorUpdateValue = (value) => {
  updateValue(value, 'color');
}

provide(GET_OPTION_VALUE, colorGetOptionValue);
provide(UPDATE_OPTION, colorUpdateValue);
</script>

<style lang="scss" scoped>
.option-group-control {
  flex: 1;
  .font-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    &:nth-child(2) {
      margin-top: 5px;
    }
  }

  .font-family {
    flex: 1;
  }

  .font-size {
    width: 50px;
    margin-left: 5px;

    :deep(.el-input__wrapper) {
      .el-input__inner::-webkit-inner-spin-button {
        all: unset;
      }
    }
  }

  .option-group-control {
    flex: 0 1 auto;
    width: 40px;
  }

  .btn {
    width: 24px;
    height: 24px;
    line-height: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 3px;

    &:hover {
      background-color: var(--bg-color-hover);
    }

    &.active {
      color:var(--color-white);
      background-color: var(--bg-color-active);
    }

    &.disable {
      pointer-events: none;
      color: #666;
      cursor: not-allowed;
    }
  }

}
</style>
