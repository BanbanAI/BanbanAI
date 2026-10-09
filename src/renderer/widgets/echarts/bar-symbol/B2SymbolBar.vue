<template>
  <b2-column-symbol></b2-column-symbol>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { component as B2ColumnSymbol } from "@renderer/widgets/echarts/colum-symbol";
import { SymbolBar } from "./symbolBar";

const symbolColumn = useWidget<SymbolBar>();

</script>

<style lang="scss" scoped>
</style>
