<template>
  <el-aside class="right" :class="{ floating: props.floating, 'without-breadcrumbs': !props.showBreadcrumbs }" :width="props.width">
    <div v-show="false" :id="`option-group-overflow-masks-${reportId}`" class="option-group-overflow-masks"></div>
    <bread-crumbs v-if="props.showBreadcrumbs"></bread-crumbs>
    <vn-stack v-model="stackActiveTab">
      <div class="tabs" v-show="false">
        <vn-stack-tab class="tab" name="field">{{ $t("formDesignerRight.fieldSetting") }}</vn-stack-tab>
      </div>
      <div class="layers">
        <vn-stack-layer class="field-setting-layer" name="field">
          <template v-if="activeElement">
            <div class="element-info">
              <el-dropdown v-if="isAllowSwitchElement()" :offset="4" trigger="click" popper-class="switch-element-popover" :show-arrow="false" :teleported="false" append-to=".layers" placement="bottom-start">
                <div class="name switch-element">
                  {{ activeElement.defaultName }}
                  <el-icon :size="16"><i-ep-arrow-down /></el-icon>
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item class="switch-element-item" :class="{ 'active-switch-element-item': currentSelectElementType === item.value }" v-for="item in selectElementOptions" :key="item.value" @click="handleChangeElementType(item.value)">{{ item.label }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <div class="name" v-else>{{ activeElement.defaultName }}</div>
            </div>
            <div class="b2-options-wrapper">
              <b2-option-group v-for="group in options.style" :element="activeElement" :group="group"
                :key="`${activeElement.uid}-${group.group}`" />
            </div>
          </template>
        </vn-stack-layer>
      </div>
    </vn-stack>
  </el-aside>
</template>

<script lang='ts' setup>
import { OptionRoleMenuInstance, isWidget } from '@renderer/b2/types';
import { Soul } from '@common/types/project';
import { Widget } from '@renderer/b2/controllers/widget';
import { ACTIVE_ELEMENT, LAYERS_CLICK_TIME, OPTION_ROLE_MENU_INSTANCE, REPORT_ID, SELECTED_WIDGETS } from '@renderer/types';
import { ref, computed, inject, provide } from 'vue';
import { usePassportStore } from "@renderer/stores";
import { useFormWidget } from './hooks';
import i18next from 'i18next';
import { FormWidgetType } from '@common/types/nocode';

const props = withDefaults(defineProps<{
  floating?: boolean
  width?: string
  showBreadcrumbs?: boolean
}>(), {
  floating: false,
  width: '302px',
  showBreadcrumbs: true,
});

const activeElement = inject(ACTIVE_ELEMENT);
const formWidget = useFormWidget();
const stackActiveTab = ref('field');
const reportId = inject(REPORT_ID);
const options = computed(() => activeElement.value?.getParsedOptions?.() ?? {});
const formOptions = computed(() => formWidget.value?.getParsedOptions() ?? {});
const passportState = usePassportStore();
const selectedWidgets = inject(SELECTED_WIDGETS);

const optionRoleMenuRef = ref<OptionRoleMenuInstance>();
const layersClickTime = ref(Date.now())
provide(LAYERS_CLICK_TIME,layersClickTime);
provide(OPTION_ROLE_MENU_INSTANCE, optionRoleMenuRef);

const stringSwitchElements: FormWidgetType[] = [FormWidgetType.TEXT_INPUT, FormWidgetType.TREE_SELECT, FormWidgetType.RADIO_GROUP];
const arraySwitchElements: FormWidgetType[] = [ FormWidgetType.TREE_MULTIPLE_SELECT, FormWidgetType.CHECKBOX_GROUP];
const isAllowSwitchElement = () => {
  const type = activeElement.value?.type as FormWidgetType | undefined;
  return Boolean(type && (stringSwitchElements.includes(type) || arraySwitchElements.includes(type)));
}
const currentSelectElementType = ref('')
const selectElementOptions = computed(() => {
  if (stringSwitchElements.includes(activeElement.value?.type as FormWidgetType)) {
    return [
      {
        label: i18next.t("formDesignerRight.textInput"),
        value: FormWidgetType.TEXT_INPUT
      },
      {
        label: i18next.t("formDesignerRight.treeSelect"),
        value: FormWidgetType.TREE_SELECT
      },
      {
        label: i18next.t("formDesignerRight.radioGroup"),
        value: FormWidgetType.RADIO_GROUP
      },
    ].filter(f => f.value !== activeElement.value?.type);
  } else if (arraySwitchElements.includes(activeElement.value?.type as FormWidgetType)) {
    return [
      {
        label: i18next.t("formDesignerRight.treeMultipleSelect"),
        value: FormWidgetType.TREE_MULTIPLE_SELECT
      },
      {
        label: i18next.t("formDesignerRight.checkboxGroup"),
        value: FormWidgetType.CHECKBOX_GROUP
      },
    ].filter(f => f.value !== activeElement.value?.type);
  } else {
    return [];
  }
})

const handleChangeElementType = async (type: FormWidgetType) => {
  currentSelectElementType.value = type;
  let currentSoul = activeElement.value.getSoul();
  const newSoul = handleChangeElementOptions(currentSoul, currentSoul.type as FormWidgetType, type);
  const container = (activeElement.value.parent as Widget).container;
  const index = container.widgets.findIndex(item => item.uid === currentSoul.uid)
  container.removeWidget(activeElement.value.uid);
  const newWidget = await container.addWidget(newSoul, index);
  selectedWidgets.value = [newWidget];
}

const baseWidgetOptions = [
  // baseOptions
  "width-ratio", "width-subform", "input-width", "input-width-px", "show-title", "title-text", "show-description", "description-layout", "description-content", 
  // inputOptions
  "placeholder",
  // fieldOptions
  "is-hidden", "is-readonly", "readonly-mode", "field-readonly", "required-mode", "field-required",
  // validateOptions
  "required", "unique", "unique-subform", "global-unique", "option-count", "option-count-range"
]
const handleChangeElementOptions = (soul: Soul, oldType: FormWidgetType, newType: FormWidgetType) => {
  const newSoul: Soul = {
    uid: soul.uid,
    type: newType,
    options: {}
  }
  // 复制基础选项
  for (const key in soul.options) {
    if (baseWidgetOptions.includes(key)) {
      newSoul.options[key] = soul.options[key];
    }
  }
  if (stringSwitchElements.includes(oldType)) {
    // 单行文本、单选、下拉单选
    if (oldType === FormWidgetType.TREE_SELECT && newType === FormWidgetType.RADIO_GROUP) {
      newSoul.options["radiogroup-value-text-color-option"] = soul.options["treeselect-value-text-option"];
    }
    if (oldType === FormWidgetType.RADIO_GROUP && newType === FormWidgetType.TREE_SELECT) {
      newSoul.options["treeselect-value-text-option"] = soul.options["radiogroup-value-text-color-option"];
    }
  }

  if (arraySwitchElements.includes(oldType)) {
    if (oldType === FormWidgetType.TREE_MULTIPLE_SELECT) {
      newSoul.options["checkbox-option"] = soul.options["treeselect-value-text-option"];
    }
    if (oldType === FormWidgetType.CHECKBOX_GROUP) {
      newSoul.options["treeselect-value-text-option"] = soul.options["checkbox-option"];
    }
  }
  return newSoul;
}
</script>

<style lang='scss' scoped>
.right {
  background-color: var(--bg-color-page);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color-light);

  &.floating {
    width: 100% !important;
    height: 100%;
    border-left: none;
    background-color: #fff;
  }

  &.without-breadcrumbs {
    .vn-stack {
      height: 100%;
    }
  }

  .vn-stack {
    height: calc(100% - 40px);
    display: flex;
    flex-direction: column;

    .tabs {
      background-color: var(--bg-color);;
      height: 35px;
      line-height: 35px;
      color: var(--text-color-primary);
      padding-left: 10px;

      .tab {
        padding: 0 8px;
        height: 35px;
        text-align: center;
        border-bottom: 2px solid transparent;
        cursor: var(--cursor-pointer);
        display: inline-block;
      }

      .tab.active {
        border-bottom-color: var(--color-primary);
      }
    }

    .layers {
      flex: 1;
      min-height: 0;
      overflow-y: scroll;
      overflow-x: hidden;

      &::-webkit-scrollbar {
        width: 0 !important
      }

      
      :deep(.switch-element-popover) {
        background-color: var(--color-white);
        width: 120px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        border-radius: 8px;
        .el-dropdown-menu {
          padding: 4px;
          background-color: transparent;
          .switch-element-item {
            width: 100%;
            height: 36px;
            display: flex;
            align-items: center;
            padding: 0px 12px;
            border-radius: 4px;
            font-size: 14px;
            line-height: 22px;
            color: #1D2129;
            
            &.active-switch-element-item {
              color: #0873FF;
            }
            
            &:hover {
              // background-color: #F2F3F5;
              color: #1D2129;
            }
          }
        }
      }

      .vn-stack-layer {
        width: 100%;
        height: 100%;

        .element-info {
          padding: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;

          .el-dropdown {
            cursor: pointer;
          }

          .name {
            font-size: 14px;
            line-height: 22px;
            color: var(--text-color-primary);
            background: var(--el-bg-color-overlay);
            padding: 3px 10px;
            border-radius: 4px;
          }
          .switch-element {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          }
          .doc {
            margin-right: 2px;
            &>a {
              color: var(--el-color-primary);
            }
            &>a:hover {
              color: var(--el-color-primary-light-3);
            }
          }
        }

        .b2-options-wrapper {
          .b2-option-group {
            :deep(.b2-option-group-title) {
              background-color: unset;
              border-top: 1px solid var(--border-color-light);
              .b2-option-group-switch .b2-option-group-overflow {
                display: none;
              }
            }
            :deep(.b2-option-group-body) {
              border-top: 1px solid var(--border-color-light);
            }
            :deep(.option-group-label) {
              &:hover {
                padding: 0;
              }
              .btn-menu {
                display: none;
              }
            }
          }
        }

        &.field-setting-layer {
          .empty-layer {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            color: var(--text-color-inactive);
          }
        }
      }
    }
  }
}
</style>
