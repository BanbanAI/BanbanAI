type I18nOptionLabelRefresh = (type: string, resolve: (value: string) => string) => void;

let refreshHandler: I18nOptionLabelRefresh | undefined;

export function registerI18nOptionLabelRefresh(handler: I18nOptionLabelRefresh) {
  refreshHandler = handler;
}

export function refreshLoadedI18nOptionLabels(type: string, resolve: (value: string) => string) {
  refreshHandler?.(type, resolve);
}
