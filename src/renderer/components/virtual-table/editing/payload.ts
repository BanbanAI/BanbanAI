export const normalizeVirtualTableEditorEventValue = (payload: any) => {
  if (payload && typeof payload === "object") {
    if ("nextValue" in payload) {
      return payload.nextValue;
    }
    if ("value" in payload) {
      return payload.value;
    }
  }
  return payload;
};
