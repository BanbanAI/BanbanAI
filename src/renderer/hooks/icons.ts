import { App } from "vue";
import * as svg from '@element-plus/icons-vue';

export const loadIcons = (app: App) => {
  const icons = svg;
  for (const i in icons) {
    app.component(`i-ep-${icons[i].name}`, icons[i]);
  }
}