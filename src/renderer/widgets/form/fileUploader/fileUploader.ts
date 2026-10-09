import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions, OptionFontValue, OptionFieldValue } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { Color } from "@renderer/b2/color";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { ListType, Uploader } from "../uploader/uploader";

import { UploadFile } from "element-plus";
import { ref } from "vue";

export interface CustomUploadFile extends Omit<UploadFile, "response"> {
  md5?: string;
  previewUrl?: string;
  loading?: boolean;
  response?: {
    data: {
      url: string;
      md5?: string;
      fileSize?: number;
    };
  };
}
export class FileUploader extends Uploader {
  static resource = resource;

  get defaultName() {
    return i18next.t("defaultName");
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "width-subform",
                default: 300,
              },
              {
                name: "file-select-mode",
                alias: i18next.t("uploadSelectMode"),
                type: "select(radioGroup)",
                default: "select-mulitple",
                selectChoices: [
                  { label: i18next.t("single"), value: "select-single" },
                  { label: i18next.t("multiple"), value: "select-mulitple" },
                ],
              },
            ]
          },
          scanInput: {
            visible: false,
          },
          validation: {
            children: [
              {
                name: "unique",
                visible: false,
              },
              {
                name: "limit-count",
                alias: i18next.t("limitFileCount"),
                type: "boolean",
                default: false,
              },
              {
                name: "limit-count-range",
                alias: i18next.t("fileCountRange"),
                type: "vector<min,max>(min=0)",
                default: [0, 1],
                visible: (widget: FileUploader) => {
                  return widget.getOption<boolean>("limit-count");
                },
                beforeChange: (widget, value) => {
                  return value && value[0] <= value[1];
                }
              },
              {
                name: "limit-size",
                alias: i18next.t("limitSingleFileSize"),
                type: "boolean",
                default: false,
              },
              {
                name: "limit-size-range",
                alias: i18next.t("singleFileSizeRange"),
                type: "number<float>(unit=MB)",
                visible: (widget: FileUploader) => {
                  return widget.getOption<boolean>("limit-size");
                },
              },
              {
                name: "limit-type",
                alias: i18next.t("limitFileFormat"),
                type: "boolean",
                default: false,
              },
              {
                name: "limit-type-text",
                alias: i18next.t("fileFormat"),
                tip: i18next.t("fileFormatTip"),
                type: "string",
                visible: (widget: FileUploader) => {
                  return widget.getOption<boolean>("limit-type");
                },
              },
            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  public _readyFilesNum = ref(0);
  get readyFilesNum() {
    return this._readyFilesNum.value
  }
  set readyFilesNum(value: number) {
    this._readyFilesNum.value = value;
  }

  get fileAccept() {
    if (this.getOption("limit-type")) {
      return this.acceptTypes.join(",");
    }
    return "";
  }
  private get acceptTypes() {
    return this.getOption<string>("limit-type-text").split(",").map(ext=>{
      ext = ext.toLowerCase();
      return ext.startsWith(".") ? ext : `.${ext}`;
    });
  }

  protected async doValidate() {
    if (this.getOption("limit-count")) {
      const range = this.getOption("limit-count-range");
      if(range) {
        if (this.fileList.length < range[0]) {
          throw new Error(i18next.t("minFileCountError", { count: range[0] }));
        }
        if (this.fileList.length > range[1]) {
          throw new Error(i18next.t("maxFileCountError", { count: range[1] }));
        }
      }
    }
    if (this.getOption("limit-size")) {
      const range = this.getOption<number>("limit-size-range");
      if(range) {
        this.fileList.forEach((file) => {
          if (file.size > range*1024*1024) {
            throw new Error(i18next.t("maxFileSizeError", { size: range }));
          }
        });
      }
    }
    if (this.getOption("limit-type")) {
      const types = this.acceptTypes;
      if (types.length > 0) {
        this.fileList.forEach((file) => {
          if (!types.some(type=>file.name.toLowerCase().endsWith(type))) {
            throw new Error(i18next.t("fileFormatError", { types: types.join(",") }));
          }
        });
      }
    }

    if (this.readyFilesNum !== 0) {
      throw new Error(i18next.t("uploadPending"));
    }
  }

  get fileSelectMode() {
    return this.getOption<"select-single" | "select-mulitple">("file-select-mode");
  }

  resolveFormSetting() {
    const extra = {
      limitCount: this.getOption("limit-count"),
      limitCountRange: this.getOption("limit-count-range"),
      limitSize: this.getOption("limit-size"),
      limitSizeRange: this.getOption("limit-size-range"),
      limitType: this.getOption("limit-type"),
      limitTypeText: this.getOption("limit-type-text"),
    }

    return {
      ...super.resolveFormSetting(),
      subType: "file",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      }
    };
  }
}

