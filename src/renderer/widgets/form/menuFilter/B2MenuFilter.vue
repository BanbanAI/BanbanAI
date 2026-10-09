<template>
  <b2-form-element>
    <div class="menu-filter" ref="buttonsRef" :class="widget.getOption('layout-setting') === 'classic' ? '' : 'scroll'" v-if="widget.buttonItems.value.length">
      <div class="item-container" v-for="(buttonItem, buttonIndex) of widget.buttonItems.value" :key="buttonItem.key">
        <div
          :class="{
            'button-item': true,
            selected: buttonItem.checked,
            useSelectedStyle: buttonItem.useSelectedStyle,
            useHoverStyle: buttonItem.useHoverStyle,
            vertical: widget.getOption('text-arrangement') === 'vertical',
          }"
          :style="{
            left: itemOffsetPosition[buttonIndex]?.x,
            top: itemOffsetPosition[buttonIndex]?.y,
            transform: itemOffsetPosition[buttonIndex]?.r,
          }"
          :data-key="buttonItem.key"
          v-if="buttonItem.show">
          <div class="item-content" v-if="!buttonItem.isEmpty" :style="buttonItem.style" @click="handleClick">
            <div class="button-label">{{ buttonItem.label }}</div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="no-data" :style="noDataStyle">{{ $t("noData") }}</div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch, onUnmounted, nextTick, computed } from "vue";
import { useWidget, OptionFontValue, OptionFileValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { equals } from "@common/utils/object";
import { debounce } from "lodash";
import { MenuFilter } from "./menuFilter";
import i18next, { $t } from "@renderer/widgets/i18next";

const widget = useWidget<MenuFilter>();
const buttonsRef = ref(null);
const updateTime = ref(null);

const itemOffsetPosition = ref([]);
watch(
  () => {
    let [row, col] = widget.getOption<number[]>("layout");
    let result = [];
    let indexs = widget.getArrayClusterIndexes("layout-cluster");
    for (let index of indexs) {
      result.push({
        x: widget.getOption(["layout-cluster", index, "offset-x"]) + "px",
        y: widget.getOption(["layout-cluster", index, "offset-y"]) + "px",
        r: `rotate(${widget.getOption(["layout-cluster", index, "item-rotation"])}deg)`,
      });
    }
    return result;
  },
  (value, oldValue) => {
    if (!equals(value, oldValue)) {
      itemOffsetPosition.value = value;
    }
  },
  { immediate: true },
);

const handleClick = (event: MouseEvent, index: number) => {
  if (widget.getBoard().status.isEditable && !widget.getBoard().isPlaying && !widget.status.isActive) return;
  const targetElement = event.target.parentElement;
  const itemKey = targetElement.getAttribute("data-key");
  widget.setSelectedItem(itemKey);
};

const defaultStyle = ref({});
watch(
  () => {
    let layoutSetting = widget.getOption("layout-setting");
    let layoutArrangement = widget.getOption("layout-arrangement");
    let layoutScrollCount: number = widget.getOption("layout-scroll-count");
    let layout = widget.getOption("layout");
    let itemSize = widget.getOption("item-size");

    let animationTime = widget.getOption("layout-animation");

    let gridTemplateColumns;
    let gridTemplateRows;
    let flexDirection;
    let flex;
    let transition;

    if (layoutSetting === "scroll") {
      flexDirection = layoutArrangement === "horizontal" ? "row" : "column";
      flex = `0 0 ${100 / layoutScrollCount}%`;
      transition = `all ${animationTime}s ease-in-out`;
    } else {
      gridTemplateColumns = `repeat(${layout[1]}, 1fr)`;
      gridTemplateRows = `repeat(${layout[0]}, 1fr)`;
    }

    return {
      flex,
      flexDirection,
      transition,
      gridTemplateRows,
      gridTemplateColumns,
      width: `${itemSize[0]}px`,
      height: `${itemSize[1]}px`,
      contentHeight: widget.contentHeight + "px",
    };
  },
  (value, oldValue) => {
    if (!equals(value, oldValue)) {
      defaultStyle.value = value;
    }
  },
  { immediate: true },
);

const projectId = widget.getBoard().projectId;
const getItemStyleMap = () => {
  let styleMap = {};
  let clusterIndexes = widget.getArrayClusterIndexes("item-style-cluster");
  clusterIndexes.forEach((clusterIndex, index) => {
    let itemKey = widget.getOption<string>(["item-style-cluster", clusterIndex, "item-key"]);
    if (index == 0) itemKey = "global";
    if (!itemKey) return;
    const getStyleByState = (type: "default" | "hover" | "selected") => {
      let styleInfo = {};
      let enable = widget.getOption(["item-style-cluster", clusterIndex, `item-${type}-enable`]);
      styleInfo[`${type}-enable`] = enable;
      if (!enable) type = "default";
      let fontStyle = widget.getOption<OptionFontValue>(["item-style-cluster", clusterIndex, `font-${type}`]);
      let bgColor = widget.getOption<Color>(["item-style-cluster", clusterIndex, `background-color-${type}`]);

      let shadowColor = widget.getOption(["item-style-cluster", clusterIndex, `font-shadow-color-${type}`]);
      let shadowBlur = widget.getOption<number>(["item-style-cluster", clusterIndex, `font-shadow-blur-${type}`]);
      let shadowOffset = widget.getOption(["item-style-cluster", clusterIndex, `font-shadow-offset-${type}`]);

      let borderSize = widget.getOption(["item-style-cluster", clusterIndex, `border-size-${type}`]);
      let borderRadius = widget.getOption(["item-style-cluster", clusterIndex, `border-radius-${type}`]);
      let borderColor = widget.getOption<Color>(["item-style-cluster", clusterIndex, `border-color-${type}`]);
      let borderStyle = widget.getOption(["item-style-cluster", clusterIndex, `border-style-${type}`]);

      styleInfo[`--background-${type}`] = new Color(bgColor).toCssString();
      let bgImageUrl = "";
      let bgImage = widget.getOption<OptionFileValue>(["item-style-cluster", clusterIndex, `background-image-${type}`]);
      if (bgImage?.url) {
        bgImageUrl = bgImage.url;
      } else if (bgImage?.relativePath) {
        bgImageUrl = encodeURI(`${projectId}/${bgImage.relativePath}`);
      }
      if (bgImageUrl) {
        //图片背景
        let fillType = widget.getOption(["item-style-cluster", clusterIndex, `background-image-fill-${type}`]);
        let backgroundSize = widget.getOption(["item-style-cluster", clusterIndex, `background-image-scale-${type}`]);
        let backgroundPosition = widget.getOption(["item-style-cluster", clusterIndex, `background-image-position-${type}`]);
        if (fillType == "tile") {
          styleInfo[`--background-${type}`] = `url(${bgImageUrl}) repeat`;
        } else if (fillType == "stretch") {
          if (widget.getOption(["item-style-cluster", clusterIndex, `use-nine-patch-${type}`])) {
            const { top, right, bottom, left } = (widget.getOption(["item-style-cluster", clusterIndex, `nine-patch-${type}`]) as any) || {
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            };

            styleInfo[`--border-image-source-${type}`] = `url(${bgImageUrl}`;
            styleInfo[`--border-image-slice-${type}`] = `${top}% ${right}% ${bottom}% ${left}% fill`;
            styleInfo[`--border-image-width-${type}`] = "auto";
          } else {
            styleInfo[`--background-${type}`] = `url('${bgImageUrl}') no-repeat`;
            styleInfo[`--background-size-${type}`] = "100% 100%";
          }
        } else if (fillType == "none") {
          styleInfo[`--background-${type}`] = `url(${bgImageUrl}) no-repeat`;
          styleInfo[`--background-size-${type}`] = `${backgroundSize}%`;
          styleInfo[`--background-position-${type}`] = `${backgroundPosition[0]}px ${backgroundPosition[1]}px`;
        }
      }
      let bgBlur = widget.getOption<number>(["item-style-cluster", clusterIndex, `background-blur-${type}`]);
      styleInfo[`--BgBlur-${type}`] = bgBlur > 0 ? `blur(${bgBlur}px)` : "none";

      let textOffset = widget.getOption(["item-style-cluster", clusterIndex, `text-offset-${type}`]);
      let dropShadow = `${shadowOffset[0]}px ${shadowOffset[1]}px ${shadowBlur - 1}px ${shadowColor}`;

      let textAlign = widget.getOption(["item-style-cluster", clusterIndex, `text-align-${type}`]);
      if (widget.getOption("text-arrangement") === "vertical") {
        styleInfo[`--textAlign-${type}`] = "center";
        if (textAlign === "center") {
          styleInfo[`--justifyContent-${type}`] = "center";
        } else if (textAlign === "left") {
          styleInfo[`--justifyContent-${type}`] = "start";
        } else {
          styleInfo[`--justifyContent-${type}`] = "end";
        }
      } else {
        styleInfo[`--textAlign-${type}`] = textAlign;
      }

      styleInfo[`--fontColor-${type}`] = new Color(fontStyle.color).toCssString();
      styleInfo[`--fontSize-${type}`] = fontStyle.size + "px";
      styleInfo[`--fontFamily-${type}`] = fontStyle.family;
      styleInfo[`--fontItalic-${type}`] = fontStyle.italic ? "italic" : "normal";
      styleInfo[`--fontBold-${type}`] = fontStyle.bold ? "bold" : "normal";
      styleInfo[`--textSpacing-${type}`] = widget.getOption(["item-style-cluster", clusterIndex, `text-spacing-${type}`]) + "px";
      styleInfo[`--textIndent-${type}`] =
        styleInfo[`--textAlign-${type}`] == "center" || styleInfo[`--textAlign-${type}`] == "left" ? styleInfo[`--textSpacing-${type}`] : "0px";
      styleInfo[`--textTransform-${type}`] = `translate(${textOffset[0]}px,${textOffset[1]}px)`;

      styleInfo[`--borderWidth-${type}`] = borderSize + "px";
      styleInfo[`--borderRadius-${type}`] = borderRadius + "px";
      styleInfo[`--borderColor-${type}`] = new Color(borderColor).toCssString();
      styleInfo[`--borderStyle-${type}`] = borderStyle;

      styleInfo[`--dropShadow-${type}`] = dropShadow;

      return styleInfo;
    };

    styleMap[itemKey] = {
      ...getStyleByState("default"),
      ...getStyleByState("hover"),
      ...getStyleByState("selected"),
    };
  });
  return styleMap;
};
// 有动态数据等待数据加载完成，没有就等组件ready
const optionReady = ref(false);
const noDataStyle = computed(() => {
  const indexes = widget.getArrayClusterIndexes("item-style-cluster");
  const font = widget.getOption(["item-style-cluster", indexes[0], "font-default"]) as any;
  return {
    fontSize: font.size + "px",
    color: new Color(font.color).toCssString(),
    fontWeight: font.bold ? "bold" : "normal",
    fontFamily: font.family,
    fontStyle: font.italic ? "italic" : "normal",
  };
});
onMounted(() => {
  watch(
    () => {
      return widget.getBoard().isReady();
    },
    (val) => {
      optionReady.value = val;
    },
    { immediate: true },
  );

  watch(
    () => {
      return {
        laylout: widget.getOption("layout"),
        layoutSetting: widget.getOption("layout-setting"),
        layoutCount: widget.getOption("layout-scroll-count"),
        layoutArrangement: widget.getOption("layout-arrangement"),
        ready: widget.isReady(),
        itemStyleMap: getItemStyleMap(),
        inited: optionReady.value,
        updateTime: updateTime.value,
      };
    },
    async (value, oldValue) => {
      const { layoutSetting, layoutCount, laylout, ready, inited } = value;
      if (!equals(value, oldValue) && ready && inited) {
        let buttonCount;
        if (layoutSetting === "classic") {
          buttonCount = laylout[0] * laylout[1];
        } else {
          buttonCount = layoutCount;
        }
        if (buttonCount < 0) buttonCount = 0;
        widget.buttonItems.value = widget.buttonList?.map((item, itemIndex) => {
          let { label, key } = item;
          const itemStyleMap = getItemStyleMap();
          let style = itemStyleMap[key] || itemStyleMap["global"];
          return {
            isEmpty: !label,
            key: key,
            label: label,
            style: style,
            checked: item.checked,
            useSelectedStyle: style["selected-enable"],
            useHoverStyle: style["hover-enable"],
            show: itemIndex <= buttonCount - 1 || layoutSetting === "scroll" ? true : false,
            field: item.field,
          };
        });

        if (buttonsRef.value) {
          buttonsRef.value.style.transform = "none";
        }
        if (layoutSetting === "scroll") widget.scrollButtonItems = widget.buttonList.slice(0, buttonCount);
      }
    },
    { immediate: true },
  );

  // 处理重名
  watch(
    () => {
      return {
        list: widget.getOption<string[]>("button-name-option") || [],
      };
    },
    (newVal) => {
      let hasSame = false;
      let list = newVal.list;
      let addedValues = [];
      for (let index = 0; index < list.length; index++) {
        let val = list[index];
        if (addedValues.indexOf(val) > -1) {
          hasSame = true;
          let i = 1;
          while (addedValues.indexOf(val) > -1) {
            let list = val.match(/\((\d+)\)/);
            if (list?.length) {
              let newIndex = parseInt(list[1]) + 1;
              val = val.replace(list[0], `(${newIndex})`);
            } else {
              val += `(${i})`;
            }
            i++;
          }
        }
        addedValues.push(val);
      }

      if (hasSame) {
        widget.setOption("button-name-option", addedValues, false);
      }
    },
    { deep: true },
  );

  watch(
    () => {
      return {
        nameList: widget.buttonList || [],
      };
    },
    (value, oldValue) => {
      if (equals(value.nameList, oldValue.nameList)) return;
      let count = value.nameList.length;
      let oldCount = oldValue?.nameList?.length || 0;
      let [row, col] = widget.getOption<number[]>("layout");
      if (widget.getOption("auto-layout") && count) {
        if (row == 1) {
          widget.setOption("layout", [row, count], false);
        } else {
          widget.setOption("layout", [Math.max(1, Math.ceil(count / col)), col], false);
        }
      }
      if (count - oldCount < 0) {
        //刪除多余的配置项
        let indexes = widget.getArrayClusterIndexes("layout-cluster");
        indexes = indexes.filter((item, index) => index < count - oldCount);
        widget.setOption(["layout-cluster", "indexes"], indexes, false);
      }
      updateTime.value = Date.now();
    },
  );

  const styleOptions = [
    "font",
    "text-spacing",
    "text-align",
    "text-offset",
    "font-shadow-color",
    "font-shadow-blur",
    "font-shadow-offset",
    "border-color",
    "border-size",
    "border-radius",
    "border-style",
    "background-color",
    "background-image",
    "background-image-fill",
    "background-blur",
    "use-nine-patch",
    "nine-patch",
  ];

  watch(
    () => {
      let clusterIndexes = widget.getArrayClusterIndexes("item-style-cluster");
      let enableMap = {};
      clusterIndexes.forEach((clusterIndex, index) => {
        let enable = widget.getOption(["item-style-cluster", clusterIndex, `item-hover-enable`]);
        enableMap[clusterIndex] = enable;
      });
      return enableMap;
    },
    (value, oldValue) => {
      for (let key in value) {
        if (value[key] && value[key] != oldValue?.[key]) {
          for (let optionKey of styleOptions) {
            widget.setOption(["item-style-cluster", key, `${optionKey}-hover`], widget.getOption(["item-style-cluster", key, `${optionKey}-default`]), false);
          }
        }
      }
    },
  );

  watch(
    () => widget.selectedValue,
    (newVal, oldVal) => {
      if (!equals(newVal, oldVal)) {
        if (newVal.length) {
          let sendArr = [];
          for (let item of widget.selectedValue) {
            if (item.key !== "all") {
              sendArr.push(item.label);
            }
          }
          widget.applyLinkage({ name: widget.selectedValue[0]?.field, value: sendArr });
        } else {
          widget.withdrawLinkage();
        }
      }
    },
  );
});
</script>

<style lang="scss" scoped>
.menu-filter {
  display: grid;
  grid-template-rows: v-bind("defaultStyle.gridTemplateRows");
  grid-template-columns: v-bind("defaultStyle.gridTemplateColumns");
  justify-items: center;
  align-items: center;
  width: 100%;
  height: v-bind("defaultStyle.contentHeight");

  &.scroll {
    display: flex;
    flex-direction: v-bind("defaultStyle.flexDirection");
    transition: v-bind("defaultStyle.transition");
  }

  .button-item:hover {
    cursor: var(--cursor-pointer);
  }

  &.editing .button-item:hover {
    cursor: n-resize;
  }

  &.editing.rowEdit .button-item:hover {
    cursor: e-resize;
  }

  .button-item {
    position: relative;
    width: v-bind("defaultStyle.width");
    height: v-bind("defaultStyle.height");

    .item-content {
      display: flex;
      justify-content: var(--justifyContent-default);
      align-items: center;
      width: 100%;
      height: 100%;
      background: var(--background-default);
      background-size: var(--background-size-default);
      background-position: var(--background-position-default);
      color: var(--fontColor-default);
      font-size: var(--fontSize-default);
      font-weight: var(--fontBold-default);
      font-style: var(--fontItalic-default);
      font-family: var(--fontFamily-default);
      border-width: var(--borderWidth-default);
      border-color: var(--borderColor-default);
      border-style: var(--borderStyle-default);
      border-radius: var(--borderRadius-default);
      border-image-source: var(--border-image-source-default);
      border-image-slice: var(--border-image-slice-default);
      border-image-width: var(--border-image-width-default);
      backdrop-filter: var(--BgBlur-default);
      .button-label {
        width: 100%;
        pointer-events: none;
        text-align: var(--textAlign-default);
        letter-spacing: var(--textSpacing-default);
        transform: var(--textTransform-default);
        background: var(--fontColor-default);
        -webkit-background-clip: text;
        color: transparent;
        font-family: var(--fontFamily-default);
        text-indent: var(--textIndent-default);
        filter: drop-shadow(var(--dropShadow-default));
      }
    }

    &.useHoverStyle .item-content:hover {
      justify-content: var(--justifyContent-hover);
      background: var(--background-hover);
      background-size: var(--background-size-hover);
      background-size: var(--background-size-hover);
      background-position: var(--background-position-hover);
      color: var(--fontColor-hover);
      font-size: var(--fontSize-hover);
      font-weight: var(--fontBold-hover);
      font-style: var(--fontItalic-hover);
      font-family: var(--fontFamily-hover);
      border-width: var(--borderWidth-hover);
      border-color: var(--borderColor-hover);
      border-style: var(--borderStyle-hover);
      border-radius: var(--borderRadius-hover);
      border-image-source: var(--border-image-source-hover);
      border-image-slice: var(--border-image-slice-hover);
      border-image-width: var(--border-image-width-hover);
      backdrop-filter: var(--BgBlur-hover);

      .button-label {
        text-align: var(--textAlign-hover);
        letter-spacing: var(--textSpacing-hover);
        transform: var(--textTransform-hover);
        background: var(--fontColor-hover);
        -webkit-background-clip: text;
        color: transparent;
        font-family: var(--fontFamily-hover);
        text-indent: var(--textIndent-hover);
        filter: drop-shadow(var(--dropShadow-hover));
      }
    }

    &.useSelectedStyle.selected .item-content {
      justify-content: var(--justifyContent-selected);
      background: var(--background-selected);
      background-size: var(--background-size-selected);
      background-size: var(--background-size-selected);
      background-position: var(--background-position-selected);
      color: var(--fontColor-selected);
      font-size: var(--fontSize-selected);
      font-weight: var(--fontBold-selected);
      font-style: var(--fontItalic-selected);
      font-family: var(--fontFamily-selected);
      border-width: var(--borderWidth-selected);
      border-color: var(--borderColor-selected);
      border-style: var(--borderStyle-selected);
      border-radius: var(--borderRadius-selected);
      border-image-source: var(--border-image-source-selected);
      border-image-slice: var(--border-image-slice-selected);
      border-image-width: var(--border-image-width-selected);
      backdrop-filter: var(--BgBlur-selected);

      .button-label {
        text-align: var(--textAlign-selected);
        letter-spacing: var(--textSpacing-selected);
        transform: var(--textTransform-selected);
        background: var(--fontColor-selected);
        -webkit-background-clip: text;
        color: transparent;
        font-family: var(--fontFamily-selected);
        text-indent: var(--textIndent-selected);
        filter: drop-shadow(var(--dropShadow-selected));
      }
    }

    &.vertical {
      .button-label {
        height: 100%;
        width: auto;
        writing-mode: vertical-rl;
        text-orientation: upright;
      }
    }
  }
}
.item-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: v-bind("defaultStyle.flex");
}

.no-data {
  width: 100%;
  height: v-bind("defaultStyle.contentHeight");
  text-align: center;
  line-height: v-bind("defaultStyle.contentHeight");
  color: v-bind("noDataStyle.color");
  font-size: v-bind("noDataStyle.fontSize");
  font-weight: v-bind("noDataStyle.fontWeight");
  font-style: v-bind("noDataStyle.fontStyle");
  font-family: v-bind("noDataStyle.fontFamily");
}
</style>
