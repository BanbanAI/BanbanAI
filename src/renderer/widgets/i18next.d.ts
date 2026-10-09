declare module "@renderer/widgets/i18next" {
  import type { i18n, TFunction } from "i18next";

  const i18next: i18n;
  export const $t: TFunction;
  export default i18next;
}
