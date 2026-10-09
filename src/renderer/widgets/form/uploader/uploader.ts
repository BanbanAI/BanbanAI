import { DefinedOptions } from "@renderer/b2/types";
import { PROJECT_ID } from "@renderer/types/inject";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { watch, Ref, ref, inject, computed, reactive } from "vue";
import { ElMessage, UploadFile, UploadRequestOptions } from "element-plus";
import { removeUploadItemFromList } from "./uploadItem";
import { getBuiltinWidgetAsset } from "@renderer/widgets/assets";
import axios from "axios";

export interface CustomUploadFile extends Omit<UploadFile, "response"> {
  response?: {
    data: {
      url: string;
    };
  };
}

export type ListType = "text" | "picture" | "picture-card" | "drop-down";

export class Uploader extends FormElement {
  private projectId = inject(PROJECT_ID);
  static resource = resource as any;
  protected _inputValue = ref<UploadFile[]>(null);

  get initialValue() {
    return Array.isArray(super.initialValue) ? super.initialValue : [];
  }
  private get originValue(): UploadFile[] {
    return this._inputValue.value ?? this.initialValue ?? [];
  }
  public get inputValue() {
    // return this._inputValue.value ?? this.initialValue ?? [];
    return this.originValue;
  }
  public set inputValue(value: UploadFile[]) {
    this._inputValue.value = value;
  }

  public trySetInputValue(value: UploadFile[]) {
    if (this.topForm.isViewing) return;
    this._fileList.value = [];
    super.trySetInputValue(value);
  }

  public staticPath(relative) {
    return getBuiltinWidgetAsset("widget.form.uploader", `resource/${relative}`);
  }

  public resetValue() {
    this.fileList = [];
    this.inputValue = [];
  }


  public percentage = ref(0);

  private _fileList = ref<UploadFile[]>([]);
  set fileList(value: UploadFile[]) {
    this._fileList.value = value;
    this.updateLastChangeTime();
  }
  get fileList(): UploadFile[] {
    const _temp = this.inputValue ?? [];
    for(let value of _temp) {
      if(this._fileList.value.some(file => file.uid === value.uid)) {
        continue;
      }
      this._fileList.value.push(value);
    }
    return this._fileList.value;
  }

  public clearValue() {
    this.fileList = [];
    this.inputValue = [];
  }

  get fileListType(): ListType {
    return this.getOption("file-list-type");
  }

  get isAutomaticUpload(): boolean {
    if (this.fileListType === "picture-card") {
      return true;
    }
    return this.getOption<boolean>("automatic-file-upload");
  }

  get fileCount(): number | undefined {
    const isLimitFiles = this.getOption<boolean>("limit-files");
    if (isLimitFiles) {
      return this.getOption<number>("upload-file-num") || 1;
    } else {
      return undefined;
    }
  }

  get fileFormatList(): string[] {
    let fileFormat = this.getOption<string>("upload-file-format") || "";
    if (fileFormat === "custom") {
      let customFormat = this.getOption<string>("custom-file-format") || "";
      let lowerCaseFormat = customFormat.toLowerCase();
      let lowerCaseFormatArr = lowerCaseFormat.split(",");
      return lowerCaseFormatArr.map((item) => "." + item);
    } else if (fileFormat && fileFormat !== "*") {
      let lowerCaseFormat = fileFormat.toLowerCase();
      let lowerCaseFormatArr = lowerCaseFormat.split(",");
      return lowerCaseFormatArr.map((item) => "." + item);
    }
    return [];
  }

  public reportId;
  fileFormatStr(str: string, formatType: string): string {
    let lastDotIndex = str.lastIndexOf(formatType);
    if (lastDotIndex === -1) return "";
    return str.substring(lastDotIndex);
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          linkForm: {
            visible: false,
          }
        },
      },
      ...super.defineOptions(),
    ];
  }

  public uploadFile = async (options: UploadRequestOptions) => {
    const formData = new FormData();
    formData.append("file", options.file);
    formData.append("filename", options.file.name);
    formData.append("projectId", this.projectId);
    formData.append("nocodeId", this.getBoard().nocodeId || "");
    const res = await axios.post("/uploader/uploadFile", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        let percent = Math.floor((progressEvent.loaded / progressEvent.total) * 100);
        options.onProgress({ ...progressEvent, percent });
      },
    }).catch(({ response }) => {
      ElMessage.error(response?.data?.message);
      throw response;
    });
    return res;
  };

  public beforeRemove = (uploadFile: CustomUploadFile) => {
    // 兼容旧数据缺少 uid 时的单项删除
    this.inputValue = removeUploadItemFromList(this.inputValue, uploadFile);
    this.fileList = removeUploadItemFromList(this.fileList, uploadFile);
  };

  get defaultName() {
    return i18next.t("defaultName");
  }

  get fieldType() {
    return "array";
  }

  resolveFormSetting() {
    return super.resolveFormSetting();
  }

  public MoveValue = (oldIndex: number, newIndex: number): boolean => {
    try {
      this.inputValue = this.moveArrayItem(this.inputValue, oldIndex, newIndex)
      this.fileList = this.moveArrayItem(this.fileList, oldIndex, newIndex)
      return true
    } catch (error) {
      return false
    }
  }
  moveArrayItem<T>(array:T[], oldIndex: number, newIndex: number): T[] {
    if (
      oldIndex < 0 ||
      oldIndex >= array.length ||
      newIndex < 0 ||
      newIndex >= array.length
    ) {
      return array
    }

    // 创建新数组（避免直接修改原数组，保持响应式更新更友好）
    const newArray = [...array]
    const [movedItem] = newArray.splice(oldIndex, 1) // 移除旧位置的元素
    newArray.splice(newIndex, 0, movedItem)          // 插入到新位置

    return newArray
  }
}
