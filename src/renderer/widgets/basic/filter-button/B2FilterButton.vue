<template>
  <b2-widget class="button">
    <div class="button-container" :style="paddingStyle">
      <div ref="buttonDiv" :class="['FilterButton', buttonDivClass, gradientStyle, divClass]" @click="handleSelect" @mousedown="handleDown" @mouseup="handleUp" :style="[widget.paddingStyle, {'pointer-events': eventType} as any, defaultButtonStyle]">
        <p :class="pClass" v-if="!editing" style="-webkit-background-clip:text;background-clip:text;display: flex;align-items: center;">
          <el-icon>
            <i-ven-icon-widget-basic-filter-button-filter style="fill: currentColor;" />
          </el-icon>
          {{ widget.textValue }}
        </p>
        <input ref="textInput" v-model="inputValue" v-else @click.stop="" @mousedown.stop=""
          @keydown.enter.stop="textInput.blur" @change="textInput.blur" @blur="updateText" />
      </div>
      <div ref="deleteButtonRef" :class="['button-delete', deleteButtonClass, deleteDivClass]" @click="handleDelete" @mousedown="handleDeleteDown" @mouseup="handleDeleteUp" :style="defaultButtonStyle">
        <el-icon :class="pClass"><i-ep-delete /></el-icon>
      </div>
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { useMouseInElement } from "@vueuse/core";
import { useWidget, OptionFontValue, OptionFileValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { equals } from "@common/utils/object";
import { computed, onMounted,ref, watch, nextTick } from "vue";
import { FilterButton } from "./filter-button";
import { ElMessage } from 'element-plus';
import IEpDelete from '~icons/ep/delete';
import i18next, { $t } from "@renderer/widgets/i18next";
import IVenIconFilter from "~icons/ven-icon/widget-basic-filter-button-filter"
const widget = useWidget<FilterButton>();
const buttonDiv = ref(null);
const deleteButtonRef = ref(null);
const { isOutside } = useMouseInElement(buttonDiv);
const { isOutside: isDeleteButtonOutside } = useMouseInElement(deleteButtonRef);
let ripple = ref(null);
let divClass = ref("");
let deleteDivClass = ref("");
let pClass = ref("p");
let eventType = ref("none")
let hoverType = true;
let aid = null;
let changeType = false;


const paddingStyle = computed(()=>{
  let paddingTop = widget.getOption<string>("padding-top") == "auto" ? 4 : widget.getOption<number>("padding-top-diy");
  let paddingRight = widget.getOption<string>("padding-right") == "auto" ? 8 : widget.getOption<number>("padding-right-diy");
  let paddingBottom = widget.getOption<string>("padding-bottom") == "auto" ? 10 : widget.getOption<number>("padding-bottom-diy");
  let paddingLeft = widget.getOption<string>("padding-left") == "auto" ? 8 : widget.getOption<number>("padding-left-diy");
  return {
    paddingTop: `${paddingTop}px`,
    paddingBottom: `${paddingBottom}px`,
    paddingLeft: `${paddingLeft}px`,
    paddingRight: `${paddingRight}px`,
  }
})

// 状态计算函数（确保排列方式参数为字符串）
const getButtonStateClass = (isHover: boolean, isSelected: boolean, arrangement: string) => {
  const arr = String(arrangement);
  if (isSelected && widget.getOption("show-select")) {
    return arr === "vertical" ? "vertical select" : "select";
  }
  if (isHover) {
    return arr === "vertical" ? "vertical hover" : "hover";
  }
  return arr === "vertical" ? "vertical" : "";
};

// buttonDiv 状态管理（增加对排列方式变化的监听）
const buttonDivClass = ref("");
watch(() => ({
  isHover: !isOutside.value,
  isSelected: widget.isSelected,
  arrangement: widget.getOption<string>("text-arrangement")
}), (state) => {
  buttonDivClass.value = getButtonStateClass(state.isHover, state.isSelected, state.arrangement);
}, { immediate: true });

// deleteButton 状态管理（增加对排列方式变化的监听）
const deleteButtonClass = ref("");
watch(() => ({
  isHover: !isDeleteButtonOutside.value,
  isSelected: widget.isSelected,
  arrangement: widget.getOption<string>("text-arrangement")
}), (state) => {
  deleteButtonClass.value = getButtonStateClass(state.isHover, state.isSelected, state.arrangement);
}, { immediate: true });

onMounted(() => {
  // 移除原有对 divClass 的多状态监听，改用统一状态函数
  watch(() => ({
    arrangement: widget.getOption("text-arrangement"),
    isSelected: widget.isSelected
  }), (option) => {
    // 仅更新垂直/水平布局相关状态
    if (option.isSelected && widget.getOption("show-select")) {
      pClass.value = "p select";
    } else {
      pClass.value = "p";
    }
  }, { immediate: true });

  watch((()=>{
    return {
      visible:widget.status.isVisible,
      selected:widget.status.isSelected,
      isPlay:widget?.getBoard()?.status?.isPlaying,
      isEditable:widget?.getBoard()?.status?.isEditable,
      isSelected:widget.isSelected
    }
  }),(option)=>{
    if(option.isEditable && (option.isPlay ||  option.selected) || !option.isEditable){
      eventType.value = "all";
    } else {
      eventType.value = "none";
    }
    if (option.isSelected && widget.getOption("show-select")) {
      pClass.value = "p select";
      divClass.value = widget.getOption("text-arrangement") === "vertical" ? "vertical select" : "select";
    }else{
      pClass.value = "p";
      divClass.value = widget.getOption("text-arrangement") === "vertical" ? "vertical" : "";
    }
  },{deep:true,immediate:true});

  watch(()=>{
    return {
      arrangement:widget.getOption("text-arrangement")
    }
  },(option)=>{
    if(widget.isSelected){
      divClass.value = option.arrangement === "vertical" ? "vertical select" : "select";
    }else{
      divClass.value = option.arrangement === "vertical" ? "vertical" : "";
    }
  },{immediate:true})

  // enter触发动画，leave不停止动画
  watch(isOutside,(value,oldValue)=>{
    if(widget.getOption("show-select") && !widget.getOption("show-hover")) return;
    if(!isOutside.value && hoverType && (widget.status.isSelected || widget?.getBoard()?.status?.isPlaying)){
      divClass.value =  widget.getOption("text-arrangement") === "vertical" ? "vertical hover" : "hover";
      pClass.value ="p hover";
      widget.getOption("show-hover") ? animation("hover",false) : "";
    }else{
      divClass.value =  widget.getOption("text-arrangement") === "vertical" ? "vertical" : "";
      pClass.value =  "p";
      if (widget.isSelected && widget.getOption("show-select")) {
        pClass.value = "p select";
        divClass.value = widget.getOption("text-arrangement") === "vertical" ? "vertical select" : "select";
      }
    }
  },{immediate:true});

  watch((()=>{
    return {
      clickType:widget.getOption("show-click"),
    }
  }),(option,oldOption)=>{
    if(option.clickType !== oldOption.clickType){
      widget.cloneStyle("click")
    }
  });

  watch(()=>{
    return {
      defaultPosition:widget.getOption("text-default-position"),
      defaultVertical:widget.getOption("text-default-vertical"),
      clickPosition:widget.getOption("text-click-position"),
      clickVertical:widget.getOption("text-click-vertical"),
      hoverPosition:widget.getOption("text-hover-position"),
      hoverVertical:widget.getOption("text-hover-vertical"),
      selectPosition:widget.getOption("text-select-position"),
      selectVertical:widget.getOption("text-select-vertical"),
    }
  },(value,oldVlaue)=>{
    if((value.defaultPosition !== oldVlaue?.defaultPosition) || (value.defaultVertical !== oldVlaue?.defaultVertical)){
      widget.setOption("text-offset-default",[0,0]);
    }
    if(value.clickPosition !== oldVlaue?.clickPosition || value.clickVertical !== oldVlaue?.clickVertical){
      widget.setOption("text-offset-click",[0,0]);
    }
    if(value.hoverPosition !== oldVlaue?.hoverPosition || value.hoverVertical !== oldVlaue?.hoverVertical){
      widget.setOption("text-offset-hover",[0,0]);
    }
    if(value.selectPosition !== oldVlaue?.selectPosition || value.selectVertical !== oldVlaue?.selectVertical){
      widget.setOption("text-offset-select",[0,0]);
    }
  })


  watch((()=>{
    return {
      hoverType:widget.getOption("show-hover"),
    }
  }),(option,oldOption)=>{
    if(option.hoverType !== oldOption?.hoverType){
      widget.cloneStyle("hover")
    }
  })

  watch((()=>{
    return {
      selectType:widget.getOption("show-select"),
    }
  }),(option,oldOption)=>{
    if(option.selectType !== oldOption?.selectType){
      widget.cloneStyle("select")
    }
  })

  //开启了默认选中设置
  let watchInit = watch(() => {
    return {
      ready: widget.getBoard().status.isProjectReady,
      visible: widget.status.isVisible,
      checked: widget.getOption("checked")
    }
  }, async (val, oldVal) => {
    if (val.ready && val.visible && val.checked) {
      handleSelect()
      await nextTick();
      watchInit();
    }
  }, { immediate: true })

  watch(()=>{
    return {
      checked: widget.getOption("checked"),
      showSelect: widget.getOption("show-select"),
    }
  }, (option, oldOption)=>{
    if(equals(option, oldOption) || !option.checked) return;
    if(!option.showSelect && option.showSelect !== oldOption?.showSelect){
      // 样式设置【选中后】设置项改变
      widget.setOption("checked", false);
      return
    }
    if(!option.showSelect){
      ElMessage({type: "warning", message: i18next.t("warningText")});
      widget.setOption("checked", false);
    }
  },)
})

let editing = ref(false);
const textInput = ref(null);

const inputValue = ref("");
const handleDbClick = () => {
  if (widget.isPlaying) return;
  if (editing.value) return;
  editing.value = true;
  inputValue.value = widget.textValue || "";

  nextTick(() => {
    textInput.value.focus();
    textInput.value.select();
  })
}

const updateText = () => {
  if(inputValue.value !== widget.textValue) widget.setOption("text", inputValue.value);
  editing.value = false;
  inputValue.value = "";
}

const animation = (type:string,flag:boolean)=>{
  let showAnimate = widget.getOption(`animation-${type}-show`);
  let animateType = widget.getOption(`animation-${type}-type`);
  let animateTime = widget.getOption(`animation-${type}-time`) as number * 1000;
  let size = Math.max(widget.contentSize.width,widget.contentSize.height);
  let scale = 0;
  let start;
  if(aid){
    window.cancelAnimationFrame(aid);
    aid = undefined;
  }
  let step = (timestamp)=>{
    if(!showAnimate || flag){
      window.cancelAnimationFrame(aid);
      aid = undefined;
      ripple.value.style.transform =`translate(-50%, -50%) scale(0)`
      return;
    }
    if(!changeType && aid){ //hover中点击时重置事件和水波纹缩放
      window.cancelAnimationFrame(aid);
      aid = undefined;
      ripple.value.style.transform =`translate(-50%, -50%) scale(0)`;
      scale = 0;
      start = timestamp;
      changeType = true;
    }
    if(!start) start = timestamp;
    if(ripple.value?.style){
      ripple.value.style.transform =`translate(-50%, -50%) scale(${scale})`
    }

    scale += (16.67*(size/10+10))/animateTime; //缩放倍数比原来大10
    if(timestamp - start > animateTime){
      window.cancelAnimationFrame(aid);
      ripple.value.style.transform =`translate(-50%, -50%) scale(0)`
      aid = undefined;
      return;
    }else{
      aid = window.requestAnimationFrame(step)
    }
  }
  aid = window.requestAnimationFrame(step)
}


// down触发动画，鼠标移出或up不主动结束动画
const handleDown = (event)=>{
  changeType = false;
  hoverType = false;
  divClass.value =  widget.getOption("text-arrangement") === "vertical" ? "vertical click" : "click";
  pClass.value = "p click";
  widget.getOption("show-click") ? animation("click",false) : animation("click",true);
}
const handleUp = (event)=>{
  divClass.value =  widget.getOption("text-arrangement") === "vertical" ? "vertical" : "";
  pClass.value =  "p";
  hoverType = true;
  // if(widget.isSelected && widget.getOption("show-select")){
  //   pClass.value = "p select";
  //   divClass.value =  widget.getOption("text-arrangement") === "vertical" ? "vertical select" : "select";
  // }
}

const handleDeleteDown = (event)=>{
  deleteDivClass.value =  "click";
}

const handleDeleteUp = (event)=>{
  deleteDivClass.value = "";
}

const handleSelect = ()=>{
  widget.toggleSelect(true);
}

const handleDelete = () => {
  widget.toggleSelect(false);
}

type BgType = "gradient-default" | "gradient-hover" | "gradient-click" | "gradient-select";
const gradient = ref<BgType[]>([]);
const gradientStyle = computed(() => gradient.value.join(" "));
const itemStyle = ref<any>({});
watch(()=>{
  let itemStyle = {}
  let showClick = widget.getOption("show-click");
  let showHover = widget.getOption("show-hover");
  let showSelect = widget.getOption("show-select")
    const getStyleByState = (type: "default" | "hover" | "click" | "select" ) =>{
        let styleInfo = {};
        let fontStyle = widget.getOption<OptionFontValue>(`text-default-font`);
        let color = widget.toCssColor(fontStyle.color as any);
        let size = fontStyle.size;
        let family = fontStyle.family;
        let italic = fontStyle.italic ? "italic" : "normal";
        let bold = fontStyle.bold ? "bold" : "normal";
        let spacing = widget.getOption<number>(`font-default-spacing`);
        let indent = widget.getOption<number>(`text-default-indent`);
        let shadowColor = widget.toCssColor(widget.getOption(`font-default-shadow-color`));
        let shadowBlur = widget.getOption(`font-default-shadow-blur`);
        let shadow = widget.getOption(`font-default-shadow-offset`);
        let textPosition = widget.getOption(`text-default-position`);
        let textVertical = widget.getOption(`text-arrangement`);
        let textVerticals = widget.getOption(`text-default-vertical`);
        let textBorderColor = widget.getOption("border-default-color");
        let textBorderWidth = widget.getOption("border-default-width");
        let textBorderRadius = widget.getOption("border-default-radius");
        let textBorderStyle = widget.getOption("border-default-style");
        // let backgroundColor = widget.toCssColor(widget.getOption(`background-default-setting-color`));
        let backgroundColor = widget.toCssColor(widget.getOption(`background-default-color`));
        let backgroundImage = widget.getOption<OptionFileValue>("background-default-image");
        let background_Fill_Type = widget.getOption("background-default-fill-type");
        let backgroundBlur = widget.getOption<number>("background-default-blur");
        let textOffset =  widget.getOption(`text-offset-default`);
        let patch = widget.getOption(`use-nine-patch-default`);
        let backgroundScale = widget.getOption("background-image-scale-default");
        let backgroundPosition = widget.getOption("background-image-position-default")
        let indentDiff = 0;
        let marginRight = 0;
        let bgImageUrl = "";

        if(backgroundColor.includes("linear-gradient")) {
          if(!gradient.value.includes("gradient-default")) {
            gradient.value.push("gradient-default")
          }
        } else {
          if(gradient.value.includes("gradient-default")) {
            gradient.value = gradient.value.filter(item => item !== "gradient-default")
          }
        }

      if( type === "click" && showClick){
         fontStyle = widget.getOption<OptionFontValue>(`text-${type}-font`)
         color =widget.toCssColor(fontStyle.color as any);
         size = fontStyle.size;
         family = fontStyle.family;
         italic = fontStyle.italic ? "italic" : "normal";
         bold = fontStyle.bold ? "bold" : "normal";
         spacing = widget.getOption<number>(`font-${type}-spacing`);
         indent =  widget.getOption<number>(`text-${type}-indent`);
         shadowColor = widget.toCssColor(widget.getOption(`font-${type}-shadow-color`));
         shadowBlur =  widget.getOption(`font-${type}-shadow-blur`);
         shadow =  widget.getOption(`font-${type}-shadow-offset`);
         textPosition =  widget.getOption(`text-${type}-position`);
         textVerticals =  widget.getOption(`text-${type}-vertical`);
         textBorderColor = widget.getOption(`border-${type}-color`);
         textBorderWidth = widget.getOption(`border-${type}-width`);
         textBorderRadius = widget.getOption(`border-${type}-radius`);
         textBorderStyle = widget.getOption(`border-${type}-style`);
         backgroundColor = widget.toCssColor(widget.getOption(`background-${type}-color`));
         backgroundImage = widget.getOption<OptionFileValue>(`background-${type}-image`);
         background_Fill_Type = widget.getOption(`background-${type}-fill-type`);
         backgroundBlur = widget.getOption(`background-${type}-blur`);
         textOffset =  widget.getOption(`text-offset-${type}`);
         patch = widget.getOption(`use-nine-patch-${type}`);
         backgroundScale = widget.getOption(`background-image-scale-${type}`);
         backgroundPosition = widget.getOption(`background-image-position-${type}`);
         indentDiff = 0;
         marginRight = 0;


        if(backgroundColor.includes("linear-gradient")) {
          if(!gradient.value.includes("gradient-click")) {
            gradient.value.push("gradient-click")
          }
        } else {
          if(gradient.value.includes("gradient-click")) {
            gradient.value = gradient.value.filter(item => item !== "gradient-click")
          }
        }

      }else if(type === "hover" && showHover){
         fontStyle = widget.getOption<OptionFontValue>(`text-${type}-font`)
         color =widget.toCssColor(fontStyle.color as any);
         size = fontStyle.size;
         family = fontStyle.family;
         italic = fontStyle.italic ? "italic" : "normal";
         bold = fontStyle.bold ? "bold" : "normal";
         spacing = widget.getOption<number>(`font-${type}-spacing`);
         indent =  widget.getOption<number>(`text-${type}-indent`);
         shadowColor = widget.toCssColor(widget.getOption(`font-${type}-shadow-color`));
         shadowBlur =  widget.getOption(`font-${type}-shadow-blur`);
         shadow =  widget.getOption(`font-${type}-shadow-offset`);
         textPosition =  widget.getOption(`text-${type}-position`);
         textVerticals =  widget.getOption(`text-${type}-vertical`);
         textBorderColor = widget.getOption(`border-${type}-color`);
         textBorderWidth = widget.getOption(`border-${type}-width`);
         textBorderRadius = widget.getOption(`border-${type}-radius`);
         textBorderStyle = widget.getOption(`border-${type}-style`);
         backgroundColor = widget.toCssColor(widget.getOption(`background-${type}-color`));
         backgroundImage = widget.getOption<OptionFileValue>(`background-${type}-image`);
         background_Fill_Type = widget.getOption(`background-${type}-fill-type`);
         backgroundBlur = widget.getOption(`background-${type}-blur`);
         textOffset =  widget.getOption(`text-offset-${type}`);
         patch = widget.getOption(`use-nine-patch-${type}`);
         backgroundScale = widget.getOption(`background-image-scale-${type}`);
         backgroundPosition = widget.getOption(`background-image-position-${type}`);
         indentDiff = 0;
         marginRight = 0;

        if(backgroundColor.includes("linear-gradient")) {
          if(!gradient.value.includes("gradient-hover")) {
            gradient.value.push("gradient-hover")
          }
        } else {
          if(gradient.value.includes("gradient-hover")) {
            gradient.value = gradient.value.filter(item => item !== "gradient-hover")
          }
        }
      }else if(type === "select" && showSelect){
         fontStyle = widget.getOption<OptionFontValue>(`text-${type}-font`)
         color =widget.toCssColor(fontStyle.color as any);
         size = fontStyle.size;
         family = fontStyle.family;
         italic = fontStyle.italic ? "italic" : "normal";
         bold = fontStyle.bold ? "bold" : "normal";
         spacing = widget.getOption<number>(`font-${type}-spacing`);
         indent =  widget.getOption<number>(`text-${type}-indent`);
         shadowColor = widget.toCssColor(widget.getOption(`font-${type}-shadow-color`));
         shadowBlur =  widget.getOption(`font-${type}-shadow-blur`);
         shadow =  widget.getOption(`font-${type}-shadow-offset`);
         textPosition =  widget.getOption(`text-${type}-position`);
         textVerticals =  widget.getOption(`text-${type}-vertical`);
         textBorderColor = widget.getOption(`border-${type}-color`);
         textBorderWidth = widget.getOption(`border-${type}-width`);
         textBorderRadius = widget.getOption(`border-${type}-radius`);
         textBorderStyle = widget.getOption(`border-${type}-style`);
         backgroundColor = widget.toCssColor(widget.getOption(`background-${type}-color`));
         backgroundImage = widget.getOption<OptionFileValue>(`background-${type}-image`);
         background_Fill_Type = widget.getOption(`background-${type}-fill-type`);
         backgroundBlur = widget.getOption(`background-${type}-blur`);
         textOffset =  widget.getOption(`text-offset-${type}`);
         patch = widget.getOption(`use-nine-patch-${type}`);
         backgroundScale = widget.getOption(`background-image-scale-${type}`);
         backgroundPosition = widget.getOption(`background-image-position-${type}`);
         indentDiff = 0;
         marginRight = 0;

        if(backgroundColor.includes("linear-gradient")) {
          if(!gradient.value.includes("gradient-select")) {
            gradient.value.push("gradient-select")
          }
        } else {
          if(gradient.value.includes("gradient-select")) {
            gradient.value = gradient.value.filter(item => item !== "gradient-select")
          }
        }
      }

      if(textVertical === "vertical" && textPosition === "start"){
        textPosition = "end"
      }else if(textVertical === "vertical" && textPosition === "end"){
        textPosition = "start"
      }

      if(textVertical === "vertical" && textPosition === "left"){
        textPosition = 'end'
      }

      if(textPosition === "center" && textVertical === "horizontal") {
          indentDiff = spacing;
        }else if(textPosition === "right" && textVertical === "horizontal"){
          marginRight = -spacing - indent ;
        }else if(textPosition === "right"){
          let offset = 0;
          if(italic === 'italic'){
            offset = size*0.15
          }
          marginRight = -spacing - indent  + offset ;
        }
      if (new Color(fontStyle.color).isGradient()) {
        styleInfo [`background${type}`] = color;
        styleInfo [`color${type}`] = "transparent";
      } else {
        styleInfo [ `color${type}`] = color;
      }

      if(fontStyle.underline || fontStyle["line-through"]) {
        styleInfo [ `textDecoration${type}`] = `${fontStyle.underline ? "underline" : ""} ${fontStyle["line-through"] ? "line-through" : ""}`;
        styleInfo [ `textUnderlineOffset${type}`] = `${size / 5}px`;
      }
      if(backgroundImage?.url){
        bgImageUrl = backgroundImage?.url
      }else if(backgroundImage?.relativePath){
        bgImageUrl = `${widget.projectId}/${(backgroundImage as any)?.relativePath}`
      }
      if(bgImageUrl){
        if(background_Fill_Type == "tile"){
          styleInfo[ `backgroundImage${type}`] = `url(${bgImageUrl})`;
          styleInfo[ `backgroundSize${type}`] = "";
        }else if(background_Fill_Type == "stretch"){
          if(patch){
            let ninePatch:any = widget.getOption(`nine-patch-default`) || { top: 0, right: 0, bottom: 0, left: 0 };
            if(showClick && type === "click"){ninePatch = widget.getOption(`nine-patch-click`)}
            if(showHover && type === "hover"){ninePatch = widget.getOption(`nine-patch-hover`)}
            const { top, right, bottom, left } = ninePatch;
            styleInfo[`borderImageSource${type}`] = `url('${bgImageUrl}')`;
            styleInfo[`borderImageSlice${type}`] = `${top}% ${right}% ${bottom}% ${left}% fill`;
            styleInfo[`borderImageWidth${type}`] = "auto";
          }else{
            styleInfo[ `backgroundImage${type}`] = `url('${bgImageUrl}')`;
          }
            styleInfo[ `backgroundSize${type}`] ='100% 100%';
        }else if(background_Fill_Type == "none"){
            styleInfo[ `backgroundImage${type}`] = `url(${bgImageUrl})`;
            styleInfo[ `backgroundSize${type}`] = `${backgroundScale}%`;
        }
      }
      if((textPosition === "left" && textVerticals === "start") || (textPosition === "left" && textVerticals === "center") || (textPosition === "center" && textVerticals === "center") || (textPosition === "center" && textVerticals === "start")){
        styleInfo[`textLeft${type}`] = `${textOffset[1]}px 0px 0px ${textOffset[0]}px`;
      }else if((textPosition === "right" && textVerticals === "start") || (textPosition === "right" && textVerticals === "center")){
        styleInfo[`textLeft${type}`] = `${textOffset[1]}px ${textOffset[0]}px 0px 0px`;
      }else if((textPosition === "left" && textVerticals === "end") || (textPosition === "center" && textVerticals === "end")){
        styleInfo[`textLeft${type}`] = `0px 0px ${textOffset[1]}px ${textOffset[0]}px`;
      }else if((textPosition === "right" && textVerticals === "end")){
        styleInfo[`textLeft${type}`] = `0px ${textOffset[0]}px ${textOffset[1]}px 0px`;
      }
      styleInfo[`backgroundImageGradient${type}`] = styleInfo[`backgroundImage${type}`] ? `${backgroundColor}, ${styleInfo[`backgroundImage${type}`]}` : backgroundColor;
      styleInfo[ `backgroundColor${type}`] = backgroundColor;
      styleInfo[ `backgroundRepeat${type}`] = background_Fill_Type === "tile" ? 'repeat' : 'no-repeat';
      styleInfo[ `backgroundPosition${type}`] = background_Fill_Type === "none" ? `${backgroundPosition[0]}px ${backgroundPosition[1]}px` : "0 0";
      styleInfo[ `backgroundBlur${type}`] = backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : `none`;
      styleInfo[ `fontSize${type}`] = size + "px";
      styleInfo[ `fontFamily${type}`] = family;
      styleInfo[ `fontStyle${type}`] = italic;
      styleInfo[ `letterSpacing${type}`] = spacing+"px";
      styleInfo[ `fontWeight${type}`] = bold;
      styleInfo[ `marginRight${type}`] = marginRight+"px";
      styleInfo[ `textIndent${type}`] = indent + indentDiff+"px";
      styleInfo[ `textShadow${type}`] = `${shadow?.[0]}px ${shadow?.[1]}px ${shadowBlur}px ${shadowColor}`;
      styleInfo[ `justifyContent${type}`] = textPosition;
      styleInfo[ `alignItems${type}`] = textVerticals;
      styleInfo[ `border${type}`] = `${textBorderWidth}px ${textBorderStyle} ${textBorderColor}`;
      styleInfo[ `borderRadius${type}`] = textBorderRadius+"px"
      return styleInfo;
    }

    itemStyle = {
      arrangement: widget.getOption("text-arrangement") === "vertical" ? "column" : "row",
      ...getStyleByState("default"),
      ...getStyleByState("hover"),
      ...getStyleByState("click"),
      ...getStyleByState("select")
    }
  return itemStyle
}, (value, oldValue)=>{
  if (!equals(value, oldValue)) {
    itemStyle.value = value;
  }
}, {immediate: true});

const inputTextAlign = ref("");
watch(()=>{
  if(widget.getOption("text-arrangement") === "vertical") {
    let pisitionMap = {
      "top": "left",
      "center": "center",
      "bottom": "right"
    }
    return pisitionMap[widget.getOption<string>("text-default-vertical")];
  } else {
    return widget.getOption("text-default-position");
  }
}, (value)=>{
  if (inputTextAlign.value !== value) {
    inputTextAlign.value = value;
  }
}, {immediate: true});

const defaultButtonStyle = computed(() => {
  return {
    '--background-default-hover': widget.getOption("show-hover") ?  itemStyle.value.backgroundColorhover : "#3593ff",
    '--background-default-click': widget.getOption("show-click") ?  itemStyle.value.backgroundColorclick : "#0557d2",
    '--background-default-select': widget.getOption("show-select") ?  itemStyle.value.backgroundColorselect : "#0557d2",
  }
})
</script>

<style lang="scss" scoped>
.button{
  :deep(.background){
    border: none !important;
  }

  :deep(.button-container) {
    display: flex;
    flex-direction: v-bind("itemStyle.arrangement");
  }
}

.FilterButton{
  flex: 1;
  height: 32px;
  position: relative;
  display: flex;
  border: v-bind("itemStyle.borderdefault");
  border-radius: v-bind("`${itemStyle.borderRadiusdefault} 0 0 ${itemStyle.borderRadiusdefault}`");
  justify-content: v-bind("itemStyle.justifyContentdefault");
  align-items: v-bind("itemStyle.alignItemsdefault");
  background-color: v-bind("itemStyle.backgroundColordefault");
  background-repeat: v-bind("itemStyle.backgroundRepeatdefault");
  background-size: v-bind("itemStyle.backgroundSizedefault");
  background-image: v-bind("itemStyle.backgroundImagedefault");
  backdrop-filter:v-bind("itemStyle.backgroundBlurdefault");
  border-image-source: v-bind("itemStyle.borderImageSourcedefault");
  border-image-slice: v-bind("itemStyle.borderImageSlicedefault");
  border-image-width: v-bind("itemStyle.borderImageWidthdefault");
  background-position: v-bind("itemStyle.backgroundPositiondefault");

  &.gradient-default {
    background-color: transparent;
    background-image: v-bind("itemStyle.backgroundImageGradientdefault");
  }

  &.hover{
    cursor:pointer;
    justify-content: v-bind("itemStyle.justifyContenthover");
    align-items: v-bind("itemStyle.alignItemshover");
    border: v-bind("itemStyle.borderhover");
    border-radius: v-bind("`${itemStyle.borderRadiushover} 0 0 ${itemStyle.borderRadiushover}`");
    background-color: var(--background-default-hover);
    background-repeat: v-bind("itemStyle.backgroundRepeathover");
    background-size: v-bind("itemStyle.backgroundSizehover");
    background-image: v-bind("itemStyle.backgroundImagehover");
    backdrop-filter:v-bind("itemStyle.backgroundBlurhover");
    border-image-source: v-bind("itemStyle.borderImageSourcehover");
    border-image-slice: v-bind("itemStyle.borderImageSlicehover");
    border-image-width: v-bind("itemStyle.borderImageWidthhover");
    background-position: v-bind("itemStyle.backgroundPositionhover");
    &.gradient-hover {
      background-color: transparent;
      background-image: v-bind("itemStyle.backgroundImageGradienthover");
    }
  }
  &.click{
    justify-content: v-bind("itemStyle.justifyContentclick");
    align-items: v-bind("itemStyle.alignItemsclick");
    border: v-bind("itemStyle.borderclick");
    border-radius: v-bind("`${itemStyle.borderRadiusclick} 0 0 ${itemStyle.borderRadiusclick}`");
    background-color: var(--background-default-click);
    background-repeat: v-bind("itemStyle.backgroundRepeatclick");
    background-size: v-bind("itemStyle.backgroundSizeclick");
    background-image: v-bind("itemStyle.backgroundImageclick");
    backdrop-filter:v-bind("itemStyle.backgroundBlurclick");
    border-image-source: v-bind("itemStyle.borderImageSourceclick");
    border-image-slice: v-bind("itemStyle.borderImageSliceclick");
    border-image-width: v-bind("itemStyle.borderImageWidthclick");
    background-position: v-bind("itemStyle.backgroundPositionclick");

    &.gradient-click {
      background-color: transparent;
      background-image: v-bind("itemStyle.backgroundImageGradientclick");
    }
  }
  &.select {
    cursor: pointer;
    justify-content: v-bind("itemStyle.justifyContentselect");
    align-items: v-bind("itemStyle.alignItemsselect");
    border: v-bind("itemStyle.borderselect");
    border-radius: v-bind("`${itemStyle.borderRadiusselect} 0 0 ${itemStyle.borderRadiusselect}`");
    background-color: var(--background-default-select);
    background-repeat: v-bind("itemStyle.backgroundRepeatselect");
    background-size: v-bind("itemStyle.backgroundSizeselect");
    background-image: v-bind("itemStyle.backgroundImageselect");
    backdrop-filter: v-bind("itemStyle.backgroundBlurselect");
    border-image-source: v-bind("itemStyle.borderImageSourceselect");
    border-image-slice: v-bind("itemStyle.borderImageSliceselect");
    border-image-width: v-bind("itemStyle.borderImageWidthselect");
    background-position: v-bind("itemStyle.backgroundPositionselect");
      &.gradient-select {
        background-color: transparent;
        background-image: v-bind("itemStyle.backgroundImageGradientselect");
      }
    }
  &.vertical {
    writing-mode: tb-rl;
    text-orientation: upright;
    justify-content: v-bind("itemStyle.alignItemsdefault");
    align-items: v-bind("itemStyle.justifyContentdefault");
    background-color: v-bind("itemStyle.backgroundColordefault");
    background-repeat: v-bind("itemStyle.backgroundRepeatdefault");
    background-size: v-bind("itemStyle.backgroundSizedefault");
    background-image: v-bind("itemStyle.backgroundImagedefault");
    backdrop-filter:v-bind("itemStyle.backgroundBlurdefault");
    border-radius: v-bind("`${itemStyle.borderRadiusdefault} ${itemStyle.borderRadiusdefault} 0 0`");
    border-image-source: v-bind("itemStyle.borderImageSourcedefault");
    border-image-slice: v-bind("itemStyle.borderImageSlicedefault");
    border-image-width: v-bind("itemStyle.borderImageWidthdefault");
    background-position: v-bind("itemStyle.backgroundPositiondefault");

    &.gradient-default {
      background-color: transparent;
      background-image: v-bind("itemStyle.backgroundImageGradientdefault");
    }

    &.click{
      justify-content: v-bind("itemStyle.alignItemsclick");
      align-items: v-bind("itemStyle.justifyContentclick");
      border: v-bind("itemStyle.borderclick");
      border-radius: v-bind("`${itemStyle.borderRadiusclick} ${itemStyle.borderRadiusclick} 0 0`");
      background-color: v-bind("itemStyle.backgroundColorclick");
      background-repeat: v-bind("itemStyle.backgroundRepeatclick");
      background-size: v-bind("itemStyle.backgroundSizeclick");
      background-image: v-bind("itemStyle.backgroundImageclick");
      backdrop-filter:v-bind("itemStyle.backgroundBlurclick");
      border-image-source: v-bind("itemStyle.borderImageSourceclick");
      border-image-slice: v-bind("itemStyle.borderImageSliceclick");
      border-image-width: v-bind("itemStyle.borderImageWidthclick");
      background-position: v-bind("itemStyle.backgroundPositionclick");
      &.gradient-click {
        background-color: transparent;
        background-image: v-bind("itemStyle.backgroundImageGradientclick");
      }
    }
    &.hover{
      cursor:pointer;
      justify-content: v-bind("itemStyle.alignItemshover");
      align-items: v-bind("itemStyle.justifyContenthover");
      border: v-bind("itemStyle.borderhover");
      border-radius: v-bind("`${itemStyle.borderRadiushover} ${itemStyle.borderRadiushover} 0 0`");
      background-color: v-bind("itemStyle.backgroundColorhover");
      background-repeat: v-bind("itemStyle.backgroundRepeathover");
      background-size: v-bind("itemStyle.backgroundSizehover");
      background-image: v-bind("itemStyle.backgroundImagehover");
      backdrop-filter:v-bind("itemStyle.backgroundBlurhover");
      border-image-source: v-bind("itemStyle.borderImageSourcehover");
      border-image-slice: v-bind("itemStyle.borderImageSlicehover");
      border-image-width: v-bind("itemStyle.borderImageWidthhover");
      background-position: v-bind("itemStyle.backgroundPositionhover");

      &.gradient-hover {
        background-color: transparent;
        background-image: v-bind("itemStyle.backgroundImageGradienthover");
      }
    }
    &.select{
      cursor:pointer;
      justify-content: v-bind("itemStyle.alignItemsselect");
      align-items: v-bind("itemStyle.justifyContentselect");
      border: v-bind("itemStyle.borderselect");
      border-radius: v-bind("`${itemStyle.borderRadiusselect} ${itemStyle.borderRadiusselect} 0 0`");
      background-color: v-bind("itemStyle.backgroundColorselect");
      background-repeat: v-bind("itemStyle.backgroundRepeatselect");
      background-size: v-bind("itemStyle.backgroundSizeselect");
      background-image: v-bind("itemStyle.backgroundImageselect");
      backdrop-filter:v-bind("itemStyle.backgroundBlurselect");
      border-image-source: v-bind("itemStyle.borderImageSourceselect");
      border-image-slice: v-bind("itemStyle.borderImageSliceselect");
      border-image-width: v-bind("itemStyle.borderImageWidthselect");
      background-position: v-bind("itemStyle.backgroundPositionselect");

      &.gradient-select {
        background-color: transparent;
        background-image: v-bind("itemStyle.backgroundImageGradientselect");
      }
    }
  }
  .p {
    white-space: pre;
    margin:v-bind("itemStyle.textLeftdefault") !important;
    font-size: v-bind("itemStyle.fontSizedefault");
    font-family: v-bind("itemStyle.fontFamilydefault");
    font-style:v-bind("itemStyle.fontStyledefault");
    letter-spacing: v-bind("itemStyle.letterSpacingdefault");
    font-weight:v-bind("itemStyle.fontWeightdefault");
    margin-right: v-bind("itemStyle.marginRightdefault");
    text-indent:v-bind("itemStyle.textIndentdefault");
    text-shadow: v-bind("itemStyle.textShadowdefault");
    text-decoration:v-bind("itemStyle.textDecorationdefault");
    text-underline-offset: v-bind("itemStyle.textUnderlineOffsetdefault");
    color:v-bind("itemStyle.colordefault");
    -webkit-background-clip:"text";
    background-clip:"text";
    background: v-bind("itemStyle.backgrounddefault");
    &.click{
      margin:v-bind("itemStyle.textLeftclick") !important;
      font-size: v-bind("itemStyle.fontSizeclick");
      font-family: v-bind("itemStyle.fontFamilyclick");
      font-style:v-bind("itemStyle.fontStyleclick");
      letter-spacing: v-bind("itemStyle.letterSpacingclick");
      font-weight:v-bind("itemStyle.fontWeightclick");
      margin-right: v-bind("itemStyle.marginRightclick");
      text-indent:v-bind("itemStyle.textIndentclick");
      text-shadow: v-bind("itemStyle.textShadowclick");
      text-decoration:v-bind("itemStyle.textDecorationclick");
      text-underline-offset: v-bind("itemStyle.textUnderlineOffsetclick");
      background-clip:"text";
      background: v-bind("itemStyle.backgroundclick");
      color:v-bind("itemStyle.colorclick");
    }
    &.hover{
      cursor:pointer;
      margin:v-bind("itemStyle.textLefthover") !important;
      font-size: v-bind("itemStyle.fontSizehover");
      font-family: v-bind("itemStyle.fontFamilyhover");
      font-style:v-bind("itemStyle.fontStylehover");
      letter-spacing: v-bind("itemStyle.letterSpacinghover");
      font-weight:v-bind("itemStyle.fontWeighthover");
      margin-right: v-bind("itemStyle.marginRighthover");
      text-indent:v-bind("itemStyle.textIndenthover");
      text-shadow: v-bind("itemStyle.textShadowhover");
      text-decoration:v-bind("itemStyle.textDecorationhover");
      text-underline-offset: v-bind("itemStyle.textUnderlineOffsethover");
      background: v-bind("itemStyle.backgroundhover");
      color:v-bind("itemStyle.colorhover");
    }
    &.select{
      cursor:pointer;
      margin:v-bind("itemStyle.textLefthover") !important;
      font-size: v-bind("itemStyle.fontSizeselect");
      font-family: v-bind("itemStyle.fontFamilyselect");
      font-style:v-bind("itemStyle.fontStyleselect");
      letter-spacing: v-bind("itemStyle.letterSpacingselect");
      font-weight:v-bind("itemStyle.fontWeightselect");
      margin-right: v-bind("itemStyle.marginRightselect");
      text-indent:v-bind("itemStyle.textIndentselect");
      text-shadow: v-bind("itemStyle.textShadowselect");
      text-decoration:v-bind("itemStyle.textDecorationselect");
      text-underline-offset: v-bind("itemStyle.textUnderlineOffsetselect");
      background: v-bind("itemStyle.backgroundselect");
      color:v-bind("itemStyle.colorselect");
    }
  }
  input {
    width: 100%;
    position: absolute;
    white-space: nowrap;
    text-align: v-bind("inputTextAlign");
    caret-color: rgb(212, 212, 212);
    margin:v-bind("itemStyle.textLeftdefault") !important;
    font-size: v-bind("itemStyle.fontSizedefault");
    font-family: v-bind("itemStyle.fontFamilydefault");
    font-style:v-bind("itemStyle.fontStyledefault");
    letter-spacing: v-bind("itemStyle.letterSpacingdefault");
    font-weight:v-bind("itemStyle.fontWeightdefault");
    margin-right: v-bind("itemStyle.marginRightdefault");
    text-indent:v-bind("itemStyle.textIndentdefault");
    text-shadow: v-bind("itemStyle.textShadowdefault");
    text-decoration:v-bind("itemStyle.textDecorationdefault");
    text-underline-offset: v-bind("itemStyle.textUnderlineOffsetdefault");
    color:v-bind("itemStyle.colordefault");
    -webkit-background-clip:"text";
    background-clip:"text";
    background: v-bind("itemStyle.backgrounddefault");
  }
}
.button-delete {
  display: flex;
  justify-content: center;
  align-items: center;
  aspect-ratio: 1 / 1;
  width: auto;
  height: 32px;
  margin-left: 2px;
  border: v-bind("itemStyle.borderdefault");
  border-radius: v-bind("`0 ${itemStyle.borderRadiusdefault} ${itemStyle.borderRadiusdefault} 0`");
  background-color: v-bind("itemStyle.backgroundColordefault");

  &.hover{
    cursor:pointer;
    border: v-bind("itemStyle.borderhover");
    border-radius: v-bind("`0 ${itemStyle.borderRadiushover} ${itemStyle.borderRadiushover} 0`");
    background-color: var(--background-default-hover);
  }

  &.click{
    border: v-bind("itemStyle.borderclick");
    border-radius: v-bind("`0 ${itemStyle.borderRadiusclick} ${itemStyle.borderRadiusclick} 0`");
    background-color: var(--background-default-click);
  }

  &.select {
    cursor:pointer;
    border: v-bind("itemStyle.borderselect");
    border-radius: v-bind("`0 ${itemStyle.borderRadiusselect} ${itemStyle.borderRadiusselect} 0`");
    background-color: var(--background-default-select);
  }

  :deep(.el-icon) {
    font-size: v-bind("itemStyle.fontSizedefault");
    text-shadow: v-bind("itemStyle.textShadowdefault");
    text-decoration:v-bind("itemStyle.textDecorationdefault");
    text-underline-offset: v-bind("itemStyle.textUnderlineOffsetdefault");
    color:v-bind("itemStyle.colordefault");

    &.click{
      font-size: v-bind("itemStyle.fontSizeclick");
      text-shadow: v-bind("itemStyle.textShadowclick");
      text-decoration:v-bind("itemStyle.textDecorationclick");
      text-underline-offset: v-bind("itemStyle.textUnderlineOffsetclick");
      color:v-bind("itemStyle.colorclick");
    }

    &.hover{
      font-size: v-bind("itemStyle.fontSizehover");
      text-shadow: v-bind("itemStyle.textShadowhover");
      text-decoration:v-bind("itemStyle.textDecorationhover");
      text-underline-offset: v-bind("itemStyle.textUnderlineOffsethover");
    }

    &.select {
      font-size: v-bind("itemStyle.fontSizeselect");
      text-shadow: v-bind("itemStyle.textShadowselect");
      text-decoration:v-bind("itemStyle.textDecorationselect");
      text-underline-offset: v-bind("itemStyle.textUnderlineOffsetselect");
    }
  }

  &.vertical {
    height: auto;
    width: 100%;
    margin-left: 0;
    margin-top: 2px;
    border-radius: v-bind("`0 0 ${itemStyle.borderRadiusdefault} ${itemStyle.borderRadiusdefault}`");

    &.click{
      border-radius: v-bind("`0 0 ${itemStyle.borderRadiusclick} ${itemStyle.borderRadiusclick}`");
    }

    &.hover{
      border-radius: v-bind("`0 0 ${itemStyle.borderRadiushover} ${itemStyle.borderRadiushover}`");
    }

    &.select {
      border-radius: v-bind("`0 0 ${itemStyle.borderRadiusselect} ${itemStyle.borderRadiusselect}`");
    }
  }
}
</style>
