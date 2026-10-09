<template>
  <b2-widget :class="{'is-hidden': formElement.isHidden, 'show-hidden-style': formElement.getOption<boolean>('is-hidden'), 'form-design': formElement.isEditable}">
    <div class="header" v-if="!formElement.isInSubForm">
      <div class="header-title">
        <span class="header-required" v-if="formElement.isRequired && !formElement.isReadonly">*</span>
        <div class="header-title-text" v-if="formElement.showTitle" :title="formElement.title">{{ formElement.title }}</div>
        <span class="header-description-tooltip" v-if="formElement.showDescription && formElement.descriptionLayout === 'tooltip'">
          <el-tooltip
            effect="light" :disabled="!formElement.descriptionContent"
            show-arrow placement="top" :trigger="isMobileDevice ? 'click' : 'hover'"
            popper-class="header-description-tooltip-popper"
          >
            <template #content>
              <div class="header-description-tooltip-content" v-html="formElement.descriptionContent"></div>
            </template>
            <el-icon size="14"><i-nocode-data-source-form-question/></el-icon>
          </el-tooltip>
        </span>
        <template v-if="formElement.isEditable">
          <el-icon v-if="isHiddenValue" size="14"><i-ep-hide /></el-icon>
          <!-- 被联动的字段显示图标 -->
          <el-icon v-if="formElement.isLinkage" size="14" :class="{active: formElement.isLinkageHighLight === 'in'}" @click="showLinkageWidget('in')"><i-ven-widget-be-linkaged /></el-icon>
          <!-- 联动触发字段显示图标 -->
          <el-icon v-if="formElement.isLinkageTrigger" size="14" :class="{active: formElement.isLinkageHighLight === 'out'}" @click="showLinkageWidget('out')"><i-ven-widget-linkage /></el-icon>
           <!-- 被显隐控制的字段显示图标 -->
          <el-icon v-if="formElement.isVisibleControl" size="14" @click="showVisibleWidget('in')" :class="{active: formElement.isVisibleHighLight === 'in'}"><i-ven-widget-be-visibled /></el-icon>
          <!-- 显隐控制触发字段显示图标 -->
          <el-icon v-if="formElement.isVisibleTrigger" size="14" @click="showVisibleWidget('out')" :class="{active: formElement.isVisibleHighLight === 'out'}"><i-ven-widget-visible /></el-icon>
        </template>
      </div>
      <div class="header-description" v-if="formElement.showDescription && formElement.descriptionLayout === 'block'" v-html="formElement.descriptionContent"></div>
    </div>
    <div
      class="content-container"
      :class="{'form-detail-viewing': formElement.topForm?.isViewing}"
      :style="{width: formElement.inputWidthStyle}"
    >
      <el-tooltip
        :disabled="!formElement.validationError || !formElement.isInSubForm"
        :content="formElement.validationError"
        placement="top-start"
        effect="light"
        :teleported="true"
        :show-arrow="false"
        :offset="6"
        popper-class="container-error-tooltip-popper"
      >
        <div
          class="container"
          :class="{'validation-error': formElement.validationError}"
          :title="formElement.validationError || null"
        >
          <slot></slot>
        </div>
      </el-tooltip>
    </div>
    <div
      class="footer"
      v-if="formElement.validationError && !formElement.isInSubForm"
      :title="formElement.validationError"
      :style="{width: formElement.inputWidthStyle}"
    >
      <span>{{ formElement.validationError }}</span>
    </div>
  </b2-widget>
</template>
<script lang="ts" setup>
import { computed } from 'vue';
import { useWidget } from './types';
import { FormElement } from '@renderer/b2/controllers/form';
import { isMobile } from '@renderer/utils';

const isMobileDevice = isMobile();

const formElement = useWidget<FormElement>();

const isHiddenValue = computed(() => {
  if (formElement.isVisibleControl && !formElement.getOption<boolean>('is-hidden')) {
    return false;
  } else {
    return formElement.isHidden;
  }
})

const showLinkageWidget = (type) => {
  if(formElement.topForm.linkageHighLightWidget.value?.uid === formElement.uid && formElement.topForm.linkageHighLightWidget.value?.type === type) {
    formElement.topForm.linkageHighLightWidget.value = null
    return
  };
  formElement.topForm.linkageHighLightWidget.value = {
    uid: formElement.uid,
    type: type
  };
}

const showVisibleWidget = (type) => {
  if(formElement.topForm.visibleHighLightWidget.value?.uid === formElement.uid && formElement.topForm.visibleHighLightWidget.value?.type === type) {
    formElement.topForm.visibleHighLightWidget.value = null
    return
  };
  formElement.topForm.visibleHighLightWidget.value = {
    uid: formElement.uid,
    type: type
  };
}
</script>

<style lang="scss" scoped>
.b2widget{
  padding: var(--table-cell-padding, 10px);
  overflow: visible;
}
.header {
  margin-bottom: 4px;
  .header-title {
    display: flex;
    align-items: center;
    position: relative;
    min-width: 0;
    pointer-events: all;
    line-height: 20px;
    column-gap: 5px;
    .header-required {
      position: absolute;
      left: -8px;
      line-height: 1;
      color: var(--el-color-danger);
      font-size: 14px;
      font-family: "Segoe UI";
    }

    .header-title-text {
      display: block;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      font-weight: bold;
      color: var(--text-color-primary);
    }

    .el-icon {
      color: #86909C;
      pointer-events: all !important;
      cursor: pointer;

      &.active {
        color: var(--primary-color);
      }
    }
  }

  :deep(.header-description) {
    word-break: break-word;
    color: #838892;
    line-height: 1.4;

    ul, ol {
      margin: 0;
      list-style-position: outside;
    }

    ul {
      list-style: disc;
      padding-left: 16px;
    }

    ol {
      list-style: decimal;
      padding-left: 10px;
    }

    li {
      margin-bottom: 4px;
    }
  }

  :deep(.header-description-tooltip) {
    height: 100%;
    line-height: 100%;
    padding-top: 1px;
    .el-icon {
      width: 18px;
      height: 100%;
    }
  }
}
.content-container {
  max-width: 100%;
  display: flex;
  align-items: start;

  .container {
    width: 100%;
    flex: 1;
  }

  &.form-detail-viewing {
    :deep(.value) {
      height: auto;
      min-height: 32px;
      overflow: visible;
      text-overflow: clip;
      white-space: normal;
      word-break: break-all;

      .value-wrapper,
      > span,
      > div,
      > pre,
      pre {
        max-width: none;
        overflow: visible;
        text-overflow: clip;
        white-space: normal;
        word-break: break-all;
      }

      .el-tag {
        height: auto;
        min-height: 24px;
        max-width: 100%;
        white-space: normal;
        padding: 4px 10px;

        .el-tag__content {
          max-width: none;
          overflow: visible;
          text-overflow: clip;
          white-space: normal;
          word-break: break-all;
        }
      }
    }
  }
}
.footer {
  height: 20px;
  color: var(--el-color-danger);
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

}
.is-hidden {
  display: none;
}
.show-hidden-style {
  color: var(--text-color-secondary);
  .header {
    .header-title {
      .header-title-text {
        color: var(--text-color-secondary);
      }
    }
  }
}
.is-hidden.form-design {
  display: block;
}
</style>
<style lang="scss">
.header-description-tooltip-popper {
  --el-bg-color-overlay: var(--bg-color);
  color: var(--text-color-regular);
  font-size: 14px;
}
.header-description-tooltip-content {
  max-height: min(200px, calc(100vh - 120px));
  overflow-y: auto;
  word-break: break-word;
  line-height: 1.4;

  ul, ol {
    margin: 0;
    list-style-position: outside;
  }

  ul {
    list-style: disc;
    padding-left: 16px;
  }

  ol {
    list-style: decimal;
    padding-left: 10px;
  }

  li {
    margin-bottom: 4px;
  }
}
.container-error-tooltip-popper {
  color: #ff5757;
  font-size: 14px;
  padding: 4px 12px;
  border: 1px solid #ffb2b2;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.08);
  background-color: #fff;
}
</style>
