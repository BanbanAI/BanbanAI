<template>
  <b2-form-element class="search-form" :class="{'mobile': isMobile()}" >
    <template v-if="hideSearchData">
      <div class="empty-show">
        <el-icon :size="18"><IVenIconEmptyIcon2 /></el-icon>
        <span class="empty">{{ $t('noSearchData') }}</span>
      </div>
    </template>
    <template v-else>
    <single-search-form v-if="widget.showDataRow === ShowDataRow.SINGLE"></single-search-form>
    <multiple-search-form v-else-if="widget.showDataRow === ShowDataRow.MULTIPLE" class="multiple-search"></multiple-search-form>
    </template>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from '@renderer/utils/pure';
import { LogicalOperator, useWidget } from '@renderer/b2/types';
import { SearchForm } from './searchForm';
import { watch, computed } from 'vue';
import { ShowDataRow } from "./types";
import SingleSearchForm from "./SingleSearchForm.vue"
import MultipleSearchForm from "./MultipleSearchForm.vue"
import IVenIconEmptyIcon2 from "~icons/ven-icon/widget-form-search-form-empty-icon-2";
import { equals } from '@common/utils/object';
import i18next, { $t } from "@renderer/widgets/i18next";

const widget: SearchForm = useWidget() as any;

const hideSearchData = computed(() => {
  return widget.showFields.length <= 0;
});

watch(() => widget.selectSearchForm, (value, oldValue) => {
  if (equals(value, oldValue)) return;
  if (value) {
    widget.showFields = [];
    widget.formDataFilter = {
      logic: LogicalOperator.AND,
      conditions: [],
    };
    widget.otherTableField = widget.computedOtherTableField;
  }
})

</script>
<style lang="scss" scoped>
.search-form {
  width: 100%;

  .empty-show {
    width: 360px;
    height: 96px;
    background-color: #F7F8FA;
    border: 1px solid var(--fill-color-dark);
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    gap: 8px;

    .el-icon {
      color: var(--text-color-disabled);
    }

    .empty {
      height: 20px;
      line-height: 20px;
      font-size: 12px;
      color: var(--text-color-disabled);
    }
  }

  &.mobile {
    .empty-show {
      width: 100%;
      height: 128px;
      padding: 0;
      .el-empty {
        padding: 0;
      }
    }
  }
}
</style>
