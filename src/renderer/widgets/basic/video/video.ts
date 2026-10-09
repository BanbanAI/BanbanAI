import { DefinedOptions, OptionFileValue, WidgetMetaData, OptionFieldValue } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { ref, watch } from "vue";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge } from "merge";
export class Video extends Widget {
  public videoDom: HTMLVideoElement;
  public showSnapshotImg = ref(false);
  public snapshotImgUrl = ref('');

  get defaultName() {
    return i18next.t("defaultName");
  }

  initAfterConstructor() {
    super.initAfterConstructor();
    this.watchVideoSource();
  }

  watchVideoSource() {
    this.effectScope.run(()=>{
      watch(()=>{
        const videoDim = this.videoFields?.[0];
        const dimUid = videoDim?.uid;
        if (!dimUid) return null;
        const columns = this.getData().getflatColumns([dimUid])?.[0]?.flat?.() || [];
        const videoSuffix = ['.mp4', '.avi', '.mov', '.wmv', "rmvb", "mkv", "flv", "avchd", "webm"];
        const video = columns.find(file => videoSuffix.some(suffix => file.name.endsWith(suffix)));
        return video?.url
      }, (value)=>{
        this.videoData = value;
      })
    })
  }

  private _videoData = ref(null);

  get videoData() {
    return this._videoData.value;
  }

  set videoData(value) {
    this._videoData.value = value;
  }

  static resource = resource;
  static defineOptions(): DefinedOptions[] {
    const UNIT_MIAO = i18next.t("unitMIAO");
    return [{
      data: {
        fields: {
          alias: "字段设置",
          fold: "unfold",
          children: [
            {
              name: "video-fields",
              alias: "视频字段",
              type: "field(max=1)"
            },
          ],
        },
      },
      style: {
        basic: {
          fold: 'unfold',
          children: [
            {
              name: "video",
              alias: i18next.t("videoAddress"),
              type: 'file(format=video)',
            },
            {
              name: "no-events",
              alias: i18next.t("noEvents"),
              type: 'boolean',
              default: false,
            },
            {
              name: "set-mix-blend-mode",
              alias: i18next.t("blendMode"),
              type: 'boolean',
              default: false,
            }
          ],
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
              name: "loop",
              alias: i18next.t("loop"),
              type: "boolean",
              default: true,
            },
            {
              name: "loop-start-time",
              alias: i18next.t("loopStartTime"),
              type: "number<float>(unit=" + UNIT_MIAO + ")",
              default: 0,
              visible: (widget: Widget) => {
                return !!widget.getOption("loop")
              },
            },
            {
              name: "speed",
              alias: i18next.t("speed"),
              type: "select(radioGroup)",
              default: "1.0",
              selectChoices: [
                {
                  value: "2.0",
                  label: '2.0x'
                },
                {
                  value: "1.5",
                  label: "1.5x"
                },
                {
                  value: "1.0",
                  label: "1.0x",
                },
                {
                  value: "0.5",
                  label: "0.5x",
                },
              ]
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
            {
              name: "pause-to-continue",
              alias: i18next.t("pauseToContinueSort"),
              tip: i18next.t("pauseToContinue"),
              type: "select(radioGroup)",
              selectChoices: [{
                value: "continue",
                label: i18next.t("continue"),
              }, {
                value: "rewind",
                label: i18next.t("rewind"),
              }],
              default: "continue"
            }
          ]
        },
      },
    }, ...super.defineOptions()]
  }

  get videoSrc(): string {
    // if (this.videoData) return 'http://vjs.zencdn.net/v/oceans.mp4';
    if (this.videoData) return this.videoData;

    let video = this.getOption<OptionFileValue>("video");
    if (video?.url) {
      return video.url;
    }
    const projectId = this.getBoard().projectId;
    let videoSrc: string;
    if (video) {
      videoSrc = `${projectId}/${video?.relativePath}`
    }
    return videoSrc;
  }

  get mixBlend() {
    return this.getOption("set-mix-blend-mode");
  }

  get autoplay() {
    return this.getOption("autoplay") as boolean;
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

  async snapshotForCover() {
    const canvas = document.createElement('canvas');
    canvas.width = this.videoDom.videoWidth;
    canvas.height = this.videoDom.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.videoDom, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL();
  }

  async beforeSnapshot() {
    const canvas = document.createElement('canvas');
    canvas.width = this.videoDom.videoWidth;
    canvas.height = this.videoDom.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.videoDom, 0, 0, canvas.width, canvas.height);
    this.snapshotImgUrl.value = canvas.toDataURL();
    this.showSnapshotImg.value = true;
  }

  get currentValue(){
    return {
      value: this.videoSrc
    }
  }

  get videoFields() {
    return this.getOption<OptionFieldValue[]>("video-fields") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.videoFields
      ]
    } as WidgetMetaData);
  }
}
