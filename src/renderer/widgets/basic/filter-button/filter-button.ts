import { DefinedOptions, NinePatch } from "@renderer/b2/types";
import { Widget, FilterWidget } from "@renderer/b2/controllers/widget";
import { Color } from "@renderer/b2/color";
import { Soul } from "@common/types/project";
import { Board } from "@renderer/b2/controllers/board";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { ref , watch } from "vue";
import { TheWidget as DataFilter } from "../filter";

export class FilterButton extends Widget {
  private _isSelected = ref(false);
  private _relationshipField = "";
  private _relationshipValue = "";
  private row = {};

  static resource = resource;

  get name() {
    return this.soul.name || this.getOption("text");
  }
  set name(name: string) {
    super.name = name;
  }
  get supportAutoSize() {
    return true;
  }
  get paddingStyle() {
    const paddings = this.getOption<[number, number, number, number]>("padding");
    return {
      padding: `${paddings.map(item=>`${item}px`).join(' ')}`,
    };
  }

  get isSelected() {
    return this._isSelected.value;
  }

  set isSelected(value: boolean) {
    if (this._isSelected.value !== !!value) {
      this._isSelected.value = !!value;
      if (this._isSelected.value) {
        this.applySelectItem(this.row);
      } else {
        this.withdrawSelectItem(this.row);
      }
    }
  }

  public toggleSelect(value) {
    this.isSelected = value;
  }

  onSelectItem(rows?: object[]): boolean {
    if (!rows || !rows.length || !this._relationshipField) {//取消选中
      this.isSelected = false;
    } else {
      for (const row of rows) {
        if (row[this._relationshipField] === this._relationshipValue) {
          this.isSelected = true;
          return true;
        } else {
          this.isSelected = false;
        }
      }
    }
    return this.isSelected;
  }

  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }

  get projectId(){
    return this.getBoard().projectId;
  }

  get textValue(): string {
    return this.getOption<string>("text") !== undefined ? this.getOption<string>("text") : "";
  }

  cloneStyle(type:string) {
    this.setOption(`text-${type}-font`, this.getOption("text-default-font"));
    this.setOption(`font-${type}-spacing`,this.getOption("font-default-spacing"));
    this.setOption(`text-${type}-indent`,this.getOption("text-default-indent"));
    this.setOption(`text-${type}-position`,this.getOption("text-default-position"));
    this.setOption(`text-${type}-vertical`,this.getOption("text-default-vertical"));
    this.setOption(`text-${type}-verticals`,this.getOption("text-default-verticals"));
    this.setOption(`text-offset-${type}`,[this.getOption("text-offset-default")[0],this.getOption("text-offset-default")[1]])
    this.setOption(`text-${type}-horizontal`,this.getOption("text-default-horizontal"));
    this.setOption(`font-${type}-shadow-color`,this.getOption("font-default-shadow-color"));
    this.setOption(`font-${type}-shadow-blur`,this.getOption("font-default-shadow-blur"));
    this.setOption(`font-${type}-shadow-offset`,[this.getOption("font-default-shadow-offset")[0],this.getOption("font-default-shadow-offset")[1]]);
    this.setOption(`border-${type}-color`,this.getOption("border-default-color"));
    this.setOption(`border-${type}-width`,this.getOption("border-default-width"));
    this.setOption(`border-${type}-radius`,this.getOption("border-default-radius"));
    this.setOption(`border-${type}-style`,this.getOption("border-default-style"));
    this.setOption(`border-${type}-style`,this.getOption("border-default-style"));
    this.setOption(`background-${type}-color`,this.getOption("background-default-color"));
    this.setOption(`background-${type}-image`,this.getOption("background-default-image"));
    this.setOption(`background-${type}-fill-type`,this.getOption("background-default-fill-type"));
    this.setOption(`background-${type}-blur`,this.getOption("background-default-blur"));
    this.setOption(`use-nine-patch-${type}`,this.getOption("use-nine-patch-default"));
    const { top, right, bottom, left } = this.getOption<NinePatch>("nine-patch-default") ?? {};
    this.setOption(`nine-patch-${type}`,{"top": top || 0,"right":right || 0,"bottom":bottom || 0,"left":left || 0});
  }

  get defaultName () {
    return i18next.t("defaultName");
  }
  static defineOptions(): DefinedOptions[] {
    const UNIT_MIAO = i18next.t("unitMIAO");
    return [{
      data: {
        // relationship: {
        //   visible: true,
        //   children: [
        //     {
        //       name: "relationship-field",
        //       alias: i18next.t("relationship-field"),
        //       type: "string",
        //       default: "",
        //     },
        //     {
        //       name: "relationship-value",
        //       alias: i18next.t("relationship-value"),
        //       type: "string",
        //       default: "",
        //     }
        //   ],
        // },
        linkage: {
          children: [
            {
              name: "linkage-form-field",
              visible: false,
            },
            {
              name: "linkage-elements",
              visible(element, paths) {
                return false;
              },
            },
            {
              name: "linkage-form-filter-fields",
              alias: i18next.t('relatedFilterComp'),
              type: "check-select",
              default: [],
              selectChoices: (widget: FilterButton) => {
                return widget.filterFieldsOptions;
              },
              visible(widget: FilterButton) {
                return widget.getOption("linkage-out");
              }
            },
          ]
        }
      },
      style: {
        basic: {
          children: [
            {
              name: "grid-width",
              default: 20,
            },
            {
              name: "grid-height",
              default: 6,
            },
            {
              name: "text",
              alias: i18next.t("text"),
              type: "string",
              default: "筛选",
            },
            // {
            //   name: "text-arrangement",
            //   alias: "排列方式",
            //   type: "select(radioGroup)",
            //   default: "horizontal",
            //   selectChoices: [
            //     {
            //       value: "horizontal",
            //       label: i18next.t("horizontal"),
            //     },
            //     {
            //       value: "vertical",
            //       label: i18next.t("vertical"),
            //     },
            //   ]
            // },
            {
              name: "checked",
              alias: i18next.t("checked"),
              tip: i18next.t("checkedTip"),
              type: "boolean",
              default: false,
            },
            {
              name: "no-events",
              visible: false,
            },
          ],
        },
        font: {
          alias: i18next.t("fontStyle"),
          children: [
            {
              name: "item-default",
              alias: i18next.t("itemDefault"),
              show: "tab",
              fold: "unfold",
              children:[
                {
                  name:"item-default-fontStyle",
                  alias:i18next.t("default_fontStyle"),
                  children:[
                    {
                      name: "text-default-font",
                      alias: i18next.t("font"),
                      type: "font(gradient=true,underline=true,line-through=true)",
                      default: {
                        family: "sans-serif",
                        color: "#d5d5d6",
                        size: 14,
                        bold: false,
                        italic: false,
                        underline: false,
                        "line-through": false
                      }
                    },
                    {
                      name: "font-default-spacing",
                      alias: i18next.t("fontSpacing"),
                      default: 0,
                      type: "number(unit=px)",
                    },
                    {
                      name: "text-default-indent",
                      alias: i18next.t("fontIndent"),
                      type: "number(unit=px)",
                      default: 0,
                      visible:false
                    },
                    {
                      name: "text-default-position",
                      alias: i18next.t("fontAlign"),
                      type: "align",
                      default: "center",
                    },
                    {
                      name: "text-default-vertical",
                      alias: i18next.t("verticalAlign"),
                      type: "align(vertical)",
                      default: "center",
                    },
                    {
                      name:"text-offset-default",
                      alias:i18next.t("textOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ]
                },
                {
                  name: "shadow-default-cluster",
                  alias: i18next.t("fontShadow"),
                  children: [
                    {
                      name: "font-default-shadow-color",
                      alias: i18next.t("fontShadowColor"),
                      type: "color",
                      default: "#ffffff",
                    },
                    {
                      name: "font-default-shadow-blur",
                      alias: i18next.t("fontShadowBlur"),
                      type: "number(unit=px)",
                      default: -1,
                    },
                    {
                      name:"font-default-shadow-offset",
                      alias:i18next.t("fontOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ]
                },
                {
                  name: "border-default-cluster",
                  alias:i18next.t("borderStyle"),
                  children:[
                    {
                      name:"border-default-color",
                      alias:i18next.t("borderColor"),
                      type:"color",
                      default:"#CCCCCCFF"
                    },
                    {
                      name:"border-default-width",
                      alias:i18next.t("borderWidth"),
                      type:"number(unit=px)",
                      default:0
                    },
                    {
                      name:"border-default-radius",
                      alias:i18next.t("borderRadius"),
                      type:"number(unit=px)",
                      default:4
                    },
                    {
                      name:"border-default-style",
                      alias:i18next.t("borderStyle"),
                      type:"select(radioGroup)",
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
                  ]
                },
                {
                  name:"background-default-style",
                  alias: i18next.t("backgroundDefaultStyle"),
                  children: [
                    {
                      name: 'background-default-color',
                      alias: i18next.t("backgroundDefaultColor"),
                      type: 'color(gradient)',
                      default: "#0873ff",
                    },
                    {
                      name: 'background-default-image',
                      alias: i18next.t("backgroundDefaultImage"),
                      type: 'file(format=image)',
                    },
                    {
                      name: 'background-default-fill-type',
                      alias: i18next.t("backgroundDefaultFillType"),
                      type: 'select(radioGroup)',
                      selectChoices: [
                        { value: 'stretch', label: i18next.t("stretch") },
                        { value: 'tile', label: i18next.t("tile") },
                        { value: "none", label: i18next.t("noneFill")}
                      ],
                      default: 'stretch',
                    },
                    {
                      name: "background-image-scale-default",
                      alias: i18next.t("backgroundScale"),
                      type: "number(unit=%)",
                      default: 100,
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-default-fill-type") === "none";
                      }
                    },
                    {
                      name: "background-image-position-default",
                      alias: i18next.t("backgroundPositon"),
                      type: "vector<X,Y>(unit=px)",
                      default: [0, 0],
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-default-fill-type") === "none";
                      }
                    },
                    {
                      name: 'background-default-blur',
                      alias: i18next.t("backgroundDefaultBlur"),
                      type: 'number(unit=px)',
                      default: 0,
                    },
                    {
                      name: "use-nine-patch-default",
                      alias: i18next.t("useNinePatch"),
                      type: "boolean",
                      default: false,
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-default-fill-type") === 'stretch';
                      }
                    },
                    {
                      name: "nine-patch-default",
                      alias: i18next.t("ninePatch"),
                      type: "nine-patch",
                      visible: (widget:FilterButton) => {
                        return  widget.getOption("background-default-fill-type") === 'stretch' && widget.getOption("use-nine-patch-default");
                      },
                      imageSource: (widget:FilterButton) => {
                        return widget.getOption("background-default-image");
                      }
                    },
                  ],
                }
              ]
            },
            {
              name: "item-click",
              alias: i18next.t("itemClick"),
              show: "tab",
              fold: "unfold",
              children:[
                {
                  name: "show-click",
                  alias: i18next.t("showClick"),
                  type: "boolean",
                  default:false
                },
                {
                  name: "text-click-fontStyle",
                  alias: i18next.t("default_fontStyle"),
                  children:[
                    {
                      name: "text-click-font",
                      alias: i18next.t("font"),
                      type: "font(gradient=true,underline=true,line-through=true)",
                      default: {
                        family: "sans-serif",
                        color: "#d5d5d6",
                        size: 14,
                        bold: false,
                        italic: false,
                        underline: false,
                        "line-through": false
                      }
                    },
                    {
                      name: "font-click-spacing",
                      alias: i18next.t("fontSpacing"),
                      default: 0,
                      type: "number(unit=px)",
                    },
                    {
                      name: "text-click-indent",
                      alias: i18next.t("fontIndent"),
                      type: "number(unit=px)",
                      default: 0,
                      visible:false
                    },
                    {
                      name: "text-click-position",
                      alias: i18next.t("fontAlign"),
                      type: "align",
                      default: "center",
                    },
                    {
                      name: "text-click-vertical",
                      alias: i18next.t("verticalAlign"),
                      type: "align(vertical)",
                      default: "center",
                    },
                    {
                      name: "text-offset-click",
                      alias: i18next.t("textOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-click") === true
                  })
                },
                {
                  name: "shadow-click-cluster",
                  alias: i18next.t("fontShadow"),
                  children: [
                    {
                      name: "font-click-shadow-color",
                      alias: i18next.t("fontShadowColor"),
                      type: "color",
                      default: "#ffffff",
                    },
                    {
                      name: "font-click-shadow-blur",
                      alias: i18next.t("fontShadowBlur"),
                      type: "number(unit=px)",
                      default: -1,
                    },
                    {
                      name: "font-click-shadow-offset",
                      alias: i18next.t("fontOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-click") === true
                  })
                },
                {
                  name: "border-click-cluster",
                  alias: i18next.t("borderStyle"),
                  children:[
                    {
                      name:"border-click-color",
                      alias: i18next.t("borderColor"),
                      type:"color",
                      default:"#CCCCCCFF"
                    },
                    {
                      name:"border-click-width",
                      alias: i18next.t("borderWidth"),
                      type:"number(unit=px)",
                      default:1
                    },
                    {
                      name:"border-click-radius",
                      alias: i18next.t("borderRadius"),
                      type:"number(unit=px)",
                      default:4
                    },
                    {
                      name:"border-click-style",
                      alias: i18next.t("borderStyle"),
                      type:"select(radioGroup)",
                      default: "solid",
                      selectChoices: [
                        {
                          value: "solid",
                          label: i18next.t("solid"),
                        },
                        {
                          value: "dashed",
                          label:  i18next.t("dashed"),
                        },
                        {
                          value: "dotted",
                          label:  i18next.t("dotted"),
                        },
                        {
                          value: "none",
                          label:  i18next.t("borderNone"),
                        }
                      ]
                    }
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-click") === true
                  })
                },
                {
                  name:"background-click-style",
                  alias: i18next.t("backgroundDefaultStyle"),
                  children: [
                    {
                      name: 'background-click-color',
                      alias: i18next.t("backgroundDefaultColor"),
                      type: 'color(gradient)',
                      default: "#FFFFFF00",
                    },
                    {
                      name: 'background-click-image',
                      alias: i18next.t("backgroundDefaultImage"),
                      type: 'file(format=image)',
                    },
                    {
                      name: 'background-click-fill-type',
                      alias: i18next.t("backgroundDefaultFillType"),
                      type: 'select(radioGroup)',
                      selectChoices: [
                        { value: 'stretch', label: i18next.t("stretch") },
                        { value: 'tile', label: i18next.t("tile") },
                        { value: "none", label: i18next.t("noneFill")}
                      ],
                      default: 'stretch',
                    },
                    {
                      name: "background-image-scale-click",
                      alias: i18next.t("backgroundScale"),
                      type: "number(unit=%)",
                      default: 100,
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-click-fill-type") === "none";
                      }
                    },
                    {
                      name: "background-image-position-click",
                      alias: i18next.t("backgroundPositon"),
                      type: "vector<X,Y>(unit=px)",
                      default: [0, 0],
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-click-fill-type") === "none";
                      }
                    },
                    {
                      name: 'background-click-blur',
                      alias: i18next.t("backgroundDefaultBlur"),
                      type: 'number(unit=px)',
                      default: 0,
                    },
                    {
                      name: "use-nine-patch-click",
                      alias: i18next.t("useNinePatch"),
                      type: "boolean",
                      default: false,
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-click-fill-type") === 'stretch';
                      }
                    },
                    {
                      name: "nine-patch-click",
                      alias: i18next.t("ninePatch"),
                      type: "nine-patch",
                      visible: (widget:FilterButton) => {
                        return  widget.getOption("background-click-fill-type") === 'stretch' && widget.getOption("use-nine-patch-click");
                      },
                      imageSource: (widget:FilterButton) => {
                        return widget.getOption("background-click-image");
                      }
                    },
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-click") === true
                  })
                },
                {
                  name: "animation-click-cluster",
                  alias: i18next.t("animationCluster"),
                  children: [
                    {
                      name: "animation-click-show",
                      alias: i18next.t("animationShow"),
                      type: "boolean",
                      default: false,
                    },
                    {
                      name: "animation-click-type",
                      alias: i18next.t("animationDisplayType"),
                      type: "select",
                      selectChoices:[
                        {
                          label:i18next.t("ripple"),
                          value: "ripple"
                        },
                      ],
                      default: "ripple",
                    },
                    {
                      name: "animation-click-time",
                      alias: i18next.t("animationTime"),
                      type: "number<float>(unit=" + UNIT_MIAO + ")",
                      default: 0.35,
                    }
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-click") === true
                  })
                },
              ]
            },
            {
              name: "item-hover",
              alias: i18next.t("itemHover"),
              show: "tab",
              fold: "unfold",
              children:[
                {
                  name: "show-hover",
                  alias: i18next.t("showHover"),
                  type: "boolean",
                  default: false
                },
                {
                  name: "text-hover-fontStyle",
                  alias: i18next.t("default_fontStyle"),
                  children:[
                    {
                      name: "text-hover-font",
                      alias: i18next.t("font"),
                      type: "font(gradient=true,underline=true,line-through=true)",
                      default: {
                        family: "sans-serif",
                        color: "#d5d5d6",
                        size: 14,
                        bold: false,
                        italic: false,
                        underline: false,
                        "line-through": false
                      }
                    },
                    {
                      name: "font-hover-spacing",
                      alias: i18next.t("fontSpacing"),
                      default: 0,
                      type: "number(unit=px)",
                    },
                    {
                      name: "text-hover-indent",
                      alias: i18next.t("fontIndent"),
                      type: "number(unit=px)",
                      default: 0,
                      visible:false
                    },
                    {
                      name: "text-hover-position",
                      alias: i18next.t("fontAlign"),
                      type: "align",
                      default: "center",
                    },
                    {
                      name: "text-hover-vertical",
                      alias: i18next.t("verticalAlign"),
                      type: "align(vertical)",
                      default: "center",
                    },
                    {
                      name:"text-offset-hover",
                      alias: i18next.t("textOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-hover") === true
                  })
                },
                {
                  name: "shadow-hover-cluster",
                  alias: i18next.t("fontShadow"),
                  children: [
                    {
                      name: "font-hover-shadow-color",
                      alias: i18next.t("fontShadowColor"),
                      type: "color",
                      default: "#ffffff",
                    },
                    {
                      name: "font-hover-shadow-blur",
                      alias: i18next.t("fontShadowBlur"),
                      type: "number(unit=px)",
                      default: -1,
                    },
                    {
                      name: "font-hover-shadow-offset",
                      alias: i18next.t("fontOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-hover") === true
                  })
                },
                {
                  name: "border-hover-cluster",
                  alias:i18next.t("borderStyle"),
                  children:[
                    {
                      name:"border-hover-color",
                      alias:i18next.t("borderColor"),
                      type:"color",
                      default:"#CCCCCCFF"
                    },
                    {
                      name:"border-hover-width",
                      alias:i18next.t("borderWidth"),
                      type:"number(unit=px)",
                      default:1
                    },
                    {
                      name:"border-hover-radius",
                      alias:i18next.t("borderRadius"),
                      type:"number(unit=px)",
                      default:4
                    },
                    {
                      name:"border-hover-style",
                      alias:i18next.t("borderStyle"),
                      type:"select(radioGroup)",
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
                    }
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-hover") === true
                  })
                },
                {
                  name:"background-hover-style",
                  alias: i18next.t("backgroundDefaultStyle"),
                  children: [
                    {
                      name: 'background-hover-color',
                      alias: i18next.t("backgroundDefaultColor"),
                      type: 'color(gradient)',
                      default: "#FFFFFF00",
                    },
                    {
                      name: 'background-hover-image',
                      alias: i18next.t("backgroundDefaultImage"),
                      type: 'file(format=image)',
                    },
                    {
                      name: 'background-hover-fill-type',
                      alias: i18next.t("backgroundDefaultFillType"),
                      type: 'select(radioGroup)',
                      selectChoices: [
                        { value: 'stretch', label: i18next.t("stretch") },
                        { value: 'tile', label: i18next.t("tile") },
                        { value: "none", label: i18next.t("noneFill")}
                      ],
                      default: 'stretch',
                    },
                    {
                      name: "background-image-scale-hover",
                      alias: i18next.t("backgroundScale"),
                      type: "number(unit=%)",
                      default: 100,
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-hover-fill-type") === "none";
                      }
                    },
                    {
                      name: "background-image-position-hover",
                      alias: i18next.t("backgroundPositon"),
                      type: "vector<X,Y>(unit=px)",
                      default: [0, 0],
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-hover-fill-type") === "none";
                      }
                    },
                    {
                      name: 'background-hover-blur',
                      alias: i18next.t("backgroundDefaultBlur"),
                      type: 'number(unit=px)',
                      default: 0,
                    },
                    {
                      name: "use-nine-patch-hover",
                      alias: i18next.t("useNinePatch"),
                      type: "boolean",
                      default: false,
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-hover-fill-type") === 'stretch';
                      }
                    },
                    {
                      name: "nine-patch-hover",
                      alias: i18next.t("ninePatch"),
                      type: "nine-patch",
                      visible: (widget:FilterButton) => {
                        return  widget.getOption("background-hover-fill-type") === 'stretch' && widget.getOption("use-nine-patch-hover");
                      },
                      imageSource: (widget:FilterButton) => {
                        return widget.getOption("background-hover-image");
                      }
                    },

                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-hover") === true
                  })
                },
                {
                  name: "animation-hover-cluster",
                  alias: i18next.t("animationCluster"),
                  children: [
                    {
                      name: "animation-hover-show",
                      alias: i18next.t("animationShow"),
                      type: "boolean",
                      default: false,
                    },
                    {
                      name: "animation-hover-type",
                      alias: i18next.t("animationDisplayType"),
                      type: "select",
                      selectChoices:[
                        {
                          label: i18next.t("ripple"),
                          value: "ripple"
                        },
                      ],
                      default: "ripple",
                    },
                    {
                      name: "animation-hover-time",
                      alias: i18next.t("animationTime"),
                      type: "number<float>(unit=" + UNIT_MIAO + ")",
                      default: 0.35,
                    }
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-hover") === true
                  })
                },
              ]
            },
            {
              name: "item-select",
              alias: i18next.t("itemSelect"),
              show: "tab",
              fold: "unfold",
              children:[
                {
                  name: "show-select",
                  alias: i18next.t("showSelect"),
                  type: "boolean",
                  default: false
                },
                {
                  name: "text-select-fontStyle",
                  alias: i18next.t("default_fontStyle"),
                  children:[
                    {
                      name: "text-select-font",
                      alias: i18next.t("font"),
                      type: "font(gradient=true,underline=true,line-through=true)",
                      default: {
                        family: "sans-serif",
                        color: "#d5d5d6",
                        size: 14,
                        bold: false,
                        italic: false,
                        underline: false,
                        "line-through": false
                      }
                    },
                    {
                      name: "font-select-spacing",
                      alias: i18next.t("fontSpacing"),
                      default: 0,
                      type: "number(unit=px)",
                    },
                    {
                      name: "text-select-indent",
                      alias: i18next.t("fontIndent"),
                      type: "number(unit=px)",
                      default: 0,
                      visible:false
                    },
                    {
                      name: "text-select-position",
                      alias: i18next.t("fontAlign"),
                      type: "align",
                      default: "center",
                    },
                    {
                      name: "text-select-vertical",
                      alias: i18next.t("verticalAlign"),
                      type: "align(vertical)",
                      default: "center",
                    },
                    {
                      name: "text-offset-select",
                      alias: i18next.t("textOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-select") === true
                  })
                },
                {
                  name: "shadow-select-cluster",
                  alias: i18next.t("fontShadow"),
                  children: [
                    {
                      name: "font-select-shadow-color",
                      alias: i18next.t("fontShadowColor"),
                      type: "color",
                      default: "#ffffff",
                    },
                    {
                      name: "font-select-shadow-blur",
                      alias: i18next.t("fontShadowBlur"),
                      type: "number(unit=px)",
                      default: -1,
                    },
                    {
                      name: "font-select-shadow-offset",
                      alias: i18next.t("fontOffset"),
                      type: "vector<X, Y>(unit=px)",
                      default: [0, 0],
                    },
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-select") === true
                  })
                },
                {
                  name: "border-select-cluster",
                  alias: i18next.t("borderStyle"),
                  children:[
                    {
                      name:"border-select-color",
                      alias: i18next.t("borderColor"),
                      type:"color",
                      default:"#CCCCCCFF"
                    },
                    {
                      name:"border-select-width",
                      alias: i18next.t("borderWidth"),
                      type:"number(unit=px)",
                      default:1
                    },
                    {
                      name:"border-select-radius",
                      alias: i18next.t("borderRadius"),
                      type:"number(unit=px)",
                      default:4
                    },
                    {
                      name:"border-select-style",
                      alias: i18next.t("borderStyle"),
                      type:"select(radioGroup)",
                      default: "solid",
                      selectChoices: [
                        {
                          value: "solid",
                          label: i18next.t("solid"),
                        },
                        {
                          value: "dashed",
                          label:  i18next.t("dashed"),
                        },
                        {
                          value: "dotted",
                          label:  i18next.t("dotted"),
                        },
                        {
                          value: "none",
                          label:  i18next.t("borderNone"),
                        }
                      ]
                    }
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-select") === true
                  })
                },
                {
                  name:"background-select-style",
                  alias: i18next.t("backgroundDefaultStyle"),
                  children: [
                    {
                      name: 'background-select-color',
                      alias: i18next.t("backgroundDefaultColor"),
                      type: 'color(gradient)',
                      default: "#FFFFFF00",
                    },
                    {
                      name: 'background-select-image',
                      alias: i18next.t("backgroundDefaultImage"),
                      type: 'file(format=image)',
                    },
                    {
                      name: 'background-select-fill-type',
                      alias: i18next.t("backgroundDefaultFillType"),
                      type: 'select(radioGroup)',
                      selectChoices: [
                        { value: 'stretch', label: i18next.t("stretch") },
                        { value: 'tile', label: i18next.t("tile") },
                        { value: "none", label: i18next.t("noneFill")}
                      ],
                      default: 'stretch',
                    },
                    {
                      name: "background-image-scale-select",
                      alias: i18next.t("backgroundScale"),
                      type: "number(unit=%)",
                      default: 100,
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-select-fill-type") === "none";
                      }
                    },
                    {
                      name: "background-image-position-select",
                      alias: i18next.t("backgroundPositon"),
                      type: "vector<X,Y>(unit=px)",
                      default: [0, 0],
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-select-fill-type") === "none";
                      }
                    },
                    {
                      name: 'background-select-blur',
                      alias: i18next.t("backgroundDefaultBlur"),
                      type: 'number(unit=px)',
                      default: 0,
                    },
                    {
                      name: "use-nine-patch-select",
                      alias: i18next.t("useNinePatch"),
                      type: "boolean",
                      default: false,
                      visible: (widget:FilterButton) => {
                        return widget.getOption("background-select-fill-type") === 'stretch';
                      }
                    },
                    {
                      name: "nine-patch-select",
                      alias: i18next.t("ninePatch"),
                      type: "nine-patch",
                      visible: (widget:FilterButton) => {
                        return  widget.getOption("background-select-fill-type") === 'stretch' && widget.getOption("use-nine-patch-select");
                      },
                      imageSource: (widget:FilterButton) => {
                        return widget.getOption("background-select-image");
                      }
                    },
                  ],
                  visible:((widget:FilterButton)=>{
                    return widget.getOption("show-select") === true
                  })
                },
              ]
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
              default: "筛选按钮",
            },
            {
              name: "widget-font",
              alias: i18next.t('font'),
              type: "font(underline, line-through, noSize)",
              default: {
                family: 'sans-serif',
                size: 14,
                color: "#111111",
                bold: false,
                italic: false,
                underline: false,
                "line-through": false
              },
            },
          ]
        },
        // "background-default-setting": {
        //   alias: '背景设置',
        //   children: [
        //     {
        //       name: 'background-default-setting-color',
        //       alias: '背景颜色',
        //       type: 'color(gradient)',
        //       default: "#0089ff",
        //     }
        //   ],
        // },
        // border:{
        //   visible:false
        // },
        // background:{
        //   visible:false
        // }
        //动画没添加
        // "animation-display": {
        //   alias: i18next.t("animationDisplaySetting"),
        //   visible: true,
        //   children: [
        //     {
        //       name: "animation-display",
        //       alias: i18next.t("animationDisplay"),
        //       type: "boolean",
        //       default: false,
        //     },
        //     {
        //       name: "animation-type",
        //       alias: i18next.t("animationDisplayType"),
        //       type: "select(radioGroup)",
        //       default: "scroll",
        //       selectChoices: [
        //         {
        //           value: "scroll",
        //           label: i18next.t("animationDisplayTypeScroll"),
        //         },
        //         {
        //           value: "blink",
        //           label: i18next.t("animationDisplayTypeBlink"),
        //         }
        //       ],
        //     },
        //     {
        //       name: "animation-easing",
        //       alias: i18next.t("animationEasing"),
        //       type: "select",
        //       selectChoices: [
        //         {
        //           label: i18next.t("none"),
        //           value: "none",
        //         },
        //         {
        //           label: i18next.t("Power1.easeIn"),
        //           value: "Power1.easeIn",
        //         },
        //         {
        //           label: i18next.t("Power1.easeOut"),
        //           value: "Power1.easeOut",
        //         },
        //         {
        //           label: i18next.t("Power1.easeInOut"),
        //           value: "Power1.easeInOut",
        //         },
        //         {
        //           label: i18next.t("Back.easeIn"),
        //           value: "Back.easeIn",
        //         },
        //         {
        //           label: i18next.t("Back.easeOut"),
        //           value: "Back.easeOut",
        //         },
        //         {
        //           label: i18next.t("Back.easeInOut"),
        //           value: "Back.easeInOut",
        //         },
        //         {
        //           label: i18next.t("SlowMo.easeIn"),
        //           value: "SlowMo.easeIn",
        //         },
        //         {
        //           label: i18next.t("SlowMo.easeOut"),
        //           value: "SlowMo.easeOut",
        //         },
        //         {
        //           label: i18next.t("SlowMo.easeInOut"),
        //           value: "SlowMo.easeInOut",
        //         },
        //       ],
        //       default: "none",
        //     },
        //     {
        //       name: "animation-delay",
        //       alias: i18next.t("animationDelay"),
        //       visible: true,
        //       type: "number<float>(step=0.1, unit=" + UNIT_MIAO + ")",
        //       default: 1,
        //     },
        //     {
        //       name: "animation-duration",
        //       alias: i18next.t("animationDuration"),
        //       type: "number<float>(step=0.1, unit=" + UNIT_MIAO + ")",
        //       default: 1,
        //       visible: true
        //     },
        //     {
        //       name: "animation-loop",
        //       alias: i18next.t("animationLoop"),
        //       default: false,
        //       type: "boolean",
        //       visible: true,
        //     },
        //     {
        //       name: "animation-interval",
        //       alias: i18next.t("animationInterval"),
        //       default: 0,
        //       type: "number<float>(step=0.1, unit=" + UNIT_MIAO + ")",
        //       visible: (widget: Widget) => {
        //         return widget.getOption("animation-loop")
        //       },
        //     }
        //   ]
        // },
      },
    }, ...super.defineOptions()];
  }

  initAfterConstructor() {
    super.initAfterConstructor();
    this.initWatch();
  }

  private initWatch() {
    this.effectScope.run(() => {
      watch(() => [this.getBoard().isProjectReady, this.isSelected], (value, oldValue) => {
        if (value[0]) {
          if (value[1]) {
            for (const widgetId of this.linkageFormFilterFields) {
              const widget = this.getBoard().getWidgetByUID(widgetId) as FilterWidget;
              let selectOptionRule = null;
              if (["widget.basic.filter", "widget.basic.filter-input"].includes(widget.type)) {
                selectOptionRule = {
                  value: (widget as DataFilter).selectedItem,
                  func: (widget as DataFilter).relationshipFilterFunc,
                  linkageFields: (widget as DataFilter).relationshipField.linkageFields
                }
              } else {
                const selectedOption = (widget as any).menuItemOption.options.find(item => item.key === (widget as any).selectedItemKey);
                selectOptionRule = (widget as any).linkageSetting?.[selectedOption?.key];
              }

              widget.applyFilter(selectOptionRule)
            }
          } else {
            for (const widgetId of this.linkageFormFilterFields) {
              const widget = this.getBoard().getWidgetByUID(widgetId) as FilterWidget;
              widget.withdrawFilter();
            }
          }
        }
      }, {immediate: true})
    })
  }

  constructor(soul: Soul, parent: Widget | Board) {
    super(soul, parent);
    this.effectScope.run(()=>{
      watch(()=>{
        return [
          this.getOption<string>("relationship-field"),
          this.getOption<string>("relationship-value"),
        ];
      }, (values)=>{
        this._relationshipField = values[0];
        this._relationshipValue = values[1];
        const row = {};
        if (this._relationshipField) {
          row[this._relationshipField] = this._relationshipValue;
        }
        this.row = row;
      }, {immediate: true});
    });
  }

  get currentValue(){
    return {
      value: this.textValue
    }
  }

  getPrivateFieldAlias() {
    return this.getOption("relationship-field") ? [this.getOption("relationship-field")] : [];
  }

  get filterFieldsOptions() {
    const allFilterWidgets = this.getFilterWidgets();
    return allFilterWidgets.map(item => {
      return {
        label: item.widgetTitle,
        value: item.uid,
      }
    })
  }

  get linkageFormFilterFields(): string[] {
    return this.getOption<string[]>("linkage-form-filter-fields");
  }
}

