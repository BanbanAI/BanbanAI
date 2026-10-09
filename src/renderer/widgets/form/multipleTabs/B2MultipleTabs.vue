<template>
  <b2-form-element class="multiple-tabs">
    <vn-stack class="custom-tabs" ref="myStackRef" v-if="widget.tabPanels && widget.tabPanels.length" :activeName="null" :modelValue="widget.selectTabValue" @mouseenter.stop="(w=widget as any) => (hoverWidget = w)" @click="(w=widget as any) => (selectedWidgets = [w])">
      <div class="header-gap">
        <div
          class="custom-tabs-header"
          :class="{
            'title-center': widget.tabsTitleStyle.tabsAlign === 'center',
            'title-left': widget.tabsTitleStyle.tabsAlign === 'left',
            'mobile': isMobileDevice,
            'compact': isCompact,
          }"
          ref="titleRef"
        >
          <vn-stack-tab
            :class="['tab-header']"
            v-for="(item, index) in showPanels"
            :key="item.uid"
            :name="item.uid"
            :style="{
              ...getTabHeaderStyle(item.uid === widget.selectTabValue, index),
            }"
            @click="widget.selectTabValue = item.uid"
            :lazy="true"
          >
            <span
              ref="titleTextRef"
              :style="{
                fontFamily: widget.tabsTitleFamily.family,
                fontSize: widget.tabsTitleFamily.size + 'px',
                fontWeight: widget.tabsTitleFamily.bold ? 700 : 500,
                fontStyle: widget.tabsTitleFamily.italic ? 'italic' : 'normal',
                letterSpacing: widget.tabsTitleGap + 'px',
                display: 'inline-block',
                lineHeight: '1.5',
                zIndex: 9999,
              }"
              >{{ item.title }}</span>
            <div
              class="tab-header-bg"
              :style="{
                ...getTabBgStyle(item.uid === widget.selectTabValue),
              }"
            >
              <div class="background-show" :style="{ ... getTabBackgroundStyle(item.uid === widget.selectTabValue, index), }">
                <div v-if="widget.tabsTitleStyle.selectVal === TitleType.TITLE_4 && item.uid === widget.selectTabValue">
                  <div
                    :style="{
                      width: '20px',
                      height: '20px',
                      borderBottomLeftRadius: '10px',
                      borderLeft: `4px solid ${widget.tabsTitleColor}`,
                      borderBottom: `4px solid ${widget.tabsTitleColor}`,
                      position: 'absolute',
                      right: '-16px',
                      bottom: '0',
                    }"
                  ></div>
                  <div
                    v-if="index !== 0"
                    :style="{
                      width: '20px',
                      height: '20px',
                      borderBottomRightRadius: '10px',
                      borderRight: `4px solid ${widget.tabsTitleColor}`,
                      borderBottom: `4px solid ${widget.tabsTitleColor}`,
                      position: 'absolute',
                      left: '-16px',
                      bottom: '0',
                    }"
                  ></div>
                </div>
                <div v-if="widget.tabsTitleStyle.selectVal === TitleType.TITLE_5">
                  <div
                    v-if="index !== widget.tabsOptionList.length - 1 && item.uid === widget.selectTabValue"
                    :style="{
                      position: 'absolute',
                      width: (titleSize.height - 16)/2 + 'px',
                      height: titleSize.height - 16 + 'px',
                      backgroundColor: setColorOpacity(widget.tabsTitleColor),
                      top: 0,
                      right: -(titleSize.height - 16)/2 + 2 + 'px',
                      zIndex: item.uid === widget.selectTabValue ? 999 : undefined,
                    }"
                  ></div>
                  <div
                    v-if="index !== 0 && ((widget.tabsTitleStyle.tabsAlign === 'center' && (index === 0 || item.uid === widget.selectTabValue)) || (widget.tabsTitleStyle.tabsAlign === 'left' && item.uid === widget.selectTabValue && index !== 0))"
                    :style="{
                      position: 'absolute',
                      width: (titleSize.height - 16)/2 + 'px',
                      height: titleSize.height - 16 + 'px',
                      backgroundColor: setColorOpacity(widget.tabsTitleColor),
                      top: 0,
                      left: -(titleSize.height - 16)/2 + 2 + 'px',
                      zIndex: item.uid === widget.selectTabValue ? 999 : undefined,
                    }"
                  ></div>
                  <div
                    v-if="index === widget.tabsOptionList.length - 1 || item.uid === widget.selectTabValue"
                    :style="{
                      width: titleSize.height - 16 + 'px',
                      height: titleSize.height - 16 + 'px',
                      position: 'absolute',
                      top: 0,
                      right: -titleSize.height + 16 + 'px',
                      zIndex: item.uid === widget.selectTabValue ? 999 : undefined,
                    }"
                  >
                    <IVenIconTab5Right
                      :style="{
                        fill: item.uid === widget.selectTabValue ? widget.tabsTitleColor : setColorOpacity(widget.tabsTitleColor),
                        width: titleSize.height - 15 + 'px',
                        height: titleSize.height - 15 + 'px',
                      }"
                    />
                  </div>
                  <div
                    v-if="(widget.tabsTitleStyle.tabsAlign === 'center' && (index === 0 || item.uid === widget.selectTabValue)) || (widget.tabsTitleStyle.tabsAlign === 'left' && item.uid === widget.selectTabValue && index !== 0)"
                    :style="{
                      width: titleSize.height - 16 + 'px',
                      height: titleSize.height - 16 + 'px',
                      position: 'absolute',
                      top: 0,
                      left: -titleSize.height + 16 + 'px',
                      zIndex: item.uid === widget.selectTabValue ? 999 : undefined,
                    }"
                  >
                    <IVenIconTab5Left
                      :style="{
                        fill: item.uid === widget.selectTabValue ? widget.tabsTitleColor : setColorOpacity(widget.tabsTitleColor),
                        width: titleSize.height - 15 + 'px',
                        height: titleSize.height - 15 + 'px',
                      }"
                    />
                  </div>
                </div>
                <div v-if="widget.tabsTitleStyle.selectVal === TitleType.TITLE_6">
                  <div
                    :style="{
                      width: '20px',
                      height: '2px',
                      backgroundColor: item.uid === widget.selectTabValue ? '#ffffff' : 'transparent',
                      borderRadius: '65px',
                      position: 'absolute',
                      bottom: '4px',
                      left: 'calc(50% - 10px)',
                    }"
                  ></div>
                </div>
                <div v-if="widget.tabsTitleStyle.selectVal === TitleType.TITLE_8">
                  <div
                    :style="{
                      width: titleSize.height - 12 + 'px',
                      position: 'absolute',
                      top: 0,
                      right: -titleSize.height + 12 + 'px',
                    }"
                  >
                    <IVenIconTab8Right
                      :style="{
                        fill: item.uid === widget.selectTabValue ? widget.tabsTitleColor : setColorOpacity(widget.tabsTitleColor),
                        width: titleSize.height - 12 + 'px',
                        height: titleSize.height - 12 + 'px',
                      }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </vn-stack-tab>
          <div
            v-if="widget.tabsTitleStyle.selectVal !== TitleType.TITLE_8"
            class="tab-under-line"
            :style="{
              ...getUnderLineStyle(),
            }"
          ></div>
        </div>
      </div>
      <div v-if="widget.isEditable" class="tab-content">
        <div class="tab-pane-content">
          <tab-form-editor></tab-form-editor>
        </div>
      </div>
      <template v-else>
        <vn-stack-layer v-for="item in showPanels" :key="item.uid" :name="item.uid" :lazy="true">
          <div class="tab-content">
            <div class="tab-pane-content">
              <b2-container :container="item.container" />
            </div>
          </div>
        </vn-stack-layer>
      </template>
    </vn-stack>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { ACTIVE_WIDGET, HOVER_WIDGET, SELECTED_WIDGETS } from "@renderer/types/inject";
import { FormElement } from "@renderer/b2/controllers/form";
import { WidgetSoul } from "@common/types/project";
import { TabsPaneContext } from "element-plus";
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { MultipleTabs } from "./multipleTabs";
import { TitleType } from "./type";
import TabFormEditor from "./TabFormEditor.vue";
import IVenIconTab8Right from "~icons/ven-icon/widget-form-multiple-tabs-tab-8-right";
import IVenIconTab5Right from "~icons/ven-icon/widget-form-multiple-tabs-tab-5-right";
import IVenIconTab5Left from "~icons/ven-icon/widget-form-multiple-tabs-tab-5-left";
import { boolean } from "mathjs";

const isMobileDevice = isMobile();

const widget = useWidget<MultipleTabs>();
const selectedWidgets = inject(SELECTED_WIDGETS);
const hoverWidget = inject(HOVER_WIDGET);

const myStackRef = ref()
const titleRef = ref();
const titleTextRef = ref();
const isCompact = ref(false);
const titleSize = ref<{
  width: number,
  height: number,
}>({
  width: 18,
  height: 36
});

const showPanels = computed(() => {
  return widget.tabPanels.filter(item => !item.isHidden)
})

// 标签未选中tab的文字颜色
const getUnselectTabColor = () => {
  let color = "#111111";
  if (
    widget.tabsTitleStyle.selectVal === TitleType.TITLE_5 ||
    widget.tabsTitleStyle.selectVal === TitleType.TITLE_7 ||
    widget.tabsTitleStyle.selectVal === TitleType.TITLE_8
  ) {
    color = widget.tabsTitleColor;
  }
  return color;
};
// 标签选中tab的文字颜色
const getSelectTabColor = () => {
  nextTick(() => {
    if (
      widget.tabsTitleStyle.selectVal === TitleType.TITLE_4 ||
      widget.tabsTitleStyle.selectVal === TitleType.TITLE_5 ||
      widget.tabsTitleStyle.selectVal === TitleType.TITLE_6 ||
      widget.tabsTitleStyle.selectVal === TitleType.TITLE_7 ||
      widget.tabsTitleStyle.selectVal === TitleType.TITLE_8
    ) {
      let activeColor = widget.tabsTitleFamily.color === widget.tabsTitleColor ? "#FFFFFF" : widget.tabsTitleFamily.color
      widget.tabsTitleFamily = {
        family: widget.tabsTitleFamily.family,
        size: widget.tabsTitleFamily.size,
        color: activeColor,
        bold: widget.tabsTitleFamily.bold,
        italic: widget.tabsTitleFamily.italic,
        underline: widget.tabsTitleFamily.underline,
        "line-through": widget.tabsTitleFamily["line-through"],
      };
    } else {
      widget.tabsTitleFamily = {
        family: widget.tabsTitleFamily.family,
        size: widget.tabsTitleFamily.size,
        color: widget.tabsTitleFamily.color,
        bold: widget.tabsTitleFamily.bold,
        italic: widget.tabsTitleFamily.italic,
        underline: widget.tabsTitleFamily.underline,
        "line-through": widget.tabsTitleFamily["line-through"],
      };
    }
  });
};
// 标签文字样式tab-header
const getTabHeaderStyle = (isActive: boolean, index?: number) => {
  let headerStyle = {}
  if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_1) {
    headerStyle = {
      marginRight: '16px',
      color: isActive ? widget.tabsTitleFamily.color : getUnselectTabColor(),
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_2) {
    headerStyle = {
      marginRight: '16px',
      padding: '0 8px',
      height: '100%',
      color: isActive ? widget.tabsTitleFamily.color : getUnselectTabColor(),
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_3 || widget.tabsTitleStyle.selectVal === TitleType.TITLE_6 || widget.tabsTitleStyle.selectVal === TitleType.TITLE_7) {
    headerStyle = {
      padding: '10px 20px',
      height: '100%',
      color: isActive ? widget.tabsTitleFamily.color : getUnselectTabColor(),
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_4) {
    headerStyle = {
      padding: '8px 15px',
      height: '100%',
      color: isActive ? widget.tabsTitleFamily.color : getUnselectTabColor(),
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_5) {
    headerStyle = {
      padding: getTab5Padding(isActive, index),
      margin: getTab5Margin(isActive, index),
      height: '100%',
      color: isActive ? widget.tabsTitleFamily.color : getUnselectTabColor(),
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_8) {
    headerStyle = {
      padding: '10px 0px 10px 8px',
      marginRight: titleSize.value.height - 16 + 'px',
      height: '100%',
      color: isActive ? widget.tabsTitleFamily.color : getUnselectTabColor(),
    }
  }
  return headerStyle
}

const getTab5Padding = (isActive: boolean, index: number) => {
  if (isActive) {
    if (widget.tabsTitleStyle.tabsAlign === "left" && index === 0) {
      return "10px 10px 10px 20px";
    } else {
      return "10px 10px";
    }
  } else if (index === widget.tabsOptionList.length - 1) {
    return "10px 10px 10px 20px";
  } else if (index === 0) {
    return "10px 20px 10px 10px";
  } else {
    return "10px 20px";
  }
};
const getTab5Margin = (isActive: boolean, index: number) => {
  if (isActive) {
    if (widget.tabsTitleStyle.tabsAlign === "left" && index === 0) {
      return `0 ${titleSize.value.height/2 - 10}px 0 0`;
    } else {
      return `0 ${titleSize.value.height/2 - 10}px`;
    }
  } else if (index === widget.tabsOptionList.length - 1) {
    return `0 ${titleSize.value.height/2 - 10}px 0 0`;
  } else {
    return "";
  }
};

// tab标签头tab-under-line样式
const getUnderLineStyle = () => {
  let lineStyle = {};
  if (
    widget.tabsTitleStyle.selectVal === TitleType.TITLE_1 ||
    widget.tabsTitleStyle.selectVal === TitleType.TITLE_2
  ) {
    lineStyle = {
      width: "100%",
      height: "2px",
      backgroundColor: "#0873FF33",
      position: "absolute",
      bottom: 0,
    };
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_3) {
    lineStyle = {
      width: "100%",
      height: "1px",
      backgroundColor: "#1414141A",
      position: "absolute",
      bottom: "5px",
    };
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_4) {
    lineStyle = {
      width: "100%",
      height: "4px",
      backgroundColor: widget.tabsTitleColor,
      position: "absolute",
      bottom: "4px",
    };
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_5) {
    lineStyle = {
      width: "100%",
      height: "4px",
      backgroundColor: widget.tabsTitleColor,
      position: "absolute",
      bottom: "6px",
    };
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_6) {
    lineStyle = {
      width: "100%",
      height: "1px",
      backgroundColor: "#1414141A",
      position: "absolute",
      bottom: "6px",
    };
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_7) {
    lineStyle = {
      width: "100%",
      height: "1px",
      backgroundColor: "#1414141A",
      position: "absolute",
      bottom: "6px",
    };
  }
  return lineStyle;
};

// tab标签tab-header-bg样式
const getTabBgStyle = (isActive: boolean) => {
  let bgStyle = {};
  if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_1 || widget.tabsTitleStyle.selectVal === TitleType.TITLE_2) {
    bgStyle = {
      width: '100%',
      height: '2px',
      backgroundColor: isActive ? widget.tabsTitleColor : 'transparent',
      position: 'absolute',
      left: 0,
      bottom: 0,
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_3) {
    bgStyle = {
      width: '100%',
      position: 'absolute',
      left: 0,
      bottom: '-2px',
      zIndex: '99',
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_4 || widget.tabsTitleStyle.selectVal === TitleType.TITLE_6 || widget.tabsTitleStyle.selectVal === TitleType.TITLE_7 || widget.tabsTitleStyle.selectVal === TitleType.TITLE_8) {
    bgStyle = {
      width: '100%',
      backgroundColor: 'transparent',
      position: 'absolute',
      left: 0,
      bottom: 0,
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_5) {
    bgStyle = {
      width: '100%',
      position: 'absolute',
      left: 0,
      bottom: '0',
      backgroundColor: isActive ? setColorOpacity(widget.tabsTitleColor) : 'transparent',
    }
  }
  return bgStyle;
}

// tab标签background-show样式
const getTabBackgroundStyle = (isActive: boolean, index?: number) => {
  let backgroundStyle = {}
  if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_2) {
    backgroundStyle  = {
      width: '100%',
      height: titleSize.value.height + 'px',
      backgroundColor: isActive ? setColorOpacity(widget.tabsTitleColor) : 'transparent',
      position: 'absolute',
      top: -titleSize.value.height + 'px',
      borderTopLeftRadius: '4px',
      borderTopRightRadius: '4px',
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_3) {
    backgroundStyle  = {
      width: '100%',
      height: titleSize.value.height - 12 + 'px',
      position: 'absolute',
      bottom: '8px',
      borderRadius: '8px',
      border: isActive ? `1.5px solid ${widget.tabsTitleColor}` : 'transparent',
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_4) {
    backgroundStyle  = {
      width: '100%',
      height: titleSize.value.height - 8 + 'px',
      backgroundColor: isActive ? widget.tabsTitleColor : 'transparent',
      position: 'absolute',
      bottom: '4px',
      borderTopLeftRadius: '8px',
      borderTopRightRadius: '8px',
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_5) {
    backgroundStyle  = {
      width: '100%',
      height: titleSize.value.height - 12 + 'px',
      backgroundColor: isActive ? widget.tabsTitleColor : setColorOpacity(widget.tabsTitleColor),
      position: 'absolute',
      bottom: '6px',
      borderTopLeftRadius: widget.tabsTitleStyle.tabsAlign === 'left' && index === 0 ? '8px' : '',
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_6) {
    backgroundStyle  = {
      width: '100%',
      height: titleSize.value.height - 12 + 'px',
      backgroundColor: isActive ? widget.tabsTitleColor : 'transparent',
      position: 'absolute',
      bottom: '6px',
      borderRadius: titleSize.value.height - 12 + 'px',
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_7) {
    backgroundStyle  = {
      width: '100%',
      height: titleSize.value.height - 12 + 'px',
      backgroundColor: isActive ? widget.tabsTitleColor : setColorOpacity(widget.tabsTitleColor),
      position: 'absolute',
      bottom: '6px',
      borderTopLeftRadius: '12px',
      borderTopRightRadius: '12px',
    }
  } else if (widget.tabsTitleStyle.selectVal === TitleType.TITLE_8) {
    backgroundStyle  = {
      width: '100%',
      height: titleSize.value.height - 12 + 'px',
      backgroundColor: isActive ? widget.tabsTitleColor : setColorOpacity(widget.tabsTitleColor),
      position: 'absolute',
      bottom: '6px',
      borderTopLeftRadius: '8px',
      borderBottomLeftRadius: '8px',
    }
  }
  return backgroundStyle
}

// 第一次刷新获取宽高
const observer = new ResizeObserver((entries) => {
  for (let entry of entries) {
    const width = entry.target.clientWidth;
    isCompact.value = width > 0 && width < 420;
    titleSize.value = {
      width,
      height: entry.target.clientHeight,
    };
  }
})

// 获取tab宽高
const getTabSize = () => {
  setTimeout(async () => {
    await nextTick(() => {
      if (titleRef.value && titleRef.value.offsetWidth && titleRef.value.offsetHeight) {
        titleSize.value = {
          width: titleRef.value.offsetWidth,
          height: titleRef.value.offsetHeight,
        };
      }
    })
  }, 0);
}

onMounted(() => {
  if (titleRef.value) {
    observer.observe(titleRef.value);
  }
  // 监听title组件，计算每个tab样式需要用的宽高
  watch(titleRef, () => {
    getTabSize()
  }, { immediate: true })
  watch(() => widget.selectTabValue, () => {
    getTabSize()
  });
  watch(
    () => widget.tabsTitleStyle,
    () => {
      getSelectTabColor();
      getTabSize()
    }
  );
  watch(() => widget.tabsTitleColor, () => {
    getTabSize()
  })
  watch(() => widget.tabsTitleFamily, () => {
    getTabSize()
  })
  watch(() => widget.tabsTitleGap, () => {
    getTabSize()
  })
  watch(() => widget.tabsOptionContent, () => {
    getTabSize()
  })
});


// 颜色透明度
onUnmounted(() => {
  observer.disconnect();
});

const setColorOpacity = (colorVal: string) => {
  let opacityColor = colorVal;
  if (colorVal.length === 9) {
    opacityColor = colorVal.slice(0, -2) + "1A";
  } else if (colorVal.length === 7) {
    opacityColor = colorVal + "1A";
  }
  return opacityColor;
};
</script>

<style lang="scss" scoped>

.title-center {
  text-align: center;
  justify-content: center;
}

.title-left {
  align-items: flex-start;
  text-align: left;
}

.multiple-tabs {
  .custom-tabs {
    .header-gap {
      margin-bottom: 8px;
      // height: auto;
      pointer-events: all;
      position: relative;

      .custom-tabs-header {
        display: flex;
        width: 100%;

        &.mobile,
        &.compact {
          white-space: nowrap;
          overflow-x: auto;
          justify-content: flex-start;
          &::-webkit-scrollbar {
            display: none;
          }
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .tab-header {
          position: relative;
          flex-shrink: 0;

          &:hover {
            cursor: var(--cursor-pointer);
          }
        }
      }
    }
    :deep(.tab-content) {
      width: 100%;
      min-height: 228px;
      .tab-pane-content {
        pointer-events: all;
        width: 100%;
        min-height: 228px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        .b2widget {
          position: static !important;
          height: auto !important;
          .background {
            display: none !important;
          }
        }
      }
    }
  }
}
</style>
