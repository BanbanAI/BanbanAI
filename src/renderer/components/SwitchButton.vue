<template>
  <label :class="{ 'switch-button': true, 'switch-button-on': modelValue, 'disabled': disabled }" @click.stop="changeValue">
    <span>
      <svg viewBox="0 0 10 10">
        <path
          d="M5,1 L5,1 C2.790861,1 1,2.790861 1,5 L1,5 C1,7.209139 2.790861,9 5,9 L5,9 C7.209139,9 9,7.209139 9,5 L9,5 C9,2.790861 7.209139,1 5,1 L5,9 L5,1 Z">
        </path>
      </svg>
    </span>
  </label>
</template>

<script lang="ts" setup>
const props = defineProps<{
  modelValue: boolean,
  disabled?: boolean,
}>();

const emit = defineEmits(['update:modelValue', 'change'])

const changeValue = () => {
  if (props.disabled) return;
  emit('update:modelValue', !props.modelValue)
  emit('change', !props.modelValue);
}
</script>

<style lang="scss" scoped>
.switch-button {
  position: relative;
  display: inline-block;
  width: 24px;
  height: 16px;
  -webkit-tap-highlight-color: transparent;
  transform: translate3d(0, 0, 0);
  margin: 0;

  &:before {
    content: "";
    position: relative;
    top: 5px;
    left: 1px;
    width: 22px;
    height: 7px;
    display: block;
    background-color: var(--bg-color-page);
    border-radius: 12px;
    border:1px solid var(--border-color-light);
    transition: background 0.2s ease;
  }

  span {
    position: absolute;
    top: 3px;
    left: 0px;
    width: 14px;
    height: 14px;
    display: block;
    background: var(--bg-color-page);
    border:1px solid var(--border-color-light);
    border-radius: 50%;
    transition: all 0.2s ease;

    svg {
      fill: none;
      width: 6px;
      height: 6px;
      position: absolute;
      left: 3px;
      top: 3px;

      path {
        stroke: #c8ccd4;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 24;
        stroke-dashoffset: 0;
        transition: all 0.5s linear;
      }
    }
  }
}

.switch-button-on {
  &::before {
    background: var(--color-primary);
  }

  span {
    transform: translateX(12px);

    svg {
      path {
        stroke: var(--color-primary);
        stroke-dasharray: 25;
        stroke-dashoffset: 25;
      }
    }
  }
}

.switch-button,
.switch-button-on {
  &.disabled {
    filter: brightness(1) saturate(0%) contrast(0.5);
    pointer-events: none;
  }
}

</style>
