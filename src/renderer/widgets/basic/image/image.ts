import { DefinedOptions, OptionFileValue, WidgetMetaData, OptionFieldValue } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { Soul } from "@common/types/project";
import { Board } from "@renderer/b2/controllers/board";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { ref, watch } from "vue";
import { merge } from "merge";
export class Image extends Widget {
  public imageComponent: HTMLImageElement;
  public firstLoad = true;
  public row = {};
  private _relationshipField = "";
  private _relationshipValue = "";
  private _isSelected = ref(false);
  static resource = resource;

  initAfterConstructor() {
    super.initAfterConstructor();
    this.watchImageSource();
  }

  watchImageSource() {
    this.effectScope.run(()=>{
      watch(()=>{
        const imageDim = this.imageFields?.[0];
        const dimUid = imageDim?.uid;
        if (!dimUid) return [];
        const columns = this.getData().getflatColumns([dimUid])?.[0]?.flat?.() || [];
        const imageSuffix = ["bmp", "jpg", "jpeg", "png", "tif", "gif", "pcx", "tga", "exif", "fpx", "svg", "psd", "cdr", "pcd", "dxf", "ufo", "eps", "ai", "raw", "WMF", "webp", "avif", "apng"];
        const image = columns.find(file => imageSuffix.some(suffix => file.name.endsWith(suffix)));
        return image?.url;
      }, (value)=>{
        this.imageData = value;
      })
    })
  }

  private _imageData = ref(null);

  get imageData() {
    return this._imageData.value;
  }

  set imageData(value) {
    this._imageData.value = value;
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

  public toggleSelect() {
    this.isSelected = !this.isSelected;
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

  private firstPaint = true;
  get imageSrc() {
    if(!this.status.isVisible && this.firstPaint) return "";
    this.firstPaint = false;

    if (this.imageData) return this.imageData;

    const imageOptions = this.isSelected && this.getOption("show-selected") ? this.getOption<OptionFileValue>('image-selected') : this.getOption<OptionFileValue>('image');
    let src;
    if(typeof imageOptions === "string"){
      src = imageOptions;
    }else{
      src = imageOptions.url || this.handleImageSrc(imageOptions.relativePath);
    }

    return src;
  }
  get defaultName () {
    return i18next.t("defaultName");
  }
  get imageSelectedSrc(){
    const imageOptions = this.getOption<OptionFileValue>('image-selected');
    let src;
    if(typeof imageOptions === "string"){
      src = imageOptions;
    }else{
      src = imageOptions.url || this.handleImageSrc(imageOptions.relativePath);
    }

    return src;
  }

  get fillStyle() {
    return this.isSelected ? this.getOption("fill-style-selected") : this.getOption('fill-style');
  }

  get imageOpacity() {
    return this.getOption('opacity')
  }

  get imageStyle() {
    if (!this.imageComponent) {
      return {}
    }
    if (this.fillStyle === 'center') {
      const imgWidth = this.imageComponent.naturalWidth;
      const imgHeight = this.imageComponent.naturalHeight;
      const widgetWidth = super.contentSize.width;
      const widgetHeight = super.contentSize.height;
      const imgRatio = imgWidth / imgHeight;
      const widgetRatio = widgetWidth / widgetHeight;

      if (imgRatio > widgetRatio) {
        const actualImgWidth = widgetWidth;
        const actualImgHeight = actualImgWidth / imgRatio;
        const padding = (widgetHeight - actualImgHeight) / 2;
        return { 'padding': `${padding}px 0` };
      } else {
        const actualImgHeight = widgetHeight;
        const actualImgWidth = actualImgHeight * imgRatio;
        const padding = (widgetWidth - actualImgWidth) / 2;
        return { 'padding': `0 ${padding}px` };
      }
    } else if (this.fillStyle === 'stretch') {
      return { 'padding': '0' };
    }
    return {};
  }

  // 获取默认配置项
  static defineOptions(): DefinedOptions[] {
    const UNIT_MIAO = i18next.t("unitMiao");
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
        fields: {
          alias: i18next.t('fieldSetting'),
          fold: "unfold",
          children: [
            {
              name: "image-fields",
              alias: i18next.t('imageField'),
              type: "field(max=1)"
            },
          ],
        },
      },
      style: {
        basic: {
          children: [
            {
              name: "image-allow-zoom",
              alias: i18next.t("allowZoom"),
              type: "boolean",
              default: false,
            },
            {
              name: "image-original-size",
              alias: i18next.t("imageOriginalSize"),
              tip: i18next.t("imageOriginalSizeTip"),
              type: "boolean",
              default: false,
            }
          ]
        },
        image: {
          alias: i18next.t("imageSetting"),
          children: [
            {
              name: "item-default",
              alias: i18next.t("item-default"),
              show: "tab",
              children: [
                {
                  name: "image-reset-size",
                  type: "hidden",
                  default: false,
                },
                {
                  name: "image",
                  type: "file(format=image)",
                  alias: i18next.t("imageUrl"),
                  default: '',
                },
                {
                  name: "fill-style",
                  default: "stretch",
                  alias: i18next.t("fillStyle"),
                  selectChoices: [
                    {
                      value: "stretch",
                      label: i18next.t("imageUrlStretch")
                    },
                    {
                      value: "center",
                      label: i18next.t("imageUrlCenter")
                    }
                  ],
                  type: "select(radioGroup)"
                },
                {
                  name: "outline-follow-image-size",
                  alias: i18next.t("outlineFollowImageSize"),
                  default: false,
                  type: "boolean",
                  visible: (widget: Widget) => {
                    return widget.getOption("fill-style") === "center";
                  }
                },
              ]
            },
            {
              name: "item-selected",
              alias: i18next.t("select"),
              show: "tab",
              children:[
                {
                  name: "show-selected",
                  alias: i18next.t("showSelect"),
                  type: "boolean",
                  default: false
                },
                {
                  name: "image-selected",
                  type: "file(format=image)",
                  alias: i18next.t("imageUrl"),
                  default: '',
                  visible:((widget:Image)=>{
                    return widget.getOption("show-selected") === true
                  })
                },
                {
                  name: "fill-style-selected",
                  default: "stretch",
                  alias: i18next.t("fillStyle"),
                  selectChoices: [
                    {
                      value: "stretch",
                      label: i18next.t("imageUrlStretch")
                    },
                    {
                      value: "center",
                      label: i18next.t("imageUrlCenter")
                    }
                  ],
                  type: "select(radioGroup)",
                  visible:((widget:Image)=>{
                    return widget.getOption("show-selected") === true
                  })
                },
                {
                  name: "outline-follow-image-size-select",
                  alias: i18next.t("outlineFollowImageSize"),
                  default: false,
                  type: "boolean",
                  visible: (widget: Widget) => {
                    return widget.getOption("fill-style-selected") === "center";
                  }
                },
              ]
            }

          ]
        },
        anaphase: {
          alias: i18next.t("anaphase"),
          children: [
            {
              name: "contrast",
              alias: i18next.t("contrast"),
              type: "number(min=0, max=5, step=0.05, showInput, exceedMaxLimit)",
              default: 1,
            },
            {
              name: "saturate",
              alias: i18next.t("saturate"),
              type: "number(min=0, max=100, step=0.05, showInput, exceedMaxLimit)",
              default: 1,
            },
            {
              name: "hue",
              alias: i18next.t("hue"),
              tip: i18next.t("hueTip"),
              type: "number(min=0, max=360, step=1, showInput, exceedMaxLimit)",
              default: 0,
            },
            {
              name: "brightness",
              alias: i18next.t("brightness"),
              type: "number(min=0, max=100, step=0.05, showInput, exceedMaxLimit)",
              default: 1,
            }
          ]
        },
        "animation-display": {
          alias: i18next.t("animationDisplayGroup"),
          visible: false,
          children: [
            {
              name: "animation-display",
              alias: i18next.t("animationDisplay"),
              type: "boolean",
              default: false,
            },
            {
              name: "animation-type",
              alias: i18next.t("animationType"),
              type: "select(radioGroup)",
              default: "clockwise",
              selectChoices: [
                {
                  value: "clockwise",
                  label: i18next.t("animationTypeClockwise")
                },
                {
                  value: "anti-clockwise",
                  label: i18next.t("animationTypeAntiClockwise")
                },
                {
                  value: "blink",
                  label: i18next.t("animationTypeBlink")
                }
              ],
              visible: true,
            },
            {
              name: "animation-easing",
              alias: i18next.t("animationEasing"),
              type: "select",
              selectChoices: [
                {
                  label: i18next.t("easingNone"),
                  value: "none",
                },
                {
                  label: i18next.t("easingEaseIn"),
                  value: "Power1.easeIn",
                },
                {
                  label: i18next.t("easingEaseOut"),
                  value: "Power1.easeOut",
                },
                {
                  label: i18next.t("easingEaseInOut"),
                  value: "Power1.easeInOut",
                },
                {
                  label: i18next.t("easingBackEaseIn"),
                  value: "Back.easeIn",
                },
                {
                  label: i18next.t("easingBackEaseOut"),
                  value: "Back.easeOut",
                },
                {
                  label: i18next.t("easingBackEaseInOut"),
                  value: "Back.easeInOut",
                },
                {
                  label: i18next.t("easingSlowMoEaseIn"),
                  value: "SlowMo.easeIn",
                },
                {
                  label: i18next.t("easingSlowMoEaseOut"),
                  value: "SlowMo.easeOut",
                },
                {
                  label: i18next.t("easingSlowMoEaseInOut"),
                  value: "SlowMo.easeInOut",
                },
              ],
              default: "none",
            },
            {
              name: "animation-delay",
              alias: i18next.t("animationDelay"),
              visible: true,
              type: "number<float>(step=0.1,unit=" + UNIT_MIAO + ")",
              default: 1,
            },
            {
              name: "animation-duration",
              alias: i18next.t("animationDuration"),
              type: "number<float>(step=0.5, min=0, max=5, showInput, exceedMaxLimit,unit=" + UNIT_MIAO + ")",
              default: 1,
              visible: true
            },
            {
              name: "animation-loop",
              alias: i18next.t("animationLoop"),
              default: false,
              type: "boolean",
              visible: true,
            },
            {
              name: "animation-interval",
              alias: i18next.t("animationInterval"),
              default: 0,
              type: "number<float>(step=0.1,unit=" + UNIT_MIAO + ")",
              visible: (widget: Widget) => {
                return widget.getOption("animation-loop")
              },
            },
          ]
        },
      }
    }, ...super.defineOptions()];
  }

  handleImageSrc(relativePath) {
    const projectId = this.getBoard().projectId;
    return relativePath ? `${projectId}/${relativePath}` : "";
  }

  // 绑定图片元素
  bindImageItem(el: HTMLImageElement) {
    this.imageComponent = el
  }

  get currentValue(){
    return {
      value: this.imageSrc
    }
  }

  getPrivateFiledAlias() {
    return this.getOption("relationship-field") ? [this.getOption("relationship-field")] : [];
  }

  get imageFields() {
    return this.getOption<OptionFieldValue[]>("image-fields") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.imageFields
      ]
    } as WidgetMetaData);
  }
}
