<template>
  <b2-widget>
    <b2-container :container="widget.container"></b2-container>
  </b2-widget>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types"
import { Form } from "./form";

const widget = useWidget<Form>();
</script>

<style lang="scss" scoped>
.b2widget {
  font-size: 14px;
}
</style>