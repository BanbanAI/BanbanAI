<template>
  <dl
    ref="optionGroupRef"
    class="b2-option-group"
    :class="{
      disabled: isOptionGroupDisable,
      'draft-issue-group-highlight': isDesignValidationIssueGroupHighlightActive,
    }"
    :group="group.group"
    v-show="visible"
  >
    <dt :class="{
      'b2-option-group-title': true,
      'b2-option-group-unfold': fold !== 'fold',
      'b2-option-group-disable-fold': fold === 'always-unfold',
    }" @click="triggerOptionGroup" v-show="!group.hideTitle">
      <div class="option-group-title">
        <el-icon class="fold-icon" size="14"><i-ep-caret-right /></el-icon>
        {{ group.alias }}
        <el-tooltip placement="top" effect="light">
          <template #content>
            <div style="max-width: 200px;">{{group.tip}}</div>
          </template>
          <div class="tip-icon" v-if="group.tip" @click.stop>
            <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
          </div>
        </el-tooltip>
      </div>
      <div class="b2-option-group-switch">
        <switch-button v-model="groupValue" v-if="group.type === 'boolean'" @update:modelValue="updateValue($event)"/>
        <!-- 锁定按钮隐藏 -->
        <b2-option-group-overflow v-if="false" :element="element" :visible="showOverflow" :group="props.group"
          @click="handleOverflowClick" @hide="handleOverflowHide" />
      </div>
    </dt>
    <div v-show="fold !== 'fold'" v-if="fold !== 'fold' || hasRender" class="b2-option-group-body">
      <b2-option-items :element="element" :items="group.children" :paths="[]" />
    </div>
    <teleport v-if="showOverflow" :to="`#option-group-overflow-masks-${projectId}`">
      <div class="mask" @click="showOverflow = false"></div>
    </teleport>
  </dl>
</template>

<script lang="ts" setup>
import { inject, ref, watch, computed, provide, unref, onErrorCaptured, nextTick } from 'vue';
import { ParsedOptionGroups, isCallableVisible } from './types';
import { Element } from '@renderer/b2/controllers/element';
import { IS_OPTION_GROUP_UNFOLD, IS_OPTION_GROUP_DISABLE, BULK_UPDATE_VALUE } from "./inject";
import { PROJECT_ID, SELECTED_WIDGETS, FORM_DESIGNER_ACTIVE_ISSUE_HIGHLIGHT } from '@renderer/types';

const props = defineProps<{
  element: Element,
  group: GetElementType<ParsedOptionGroups>,
}>();

const selectedWidgets = inject(SELECTED_WIDGETS);

const projectId = inject(PROJECT_ID);
const designValidationIssueHighlight = inject(FORM_DESIGNER_ACTIVE_ISSUE_HIGHLIGHT, ref(null));
const optionGroupRef = ref<HTMLElement | null>(null);

let groupValue = ref(true);
if (props.group.type === "boolean") {
  groupValue = computed({
    get() {
      return props.element.getOption(props.group.group);
    },
    set(v) {
      return props.element.setOption(props.group.group, v);
    }
  })
} else {
  groupValue = ref(true);
}

const bulkUpdateValue = (callback: (element: Element)=>void) => {
  const selectedElements: Element[] = [ props.element ];
  selectedElements.push(...selectedWidgets.value.filter(widget => widget.uid !== props.element.uid));
  if (selectedElements.length) {
    for (const element of selectedElements) {
      callback(element);
    }
  }
}

const updateValue = (value) => {
  const clusterPaths = props.element.toClusterPaths(props.group.group);
  bulkUpdateValue((element) => {
    element.trySetOption(clusterPaths, value);
  })
}

const fold = computed(() => {
  return props.element.getGroupStatus(props.group.group)?.fold || props.group.fold || 'fold';
});
const isGroupUnfold = computed(()=>{
  return fold.value !== "fold";
});
const isOptionGroupDisable = computed(() => {
  return props.group.type === 'boolean' && !groupValue.value;
})
provide(IS_OPTION_GROUP_UNFOLD, isGroupUnfold);
provide(IS_OPTION_GROUP_DISABLE, isOptionGroupDisable);
provide(BULK_UPDATE_VALUE, bulkUpdateValue);
const hasRender = ref(false);
watch(() => fold.value, (val) => {
  if (val !== "fold") {
    hasRender.value = true;
  }
}, { immediate: true });


const showOverflow = ref(false);

const handleOverflowClick = () => {
  if (props.group.type === 'boolean' && !groupValue.value) return;
  showOverflow.value = !showOverflow.value;
}

const handleOverflowHide = () => {
  showOverflow.value = false;
}

const visible = computed(() => {
  if (props.group.visible === undefined) return true;
  return isCallableVisible(props.group.visible) ? unref(props.group.visible(props.element)) : props.group.visible;
});

const isDesignValidationIssueGroupHighlightActive = computed(() => (
  visible.value
  && designValidationIssueHighlight.value?.widgetId === props.element.uid
  && designValidationIssueHighlight.value?.groupKey === props.group.group
));

watch(
  () => designValidationIssueHighlight.value?.token,
  async () => {
    if (!isDesignValidationIssueGroupHighlightActive.value) {
      return;
    }
    if (fold.value === 'fold') {
      props.element.setGroupStatus(props.group.group, 'fold', 'unfold');
      await nextTick();
    }
    if (!optionGroupRef.value?.scrollIntoView) {
      return;
    }
    optionGroupRef.value.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  },
);

const triggerOptionGroup = () => {
  if (fold.value === 'always-unfold') {
    return;
  }
  const value = fold.value === 'fold' ? 'unfold' : 'fold';
  bulkUpdateValue((element) => {
    element.setGroupStatus(props.group.group, "fold", value);
  })
}

onErrorCaptured((err, instance, info)=>{
  const logger = import.meta.env.DEV ? console.error : console.warn;
  logger(`catch option error in ${info}\n`, err, props.element, instance);
  return false;
});
</script>

<style lang="scss" scoped>
.b2-option-group {
  color: var(--text-color-regular);
  &.disabled {
    color: var(--text-color-disabled);
    --text-color-hover: var(--text-color-hover-disabled);
    --primary-color: var(--primary-color-disabled);
    --primary-color-active: var(--primary-color-disabled);

    .b2-option-group-body {
      pointer-events: none;
    }
  }
  .b2-option-group-title {
    height: 36px;
    font-weight: 700;
    padding-left: 10px;
    user-select: none;
    cursor: var(--cursor-pointer);
    background-color: var(--bg-color);
    margin-top: 1px;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    vertical-align: middle;
    .option-group-title {
      display: flex;
      align-items: center;
      text-indent: 6px;
      .fold-icon {
        transition: all .25s ease;
      }

      .tip-icon {
        cursor: var(--cursor-default);
      }
    }

    &.b2-option-group-unfold .fold-icon {
      transform: rotate(90deg);
    }

    &.b2-option-group-disable-fold .fold-icon {
      display: none;
    }

    .b2-option-group-switch {
      padding-right: 10px;
      display: flex;
      align-items: center;
      &:hover {
        color: var(--color-primary);
      }
    }

    &:hover {
      color: var(--text-color-primary);
    }
  }

  .b2-option-group-body { //层级1
    --option-bg-color: var(--bg-color-page);

    background-color: var(--option-bg-color);
    :deep(.cluster) {
      --option-bg-color: var(--option-bg);
    }
    :deep(.b2-option-subgroup) { //层级2
      --option-bg-color: var(--option-bg);
      .cluster {
        --option-bg-color: var(--option-bg-overlay);
      }
      .b2-option-subgroup { //层级3
        --option-bg-color: var(--option-bg-overlay);
        .cluster {
          --option-bg-color: var(--option-bg);
        }
        .b2-option-subgroup { //层级4
          --option-bg-color: var(--option-bg);
          .cluster {
            --option-bg-color: var(--option-bg-overlay);
          }
          .b2-option-subgroup { //层级5
            --option-bg-color: var(--option-bg-overlay);
          }
        }
      }
    }
  }

  :deep(.el-input) {
    --el-input-height: 24px;
  }
}
</style>
