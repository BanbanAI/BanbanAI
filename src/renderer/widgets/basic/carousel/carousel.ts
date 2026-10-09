import { DefinedOptions, OptionFileValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { ref, Ref } from "vue";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge } from "merge";

export class Carousel extends Widget {
  public showIndex: Ref<number> = ref(0);
  static resource = resource;

  get defaultName() {
    return i18next.t("defaultName");
  }

  static defineOptions(): DefinedOptions[] {
    const UNIT_MIAO = i18next.t("unitMiao");

    return [{
      data: {
        fields: {
          alias: i18next.t('fieldSetting'),
          fold: "unfold",
          children: [
            {
              name: "images-fields",
              alias: i18next.t('imageField'),
              type: "field(max=1)"
            },
          ],
        },
      },
      style: {
        carousel: {
          alias: i18next.t("carousel"),
          children: [
            {
              name: "carousel-image",
              alias: i18next.t("carouselImage"),
              type: "file(format=image,multiple)",
            },
            {
              name: "fill-style",
              default: "stretch",
              alias: i18next.t("fillStyle"),
              selectChoices: [
                {
                  value: "stretch",
                  label: i18next.t("stretch")
                },
                {
                  value: "center",
                  label: i18next.t("center")
                },
                {
                  value: "tile",
                  label: i18next.t("tile")
                }
              ],
              type: "select(radioGroup)"
            },
            {
              name: "carousel-style",
              alias: i18next.t("carouselStyle"),
              type: "select(radioGroup)",
              default: 'none',
              selectChoices: [
                {
                  value: "none",
                  label: i18next.t("none")
                },
                {
                  value: "card",
                  label: i18next.t("card")
                }
              ]
            },
            {
              name: "carousel-direction",
              alias: i18next.t("carouselDirection"),
              type: "select(radioGroup)",
              default: 'horizontal',
              selectChoices: [
                {
                  value: "horizontal",
                  label: i18next.t("horizontal")
                },
                {
                  value: "vertical",
                  label: i18next.t("vertical")
                }
              ]
            },
            {
              name: "carousel-side-opacity",
              alias: i18next.t("carouselSideOpacity"),
              type: "number(unit=%)",
              default: 100,
              visible: (widget: Carousel) => {
                return widget.getOption("carousel-style") == "card"
              }
            },
            {
              name: "carousel-index",
              type: "string",
              visible: false
            },
          ]
        },
        "carousel-indicator": {
          alias: i18next.t("carouselIndicator"),
          type: "boolean",
          default: true,
          children: [
            {
              name: "carousel-indicator-position",
              alias: i18next.t("carouselIndicatorPosition"),
              type: "select(radioGroup)",
              default: "",
              selectChoices: [
                {
                  value: "",
                  label: i18next.t("inside")
                },
                {
                  value: "outside",
                  label: i18next.t("outside")
                }
              ],
            },
            {
              name: "carousel-indicator-size",
              alias: i18next.t("carouselIndicatorSize"),
              type: "vector<W,H>",
              default: [30, 10],
            },
            {
              name: "carousel-indicator-color",
              alias: i18next.t("carouselIndicatorColor"),
              type: "color",
              default: "",
            },
            {
              name: "carousel-indicator-border-radius",
              alias: i18next.t("carouselIndicatorBorderRadius"),
              type: "number(unit=px)",
              default: 0,
            },
            {
              name: "carousel-arrow-type",
              alias: i18next.t("carouselArrowType"),
              type: "select(radioGroup)",
              default: "never",
              selectChoices: [
                {
                  value: "always",
                  label: i18next.t("arrowAlways")
                },
                {
                  value: "hover",
                  label: i18next.t("arrowHover")
                },
                {
                  value: "never",
                  label: i18next.t("arrowNever")
                }
              ],
            },
            {
              name: "carousel-image-pre",
              alias: i18next.t("carousel-image-pre"),
              type: "file(format=image)",
              visible:(widget: Carousel)=>{
                return widget.getOption("carousel-arrow-type") !== "never"
              }
            },
            {
              name: "carousel-image-next",
              alias: i18next.t("carousel-image-next"),
              type: "file(format=image)",
              visible:(widget: Carousel)=>{
                return widget.getOption("carousel-arrow-type") !== "never"
              }
            },
          ]
        },
        "carousel-settings": {
          alias: i18next.t("carouselSettings"),
          children: [
            {
              name: "carousel-display",
              alias: i18next.t("carouselDisplay"),
              type: "boolean",
              default: true,
            },
            {
              name: "animation-type",
              alias: i18next.t("animationType"),
              type: "select(radioGroup)",
              default: "translate",
              selectChoices: [
                {
                  value: "translate",
                  label: i18next.t("animationTranslate")
                },
                {
                  value: "overturn",
                  label: i18next.t("animationOverturn")
                }
              ],
            },
            {
              name: "carousel-loop",
              alias: i18next.t("carouselLoop"),
              type: "boolean",
              default: true,
            },
            {
              name: "carousel-duration",
              alias: i18next.t("carouselDuratio"),
              type: "number<float>(unit=" + UNIT_MIAO + ", min=1)",
              default: 3
            }
          ]
        }
      },
    }, ...super.defineOptions()];
  }

  handleImageSrc(relativePath) {
    if (!relativePath) return;
    const projectId = this.getBoard().projectId;
    return `${projectId}/${relativePath}`;
  }

  getCarouselIndexChoices() {
    let choices = [{
      value: "",
      label: i18next.t("toChoice"),
      redirect: true,//不存在选中选项时，选择此选项
    }];
    for (let i = 0; i <= this.imageList.length - 1; i++) {
      let choice: any = {};
      choice.value = i;
      choice.label = i18next.t("number") + (i + 1) + i18next.t("item");
      choices.push(choice);
    }
    return choices;
  }

  get carouselHeight(): string {
    let buttonSize = this.getOption<number[]>("carousel-indicator-size") || [0, 0];
    if (this.carouseIndicator == "outside") {
      return this.contentSize.height - 24 - buttonSize[1] + "px";
    }
    return this.contentSize.height + "px";
  }

  get carouseIndicator(): string {
    if (this.getOption("carousel-indicator")) {
      return this.getOption("carousel-indicator-position");
    }
    return "none";
  }

  get carouselStyle() {
    if (this.getOption("carousel-style") == "none") {
      return "";
    } else {
      return this.getOption("carousel-style");
    }
  }

  get carouselDirection() {
    return this.getOption("carousel-direction");
  }

  get imageList() {
    const dimUid = this.imagesFields?.[0]?.uid;
    if (dimUid) {
      const columns = this.getData().getflatColumns([dimUid])?.[0]?.flat?.() || [];
      const imageSuffix = ["bmp", "jpg", "jpeg", "png", "tif", "gif", "pcx", "tga", "exif", "fpx", "svg", "psd", "cdr", "pcd", "dxf", "ufo", "eps", "ai", "raw", "WMF", "webp", "avif", "apng"];
      const images = columns.filter(file => imageSuffix.some(suffix => file.name.endsWith(suffix)));
      if (images?.length) return images.map(img => img.url);
    }

    let imageUrlList = [];
    let carouselImageList = this.getOption<OptionFileValue[]>("carousel-image");
    for (let imageKey in carouselImageList) {
      let src = this.handleImageSrc(carouselImageList[imageKey]?.relativePath) || carouselImageList[imageKey]?.url;
      if (src === "" || src === undefined) continue;
      if (Array.isArray(src)) {
        imageUrlList.push(...src);
      } else {
        imageUrlList.push(src);
      }
    }
    return imageUrlList;
  }

  get imageArrow(){
    let imageArrowPre = this.getOption<OptionFileValue[]>("carousel-image-pre");
    let imageArrowNext = this.getOption<OptionFileValue[]>("carousel-image-next");
    let imageArrowPreSrc =  this.handleImageSrc(imageArrowPre?.relativePath) || imageArrowPre?.url || "";
    let imageArrowNextSrc = this.handleImageSrc(imageArrowNext?.relativePath) || imageArrowNext?.url || "";
    return {imageArrowPreSrc,imageArrowNextSrc}
  }



  get carouselAnimation() {
    return {
      enable: this.getOption("animation-type") === "translate" ? this.getOption("carousel-display") : false,
      loop: this.getOption("carousel-loop"),
      duration: this.getOption<number>("carousel-duration") * 1000
    }
  }

  get carouselItemChoices() {
    let choices = [];
    for (let i = 0; i < this.imageList.length; i++) {
      choices.push({
        value: i,
        label: i18next.t("number") + (i + 1) + i18next.t("item"),
      });
    }
    return choices;
  }

  setActiveItem(item_index) {
    this.setOption( ["carousel-index"], item_index, false );
  }

  showImage(ev) {
    ev.target.style.display = "";
  }

  hideImage(ev) {
    ev.target.style.display = "none";
  }

  get imagesFields() {
    return this.getOption<OptionFieldValue[]>("images-fields") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.imagesFields
      ]
    } as WidgetMetaData);
  }
}
