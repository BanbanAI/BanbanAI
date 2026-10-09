import i18next from "i18next";

export function normalizeWidgetI18nResource(resource: Record<string, any> = {}) {
  return resource.default || resource;
}

export function createWidgetI18n(namespace?: string) {
  const fixedT = namespace ? i18next.getFixedT(null, namespace) : i18next.t.bind(i18next);
  return new Proxy(i18next, {
    get(target, property, receiver) {
      if (property === "t") return fixedT;
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export default i18next;
