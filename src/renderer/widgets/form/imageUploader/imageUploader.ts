import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions, OptionFontValue, OptionFieldValue } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { Color } from "@renderer/b2/color";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { Uploader } from "../uploader/uploader";

import { UploadFile } from "element-plus";
import { changeLanguage } from "i18next";
import { ref } from "vue";

export interface CustomUploadFile extends Omit<UploadFile, "response"> {
  response: {
    data: {
      url: string;
    };
  };
}

export type ListType = "text" | "picture" | "picture-card" | "drop-down";

export class ImageUploader extends Uploader {

  public hasCamera = ref<boolean | null>(null);
  public isCheckingCamera = ref(false);

  static resource = resource as any;

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
                name: "file-list-type",
                alias: i18next.t("uploadDisplayStyle"),
                type: "select(radioGroup)",
                default: "text",
                selectChoices: [
                  { label: i18next.t("card"), value: "picture-card" },
                  { label: i18next.t("list"), value: "text" },
                  { label: i18next.t("dropdown"), value: "drop-down" },
                ],
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
            ],
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
                alias: i18next.t("limitImageCount"),
                type: "boolean",
                default: false,
                visible: () => {
                  // return false;
                  return true;
                },
              },
              {
                name: "limit-count-range",
                alias: i18next.t("imageCountRange"),
                type: "vector<min,max>(min=0)",
                default: [0, 1],
                visible: (widget: ImageUploader) => {
                  // return false;
                  return widget.getOption<boolean>("limit-count");
                },
                beforeChange: (widget, value) => {
                  return value && value[0] <= value[1];
                }
              },
              {
                name: "limit-size",
                alias: i18next.t("limitSingleImageSize"),
                type: "boolean",
                default: false,
              },
              {
                name: "limit-size-range",
                alias: i18next.t("singleImageSizeRange"),
                type: "number<float>(unit=MB)",
                default: 1,
                visible: (widget: ImageUploader) => {
                  return widget.getOption<boolean>("limit-size");
                },
              },
              {
                name: "limit-type",
                alias: i18next.t("limitImageFormat"),
                type: "boolean",
                default: false,
              },
              {
                name: "limit-type-text",
                alias: i18next.t("imageFormat"),
                tip: i18next.t("imageFormatTip"),
                type: "string",
                visible: (widget: ImageUploader) => {
                  return widget.getOption<boolean>("limit-type");
                },
              },
              {
                name: "only-camera",
                alias: i18next.t("cameraOnlyUpload"),
                type: "boolean",
                default: false,
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

  async checkCameraAvailability() {
    if (this.isCheckingCamera.value || this.hasCamera.value !== null) return;

    this.isCheckingCamera.value = true;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some(device => device.kind === 'videoinput');
        this.hasCamera.value = hasVideoInput;
      } else {
        this.hasCamera.value = false;
      }
    } catch (err) {
      console.error("Error checking for camera:", err);
      this.hasCamera.value = false;
    } finally {
      this.isCheckingCamera.value = false;
    }
  }

  get isOnlyCamera(): boolean {
    return this.getOption<boolean>("only-camera");
  }

  get isCameraUploadDisabled(): boolean {
    return this.isOnlyCamera && this.hasCamera.value === false;
  }

  get fileAccept() {
    if (this.getOption("limit-type")) {
      return this.acceptTypes.join(",");
    }
    return "image/*";
  }
  private get acceptTypes() {
    return this.getOption<string>("limit-type-text").split(",").map(ext=>{
      ext = ext.toLowerCase();
      return ext.startsWith(".") ? ext : `.${ext}`;
    });
  }


  async doValidate() {
    if (this.getOption("limit-count")) {
      const range = this.getOption("limit-count-range");
      if(range) {
        if (this.fileList.length < range[0]) {
          throw new Error(i18next.t("minImageCountError", { count: range[0] }));
        }
        if (this.fileList.length > range[1]) {
          throw new Error(i18next.t("maxImageCountError", { count: range[1] }));
        }
      }
    }
    if (this.getOption("limit-size")) {
      const range = this.getOption<number>("limit-size-range");
      if(range) {
        this.fileList.forEach((file) => {
          if (file.size > range*1024*1024) {
            throw new Error(i18next.t("maxImageSizeError", { size: range }));
          }
        });
      }
    }
    if (this.getOption("limit-type")) {
      const types = this.acceptTypes;
      if (types.length > 0) {
        this.fileList.forEach((file) => {
          if (!types.some(type=>file.name.toLowerCase().endsWith(type))) {
            throw new Error(i18next.t("imageFormatError", { types: types.join(",") }));
          }
        });
      }
    }

    if (this.readyFilesNum !== 0) {
      throw new Error(i18next.t("uploadPending"));
    }
  }

  // get fileListType(): ListType {
  //   return this.getOption<ListType>("file-list-type");
  // }

  get fileSelectMode() {
    return this.getOption<"select-single" | "select-mulitple">("file-select-mode");
  }

  get fieldType() {
    return "array";
  }

  resolveFormSetting() {
    const extra = {
      listType: this.fileListType,
      limitCount: this.getOption("limit-count"),
      limitCountRange: this.getOption("limit-count-range"),
      limitSize: this.getOption("limit-size"),
      limitSizeRange: this.getOption("limit-size-range"),
      limitType: this.getOption("limit-type"),
      limitTypeText: this.getOption("limit-type-text"),
      onlyCamera: this.getOption("only-camera"),
    }

    return {
      ...super.resolveFormSetting(),
      subType: "image",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra
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

