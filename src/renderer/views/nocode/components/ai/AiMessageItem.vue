<template>
  <div :class="rootClasses">
    <div :class="contentClasses">
      <div v-if="$slots.before" :class="beforeClasses">
        <slot name="before" />
      </div>

      <div v-if="$slots.bubble" :class="bubbleWrapClasses">
        <div :class="bubbleClasses">
          <slot name="bubble" />
        </div>
      </div>

      <div v-if="$slots.extra" :class="extraClasses">
        <slot name="extra" />
      </div>

      <slot name="toolbar" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ClassValue = string | string[] | Record<string, boolean>

type Props = {
  role: 'user' | 'assistant'
  variant?: 'sidebar' | 'editor'
  rootClass?: ClassValue
  contentClass?: ClassValue
  bubbleWrapClass?: ClassValue
  bubbleClass?: ClassValue
  extraClass?: ClassValue
}

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<Props>(), {
  variant: 'sidebar',
  rootClass: '',
  contentClass: '',
  bubbleWrapClass: '',
  bubbleClass: '',
  extraClass: '',
})

const rootClasses = computed(() => [
  'ai-message-item',
  `is-${props.variant}`,
  `is-${props.role}`,
  props.rootClass,
])

const contentClasses = computed(() => [
  'ai-message-item__content',
  props.contentClass,
])

const bubbleWrapClasses = computed(() => [
  'ai-message-item__bubble-wrap',
  props.bubbleWrapClass,
])

const beforeClasses = computed(() => [
  'ai-message-item__before',
])

const bubbleClasses = computed(() => [
  'ai-message-item__bubble',
  props.bubbleClass,
])

const extraClasses = computed(() => [
  'ai-message-item__extra',
  props.extraClass,
])
</script>

<style scoped lang="scss">
.ai-message-item {
  width: 100%;
  display: flex;

  &.is-sidebar {
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 26px;
    }
  }

  &.is-editor {
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 26px;
    }
  }

  &.is-user {
    justify-content: flex-end;
  }

  &.is-assistant {
    justify-content: flex-start;
  }
}

.ai-message-item__content {
  max-width: 100%;
  display: flex;
  flex-direction: column;
}

.ai-message-item__bubble-wrap {
  width: 100%;
  display: flex;
}

.ai-message-item__before {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}

.ai-message-item__bubble {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.ai-message-item__extra {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-message-item.is-sidebar.is-user {
  .ai-message-item__content {
    align-items: flex-end;
  }

  .ai-message-item__bubble-wrap {
    justify-content: flex-end;
  }

  .ai-message-item__bubble {
    max-width: min(228px, 100%);
    min-height: 36px;
    padding: 7px 10px;
    border-radius: 8px;
    background-color: #f2f3f5;
    color: #1d2129;
    font-size: 14px;
    line-height: 22px;
    white-space: pre-wrap;
  }
}

.ai-message-item.is-sidebar.is-assistant {
  .ai-message-item__content {
    width: 100%;
  }

  .ai-message-item__bubble-wrap {
    justify-content: flex-start;
  }

  .ai-message-item__bubble {
    width: 100%;
    max-width: 100%;
    min-height: 0;
    padding: 7px 0;
    background-color: transparent;
  }
}

.ai-message-item.is-editor.is-assistant {
  .ai-message-item__content {
    width: 100%;
    gap: 8px;
  }

  .ai-message-item__bubble-wrap {
    justify-content: flex-start;
  }

  .ai-message-item__bubble {
    width: 100%;
    max-width: 100%;
    min-height: 0;
    padding: 7px 0;
    background-color: transparent;
    border: 0;
    border-radius: 0;
  }
}

.ai-message-item.is-editor.is-user {
  .ai-message-item__content {
    align-items: flex-end;
    gap: 8px;
  }

  .ai-message-item__bubble-wrap {
    justify-content: flex-end;
  }

  .ai-message-item__bubble {
    max-width: min(228px, 100%);
    min-height: 36px;
    padding: 7px 10px;
    border-radius: 8px;
    background-color: #f2f3f5;
    color: #1d2129;
    font-size: 14px;
    line-height: 22px;
    white-space: pre-wrap;
    border: 0;
  }
}
</style>
