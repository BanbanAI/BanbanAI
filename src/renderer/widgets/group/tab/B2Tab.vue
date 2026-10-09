<template>
  <div class="tab" @mouseenter="stopAnimation()" @mouseleave="startCarouseTimeout" :style="{
    '--var-tab-z-index': tabZindex,
  }">
    <b2-widget>
      <vn-stack class="custom-tabs" ref="myStackRef" :activeName="null" :modelValue="selectTabValue">
        <ul class="tabs" v-if="tab.tabShow" :style="styleValue.tabsPositionValue">
          <vn-stack-tab v-for="(widget, index) in tab.container.reversedWidgets"
              @click.stop="switchByClick(index)" :key="`tab-${widget.uid}`" :name="`tab-${widget.uid}`">
            <li class="tabs-item" :class="{selected:tab.selectedTabIndex == index}">
              <div></div>
              <span @dblclick="handleDbClick($event,index)" v-show="editingIndex !== index">{{ widget.name }}</span>
              <input v-show="editingIndex === index" @click.stop="" @mousedown.stop="" @keydown.stop="handleKeydown" @change="updateText($event, index)" @blur="exitEditing">
            </li>
          </vn-stack-tab>
        </ul>

          <div class="content-wrapper">
        <vn-stack-layer v-for="(widget, index) in tab.container.reversedWidgets" :key="`tab-${widget.uid}`" :name="`tab-${widget.uid}`" >
          <x-widget class="tab-panel" :widget="widget"></x-widget>
        </vn-stack-layer>
          </div>
      </vn-stack>
    </b2-widget>
  </div>

</template>

<script lang="ts" setup>
import { useWidget, OptionFontValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { computed, nextTick, onMounted, onUnmounted, reactive, Ref, ref, watch } from "vue";
import { Tab } from "./Tab"
import { equals } from "@common/utils/object";

const tab = useWidget<Tab>();
const selectTabValue = computed(()=> {
  const tabPanelUid = tab.container.reversedWidgets[tab.selectedTabIndex]?.uid;
  return `tab-${tabPanelUid}`
});
let playAfterProjectReady = ()=>{};
onMounted(() => {
  initSubWidgets(tab.container.reversedWidgets);

  watch(() => tab.contentSize, () => {
    initSubWidgets(tab.container.reversedWidgets);
  });

  watch(() => tab.status.isVisible, (val) => {
    if (!val) {
      stopAnimation();
    } else {
      startCarouseTimeout();
    }
  });

  watch((()=>{
    return {
      showHover:tab.getOption("tabs-hover-show") || false,
    }
  }),(val, oldVal)=>{
    if(val?.showHover !== oldVal?.showHover) {
      let opts = ["tabs-text-display", "tabs-text-font", "tabs-text-align", "tabs-vertical-align", "tabs-text-offset",
      "tabs-shadow-color", "tabs-shadow-blur", "tabs-shadow-offset",
      "tabs-border-size", "tabs-border-color", "tabs-border-radius", "tabs-border-style",
      "tabs-background-color", "tabs-background-image", "tabs-background-fill-type", "tabs-background-blur", "tabs-use-nine-patch", "tabs-nine-patch"]
      opts.forEach(opt => {
        tab.setOption(opt + "-hover", tab.getOption(opt), false);
      })
    }
  });
})
// 初始化子组件InheritOption属性
const initSubWidgets = (widgets) => {
  for (let key in widgets) {
    let subWidget = widgets[key];
    if (subWidget.container) {
      subWidget.container.gap = 2;
    }
    subWidget.setInheritOption('position', [0, 0]);
    subWidget.setInheritOption('grid-width', 60);
    let width = tab.contentSize.width;
    let height = tab.contentSize.height;
    // 兼容切换按钮
    let buttonWidth: number = tab.getOption("tabs-tag-width");
    let buttonHeight: number = tab.getOption("tabs-tag-height");
    if (tab.getOption("tabs") && tab.getOption("tabs-type") === "tag") {
      if (tab.getOption("tabs")) {
        let buttonPosition: string = tab.getOption("tabs-tag-position");
        if (buttonPosition.startsWith("top_") || buttonPosition.startsWith("bottom")) {
          height = height - buttonHeight;
        } else if (buttonPosition.startsWith("right") || buttonPosition.startsWith("left")) {
          width = width - buttonWidth * 3;
        }
      }
    }

    subWidget.childOfTab = true;
    // 重置完了之后把上面标签一起改掉
  }
  widgets[0]?.setInheritOption('opacity', 100);
  // 第一次设置
  tab.setSelectedItem(0);
}

// 保存widget的opacity
let delayTimer = null;
// 保存展示动画配置项信息
let animationObj = reactive({});
let total_raf = null;
// 动画定时器
let widgetCarouselTimeout = null;
// 独立动画停留定时器
let selfTimer = null;
// 点击按钮的标识
let isClick = false;
// 上一次选中的动画类型
let lastAnimationType = tab.getOption("animation-type");
// 鼠标是否在切换按钮上
let mouseHover = false;
watch(() => {
  return tab.container.reversedWidgets.map((widget) => widget.uid);
}, async (newUids, preUids) => {
  await nextTick();
  preUids = preUids ?? [];
  let widgets = [];
  const addWidgetUids = newUids.filter(newUid => !preUids.includes(newUid));
  const removeWidgetUids = preUids.filter(preUid => !newUids.includes(preUid));
  for (const uid of addWidgetUids) {
    const widget = tab.container.reversedWidgets.find(widget => widget.uid === uid);
    widgets.push(widget);
  }
  for (const uid of removeWidgetUids) {
    const widget = tab.getElementByUID([tab.getBoard().uid, uid]);
    widget?.unsetInheritOption("position");
  }
  initSubWidgets(widgets);
})

watch(tab._tabIndex, (val, old) => {
  if (val !== old) {
    tab.beforeIndex = old;
  }
  if(tab?.status?.canEditorChild){
    tab.getBoard().activateWidget(tab.container.widgets[tab.container.widgets?.length - val -1])
  }
  // 通过点击按钮触发切换
  if (isClick) {
    isClick = false;
    return;
  }
  if (tab.getOption("animation-self-wait") && old !== -1) {
    clearCarouseTimeout();
    clearTimeout(selfTimer);
    selfTimer = null;
    stay(val);
  }
  lastAnimationType = tab.getOption("animation-type");
})

// 独立停留定时器的入口函数
const stay = (index) => {
  if (!selfTimer) {
    clearTimeout(selfTimer);
    selfTimer = null;
  }

  selfTimer = setTimeout(() => {
    toggleAnimation();
  }, (tab.getAnimationSelfWaits[index] * 1000) + animationObj['duration'])
}

// 独立停留触发动画处理
const toggleAnimation = () => {
  if (!animationObj["on"] || !tab.status.isVisible || tab.status.canEditorChild) {
    clearInterval(widgetCarouselTimeout);
    widgetCarouselTimeout = null;
    tab.stopAnimate = true;
    total_raf = null;
    tab.setSelectedItem(0);
    return;
  }

  if (tab.container.reversedWidgets.length <= 1) {
    clearInterval(widgetCarouselTimeout);
    widgetCarouselTimeout = null;
    return;
  };

  let tempIndex = tab.selectedTabIndex + 1;
  if (tempIndex == tab.container.reversedWidgets.length) {
    if (!animationObj["loop"]) {
      clearInterval(widgetCarouselTimeout);
      clearTimeout(selfTimer);
      widgetCarouselTimeout = null;
      total_raf = null;
      tab.setSelectedItem(tab.container.reversedWidgets.length - 1)
      return;
    }
  }
  if (tab.selectedTabIndex + 1 == tab.container.reversedWidgets.length) {
    tempIndex = 0;
  }
  if (!animationObj['on'] || animationObj['animationType'] !== 'none') {
    if (animationObj['animationType'] === 'fade') {
      tabFadeAnimation();
    } else if (animationObj['animationType'] === 'horizontal-move') {
      tabHorizontalAnimation();
    } else {
      tabVerticalAnimation();
    }
  }
  tab.setSelectedItem(tempIndex);

}

// 动画定时器
const widgetCarouselFn = () => {
  if(widgetCarouselTimeout){
    clearInterval(widgetCarouselTimeout);
    widgetCarouselTimeout = null;
  }
  return setInterval(() => {
    if (!animationObj["on"] || !tab.status.isVisible || tab.status.canEditorChild) {
      clearInterval(widgetCarouselTimeout);
      widgetCarouselTimeout = null;
      tab.stopAnimate = true;
      total_raf = null;
      tab.setSelectedItem(0);
      return;
    }
    if (tab.container.reversedWidgets.length <= 1) {
      clearInterval(widgetCarouselTimeout);
      widgetCarouselTimeout = null;
      return;
    };
    let tempIndex = tab.selectedTabIndex + 1;

    if (!animationObj["loop"] && tempIndex == tab.container.reversedWidgets.length) {
      clearInterval(widgetCarouselTimeout);
      clearTimeout(selfTimer);
      selfTimer = null;
      widgetCarouselTimeout = null;
      total_raf = null;
      tab.setSelectedItem(tab.container.reversedWidgets.length - 1)
      return;
    }
    if (tempIndex == tab.container.reversedWidgets.length) {
      tempIndex = 0;
    }
    if (animationObj['on'] && animationObj['animationType'] !== 'none') {
      if (animationObj['animationType'] === 'fade') {
        tabFadeAnimation();
      } else if (animationObj['animationType'] === 'horizontal-move') {
        tabHorizontalAnimation();
      } else {
        tabVerticalAnimation();
      }
    }
    tab.setSelectedItem(tempIndex);
  }, animationObj['wait'] + animationObj['duration'])
}
// 淡入淡出动画
const tabFadeAnimation = async () => {
  return new Promise<void>((resolve, reject) => {
    let start_time = Date.now();
    let flag = true;
    tab.container.reversedWidgets[tab.selectedTabIndex].unsetInheritOption('opacity');
    let animate_fn = () => {
      let n = (Date.now() - start_time) / animationObj['duration'];
      if (n <= 1 && !tab.stopAnimate) {
        total_raf = window.requestAnimationFrame(animate_fn);
        if (flag) {
          flag = false;
        }
      } else {
        window.cancelAnimationFrame(total_raf);
        tab.stopAnimate = false;
        total_raf = null;
        resolve()
      }
    }
    window.requestAnimationFrame(animate_fn);
  })
}

// 水平平移
const tabHorizontalAnimation = () => {
  let width = tab.contentSize.width;
  if(!tab.container.reversedWidgets[tab.selectedTabIndex]?.dom?.style){
    setTimeout(()=>{
      tabHorizontalAnimation();
    }, 1000)
    return;
  }
  tab.container.reversedWidgets[tab.selectedTabIndex].dom.style.left = width + 'px';
  return new Promise<void>((resolve, reject) => {
    let start_time = Date.now();
    let animate_fn = () => {
      let n = (Date.now() - start_time) / animationObj['duration'];
      if (n <= 1 && !tab.stopAnimate) {
        tab.container.reversedWidgets[tab.beforeIndex].setInheritOption('position', [-(n * width), 0]);
        tab.container.reversedWidgets[tab.selectedTabIndex].setInheritOption('position', [(width - n * width), 0]);
        total_raf = window.requestAnimationFrame(animate_fn);
      } else {
        window.cancelAnimationFrame(total_raf);
        tab.stopAnimate = false;
        total_raf = null;
        tab.container.reversedWidgets[tab.beforeIndex].unsetInheritOption('position');
        tab.container.reversedWidgets[tab.selectedTabIndex].setInheritOption('position', [0, 0]);
        resolve()
      }
    }
    window.requestAnimationFrame(animate_fn);
  })
}

// 垂直平移
const tabVerticalAnimation = () => {
  let height = tab.contentSize.height;
  return new Promise<void>((resolve, reject) => {
    let start_time = Date.now();
    let animate_fn = () => {
      let n = (Date.now() - start_time) / animationObj['duration'];
      if (n <= 1 && !tab.stopAnimate) {
        tab.container.reversedWidgets[tab.beforeIndex].setInheritOption('position', [0, -(n * height)]);
        tab.container.reversedWidgets[tab.selectedTabIndex].setInheritOption('position', [0, (height - (n * height))]);
        total_raf = window.requestAnimationFrame(animate_fn);
      } else {
        window.cancelAnimationFrame(total_raf);
        tab.stopAnimate = false;
        total_raf = null;
        tab.container.reversedWidgets[tab.beforeIndex].unsetInheritOption('position');
        tab.container.reversedWidgets[tab.selectedTabIndex].setInheritOption('position', [0, 0]);
        resolve()
      }
    }
    window.requestAnimationFrame(animate_fn);
  })
}

// 清除定时器
const clearCarouseTimeout = () => {
  // if (!animationObj["on"]) return;
  clearInterval(widgetCarouselTimeout);
  widgetCarouselTimeout = null;
  cancelAnimationFrame(total_raf);
  total_raf = null;
}
// 鼠标移入切换按钮触发回调
const stopAnimation = () => {
  if (!animationObj["on"] || tab.status.canEditorChild) return;
  mouseHover = true;
  if (isClick) return;
  if (widgetCarouselTimeout) {
    clearInterval(widgetCarouselTimeout);
    widgetCarouselTimeout = null;
  }

  if (total_raf) {
    cancelAnimationFrame(total_raf);
    total_raf = null;
  }
  if (selfTimer) {
    clearTimeout(selfTimer);
    selfTimer = null;
  }

  for (let key in tab.container.reversedWidgets) {
    let subWidget = tab.container.reversedWidgets[key];
    subWidget.unsetInheritOption('position');
    subWidget.setInheritOption('position', [0, 0]);
  }
}
// 鼠标移出切换按钮触发回调
const startCarouseTimeout = () => {
  if (!animationObj["on"] || tab.status.canEditorChild) return;
  mouseHover = false;
  if (tab.isReady()) {
    if (tab.getOption("animation-self-wait")) {
      stay(tab.selectedTabIndex);
    } else {
      widgetCarouselTimeout = widgetCarouselFn();
    }
  } else {
    playAfterProjectReady = ()=>{
      if (tab.getOption("animation-self-wait")) {
        stay(tab.selectedTabIndex);
      } else {
        widgetCarouselTimeout = widgetCarouselFn();
      }
    };
  }
}
// 鼠标点击切换按钮回调
const switchByClick = (index) => {
  isClick = true;
  tab.setSelectedItem(index);
}

watch(() => tab.container.reversedWidgets.length, (newVal, oldVal) => {
  if (newVal <= 1) {
    clearCarouseTimeout();
  } else {
    tab.setSelectedItem(0);
    clearCarouseTimeout();
    nextTick(() => {
      initSubWidgets(tab.container.reversedWidgets);
    })
  }
})
// 监听动画配置项
watch(() => {
  return {
    on: tab.getOption("animation-display"),
    visible: tab.status.isVisible,
    loop: tab.getOption("animation-loop"),
    delay: tab.getOption<number>("animation-delay") * 1000,
    wait: tab.getOption<number>("animation-wait") * 1000,
    duration: tab.getOption<number>("animation-duration") * 1000,
    animationType: tab.getOption<string>("animation-type"),
    isolated: tab.getOption("animation-self-wait"),
    showSwitchButton: tab.getOption("tabs"),
    buttonPosition: tab.getOption("tabs-tag-position"),
    itemLength: tab.container.reversedWidgets,
    editable: tab.status.canEditorChild
  }
}, (options, oldOptions) => {
  if (!options["on"] || options["editable"]) {
    clearCarouseTimeout();
    return;
  }
  animationObj = options;
  if (oldOptions) {
    lastAnimationType = oldOptions["animationType"];
  }

  for (let key in tab.container.reversedWidgets) {
    let subWidget = tab.container.reversedWidgets[key];
    subWidget.unsetInheritOption('position');
  }
  tab.setSelectedItem(0);
  if (!options.on || !options.visible) {
    clearInterval(widgetCarouselTimeout);
    widgetCarouselTimeout = null;
    cancelAnimationFrame(total_raf);
    total_raf = null;
    tab.setWidgetsInheritPosition();
    return;
  }
  if (widgetCarouselTimeout) {
    clearInterval(widgetCarouselTimeout);
    widgetCarouselTimeout = null;
    cancelAnimationFrame(total_raf);
    total_raf = null;
  }
  if (delayTimer) {
    clearTimeout(delayTimer);
    delayTimer = null;
  }

  initSubWidgets(tab.container.reversedWidgets);
  if (options.isolated) {
    if (selfTimer) {
      clearTimeout(selfTimer);
      selfTimer = null;
    }
    if (widgetCarouselTimeout) {
      clearInterval(widgetCarouselTimeout);
      widgetCarouselTimeout = null;
    }
    stay(0);
    return;
  }
  if (tab.isReady()) {
    delayTimer = setTimeout(() => {
      widgetCarouselTimeout = widgetCarouselFn();
    }, options.delay)
  } else {
    playAfterProjectReady = ()=>{
      delayTimer = setTimeout(() => {
        widgetCarouselTimeout = widgetCarouselFn();
      }, options.delay)
    };
  }

}, { immediate: true, deep: true })


watch(()=>tab.isReady(),(val, oldVal)=>{
  if(val !== oldVal && val){
    playAfterProjectReady();
  }
})

const styleValue: Ref<any> = ref({});
watch(()=>{
  let styleValue: any = {};
  let tabsType = tab.getOption("tabs-type");
  let typeIsTag = tabsType === "tag";
  let typeHover = tab.getOption("tabs-hover-show")
  let number = tab.widgetsLength;
   //设置形状
   let tabsShape = tab.getOption(`tabs-${tabsType}-shape`);
  let tabsShapeRadius = "";
  if (tabsType === "tag" && tabsShape === "fillet") {
    tabsShapeRadius = "12%";
  } else if (tabsType === "mark" && tabsShape === "round") {
    tabsShapeRadius = "50%";
  }

  //设置排列方向
  let tabsDirection = tab.getOption(`tabs-${tabsType}-direction`) || "horizontal";
  let isHorizontal = tabsDirection === "horizontal";
  if (isHorizontal) {
    styleValue.flexDirection = "row"
  } else {
    styleValue.flexDirection = "column"

  }
  //大小、背景取值
  let tabsWidth = Math.max(0, tab.getOption(`tabs-${tabsType}-width`));
  let tabsHeight = Math.max(0, tab.getOption(`tabs-${tabsType}-height`));

  styleValue.tabsWidth = tabsWidth + "px";
  styleValue.tabsHeight = tabsHeight + "px";
  styleValue.tabsBackgroundColor = tab.toCssColor(tab.getOption("tabs-background-color"));
  styleValue.tabsBackgroundColorSelected = tab.toCssColor(tab.getOption("tabs-background-color-selected"));
  //选中样式
  let tabTextDisplaySelected = tab.getOption("tabs-text-display-selected");
  let tabsTextSelected = tab.getOption<OptionFontValue>("tabs-text-font-selected");
  let tabsTextSizeSelected = Math.max(0, tabsTextSelected.size);
  let tabsTextColorSelected = tab.toCssColor(tabsTextSelected.color as Color);
  let tabsTextFamilySelected = tabsTextSelected.family;
  let tabsTextItalicSelected = tabsTextSelected.italic ? "italic" : "normal";
  let tabsTextBoldSelected= tabsTextSelected.bold ? "bold" : "normal";
  let tabsTextBackgroundImageSelected = tab.getOption("tabs-background-image-selected");
  let tabsTextBackgroundFillTypeSelected = tab.getOption("tabs-background-fill-type-selected");
  let tabsTextBackgroundblurSelected = tab.getOption<number>("tabs-background-blur-selected");
  let tabsBackgroundPositionSelected = tab.getOption("background-image-position-selected");
  styleValue.tabsTextSizeSelected = tabsTextSizeSelected + "px";
  styleValue.tabsTextDisplaySelected = "block";
  if(tabsType === "mark") {
    styleValue.tabsTextDisplaySelected = tabTextDisplaySelected ? "block" : "none";
    styleValue.tabsTextSizeSelected = tabTextDisplaySelected ? styleValue.tabsTextSizeSelected : 0;
  }
  let tabsShadowColorSelected = tab.toCssColor(tab.getOption("tabs-shadow-color-selected"));
  let tabsShadowBlurSelected = tab.getOption("tabs-shadow-blur-selected");
  let offsetSelected = tab.getOption("tabs-shadow-offset-selected");
  styleValue.textShadowSelected = `${offsetSelected?.[0]}px ${offsetSelected?.[1]}px ${tabsShadowBlurSelected}px ${tabsShadowColorSelected}`;

  styleValue.tabsTextColorSelected = tabsTextColorSelected;
  styleValue.tabsTextFamilySelected = tabsTextFamilySelected;
  styleValue.tabsTextItalicSelected = tabsTextItalicSelected;
  styleValue.tabsTextBoldSelected = tabsTextBoldSelected;
  styleValue.tabsTextBackgroundImageSelected = `url("${tab.projectId}/${(tabsTextBackgroundImageSelected as any)?.relativePath}")`;
  styleValue.tabsTextBackgroundRepeatSelected = tabsTextBackgroundFillTypeSelected === "tile" ? 'repeat' : 'no-repeat';
  styleValue.tabsTextBackgroundSizeSelected = tabsTextBackgroundFillTypeSelected === "tile" ? '' :  tabsTextBackgroundFillTypeSelected === "none" ?  `${tab.getOption("background-image-scale-selected")}%` : '100% 100%';
  styleValue.tabsTextBackgroundBlurSelected = tabsTextBackgroundblurSelected > 0 ? `blur(${tabsTextBackgroundblurSelected}px)` : `none`;
  styleValue.borderWidthSelected = `${tab.getOption("tabs-border-size-selected")}px`;
  styleValue.textBorderSelected = `${tab.getOption("tabs-border-size-selected")}px ${tab.getOption("tabs-border-style-selected")} ${tab.toCssColor(tab.getOption("tabs-border-color-selected"))}`;
  styleValue.tabsBorderRadiusSelected = tabsType === "mark" ? tabsShapeRadius : `${tab.getOption("tabs-border-radius-selected")}px`;
  styleValue.tabsBackgroundPositionSelected = tabsTextBackgroundFillTypeSelected === "none" ? `${tabsBackgroundPositionSelected[0]}px ${tabsBackgroundPositionSelected[1]}px` : ""
  styleValue.textAlignSelected = tab.getOption("tabs-text-align-selected");
  styleValue.verticalAlignSelected = "center";
  let textVerticalSelected = tab.getOption("tabs-vertical-align-selected");
  let textOffsetSelected = tab.getOption("tabs-text-offset-selected");
  if(textVerticalSelected === "start") {
    styleValue.verticalAlignSelected = "flex-start";
  } else if(tab.getOption("tabs-vertical-align-selected") === "end"){
    styleValue.verticalAlignSelected = "flex-end";
  }
  styleValue.tabsTextOffsetSelected = `translate(${textOffsetSelected[0]}px, ${textOffsetSelected[1]}px)`;

  if(tab.getOption("tabs-use-nine-patch-selected") && tabsTextBackgroundFillTypeSelected === "stretch"){
    let ninePatchSelected = tab.getOption(`tabs-nine-patch-selected`) as any || { top: 0, right: 0, bottom: 0, left: 0 };
    const { top, right, bottom, left } = ninePatchSelected;
    styleValue.borderImageSourceSelected = `url("${tab.projectId}/${(tabsTextBackgroundImageSelected as any)?.relativePath}")`;
    styleValue.borderImageSliceSelected = `${top}% ${right}% ${bottom}% ${left}% fill`;
    styleValue.borderImageWidthSelected = "auto";
    styleValue.tabsTextBackgroundImageSelected = "unset";
  }

  //默认样式
  let tabTextDisplay = tab.getOption("tabs-text-display");
  let tabsText = tab.getOption<OptionFontValue>("tabs-text-font");
  let tabsTextSize = Math.max(0, tabsText.size);
  let tabsTextColor = tab.toCssColor(tabsText.color as Color);
  let tabsTextFamily = tabsText.family;
  let tabsTextItalic = tabsText.italic ? "italic" : "normal";
  let tabsTextBold = tabsText.bold ? "bold" : "normal";
  let tabsShadowColor = tab.toCssColor(tab.getOption("tabs-shadow-color"));
  let tabsShadowBlur = tab.getOption("tabs-shadow-blur");
  let offset = tab.getOption("tabs-shadow-offset");
  let tabsBackgroundPosition = tab.getOption("background-image-position")
  styleValue.textShadow = `${offset?.[0]}px ${offset?.[1]}px ${tabsShadowBlur}px ${tabsShadowColor}`;

  let tabsTextBackgroundImage = tab.getOption("tabs-background-image");
  let tabsTextBackgroundFillType = tab.getOption("tabs-background-fill-type");
  let tabsTextBackgroundblur = tab.getOption<number>("tabs-background-blur");
  styleValue.tabsTextBackgroundImage = `url("${tab.projectId}/${(tabsTextBackgroundImage as any)?.relativePath}")`;
  styleValue.tabsTextBackgroundRepeat = tabsTextBackgroundFillType === "tile" ? 'repeat' : 'no-repeat';
  styleValue.tabsTextBackgroundSize = tabsTextBackgroundFillType === "tile" ? '' : tabsTextBackgroundFillType === "none" ? `${tab.getOption("background-image-scale")}%` : '100% 100%';
  styleValue.tabsTextBackgroundBlur = tabsTextBackgroundblur > 0 ? `blur(${tabsTextBackgroundblur}px)` : `none`;
  styleValue.tabsBackgroundPosition = tabsTextBackgroundFillType === "none" ? `${tabsBackgroundPosition[0]}px ${tabsBackgroundPosition[1]}px` : ""
  styleValue.tabsTextSize = tabsTextSize + "px";
  styleValue.tabsTextDisplay = "block";
  if(tabsType === "mark") {
    styleValue.tabsTextDisplay = tabTextDisplay ? "block" : "none";
    styleValue.tabsTextSize = tabTextDisplay ? styleValue.tabsTextSize : 0;
  }
  styleValue.tabsTextColor = tabsTextColor;
  styleValue.tabsTextFamily = tabsTextFamily;
  styleValue.tabsTextItalic = tabsTextItalic;
  styleValue.tabsTextBold = tabsTextBold;
  styleValue.borderWidth = `${tab.getOption("tabs-border-size")}px`;
  styleValue.textBorder = `${tab.getOption("tabs-border-size")}px ${tab.getOption("tabs-border-style")} ${tab.toCssColor(tab.getOption("tabs-border-color"))}`;
  styleValue.tabsBorderRadius = tabsType === "mark" ? tabsShapeRadius : `${tab.getOption("tabs-border-radius")}px`;
  styleValue.textAlign = tab.getOption("tabs-text-align");
  styleValue.verticalAlign = "center";
  let textVerticalAlign = tab.getOption("tabs-vertical-align");
  let textOffset = tab.getOption("tabs-text-offset");
  if(textVerticalAlign === "start") {
    styleValue.verticalAlign = "flex-start";
  } else if(textVerticalAlign === "end"){
    styleValue.verticalAlign = "flex-end";
  }
  styleValue.tabsTextOffset = `translate(${textOffset[0]}px, ${textOffset[1]}px)`;


  if(tab.getOption("tabs-use-nine-patch") && tabsTextBackgroundFillType === "stretch"){
    let ninePatch: any = tab.getOption(`tabs-nine-patch`) || { top: 0, right: 0, bottom: 0, left: 0 };
    const { top, right, bottom, left } = ninePatch;
    styleValue.borderImageSource = `url("${tab.projectId}/${(tabsTextBackgroundImage as any)?.relativePath}")`;
    styleValue.borderImageSlice = `${top}% ${right}% ${bottom}% ${left}% fill`;
    styleValue.borderImageWidth = "auto";
    styleValue.tabsTextBackgroundImage = "unset";
  }

    //hover 样式
  let tabTextDisplayHover = tab.getOption("tabs-text-display-hover");
  let tabsTextHover = tab.getOption<OptionFontValue>("tabs-text-font-hover");
  let tabsTextSizeHover = Math.max(0, tabsTextHover.size);
  let tabsTextColorHover = tab.toCssColor(tabsTextHover.color as Color);
  let tabsTextFamilyHover = tabsTextHover.family;
  let tabsTextItalicHover = tabsTextHover.italic ? "italic" : "normal";
  let tabsTextBoldHover= tabsTextHover.bold ? "bold" : "normal";
  let tabsTextBackgroundImageHover = tab.getOption("tabs-background-image-hover");
  let tabsTextBackgroundFillTypeHover = tab.getOption("tabs-background-fill-type-hover");
  let tabsTextBackgroundblurHover = tab.getOption<number>("tabs-background-blur-hover");
  let tabsBackgroundPositionHover = tab.getOption("background-image-position-hover")
  styleValue.tabsTextSizeHover = typeHover ? tabsTextSizeHover + "px" : tabsTextSize + "px";
  styleValue.tabsTextDisplayHover = "block";
  if(tabsType === "mark") {
    styleValue.tabsTextDisplayHover = tabTextDisplayHover ? "block" : "none";
    styleValue.tabsTextSizeHover = tabTextDisplayHover ? styleValue.tabsTextSizeHover : 0;
  }

  let tabsShadowColorHover = typeHover ? tab.toCssColor(tab.getOption("tabs-shadow-color-hover")) : tabsShadowColor;
  let tabsShadowBlurHover = typeHover ? tab.getOption("tabs-shadow-blur-hover") : tabsShadowBlur;
  let offsetHover = typeHover ? tab.getOption("tabs-shadow-offset-hover") : offset;
  styleValue.textShadowHover = `${offsetHover?.[0]}px ${offsetHover?.[1]}px ${tabsShadowBlurHover}px ${tabsShadowColorHover}`;
  styleValue.tabsTextColorHover = typeHover ? tabsTextColorHover : tabsTextColor;
  styleValue.tabsTextFamilyHover = typeHover ? tabsTextFamilyHover : tabsTextFamily;
  styleValue.tabsTextItalicHover = typeHover ? tabsTextItalicHover : tabsTextItalic;
  styleValue.tabsTextBoldHover =  typeHover ? tabsTextBoldHover : tabsTextBold;
  styleValue.tabsTextBackgroundImageHover = typeHover ? `url("${tab.projectId}/${(tabsTextBackgroundImageHover as any)?.relativePath}")` : `url("${tab.projectId}/${(tabsTextBackgroundImage as any)?.relativePath}")`;
  styleValue.tabsTextBackgroundRepeatHover = typeHover ? tabsTextBackgroundFillTypeHover === "tile" ? 'repeat' : 'no-repeat' : tabsTextBackgroundFillType === "tile" ? 'repeat' : 'no-repeat';
  styleValue.tabsTextBackgroundSizeHover = typeHover ? tabsTextBackgroundFillTypeHover === "tile" ? ''  : tabsTextBackgroundFillTypeHover === "none" ? `${tab.getOption("background-image-scale-hover")}%` : '100% 100%' : tabsTextBackgroundFillType === "tile" ? '' : tabsTextBackgroundFillType === "none" ? `${tab.getOption("background-image-scale")}%` : '100% 100%';
  styleValue.tabsTextBackgroundBlurHover =  typeHover ? tabsTextBackgroundblurHover > 0 ? `blur(${tabsTextBackgroundblurHover}px)` : `none` : tabsTextBackgroundblur > 0 ? `blur(${tabsTextBackgroundblur}px)` : `none`;
  styleValue.borderWidthHover =  typeHover ? `${tab.getOption("tabs-border-size-hover")}px` : `${tab.getOption("tabs-border-size")}px`;
  styleValue.textBorderHover =  typeHover ? `${tab.getOption("tabs-border-size-hover")}px ${tab.getOption("tabs-border-style-hover")} ${tab.toCssColor(tab.getOption("tabs-border-color-hover"))}` : `${tab.getOption("tabs-border-size")}px ${tab.getOption("tabs-border-style")} ${tab.toCssColor(tab.getOption("tabs-border-color"))}`;
  styleValue.tabsBackgroundColorHover = typeHover ? tab.toCssColor(tab.getOption("tabs-background-color-hover")) : tab.toCssColor(tab.getOption("tabs-background-color"));
  styleValue.tabsBackgroundPositionHover =  typeHover ? tabsTextBackgroundFillTypeHover === "none" ? `${tabsBackgroundPositionHover[0]}px ${tabsBackgroundPositionHover[1]}px` : "" : tabsTextBackgroundFillType === "none" ? `${tabsBackgroundPosition[0]}px ${tabsBackgroundPosition[1]}px` : "";
  styleValue.tabsBorderRadiusHover = tabsType === "mark" ? tabsShapeRadius : typeHover ? `${tab.getOption("tabs-border-radius-hover")}px` : `${tab.getOption("tabs-border-radius")}px`;
  styleValue.textAlignHover = tab.getOption("tabs-text-align-hover");
  styleValue.verticalAlignHover = "center";
  let textAlignHover = tab.getOption("tabs-vertical-align-hover");
  let textOffsetHover = tab.getOption("tabs-text-offset-hover");
  if(textAlignHover === "start") {
    styleValue.verticalAlignHover = "flex-start";
  } else if(textAlignHover === "end"){
    styleValue.verticalAlignHover = "flex-end";
  }
  styleValue.tabsTextOffsetHover = typeHover ? `translate(${textOffsetHover[0]}px, ${textOffsetHover[1]}px)` : styleValue.tabsTextOffset;

  if(tab.getOption("tabs-use-nine-patch-hover") && tabsTextBackgroundFillTypeHover === "stretch"){
    let ninePatchHover = tab.getOption(`tabs-nine-patch-hover`) as any || { top: 0, right: 0, bottom: 0, left: 0 };
    const { top, right, bottom, left } = ninePatchHover;
    styleValue.borderImageSourceHover = `url("${tab.projectId}/${(tabsTextBackgroundImageHover as any)?.relativePath}")`;
    styleValue.borderImageSliceHover = `${top}% ${right}% ${bottom}% ${left}% fill`;
    styleValue.borderImageWidthHover = "auto";
    styleValue.tabsTextBackgroundImageHover = "unset";
  }

  let spacingRight = 0;
  let spacingBottom = 0;
  // 间隔和整体宽度
  let tabsSpacing = Math.max(0, tab.getOption("tabs-spacing"));
  if(isHorizontal) {
    styleValue.marginRight = tabsSpacing + "px"
    styleValue.marginBottom = 0;

    styleValue.totalWidth = tabsWidth * number + tabsSpacing * number - 1 +  + "px";
    styleValue.totalHeight = tabsHeight + "px";
  } else {
    styleValue.marginBottom = tabsSpacing + "px"
    styleValue.marginRight =  0;

    styleValue.totalWidth = tabsWidth + "px";
    styleValue.totalHeight = tabsHeight * number + tabsSpacing * number - 1 + "px";
  }

  if (tabsType === "tag") {
  } else if (tabsType === "mark") {
    styleValue.textBorder = "0px";
    styleValue.textBorderHover = "0px";
    styleValue.textBorderSelected = "0px";
    // styleValue.tabsTextDisplay = tab.getOption("tabs-text-display");
    // tab.getHostBody()[0].style.setProperty("--tabs-text-display", tabsTextDisplay ? "inline" : "none");
  }
  styleValue.spacingRight = spacingRight + "px";
  styleValue.spacingBottom = spacingBottom + "px";

  //设置位置
  let tabsPosition = tab.getOption(`tabs-${tabsType}-position`);
  let tabsPositionInfo = tab.getTabPosition(tabsPosition, typeIsTag, isHorizontal);
  let location = tabsPositionInfo.location;
  let tabsPositionValue: any = tabsPositionInfo.position;
  let containerCss: any = {};
  if (tab.tabShow) {
    if (tabsType === "tag") {
      let widgetsCount = tab.getSoul().widgets ? tab.getSoul().widgets.length : 1;
      let _top = isHorizontal ? tabsHeight : tabsHeight * widgetsCount;
      let _left = isHorizontal ? tabsWidth * widgetsCount : tabsWidth;
      if (location === "top") {
        containerCss = { top: _top + "px", left: 0, width: "100%", height: (tab.contentSize.height - _top - tab.container.gap*2) + "px", margin: "auto" }
      } else if (location === "bottom") {
        tabsPositionValue.top = tab.contentSize.height - _top + "px";
        containerCss = { top: 0, left: 0, width: "100%", height: (tab.contentSize.height - _top - tab.container.gap*2) + "px", margin: "auto" };
      } else if (location === "left") {
        containerCss = { top: 0, left: _left + "px", width: (tab.contentSize.width - _left) + "px", height: "100%", margin: "unset" };
      } else if (location === "right") {
        tabsPositionValue.left = tab.contentSize.width - _left + "px";
        containerCss = { left: 0, top: 0, width: (tab.contentSize.width - _left) + "px", height: "100%", margin: "unset" }
      }
    } else {
      containerCss = { top: 0, left: 0, width: "100%", height: "100%", margin: "auto" }
    }
  } else {
    containerCss = { top: 0, left: 0, width: "100%", height: "100%", margin: "auto" }
  }

  styleValue.tabsPositionValue = tabsPositionValue;
  styleValue.containerTop = containerCss.top;
  styleValue.containerLeft = containerCss.left;
  styleValue.containerWidth = containerCss.width;
  styleValue.containerHeight = containerCss.height;
  styleValue.containerMargin = containerCss.margin;
  return styleValue;
}, (value, oldValue)=>{
  if (!equals(value, oldValue)) {
    styleValue.value = value;
  }
}, {immediate: true});

const tabZindex = ref(0);
watch(()=>{
  if(tab.getBoard().status.isPlaying || tab.status.isActive) {
    return 5;
  } else {
    return 0;
  }
}, (value)=>{
  if (tabZindex.value !== value) {
    tabZindex.value = value;
  }
}, {immediate: true});

watch(() => tab.getOption<boolean>("no-events"), (val) => {
  tab.noEvents.value = val;
  tab.noEventStyle.value = val ? "none" : "auto";
  }, {immediate: true})

let editingIndex = ref(-1);

const handleDbClick = (event, index)=>{
  if(!tab.isEditable) return;
  editingIndex.value = index;
  let inputEl = event.currentTarget.nextSibling;
  let text = event.currentTarget.innerHTML;
  inputEl.value = text;
  setTimeout(() => {
    inputEl.select();
  }, 0)
}

const updateText = (event, index) => {
  let newName = event.currentTarget.value;
  tab.container.reversedWidgets[index].name = newName
}

const exitEditing = () => {
  editingIndex.value = -1;
}

const handleKeydown = (event)=>{
  if (event.code === "Enter") {
    exitEditing();
  }
}

// tab组件被删除时，清空定时器
onUnmounted(() => {
  clearCarouseTimeout();
  clearTimeout(delayTimer);
  clearTimeout(selfTimer);
  clearInterval(widgetCarouselTimeout)
})

</script>

<style lang="scss" scoped>
.tab {
  &.no-events {
    pointer-events: none !important;
  }
  // .b2widget {
  //   pointer-events: none !important;
  // }
  .custom-tabs {
    height: 100%;
  }

  :deep(.b2widget) {
    pointer-events: v-bind("tab.noEventStyle.value") !important;
    .tab-container {
      // position: absolute;
      // width: v-bind("styleValue.containerWidth");
      // height: v-bind("styleValue.containerHeight") !important;
      // top: v-bind("styleValue.containerTop");
      // left: v-bind("styleValue.containerLeft");
      // margin: v-bind("styleValue.containerMargin");
      &>.b2widget{
        height: 100% !important;
        left: 0 !important;
        top: 0 !important;
      }
    }

    .tabs {
      display: flex;
      flex-direction: v-bind("styleValue.flexDirection");
      // position: absolute;
      width: v-bind("styleValue.totalWidth");
      height: v-bind("styleValue.totalHeight");
      z-index: var(--var-tab-z-index);
      align-items: center;
      justify-content: space-between;
      align-content: space-between;

      .tabs-item {
        pointer-events: all !important;
        width: v-bind("styleValue.tabsWidth");
        height: v-bind("styleValue.tabsHeight");
        background-color: v-bind("styleValue.tabsBackgroundColor");
        margin-right: v-bind("styleValue.marginRight");
        margin-bottom: v-bind("styleValue.marginBottom");
        border-right: v-bind("styleValue.borderRight");
        cursor: pointer;
        overflow: hidden;
        box-sizing: border-box;
        background-clip: content-box;
        display: flex;
        position: relative;
        align-items: v-bind("styleValue.verticalAlign");
        border: v-bind("styleValue.textBorder");
        border-radius: v-bind("styleValue.tabsBorderRadius");
        // border-radius: v-bind("styleValue.tabsShapeRadius");
        background-image: v-bind("styleValue.tabsTextBackgroundImage");
        background-size: v-bind("styleValue.tabsTextBackgroundSize");
        background-repeat: v-bind("styleValue.tabsTextBackgroundRepeat");
        backdrop-filter: v-bind("styleValue.tabsTextBackgroundBlur");
        background-position: v-bind("styleValue.tabsBackgroundPosition");

        &:hover {
          background-color: v-bind("styleValue.tabsBackgroundColorHover");
          border: v-bind("styleValue.textBorderHover");
          border-radius: v-bind("styleValue.tabsBorderRadiusHover");
          background-image: v-bind("styleValue.tabsTextBackgroundImageHover");
          background-size: v-bind("styleValue.tabsTextBackgroundSizeHover");
          background-repeat: v-bind("styleValue.tabsTextBackgroundRepeatHover");
          backdrop-filter: v-bind("styleValue.tabsTextBackgroundBlurHover");
          background-position: v-bind("styleValue.tabsBackgroundPositionHover");
          align-items: v-bind("styleValue.verticalAlignHover");

          span,
          input {
            color: v-bind("styleValue.tabsTextColorHover");
            font-size: v-bind("styleValue.tabsTextSizeHover");
            font-family: v-bind("styleValue.tabsTextFamilyHover");
            font-weight: v-bind("styleValue.tabsTextBoldHover");
            font-style: v-bind("styleValue.tabsTextItalicHover");
            text-align: v-bind("styleValue.textAlignHover");
            text-shadow: v-bind("styleValue.textShadowHover");
            transform: v-bind("styleValue.tabsTextOffsetHover");
            display: v-bind("styleValue.tabsTextDisplayHover");
          }

          div {
            border-image-source: v-bind("styleValue.borderImageSourceHover");
            border-image-slice: v-bind("styleValue.borderImageSliceHover");
            border-image-width: v-bind("styleValue.borderImageWidthHover");
          }
        }

        &.selected {
          background-color: v-bind("styleValue.tabsBackgroundColorSelected");
          border: v-bind("styleValue.textBorderSelected");
          border-radius: v-bind("styleValue.tabsBorderRadiusSelected");
          background-image: v-bind("styleValue.tabsTextBackgroundImageSelected");
          background-size: v-bind("styleValue.tabsTextBackgroundSizeSelected");
          background-repeat: v-bind("styleValue.tabsTextBackgroundRepeatSelected");
          backdrop-filter: v-bind("styleValue.tabsTextBackgroundBlurSelected");
          background-position: v-bind("styleValue.tabsBackgroundPositionSelected");
          align-items: v-bind("styleValue.verticalAlignSelected");

          span,
          input {
            color: v-bind("styleValue.tabsTextColorSelected");
            font-size: v-bind("styleValue.tabsTextSizeSelected");
            font-family: v-bind("styleValue.tabsTextFamilySelected");
            font-weight: v-bind("styleValue.tabsTextBoldSelected");
            font-style: v-bind("styleValue.tabsTextItalicSelected");
            text-align: v-bind("styleValue.textAlignSelected");
            text-shadow: v-bind("styleValue.textShadowSelected");
            transform: v-bind("styleValue.tabsTextOffsetSelected");
            display: v-bind("styleValue.tabsTextDisplaySelected");
          }
          div {
            border-image-source: v-bind("styleValue.borderImageSourceSelected");
            border-image-slice: v-bind("styleValue.borderImageSliceSelected");
            border-image-width: v-bind("styleValue.borderImageWidthSelected");
          }
        }

        span,
        input {
          width: 100%;
          display: block;
          white-space: nowrap;
          z-index: var(--var-tab-z-index);
          text-align: v-bind("styleValue.textAlign");
          font-size: v-bind("styleValue.tabsTextSize");
          color: v-bind("styleValue.tabsTextColor");
          font-family: v-bind("styleValue.tabsTextFamily");
          font-weight: v-bind("styleValue.tabsTextBold");
          font-style: v-bind("styleValue.tabsTextItalic");
          text-shadow: v-bind("styleValue.textShadow");
          transform: v-bind("styleValue.tabsTextOffset");
          display: v-bind("styleValue.tabsTextDisplay");
        }

        div {
          width: 100%;
          height: 100%;
          position: absolute;
          pointer-events: none;
          border-image-source: v-bind("styleValue.borderImageSource");
          border-image-slice: v-bind("styleValue.borderImageSlice");
          border-image-width: v-bind("styleValue.borderImageWidth");
        }

        input::selection {
          background: #000;
        }
      }
    }

    .content-wrapper {
      height: calc(100% - v-bind("styleValue.totalHeight"));
      position: relative;

      .vn-stack-layer {
        height: 100%;

        .tab-panel {
          position: static !important;
          height: 100% !important;
          width: 100% !important;
        }
      }
    }
  }
}
</style>
