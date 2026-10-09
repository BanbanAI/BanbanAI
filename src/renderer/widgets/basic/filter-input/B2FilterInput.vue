<template>
  <b2-filter class='b2filter-input'></b2-filter>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useWidget, OptionFieldValue } from "@renderer/b2/types";
import { FilterInput } from "./filter-input";
import { component as B2Filter } from "../filter"

const widget = useWidget<FilterInput>();


</script>

<style lang="scss" scoped>

</style>
