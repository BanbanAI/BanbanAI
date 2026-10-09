import { OptionTableUID } from "@common/types/project";
import { DefinedOptions, OptionTableValue } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { FORM_VIEW_CONFIG } from "@renderer/types/inject";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { inject, type ComputedRef } from "vue";

type FormViewConfig = {
  buttons?: {
    submit?: { visible?: boolean; label?: string };
    saveDraft?: { visible?: boolean; label?: string };
    stash?: { visible?: boolean; label?: string };
    continuousSubmit?: { visible?: boolean; label?: string; defaultChecked?: boolean };
    saveCurrentContent?: { visible?: boolean; label?: string; defaultChecked?: boolean };
    viewDataAfterSubmit?: { visible?: boolean; label?: string };
  };
  submitBehavior?: {
    successMode?: "successPage" | "resetForm" | "keepCurrentContent";
    successText?: string;
  };
  autoSubmit?: {
    enabled?: boolean;
    rules?: Array<{
      id: string;
      enabled?: boolean;
      fieldUid?: string;
      fieldScope?: "mainForm";
      fieldEnterSubmit?: boolean;
      mobileScanSubmit?: boolean;
      requireChanged?: boolean;
      requireNonEmpty?: boolean;
      blockWhenUploading?: boolean;
      blockWhenInvalid?: boolean;
    }>;
  };
}

export type SubmitFormFieldsAuth = Record<string, number> | "all";

export class SubmitForm extends Widget {
  static resource = resource;

  get defaultName() {
    return i18next.t("defaultName");
  }
  private injectedFormViewConfig = inject<ComputedRef<FormViewConfig | undefined> | undefined>(FORM_VIEW_CONFIG as any, undefined);
  public fieldsAuth: SubmitFormFieldsAuth = "all";

  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          fold: "unfold",
          children: [
            {
              name: "fluid-size",
              children: [
                {
                  name: "fluid-height-type",
                  default: "adaptive",
                },
              ],
            },
          ]
        },
      },
      data: {
        fields: {
          fold: "unfold",
          children: [
            {
              name: "form-table",
              alias: i18next.t("formLabel"),
              type: "table(max=1)",
            },
          ]
        },
      }
    }, ...super.defineOptions()]
  }

  get formTableUID(): OptionTableUID {
    return this.getOption<OptionTableValue[]>("form-table")?.[0]?.uid;
  }

  get formViewConfig(): FormViewConfig | undefined {
    return this.injectedFormViewConfig?.value;
  }

  setFieldsAuth(fieldsAuth?: SubmitFormFieldsAuth) {
    this.fieldsAuth = fieldsAuth || "all";
  }
}
