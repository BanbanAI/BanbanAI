import { DefinedOptions } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import { Ref, ref, defineAsyncComponent } from "vue";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";

export class ImageTextShow extends FormElement {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }

  protected _inputValue: Ref<string> = ref();
  get defaultValue(): string {
    return this.getOption("image-text-content");
  }
  public get inputValue() {
    return this._inputValue.value ?? this.initialValue ?? this.defaultValue;
  }
  public set inputValue(value: string) {
    this._inputValue.value = value;
  }
  initAfterConstructor() {
    super.initAfterConstructor();
  }
  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "show-title",
                default: false,
                visible: false,
              },
              {
                name: "title-text",
                visible: false,
              },
              {
                name: "show-description",
                visible: false,
              },
              {
                name: "description-content",
                visible: false,
              },
              {
                name: "image-text-content",
                alias: i18next.t("content"),
                type: "dialog",
                dialog: {
                  component: defineAsyncComponent(() => import("@renderer/b2/ShowDescriptionDialog.vue")),
                  buttonText: i18next.t("editContent"),
                },
              }
            ]
          },
          fieldProperty: {
            children: [
              {
                name: "is-readonly",
                visible: false
              },
              {
                name: 'is-hidden',
                alias: i18next.t("hidden"),
                default: false,
                type: "boolean",
              },
            ]
          },
          fieldsControl: {
            visible: false,
          },
          validation: {
            visible: false,
          },
          linkForm: {
            visible: false,
          }
        },
      },
      ...super.defineOptions()
    ]
  }

  get supportFixedWidth() {
    return false;
  }

  isCreateField() {
    return false;
  }
}
