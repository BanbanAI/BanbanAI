<template>
  <b2-axis></b2-axis>
</template>

<script lang="ts" setup>
import {  useWidget } from "@renderer/b2/types";
import { component as B2Axis } from "@renderer/widgets/echarts/axis";
import { onMounted, watch } from "vue";
import { SymbolColumn } from "./symbolColumn";
import { debounce } from "lodash";

const symbolColumn = useWidget<SymbolColumn>();

</script>

<style lang="scss" scoped>
</style>
