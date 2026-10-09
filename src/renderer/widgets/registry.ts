import type { WidgetMeta } from "@renderer/b2/types";
import manifestData from "@common/widgets/manifests.json";
import { getBuiltinWidgetAssetByName } from "./assets";

type WidgetModule = {
  default?: unknown;
  component?: any;
  TheWidget?: any;
  resource?: Record<string, unknown>;
  triggers?: Record<string, unknown>;
  actions?: Record<string, unknown>;
};

const widgetFiles = import.meta.glob<WidgetModule>("./**/index.ts");

const entries = new Map<string, {
  manifest: WidgetMeta;
  load: () => Promise<WidgetModule>;
}>();

for (const widgetConfig of manifestData) {
  const name = widgetConfig.name;
  const packagePath = `./${widgetConfig.path}`;
  const widgetPath = `${packagePath}/index.ts`;
  const load = widgetFiles[widgetPath];
  if (!load) continue;

  entries.set(name, {
    manifest: {
      name,
      version: widgetConfig.version,
      displayName: widgetConfig.displayName,
      super: widgetConfig.super,
      icon: getBuiltinWidgetAssetByName(widgetConfig.icon),
      cover: getBuiltinWidgetAssetByName(widgetConfig.cover),
      show: widgetConfig.show,
      virtualPath: `./widgets/${widgetConfig.path}`,
      dir: packagePath,
    },
    load,
  });
}

export function getBuiltinWidgetManifest(id: string): WidgetMeta | undefined {
  return entries.get(id)?.manifest;
}

export function getBuiltinWidgetIds(): string[] {
  return [...entries.keys()];
}

export async function loadBuiltinWidget(id: string): Promise<WidgetModule | undefined> {
  const entry = entries.get(id);
  return entry ? entry.load() : undefined;
}

export function getBuiltinWidgetManifests(): WidgetMeta[] {
  return [...entries.values()].map(({ manifest }) => manifest);
}

