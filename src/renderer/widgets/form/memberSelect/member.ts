import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { Department as DepartmentType, Role } from "@common/types/account";
import { DefinedOptions } from "@renderer/b2/types";
import { TheWidget as Department} from "../departmentSelect";
import { MemberShowField } from "./types";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import departmentResource from "../departmentSelect/locales";

const memberResource = Object.fromEntries(
  [...new Set([...Object.keys(departmentResource), ...Object.keys(resource)])].map((locale) => [
    locale,
    {
      ...departmentResource[locale],
      ...resource[locale],
    },
  ]),
);

export class Member extends Department {
  static resource = memberResource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basic: {
            children: [

            ]
          },
          basicStyle: {
            children: [
              {
                name: "input-width",
                alias: i18next.t("inputWidth"),
              },
              {
                name: "show-info",
                alias: i18next.t("showInfo"),
                type: "check-select(multiple,tree,allCheck)",
                default: [],
                selectChoices: [
                  {
                    label: i18next.t("name"),
                    value: MemberShowField.NAME
                  },
                  {
                    label: i18next.t("staffNo"),
                    value: MemberShowField.STAFF_NO
                  },
                  {
                    label: i18next.t("phoneNumber"),
                    value: MemberShowField.PHONE
                  },
                  {
                    label: i18next.t("email"),
                    value: MemberShowField.EMAIL
                  },
                  {
                    label: i18next.t("department"),
                    value: MemberShowField.DEPARTMENT
                  },
                  {
                    label: i18next.t("role"),
                    value: MemberShowField.ROLE
                  },
                ]
              },
            ]
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get currentType(): "department" | "member" {
    return "member"
  }

  get fieldType() {
    return "array";
  }

  get showInfo(): string[] {
    return this.getOption<string[]>("show-info");
  }

  resolveFormSetting() {
    const extra = {
      defaultValue: this.defaultValue,
      defaultValueDynamic: this.getOption("default-value")?.dynamic || [],
      showInfo: this.showInfo,
      isMultiple: this.isMultiple,
      autoFill: this.getOption("auto-fill"),
      fillField: this.getOption("fill-field"),
    }

    return {
      ...super.resolveFormSetting(),
      subType: "account",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    if (this.isMultiple) {
      return {
        subType: "account",
        funcInfo: {
          [RuleFunc.CONTAIN_ANY]: RuleFuncValue.SELECT_MULTIPLE,
          [RuleFunc.CONTAIN_ALL]: RuleFuncValue.SELECT_MULTIPLE,
          [RuleFunc.EQUAL]: RuleFuncValue.SELECT_MULTIPLE,
          [RuleFunc.EMPTY]: RuleFuncValue.NULL,
          [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
        },
        // 编辑表单时使用的筛选判断条件
        editFuncInfo: {
          [RuleFunc.CONTAIN_ANY]: RuleFuncValue.SELECT_MULTIPLE,
          [RuleFunc.CONTAIN_ALL]: RuleFuncValue.SELECT_MULTIPLE,
          [RuleFunc.EMPTY]: RuleFuncValue.NULL,
          [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
        }
      };
    }
    return {
      subType: "account",
      funcInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.CONTAIN_ANY]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      }
    }
  }
}

