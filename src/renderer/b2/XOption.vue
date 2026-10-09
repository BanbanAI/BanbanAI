<template>
  <div
    :class="{
      disabled: disabled,
      'draft-issue-highlight': isDesignValidationIssueHighlightActive,
    }"
    ref="optionDOM"
    @contextmenu.prevent=""
  >
    <div class="option-group-item" :class="{'big-content': bigContent, 'big-label': bigLabel}" v-if="visible">
      <div class="option-group-label" :class="{ 'active': isSameVirtualRef() }" v-if="showTitle">
        <span :class="['option-alias', { 'exist-tip': !!item.tip }]" :title="item.alias" @contextmenu.prevent.stop="handleMenuClickTrigger">{{ item.alias }}</span>
        <el-tooltip placement="top" effect="light">
          <template #content>
            <div style="max-width: 200px;">{{item.tip}}</div>
          </template>
          <div class="tip-icon" v-if="item.tip">
            <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
          </div>
        </el-tooltip>
        <div :class="['btn-menu', { active: isSameVirtualRef() }]" :title="$t('optionMore')" @click="handleShowOptionRoleMenu" ref="targetElement" v-if="false">
          <el-icon class="icon"><i-ep-more-filled /></el-icon>
        </div>
      </div>
      <div class="option-content">
        <div class="option-content-main">
          <component v-if="component" :is="component" :option="option" :paths="currentPaths" :class="{ 'blur':!!itemTip, 'covered': itemTip }"></component>
          <div class="menu-callback-tips" :class="{ 'controlled': controlled }" v-show="!!itemTip" @click="handleClickTip">{{itemTip}}</div>
        </div>
        <div class="option-helper-text" v-if="disabledHelperText">{{ disabledHelperText }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, OPTION_ELEMENT, UPDATE_OPTION, IS_OPTION_GROUP_UNFOLD, GET_DEFAULT_OPTION_VALUE, IS_OPTION_GROUP_DISABLE } from "./inject";
import { SELECTED_WIDGETS, INPUT_ENTER_BLUR, SHOW_SAMPLE_CODE, OPTION_ROLE_MENU_INSTANCE, FORM_DESIGNER_OPTION_CHANGED, FORM_DESIGNER_ACTIVE_ISSUE_HIGHLIGHT } from '@renderer/types';
import { computed, inject, markRaw, nextTick, provide, ref, toRaw, unref, watch } from 'vue';
import { DefinedOption, DefinedOptionWithParsedType, isCallableVisible, isCallableDisabled, OptionMenuRole, WidgetStatus, isOptionCluster } from './types';
import { Element } from '@renderer/b2/controllers/element';
import { deepClone, equals } from "@common/utils/object";
import { ParsedOptionType, parseOptionType } from './utils/option.util';
import { loadOptionComponent } from './utils/option-loader';
import i18next from 'i18next';

const props = defineProps<{
  element: Element,
  item: DefinedOption,
  paths: string[],
}>();

const optionRoleMenuRef = inject(OPTION_ROLE_MENU_INSTANCE);
const selectedWidgets = inject(SELECTED_WIDGETS);
const isOptionGroupDisable = inject(IS_OPTION_GROUP_DISABLE);
const handleFormDesignerOptionChanged = inject(FORM_DESIGNER_OPTION_CHANGED, null);
const designValidationIssueHighlight = inject(FORM_DESIGNER_ACTIVE_ISSUE_HIGHLIGHT, ref(null));

const optionDOM = ref<HTMLElement | undefined>();

const component = ref();
const currentPaths = computed(()=>[...props.paths, props.item.name]);
const isDesignValidationIssueHighlightActive = computed(() => (
  visible.value
  && designValidationIssueHighlight.value?.widgetId === props.element.uid
  && Array.isArray(designValidationIssueHighlight.value?.optionPath)
  && equals(designValidationIssueHighlight.value?.optionPath, currentPaths.value)
));
const optionType = computed<ParsedOptionType>(() => {
  return parseOptionType(props.item.type);
});
const option = computed<DefinedOptionWithParsedType>(() => {
  return {
    ...props.item,
    parsedType: optionType.value.parsedType,
    generics: optionType.value.generics,
    args: optionType.value.args,
  }
});

let optionLoadVersion = 0;
const loadingOption = async ()=>{
  const currentVersion = ++optionLoadVersion;
  const parsedType = optionType.value.parsedType;
  if (parsedType === "hidden") {
    component.value = undefined;
    return;
  }
  component.value = undefined;
  const loadedComponent = await loadOptionComponent(parsedType);
  if (currentVersion === optionLoadVersion) {
    component.value = markRaw(loadedComponent);
  }
};

watch(() => optionType.value.parsedType, () => {
  loadingOption();
});

const isGroupUnfold = inject(IS_OPTION_GROUP_UNFOLD);
if (isGroupUnfold.value) {
  loadingOption();
} else {
  const stop = watch(()=>isGroupUnfold.value, (value)=>{
    if (value) {
      loadingOption();
      stop();
    }
  }, {immediate: true});
}

const visible = computed(() => {
  if(props.item.type === "hidden") return false;
  if (props.item.visible === undefined) return true;
  return isCallableVisible(props.item.visible) ? unref(props.item.visible(props.element, props.paths)) : props.item.visible;
});
const disabled = computed(() => {
  if(isOptionGroupDisable.value) return true;
  if (props.item.disabled === undefined) return false;
  return isCallableDisabled(props.item.disabled) ? props.item.disabled(props.element) : props.item.disabled;
});
const disabledHelperText = computed(() => {
  if (!disabled.value || !props.item.disabledHelperText) return "";
  return typeof props.item.disabledHelperText === "function"
    ? props.item.disabledHelperText(props.element, props.paths)
    : props.item.disabledHelperText;
});
const inherit = computed(() => {
  return props.element.isInheritOptionSet(currentPaths.value);
});

const showTitle = computed(() => {
  return optionType.value.parsedType !== "hidden";
});

const bigContent = computed(()=>{
  if (component.value?.isBigContent?.(optionType.value?.args)) {
    return true;
  }
  return false;
});
const bigLabel = computed(()=>{
  return false;
  // return ["boolean"].includes(optionType.value.parsedType);
});

const hasOptionValueChanged = (previousValue: any, nextValue: any) => {
  return !equals(previousValue, nextValue);
}

const updateOption = (value: any, type?: 'transient') => {
  // 如果多选的情况下 同步改写其它元素的Option
  let currElement = props.element;
  let selectedElements: Element[] = [ currElement ];
  if((currElement.status as WidgetStatus).isSelected){
    selectedElements.push(...selectedWidgets.value.filter(widget => widget.uid !== props.element.uid));
  }
  if (selectedElements?.length) {
    const clusterPaths = props.element.toClusterPaths(currentPaths.value);
    if (!clusterPaths) return;
    const rawValue = toRaw(value);
    for (const element of selectedElements) {
      if (type === 'transient') {
        element.trySetOption(clusterPaths, rawValue, type);
        continue;
      }
      const paths = element.fromClusterPaths(clusterPaths);
      if (!paths) continue;
      if (!handleFormDesignerOptionChanged) {
        element.trySetOption(clusterPaths, rawValue, type);
        continue;
      }
      const previousValue = deepClone(element.getOption(paths, { skipTransition: true }));
      element.setOption(paths, rawValue, false);
      const nextValue = element.getOption(paths, { skipTransition: true });
      if (hasOptionValueChanged(previousValue, nextValue)) {
        handleFormDesignerOptionChanged();
      }
    }
  }
}
const getOptionValue = () => {
  return props.element.getOption(currentPaths.value);
}
const getDefaultOptionValue = () => {
  return props.element._getOptionDefault(currentPaths.value);
}
provide(OPTION_ELEMENT, props.element);
provide(UPDATE_OPTION, updateOption);
provide(GET_OPTION_VALUE, getOptionValue);
provide(GET_DEFAULT_OPTION_VALUE, getDefaultOptionValue);

const handleClickTip = ()=>{
  if (props.item?.maskClick) {
    props.item?.maskClick?.(props.element);
  }
}

const controlled = ref(true);
const itemTip = computed(()=>{
  controlled.value = true;
  if(inherit.value){
    return i18next.t("optionControlledByParent"); // 属性值由父级控制
  } else if (props.item?.mask) {
    if (typeof props.item.mask === 'function') {
      return props.item.mask(props.element, props.paths);
    } else {
      return props.item.mask;
    }
  }
  controlled.value = false;
  return "";
})
const showSampleCode = inject(SHOW_SAMPLE_CODE);
const optionMenuItems: OptionMenuRole[] = [{
  role: "showSampleCode",
  get label() { return i18next.t("optionSampleCode") },
  icon: IPrimeCode,
  callback: () => {
    showSampleCode([...props.paths, props.item.name], getOptionValue(), optionDOM.value);
  }
}];
if(props.item.menu?.length){
  for(const menuItem of props.item.menu){
    if(menuItem.role === "showSampleCode") {
      const mergeItem = optionMenuItems.find(item => item.role === menuItem.role)
      for (const key in menuItem) {
        mergeItem[key] = menuItem[key]
      }
      continue;
    };
    optionMenuItems.push(menuItem);
  }
}

const targetElement = ref<HTMLElement>();
const handleShowOptionRoleMenu = (ev: MouseEvent) => {
  const paths = [...props.paths, props.item.name];
  optionRoleMenuRef.value?.show(targetElement.value, optionMenuItems, props.element, paths);
}

const handleMenuClickTrigger = () => {
  targetElement.value?.click();
}

const isSameVirtualRef = () => {
  return optionRoleMenuRef.value?.visible && targetElement.value === optionRoleMenuRef.value?.virtualRef;
}

const inputEnterBlur = (event: KeyboardEvent) => {
  (event.target as HTMLInputElement).blur()
}
provide(INPUT_ENTER_BLUR, inputEnterBlur)
provide(IS_OPTION_GROUP_DISABLE, disabled)

watch(
  () => designValidationIssueHighlight.value?.token,
  async () => {
    if (!isDesignValidationIssueHighlightActive.value) {
      return;
    }
    await nextTick();
    if (!optionDOM.value?.scrollIntoView) {
      return;
    }
    optionDOM.value.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  },
)
</script>

<style lang="scss">
.option-group-item {
  .el-input {
    --el-input-bg-color: var(--el-bg-color-page);
    --el-input-border-radius: 2px;
  }
  .el-tree {
    --el-fill-color-blank: var(--el-bg-color-page);
  }
  .el-select {
    --el-fill-color-blank: var(--el-bg-color-page);
    .el-select__wrapper {
      line-height: 24px;
      height: 24px;
    }
    .el-select__selection {
      height: 24px !important;//el-tree-select内部会加一个style，需要被覆盖
    }
  }

  display: flex;
  padding: 5px 10px 5px 5px;

  &.big-content {
    display: block;
    padding: 5px;
    .option-group-label {
      height: 30px;
    }
    .option-content {
      width: 100%;
    }
  }

  &.big-label {
    .option-group-label {
      flex: 1;
    }
    .option-content {
      flex: 0;
    }
  }

  .option-group-label {
    display: flex;
    align-items: center;
    position: relative;
    user-select: none;
    width: 100px;
    height: 24px;
    cursor: var(--cursor-default);

    &.active {
      .option-alias,
      .tip-icon {
        color: #0089ff;
      }
    }
    .option-alias{
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      float: left;
      padding-right: 2px;
      max-width: 100%;
      &.exist-tip{
        max-width: 80px;
      }
    }
    .tip-icon {
      cursor: var(--cursor-default);
      pointer-events: all;
    }
    .btn-menu{
      position: absolute;
      right: 2px;
      padding: 0 1px;
      cursor: var(--cursor-pointer);
      font-size: 14px;
      height: 100%;
      display: none;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
      
      &.active,
      &:hover {
        background-color: var(--bg-color-hover);
        color: var(--color-primary);
        display: flex;
      }



      .icon {
        transform: rotate(90deg);
        top: 1px;

        svg {
          outline: none !important;
        }
      }

    }
    &:hover{
      padding-right: 15px;
      .btn-menu{
        display: flex;
      }
    }
  }

  .option-content{
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 200px;

    .option-content-main {
      position: relative;
      width: 100%;
      display: flex;
      align-items: center;

      .menu-callback-tips {
        position: absolute;
        height: 100%;
        width: 100%;
        line-height: 24px;
        text-align: center;
        background-color: #2e2f33b3;
        color: #9d6b44;
        z-index: 9;
        user-select: none;
        cursor: var(--cursor-pointer);
        &:hover{
          color: #d79460;
        }

        &.controlled {
          color: #0089ff;
          &:hover{
            color: #3591e2;
          }
        }
      }

      .blur{
        filter: blur(2px);
      }
      .covered{
        max-height: 24px;
        overflow: hidden;
      }
    }

    .option-helper-text {
      margin-top: 4px;
      line-height: 16px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      word-break: break-word;
    }
  }

  .option-group-control {
      flex: 1;
      .el-input__wrapper {
        padding-top: 0;
        padding-bottom: 0;

        .el-input__inner {
          color: inherit;
        }
      }
    }
}

.draft-issue-highlight {
  .option-group-item {
    background-color: rgba(245, 108, 108, 0.14);
    border-radius: 6px;
  }
}

.option-group-popper {
  .el-select-dropdown__item {
    font-size: 11px;
    padding: 0 10px;
    height: 26px;
    line-height: 26px;
  }
  .el-tree{
    .el-select-dropdown__item {
      padding: 0 1px;
    }
  }
}
</style>

<style lang="scss" scoped>
.disabled {
  pointer-events: none;
  // color: var(--text-color-disabled);
}
</style>
