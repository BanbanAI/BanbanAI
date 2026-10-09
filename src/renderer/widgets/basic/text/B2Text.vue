<template>
  <b2-widget>
    <div :class="['text-value', widget.divClass]" @dblclick="handleDbClick">
      <div class="position" :style="positionStyle">
        <p ref="textShadowElement" class="text-shadow" :class="editing ? 'editing ' : ''"
          :style="textStyle.textShadowStyle">{{ widget.textValue }}</p>
        <p ref="textElement" :class="editing ? 'editing ' : ''" :style="textStyle.textColorStyle">{{ widget.textValue }}
        </p>
        <input :class="editing ? 'editing ' : ''" :style="[textStyle.textColorStyle, {
          'text-align': inputTextAlign,
        }]" ref="textInput" @click.stop="" @mousedown.stop="" @keydown.stop="handleKeydown" @change="updateText"
          @blur="exitEditing">
      </div>
    </div>
  </b2-widget>
</template>


<script lang="ts" setup>
import { OptionFontValue, useWidget } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from "vue";
import gsap from "gsap";
import { Text } from "./text";
import { equals } from "@common/utils/object";

const textInput = ref(null);
let editing = ref(false);
const widget = useWidget<Text>();

const textStyle = ref<Record<string, any>>({});
watch(()=>{
  let textShadowStyle = widget.textBasicStyle;
  let textColorStyle = widget.textBasicStyle;

  let fontStyle = widget.getOption<OptionFontValue>("text-font");
  let color = widget.toCssColor(fontStyle.color as Color);
  let shadowColor = widget.toCssColor(widget.getOption("font-shadow-color"));
  let shadowBlur = widget.getOption<number>("font-shadow-blur");
  let shadowX = widget.getOption("font-shadow-offset-x");
  let shadowY = widget.getOption("font-shadow-offset-y");
  let fontShadowColor = widget.toCssColor(widget.getOption("shadow-color"))
  let fontShadowBlur = widget.getOption<number>("shadow-blur");
  let fontShadowX = widget.getOption("shadow-offset-x");
  let fontShadowY = widget.getOption("shadow-offset-y");

  let shadowOpt = shadowBlur > -1 ? `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowColor}` : "";
  let fontShadowOpt = fontShadowBlur > -1 ? `${fontShadowX}px ${fontShadowY}px ${fontShadowBlur}px ${fontShadowColor}` : "";
  let comma = shadowOpt && fontShadowOpt ? "," : "";
  if (new Color(fontStyle.color).isGradient()) {
    textColorStyle += `background:${color};-webkit-background-clip: text;color: transparent;`;
  } else {
    textColorStyle += `color:${color};`;
  }
  if (shadowOpt || fontShadowOpt) textShadowStyle += `text-shadow: ${shadowOpt}${comma} ${fontShadowOpt};`;
  textShadowStyle += `color:transparent;`
  return {
    textShadowStyle,
    textColorStyle
  }
}, (value, oldValue)=>{
  if (!equals(value, oldValue)) {
    textStyle.value = value;
  }
}, {immediate: true});

watch(() => widget.status.isActive, (val) => {
  if (!val) {
    textInput.value?.blur?.();
  }
})

const handleDbClick = () => {
  if (widget.isPlaying || !widget.isEditable) return;
  if (editing.value) return;
  editing.value = true;
  textInput.value.value = widget.textValue;
  setTimeout(() => {
    textInput.value.select();
  }, 0)
}

const updateText = () => {
  widget.setOption("text", textInput.value.value);
}

const exitEditing = () => {
  editing.value = false;
}

const handleKeydown = (event) => {
  if (event.code === "Enter") {
    exitEditing();
  }
}

const inputTextAlign = ref();
watch(()=>{
  if(widget.getOption("text-arrangement") === "vertical") {
    let pisitionMap = {
      "top": "left",
      "center": "center",
      "bottom": "right"
    }
    return pisitionMap[widget.getOption<string>("text-vertical")];
  } else {
    return widget.getOption("text-position");
  }
}, (value, oldValue)=>{
  if (!equals(value, oldValue)) {
    inputTextAlign.value = value;
  }
}, {immediate: true});

const textElement = ref<HTMLParagraphElement>(null);
const textShadowElement = ref<HTMLParagraphElement>(null);
let animationDisplayTween = null;

const animationFn = async (textElement,options) => {
  let fromObject: any = {
      autoAlpha: 1,
      x: 0,
      y: 0
    };
    if (animationDisplayTween) {
      animationDisplayTween?.kill();
      animationDisplayTween = null;
      gsap.to(textElement, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        delay: 0,
        duration: 0
      });
    }
    if (!options.on || !options.visible) return;
    await nextTick();  // TODO 一开始加载的时候会显示一下
    let toObject = {
      delay: options.delay,
      duration: options.duration,
      repeat: options.loop ? -1 : 0,
      repeatDelay: options.interval,
      ease: options.easing,
      textValue: options.text
    };
    if (options.animationType == "blink") {
      toObject["yoyo"] = true;
      toObject["autoAlpha"] = 0;
    } else {
      //滚动
      //更新Dom元素文本内容
      textElement.innerText = toObject.textValue
      let textElementWidth = textElement?.offsetWidth || 0;
      let textElementHeight = textElement?.offsetHeight || 0;

      if (options.arrangement == "horizontal") {
        // 判断文本内容是否超出组件框
        if (textElementWidth <= widget.contentSize.width) {
          return;
        }
        let exceedWidth = textElementWidth - widget.contentSize.width;
        fromObject["x"] = (widget.contentSize.width + textElementWidth) / 2;
        toObject["x"] = -(widget.contentSize.width + textElementWidth) / 2;
        // 处理文本不是居中的情况
        if (options.textAlign == "left") {
          fromObject["x"] -= exceedWidth / 2;
          toObject["x"] -= exceedWidth / 2;
        }
        if (options.textAlign == "right") {
          fromObject["x"] += exceedWidth / 2;
          toObject["x"] += exceedWidth / 2;
        }
      } else {
        if (textElementHeight <= widget.contentSize.height) {
          return;
        }
        let exceedHeight = textElementHeight - widget.contentSize.height;
        fromObject["y"] = (widget.contentSize.height + textElementHeight) / 2;
        toObject["y"] = -(widget.contentSize.height + textElementHeight) / 2;
        if (options.textVertical == "top") {
          fromObject["y"] -= exceedHeight / 2
          toObject["y"] -= exceedHeight / 2
        }
        if (options.textVertical == "bottom") {
          fromObject["y"] += exceedHeight / 2
          toObject["y"] += exceedHeight / 2
        }
      }
    }

    animationDisplayTween = gsap.fromTo(textElement, fromObject, toObject);
    animationDisplayTween.then(() => {
      gsap.to(textElement, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        delay: 0,
        duration: 0
      });
    });
}

const positionStyle = ref<Record<string, string>>({});
onMounted(() => {
  watch(() => {
    return {
      on: widget.getOption<boolean>("animation-display"),
      loop: widget.getOption<boolean>("animation-loop"),
      delay: widget.getOption<number>("animation-delay"),
      interval: widget.getOption<number>("animation-interval"),
      duration: widget.getOption<number>("animation-duration"),
      animationType: widget.getOption<"scroll" | "blink">("animation-type"),
      easing: widget.getOption<string>("animation-easing"),
      arrangement: widget.getOption<string>("text-arrangement"),
      text: widget.textValue,
      textAlign: widget.getOption<string>("text-position"),
      textVertical: widget.getOption<string>("text-vertical"),
      visible: widget.status.isVisible
    }
  }, async (options) => {
    animationFn(textElement.value,options);
    animationFn(textShadowElement.value,options);
  }, { immediate: true });

  watch(() => widget.getOption<string[]>("text-position-relative"),
  (newVal, oldVal) => {
    if(!equals(newVal, oldVal)) {
      positionStyle.value = {
        left: newVal[0] + "px",
        top: newVal[1] + "px",
      }
    }
  }, {
    immediate: true
  });
});

onUnmounted(() => {
  animationDisplayTween?.kill();
  animationDisplayTween = null;
})

</script>

<style lang="scss" scoped>
.text-value {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;

  &.left {
    justify-content: start;
  }
  &.h-center {
    justify-content: center;
  }

  &.right {
    justify-content: end;
  }

  &.top {
    align-items: flex-start;
  }
  &.v-center{
    align-items: center;
  }

  &.bottom {
    align-items: flex-end;
  }

  &.vertical {
    writing-mode: tb-rl;
    text-orientation: upright;

    &.left {
      align-items: end;
    }
    &.h-center {
      align-items: center;
    }

    &.right {
      align-items: start;
    }

    &.top {
      justify-content: flex-start;
    }
    &.v-center{
      justify-content: center;
    }

    &.bottom {
      justify-content: flex-end;
    }
  }

  &.hover-pointer {
    &:hover {
      cursor: var(--cursor-pointer);
    }
  }

  .position {
    position: relative;
    p {
      white-space: pre;
      &.editing {
        display: none;
      }

      &:first-child {
        position: absolute;
      }

      &:last-child {
        position: absolute;
      }
    }

    input {
      position: absolute;
      white-space: nowrap;
      background: unset;
      margin-top: -1px;
      caret-color: rgb(212, 212, 212);
      display: none;

      &.editing {
        display: block;
        position: relative;
      }
    }
  }

}
</style>
