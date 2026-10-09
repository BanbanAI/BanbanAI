import type { ConcreteComponent } from "vue";
import { getOptionComponentName } from "./option.util";

export type OptionComponent = ConcreteComponent & {
  isBigContent?: (args: Record<string, string>) => boolean;
};

type OptionModule = {
  default: OptionComponent;
};

const optionModules = import.meta.glob<OptionModule>("../options/*Option.vue");
const optionComponentCache = new Map<string, Promise<OptionComponent>>();

const loadOptionModule = (
  componentName: string,
  loader: () => Promise<OptionModule>,
): Promise<OptionComponent> => {
  const cached = optionComponentCache.get(componentName);
  if (cached) {
    return cached;
  }

  const promise = loader()
    .then((module) => module.default)
    .catch((error) => {
      optionComponentCache.delete(componentName);
      throw error;
    });
  optionComponentCache.set(componentName, promise);
  return promise;
};

const loadUnknownOption = () => loadOptionModule(
  "UnknownOption",
  optionModules["../options/UnknownOption.vue"],
);

export function loadOptionComponent(parsedType: string): Promise<OptionComponent> {
  const componentName = getOptionComponentName(parsedType || "unknown");
  const loader = optionModules[`../options/${componentName}.vue`];
  if (!loader) {
    return loadUnknownOption();
  }

  const cached = optionComponentCache.get(componentName);
  if (cached) {
    return cached;
  }

  const promise = loader()
    .then((module) => module.default)
    .catch(() => {
      optionComponentCache.delete(componentName);
      return loadUnknownOption();
    });
  optionComponentCache.set(componentName, promise);
  return promise;
}
