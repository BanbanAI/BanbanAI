import { Soul } from "@common/types/project";
import { Widget } from "@renderer/b2/controllers/widget";
import { ref, watch } from "vue";
import { DefinedOptions, isOptionCluster, isOptionSubgroup, OptionFontValue } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { Color } from "@renderer/b2/color";
import { ClusterArrayValue } from "@common/types/project"
import { equals } from "@common/utils/object";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";

export class Tab extends Widget {
  public _tabIndex = ref(-1);
  public stopAnimate: boolean = false;
  public noEventStyle = ref('auto')
  public beforeIndex = 0;
  public _selectedItemKey = ref("");

  get selectedTabIndex() {
    return this._tabIndex.value;
  }

  set selectedTabIndex(val) {
    this._tabIndex.value = val;
  }

  constructor(soul: Soul, parent: Widget | Board) {
    super(soul, parent);
    this.initContainer();
  }
  static resource = resource;
  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          alias: i18next.t("basic"),
          fold: 'unfold',
          children: [
            {
              name: "no-events",
              alias: i18next.t("no-events"),
              tip: i18next.t("noEventsTips"),
              type: 'boolean',
              default: false,
            }
          ],
        },
        background: {
          default: true,
          children: [
            {
              name: "background-color",
              default: "transparent",
            }
          ],
        },
        tabs: {
          alias: i18next.t("tabs"),
          type: "boolean",
          default: true,
          children: [
            {
              name:"tabs-default",
              alias:i18next.t("tabs-default"),
              show:"tab",
              fold:"unfold",
              children:[
                {
                  name:"tabs-position-type",
                  alias:i18next.t("tabs-position-type"),
                  children:[
                    {
                      name: "tabs-type",
                      alias: i18next.t("tabs-type"),
                      type: "select(radioGroup)",
                      default: "tag",
                      selectChoices: [
                        { value: "tag", label: i18next.t("tag") },
                        { value: "mark", label: i18next.t("mark") },
                      ],
                    },
                    {
                      name: "tabs-tag-shape",
                      alias: i18next.t("tabs-tag-shape"),
                      type: "select(radioGroup)",
                      default: "right_angle",
                      selectChoices: [
                        { value: "right_angle", label: i18next.t("right_angle") },
                        { value: "fillet", label: i18next.t("fillet") },
                      ],
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-tag-direction",
                      alias: i18next.t("tabs-tag-direction"),
                      type: "select(radioGroup)",
                      default: "horizontal",
                      selectChoices: [
                        { value: "horizontal", label: i18next.t("horizontal") },
                        { value: "vertical", label: i18next.t("vertical") },
                      ],
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-tag-position",
                      alias: i18next.t("tabs-tag-position"),
                      type: "select",
                      default: "top_left",
                      selectChoices: [
                        { value: "top_left", label: i18next.t("top_left") },
                        { value: "top_center", label: i18next.t("top_center") },
                        { value: "top_right", label: i18next.t("top_right") },
                        { value: "right_center", label: i18next.t("right_center")},
                        { value: "bottom_right", label: i18next.t("bottom_right") },
                        { value: "bottom_center", label: i18next.t("bottom_center") },
                        { value: "bottom_left", label: i18next.t("bottom_left") },
                        { value: "left_center", label: i18next.t("left_center") },
                      ],
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-mark-shape",
                      alias: i18next.t("tabs-mark-shape"),
                      type: "select(radioGroup)",
                      default: "round",
                      selectChoices: [
                        { value: "round", label: i18next.t("round") },
                        { value: "square", label: i18next.t("square") },
                      ],
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "mark";
                      },
                    },
                    {
                      name: "tabs-mark-direction",
                      alias: i18next.t("tabs-mark-direction"),
                      type: "select(radioGroup)",
                      default: "horizontal",
                      selectChoices: [
                        { value: "horizontal", label: i18next.t("horizontal") },
                        { value: "vertical", label: i18next.t("vertical") },
                      ],
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "mark";
                      },
                    },
                    {
                      name: "tabs-mark-position",
                      alias: i18next.t("tabs-mark-position"),
                      type: "select",
                      default: "bottom_center",
                      selectChoices: [
                        { value: "top_left", label: i18next.t("top_left") },
                        { value: "top_center", label: i18next.t("top_center")},
                        { value: "top_right", label: i18next.t("top_right") },
                        { value: "right_center", label: i18next.t("right_center") },
                        { value: "bottom_right", label: i18next.t("bottom_right") },
                        { value: "bottom_center", label: i18next.t("bottom_center") },
                        { value: "bottom_left", label: i18next.t("bottom_left") },
                        { value: "left_center", label: i18next.t("left_center") },
                      ],
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "mark";
                      },
                    },
                    {
                      name: "tabs-tag-offset",
                      alias:i18next.t("tabs-tag-offset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                    {
                      name: "tabs-tag-width",
                      alias:i18next.t("tabs-tag-width"),
                      type: "number(unit=px, min=0)",
                      default: 60,
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-tag-height",
                      alias: i18next.t("tabs-tag-height"),
                      type: "number(unit=px, min=0)",
                      default: 30,
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-tag-border-visible",
                      alias: i18next.t("tabs-tag-border-visible"),
                      type: "boolean",
                      visible: false,
                      default: true,
                    },
                    {
                      name: "tabs-mark-width",
                      alias: i18next.t("tabs-mark-width"),
                      type: "number(unit=px)",
                      default: 10,
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "mark";
                      },
                    },
                    {
                      name: "tabs-mark-height",
                      alias: i18next.t("tabs-mark-height"),
                      type: "number(unit=px)",
                      default: 10,
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "mark";
                      },
                    },
                    {
                      name: "tabs-spacing",
                      alias: i18next.t("tabs-spacing"),
                      type: "number(unit=px)",
                      default: 8,
                    },
                  ]
                },
                {
                  name: "tabs-text",
                  alias: i18next.t("tabs-text"),
                  children: [
                    {
                      name: "tabs-text-display",
                      alias: i18next.t("tabs-text-display"),
                      type: "boolean",
                      default: false,
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "mark";
                      },
                    },
                    {
                      name: "tabs-text-font",
                      alias: i18next.t("tabs-text-font"),
                      type: "font",
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display")
                        } else {
                          return false;
                        }
                      },
                      default: {
                        color: "#000",
                        family: '',
                        size: 12,
                        bold: false,
                        italic: false,
                        underline: false,
                        "line-through": false
                      },
                    },
                    {
                      name: "tabs-text-align",
                      alias: i18next.t("tabs-text-align"),
                      type: "align",
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display")
                        } else {
                          return false;
                        }
                      },
                      default: "center"
                    },
                    {
                      name: "tabs-vertical-align",
                      alias: i18next.t("tabs-vertical-align"),
                      type: "align(vertical=true)",
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display")
                        } else {
                          return false;
                        }
                      },
                      default: "center"
                    },
                    {
                      name:"tabs-text-offset",
                      alias:i18next.t("textOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display")
                        } else {
                          return false;
                        }
                      },
                    },
                  ]
                },
                {
                  name: "tabs-shadow-cluster",
                  alias: i18next.t("fontShadow"),
                  children: [
                    {
                      name: "tabs-shadow-color",
                      alias: i18next.t("fontShadowColor"),
                      type: "color",
                      default: "#ffffff",
                    },
                    {
                      name: "tabs-shadow-blur",
                      alias: i18next.t("fontShadowBlur"),
                      type: "number(unit=px)",
                      default: -1,
                    },
                    {
                      name:"tabs-shadow-offset",
                      alias:i18next.t("fontOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ]
                },
                {
                  name:"tabs-border",
                  alias:i18next.t("tabs-border"),
                  children:[
                    {
                      name: "tabs-border-size",
                      alias: i18next.t("tabs-border-size"),
                      type: "number(unit=px, min=0)",
                      default: 0,
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-border-color",
                      alias: i18next.t("tabs-border-color"),
                      type: "color",
                      default: "#cccccc",
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-border-radius",
                      alias: i18next.t("borderRadius"),
                      type: "number(unit=px, min=0)",
                      default: 1
                    },
                    {
                      name: "tabs-border-style",
                      alias: i18next.t("borderStyle"),
                      type: "select(radioGroup)",
                      default: "solid",
                      selectChoices: [
                        {
                          value: "solid",
                          label: i18next.t("solid"),
                        },
                        {
                          value: "dashed",
                          label: i18next.t("dashed"),
                        },
                        {
                          value: "dotted",
                          label: i18next.t("dotted"),
                        },
                        {
                          value: "none",
                          label: i18next.t("borderNone"),
                        }
                      ]
                    },
                  ],
                  visible: (widget: Widget) => {
                    return widget.getOption("tabs-type") === "tag";
                  },
                },
                {
                  name:"tabs-background-type",
                  alias:i18next.t("tabs-background-type"),
                  children:[
                    {
                      name: "tabs-background-color",
                      alias: i18next.t("tabs-background-color"),
                      type: "color",
                      default: "#D1D8E4",
                    },
                    {
                      name: 'tabs-background-image',
                      alias: i18next.t("tabs-background-image"),
                      type: 'file(format=image|video)',// 先不加 preview
                    },
                    {
                      name: 'tabs-background-fill-type',
                      alias: i18next.t("tabs-background-fill-type"),
                      type: 'select(radioGroup)',
                      selectChoices: [
                        { value: 'stretch', label: i18next.t("stretch"), },
                        { value: 'tile', label: i18next.t("tile"),},
                        { value: "none", label: i18next.t("noneFill")}
                      ],
                      default: 'stretch',
                    },
                    {
                      name: "background-image-scale",
                      alias: i18next.t("backgroundScale"),
                      type: "number(unit=%)",
                      default: 100,
                      visible: (widget) => {
                        return widget.getOption("tabs-background-fill-type") === "none";
                      }
                    },
                    {
                      name: "background-image-position",
                      alias: i18next.t("backgroundPositon"),
                      type: "vector<X,Y>(unit=px)",
                      default: [0, 0],
                      visible: (widget) => {
                        return widget.getOption("tabs-background-fill-type") === "none";
                      }
                    },
                    {
                      name: 'tabs-background-blur',
                      alias: i18next.t("tabs-background-blur"),
                      type: 'number(unit=px)',
                      default: 0,
                    },
                    {
                      name: "tabs-use-nine-patch",
                      alias: i18next.t("useNinePatch"),
                      type: "boolean",
                      default: false,
                      visible: (widget:Tab) => {
                        return widget.getOption("tabs-background-fill-type") === 'stretch';
                      }
                    },
                    {
                      name: "tabs-nine-patch",
                      alias: i18next.t("ninePatch"),
                      type: "nine-patch",
                      default: {
                        top:0,
                        right:0,
                        left:0,
                        bottom:0
                      },
                      visible: (widget:Tab) => {
                        return  widget.getOption("tabs-background-fill-type") === 'stretch' && widget.getOption("tabs-use-nine-patch");
                      },
                      imageSource: (widget:Widget) => {
                      return widget.getOption("tabs-background-image");
                      }
                    },
                  ]
                },
              ]
            },
            {
              name:"tabs-select",
              alias:i18next.t("tabs-select"),
              show:"tab",
              fold:"unfold",
              children:[
                {
                  name: "tabs-text-selected",
                  alias: i18next.t("tabs-text"),
                  children: [
                    {
                      name: "tabs-text-display-selected",
                      alias: i18next.t("tabs-text-display"),
                      type: "boolean",
                      default: false,
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "mark";
                      },
                    },
                    {
                      name: "tabs-text-font-selected",
                      alias: i18next.t("tabs-text-font"),
                      type: "font",
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display-selected")
                        } else {
                          return false;
                        }
                      },
                      default: {
                        color: "#000",
                        family: '',
                        size: 12,
                        bold: false,
                        italic: false,
                        underline: false,
                        "line-through": false
                      },
                    },
                    {
                      name: "tabs-text-align-selected",
                      alias: i18next.t("tabs-text-align"),
                      type: "align",
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display-selected")
                        } else {
                          return false;
                        }
                      },
                      default: "center"
                    },
                    {
                      name: "tabs-vertical-align-selected",
                      alias: i18next.t("tabs-vertical-align"),
                      type: "align(vertical=true)",
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display-selected")
                        } else {
                          return false;
                        }
                      },
                      default: "center"
                    },
                    {
                      name:"tabs-text-offset-selected",
                      alias:i18next.t("textOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display-selected")
                        } else {
                          return false;
                        }
                      },
                    },
                  ]
                },
                {
                  name: "tabs-shadow-cluster-selected",
                  alias: i18next.t("fontShadow"),
                  children: [
                    {
                      name: "tabs-shadow-color-selected",
                      alias: i18next.t("fontShadowColor"),
                      type: "color",
                      default: "#ffffff",
                    },
                    {
                      name: "tabs-shadow-blur-selected",
                      alias: i18next.t("fontShadowBlur"),
                      type: "number(unit=px)",
                      default: -1,
                    },
                    {
                      name:"tabs-shadow-offset-selected",
                      alias:i18next.t("fontOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ]
                },
                {
                  name:"tabs-border",
                  alias:i18next.t("tabs-border"),
                  children:[
                    {
                      name: "tabs-border-size-selected",
                      alias: i18next.t("tabs-border-size"),
                      type: "number(unit=px)",
                      default: 0,
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-border-color-selected",
                      alias: i18next.t("tabs-border-color-selected"),
                      type: "color",
                      default: "#cccccc",
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-border-radius-selected",
                      alias: i18next.t("borderRadius"),
                      type: "number(unit=px)",
                      default: 1
                    },
                    {
                      name: "tabs-border-style-selected",
                      alias: i18next.t("borderStyle"),
                      type: "select(radioGroup)",
                      default: "solid",
                      selectChoices: [
                        {
                          value: "solid",
                          label: i18next.t("solid"),
                        },
                        {
                          value: "dashed",
                          label: i18next.t("dashed"),
                        },
                        {
                          value: "dotted",
                          label: i18next.t("dotted"),
                        },
                        {
                          value: "none",
                          label: i18next.t("borderNone"),
                        }
                      ]
                    },
                  ],
                  visible: (widget: Widget) => {
                    return widget.getOption("tabs-type") === "tag";
                  },
                },
                {
                  name:"tabs-select-background-type-selected",
                  alias:i18next.t("tabs-background-type"),
                  children:[
                    {
                      name: "tabs-background-color-selected",
                      alias: i18next.t("tabs-background-color-selected"),
                      type: "color",
                      default: "#4b87ff",
                    },
                    {
                      name: 'tabs-background-image-selected',
                      alias: i18next.t("tabs-background-image"),
                      type: 'file(format=image|video)',
                    },
                    {
                      name: 'tabs-background-fill-type-selected',
                      alias: i18next.t("tabs-background-fill-type"),
                      type: 'select(radioGroup)',
                      selectChoices: [
                        { value: 'stretch', label: i18next.t("stretch"), },
                        { value: 'tile', label: i18next.t("tile"), },
                        { value: "none", label: i18next.t("noneFill")}
                      ],
                      default: 'stretch',
                    },
                    {
                      name: "background-image-scale-selected",
                      alias: i18next.t("backgroundScale"),
                      type: "number(unit=%)",
                      default: 100,
                      visible: (widget) => {
                        return widget.getOption("tabs-background-fill-type-selected") === "none";
                      }
                    },
                    {
                      name: "background-image-position-selected",
                      alias: i18next.t("backgroundPositon"),
                      type: "vector<X,Y>(unit=px)",
                      default: [0, 0],
                      visible: (widget) => {
                        return widget.getOption("tabs-background-fill-type-selected") === "none";
                      }
                    },
                    {
                      name: 'tabs-background-blur-selected',
                      alias: i18next.t("tabs-background-blur"),
                      type: 'number(unit=px)',
                      default: 0,
                    },
                    {
                      name: "tabs-use-nine-patch-selected",
                      alias: i18next.t("useNinePatch"),
                      type: "boolean",
                      default: false,
                      visible: (widget:Tab) => {
                        return widget.getOption("tabs-background-fill-type-selected") === 'stretch';
                      }
                    },
                    {
                      name: "tabs-nine-patch-selected",
                      alias: i18next.t("ninePatch"),
                      type: "nine-patch",
                      default: {
                        top:0,
                        right:0,
                        left:0,
                        bottom:0
                      },
                      visible: (widget:Tab) => {
                        return  widget.getOption("tabs-background-fill-type-selected") === 'stretch' && widget.getOption("tabs-use-nine-patch-selected");
                      },
                      imageSource: (widget:Widget) => {
                      return widget.getOption("tabs-background-image-selected");
                      }
                    },
                  ]
                },
              ]
            },
            {
              name:"tabs-hover",
              alias:i18next.t("tabs-hover"),
              show:"tab",
              fold:"unfold",
              children:[
                {
                  name:"tabs-hover-show",
                  alias:i18next.t("tabs-hover-show"),
                  type:"boolean",
                  default:false,
                },
                {
                  name: "tabs-text-hover",
                  alias: i18next.t("tabs-text"),
                  visible:(widget:Widget)=>{
                    return widget.getOption("tabs-hover-show");
                  },
                  children: [
                    {
                      name: "tabs-text-display-hover",
                      alias: i18next.t("tabs-text-display"),
                      type: "boolean",
                      default: false,
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "mark";
                      },
                    },
                    {
                      name: "tabs-text-font-hover",
                      alias: i18next.t("tabs-text-font"),
                      type: "font",
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display-hover")
                        } else {
                          return false;
                        }
                      },
                      default: {
                        color: "#000",
                        family: '',
                        size: 12,
                        bold: false,
                        italic: false,
                        underline: false,
                        "line-through": false
                      },
                    },
                    {
                      name: "tabs-text-align-hover",
                      alias: i18next.t("tabs-text-align"),
                      type: "align",
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display-hover")
                        } else {
                          return false;
                        }
                      },
                      default: "center"
                    },
                    {
                      name: "tabs-vertical-align-hover",
                      alias: i18next.t("tabs-vertical-align"),
                      type: "align(vertical=true)",
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display-hover")
                        } else {
                          return false;
                        }
                      },
                      default: "center"
                    },
                    {
                      name:"tabs-text-offset-hover",
                      alias:i18next.t("textOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                      disabled: (widget: Widget) => {
                        if(widget.getOption("tabs-type") === "mark") {
                          return !widget.getOption("tabs-text-display-hover")
                        } else {
                          return false;
                        }
                      },
                    },
                  ]
                },
                {
                  name: "tabs-shadow-cluster-hover",
                  alias: i18next.t("fontShadow"),
                  visible:(widget:Widget)=>{
                    return widget.getOption("tabs-hover-show");
                  },
                  children: [
                    {
                      name: "tabs-shadow-color-hover",
                      alias: i18next.t("fontShadowColor"),
                      type: "color",
                      default: "#ffffff",
                    },
                    {
                      name: "tabs-shadow-blur-hover",
                      alias: i18next.t("fontShadowBlur"),
                      type: "number(unit=px)",
                      default: -1,
                    },
                    {
                      name:"tabs-shadow-offset-hover",
                      alias:i18next.t("fontOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ]
                },
                {
                  name:"tabs-border",
                  alias:i18next.t("tabs-border"),
                  children:[
                    {
                      name: "tabs-border-size-hover",
                      alias: i18next.t("tabs-border-size"),
                      type: "number(unit=px)",
                      default: 0,
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-border-color-hover",
                      alias: i18next.t("tabs-border-color"),
                      type: "color",
                      default: "#cccccc",
                      visible: (widget: Widget) => {
                        return widget.getOption("tabs-type") === "tag";
                      },
                    },
                    {
                      name: "tabs-border-radius-hover",
                      alias: i18next.t("borderRadius"),
                      type: "number(unit=px)",
                      default: 1
                    },
                    {
                      name: "tabs-border-style-hover",
                      alias: i18next.t("borderStyle"),
                      type: "select(radioGroup)",
                      default: "solid",
                      selectChoices: [
                        {
                          value: "solid",
                          label: i18next.t("solid"),
                        },
                        {
                          value: "dashed",
                          label: i18next.t("dashed"),
                        },
                        {
                          value: "dotted",
                          label: i18next.t("dotted"),
                        },
                        {
                          value: "none",
                          label: i18next.t("borderNone"),
                        }
                      ]
                    },
                  ],
                  visible:(widget:Widget)=>{
                    return widget.getOption("tabs-hover-show") && widget.getOption("tabs-type") === "tag";
                  }
                },
                {
                  name:"tabs-select-background-type-hover",
                  alias:i18next.t("tabs-background-type"),
                  children:[
                    {
                      name: "tabs-background-color-hover",
                      alias: i18next.t("tabs-background-color-selected"),
                      type: "color",
                      default: "#4b87ff",
                    },
                    {
                      name: 'tabs-background-image-hover',
                      alias: i18next.t("tabs-background-image"),
                      type: 'file(format=image|video)',
                    },
                    {
                      name: 'tabs-background-fill-type-hover',
                      alias: i18next.t("tabs-background-fill-type"),
                      type: 'select(radioGroup)',
                      selectChoices: [
                        { value: 'stretch', label: i18next.t("stretch"), },
                        { value: 'tile', label: i18next.t("tile"), },
                        { value: "none", label: i18next.t("noneFill")}
                      ],
                      default: 'stretch',
                    },
                    {
                      name: "background-image-scale-hover",
                      alias: i18next.t("backgroundScale"),
                      type: "number(unit=%)",
                      default: 100,
                      visible: (widget) => {
                        return widget.getOption("tabs-background-fill-type-hover") === "none";
                      }
                    },
                    {
                      name: "background-image-position-hover",
                      alias: i18next.t("backgroundPositon"),
                      type: "vector<X,Y>(unit=px)",
                      default: [0, 0],
                      visible: (widget) => {
                        return widget.getOption("tabs-background-fill-type-hover") === "none";
                      }
                    },
                    {
                      name: 'tabs-background-blur-hover',
                      alias: i18next.t("tabs-background-blur"),
                      type: 'number(unit=px)',
                      default: 0,
                    },
                    {
                      name: "tabs-use-nine-patch-hover",
                      alias: i18next.t("useNinePatch"),
                      type: "boolean",
                      default: false,
                      visible: (widget:Tab) => {
                        return widget.getOption("tabs-background-fill-type-hover") === 'stretch';
                      }
                    },
                    {
                      name: "tabs-nine-patch-hover",
                      alias: i18next.t("ninePatch"),
                      type: "nine-patch",
                      default: {
                        top:0,
                        right:0,
                        left:0,
                        bottom:0
                      },
                      visible: (widget:Tab) => {
                        return  widget.getOption("tabs-background-fill-type-hover") === 'stretch' && widget.getOption("tabs-use-nine-patch-hover");
                      },
                      imageSource: (widget:Widget) => {
                      return widget.getOption("tabs-background-image-hover");
                      }
                    },
                  ],
                  visible:(widget:Widget)=>{
                    return widget.getOption("tabs-hover-show")
                  }
                },
              ]
            }
          ]
        },
        "animation-display": {
          alias: i18next.t("animation-display"),
          visible: false,
          children: [
            {
              name: "animation-display",
              alias: i18next.t("animation-displays"),
              type: "boolean",
              default: false,
            },
            {
              name: "animation-self-wait",
              alias: i18next.t("animation-self-wait"),
              type: "boolean",
              default: false,
            },
            {
              name: "animation-wait-cluster",
              alias: i18next.t("animation-self-wait-time"),
              cluster: "array",
              items: (widget: Tab) => {
                return widget.getB2widgetSeries().map(({ alias }) => alias);
              },
              itemsHint: "选项卡",
              visible: (widget: Tab) => {
                return widget.getOption('animation-self-wait') === true;
              },
              children: [
                {
                  name: 'animation-self-wait-time',
                  alias: i18next.t("animation-self-wait-time"),
                  type: "number<float>(unit=" + i18next.t("unitMiao") + ")",
                  default: 2
                }
              ]
            },
            {
              name: "animation-type",
              alias: i18next.t("animation-type"),
              type: "select",
              default: "none",
              selectChoices: [
                { value: "none", label: i18next.t("none") },
                { value: "fade", label: i18next.t("fade") },
                { value: "horizontal-move", label: i18next.t("horizontal-move") },
                { value: "vertical-move", label: i18next.t("vertical-move") },
              ],
              visible: true,
            },
            {
              name: "animation-wait",
              alias: i18next.t("animation-wait"),
              type: "number<float>(unit=" + i18next.t("unitMiao") + ")",
              default: 4,
              visible: true
            },
            {
              name: "animation-delay",
              alias: i18next.t("animation-delay"),
              visible: true,
              type: "number<float>(unit=" + i18next.t("unitMiao") + ")",
              default: 1,
            },
            {
              name: "animation-duration",
              alias: i18next.t("animation-duration"),
              type: "number<float>(unit=" + i18next.t("unitMiao") + ")",
              default: 1,
              visible: true
            },
            {
              name: "animation-loop",
              alias: i18next.t("animation-loop"),
              default: false,
              type: "boolean",
              visible: true
            }
          ]
        },
      }
    }, ...Widget.defineOptions()]
  }

  getB2widgetSeries() {
    let choices = [];
    let b2widgets = this.container.reversedWidgets;
    if (b2widgets.length) {
      for (let i = 0; i <= b2widgets.length - 1; i++) {
        let b2widget = b2widgets[i];
        let choice: any = {};
        choice.name = i;
        choice.alias = (choice.name + 1) + "-" + b2widget.name;
        choices.push(choice);
      }
    }

    return choices;
  }

  get getAnimationSelfWaits() {
    let indexes = this.getOption("animation-wait-cluster")["indexes"];
    let result = [];
    indexes.forEach(index => {
      result.push(this.getOption(["animation-wait-cluster", index, "animation-self-wait-time"]))
    });

    return result;
  }

  getChildDeviationOffset() {
    let x = 0, y = 0;
    if (this.getOption("tabs-type") === "tag" && this.getOption("tabs")) {
      let tagHeight = Number(this.getOption("tabs-tag-height"));
      let tagWidth = Number(this.getOption("tabs-tag-width"));
      let tagPostion = this.getOption<string>("tabs-tag-position");
      let tagDirection = this.getOption("tabs-tag-direction");
      if (tagDirection === "horizontal") { // 横向
        if (tagPostion.split("_")[0] === "top") {
          y = tagHeight;
        } else if (tagPostion === "left_center") {
          x = tagWidth * this.widgetsLength;
        }
      } else {

        if (tagPostion.split("_")[0] === "left" || tagPostion.split("_")[1] === "left") {
          x = tagWidth;
        } else if (tagPostion === "top_center") {
          y = tagHeight * this.widgetsLength;
        }
      }
    }
    return { x, y };
  }

  getTabPosition(tabsPosition, typeIsTag, isHorizontal) {
    let location = null;
    let tabsPositionValue = {};
    let [offsetX, offsetY] = this.getOption<[number, number]>("tabs-tag-offset") || [0, 0];
    switch (tabsPosition) {
      case "top_left":
        tabsPositionValue = typeIsTag ? { top: offsetY + "px", left: offsetX + "px" } : { top: (10 + offsetY) + "px", left: (10 + offsetX) + "px" };
        location = isHorizontal ? "top" : "left";
        break;
      case "top_center":
        tabsPositionValue = typeIsTag ? { top: offsetY + "px", left: `calc(50% + ${offsetX}px)`, transform: 'translateX(-50%)' } : { top: (10 + offsetY) + "px", left: `calc(50% + ${offsetX}px)`, transform: 'translateX(-50%)' };
        location = "top";
        break;
      case "top_right":
        tabsPositionValue = typeIsTag ? { top: offsetY + "px", right: "0px", transform: `translateX(${offsetX}px)` } : { top: (10 + offsetY) + "px", right: (10 - offsetX) + "px" };
        location = isHorizontal ? "top" : "right";
        break;
      case "right_center":
        tabsPositionValue = typeIsTag ? { top: `calc(50% + ${offsetY}px)`, transform: `translateY(-50%) translateX(${offsetX}px)`, right: `0` } : { top: `calc(50% + ${offsetY}px)`, transform: 'translateY(-50%)', right: (10 - offsetX) + "px" };
        location = "right";
        break;
      case "bottom_right":
        tabsPositionValue = typeIsTag ? { bottom: 0, right: -offsetX + "px", transform: `translateY(${offsetY}px)`} : { bottom: (10 - offsetY) + "px", right: (10 - offsetX) + "px" };
        location = isHorizontal ? "bottom" : "right";
        break;
      case "bottom_center":
        tabsPositionValue = typeIsTag ? { bottom: offsetY + "px", left: `calc(50% + ${offsetX}px)`, transform: `translateX(-50%) translateY(${offsetY}px)` } : { bottom: (10 - offsetY) + "px", left: `calc(50% + ${offsetX}px)`, transform: 'translateX(-50%)' };
        location = "bottom";
        break;
      case "bottom_left":
        tabsPositionValue = typeIsTag ? { bottom: 0, left: -offsetX + "px", transform: `translateY(${offsetY}px)`} : { bottom: (10 - offsetY) + "px", left: (10 + offsetX) + "px" };
        location = isHorizontal ? "bottom" : "left";
        break;
      case "left_center":
        tabsPositionValue = typeIsTag ? { top: `calc(50% + ${offsetY}px)`, transform: 'translateY(-50%)', left: -offsetX + "px" } : { top: `calc(50% + ${offsetY}px)`, transform: 'translateY(-50%)', left: (10 + offsetX) + "px" };
        location = "left";
        break;
      default:
        break;
    }
    return { location: location, position: tabsPositionValue }
  }

  get tabShow() {
    return this.getOption("tabs")
  }

  get projectId(){
    return this.getBoard().projectId;
  }

  get tabPosition() {
    return this.getOption("tabs-tag-position");
  }
  get tabHeight() {
    return this.getOption("tabs-tag-height");
  }
  get tabWidth() {
    return this.getOption("tabs-tag-width");
  }

  get textDisplay() {
    if (this.getOption("tabs-type") == "tag") {
      return true;
    } else if (this.getOption("tabs-text-display") && this.getOption("tabs-type") == "mark") {
      return true;
    } else {
      return false;
    }
  }

  get widgetsLength() {
    return this.container.reversedWidgets.length
  }

  setSelectedItem(itemIndex?: number) {
    this.selectedTabIndex = itemIndex;
  }

  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }

  // 设置子组件的Inherit-Opacity
  setWidgetsInheritOpacity(index) {
    for (let key in this.container.reversedWidgets) {
      let subWidget = this.container.reversedWidgets[key];
      subWidget.setInheritOption('opacity', 0);
    }
    this.container.reversedWidgets[index]?.setInheritOption('opacity', 100);
  }

  // 设置子组件的Inherit-Position
  setWidgetsInheritPosition() {
    for (let key in this.container.reversedWidgets) {
      let subWidget = this.container.reversedWidgets[key];
      subWidget.setInheritOption('position', [0, 0]);
    }
  }

  /**
   * 子元素都是固定的
   */
  isWidgetsFixed() {
    return true;
  }

}
