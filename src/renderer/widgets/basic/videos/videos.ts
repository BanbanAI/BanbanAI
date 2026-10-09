import { DefinedOptions, OptionFileValue, WidgetMetaData, OptionFieldValue } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { ref } from "vue"
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge } from "merge";

export class Videos extends Widget {
  public arrLengh = ref<number>(0);
  get autoplay() {
    return this.getOption("autoplay");
  }
  get loop() {
    return this.getOption("loop");
  }
  get muted() {
    return this.getOption<boolean>("muted");
  }
  get controls() {
    return !this.getOption("no-controls");
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  static resource = resource;
  static defineOptions(): DefinedOptions[] {
    return [{
      data: {
        fields: {
          alias: "字段设置",
          fold: "unfold",
          children: [
            {
              name: "videos-fields",
              alias: "视频字段",
              type: "field(max=1)"
            },
          ],
        },
      },
      style: {
        basic: {
          children: [
            {
              name: "video",
              alias: i18next.t("videoAddress"),
              type: "file(format=video,multiple)",
            },
            {
              name: "no-events",
              alias: i18next.t("noEvents"),
              type: 'boolean',
              default: false,
            }
          ],
        },
        play: {
          alias: i18next.t("playSetting"),
          children: [
            {
              name: "autoplay",
              alias: i18next.t("autoplay"),
              type: "boolean",
              default: true,
            },
            {
              name: "muted",
              alias: i18next.t("muted"),
              type: "boolean",
              default: true,
            },
            {
              name: "no-controls",
              alias: i18next.t("noControls"),
              type: "boolean",
              default: false,
            },
          ]
        },
      },
    }, ...super.defineOptions()];
  }

  get videosFields() {
    return this.getOption<OptionFieldValue[]>("videos-fields") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.videosFields
      ]
    } as WidgetMetaData);
  }

}
