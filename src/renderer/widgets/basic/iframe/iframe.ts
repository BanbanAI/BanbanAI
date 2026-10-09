import { DefinedOptions, OptionFileValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge } from "merge";
export class Iframe extends Widget {
  static resource = resource;

  static defineOptions(): DefinedOptions[] {
    return [{
      data: {
        fields: {
          alias: i18next.t('fieldSetting'),
          fold: "unfold",
          children: [
            {
              name: "link-fields",
              alias: i18next.t('iframeUrlField'),
              type: "field(max=1)"
            },
          ],
        },
      },
      style: {
        basic: {
          children: [
            {
              name:"heavy-load",
              alias:i18next.t("heavy-load"),
              type:"boolean",
              tip:i18next.t("load-tip"),
              default:false
            },
            {
              name: "data-select",
              alias: i18next.t("dataSelect"),
              type: "select(radioGroup)",
              default: 'iframe',
              selectChoices: [
                {
                  label: i18next.t("iframeLink"),
                  value: "iframe"
                },
                {
                  label: i18next.t("iframeFolder"),
                  value: "folder"
                }
              ],
            },
            {
              name: "iframe-link",
              alias: i18next.t("iframeLink"),
              type: "string",
              default: "https://m.baidu.com",
              visible: (widget: Widget) => {
                return widget.getOption("data-select") == "iframe";
              }
            },
            {
              name: "iframe-folder",
              alias: i18next.t("iframeFolder"),
              type: 'folder(showFolder)',
              tip: i18next.t("iframeFolderTip"),
              default: {
                relativeDir: '',
                relativePath: '',
                __opt_type: 'folder'
              },
              visible: (widget: Widget) => {
                return widget.getOption("data-select") == "folder";
              }
            },
            {
              name: "sandbox",
              alias: "sandbox",
              type: "boolean",
              default: false,
            },
            {
              name: "microphone",
              alias: i18next.t("microphone"),
              type: "boolean",
              default: false,
            },
            {
              name: "camera",
              alias: i18next.t("camera"),
              type: "boolean",
              default: false,
            },
          ]
        }
      }

    }, ...super.defineOptions()]
  }

  get iframeUrl() {
    const dimUid = this.linkFields?.[0]?.uid;
    if (dimUid) {
      const columns = this.getData().getflatColumns([dimUid])?.[0]?.flat?.() || [];
      const link = columns.find(link => typeof link === "string");
      if (link) return link;
    }

    return this.getOption("iframe-link")
  }

  iframeLink(): string {
    if (this.getOption("data-select") === "folder") {
      const projectId = this.getBoard().projectId
      const folderPath = this.getOption<OptionFileValue>("iframe-folder")?.relativeDir;
      return `${projectId}/${folderPath}/index.html`
    }
    if (this.iframeUrl === undefined) return "";
    return this.iframeUrl;
  }

  get showLoad ():boolean{
    return this.getOption("heavy-load")
  }

  get sandbox(): string {
    let sandbox = "";
    let sandboxEnabled = this.getOption("sandbox");
    if (sandboxEnabled) {
      sandbox = "allow-scripts allow-same-origin allow-forms allow-popups";
    }
    return sandbox;
  }

  get allow() {
    let allows = [];
    let microphoneEnabled = this.getOption("microphone");
    let cameraEnabled = this.getOption("camera");
    if (microphoneEnabled) {
      allows.push("microphone")
    }
    if (cameraEnabled) {
      allows.push("camera")
    }
    return allows.join(";");
  }

  get linkFields() {
    return this.getOption<OptionFieldValue[]>("link-fields") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.linkFields
      ]
    } as WidgetMetaData);
  }
}
