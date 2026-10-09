import { DefinedOptions, OptionFileValue, WidgetMetaData, OptionFieldValue } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge } from "merge";

export class Pdf extends Widget {
  static resource = resource;

  get defaultName() {
    return i18next.t("defaultName");
  }

  get pdfFilePath(): string {
    const dimUid = this.pdfFields?.[0]?.uid;
    if (dimUid) {
      const columns = this.getData().getflatColumns([dimUid])?.[0]?.flat?.() || [];
      const pdf = columns.find(file => file.name.endsWith(".pdf"));
      if (pdf) return pdf.url;
    }

    if(typeof(this.getOption('pdf')) === "string") return this.getOption('pdf') ? this.getOption('pdf') : "";
    let pdfSrc = this.getOption<OptionFileValue>('pdf') || {};
    return pdfSrc.url ? pdfSrc.url : pdfSrc.relativePath ? this.handlePDFSrc(pdfSrc.relativePath) : "";
  }
  static defineOptions(): DefinedOptions[] {
    const UNIT_BEI = i18next.t("unitBei");
    return [{
      data: {
        fields: {
          alias: "字段设置",
          fold: "unfold",
          children: [
            {
              name: "pdf-fields",
              alias: "文本字段",
              type: "field(max=1)"
            },
          ],
        },
      },
      style: {
        basic: {
          alias: i18next.t("basicSetting"),
          children: [
            {
              name: "pdf",
              alias: i18next.t("pdf"),
              type: "file(format=.pdf)",
            },
            {
              name: "loading-background-color",
              alias: i18next.t("loadingBackgroundColor"),
              default: "rgba(122, 122, 122, 0.8)",
              type: "color",
            },
            {
              name: "loading-scall",
              alias: i18next.t("loadingScall"),
              default: 1,
              type: "number(unit=" + UNIT_BEI + ")",
              visible: false
            },
            {
              name: "btn-size",
              alias: i18next.t("btnSize"),
              default: 30,
              type: "number(unit=px)",
            },
            {
              name: "btn-font",
              alias: i18next.t("btnFont"),
              default: {
                size: 30
              },
              type: "font",
            },
            {
              name: "btn-click",
              alias: i18next.t("btnClick"),
              default: false,
              type: "boolean",
            }
          ],
        },
      },
    }, ...super.defineOptions()];
  }

  handlePDFSrc(relativePath) {
    const projectId = this.getBoard().projectId;
    return `${projectId}/${relativePath}`;
  }

  get pdfFields() {
    return this.getOption<OptionFieldValue[]>("pdf-fields") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.pdfFields
      ]
    } as WidgetMetaData);
  }
}