import { EditorState } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, MatchDecorator, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { FormElement } from "@renderer/b2/controllers/form";
import { basicSetup } from "codemirror";
import { ref, shallowRef } from "vue";

type TagField = Pick<FormElement, "uid" | "title">;

export const tagReg = /\{\s*:(.*?)\s*\}/g;
const placeholderTagMatcher = new MatchDecorator({
  regexp: tagReg,
  decoration: (match) => {
    return Decoration.replace({ widget: new PlaceholderTag(match[1]) });
  },
});
class PlaceholderTag extends WidgetType {
  id: string = "";
  text: string = "";
  constructor(text: string) {
    super();
    if (text) {
      const [id, ...titles] = text.split(".");
      const txt = titles.join(".");
      if (id && txt) {
        this.text = txt;
        this.id = id;
      }
    }
  }
  eq(other: PlaceholderTag) {
    return this.text == other.text;
  }
  toDOM() {
    let elt = document.createElement("span");
    if (!this.text) return elt;
    elt.className = "cm-tag";
    elt.textContent = this.text;
    return elt;
  }
  ignoreEvent() {
    return true;
  }
}
export const placeholderTag = ViewPlugin.fromClass(
  class {
    placeholders: DecorationSet;
    constructor(view: EditorView) {
      this.placeholders = placeholderTagMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.placeholders = placeholderTagMatcher.updateDeco(
        update,
        this.placeholders
      );
    }
  },
  {
    decorations: (v) => v.placeholders,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => {
        return view.plugin(plugin)?.placeholders || Decoration.none;
      }),
  }
);


const baseTheme = EditorView.baseTheme({
  ".cm-tag": {
    padding: "6px 8px",
    marginLeft: "3px",
    marginRight: "3px",
    backgroundColor: "var(--color-primary-light-7)",
    borderRadius: "4px",
    "white-space": "nowrap",
  },
});

export const useCodemirror = () => {
  const code = ref("");
  const view = shallowRef<EditorView>();
  const editorRef = ref<InstanceType<typeof HTMLDivElement>>();
  const extensions = [
    placeholderTag,
    baseTheme,
    EditorView.lineWrapping,
    basicSetup,
  ];

  const init = () => {
    if (editorRef.value) {
      view.value = new EditorView({
        parent: editorRef.value,
        state: EditorState.create({
          doc: code.value,
          extensions: extensions,
        }),
      });
      setTimeout(() => {
        view.value?.focus();
      }, 0);
    }
  };

  const destroyed = () => {
    view.value?.destroy();
    view.value = undefined;
  };

  const insertTag = (element: TagField) => {
    if (view.value) {
      let content = `{:${element.uid}.${element.title}}`;
      const selection = view.value.state.selection;
      if (!selection.main.empty) {
        const from = selection.main.from;
        const to = selection.main.to;
        const anchor = from + content.length;
        const transaction = view.value!.state.update({
          changes: { from, to, insert: content },
          selection: {
            anchor,
          },
        });
        view.value.dispatch(transaction);
      } else {
        const pos = selection.main.head;
        const anchor = pos + content.length;
        const transaction = view.value.state.update({
          changes: { from: pos, to: pos, insert: content },
          selection: {
            anchor: anchor,
          },
        });
        view.value.dispatch(transaction);
      }
      setTimeout(() => {
        view.value?.focus();
      }, 0);
    }
  };

  return {
    code,
    view,
    editorRef,
    init,
    destroyed,
    insertTag,
  };
};
