<template>
  <b2-form-element class="title-bar">
    <div
      class="text-title-bar"
      :class="{
        'mobile': isMobileDevice,
        'align-items': [TitleType.TITLE_8].includes(widget.titleBorderStyle.selectVal as TitleType)
      }"
      v-if="widget.titleBarType === 'border-title'"
      :style="{
        minHeight: titleBarHeight() + 'px',
        lineHeight: titleBarHeight() + 'px',
        backgroundColor:
          widget.titleBorderStyle.selectVal === TitleType.TITLE_8
            ? setColorOpacity2(widget.titleBorderColor)
            : '',
      }"
    >
      <div
        class="title-text"
        :class="{
          'title-center': widget.titleBorderStyle.titleAlign === 'center',
          'title-left': widget.titleBorderStyle.titleAlign === 'left',
        }"
        :style="{
          minHeight: titleTextHaveMinHeight() ? titleBarHeight() + 'px' : '',
        }"
      >
        <div v-if="widget.titleBorderStyle.selectVal === TitleType.TITLE_12">
          <div
            :style="{
              width: '100%',
              height: underBgBottomHeight() + 'px',
              backgroundColor: setColorOpacity2(widget.titleBorderColor),
              position: 'absolute',
              left: '0',
              top: '-4px',
            }"
          >
            <div
              :style="{
                width: '100%',
                height: '17%',
                backgroundColor: widget.titleBorderColor,
                position: 'absolute',
                top: '0',
              }"
            ></div>
          </div>
        </div>
        <div
          class="title-value"
          ref="showTitleRef"
          :style="{
            position: titleTextTop() ? 'absolute' : undefined,
            top: titleTextTop(),
            paddingLeft: titleTextLeftPadding(),
            paddingRight: titleTextRightPadding(),
            borderLeft:
              widget.titleBorderStyle.selectVal === TitleType.TITLE_8
                ? '2px solid'
                : '',
            borderRight:
              widget.titleBorderStyle.selectVal === TitleType.TITLE_8 &&
              widget.titleBorderStyle.titleAlign === 'center'
                ? '2px solid'
                : '',
            borderColor: widget.titleBorderColor,
          }"
        >
          <span
            :style="{
              fontFamily: widget.titleFamily.family,
              fontSize: widget.titleFamily.size + 'px',
              fontWeight: widget.titleFamily.bold ? 700 : 400,
              color: widget.titleFamily.color,
              fontStyle: widget.titleFamily.italic ? 'italic' : 'normal',
              letterSpacing: widget.titleGap + 'px',
            }"
            >{{ widget.inputValue }}</span
          >
        </div>
        <div
          v-if="showUnderBg()"
          class="title-bg-box"
          :class="border5MaskClass"
          :style="{
            width: showTitleWidth + 'px',
            height: underBgBottomHeight() + 'px',
            lineHeight: '1',
            marginBottom: -titleBorderGap + 8 + 'px',
            backgroundColor:
              widget.titleBorderStyle.selectVal === TitleType.TITLE_5
                ? '#ffffffff'
                : '',
            left:
              widget.titleBorderStyle.selectVal === TitleType.TITLE_7 &&
              widget.titleBorderStyle.titleAlign === 'left'
                ? '1px'
                : '',
            zIndex: 10,
            ...underBgSpace(),
          }"
        >
          <!-- 背景框 -->
          <div
            :class="border5MaskClass"
            :style="{
              height: underBgBottomHeight() + 'px',
              width: showTitleWidth + 'px',
              backgroundColor:
                widget.titleBorderStyle.selectVal === TitleType.TITLE_5
                  ? '#fff'
                  : widget.titleBorderColor,
              borderTopRightRadius: underBgTopRadius(),
              borderTopLeftRadius:
                widget.titleBorderStyle.titleAlign === 'center' ||
                widget.titleBorderStyle.selectVal === TitleType.TITLE_3 ||
                widget.titleBorderStyle.selectVal === TitleType.TITLE_7
                  ? underBgTopRadius()
                  : '0',
              borderBottomRightRadius: underBgBottomRadius(),
              borderBottomLeftRadius:
                widget.titleBorderStyle.titleAlign === 'center' ||
                widget.titleBorderStyle.selectVal === TitleType.TITLE_3 ||
                widget.titleBorderStyle.selectVal === TitleType.TITLE_7
                  ? underBgBottomRadius()
                  : '0',
              borderBottom:
                widget.titleBorderStyle.selectVal === TitleType.TITLE_5
                  ? '2px solid'
                  : '',
              borderColor: widget.titleBorderColor,
              opacity: underBgOpacity(),
            }"
          ></div>
          <div v-if="widget.titleBorderStyle.selectVal === TitleType.TITLE_5">
            <div
              :class="border5MaskClass"
              :style="{
                width: titleBarHeight() + 'px',
                height: titleBarHeight() + 'px',
                position: 'absolute',
                top: '-4px',
                right: -computeLineSpace(titleBarHeight()) + 2 + 'px',
                backgroundColor: '#fff',
                zIndex: 999,
              }"
            ></div>
            <div
              :class="border5MaskClass"
              v-if="widget.titleBorderStyle.titleAlign === 'center'"
              :style="{
                width: titleBarHeight() + 'px',
                height: titleBarHeight() + 'px',
                position: 'absolute',
                top: '-4px',
                left: -computeLineSpace(titleBarHeight()) + 2 + 'px',
                backgroundColor: '#fff',
                zIndex: 999,
              }"
            ></div>
            <div
              class="oblique-left-line"
              :style="{
                width: titleBarHeight() + 2 + 'px',
                position: 'absolute',
                left:
                  -computeLineSpace(titleBarHeight()) -
                  titleBarHeight() / 8 -
                  1 +
                  'px',
                bottom: titleBarHeight() / 4 + titleBarHeight() / 8 - 1 + 'px',
                backgroundColor: setColorOpacity2(widget.titleBorderColor),
                zIndex: 999,
                display:
                  widget.titleBorderStyle.titleAlign === 'left'
                    ? 'none'
                    : 'block',
              }"
            ></div>
            <div
              class="oblique-right-line"
              :style="{
                width: titleBarHeight() + 2 + 'px',
                position: 'absolute',
                right:
                  -computeLineSpace(titleBarHeight()) -
                  titleBarHeight() / 8 -
                  1 +
                  'px',
                backgroundColor: setColorOpacity2(widget.titleBorderColor),
                bottom: titleBarHeight() / 4 + titleBarHeight() / 8 - 1 + 'px',
                zIndex: 999,
              }"
            ></div>
          </div>
          <div v-if="widget.titleBorderStyle.selectVal === TitleType.TITLE_7">
            <div
              :style="{
                position: 'absolute',
                top: '-1px',
                left: '-1px',
                width: '12px',
                height: '12px',
                borderTopLeftRadius: '5px',
                borderTop: '2px solid',
                borderLeft: '2px solid',
                borderColor: widget.titleBorderColor,
              }"
            ></div>
            <div
              :style="{
                position: 'absolute',
                bottom: '-1px',
                right: '-1px',
                width: '12px',
                height: '12px',
                borderBottomRightRadius: '5px',
                borderRight: '2px solid',
                borderBottom: '2px solid',
                borderColor: widget.titleBorderColor,
              }"
            ></div>
          </div>
          <div v-if="widget.titleBorderStyle.selectVal === TitleType.TITLE_10">
            <div
              class="left-triangle"
              :style="{
                borderRight: `${titleBarHeight() / 2}px solid`,
                borderTop: `${titleBarHeight() / 2}px solid transparent`,
                borderBottom: `${titleBarHeight() / 2}px solid transparent`,
                position: 'absolute',
                left: `${-titleBarHeight() / 2 + 0.5}px`,
                top: '0',
                borderRightColor: widget.titleBorderColor,
                display:
                  widget.titleBorderStyle.titleAlign === 'left'
                    ? 'none'
                    : 'block',
              }"
            ></div>
            <div
              class="right-triangle"
              :style="{
                borderLeft: `${titleBarHeight() / 2}px solid`,
                borderTop: `${titleBarHeight() / 2}px solid transparent`,
                borderBottom: `${titleBarHeight() / 2}px solid transparent`,
                position: 'absolute',
                right: `${-titleBarHeight() / 2 + 0.5}px`,
                borderLeftColor: widget.titleBorderColor,
                top: '0',
              }"
            ></div>

            <div
              :style="{
                width: '20px',
                height: '18px',
                overflow: 'hidden',
                backgroundColor: '#fafafa',
                position: 'absolute',
                left: `${-titleBarHeight() / 2 - 20}px`,
                top: `${titleBarHeight() / 2 - 9}px`,
                zIndex: 99,
                display:
                  widget.titleBorderStyle.titleAlign === 'left'
                    ? 'none'
                    : 'block',
              }"
            >
              <div
                class="right-big-line-triangle"
                :style="{
                  position: 'absolute',
                  top: '3px',
                  borderColor: widget.titleBorderColor,
                  right: '-5px',
                  transform: 'rotate(225deg)',
                }"
              ></div>
              <div
                class="right-small-line-triangle"
                :style="{
                  position: 'absolute',
                  borderColor: widget.titleBorderColor,
                  left: '3px',
                  top: '5px',
                  transform: 'rotate(225deg)',
                }"
              ></div>
            </div>
            <div
              :style="{
                width: '20px',
                height: '18px',
                overflow: 'hidden',
                backgroundColor: '#fafafa',
                position: 'absolute',
                right: `${-titleBarHeight() / 2 - 20}px`,
                top: `${titleBarHeight() / 2 - 9}px`,
                zIndex: 99,
              }"
            >
              <div
                class="right-big-line-triangle"
                :style="{
                  position: 'absolute',
                  top: '3px',
                  borderColor: widget.titleBorderColor,
                  left: '-5px',
                  transform: 'rotate(45deg)',
                }"
              ></div>
              <div
                class="right-small-line-triangle"
                :style="{
                  position: 'absolute',
                  borderColor: widget.titleBorderColor,
                  right: '3px',
                  top: '5px',
                  transform: 'rotate(45deg)',
                }"
              ></div>
            </div>
          </div>
          <div v-if="widget.titleBorderStyle.selectVal === TitleType.TITLE_11">
            <div
              class="right-bottom-triangle"
              :style="{
                position: 'absolute',
                left: '-12px',
                top: '0',
                borderBottomColor: widget.titleBorderColor,
                display:
                  widget.titleBorderStyle.titleAlign === 'left'
                    ? 'none'
                    : 'block',
              }"
            ></div>
            <div
              class="right-bottom-triangle"
              :style="{
                position: 'absolute',
                left: '-12px',
                top: '0',
                borderBottomColor: 'rgba(0,0,0,0.2)',
                display:
                  widget.titleBorderStyle.titleAlign === 'left'
                    ? 'none'
                    : 'block',
              }"
            ></div>
            <div
              class="left-bottom-triangle"
              :style="{
                position: 'absolute',
                left: showTitleWidth + 'px',
                borderBottomColor: widget.titleBorderColor,
                top: '0',
              }"
            ></div>
            <div
              class="left-bottom-triangle"
              :style="{
                position: 'absolute',
                left: showTitleWidth + 'px',
                borderBottomColor: 'rgba(0,0,0,0.2)',
                top: '0',
              }"
            ></div>
          </div>
          <div v-if="widget.titleBorderStyle.selectVal === TitleType.TITLE_12">
            <div
              :style="{
                width: '20px',
                height: '20px',
                borderTopRightRadius: '12px',
                borderRight: '4px solid',
                borderTop: '4px solid',
                borderColor: widget.titleBorderColor,
                position: 'absolute',
                left: '-16px',
                top: underBgBottomHeight() * 0.17 - 4 + 'px',
                display:
                  widget.titleBorderStyle.titleAlign === 'left'
                    ? 'none'
                    : 'block',
              }"
            ></div>
            <div
              :style="{
                width: '20px',
                height: '20px',
                borderTopLeftRadius: '12px',
                borderLeft: '4px solid',
                borderTop: '4px solid',
                borderColor: widget.titleBorderColor,
                position: 'absolute',
                right: '-16px',
                top: underBgBottomHeight() * 0.17 - 4 + 'px',
              }"
            ></div>
          </div>
          <div v-if="widget.titleBorderStyle.selectVal === TitleType.TITLE_13">
            <div
              :style="{
                position: 'absolute',
                left: -titleBarHeight() + 'px',
                top: '-1px',
                display:
                  widget.titleBorderStyle.titleAlign === 'left'
                    ? 'none'
                    : 'block',
              }"
            >
              <IVenIconTitle13Left
                :style="{
                  fill: widget.titleBorderColor,
                  width: titleBarHeight() + 'px',
                  height: titleBarHeight() + 'px',
                }"
              />
            </div>
            <div
              :style="{
                position: 'absolute',
                right: -titleBarHeight() + 'px',
                top: '-1px',
              }"
            >
              <IVenIconTitle13Right
                :style="{
                  fill: widget.titleBorderColor,
                  width: titleBarHeight() + 'px',
                  height: titleBarHeight() + 'px',
                }"
              />
            </div>
          </div>
        </div>
        <div
          v-if="widget.titleBorderStyle.selectVal === TitleType.TITLE_6"
          :style="{
            width: showTitleWidth + 'px',
            borderBottom: '2px solid',
            borderColor: widget.titleBorderColor,
            position: 'absolute',
            bottom: '-10px',
          }"
        ></div>
      </div>
      <div
        v-if="showUnderLine()"
        class="title-line"
        :style="{
          borderColor: widget.titleBorderColor,
          margin: underLineBottom(),
        }"
      ></div>
      <div v-if="widget.titleBorderStyle.selectVal === TitleType.TITLE_7">
        <div
          class="short-line"
          :style="{
            position: 'absolute',
            left: '0',
            bottom: '0',
            display:
              widget.titleBorderStyle.titleAlign === 'left' ? 'none' : 'block',
          }"
        ></div>
        <div
          class="short-line"
          :style="{
            position: 'absolute',
            right: '0',
            bottom: '0',
          }"
        ></div>
      </div>
    </div>
    <!-- 图文标题 -->
    <div
      class="image-title-bar"
      v-if="widget.titleBarType === 'image-text-title'"
      :class="{
        'mobile': isMobileDevice,
        'image-title-left': widget.titleAlign === 'left',
        'image-title-center': widget.titleAlign === 'center',
        'image-title-right': widget.titleAlign === 'right',
      }"
      :style="{
        backgroundColor: widget.titleBackgroundColor,
        backgroundImage: widget.titleBackgroundImg
          ? `url('${widget.titleBackgroundImg}')`
          : '',
        backdropFilter: `blur(${widget.titleBackgroundBlur}px)`,
        '-webkit-backdrop-filter': `blur(${widget.titleBackgroundBlur}px)`,
        ...bgImgStyle,
      }"
    >
      <div class="titles-gruop">
        <div
          class="main-title"
          :style="{
            fontFamily: widget.mainTitleFont.family,
            fontSize: widget.mainTitleFont.size + 'px',
            fontWeight: widget.mainTitleFont.bold ? 700 : 400,
            color: widget.mainTitleFont.color,
            fontStyle: widget.mainTitleFont.italic ? 'italic' : 'normal',
            letterSpacing: widget.mainTitleGap + 'px',
          }"
        >
          {{ widget.inputValue }}
        </div>
        <div
          class="sub-title"
          :style="{
            marginTop: widget.mainSubTitleGap + 'px',
            fontFamily: widget.subTitleFont.family,
            fontSize: widget.subTitleFont.size + 'px',
            fontWeight: widget.subTitleFont.bold ? 700 : 400,
            color: widget.subTitleFont.color,
            fontStyle: widget.subTitleFont.italic ? 'italic' : 'normal',
            letterSpacing: widget.subTitleGap + 'px',
          }"
        >
          {{ widget.defaultSubValue }}
        </div>
      </div>
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { HOVER_WIDGET, ACTIVE_WIDGET } from "@renderer/types/inject";
import { computed, nextTick, onMounted, onUnmounted, ref, unref, watch, inject } from "vue";
import { TitleBar } from "./titleBar";
import { TitleType } from "./type";
import IVenIconTitle13Left from "~icons/ven-icon/widget-form-title-bar-title-13-left";
import IVenIconTitle13Right from "~icons/ven-icon/widget-form-title-bar-title-13-right";

const isMobileDevice = isMobile();
const hoverWidget = inject(HOVER_WIDGET);
const activeWidget = inject(ACTIVE_WIDGET);
const widget = useWidget<TitleBar>();

// 是否显示横线
const showUnderLine = () => {
  if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_1 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_2 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_3 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_4 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_5 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_6 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_7 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_9 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_10 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_11 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_13
  ) {
    return true;
  } else {
    return false;
  }
};

const border5MaskClass = computed(() => {
  let maskClass = "";
  if (widget.titleBorderStyle.selectVal === TitleType.TITLE_5) {
    maskClass += "title-5-line-mask";
    if (widget.isEditable) {
      maskClass += " editable";
    }
    if (unref(hoverWidget)?.uid === widget.uid) {
      maskClass += " hover";
    }
    if (unref(activeWidget)?.uid === widget.uid) {
      maskClass += " active";
    }
  }
  return maskClass;
})

// 文字边距间距
const titleBorderGap = computed(() => {
  if ([TitleType.TITLE_1, TitleType.TITLE_2, TitleType.TITLE_3, TitleType.TITLE_4].includes(
    widget.titleBorderStyle.selectVal as TitleType)) {
    return widget.titleBorderGap - 6;
  }
  return 8;
});

// 横线所在位置
const underLineBottom = () => {
  let marginVal = "8px 0";
  if ([TitleType.TITLE_1, TitleType.TITLE_2, TitleType.TITLE_3, TitleType.TITLE_4].includes(
    widget.titleBorderStyle.selectVal as TitleType)) {
    marginVal = titleBorderGap.value === 0 || titleBorderGap.value ? titleBorderGap.value + "px 0 8px 0" : "8px 0";
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_5) {
    marginVal = titleBarHeight() / 4 - 20 + "px 0";
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_11) {
    marginVal = "-12px 0";
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_13) {
    marginVal = titleBarHeight() / 2 - 22 + "px 0";
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_10) {
    marginVal = -titleBarHeight() / 2 - 5 + "px 0";
  }
  return marginVal;
};

// 是否显示文字背景盒子
const showUnderBg = () => {
  if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_2 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_3 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_4 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_5 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_6 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_7 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_9 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_10 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_11 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_12 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_13
  ) {
    return true;
  } else {
    return false;
  }
};

// 文字背景div的bottom大小
const underBgBottom = () => {
  let bottomGap = "-10px";
  if (widget.titleBorderStyle.selectVal === TitleType.TITLE_3) {
    bottomGap = "-11px";
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_4) {
    bottomGap = "-14px";
  } else if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_11 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_12
  ) {
    bottomGap = "-12px";
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_13) {
    bottomGap = "-9px";
  }
  return bottomGap;
};

// 文字背景div的高
const underBgBottomHeight = () => {
  let heightVal;
  if (widget.titleBorderStyle.selectVal === TitleType.TITLE_2) {
    heightVal = 2;
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_3) {
    heightVal = 4;
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_4) {
    heightVal = 6;
  } else if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_5 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_6 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_7 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_9
  ) {
    heightVal = showTitleHeight.value + 12;
  } else if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_10 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_11 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_12
  ) {
    heightVal = showTitleHeight.value + 16;
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_13) {
    heightVal = showTitleHeight.value + 10;
  }

  return heightVal;
};

// 标题总高
const titleBarHeight = () => {
  let heightVal = showTitleHeight.value;
  if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_5 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_8 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_13
  ) {
    heightVal = showTitleHeight.value + 12;
  } else if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_10 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_11 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_12
  ) {
    heightVal = showTitleHeight.value + 16;
  }

  return heightVal;
};

// title-text是否需要min-heigth
const titleTextHaveMinHeight = () => {
  if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_6 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_7 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_9 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_10
  ) {
    return true;
  } else {
    return false;
  }
};

// 文字背景角圆滑度
const underBgBottomRadius = () => {
  let radiusVal = "0";
  if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_3 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_4
  ) {
    radiusVal = "100px";
  } else if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_11 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_12
  ) {
    radiusVal = "12px";
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_7) {
    radiusVal = "5px";
  }
  return radiusVal;
};
const underBgTopRadius = () => {
  let radiusVal = "0";
  if (widget.titleBorderStyle.selectVal === TitleType.TITLE_3) {
    radiusVal = "100px";
  } else if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_6 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_9
  ) {
    radiusVal = "12px";
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_7) {
    radiusVal = "5px";
  }
  return radiusVal;
};

// 文字背景透明度
const underBgOpacity = () => {
  let opacityVal = "1";
  if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_5 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_6 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_7
  ) {
    opacityVal = "0.2";
  }

  return opacityVal;
};

// 文字位置
const titleTextTop = () => {
  let topVal = "";
  if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_5 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_6 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_7 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_9 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_10 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_11 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_12 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_13
  ) {
    topVal = "6px";
  }

  return topVal;
};

// 是否内边距
const titleTextLeftPadding = () => {
  if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_6 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_7 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_8 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_9 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_10 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_11 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_12 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_13
  ) {
    return "14px";
  } else if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_5 &&
    widget.titleBorderStyle.titleAlign === "center"
  ) {
    return "14px";
  } else {
    return "0";
  }
};
const titleTextRightPadding = () => {
  if (
    widget.titleBorderStyle.selectVal === TitleType.TITLE_6 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_7 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_8 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_9 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_10 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_11 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_12 ||
    widget.titleBorderStyle.selectVal === TitleType.TITLE_13
  ) {
    return "14px";
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_5) {
    return "14px";
  } else {
    return "0";
  }
};

// 背景框位置
const underBgSpace = () => {
  if (widget.titleBorderStyle.selectVal === TitleType.TITLE_12) {
    return {
      top: "-4px",
    };
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_11) {
    return {
      top: "-4px",
    };
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_10) {
    return {
      top: "-4px",
    };
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_13) {
    return {
      top: "0px",
    };
  } else if (widget.titleBorderStyle.selectVal === TitleType.TITLE_5) {
    return {
      top: "0px",
    };
  } else {
    return {
      bottom: underBgBottom(),
    };
  }
};

const showTitleRef = ref();
const showTitleWidth = ref();
const showTitleHeight = ref();

const getTextWidth = () => {
  nextTick(() => {
    if (showTitleRef.value) {
      showTitleWidth.value = showTitleRef.value.clientWidth;
      showTitleHeight.value = showTitleRef.value.clientHeight;
      if (widget.titleBorderStyle.selectVal === TitleType.TITLE_5) {
        if (widget.titleBorderStyle.titleAlign === "left") {
          showTitleWidth.value += 8;
        } else if (widget.titleBorderStyle.titleAlign === "center") {
          showTitleWidth.value += 16;
        }
      }
    }
  });
};

// 颜色透明度设置为0.2
const setColorOpacity2 = (colorVal: string) => {
  let opacityColor = colorVal;
  if (colorVal.length === 9) {
    opacityColor = colorVal.slice(0, -2) + "33";
  } else if (colorVal.length === 7) {
    opacityColor = colorVal + "33";
  }
  return opacityColor;
};

// 标题5位置计算
const computeLineSpace = (line: number) => {
  return Math.sqrt((line * line) / 2);
};

const bgImgStyle = ref({});
const bgImgStyleChange = () => {
  nextTick(() => {
    if (widget.titleBackgroundFill === "fill") {
      bgImgStyle.value = {
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      };
    } else if (widget.titleBackgroundFill === "repeat") {
      bgImgStyle.value = {
        backgroundRepeat: "repeat",
      };
    } else if (widget.titleBackgroundFill === "auto") {
      bgImgStyle.value = {
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      };
    }
  });
};

// 第一次刷新获取宽度
const observer = new ResizeObserver((entries) => {
  for (let entry of entries) {
    showTitleWidth.value = entry.target.clientWidth;
    showTitleHeight.value = showTitleRef.value.clientHeight;
    if (widget.titleBorderStyle.selectVal === TitleType.TITLE_5) {
      if (widget.titleBorderStyle.titleAlign === "left") {
        showTitleWidth.value += 8;
      } else if (widget.titleBorderStyle.titleAlign === "center") {
        showTitleWidth.value += 16;
      }
    }
  }
});

onMounted(() => {
  // 计算文字宽度

  document.fonts.ready.then(() => {
    if (showTitleRef.value) {
      observer.observe(showTitleRef.value);
    }
  });
  bgImgStyleChange();

  observer.disconnect();
  watch(
    () => {
      const inputValue = widget.inputValue;
      if (!showTitleRef.value) return;
      return inputValue;
    },
    () => {
      getTextWidth();
    },
    {immediate: true}
  );
  watch(
    () => {
      const titleGap = widget.titleGap;
      if (!showTitleRef.value) return;
      return titleGap
    },
    () => {
      getTextWidth();
    },
    {immediate: true}
  );
  watch(
    () => widget.titleBorderStyle,
    () => {
      getTextWidth();
      // 选择边框时初始化文字颜色
      nextTick(() => {
        if (
          widget.titleBorderStyle.selectVal === TitleType.TITLE_9 ||
          widget.titleBorderStyle.selectVal === TitleType.TITLE_10 ||
          widget.titleBorderStyle.selectVal === TitleType.TITLE_11 ||
          widget.titleBorderStyle.selectVal === TitleType.TITLE_12 ||
          widget.titleBorderStyle.selectVal === TitleType.TITLE_13
        ) {
          widget.titleFamily = {
            family: widget.titleFamily.family,
            size: widget.titleFamily.size,
            color: "#FFFFFFFF",
            bold: widget.titleFamily.bold,
            italic: widget.titleFamily.italic,
            underline: widget.titleFamily.underline,
            "line-through": widget.titleFamily["line-through"],
          };
        } else {
          widget.titleFamily = {
            family: widget.titleFamily.family,
            size: widget.titleFamily.size,
            color: widget.titleBorderColor,
            bold: widget.titleFamily.bold,
            italic: widget.titleFamily.italic,
            underline: widget.titleFamily.underline,
            "line-through": widget.titleFamily["line-through"],
          };
        }
      });
    },
    {immediate: true}
  );
  watch(
    () =>{
      const titleFamily = widget.titleFamily;
      if (!showTitleRef.value) return;
      return titleFamily;
    },
    () => {
      getTextWidth();
    },
    {immediate: true}
  );

  watch(
    () => widget.titleBackgroundFill,
    () => {
      bgImgStyleChange();
    },
    {immediate: true}
  );
});

onUnmounted(() => {
  observer.disconnect();
});
</script>

<style lang="scss" scoped>
.title-center {
  text-align: center;
  // align-items: center;
  justify-content: center;
}

.title-left {
  align-items: flex-start;
  text-align: left;
}

.oblique-right-line {
  height: 2px;
  transform: rotate(135deg);
}

.oblique-left-line {
  height: 2px;
  transform: rotate(45deg);
}

.short-line {
  width: 12px;
  height: 2px;
  background-color: #0089ff;
}

.right-triangle {
  width: 0;
  height: 0;
}

.left-triangle {
  width: 0;
  height: 0;
}

.right-big-line-triangle {
  width: 12px;
  height: 12px;
  border-top: 2px solid;
  border-right: 2px solid;
}

.right-small-line-triangle {
  width: 8px;
  height: 8px;
  border-top: 2px solid;
  border-right: 2px solid;
}

.left-bottom-triangle {
  width: 0;
  height: 0;
  border-bottom: 12px solid;
  border-right: 12px solid transparent;
}

.right-bottom-triangle {
  width: 0;
  height: 0;
  border-bottom: 12px solid;
  border-left: 12px solid transparent;
}

.align-items {
  display: flex;
  align-items: center;
}

.title-5-line-mask.editable {
  &.hover, &.active {
    background-color: var(--bg-color-overlay) !important;
  }
}

.title-bar {
  // 边框标题
  .text-title-bar {
    position: relative;
    .title-text {
      min-height: 20px;
      width: 100%;
      position: relative;
      display: flex;
      .title-value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-height: 20px;
        line-height: 1.5;
        max-width: 76%;
        z-index: 999;
      }
      .title-bg-box {
        position: absolute;
      }
    }
    .title-line {
      width: 100%;
      margin: 8px 0;
      border: 1px solid;
      opacity: 0.2;
    }
  }

  // 图文标题
  .image-title-bar {
    width: 100%;
    min-height: 92px;
    padding: 17px 0;
    display: flex;
    align-items: center;
    line-height: 1;
    .titles-gruop {
      .main-title {
        width: 100%;
        margin-top: 10px;
      }

      .sub-title {
        width: 100%;
      }
    }

    &.mobile {
      min-height: 60px;
      padding: 10px 0;
      .titles-gruop {
        .main-title {
          margin-top: 0;
        }
      }
    }
  }

  // 图文对齐样式
  .image-title-left {
    justify-content: flex-start;
    text-align: left;
  }
  .image-title-center {
    justify-content: center;
    text-align: center;
  }
  .image-title-right {
    justify-content: flex-end;
    text-align: right;
  }
}
</style>
