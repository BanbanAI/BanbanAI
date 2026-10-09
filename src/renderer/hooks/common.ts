import { App } from "vue";
import * as Pinia from "pinia";
import piniaPersistPlugin from "pinia-plugin-persist";

// window.requestIdleFrame polyfill
import "requestidlecallback-polyfill";
import "./polyfill";

import "@renderer/styles/index.scss";
import "@renderer/assets/iconfont/iconfont.css";
import "./debugger";
import "./hacks";

import * as ElementPlus from "element-plus";
import { loadIcons } from "./icons";
import i18next from "i18next";
import { resolveElementPlusLocale } from "@renderer/utils/elementPlusLocale";
import SwitchButton from "../components/SwitchButton.vue";

(window as any).__APP_VERSION__ = __APP_VERSION__;
window.inCloudHost = () => false;

const pinia = Pinia.createPinia();
pinia.use(piniaPersistPlugin);

export const initApp = (app: App) => {
  app.use(pinia);
  app.use(ElementPlus, {
    emptyValues: [null, undefined],
    locale: resolveElementPlusLocale(i18next.resolvedLanguage || i18next.language),
    message: {
      showClose: true,
    },
  });
  app.component("SwitchButton", SwitchButton);
  app.mount("#app");
  loadIcons(app);
}
