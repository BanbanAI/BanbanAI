import { unique } from "@common/utils/unique";
import { DefinedOptions, NinePatch, OptionFieldValue, OptionFontValue, OptionFileValue } from "@renderer/b2/types";
import { Widget, FilterWidget } from "@renderer/b2/controllers/widget";
import { Board } from "@renderer/b2/controllers/board";
import { Soul } from "@common/types/project";
import { Color } from "@renderer/b2/color";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { nextTick, ref, watch, defineAsyncComponent } from "vue";
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { MenuItem, MenuItemOptions } from "./types";

const defaultColoredArray = {
  options: [
  ],
};
const optionText = i18next.t("button");

export class FilterMenu extends FilterWidget {
  constructor(soul: Soul, parent: Widget | Board) {
    // 兼容
    if (soul.options?.["spacing"]) {
      soul.options["item-size"] = soul.options["spacing"];
      delete soul.options["spacing"];
    }
    super(soul, parent);
  }

  initAfterConstructor() {
    super.initAfterConstructor();

    if (!this.menuItemOption?.options?.length) {
      const options: MenuItem[] = [];
      for (let i = 1; i < 4; i++) {
        options.push({
          label: `${i18next.t('option')}${i}`,
          id: unique(),
          value: `${i18next.t('option')}${i}`,
        })
      }
      this.menuItemOption = {
        ...this.menuItemOption,
        options
      };
    }

    this.watchFilterOption();
    this.watchMenuItemOption();

    if (!this.getBoard().status.isEditable && !this._selectedItemKey.value  && this.menuItemOption.checkedValue) {
      this.selectedItemKey = this.menuItemOption.checkedValue;
    }
  }

  private watchFilterOption() {
    this.effectScope.run(() => {
      watch(() => {
        if (!this.linkageOut) return;
        const selectedOption = this.menuItemOption.options.find(item => item.id === this.selectedItemKey);
        return { rule: this.linkageSetting, selectedOption: selectedOption }
      }, (val, oldVal) => {
        if (equals(val, oldVal) || !val?.rule) return;

        const selectOptionRule = val?.rule?.[val?.selectedOption?.id];
        if (!selectOptionRule?.length) {
          this.withdrawFilter();
          return;
        }

        this.applyFilter(selectOptionRule);
      }, { immediate: true })
    });
  }

  private watchMenuItemOption() {
    this.effectScope.run(() => {
      watch(() => {
        return Array.from(new Set(this.menuItemOption?.options || []));
      }, (val, oldVal) => {
        if(!equals(val, oldVal)) {
          if(!this.isConnectionInited && this.hasValueField() && !val?.length) return;
          let originList = this.menuItemOption.options || [];
          if(!oldVal?.length && !originList.length) {
            this._menuItemList.value = val;
          } else {
            if(!this._menuItemList) this._menuItemList = ref(undefined);
            const newList = val.length ? deepClone(originList) : [];
            this._menuItemList.value = newList;
          }
          // this.setOption("last-button-list", this._menuItemList?.value, false);
        }
      }, { immediate: true, deepClone: true })
    })
  }

  public _selectedItemKey = ref(this.selectedKey);
  public _scrollButtonItems = ref([]);

  get styleCategory() {
    return "select";
  }

  get scrollButtonItems() {
    return this._scrollButtonItems.value
  }

  set scrollButtonItems(val){
    this._scrollButtonItems.value = val
  }

  get selectedItemKey() {
    if (this.getBoard().status.isEditable) {
      return this.menuItemOption.checkedValue;
    } else {
      return this._selectedItemKey.value;
    }
  }

  set selectedItemKey(val) {
    this._selectedItemKey.value = val as string;
    if (this.getBoard().status.isEditable) {
      this.menuItemOption = {
        ...this.menuItemOption,
        checkedValue: val
      };
    }
  }

  static resource = resource;
  static defineOptions(): DefinedOptions[] {
    const UNIT_GE = i18next.t("unitGe");
    const UNIT_MIAO = i18next.t("unitMiao");
    const optionText = i18next.t("button");
    return [{
      data: {
        fields: {
          alias: i18next.t("fieldSetting"),
          fold: "unfold",
          children: [
            {
              name: "axis-value",
              alias: i18next.t("axisValue"),
              type: "field",
            },
            {
              name: "buttons-linkage-fields",
              alias: i18next.t("linkageField"),
              type: "field",
            }
          ],
          visible: false
        },
        //联动字段绑定
        relationship: {
          alias: i18next.t('dropdownOption'),
          fold: "fold",
          children: [
            {
              name: "menu-item-option",
              alias:i18next.t("buttonNameOption"),
              type: `menu-item(draggable, defaultString=${optionText})`,
              default: defaultColoredArray,
            },
          ],
        },
        linkage: {
          locked: false,
          fold: "unfold",
          children: [
            {
              name: "linkage-elements",
              visible: false
            },
            {
              name: "linkage-setting",
              alias: i18next.t('linkageSetting'),
              type: "dialog",
              dialog: {
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/DataSourceFilterRuleDialog.vue")),
                buttonText: (widget: FilterMenu)=>{
                  if ((!isEmpty(widget.linkageSetting) && Object.values(widget.linkageSetting).some(conditions => conditions.length))) {
                    return i18next.t('linkageRuleSet');
                  }
                  return i18next.t('setting');
                },
                buttonStyle(element: FilterMenu, paths) {
                  const value = element.linkageSetting;
                  return (!isEmpty(value) && Object.values(value).some(conditions => conditions.length)) ? { color: 'var(--color-primary)' } : {};
                },
              },
              visible: (element: FilterMenu, paths) => {
                return element.linkageOut;
              },
            }
          ]
        },
      },
      style: {
        basic: {
          children: [
            {
              name: "last-button-list",
              type: "hidden",
              default: []
            },
            {
              name: "grid-height",
              default: 6,
            },
            {
              name: "grid-width",
              default: 18,
            },
            {
              name: "no-events",
              visible: false
            },
            {
              name: "dropdown-no-data",
              alias: i18next.t('selectTip'),
              type: "string",
              default: i18next.t('plsSelect'),
            },
          ]
        },
        "widget-title": {
          default: true,
          children: [
            {
              name: "widget-title-text",
              alias: i18next.t('title'),
              type: "string",
              default: i18next.t('filterMenu'),
            },
          ]
        },
      },
    }, ...super.defineOptions()]
  }

  get menuItemOption() {
    return this.getOption<MenuItemOptions>('menu-item-option');
  }

  set menuItemOption(value: MenuItemOptions) {
    this.setOption('menu-item-option', value);
  }

  get linkageSetting() {
    return this.getOption("linkage-setting");
  }

  hasValueField() {
    return (this.axisValue || []).length > 0;
  }

  private _menuItemList = ref(undefined);
  get menuItemList() {
    return this._menuItemList?.value ?? [];
  }

  selectName(){
    let name = [];
    this.getArrayClusterIndexes("item-style-cluster")?.map(item=>{
      name.push({id:item,name:this.getOption(["item-style-cluster",item,"item-key"])})
    })
    return name
  }

  // 选中对应项，触发筛选联动
  setSelectedItem(itemKey?: string) {
    let buttonInfo = this.menuItemList?.find(item=>item.id==itemKey);
    if(itemKey && buttonInfo) {
      this.selectedItemKey = itemKey;
      if (this.hasValueField() && this.buttonOptionSetting === "data") {
        this.applyLinkage({ name: buttonInfo.field, value: buttonInfo.value });
        return
      }
      const linkageField = this.linkageField;
      if (linkageField) {
        const linkageValues = this.linkageValues || {};
        if (linkageValues[itemKey] !== "") {
          this.applyLinkage({ name: linkageField, value: linkageValues[itemKey] || buttonInfo.value });
        }
      }
    } else {
      // 不允许取消时，且有第一项，选中第一项
      if(!this.allowUnselected && this.menuItemList?.[0]?.id) {
        if(this.selectedItemKey !== this.menuItemList?.[0]?.id) {
          this.setSelectedItem(this.menuItemList?.[0]?.id);
        }
      } else {
        this.selectedItemKey = "";
        this.withdrawLinkage();
      }
    }
  }

  copyDefaultStyle(type: "default" | "hover" | "selected", index, indexes) {
    let enable = this.getOption(["item-style-cluster", index, `item-${type}-enable`]);
    let spacing = this.getOption(["item-style-cluster", index, `item-spacing-${type}`])
    let fontStyle = this.getOption(["item-style-cluster", index, `font-${type}`]);
    let bgColor = this.getOption(["item-style-cluster", index, `background-color-${type}`]);
    let shadowColor = this.getOption(["item-style-cluster", index, `font-shadow-color-${type}`]);
    let shadowBlur = this.getOption(["item-style-cluster", index, `font-shadow-blur-${type}`]);
    let shadowOffset = this.getOption(["item-style-cluster", index, `font-shadow-offset-${type}`]);
    let borderSize = this.getOption(["item-style-cluster", index, `border-size-${type}`]);
    let borderRadius = this.getOption(["item-style-cluster", index, `border-radius-${type}`]);
    let borderColor = this.getOption(["item-style-cluster", index, `border-color-${type}`]);
    let borderStyle = this.getOption(["item-style-cluster", index, `border-style-${type}`]);
    let fillType = this.getOption(["item-style-cluster", index, `background-image-fill-${type}`]);
    let image = this.getOption(["item-style-cluster", index, `background-image-${type}`])
    let bgBlur = this.getOption(["item-style-cluster", index, `background-blur-${type}`]);
    let textOffset = this.getOption(["item-style-cluster", index, `text-offset-${type}`]);
    let align = this.getOption(["item-style-cluster", index, `text-align-${type}`]);
    let use_nine_patch = this.getOption(["item-style-cluster", index, `use-nine-patch-${type}`]);
    let patch = this.getOption<NinePatch>(["item-style-cluster", index, `nine-patch-${type}`]);
    this.setOption(["item-style-cluster", indexes, `item-${type}-enable`], enable, false);
    this.setOption(["item-style-cluster", indexes, `item-spacing-${type}`], spacing, false);
    this.setOption(["item-style-cluster", indexes, `font-${type}`], fontStyle, false);
    this.setOption(["item-style-cluster", indexes, `background-color-${type}`], bgColor, false);
    this.setOption(["item-style-cluster", indexes, `font-shadow-color-${type}`], shadowColor, false);
    this.setOption(["item-style-cluster", indexes, `font-shadow-blur-${type}`], shadowBlur, false);
    this.setOption(["item-style-cluster", indexes, `font-shadow-offset-${type}`], shadowOffset, false);
    this.setOption(["item-style-cluster", indexes, `border-size-${type}`], borderSize, false);
    this.setOption(["item-style-cluster", indexes, `border-radius-${type}`], borderRadius, false);
    this.setOption(["item-style-cluster", indexes, `border-color-${type}`], borderColor, false);
    this.setOption(["item-style-cluster", indexes, `border-style-${type}`], borderStyle, false);
    this.setOption(["item-style-cluster", indexes, `background-image-fill-${type}`], fillType, false);
    this.setOption(["item-style-cluster", indexes, `background-image-${type}`], image, false);
    this.setOption(["item-style-cluster", indexes, `background-blur-${type}`], bgBlur, false);
    this.setOption(["item-style-cluster", indexes, `text-offset-${type}`], textOffset, false);
    this.setOption(["item-style-cluster", indexes, `text-align-${type}`], align, false);
    this.setOption(["item-style-cluster", indexes, `use-nine-patch-${type}`], use_nine_patch, false);
    this.setOption(["item-style-cluster", indexes, `nine-patch-${type}`], {
      top: patch?.top || 0,
      right: patch?.right || 0,
      bottom: patch?.bottom || 0,
      left: patch?.left || 0
    }, false);
  }

  get currentValue(): MenuItem | null {
    const selectedItem = this.menuItemList.find((item) => item.id === this.selectedItemKey)
    if (!selectedItem) return null;
    return {
      ...selectedItem,
    }
  }

  getPrivateFieldAlias() {
    const buttonNameSetting = this.buttonOptionSetting;
    const linkageField = this.linkageField;

    if (buttonNameSetting === "data") {
      return [];
    }
    return linkageField ? [linkageField] : [];
  }

  get linkageOut() {
    return this.getOption('linkage-out') as boolean;
  }

  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value");
  }

  get linkageField() {
    return this.getOption<string>("linkage-field");
  }

  get linkageValues() {
    return this.getOption<object>("linkage-values");
  }

  get buttonOptionSetting() {
    return this.getOption("button-option-setting");
  }

  get allowUnselected() {
    return this.getOption("allow-unselected");
  }

  get selectedKey() {
    return this.getOption<string>("selected-key");
  }

  get layoutSetting() {
    return this.getOption("layout-setting");
  }

  get dropdownNoData() {
    return this.getOption("dropdown-no-data");
  }
}
