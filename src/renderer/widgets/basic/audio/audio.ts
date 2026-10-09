import { DefinedOptions, OptionFileValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { ref, watch } from "vue";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge } from "merge";
export class Audio extends Widget {

  initAfterConstructor() {
    super.initAfterConstructor();
    this.watchAudioSource();
  }

  watchAudioSource() {
    this.effectScope.run(()=>{
      watch(()=>{
        const audioDim = this.audioFields?.[0];
        const dimUid = audioDim?.uid;
        if (!dimUid) return [];
        const columns = this.getData().getflatColumns([dimUid])?.[0]?.flat?.() || [];
        const audioSuffix = ["wav", "mp3", "wma", "ape", "flac", "ogg", "aac"];
        const audio = columns.find(file => audioSuffix.some(suffix => file.name.endsWith(suffix)));
        return audio?.url;
      }, (value)=>{
        this.audioData = value;
      })
    })
  }

  private _audioData = ref(null);

  get audioData() {
    return this._audioData.value;
  }

  set audioData(value) {
    this._audioData.value = value;
  }

  static resource = resource;
  static defineOptions(): DefinedOptions[] {
    const UNIT_MIAO = i18next.t("unitMIAO");
    return [{
      data: {
        fields: {
          alias: i18next.t('fieldSetting'),
          fold: "unfold",
          children: [
            {
              name: "audio-fields",
              alias: i18next.t('audioSetting'),
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
              name: "audio",
              alias: i18next.t("audioAddress"),
              type: 'file(format=.mp3)',
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
              name: "start-time",
              alias: i18next.t("loopStartTime"),
              type: "number<float>(unit=" + UNIT_MIAO + ")",
              default: 0,
            },
            {
              name: "volume",
              alias: i18next.t("volume"),
              type: "number<float>(min=0,max=100,step=1)",
              default: 100,
            },
            {
              name: "loop",
              alias: i18next.t("loop"),
              type: "boolean",
              default: true,
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

  get audioSrc(): string {
    if (this.audioData) return this.audioData;

    const audioOption = this.getOption<OptionFileValue>("audio");
    if (audioOption?.url) {
      return audioOption.url;
    }
    let audioAddress;
    if (audioOption?.relativePath) {
      const projectId = this.getBoard().projectId;
      audioAddress = `${projectId}/${audioOption.relativePath}`
    }
    return audioAddress;
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
  get controls() {
    return !this.getOption("no-controls");
  }
  get startTime() {
    return this.getOption<number>("start-time") || 0
  }

  get audioFields() {
    return this.getOption<OptionFieldValue[]>("audio-fields") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.audioFields
      ]
    } as WidgetMetaData);
  }
}
