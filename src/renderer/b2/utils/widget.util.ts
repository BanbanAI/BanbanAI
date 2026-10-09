import { ConcreteComponent } from "vue";
import { BaseWidget } from "../controllers/widget";
import { markDirty, buildElement } from "./element.util";
import { WidgetMeta } from "../types";
import { isEmpty } from "@common/utils/object";
import { ProjectBody } from "@common/types/project";
import i18next, { ResourceKey } from "i18next";
import { collectWidgetTypesFromProject, type WidgetLoadOptions, getProjectFirstScreenBoardIds } from "./widget-load.util";
import { getBuiltinWidgetManifest, loadBuiltinWidget } from "@renderer/widgets/registry";
import { normalizeWidgetI18nResource } from "@renderer/widgets/i18n";

type LoadedWidget = {
  component?: ConcreteComponent,
  TheWidget?: typeof BaseWidget,
  resource?: { [language: string]: ResourceKey },
}

const allWidgets: {
  [key: string]: {
    widget: LoadedWidget,
    dirty?: boolean,
  }
} = {};
const loadingWidgets: {
  [key: string]: Promise<LoadedWidget | undefined>
} = {};

const All3DWidgets = [
  "widget.3d.city-builder"
];
export type LoadWidgetsInProjectOptions = WidgetLoadOptions;
export { getProjectFirstScreenBoardIds };
export function is3DWidget(id: string) {
  return All3DWidgets.includes(id);
}

export function resolveWidget(id: string): LoadedWidget {
  if (allWidgets[id]?.dirty) {
    console.warn("resolveWidget got a dirty widget", id);
  }
  return allWidgets[id]?.widget || {};
}

export async function markWidgetDirty(id: string): Promise<void> {
  const manifest = await getWidgetInfo(id);
  if (isEmpty(manifest)) {
    console.warn("cannot get widget info", id);
    return;
  }
  if (manifest.super) {
    await markWidgetDirty(manifest.super);
  }
  if (allWidgets[id]) {
    allWidgets[id].dirty = true;
  }
  markDirty(id);
}

export async function loadWidgetsInProject(project: ProjectBody, options: LoadWidgetsInProjectOptions = {}) {
  const soulTypes = collectWidgetTypesFromProject(project, options);
  const promises = [];
  for (const type of soulTypes) {
    promises.push(loadWidget(type))
  }
  return Promise.all(promises);
}

export async function loadWidget(id: string, loadingStack: string[] = []): Promise<LoadedWidget> {
  if (loadingStack.includes(id)) {
    throw new Error(`Circular builtin widget dependency: ${[...loadingStack, id].join(" -> ")}`);
  }
  if (allWidgets[id] && !allWidgets[id].dirty) {
    return allWidgets[id].widget;
  }
  if (loadingWidgets[id]) {
    return await loadingWidgets[id];
  }

  loadingWidgets[id] = (async () => {
    const manifest = await getWidgetInfo(id);
    if (isEmpty(manifest)) {
      console.warn("cannot get widget info", id);
      return;
    }

    if (manifest.super) {
      await loadWidget(manifest.super, [...loadingStack, id]);
    }
    let loadedWidget: LoadedWidget;
    try {
      loadedWidget = await loadBuiltinWidget(id) as LoadedWidget;
      if (!loadedWidget) {
        throw new Error(`Builtin widget not found: ${id}`);
      }
    } catch(err) {
      console.warn(`error occurs when loading ${id}`, err);
      return;
    }
    const { TheWidget } = loadedWidget;

    Object.defineProperty(TheWidget, "namespace", {
      enumerable: false,
      configurable: true,
      writable: false,
      value: id,
    });
    const resource = normalizeWidgetI18nResource(TheWidget.resource);
    for (const lng in resource) {
      if (i18next.hasResourceBundle(lng, TheWidget.namespace)) {
        i18next.removeResourceBundle(lng, TheWidget.namespace);
      }
      i18next.addResourceBundle(lng, TheWidget.namespace, resource[lng]);
    }

    Object.defineProperty(TheWidget.prototype, "type", {
      enumerable: false,
      configurable: true,
      writable: false,
      value: id,
    });
    Object.defineProperty(TheWidget.prototype, "virtualPath", {
      enumerable: false,
      configurable: true,
      writable: false,
      value: manifest.virtualPath,
    });
    Object.defineProperty(TheWidget.prototype, "defaultName", {
      enumerable: false,
      configurable: true,
      get: () => i18next.t("defaultName", {
        ns: id,
        defaultValue: manifest.displayName,
      }),
    });
    Object.defineProperty(TheWidget.prototype, "version", {
      enumerable: false,
      configurable: true,
      writable: false,
      value: manifest.version,
    });
    if(manifest.icon) {
      Object.defineProperty(TheWidget.prototype, "icon", {
        enumerable: false,
        configurable: true,
        writable: false,
        value: manifest.icon,
      });
    }
    buildElement(TheWidget);
    allWidgets[id] = {
      widget: loadedWidget,
    };
    return allWidgets[id].widget;
  })();

  try {
    return await loadingWidgets[id];
  } finally {
    delete loadingWidgets[id];
  }
}

async function getWidgetInfo(id: string): Promise<WidgetMeta | undefined> {
  return getBuiltinWidgetManifest(id);
}
