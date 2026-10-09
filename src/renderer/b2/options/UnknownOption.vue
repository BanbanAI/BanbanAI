<template>
  <div>{{ `${$t("unknownOptionType")}${getI18nLabelColon()}${option.type}` }}</div>
</template>

<script lang="ts" setup>
import { DefinedOptionWithParsedType } from '../types';
import { getI18nLabelColon } from '@common/utils/i18n';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
</script>
