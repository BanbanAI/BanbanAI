<template>
  <slot></slot>
</template>

<script lang="ts" setup>
import { Row } from '@common/types/project';
import { providePreRow } from '@renderer/views/nocode/views/editor/form/hooks';

const props = defineProps<{
  value: Row,
}>();

providePreRow(props.value);
</script>

<style lang="scss" scoped>

</style>