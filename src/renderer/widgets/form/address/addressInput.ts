import { AggregationType, FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions, OptionFileValue } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { FormElement } from "@renderer/b2/controllers/form";
import { Widget } from "@renderer/b2/controllers/widget";
import { WidgetSoul } from "@common/types/project";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref } from "vue";

export type AddressPrecision = "province" | "city" | "district" | "street";

export class AddressInput extends FormElement {
  static resource = resource as any;
  private _visableAddressDialog = ref<boolean>(false);


  constructor(soul: WidgetSoul, parent: Widget | Board) {
    super(soul, parent);
  }
  public get getIcon(): OptionFileValue {
    return this.getOption<OptionFileValue>("dropdown-icon");
  }

  private firstPaint = true;

  public get dropIcon(): string {
    if (!this.status.isVisible && this.firstPaint) return "";
    this.firstPaint = false;
    let src;
    if (typeof this.getIcon === "string") {
      src = this.getIcon;
    } else {
      const projectId = this.getBoard().projectId;
      const path = this.getIcon?.relativePath
        ? `${projectId}/${this.getIcon.relativePath}`
        : "";
      src = this.getIcon?.url || path;
    }
    return `url("${src}") center center / 100% 100% no-repeat`;
  }
  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "width-subform",
                default: 320,
              },
              {
                name: "selector-placeholder",
                alias: i18next.t("selectorTip"),
                type: "string",
              },
              {
                name: "address-precision",
                alias: i18next.t("addressLevel"),
                type: "select",
                default: "street",
                selectChoices: (widget: AddressInput) => {
                  return [
                    {
                      label: i18next.t("provinceCityDistrictStreet"),
                      value: "street",
                    },
                    {
                      label: i18next.t("provinceCityDistrict"),
                      value: "district",
                    },
                    { label: i18next.t("provinceCity"), value: "city" },
                  ];
                },
              },
              {
                name: "address-detail",
                alias: i18next.t("addressDetail"),
                type: "boolean",
                default: true,
              },
              {
                name: "input-placeholder",
                alias: i18next.t("inputTip"),
                type: "string",
                visible: (widget: AddressInput) => {
                  return widget.isAddressDetail;
                },
              },
              {
                name: "default-value",
                alias: i18next.t("defaultValue"),
                placeholder: i18next.t("plsInputDefaultAddr"),
                type: "string",
              },
              {
                name: "clear-button",
                alias: i18next.t("clearBtn"),
                type: "boolean",
                default: true,
                visible: false,
              },
            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }
  public noEffectedLinkages = ref(null);

  private _selectedRegionPath = ref<string>();
  get selectedRegionPath() {
    return this._selectedRegionPath.value;
  }
  set selectedRegionPath(val) {
    this._selectedRegionPath.value = val;
    this.updateInputValueFromAddressParts();
  }

  private _inputAddressDetail = ref<string>("");
  get inputAddressDetail() {
    return this._inputAddressDetail.value ?? "";
  }
  set inputAddressDetail(val) {
    this._inputAddressDetail.value = val;
    this.updateInputValueFromAddressParts();
  }

  get defaultValue(): string {
    return this.getOption<string>("default-value");
  }

  public clearValue() {
    this.selectedRegionPath = null;
    this.inputAddressDetail = null;
    this.inputValue = null;
  }

  protected _inputValue: Ref<string> = ref();
  public get inputValue() {
    return this._inputValue.value ?? this.initialValue ?? this.defaultValue;
  }
  public set inputValue(value: string) {
    this._inputValue.value = value;
    this.syncAddressParts(value);
    this.updateLastChangeTime();
  }

  private updateInputValueFromAddressParts() {
    this._inputValue.value =
      `${this.selectedRegionPath || ""} ${this.inputAddressDetail || ""}`.trim();
    this.updateLastChangeTime();
  }

  public syncAddressParts(value = this.inputValue) {
    const [selectedRegionPath, ...inputAddressDetail] = (value || "")
      .split(" ")
      .filter(Boolean);
    this._selectedRegionPath.value = selectedRegionPath;
    this._inputAddressDetail.value = inputAddressDetail.join(" ");
  }

  async doValidate() {}

  get addressPrecision() {
    const precision = this.getOption<AddressPrecision>("address-precision");
    if (precision === "street") {
      return 4;
    } else if (precision === "district") {
      return 3;
    } else if (precision === "city") {
      return 2;
    }
    return 1;
  }

  get isAddressDetail() {
    return this.getOption<boolean>("address-detail");
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  get maxLength() {
    let max = this.getOption<number>("max-length");
    return this.wordLimit ? max : null;
  }

  get wordLimit() {
    return this.getOption<boolean>("word-limit");
  }

  get inputPlaceholder() {
    return this.getOption<string>("input-placeholder");
  }

  get selectorPlaceholder() {
    const placeholder = this.getOption<string>("selector-placeholder");
    if (placeholder) {
      return placeholder;
    } else {
      if (this.addressPrecision === 1) {
        return i18next.t("province");
      } else if (this.addressPrecision === 2) {
        return i18next.t("provinceCity2");
      } else if (this.addressPrecision === 3) {
        return i18next.t("provinceCityDistrict2");
      } else if (this.addressPrecision === 4) {
        return i18next.t("provinceCityDistrictStreet2");
      }
    }
  }
  get clearable() {
    return this.getOption<boolean>("clear-button");
  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.BELONG]: RuleFuncValue.ADDRESS,
        [RuleFunc.NOT_BELONG]: RuleFuncValue.ADDRESS,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.BELONG]: RuleFuncValue.ADDRESS,
        [RuleFunc.NOT_BELONG]: RuleFuncValue.ADDRESS,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      aggregationInfo: [
        AggregationType.NOT_SHOW,
        AggregationType.FILLED,
        AggregationType.UNFILLED,
      ],
    };
  }
}
