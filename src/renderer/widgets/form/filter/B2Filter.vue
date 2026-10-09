<template>
  <b2-form-element>
    <div class="filter" ref="filter">
      <el-select
        v-model="widget.selectedVal.value"
        multiple
        @remove-tag="handleRemove"
        :placeholder="widget.placeholder"
        clearable
        filterable
        :teleported="false"
        @change="handleChange">
        <template #prefix>
          {{ widget.selectOptionLabel }}
        </template>
        <el-option v-if="widget.selectOption.value.length > 0" value="all" @click="selectAll">
          <el-checkbox v-model="isAll" @change="selectAll" @click.stop="" />{{ i18next.t('selectAll') }}
        </el-option>
        <el-option v-for="item in widget.selectOption.value" :value="item.value" :key="item.id" @click="item.checked = !item.checked">
          <el-checkbox v-model="item.checked" @click="item.checked = !item.checked" />{{ item.label }}
        </el-option>
      </el-select>
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { OptionFontValue, useWidget } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { watch, computed, onMounted, ref, nextTick } from "vue";
import { Filter, SelectItem } from "./filter";
import { equals } from "@common/utils/object";
import i18next, { $t } from "@renderer/widgets/i18next";

const widget = useWidget<Filter>();

const filterStyle = computed(() => {
  const selectBorderWidth = widget.getOption<number>("select-border-width");
  const selectBorderColor = new Color(widget.getOption("select-border-color")).toCssString();
  const selectFont = widget.getOption<OptionFontValue>("select-font");
  const isShowIcon = widget.getOption<boolean>("show-clear");

  const dropdownOffset = widget.getOption<number[]>("dropdown-offset");
  const dropdownBorderWidth = widget.getOption<number>("dropdown-border-width");
  const dropdownBorderColor = new Color(widget.getOption("dropdown-border-color")).toCssString();
  const dropdownFont = widget.getOption<OptionFontValue>("dropdown-font");

  return {
    selectHeight: widget.getOption("select-height") + "px",
    selectBgColor: new Color(widget.getOption("select-background-color")).toCssString(),
    selectBorder: `${selectBorderWidth}px solid ${selectBorderColor}`,
    selectBorderRadius: widget.getOption("select-border-radius") + "px",
    selectFontSize: selectFont.size + "px",
    selectFontColor: new Color(selectFont.color).toCssString(),
    selectFontFamily: selectFont.family,
    selectFontWeight: selectFont.bold ? "bold" : "normal",
    selectFontStyle: selectFont.italic ? "italic" : "normal",
    selectIconSize: widget.getOption<number>("clear-size") + "px",
    isShowIcon: isShowIcon ? "block" : "none",
    iconRight: widget.getOption<number>("icon-right") + "px",
    iconColor: new Color(widget.getOption("icon-color")).toCssString(),

    dropdownOffset: `${dropdownOffset[0]}px, ${dropdownOffset[1]}px`,
    dropdownBorder: `${dropdownBorderWidth}px solid ${dropdownBorderColor}`,
    dropdownBorderColor,
    dropdownBorderRadius: widget.getOption<number>("dropdown-border-radius") + "px",
    dropdownBgColor: new Color(widget.getOption("dropdown-background-color")).toCssString(),
    dropdownOptionHoverBgColor: new Color(widget.getOption("dropdown-option-hover-background-color")).toCssString(),
    dropdownFontSize: dropdownFont.size + "px",
    dropdownFontColor: new Color(dropdownFont.color).toCssString(),
    dropdownFontFamily: dropdownFont.family,
    dropdownFontWeight: dropdownFont.bold ? "bold" : "normal",
    dropdownFontStyle: dropdownFont.italic ? "italic" : "normal",
    dropdownCheckboxSelectColor: new Color(widget.getOption("dropdown-checkbox-select-color")).toCssString(),
  };
});

const isAll = ref(false);

const handleChange = (val: string[]) => {
  if (!val.includes("all") && val.length === widget.getSelectOption.length) {
    widget.selectedVal.value.unshift("all");
    isAll.value = true;
  } else if (val.includes("all") && val.length - 1 < widget.getSelectOption.length) {
    isAll.value = false;
    widget.selectedVal.value = widget.selectedVal.value.filter((item) => {
      return item !== "all";
    });
  }
};

const handleRemove = (tagValue: any) => {
  for (let item of widget.selectOption.value) {
    if (item.value === tagValue) {
      item.checked = false;
    }
  }
};

const selectAll = () => {
  if (widget.selectedVal.value.length < widget.selectOption.value.length) {
    widget.selectedVal.value = [];
    widget.selectOption.value.map((item) => {
      widget.selectedVal.value.push(item.value);
      item.checked = true;
    });
    isAll.value = true;
    widget.selectedVal.value.unshift("all");
  } else {
    for (let item of widget.selectOption.value) {
      item.checked = false;
    }
    isAll.value = false;
    widget.selectedVal.value = [];
  }
};

onMounted(() => {
  watch(
    () => widget.getSelectOption,
    (newVal, oldVal) => {
      if (!equals(newVal, oldVal)) {
        widget.selectOption.value = newVal;
      }
    },
    {
      immediate: true,
    },
  );

  watch(
    () => widget.selectedValue,
    (newVal, oldVal) => {
      if (!equals(newVal, oldVal)) {
        const linkageField = widget.getOption("axis-linkage");
        const fieldUID = linkageField[0]?.uid;
        if (linkageField) {
          if (widget.selectedValue.length) {
            widget.applyLinkage({
              uid: fieldUID,
              value: {
                operator: "$contains",
                value: widget.selectedValue,
              },
            });
          } else {
            widget.withdrawLinkage();
          }
        } else {
          widget.withdrawLinkage();
        }
        if (widget.selectedValue.length) {
          widget.getBoard().applyFilter({
            id: widget.uid,
            uid: fieldUID,
            value: {
              [fieldUID[2]]: widget.selectedValue,
            },
          })
        } else {
          widget.getBoard().withdrawFilter(widget.uid);
        }
      }
    },
  );
});
</script>

<style lang="scss" scoped>
:deep(.b2widget-body) {
  overflow: visible !important;
}
.filter {
  height: v-bind("filterStyle.selectHeight");

  :deep(.el-select) {
    width: 100%;
    height: 100%;

    .el-select__wrapper {
      box-shadow: none;
      background: v-bind("filterStyle.selectBgColor");
      border: v-bind("filterStyle.selectBorder");
      border-radius: v-bind("filterStyle.selectBorderRadius");
      overflow: hidden;

      .el-select__selection {
        gap: 0;
        .el-select__selected-item {
          &.el-select__input-wrapper {
            .el-select__input {
              width: auto !important;
            }
          }

          .el-tag {
            display: none;
          }
        }
      }

      .el-select__prefix {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: v-bind("filterStyle.selectFontSize");
        color: v-bind("filterStyle.selectFontColor");
        font-family: v-bind("filterStyle.selectFontFamily");
        font-weight: v-bind("filterStyle.selectFontWeight");
        font-style: v-bind("filterStyle.selectFontStyle");
      }

      .el-select__suffix {
        display: v-bind("filterStyle.isShowIcon");
        position: absolute;
        right: v-bind("filterStyle.iconRight");
        top: 50%;
        transform: translateY(-50%);

        .el-icon {
          font-size: v-bind("filterStyle.selectIconSize");
          color: v-bind("filterStyle.iconColor");
        }
      }
    }

    .el-popper {
      width: 100%;
      z-index: 0 !important;
      background: v-bind("filterStyle.dropdownBgColor");
      box-shadow: none;
      top: v-bind("filterStyle.selectHeight") !important;
      left: 0 !important;
      transform: translate(v-bind("filterStyle.dropdownOffset"));
      border: 0;

      .el-select-dropdown {
        min-width: 0;
        .el-scrollbar {
          .el-select-dropdown__wrap {
            border: v-bind("filterStyle.dropdownBorder");
            border-radius: v-bind("filterStyle.dropdownBorderRadius");
            .el-scrollbar__view {
              padding: 4px;

              .el-select-dropdown__item {
                display: flex;
                align-items: center;
                font-size: v-bind("filterStyle.dropdownFontSize");
                color: v-bind("filterStyle.dropdownFontColor");
                font-family: v-bind("filterStyle.dropdownFontFamily");
                font-weight: v-bind("filterStyle.dropdownFontWeight");
                font-style: v-bind("filterStyle.dropdownFontStyle");

                &.is-hovering {
                  background: v-bind("filterStyle.dropdownOptionHoverBgColor");
                }
                &::after {
                  display: none;
                }
              }

              .el-checkbox {
                margin-right: 8px;
                &.is-checked {
                  .el-checkbox__input {
                    .el-checkbox__inner {
                      background: v-bind("filterStyle.dropdownCheckboxSelectColor");
                    }
                  }
                }
                .el-checkbox__input {
                  .el-checkbox__inner {
                    background: #fff;
                    border: 1px solid v-bind("filterStyle.dropdownBorderColor");
                  }
                }
              }

              .el-tree {
                background: v-bind("filterStyle.dropdownBgColor");

                .el-tree-node {
                  &.is-checked {
                    .el-tree-node__content {
                      .el-select-dropdown__item {
                        &::after {
                          display: none;
                        }
                      }
                    }
                  }

                  .el-tree-node__content {
                    border-radius: 4px;
                    padding: 5px 0;
                    &:hover {
                      background: v-bind("filterStyle.dropdownOptionHoverBgColor");
                    }
                  }
                }
              }
            }
          }
        }
      }

      .el-popper__arrow {
        display: none;
      }
    }
  }
}
</style>
