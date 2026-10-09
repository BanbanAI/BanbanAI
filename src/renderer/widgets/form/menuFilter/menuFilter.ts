import { DefinedOptions, OptionTableValue, NinePatch, OptionFieldValue } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { debounce } from "lodash";
import { Ref, ref, watch } from "vue";
import { equals } from "@common/utils/object";

type SelectItem = {
  key: string;
  label: string;
  value: string;
  field: string;
  checked: boolean;
};

type ButtonItem = {
  isEmpty: boolean;
  key: string;
  label: string;
  style: Record<string, string>;
  checked: boolean;
  useSelectedStyle: boolean;
  useHoverStyle: boolean;
  show: boolean;
  field: string;
};

export class MenuFilter extends FormElement {
  public _scrollButtonItems = ref([]);

  get scrollButtonItems() {
    return this._scrollButtonItems.value;
  }

  set scrollButtonItems(val) {
    this._scrollButtonItems.value = val;
  }

  static resource = resource;

  get defaultName() {
    return i18next.t("defaultName");
  }

  public buttonItems = ref<ButtonItem[]>([]);

  public get selectedValue(): ButtonItem[] {
    return this.buttonItems.value.filter((item) => item.checked === true);
  }

  static defineOptions(): DefinedOptions[] {
    const UNIT_GE = i18next.t("unitGe");
    const UNIT_MIAO = i18next.t("unitMiao");
    const buttonText = i18next.t("button");
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldSetting"),
            fold: "unfold",
            children: [
              {
                name: "linkage-fields",
                alias: i18next.t("linkageField"),
                type: "field",
              },
            ],
          },
          linkage: {
            children: [
              {
                name: "linkage-out",
                type: "boolean",
                default: true,
              },
            ],
          },
        },
        style: {
          check: {
            visible: false,
          },
          basic: {
            children: [
              {
                name: "last-button-list",
                type: "hidden",
                default: [],
              },
            ],
          },
          layoutStyle: {
            alias: i18next.t("layoutAndStyle"),
            children: [
              {
                name: "item-layout-cluster",
                alias: i18next.t("itemlayoutCluster"),
                fold: "unfold",
                children: [
                  {
                    name: "layout-setting",
                    alias: i18next.t("layoutSetting"),
                    type: "select(radioGroup)",
                    default: "classic",
                    selectChoices: [
                      {
                        value: "classic",
                        label: i18next.t("classic"),
                      },
                      {
                        value: "scroll",
                        label: i18next.t("scroll"),
                      },
                    ],
                  },
                  {
                    name: "layout-scroll-count",
                    alias: i18next.t("layoutScrollCount"),
                    type: "number(unit=" + UNIT_GE + ", min=1)",
                    default: 3,
                    visible: (widget) => widget.getOption("layout-setting") === "scroll",
                  },
                  {
                    name: "layout-arrangement",
                    alias: i18next.t("layoutArrangement"),
                    type: "select(radioGroup)",
                    default: "horizontal",
                    selectChoices: [
                      {
                        value: "horizontal",
                        label: i18next.t("horizontal"),
                      },
                      {
                        value: "vertical",
                        label: i18next.t("vertical"),
                      },
                    ],
                    visible: (widget) => widget.getOption("layout-setting") === "scroll",
                  },
                  {
                    name: "layout-animation",
                    alias: i18next.t("layoutAnimation"),
                    type: "number(unit=" + UNIT_MIAO + ")",
                    default: 1.25,
                    visible: (widget) => widget.getOption("layout-setting") === "scroll",
                  },
                  {
                    name: "layout",
                    alias: i18next.t("layout"),
                    type: `vector<${i18next.t("row")},${i18next.t("column")}>`,
                    default: [1, 3],
                    visible: (widget) => widget.getOption("layout-setting") !== "scroll",
                  },
                  {
                    name: "auto-layout",
                    alias: i18next.t("autoLayout"),
                    tip: i18next.t("autoLayoutTip"),
                    type: "boolean",
                    default: true,
                    visible: (widget) => widget.getOption("layout-setting") !== "scroll",
                  },
                  {
                    name: "item-size",
                    alias: i18next.t("spacing"),
                    type: `vector<${i18next.t("width")},${i18next.t("height")}>(unit=px)`,
                    default: [100, 50],
                  },
                  {
                    name: "text-arrangement",
                    alias: i18next.t("textArrangement"),
                    type: "select(radioGroup)",
                    default: "horizontal",
                    selectChoices: [
                      {
                        value: "horizontal",
                        label: i18next.t("horizontal"),
                      },
                      {
                        value: "vertical",
                        label: i18next.t("vertical"),
                      },
                    ],
                  },
                  {
                    name: "layout-cluster",
                    alias: i18next.t("layoutCluster"),
                    cluster: "array",
                    items: (widget: MenuFilter) => {
                      if (!widget.buttonList?.length) return [];
                      return widget.buttonList.map((item) => item.label);
                    },
                    editable: false,
                    sortable: false,
                    children: [
                      {
                        name: "offset-x",
                        alias: i18next.t("offsetX"),
                        type: "number(unit=px)",
                        default: 0,
                      },
                      {
                        name: "offset-y",
                        alias: i18next.t("offsetY"),
                        type: "number(unit=px)",
                        default: 0,
                      },
                      {
                        name: "item-rotation",
                        alias: i18next.t("itemRotation"),
                        type: "number(unit=°,min=-180,max=180,showInput,step=1)",
                        default: 0,
                      },
                    ],
                  },
                ],
              },
              {
                name: "item-style-cluster",
                fold: "unfold",
                alias: i18next.t("itemStyleCluster"),
                cluster: "array",
                sortable: false,
                items: (widget: MenuFilter) => {
                  return [i18next.t("global")];
                },
                children: [
                  {
                    name: "item-key",
                    alias: i18next.t("itemkey"),
                    type: "select",
                    selectChoices: (widget: MenuFilter) => {
                      if (!widget.buttonList?.length) return [];
                      return widget.buttonList.map((button, index) => {
                        return {
                          label: `( ${index + 1} ) ${button.label}`,
                          value: button.key,
                        };
                      });
                    },
                    visible(widget: MenuFilter, paths) {
                      let [cluster, id] = paths;
                      let indexes = widget.getArrayClusterIndexes("item-style-cluster");
                      return id != indexes[0];
                    },
                  },
                  {
                    name: "item-default-cluster",
                    alias: i18next.t("itemDefault"),
                    show: "tab",
                    fold: "unfold",
                    children: [
                      {
                        name: "font-style-cluster",
                        alias: i18next.t("fontStyleCluster"),
                        children: [
                          {
                            name: "font-default",
                            alias: i18next.t("font"),
                            type: "font(gradient=true)",
                            default: {
                              family: "sans-serif",
                              color: "#d5d5d6",
                              size: 12,
                              bold: false,
                              italic: false,
                              underline: false,
                              "line-through": false,
                            },
                          },
                          {
                            name: "text-spacing-default",
                            alias: i18next.t("textSpacing"),
                            default: 0,
                            type: "number(unit=px)",
                          },
                          {
                            name: "text-align-default",
                            alias: i18next.t("textAlign"),
                            type: "align",
                            default: "center",
                          },
                          {
                            name: "text-offset-default",
                            alias: i18next.t("textOffset"),
                            type: "vector<X,Y>(unit=px)",
                            default: [0, 0],
                          },
                        ],
                      },
                      {
                        name: "font-shadow-cluster",
                        alias: i18next.t("fontShadowCluster"),
                        children: [
                          {
                            name: "font-shadow-color-default",
                            alias: i18next.t("fontShadowColor"),
                            type: "color",
                            default: "#ffffff",
                          },
                          {
                            name: "font-shadow-blur-default",
                            alias: i18next.t("fontShadowBlur"),
                            type: "number(unit=px)",
                            default: -1,
                          },
                          {
                            name: "font-shadow-offset-default",
                            alias: i18next.t("fontShadowOffset"),
                            type: "vector<X,Y>(unit=px)",
                            default: [0, 0],
                          },
                        ],
                      },
                      {
                        name: "border-cluster",
                        alias: i18next.t("borderCluster"),
                        children: [
                          {
                            name: "border-color-default",
                            alias: i18next.t("borderColor"),
                            type: "color",
                            default: "#3d4451",
                          },
                          {
                            name: "border-size-default",
                            alias: i18next.t("borderSize"),
                            type: "number(unit=px, min=0)",
                            default: 1,
                          },
                          {
                            name: "border-radius-default",
                            alias: i18next.t("borderRadius"),
                            type: "number(unit=px, min=0)",
                            default: 0,
                          },
                          {
                            name: "border-style-default",
                            alias: i18next.t("borderStyle"),
                            type: "select(radioGroup)",
                            selectChoices: [
                              { value: "solid", label: i18next.t("borderSolid") },
                              { value: "dashed", label: i18next.t("borderDashed") },
                              { value: "dotted", label: i18next.t("borderDotted") },
                              { value: "none", label: i18next.t("borderNone") },
                            ],
                            default: "solid",
                          },
                        ],
                      },
                      {
                        name: "background-cluster",
                        alias: i18next.t("bgCluster"),
                        children: [
                          {
                            name: "background-color-default",
                            alias: i18next.t("bgColor"),
                            type: "color",
                            default: "#0F162298",
                          },
                          {
                            name: "background-image-default",
                            alias: i18next.t("bgImage"),
                            type: "file(format=image)",
                          },
                          {
                            name: "background-image-fill-default",
                            alias: i18next.t("imageFillStyle"),
                            type: "select(radioGroup)",
                            selectChoices: [
                              {
                                label: i18next.t("stretch"),
                                value: "stretch",
                              },
                              {
                                label: i18next.t("tile"),
                                value: "tile",
                              },
                              {
                                label: i18next.t("noneFill"),
                                value: "none",
                              },
                            ],
                            default: "stretch",
                          },
                          {
                            name: "background-blur-default",
                            alias: i18next.t("backgroundBlur"),
                            type: "number(unit=px)",
                            default: 0,
                          },
                          {
                            name: "background-image-scale-default",
                            alias: i18next.t("backgroundScale"),
                            type: "number(unit=%)",
                            default: 100,
                            visible: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-fill-default"]) === "none";
                            },
                          },
                          {
                            name: "background-image-position-default",
                            alias: i18next.t("backgroundPosition"),
                            type: "vector<X,Y>(unit=px)",
                            default: [0, 0],
                            visible: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-fill-default"]) === "none";
                            },
                          },
                          {
                            name: "use-nine-patch-default",
                            alias: i18next.t("isUseNinePatch"),
                            type: "boolean",
                            default: false,
                            visible: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-fill-default"]) === "stretch";
                            },
                          },
                          {
                            name: "nine-patch-default",
                            alias: i18next.t("ninePatch"),
                            type: "nine-patch",
                            visible: (widget, paths) => {
                              return (
                                widget.getOption([...paths, "background-image-fill-default"]) === "stretch" &&
                                widget.getOption([...paths, "use-nine-patch-default"])
                              );
                            },
                            imageSource: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-default"]);
                            },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    name: "item-selected-cluster",
                    alias: i18next.t("itemSelected"),
                    show: "tab",
                    children: [
                      {
                        name: "item-selected-enable",
                        alias: i18next.t("itemSelectedEnable"),
                        type: "boolean",
                        default: true,
                        visible: false,
                      },
                      {
                        name: "font-style-cluster",
                        alias: i18next.t("fontStyleCluster"),
                        children: [
                          {
                            name: "font-selected",
                            alias: i18next.t("font"),
                            type: "font(gradient=true)",
                            default: {
                              family: "sans-serif",
                              color: "#d5d5d6",
                              size: 12,
                              bold: false,
                              italic: false,
                              underline: false,
                              "line-through": false,
                            },
                          },
                          {
                            name: "text-spacing-selected",
                            alias: i18next.t("textSpacing"),
                            default: 0,
                            type: "number(unit=px)",
                          },
                          {
                            name: "text-align-selected",
                            alias: i18next.t("textAlign"),
                            type: "align",
                            default: "center",
                          },
                          {
                            name: "text-offset-selected",
                            alias: i18next.t("textOffset"),
                            type: "vector<X,Y>(unit=px)",
                            default: [0, 0],
                          },
                        ],
                        visible: (widget, paths) => widget.getOption([...paths, "item-selected-enable"]),
                      },
                      {
                        name: "font-shadow-cluster",
                        alias: i18next.t("fontShadowCluster"),
                        children: [
                          {
                            name: "font-shadow-color-selected",
                            alias: i18next.t("fontShadowColor"),
                            type: "color",
                            default: "#ffffff",
                          },
                          {
                            name: "font-shadow-blur-selected",
                            alias: i18next.t("fontShadowBlur"),
                            type: "number(unit=px)",
                            default: -1,
                          },
                          {
                            name: "font-shadow-offset-selected",
                            alias: i18next.t("fontShadowOffset"),
                            type: "vector<X,Y>(unit=px)",
                            default: [0, 0],
                          },
                        ],
                        visible: (widget, paths) => widget.getOption([...paths, "item-selected-enable"]),
                      },
                      {
                        name: "border-cluster",
                        alias: i18next.t("borderCluster"),
                        children: [
                          {
                            name: "border-color-selected",
                            alias: i18next.t("borderColor"),
                            type: "color",
                            default: "#3d91de",
                          },
                          {
                            name: "border-size-selected",
                            alias: i18next.t("borderSize"),
                            type: "number(unit=px)",
                            default: 1,
                          },
                          {
                            name: "border-radius-selected",
                            alias: i18next.t("borderRadius"),
                            type: "number(unit=px)",
                            default: 0,
                          },
                          {
                            name: "border-style-selected",
                            alias: i18next.t("borderStyle"),
                            type: "select(radioGroup)",
                            selectChoices: [
                              { value: "solid", label: i18next.t("borderSolid") },
                              { value: "dashed", label: i18next.t("borderDashed") },
                              { value: "dotted", label: i18next.t("borderDotted") },
                              { value: "none", label: i18next.t("borderNone") },
                            ],
                            default: "solid",
                          },
                        ],
                        visible: (widget, paths) => widget.getOption([...paths, "item-selected-enable"]),
                      },
                      {
                        name: "background-cluster",
                        alias: i18next.t("bgCluster"),
                        children: [
                          {
                            name: "background-color-selected",
                            alias: i18next.t("bgColor"),
                            type: "color",
                            default: "#1890FF98",
                          },
                          {
                            name: "background-image-selected",
                            alias: i18next.t("bgImage"),
                            type: "file(format=image)",
                          },
                          {
                            name: "background-image-fill-selected",
                            alias: i18next.t("imageFillStyle"),
                            type: "select(radioGroup)",
                            selectChoices: [
                              {
                                label: i18next.t("stretch"),
                                value: "stretch",
                              },
                              {
                                label: i18next.t("tile"),
                                value: "tile",
                              },
                              {
                                label: i18next.t("noneFill"),
                                value: "none",
                              },
                            ],
                            default: "stretch",
                          },
                          {
                            name: "background-blur-selected",
                            alias: i18next.t("backgroundBlur"),
                            type: "number(unit=px)",
                            default: 0,
                          },
                          {
                            name: "background-image-scale-selected",
                            alias: i18next.t("backgroundScale"),
                            type: "number(unit=%)",
                            default: 100,
                            visible: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-fill-selected"]) === "none";
                            },
                          },
                          {
                            name: "background-image-position-selected",
                            alias: i18next.t("backgroundPosition"),
                            type: "vector<X,Y>(unit=px)",
                            default: [0, 0],
                            visible: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-fill-selected"]) === "none";
                            },
                          },
                          {
                            name: "use-nine-patch-selected",
                            alias: i18next.t("isUseNinePatch"),
                            type: "boolean",
                            default: false,
                            visible: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-fill-selected"]) === "stretch";
                            },
                          },
                          {
                            name: "nine-patch-selected",
                            alias: i18next.t("ninePatch"),
                            type: "nine-patch",
                            visible: (widget, paths) => {
                              return (
                                widget.getOption([...paths, "background-image-fill-selected"]) === "stretch" &&
                                widget.getOption([...paths, "use-nine-patch-selected"])
                              );
                            },
                            imageSource: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-selected"]);
                            },
                          },
                        ],
                        visible: (widget, paths) => widget.getOption([...paths, "item-selected-enable"]),
                      },
                    ],
                  },
                  {
                    name: "item-hover-cluster",
                    alias: i18next.t("itemHover"),
                    show: "tab",
                    children: [
                      {
                        name: "item-hover-enable",
                        alias: i18next.t("itemHoverEnable"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "font-style-cluster",
                        alias: i18next.t("fontStyleCluster"),
                        children: [
                          {
                            name: "font-hover",
                            alias: i18next.t("font"),
                            type: "font(gradient=true)",
                            default: {
                              family: "sans-serif",
                              color: "#d5d5d6",
                              size: 12,
                              bold: false,
                              italic: false,
                              underline: false,
                              "line-through": false,
                            },
                          },
                          {
                            name: "text-spacing-hover",
                            alias: i18next.t("textSpacing"),
                            default: 0,
                            type: "number(unit=px)",
                          },
                          {
                            name: "text-align-hover",
                            alias: i18next.t("textAlign"),
                            type: "align",
                            default: "center",
                          },
                          {
                            name: "text-offset-hover",
                            alias: i18next.t("textOffset"),
                            type: "vector<X,Y>(unit=px)",
                            default: [0, 0],
                          },
                        ],
                        visible: (widget, paths) => widget.getOption([...paths, "item-hover-enable"]),
                      },
                      {
                        name: "font-shadow-cluster",
                        alias: i18next.t("fontShadowCluster"),
                        children: [
                          {
                            name: "font-shadow-color-hover",
                            alias: i18next.t("fontShadowColor"),
                            type: "color",
                            default: "#ffffff",
                          },
                          {
                            name: "font-shadow-blur-hover",
                            alias: i18next.t("fontShadowBlur"),
                            type: "number(unit=px)",
                            default: -1,
                          },
                          {
                            name: "font-shadow-offset-hover",
                            alias: i18next.t("fontShadowOffset"),
                            type: "vector<X,Y>(unit=px)",
                            default: [0, 0],
                          },
                        ],
                        visible: (widget, paths) => widget.getOption([...paths, "item-hover-enable"]),
                      },
                      {
                        name: "border-cluster",
                        alias: i18next.t("borderCluster"),
                        children: [
                          {
                            name: "border-color-hover",
                            alias: i18next.t("borderColor"),
                            type: "color",
                            default: "#4776A2FF",
                          },
                          {
                            name: "border-size-hover",
                            alias: i18next.t("borderSize"),
                            type: "number(unit=px)",
                            default: 1,
                          },
                          {
                            name: "border-radius-hover",
                            alias: i18next.t("borderRadius"),
                            type: "number(unit=px)",
                            default: 0,
                          },
                          {
                            name: "border-style-hover",
                            alias: i18next.t("borderStyle"),
                            type: "select(radioGroup)",
                            selectChoices: [
                              { value: "solid", label: i18next.t("borderSolid") },
                              { value: "dashed", label: i18next.t("borderDashed") },
                              { value: "dotted", label: i18next.t("borderDotted") },
                              { value: "none", label: i18next.t("borderNone") },
                            ],
                            default: "solid",
                          },
                        ],
                        visible: (widget, paths) => widget.getOption([...paths, "item-hover-enable"]),
                      },
                      {
                        name: "background-cluster",
                        alias: i18next.t("bgCluster"),
                        children: [
                          {
                            name: "background-color-hover",
                            alias: i18next.t("bgColor"),
                            type: "color",
                            default: "#2E659898",
                          },
                          {
                            name: "background-image-hover",
                            alias: i18next.t("bgImage"),
                            type: "file(format=image)",
                          },
                          {
                            name: "background-image-fill-hover",
                            alias: i18next.t("imageFillStyle"),
                            type: "select(radioGroup)",
                            selectChoices: [
                              {
                                label: i18next.t("stretch"),
                                value: "stretch",
                              },
                              {
                                label: i18next.t("tile"),
                                value: "tile",
                              },
                              {
                                label: i18next.t("noneFill"),
                                value: "none",
                              },
                            ],
                            default: "stretch",
                          },
                          {
                            name: "background-blur-hover",
                            alias: i18next.t("backgroundBlur"),
                            type: "number(unit=px)",
                            default: 0,
                          },
                          {
                            name: "background-image-scale-hover",
                            alias: i18next.t("backgroundScale"),
                            type: "number(unit=%)",
                            default: 100,
                            visible: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-fill-hover"]) === "none";
                            },
                          },
                          {
                            name: "background-image-position-hover",
                            alias: i18next.t("backgroundPosition"),
                            type: "vector<X,Y>(unit=px)",
                            default: [0, 0],
                            visible: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-fill-hover"]) === "none";
                            },
                          },
                          {
                            name: "use-nine-patch-hover",
                            alias: i18next.t("isUseNinePatch"),
                            type: "boolean",
                            default: false,
                            visible: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-fill-hover"]) === "stretch";
                            },
                          },
                          {
                            name: "nine-patch-hover",
                            alias: i18next.t("ninePatch"),
                            type: "nine-patch",
                            visible: (widget, paths) => {
                              return (
                                widget.getOption([...paths, "background-image-fill-hover"]) === "stretch" &&
                                widget.getOption([...paths, "use-nine-patch-hover"])
                              );
                            },
                            imageSource: (widget, paths) => {
                              return widget.getOption([...paths, "background-image-hover"]);
                            },
                          },
                        ],
                        visible: (widget, paths) => widget.getOption([...paths, "item-hover-enable"]),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  hasValueField() {
    return (this.getOption<OptionFieldValue[]>("linkage-fields") || []).length > 0;
  }

  private _buttonList = ref<SelectItem[]>([]);
  get buttonList(): SelectItem[] {
    if (!this._buttonList?.value.length) {
      this.effectScope.run(() => {
        watch(
          () => {
            if (!this.status.isVisible && this._buttonList?.value.length) return this._buttonList?.value;
            let buttonArray: SelectItem[] = [];

            if (!this.hasValueField()) return buttonArray;
            let valueDims = this.getOption<OptionFieldValue[]>("linkage-fields") || [];
            let valueDim = valueDims[0];
            let valueUid = valueDim.uid;

            let rawData = this.rowValue || []

            const linkageSet = new Set();
            const uniqueByLinkage = rawData.filter((item) => {
              const linkageVal = item[valueUid[2]];
              if (linkageSet.has(linkageVal)) return false;
              linkageSet.add(linkageVal);
              return true;
            });

            let rows = uniqueByLinkage.map((item) => item[valueUid[2]]);
            let linkageName = this.getFieldAlias(valueUid);

            for (let index = 0; index < uniqueByLinkage.length; index++) {
              buttonArray.push({
                label: rows[index],
                key: `${rows[index]}-${index}`,
                value: rows[index],
                field: linkageName,
                checked: false,
              });
            }

            if (buttonArray.length) {
              buttonArray.unshift({
                label: i18next.t("all"),
                key: "all",
                value: "all",
                field: linkageName,
                checked: false,
              });
            }

            return buttonArray;
          },
          (val, oldVal) => {
            if (!equals(val, oldVal) && oldVal) {
              if (!this.isConnectionInited && this.hasValueField() && !val?.length) return [];
              let originList = this.getOption<Object[]>("last-button-list") || [];
              if (!oldVal?.length && !originList.length) {
                this._buttonList.value = val;
              } else {
                let buttonsFields = this.getOption<OptionFieldValue[]>("linkage-fields") || [];
                // 更名、换顺序、删除、新增
                let updateKeys = (originList, currentList, useLinkage = false): SelectItem[] => {
                  const itemToKeyMap = new Map();
                  let diffLabelList = [];
                  let keyList = [];
                  originList.forEach((item) => {
                    itemToKeyMap.set(useLinkage ? item.value : item.label, item.key);
                    keyList.push(item.key);
                  });
                  let targetList = currentList.map((item) => {
                    let key;
                    let mapKey = useLinkage ? item.value : item.label;
                    if (itemToKeyMap.has(mapKey)) {
                      key = itemToKeyMap.get(mapKey);
                      itemToKeyMap.delete(mapKey);
                    } else {
                      diffLabelList.push({ label: mapKey, key: item.key });
                      let index = currentList.indexOf(item);
                      key = `${mapKey}-${index}`;
                      while (keyList.indexOf(key) > -1) {
                        index++;
                        key = `${mapKey}-${index}`;
                      }
                      keyList.push(key);
                    }
                    return { ...item, key };
                  });

                  let originMapList = Array.from(itemToKeyMap);
                  if (diffLabelList.length === 1 && originMapList.length === 1) {
                    let targetIndex = targetList.findLastIndex((item) => item.label === diffLabelList[0].label);
                    targetList.splice(targetIndex, 1, { ...targetList[targetIndex], key: originMapList[0][1] });
                  }
                  return targetList;
                };
                if (!this._buttonList) this._buttonList = ref(undefined);
                const newList = val.length ? updateKeys(originList, val, buttonsFields.length > 0) : [];
                this._buttonList.value = newList;
              }
              this.setOption("last-button-list", this._buttonList?.value, false);
            }
          },
          { immediate: true },
        );
      });
    }
    return this._buttonList?.value;
  }

  private _rowValue: Ref = ref(undefined);
  public get rowValue() {
    if(this._rowValue.value === undefined) {
      this.effectScope.run(() => {
        watch(() => {
          let columnUidList = []
          let valueDims = this.getOption<OptionFieldValue[]>("linkage-fields") || [];
          if (valueDims.length) {
            let tableUid = valueDims[0].uid.slice(0, 2)
            const columnFields = this.getTableFields(tableUid) ?? [];
            columnUidList = columnFields.map(field => field.uid);
          }
          return columnUidList;
        }, debounce(async(columnUidList, oldUidList) => {
          if (!columnUidList?.length || equals(columnUidList, oldUidList)) return;
          let valueDims = this.getOption<OptionFieldValue[]>("linkage-fields") || [];
          let valueUid = valueDims[0].uid;
          let tableUid = valueUid.slice(0, 2)
          let {rows, count} = await this.getData().getPagingRows(tableUid, {})
          this._rowValue.value = rows
        }, 200), { immediate: true })
      })
    }
    return this._rowValue.value
  }

  selectName() {
    let name = [];
    this.getArrayClusterIndexes("item-style-cluster")?.map((item) => {
      name.push({ id: item, name: this.getOption(["item-style-cluster", item, "item-key"]) });
    });
    return name;
  }

  // 选中对应项
  setSelectedItem(itemKey: string) {
    if (itemKey) {
      const index = this.buttonItems.value.findIndex((item) => item.key == itemKey);
      const selectedItem = this.buttonItems.value[index];
      if (selectedItem.checked) {
        if (selectedItem.key === "all") {
          for (let item of this.buttonItems.value) {
            item.checked = false;
          }
        } else {
          if (this.selectedValue.length === this.buttonItems.value.length) {
            this.buttonItems.value[0].checked = false;
          }
          selectedItem.checked = false;
        }
      } else {
        if (selectedItem.key === "all") {
          for (let item of this.buttonItems.value) {
            item.checked = true;
          }
        } else {
          if (this.selectedValue.length === this.buttonItems.value.length - 2) {
            this.buttonItems.value[0].checked = true;
          }
          selectedItem.checked = true;
        }
      }
    }
  }

  copyDefaultStyle(type: "default" | "hover" | "selected", index, indexes) {
    let enable = this.getOption(["item-style-cluster", index, `item-${type}-enable`]);
    let spacing = this.getOption(["item-style-cluster", index, `item-spacing-${type}`]);
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
    let image = this.getOption(["item-style-cluster", index, `background-image-${type}`]);
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
    this.setOption(
      ["item-style-cluster", indexes, `nine-patch-${type}`],
      { top: patch?.top || 0, right: patch?.right || 0, bottom: patch?.bottom || 0, left: patch?.left || 0 },
      false,
    );
  }

  get currentValue() {
    let arr = [];
    for (let item of this.buttonItems.value) {
      if (item.checked) {
        arr.push(item.label);
      }
    }
    return {
      value: arr,
    };
  }

  getPrivateFieldAlias() {
    const linkageField = this.getOption("linkage-fields");
    return linkageField ? [linkageField] : [];
  }
}
