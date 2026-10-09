export function resolveRendererManualChunk(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, "/");

  if (
    normalizedId.includes("vite/preload-helper")
    || normalizedId.includes("commonjsHelpers.js")
  ) {
    return "vite-runtime";
  }

  const iconCollection = normalizedId.match(/(?:~icons|virtual:icons)\/([^/?]+)/)?.[1];
  if (iconCollection) {
    return `icons-${iconCollection.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }

  if (!normalizedId.includes("/node_modules/")) return;

  if (
    normalizedId.includes("/node_modules/vue/")
    || normalizedId.includes("/node_modules/@vue/")
    || normalizedId.includes("/node_modules/vue-router/")
    || normalizedId.includes("/node_modules/element-plus/")
    || normalizedId.includes("/node_modules/@element-plus/")
    || normalizedId.includes("/node_modules/@venjs/")
    || normalizedId.includes("/node_modules/venjs/")
    || normalizedId.includes("/node_modules/@vueuse/")
    || normalizedId.includes("/node_modules/i18next/")
    || normalizedId.includes("/node_modules/lodash")
    || normalizedId.includes("/node_modules/vue-demi/")
    || normalizedId.includes("/node_modules/@popperjs/")
    || normalizedId.includes("/node_modules/@ctrl/tinycolor/")
    || normalizedId.includes("/node_modules/async-validator/")
    || normalizedId.includes("/node_modules/memoize-one/")
    || normalizedId.includes("/node_modules/normalize-wheel-es/")
    || normalizedId.includes("/node_modules/@floating-ui/")
    || normalizedId.includes("/node_modules/axios/")
  ) {
    return "vendor-core";
  }
  if (
    normalizedId.includes("/node_modules/@codemirror/")
    || normalizedId.includes("/node_modules/codemirror/")
    || normalizedId.includes("/node_modules/@lezer/")
    || normalizedId.includes("/node_modules/vue-codemirror6/")
  ) {
    return "vendor-codemirror";
  }
  if (
    normalizedId.includes("/node_modules/echarts/")
    || normalizedId.includes("/node_modules/echarts-")
    || normalizedId.includes("/node_modules/claygl/")
    || normalizedId.includes("/node_modules/zrender/")
  ) {
    return "vendor-charts";
  }
  if (normalizedId.includes("/node_modules/xlsx/") || normalizedId.includes("/node_modules/exceljs/")) {
    return "vendor-spreadsheet";
  }
  if (normalizedId.includes("/node_modules/@vue-office/")) {
    return "vendor-vue-office";
  }
  if (normalizedId.includes("/node_modules/docx-preview/")) {
    return "vendor-docx-preview";
  }
  if (normalizedId.includes("/node_modules/pdfjs-dist/")) {
    return "vendor-pdf";
  }
  if (
    normalizedId.includes("/node_modules/@wangeditor-next/")
    || normalizedId.includes("/node_modules/md-editor-v3/")
    || normalizedId.includes("/node_modules/mermaid/")
  ) {
    return "vendor-rich-text";
  }
  if (normalizedId.includes("/node_modules/ag-grid")) {
    return "vendor-grid";
  }
  if (normalizedId.includes("/node_modules/mathjs/")) {
    return "vendor-math";
  }
  if (normalizedId.includes("/node_modules/bwip-js/")) {
    return "vendor-barcode";
  }
  if (normalizedId.includes("/node_modules/vuedraggable/") || normalizedId.includes("/node_modules/sortablejs/")) {
    return "vendor-drag";
  }
  return "vendor-misc";
}
