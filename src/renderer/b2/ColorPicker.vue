<template>
  <div class="color-container" :class="{ gradient }">
    <div class="picker-wrapper" v-show="activePickerInfo" @mousemove="handlePickerMouseMove($event)"></div>
    <div class="color-selector">
      <div class="picker-container">
        <div class="cicker-selector">
          <div class="cicker-palette cicker-wrap">
            <div class="cicker-palette-opacity"></div>
            <div class="cicker-slider" :style="styles['paletteBackground']"
              @mousedown="handlePickerMouseDown($event, 'color')"></div>
            <div class="cicker-picker" :style="styles['palettePickerStyle']"></div>
          </div>
          <div class="cicker-hue cicker-wrap">
            <div class="cicker-slider" @mousedown="handlePickerMouseDown($event, 'hue')"></div>
            <div class="cicker-picker" :style="styles['huePickerStyle']"></div>
          </div>
          <div class="cicker-opacity cicker-wrap">
            <div class="cicker-slider" @mousedown="handlePickerMouseDown($event, 'opacity')"></div>
            <div class="cicker-picker" :style="styles['opacityPickerStyle']"></div>
          </div>
        </div>
        <div class="cicker-input">
          <div class="cicker-input-item hexa-input-item">
            <div class="input-value"><el-input ref="hexInputRef" v-model="currentColor" type="text" @change="checkColorVal"></el-input>
            </div>
            <div class="input-label" v-text="wordToUpperCase('hexa')"></div>
          </div>
          <div class="cicker-input-item" v-for="(cickerInputValue, cickerInputKey) in cickerInputList"
            :key="cickerInputKey">
            <div class="input-value">
              <el-input-number v-model="cickerInputList[cickerInputKey]" type="number" :controls="false"
                :precision="cickerInputKey == 'a' ? 2 : 0" :min="0" :max="cickerInputKey == 'a' ? 1 : 255">
              </el-input-number>
            </div>
            <div class="input-label" v-text="wordToUpperCase(cickerInputKey)"></div>
          </div>
        </div>
        <div class="cicker-interaction">
          <div class="cicker-result">
            <div class="cicker-preview-opacity"></div>
            <div class="cicker-preview" :style="styles['previewrBackground']" @click="handlePreviewMouseDown($event)">
            </div>
            <div class="cicker-handle" :class="{ selected: handle.selected }"
              :style="{ left: getHandleLeftValue(handle.position) }" v-for="(handle, index) in handlesList" :key="index"
              @mousedown="handlePickerMouseDown($event, 'handle', index)">
              <div class="handle-line"></div>
              <div class="handle-remove" @mousedown="handleRemoveColor(index)"><i class="fs fs-remove"></i></div>
              <div class="handle-knob"></div>
            </div>
          </div>
          <div class="cicker-direction">
            <div class="direction-wrapper">
              <div class="direction-item" :class="{ selected: direction.selected }" :title="direction.title"
                :angle="direction.angle" v-for="(direction, key) in directionList" :key="key"
                @click="handleDirectionClick(key)"></div>
            </div>
          </div>
          <div class="cicker-preview-angle">
            <div class="cicker-preview-angle-content" :style="styles['previewAngleBackground']"></div>
          </div>
          <div class="common-color-wrapper">
            <div class="common-color-item" :class="{ selected: commonColor.selected }"
              :style="{ backgroundColor: commonColor.color }" v-for="(commonColor, key) in commonColorList" :key="key"
              @click="handleCommonColorItemClick(key)"></div>
          </div>
        </div>
        <div class="cicker-histories">
          <div class="cicker-straw" @click="handleColorStraw"><i class="fs fs-xiguan color-straw"></i></div>
          <div class="histories-list">
            <div class="histories-list-item"
              :class="{ selected: historiesColor.selected, disabled: !gradient && (historiesColor.color as unknown as Color)?.colors?.length > 1 }"
              :style="handleHistoryColor(historiesColor.color)" v-for="(historiesColor, key) in historiesColorList"
              :key="key" @click="handleHistoryColorItemClick(key)"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="">
import { nextTick, ref, watch } from 'vue';
import { Color, ColorValue } from './color';
import { useEventListener, useEyeDropper } from '@vueuse/core';
import hexColorRegex from 'hex-color-regex'
import i18next from 'i18next';

const { open } = useEyeDropper();
const props = defineProps(["colorValue", "gradient"]);
const emit = defineEmits(['changed']);

const colorValue = ref(props.colorValue);
let colorInfo = ref(new Color(colorValue.value));

const currentColor = ref(colorInfo.value.hexa());
const hexInputRef = ref();
const cickerInputList = ref({
  "r": colorInfo.value.red(),
  "g": colorInfo.value.green(),
  "b": colorInfo.value.blue(),
  "a": colorInfo.value.alpha()
});
const directionList = ref([
  {
    name: "top-left",
    get title() { return i18next.t("optionColorDirectionTopLeft") },
    angle: "135",
    selected: false
  },
  {
    name: "top",
    get title() { return i18next.t("optionColorDirectionTop") },
    angle: "180",
    selected: false
  },
  {
    name: "top-right",
    get title() { return i18next.t("optionColorDirectionTopRight") },
    angle: "225",
    selected: false
  },
  {
    name: "left",
    get title() { return i18next.t("optionColorDirectionLeft") },
    angle: "90",
    selected: false
  },
  {
    name: "center",
    get title() { return i18next.t("optionColorDirectionCenter") },
    angle: "r",
    selected: false
  },
  {
    name: "right",
    get title() { return i18next.t("optionColorDirectionRight") },
    angle: "270",
    selected: false
  },
  {
    name: "bottom-left",
    get title() { return i18next.t("optionColorDirectionBottomLeft") },
    angle: "45",
    selected: false
  },
  {
    name: "bottom",
    get title() { return i18next.t("optionColorDirectionBottom") },
    angle: "0",
    selected: true
  },
  {
    name: "bottom-right",
    get title() { return i18next.t("optionColorDirectionBottomRight") },
    angle: '315',
    selected: false
  }
]);
const commonColorList = ref([
  { color: "#498DFFFF", selected: false },
  { color: "#53CEE6FF", selected: false },
  { color: "#C00000FF", selected: false },
  { color: "#FF0000FF", selected: false },
  { color: "#FFC000FF", selected: false },
  { color: "#FFFF00FF", selected: false },
  { color: "#92D050FF", selected: false },
  { color: "#00B050FF", selected: false },
  { color: "#00B0F0FF", selected: false },
  { color: "#0070C0FF", selected: false },
  { color: "#002060FF", selected: false },
  { color: "#7030A0FF", selected: false },
]);

type ColorItem = {
  color: string | ColorValue,
  selected: boolean
}

const historiesColorList: ColorItem[] = (JSON.parse(window.localStorage.getItem('historiesColorList')) as ColorItem[]) ||
  [
    { color: "#498DFFFF", selected: false },
    { color: "#53CEE6FF", selected: false },
    { color: "#C00000FF", selected: false },
    { color: "#FF0000FF", selected: false },
    { color: "#FFC000FF", selected: false },
    { color: "#FFFF00FF", selected: false },
    { color: "#92D050FF", selected: false },
    { color: "#00B050FF", selected: false },
    { color: "#00B0F0FF", selected: false },
    { color: "#0070C0FF", selected: false },
    { color: "#498DFFFF", selected: false },
    { color: "#53CEE6FF", selected: false },
    { color: "#C00000FF", selected: false },
    { color: "#FF0000FF", selected: false },
    { color: "#FFC000FF", selected: false },
    { color: "#FFFF00FF", selected: false },
    { color: "#92D050FF", selected: false },
    { color: "#00B050FF", selected: false },
    { color: "#00B0F0FF", selected: false },
    { color: "#0070C0FF", selected: false },
  ]

historiesColorList.find((historyColor) => {
  const isCurrentColor = JSON.stringify(historyColor.color) === JSON.stringify(colorInfo.value.toJSON());
  if (isCurrentColor) {
    historyColor.selected = true;
  }
  return isCurrentColor;
})

const handleHistoryColor = (historyColor: string | ColorValue) => {
  if (typeof historyColor === 'string') {
    return { backgroundColor: historyColor }
  } else {
    let currentHistoryColor = new Color(historyColor)
    return { background: currentHistoryColor.toCssString() }
  }
}

const handlesList = ref([]);
const initHandles = function () {
  let handles = colorInfo.value.colors;
  handles = handles.map((handle, index) => {
    handle.selected = index === colorInfo.value.selected_index;
    return handle;
  });
  if (handles.length > 1) {
    handlesList.value = handles;
  } else {
    handlesList.value = [];
  }
}
initHandles();

const wordToUpperCase = function (word: string) {
  return word.toUpperCase();
}
const getHandleLeftValue = function (position: number) {
  return position * 2 + "px";
}

const isUpdateColor = ref(false)
const updateCickerInputList = function (update?: boolean) {
  isUpdateColor.value = update ? true : false
  currentColor.value = colorInfo.value.hexa();
  cickerInputList.value = {
    "r": colorInfo.value.red(),
    "g": colorInfo.value.green(),
    "b": colorInfo.value.blue(),
    "a": colorInfo.value.alpha()
  }
}

const paletteWidth = 292
const paletteHeight = 200

//计算初始值
let palettePickerTop = (100 - colorInfo.value.value()) * paletteHeight / 100;
let palettePickerLeft = colorInfo.value.saturationv() * paletteWidth / 100;
let huePickerTop = colorInfo.value.hue() * paletteHeight / 360;
let opacityPickerLeft = colorInfo.value.alpha() * paletteHeight;
const colorHue = ref(colorInfo.value.hue())

const styles = ref({
  palettePickerStyle: {
    top: `${palettePickerTop}px`,
    left: `${palettePickerLeft}px`,
    backgroundColor: colorInfo.value.hexa()
  },
  huePickerStyle: {
    top: `${huePickerTop - 9}px`,
    backgroundColor: `hsl(${colorInfo.value.hue()}, 100%, 50%)`
  },
  opacityPickerStyle: {
    top: `${opacityPickerLeft - 9}px`,
    backgroundColor: `rgba(0, 0, 0, ${colorInfo.value.alpha()})`
  },
  paletteBackground: {
    background: `linear-gradient(to top, rgba(0, 0, 0, ${colorInfo.value.alpha()}), transparent), 
        linear-gradient(to left, hsla(${colorInfo.value.hue()}, 100%, 50%, ${colorInfo.value.alpha()}), rgba(255, 255, 255, ${colorInfo.value.alpha()}))`
  },
  previewrBackground: {
    background: colorInfo.value.toCssString(90)
  },
  previewAngleBackground: {
    background: colorInfo.value.toCssString()
  }
})

let activePickerInfo = ref();
const handlePickerMouseDown = function (ev: MouseEvent, type: string, index?: number) {
  cancelAllSelected();
  if (type === "color") {
    let saturation = ev.offsetX * 100 / paletteWidth;
    let value = 100 - ev.offsetY * 100 / paletteHeight;
    styles.value.palettePickerStyle.top = `${ev.offsetY}px`
    styles.value.palettePickerStyle.left = `${ev.offsetX}px`
    colorInfo.value.hue(colorHue.value)
    colorInfo.value.saturationv(saturation);
    colorInfo.value.value(value);
  } else if (type === "hue") {
    let hue = ev.offsetY * 360 / paletteHeight;
    if (hue === 360) {
      hue -= 0.00001;
    }
    colorHue.value = hue
    colorInfo.value.hue(hue);
  } else if (type === "opacity") {
    let alpha = ev.offsetY / paletteHeight;
    colorInfo.value.alpha(alpha);
  } else if (type === "handle") {
    handlesList.value.forEach((handle) => { handle.selected = false; });
    if (handlesList.value[index]) {
      handlesList.value[index].selected = true;
      colorInfo.value.setSelectedIndex(index);
      checkColorVal(colorInfo.value.hexa());
    }
  }
  activePickerInfo.value = {
    type: type,
    startX: ev.clientX,
    startY: ev.clientY,
    startPickerTop: ev.offsetY,
    startPickerLeft: ev.offsetX,
    hue: colorInfo.value.hue(),
    saturation: colorInfo.value.saturationv(),
    value: colorInfo.value.value(),
    opacity: colorInfo.value.alpha(),
    index: index,
    position: colorInfo.value.getSelectedPosition()
  };
  updateCickerInputList(true);
}

const handlePickerMouseMove = function (ev: MouseEvent) {
  if (!ev.buttons) activePickerInfo.value = null;
  if (!activePickerInfo.value) return;
  let offsetX = ev.clientX - activePickerInfo.value.startX;
  let offsetY = ev.clientY - activePickerInfo.value.startY;
  if (activePickerInfo.value.type === "color") {
    // 设置调色板选择器位置
    palettePickerTop = activePickerInfo.value.startPickerTop + offsetY
    palettePickerLeft = activePickerInfo.value.startPickerLeft + offsetX
    if (palettePickerLeft > paletteWidth) {
      palettePickerLeft = paletteWidth
    } else if (palettePickerLeft < 0) {
      palettePickerLeft = 0
    }
    if (palettePickerTop > paletteHeight) {
      palettePickerTop = paletteHeight
    } else if (palettePickerTop < 0) {
      palettePickerTop = 0
    }
    styles.value.palettePickerStyle.top = `${palettePickerTop}px`
    styles.value.palettePickerStyle.left = `${palettePickerLeft}px`

    // 设置选中颜色
    let offsetSaturation = offsetX * 100 / paletteWidth;
    let offsetValue = -offsetY * 100 / paletteHeight;
    let saturation = activePickerInfo.value.saturation + offsetSaturation;
    let value = activePickerInfo.value.value + offsetValue;
    colorInfo.value.hue(colorHue.value);
    colorInfo.value.saturationv(saturation);
    colorInfo.value.value(value);
  } else if (activePickerInfo.value.type === "hue") {
    let offsetHue = offsetY * 360 / paletteHeight;
    let hue = activePickerInfo.value.hue + offsetHue;
    if (hue < 0) hue = 0;
    if (hue >= 360) hue = 360 - 0.00001;
    colorHue.value = hue
    colorInfo.value.hue(hue);
  } else if (activePickerInfo.value.type === "opacity") {
    let offsetAlpha = offsetY / paletteHeight;
    let alpha = activePickerInfo.value.opacity + offsetAlpha;
    if (alpha < 0) alpha = 0;
    if (alpha > 1) alpha = 1
    colorInfo.value.alpha(alpha);
  } else if (activePickerInfo.value.type === "handle") {
    let offsetPosition = offsetX * 100 / paletteHeight;
    let position = activePickerInfo.value.position + offsetPosition;
    if (position < 0) position = 0;
    if (position > 100) position = 100;
    colorInfo.value.setSelectedPosition(position);
  }
  updateCickerInputList(true);
}

const cancelAllSelected = () => {
  commonColorList.value.forEach((commonColor) => { commonColor.selected = false; });
  historiesColorList.forEach((historyColor) => { historyColor.selected = false; });
}

const calcHandles = (isAdd?: boolean) => {
  let handles = colorInfo.value.colors;
  handles = handles.map((handle, index) => {
    handle.selected = index === colorInfo.value.selected_index;
    return handle;
  });
  if (isAdd) {
    handlesList.value = handles;
  } else {
    handlesList.value = handles.length > 1 ? handles : [];
  }
}

const handleCommonColorItemClick = function (key) {
  cancelAllSelected();
  colorInfo.value = new Color(commonColorList.value[key].color)
  commonColorList.value[key].selected = true;
  updateCickerInputList();
  calcHandles();
}

const handleHistoryColorItemClick = (key) => {
  cancelAllSelected();
  colorInfo.value = new Color(historiesColorList[key].color)
  historiesColorList[key].selected = true;
  updateCickerInputList();
  calcHandles();
}

const handleDirectionClick = function (key) {
  cancelAllSelected();
  directionList.value.forEach((direction) => { direction.selected = false; });
  let angle = directionList.value[key].angle;
  directionList.value[key].selected = true;
  colorInfo.value.setAngle(angle);
  updateCickerInputList();
}

const setAngleDirection = () => {
  const angle = colorInfo.value.getAngle()
  directionList.value.forEach((direction) => {
    direction.selected = direction.angle == angle
  });
}

const handlePreviewMouseDown = function (ev: MouseEvent) {
  cancelAllSelected();
  if (!props.gradient) {
    return;
  }
  let position = ev.offsetX * 100 / paletteHeight;
  if (handlesList.value.length > 0) {
    colorInfo.value.addColor(position);
    updateCickerInputList();
  } else {
    colorInfo.value.setSelectedPosition(position)
  }
  calcHandles(true);
}

const handleRemoveColor = function (index: number) {
  cancelAllSelected();
  colorInfo.value.removeColor(index);
  let handles = colorInfo.value.colors;
  handles = handles.map((handle, index) => {
    handle.selected = index === colorInfo.value.selected_index;
    return handle;
  });
  handlesList.value = handles.length > 1 ? handles : [];
  updateCickerInputList();
}

const handleColorStraw = async () => {
  const controller = new AbortController();
  const clearWindowBlur = useEventListener(window, 'blur', () => {
    // 窗口失焦时中断颜色吸取
    controller.abort();
    clearWindowBlur();
  })
  const color = await open({ signal: controller.signal }).catch(() => { });
  clearWindowBlur();
  if (color) {
    colorInfo.value.setSelectedColor(color.sRGBHex);
    updateCickerInputList();
  }
}

const handleStylesChange = function (changePicker?: boolean) {
  let huePickerTop = colorHue.value * paletteHeight / 360;
  let opacityPickerLeft = colorInfo.value.alpha() * paletteHeight;

  // 在使用其他方式改变选中颜色时则动态改变调色板picker位置
  if (changePicker) {
    let palettePickerTop = (100 - colorInfo.value.value()) * paletteHeight / 100;
    let palettePickerLeft = colorInfo.value.saturationv() * paletteWidth / 100;
    // 设置调色板标记位置
    styles.value.palettePickerStyle = {
      top: `${palettePickerTop}px`,
      left: `${palettePickerLeft}px`,
      backgroundColor: colorInfo.value.hexa()
    }
  } else {
    styles.value.palettePickerStyle.backgroundColor = colorInfo.value.hexa()
  }

  // 设置调色板颜色选择条标记位置
  styles.value.huePickerStyle = {
    top: `${huePickerTop - 9}px`,
    backgroundColor: `hsl(${colorHue.value}, 100%, 50%)`
  }
  // 设置调色板透明度条标记位置
  styles.value.opacityPickerStyle = {
    top: `${opacityPickerLeft - 9}px`,
    backgroundColor: `rgba(0, 0, 0, ${colorInfo.value.alpha()})`
  }
  // 设置调色板背景色
  styles.value.paletteBackground = {
    background: `linear-gradient(to top, rgba(0, 0, 0, ${colorInfo.value.alpha()}), transparent), 
        linear-gradient(to left, hsla(${colorHue.value}, 100%, 50%, ${colorInfo.value.alpha()}), rgba(255, 255, 255, ${colorInfo.value.alpha()}))`
  }
  styles.value.previewrBackground = {
    background: colorInfo.value.toCssString(90)
  }
  styles.value.previewAngleBackground = {
    background: colorInfo.value.toCssString()
  }
}

const checkColorVal = (val: string) => {
  if (val && !val.startsWith('#')) {
    val = '#' + val
  }
  let baseVal = val.replace('#', '')
  if (hexColorRegex().test(val) || val.length === 1) {
    currentColor.value = new Color(val)?.hexa()
  } else {
    if (val.length === 2 && hexColorRegex().test('#' + baseVal.repeat(6))) {
      currentColor.value = new Color('#' + baseVal.repeat(6))?.hexa()
    } else if (val.length === 3 && hexColorRegex().test('#' + baseVal.repeat(3))) {
      currentColor.value = new Color('#' + baseVal.repeat(3))?.hexa()
    } else if (val.length === 6 && hexColorRegex().test(val.slice(0, 5))) {
      currentColor.value = new Color(val.slice(0, 5))?.hexa()
    } else if (val.length === 8 && hexColorRegex().test(val.slice(0, 7))) {
      currentColor.value = new Color(val.slice(0, 7))?.hexa()
    } else {
      currentColor.value = '#000000FF'
    }
  }
  let colorHex = currentColor.value.trim();
  if (colorHex.length != 9) return;
  colorInfo.value.setSelectedColor(colorHex);
  colorHue.value = colorInfo.value.hue();
  handleStylesChange(true);
  updateCickerInputList(true);
}

watch(() => colorInfo.value.getAngle(), () => {
  setAngleDirection();
}, { immediate: true })

watch(() => props.gradient ? colorInfo.value.toJSON() : colorInfo.value.hexa(), (value) => {
  emit('changed', value);
});

watch(cickerInputList, (value) => {
  colorInfo.value.setSelectedColor(`rgba(${value.r}, ${value.g}, ${value.b}, ${value.a})`);
  currentColor.value = colorInfo.value.hexa();
  // 如果不是直接在调色板修改picker位置,则手动更改调色板位置
  if (!isUpdateColor.value) {
    colorHue.value = colorInfo.value.hue()
    handleStylesChange(true);
  } else {
    handleStylesChange();
    isUpdateColor.value = false
  }
}, { deep: true });

const handleCancel = function () {
  colorInfo.value = new Color(colorValue.value);
  initHandles();
  updateCickerInputList();
  commonColorList.value.forEach((commonColor) => { commonColor.selected = false; });
  directionList.value.forEach((direction) => { direction.selected = direction.angle == colorInfo.value.getAngle(); });
}

const handlePicked = function () {
  colorValue.value = colorInfo.value.toJSON();
  const selectedIndex = historiesColorList.findIndex(historyColor => historyColor.selected);
  if (selectedIndex === -1) {
    historiesColorList.pop();
    historiesColorList.unshift({ color: colorInfo.value.toJSON(), selected: false });
  }
  window.localStorage.setItem("historiesColorList", JSON.stringify(historiesColorList));
  if (props.gradient) {
    return colorInfo.value.toJSON();
  } else {
    return colorInfo.value.hexa()
  }
}

defineExpose({
  cancel: handleCancel,
  confirm: handlePicked,
  focusHexInput: async () => {
    await nextTick();
    const input = hexInputRef.value?.input as HTMLInputElement | undefined;
    if (!input) {
      return;
    }
    input.focus();
    input.select();
  },
})
</script>
<style lang="scss" scoped>
.color-container {
  width: 100%;
  height: 421px;
  position: relative;

  .color-selector {
    .cicker-selector {
      display: flex;
      height: 200px;

      .cicker-wrap {
        position: relative;
        cursor: grab;
      }

      .cicker-wrap.cicker-palette {
        flex: 1;
        margin-left: 0;
      }

      .cicker-wrap:not(cicker-palette) {
        margin-left: 16px;
        width: 8px;
      }

      .cicker-palette .cicker-palette-opacity {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: url('data:image/svg+xml;utf8, <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><path fill="white" d="M1,0H2V1H1V0ZM0,1H1V2H0V1Z"/><path fill="gray" d="M0,0H1V1H0V0ZM1,1H2V2H1V1Z"/></svg>');
        background-size: .5em;
        border-radius: .15em;
      }

      .cicker-slider {
        width: 100%;
        height: 100%;
        border-radius: 8px;
      }

      .cicker-palette .cicker-slider {
        position: absolute;
        border-radius: 0;
      }

      .cicker-hue .cicker-slider {
        background-image: linear-gradient(180deg, red, #ff0, #0f0, #0ff, #00f, #f0f, red);
      }

      .cicker-opacity .cicker-slider {
        background: linear-gradient(180deg, transparent, #000), url('data:image/svg+xml;utf8, <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><path fill="white" d="M1,0H2V1H1V0ZM0,1H1V2H0V1Z"/><path fill="gray" d="M0,0H1V1H0V0ZM1,1H2V2H1V1Z"/></svg>');
        background-size: 100%, 50%;
      }

      .cicker-picker {
        position: absolute;
        height: 16px;
        width: 16px;
        border: 2px solid #fff;
        border-radius: 100%;
        user-select: none;
        pointer-events: none;
        // top: 0;
        transform: translate(-50%, -50%);
      }

      .cicker-hue .cicker-picker,
      .cicker-opacity .cicker-picker {
        left: 50%;
        // top: calc(100% - 9px);
        transform: translateX(-50%);
      }
    }

    .cicker-input {
      display: grid;
      grid-template-columns: minmax(0, 96px) repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-top: 10px;

      .cicker-input-item {
        width: auto;
        text-align: center;

        .el-input-number {
          height: 27px;
          width: 100%;

          .el-input {
            height: 20px;

            .el-input__wrapper {
              padding: 0 10px;

              .el-input__inner {
                text-align: right;
              }
            }
          }
        }

        .input-label {
          line-height: 20px;
          font-size: 12px;
        }
      }

      .el-input__wrapper {
        background-color: #454545 !important;
        box-shadow: 0 0 0 1px var(--el-input-border-color, var(--el-border-color)) inset !important;

        &:hover {
          box-shadow: 0 0 0 1px var(--el-input-hover-border-color) inset !important;
        }
      }

      .hexa-input-item {
        min-width: 0;
      }
    }

    .cicker-interaction {
      height: 90px;
      display: flex;
      flex-wrap: wrap;

      .cicker-result {
        position: relative;
        height: 60px;
        width: 200px;

        .cicker-preview-opacity,
        .cicker-preview {
          position: absolute;
          top: 50%;
          width: 100%;
          height: 25px;
          transform: translateY(-50%);
        }

        .cicker-preview-opacity {
          background: url('data:image/svg+xml;utf8, <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><path fill="white" d="M1,0H2V1H1V0ZM0,1H1V2H0V1Z"/><path fill="gray" d="M0,0H1V1H0V0ZM1,1H2V2H1V1Z"/></svg>');
          background-size: .5em;
        }

        .cicker-handle {
          width: 20px;
          position: absolute;
          height: 100%;
          transform: translateX(-50%);

          .handle-line {
            display: block;
            margin: 0 auto;
            width: 2px;
            height: 100%;
            background-color: #b7b7b7;
          }

          .handle-remove {
            position: absolute;
            width: 14px;
            height: 14px;
            top: 0;
            left: 50%;
            transform: translateX(-50%);

            i {
              display: block;
              width: 14px;
              height: 14px;
              line-height: 14px;
              text-align: center;
              background-color: #666;
              font-size: 8px;
              color: white;
              border-radius: 50%;
              cursor: var(--cursor-pointer);
            }

            i:hover {
              background-color: #333;
            }
          }

          .handle-knob {
            position: absolute;
            bottom: 0;
            left: 50%;
            width: 16px;
            height: 16px;
            background-color: #999;
            border: 2px solid #fff;
            border-radius: 100%;
            cursor: var(--cursor-pointer);
            transform: translateX(-50%);
            box-shadow: 0 0 0 2px #dfe0e6;
          }
        }

        .cicker-handle.selected .handle-knob {
          box-shadow: 0 0 0 2px #999;
        }
      }

      .cicker-direction {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 60px;
        width: 90px;

        .direction-wrapper {
          width: 50px;
          height: 50px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;

          .direction-item {
            width: 14px;
            height: 14px;
            background-color: #474747;
            border: 2px solid #474749;
            cursor: var(--cursor-pointer);
          }

          .direction-item.selected {
            background: #474747;
            border: 2px solid #868686;
          }

        }
      }

      .cicker-preview-angle {
        display: flex;
        align-items: center;
        height: 60px;
        width: 50px;

        .cicker-preview-angle-content {
          width: 50px;
          height: 50px;
          background: linear-gradient(90deg, rgb(73, 111, 161) 22%, rgb(240, 3, 3) 70.5%);
        }
      }

      .common-color-wrapper {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 40px;
        width: 100%;

        .common-color-item {
          width: 20px;
          height: 20px;
          border: 2px solid #474747;
          cursor: var(--cursor-pointer);
          position: relative;
          &.selected{
            border: 2px solid #999;
            &::after{
              content: "";
              position: absolute;
              width: 0;
              height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 5px solid #999999;
              top: -10px;
              left: 3px;
            }
          }
        }
      }
    }

    .cicker-histories {
      position: relative;
      margin-top: 10px;
      padding-top: 10px;
      // display: flex;
      width: 100%;
      height: 70px;
      border-top: 1px dashed #aaa;

      .cicker-straw {
        display: inline-block;
        position: relative;
        width: 60px;
        height: 60px;

        .fs {
          display: inline-block;
          transition: all .25s ease;
        }

        .fs-xiguan {
          position: absolute;
          top: 50%;
          left: 50%;
          font-size: 40px;
          cursor: var(--cursor-pointer);
          transform: translate(-50%, -50%);
        }
      }

      .histories-list {
        display: inline-block;
        width: 280px;
        height: 60px;

        .histories-list-item {
          display: inline-block;
          margin: 5px 3px;
          width: 20px;
          height: 20px;
          border: 2px solid #474749;
          cursor: var(--cursor-pointer);
          position: relative;

          &.disabled {
            pointer-events: none;
          }

          &.selected{
            border: 2px solid #999;
            &::after{
              content: "";
              position: absolute;
              width: 0;
              height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 5px solid #999999;
              top: -10px;
              left: 3px;
            }
          }
        }
      }
    }
  }

  .picker-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
  }
}

.color-container.gradient {
  .cicker-direction {
    visibility: visible;
  }

  .cicker-preview-opacity,
  .cicker-preview {
    cursor: copy;
  }
}
</style>
