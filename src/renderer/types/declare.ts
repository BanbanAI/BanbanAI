import { TFunction, i18n } from "i18next";

export {}
declare module "vue" {
  interface ComponentCustomProperties {
    $p: (key: string) => any
    $t: TFunction;
    $i18next: i18n;
  }
}

declare global {
  function $p(key: string): any;
  interface MouseEvent {
    readonly layerX: number;
    readonly layerY: number;
    currentTarget: HTMLElement;
    target: HTMLElement;
    composedPath(): HTMLElement[];
  }
  function onCloudRenderOpenLink(url: string, openWay: '_self'|'_blank'|'_parent'|'_top'|'browser'):void;
  function setTimeout(callback: () => void, ms?: number) : number;
  function setInterval(callback: () => void, ms?: number) : number;
  function inCloudHost(): boolean;
  interface Window {
    runtimeInfo?: { inClient?: boolean },
    hide?: () => void,
  }
}