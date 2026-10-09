const assetUrls = import.meta.glob<string>("../assets/widgets/*", {
  eager: true,
  as: "url",
});

export function getBuiltinWidgetAssetByName(fileName?: string): string {
  return fileName ? assetUrls[`../assets/widgets/${fileName}`] || "" : "";
}

export function getBuiltinWidgetAsset(widgetId: string, relativePath: string): string {
  const assetName = `${widgetId.replace(/\./g, "-")}-${relativePath
    .replace(/^static[\\/]/, "")
    .replace(/[\\/]/g, "-")}`;
  return getBuiltinWidgetAssetByName(assetName);
}
