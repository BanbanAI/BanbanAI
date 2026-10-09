type EditorLike = {
  inputValue?: any;
};

export const shouldInitializeNocodeEditorHost = (
  options: {
    initialized: boolean;
    widget?: EditorLike | null;
  },
) => {
  return !options.initialized && Boolean(options.widget);
};
