import { AbstractFormLayout, FormElement } from "@renderer/b2/controllers/form";
import { WidgetSoul } from "@common/types/project";
import { ShallowRef, nextTick, ref, watch } from "vue";
import { MultipleTabs } from "../multipleTabs/multipleTabs";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";

export class TabPanel extends AbstractFormLayout {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }

  private _title = ref<string>(this.name)

  get title() {
    return this._title.value
  }

  set title(val) {
    this._title.value = val
  }

  private _fieldsAuth = ref({});
  private _appliedFieldsAuthSignature = "";
  private getFieldsAuthSignature(fieldsAuth) {
    if (!fieldsAuth || typeof fieldsAuth !== "object") return "";
    const keys = Object.keys(fieldsAuth);
    if (!keys.length) return "";
    return keys.sort().map(key => `${key}:${fieldsAuth[key]}`).join("|");
  }
  private applyWidgetAuthIfNeeded(fieldsAuth) {
    const signature = this.getFieldsAuthSignature(fieldsAuth);
    if (!signature) return;
    if (this._appliedFieldsAuthSignature === signature) return;
    super.setWidgetAuth(fieldsAuth);
    this._appliedFieldsAuthSignature = signature;
  }
  setWidgetAuth(fieldsAuth) {
    this._fieldsAuth.value = fieldsAuth;
    this.applyWidgetAuthIfNeeded(fieldsAuth);
  }

  initAfterConstructor() {
    super.initAfterConstructor();
    this.status.isMounted = true;
    const widgets = this.container.widgets;
    this.effectScope.run(() => {
      watch(() => this.visible, (value) => {
        if (value) {
          this.applyWidgetAuthIfNeeded(this._fieldsAuth.value);
        }
        this.status.isVisible = value;
        this.enabledTransient = value;
      }, { immediate: true })
    })
  }

  isCreateField(): boolean {
    return false
  }

  async addWidget(soul: WidgetSoul, index: number) {
    return await this.container.addWidget(soul, index);
  }

  async moveWidget(widget: FormElement, index: number) {
    if (!widget) return;
    const soul = widget.detach();
    // return await this.container.addWidget(soul, index);

    return await this.container.insertByIndex([soul], index);
  }

  /** 当需要校验值时调用此方法 */
  async validate() {
    this._validationError.value = null;
    try {
      await this.doValidate();
    } catch(err) {
      this._validationError.value = err;
    }
  }
  private _validationError: ShallowRef<Error> = ref();
  get validationError(): string {
    return this._validationError.value?.message;
  }
  set validationError(val: Error) {
    this._validationError.value = val;
  }
  /**
   * 校验当前值，校验不通过时，直接throw error
   * 由字类实现该方法
   * @throws Error
   */
  protected async doValidate() {
  }

  get visible() {
    return (this.parent as unknown as MultipleTabs).tabPanel === this && !this.isHidden;
  }
  get shouldLoad() {
    return this.visible;
  }

  isReady() {
    if(this.container && !this.container?.hasWidgetSynced()) return false;
    for(const widget of this.widgets){
      if(!widget.isReady()) return false;
    }
    return true;
  }

  async bringChildIntoView(element: FormElement) {
    if (!this.visible) {
      (this.parent as unknown as MultipleTabs).activePanel(this);
      await nextTick();
    }
    return super.bringChildIntoView(element);
  }
}

