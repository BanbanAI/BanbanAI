<template>
  <b2-widget>
    <div :class="widget.divClass" v-show="showCard">
      <div class="card-value" :data-unit="widget.displayUnitValue" >
         <template v-if="cardType === 'card'">
            <span class="card-part" :style="cardStyle.cardFontShadowStyle" v-for="part of valueParts">{{ part }}</span>
         </template>
         <template v-else>
          <span class="card-text" :style="cardStyle.cardFontShadowStyle">{{ valueText }}</span>
         </template>
        <img :src="cardImageUrl" crossoriginNew="anonymous" ref="cardImageDom" style="display: none;"/>
      </div>
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { useWidget, OptionFontValue, OptionFileValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { onMounted, onUnmounted, ref, watch, Ref } from "vue";
import { debounce } from "lodash";
import { CardV2 } from "./cardV2";
import { equals } from "@common/utils/object";

const widget = useWidget<CardV2>();
const cardImageDom = ref(null);
const showCard = ref(false);
const cardImageUrl = ref("");
const valueText = ref(widget.cardValueText);
const valueParts = ref([""]);
const cardWidth = ref("0");
const cardBackground = ref("transparent");
const cardTextPadding = 5;
const cardType: Ref<'normal'|'lcd'|'card'> = ref('normal');
watch(()=>widget.getOption<'normal'|'lcd'|'card'>("type"), (value)=>{
  if (cardType.value !== value) {
    cardType.value = value;
  }
}, {immediate: true});
let maxTextWidth = ref();
let cardPosition = ref('absolute');
let isFirst = true;

const updateCardWidth = (cardText)=>{
  cardText = cardText ?? widget.getCartValueText(widget.cardValue);
  setTimeout(()=>{
    let fontSpacing = Number(widget.getOption<number>("font-spacing"));
    let _canvas = document.createElement("canvas");
    _canvas.width = widget.contentSize.width;
    _canvas.height = widget.contentSize.height;
    const _context = _canvas.getContext("2d");
    let valueFont = widget.getOption<OptionFontValue>("font");
    let fontSize = valueFont.size + "px";
    let fontFamily = cardType.value === "lcd" ? "lcd" : valueFont.family;
    let fontWeight = valueFont.bold ? "bold" : "normal";
    let fontStyle = valueFont.italic ? "italic" : "normal";
    _context.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily ? fontFamily: "sans-serif"}`;

    const charList = Array.from(new Set([
      "0","1","2","3","4","5","6","7","8","9",".",",","-",
      ...String(cardText || "").replace(/\s/g,"").split(""),
    ]));
    let widthMap = { max: 0, min: 999 }
    charList.forEach((item)=>{
      widthMap[item] = _context.measureText(String(item)).width;
      widthMap["max"] = Math.max(widthMap[item], widthMap["max"]);
      widthMap["min"] = Math.min(widthMap[item], widthMap["min"]);
    });
    maxTextWidth.value = widthMap["max"]+'px';
    const getCharWidth = (char: string) => widthMap[char] ?? widthMap["max"];

    let unitFont = widget.getOption<OptionFontValue>("unit-font");
    let unitFontSize = unitFont.size + "px";
    let unitFontFamily = unitFont.family;
    let unitFontWeight = unitFont.bold ? "bold" : "normal";
    let unitFontStyle = unitFont.italic ? "italic" : "normal";
    _context.font = `${unitFontStyle} ${unitFontWeight} ${unitFontSize} ${unitFontFamily ? unitFontFamily: "sans-serif"}`;
    let unitWidth = _context.measureText(widget.unitValue).width;

    let currentX = 0;
    let currentY = Math.floor((widget.contentSize.height - valueFont.size) / 2);
    let offset = cardTextPadding;
    _context.fillStyle = widget.toCssColor(widget.getOption("card-color"));
    let flagBg = widget.getOption("card-flag-background");
    let width = cardText.replace(/\s/g,"").split("").reduce((result, current, index)=>{
      if(index > 0){
        currentX += fontSpacing;
      }
      if(!flagBg && [".", ",", "-"].includes(current)){
        currentX += widthMap["max"];
        return result + (cardType.value === 'card' ? widthMap["max"] : getCharWidth(current)) + fontSpacing;
      }
      if(cardType.value === "card"){
        if(cardImageUrl.value){
          //图片
          _context.drawImage(cardImageDom.value, currentX, currentY - offset, widthMap["max"] + offset * 2, valueFont.size + offset * 2);
        }else{
          _context.fillRect(currentX, currentY - offset, widthMap["max"] + offset * 2, valueFont.size + offset * 2);
        }
      }
      if(flagBg && [".", ",", "-"].includes(current)){
        currentX += widthMap["max"];
        return result + (cardType.value === 'card' ? widthMap["max"] : getCharWidth(current)) + fontSpacing;
      }
      currentX += widthMap["max"];
      return result + (cardType.value === 'card' ? widthMap["max"] : getCharWidth(current)) + fontSpacing;
    }, 0);
    width += unitWidth;
    cardWidth.value = Math.ceil(width) + "px";
    if(cardType.value === "card"){
      let base64Img = _canvas.toDataURL();
      cardBackground.value = `url(${base64Img}) no-repeat`;
    }else{
      cardBackground.value = `transparent`;
    }
    _canvas.remove();
    _canvas = null;
    isFirst = false;
    showCard.value = true;
  }, isFirst ? 0 : 0);
}

const cardStyle: Ref<any> = ref({});
watch(()=>{
  let valueFont = widget.getOption<OptionFontValue>("font");
  let fontColor = widget.toCssColor(valueFont.color as Color)
  let fontShadowColor = widget.toCssColor(widget.getOption("font-shadow-color"));
  let fontShadowBlur = widget.getOption("font-shadow-blur");
  let fontShadowOffset = widget.getOption("font-shadow-offset");
  let fontSpacing = widget.getOption("font-spacing");
  let fontTextFillColor = 'unset'

  let unitFont = widget.getOption<OptionFontValue>("unit-font");
  let unitFontColor = widget.toCssColor(unitFont.color as Color)
  let unitFontShadowColor = widget.toCssColor(widget.getOption("unit-shadow-color"));
  let unitFontShadowBlur = widget.getOption("unit-shadow-blur");
  let unitFontShadowOffset = widget.getOption("unit-shadow-offset");
  let unit = widget.unitValue;
  let unitTextFillColor = 'unset'

  let cardFontShadowStyle = ""
  let unitShadow;
  let unitFilter;
  if(new Color(valueFont.color).isGradient()) {
    fontTextFillColor = 'transparent'
    cardFontShadowStyle += `background:${valueFont.color};-webkit-background-clip: text;color: transparent;filter: drop-shadow(${fontShadowOffset[0]}px ${fontShadowOffset[1]}px ${fontShadowBlur}px ${fontShadowColor});`;
  }else{

    cardFontShadowStyle+= `text-shadow:${fontShadowOffset[0]}px ${fontShadowOffset[1]}px ${fontShadowBlur}px ${fontShadowColor}`
    fontTextFillColor = 'unset'
  }

  if(new Color(unitFont.color).isGradient()) {
    unitShadow = "unset"
    unitTextFillColor = 'transparent'
    unitFilter = `drop-shadow(${unitFontShadowOffset[0]}px ${unitFontShadowOffset[1]}px ${unitFontShadowBlur}px ${unitFontShadowColor})`
  }else{
    unitShadow =`${unitFontShadowOffset[0]}px ${unitFontShadowOffset[1]}px ${unitFontShadowBlur}px ${unitFontShadowColor}`
    unitTextFillColor = 'unset'
    unitFilter = "unset"
  }

  return {
    textPosition: widget.getOption("text-align"),
    lineHeight: (widget.contentSize.height - 10) + "px",
    textPadding: widget.getOption("type") !== 'card' ? 0 + "px" : cardTextPadding + "px",
    fontColor: fontColor,
    fontSize: valueFont.size + "px",
    fontFamily: cardType.value === "lcd" ? "lcd" : valueFont.family || "sans-serif",
    fontWeight: valueFont.bold ? "bold" : "normal",
    fontStyle: valueFont.italic ? "italic" : "normal",
    fontSpacing: fontSpacing + "px",
    fontShadow: `${fontShadowOffset[0]}px ${fontShadowOffset[1]}px ${fontShadowBlur}px ${fontShadowColor}`,
    fontTextFillColor: fontTextFillColor,
    fontBackground: fontColor,

    unitFontColor: unitFontColor,
    unitFontSize: unitFont.size + "px",
    unitFontFamily: unitFont.family,
    unitFontWeight: unitFont.bold ? "bold" : "normal",
    unitFontStyle: unitFont.italic ? "italic" : "normal",
    unitOffsetX: -widget.getOption("unit-offsetX") + "px",
    unitOffsetY: widget.getOption("unit-offsetY") + "px",
    unitShadow,
    unitFilter,
    unitBackground: unitFontColor,
    unitTextFillColor: unitTextFillColor,
    cardMarginRight: widget.getOption("text-align") === "right" && widget.getOption("unit-text") ? widget.getOption("unit-offsetX") + "px" : "0px",
    cardFontShadowStyle
  }
}, (value, oldValue)=>{
  if (!equals(value, oldValue)) {
    cardStyle.value = value;
  }
}, {immediate: true});

let animationStartTimer = null;
let animationLoopTimer = null;
let animationDisplayTimer = null;
let animationDisplayStoped = false;

const clearDisplayAnimation = () => {
  clearTimeout(animationStartTimer);
  clearTimeout(animationLoopTimer);
  window.cancelAnimationFrame(animationDisplayTimer);
  animationDisplayStoped = true;
}
onMounted(()=>{
  watch(()=>valueText.value, (val, oldVal) => {
    if(val?.trim?.().length != oldVal?.trim?.().length){
      updateCardWidth(val);
    }
    valueParts.value = val.split("");
  }, { immediate: true });

  watch(()=>widget.getOption<OptionFileValue>("card-image"), (value)=>{
    if (value?.relativePath) {
      const projectId = widget.getBoard().projectId;
      cardImageUrl.value = `${projectId}/${value.relativePath}`;
    } else if (value?.url){
      cardImageUrl.value = value.url;
    } else{
      cardImageUrl.value = "";
    }
  }, { immediate: true })

  watch(()=>{
    return [
      widget.getOption("type"),
      widget.getOption("card-color"),
      widget.getOption("card-image"),
      widget.getOption("card-flag-background"),
      widget.getOption("font-spacing"),
      widget.getOption("text-align"),
      widget.getOption("font"),
      widget.getOption("unit-text"),
      widget.getOption("unit-font"),
      widget.contentSize
    ]
  }, debounce(()=>{
    updateCardWidth(valueText.value);
  }, 300), { immediate: true })

  const doAnimationFun = (anOption)=> {
    return new Promise<void>((resolve)=>{
      if(anOption["animationType"] === "count"){
        //从0递增
        let cardValue = widget.cardValue;
        let cardValueText = widget.getCartValueText(cardValue);
        let startTimestamp;
        let tempCardValue = Math.abs(cardValue);
        const animationDisplayFn = (timestamp)=> {
          if(!startTimestamp) startTimestamp = timestamp;
          let process = timestamp - startTimestamp;
          if(animationDisplayStoped){
            window.cancelAnimationFrame(animationDisplayTimer);
            return;
          }
          animationDisplayTimer = window.requestAnimationFrame(animationDisplayFn);

          let currentValue = Math.min(tempCardValue, tempCardValue / anOption["duration"] * process);
          let currentValueText = widget.getCartValueText(currentValue);
          let currentValueTextArr = currentValueText.split(".");

          let templateTextArr = cardValueText.replace(/\d/g, "0").split(".");
          let integerStr = currentValueTextArr[0].replace(/\s/g, "");
          let resultText = templateTextArr[0].slice(0, templateTextArr[0].length - integerStr.length) + integerStr;
          if(templateTextArr.length > 1){
            //小数
            let decimals = currentValueTextArr[1] ?? "";
            resultText = `${resultText}.${decimals.padEnd(templateTextArr[1].length,"0").slice(0,templateTextArr[1].length)}`;
          }

          valueText.value = resultText;

          if(process > anOption["duration"]) resolve();
        }
        animationDisplayTimer = window.requestAnimationFrame(animationDisplayFn);
      } else if (anOption["animationType"] === "update"){
        let startTimestamp;
        let from = anOption["from"];
        let to = anOption["to"];
        let difference = to - from;
        const animationDisplayFn = (timestamp)=> {
          if(!startTimestamp) startTimestamp = timestamp;
          let process = timestamp - startTimestamp || 1;
          if(animationDisplayStoped){
            window.cancelAnimationFrame(animationDisplayTimer);
            return;
          }
          animationDisplayTimer = window.requestAnimationFrame(animationDisplayFn);

          let currentValue = from + difference / anOption["duration"] * process;
          if(difference > 0){
            currentValue = Math.min(currentValue, to);
          }else{
            currentValue = Math.max(currentValue, to);
          }
          let currentValueText = widget.getCartValueText(currentValue);
          valueText.value = currentValueText;

          if(process > anOption["duration"]) resolve();
        }
        animationDisplayTimer = window.requestAnimationFrame(animationDisplayFn);
      }
    })
  }

  const startAnimationFun = (anOption) => {
    doAnimationFun(anOption).then(()=>{
      animationDisplayStoped = true;
      if(anOption.loop){
        animationLoopTimer = setTimeout(()=>{
          animationDisplayStoped = false;
          startAnimationFun(anOption);
        }, anOption.interval);
        return;
      }
    });
  }

  watch((() => {
    return {
      visible: widget.status.isVisible,
      on: widget.getOption("animation-display"),
      animationType: widget.getOption("animation-type"),
      delay: widget.getOption<number>("animation-delay") * 1000,
      duration: widget.getOption<number>("animation-duration") * 1000,
      loop: widget.getOption("animation-loop"),
      interval: widget.getOption<number>("animation-interval") * 1000,
      cardValueText: widget.cardValueText,
      cardValue: widget.cardValue,
      shouldAnimateCardValue: widget.shouldAnimateCardValue,
    };
  }), debounce((option, oldOption) => {
    if (!option.shouldAnimateCardValue) {
      clearDisplayAnimation();
      valueText.value = option.cardValueText;
      return;
    }
    clearDisplayAnimation();
    const shouldPlayRecoveryAnimation = Boolean(
      oldOption
      && !oldOption.shouldAnimateCardValue
      && option.visible
      && option.on
      && option.duration
    );
    if (shouldPlayRecoveryAnimation && option.animationType == "update") {
      option["loop"] = false;
      option["from"] = 0;
      option["to"] = option.cardValue;
    } else if(option.on && option.animationType == "update"){
      option["loop"] = false;
      option["from"] = oldOption?.cardValue ?? option.cardValue;
      option["to"] = option.cardValue;
    } else if (!shouldPlayRecoveryAnimation) {
      valueText.value = widget.getCartValueText(option.cardValue);
    }
    if(option.visible && option.on && option.duration){
      animationDisplayStoped = false;
      animationStartTimer = setTimeout(()=>{
        startAnimationFun(option);
      }, option.delay);
    }
  }, 300), { immediate: true })

  watch([() => widget.contentSize.width,() => cardWidth.value], ([widgetValue, cardWidthValue]) => {
    let cardValueNumber = parseInt(cardWidthValue.replace('px',''))
      if(widgetValue < cardValueNumber){
         cardPosition.value = 'static'
      }else{
        cardPosition.value = 'absolute'
      }
  })
});

onUnmounted(()=>{
  clearDisplayAnimation();
})
</script>

<style lang="scss" scoped>
.hover-pointer {
  cursor: pointer;
}
.card-box {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: v-bind("cardStyle.textPosition");
  .card-value {
    position: relative;
    width: v-bind("cardWidth");
    height: 100%;
    line-height: v-bind("cardStyle.lineHeight");
    letter-spacing: v-bind("cardStyle.fontSpacing");
    color: v-bind("cardStyle.fontColor");
    font-size: v-bind("cardStyle.fontSize");
    font-family: v-bind("cardStyle.fontFamily");
    font-weight: v-bind("cardStyle.fontWeight");
    font-style: v-bind("cardStyle.fontStyle");
    // text-shadow: v-bind("cardStyle.fontShadow");
    background: v-bind("cardBackground");
    margin-right:  v-bind("cardStyle.cardMarginRight");
    .card-part {
      display: inline-block;
      text-align: center;
      padding-left: v-bind("cardStyle.textPadding");
      width: calc(v-bind(maxTextWidth) + v-bind("cardStyle.fontSpacing"));
      font-family: v-bind("cardStyle.fontFamily");
      // text-shadow: v-bind("cardStyle.fontShadow");
      background: v-bind("cardStyle.fontBackground");
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: v-bind("cardStyle.fontTextFillColor");
    }
    .card-text{
      padding: v-bind("cardStyle.textPadding");
      font-family: v-bind("cardStyle.fontFamily");
      background: v-bind("cardStyle.fontBackground");
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: v-bind("cardStyle.fontTextFillColor");
    }
    &::after{
      content: attr(data-unit);
      position: v-bind("cardPosition");
      top: v-bind("cardStyle.unitOffsetY");
      right: v-bind("cardStyle.unitOffsetX");
      letter-spacing: normal;
      color: v-bind("cardStyle.unitFontColor");
      font-size: v-bind("cardStyle.unitFontSize");
      font-family: v-bind("cardStyle.unitFontFamily");
      font-weight: v-bind("cardStyle.unitFontWeight");
      font-style: v-bind("cardStyle.unitFontStyle");
      text-shadow: v-bind("cardStyle.unitShadow");
      background: v-bind("cardStyle.unitBackground");
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: v-bind('cardStyle.unitTextFillColor');
      filter: v-bind("cardStyle.unitFilter");
    }
  }
}
</style>
