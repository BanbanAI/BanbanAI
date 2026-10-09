import { WidgetType, MatchDecorator, Decoration, ViewPlugin, DecorationSet, EditorView, ViewUpdate, keymap } from "@codemirror/view";
import { bracketMatching } from "@codemirror/language"
import { indentWithTab } from "@codemirror/commands";
import { minimalSetup } from "codemirror";
import { autocompletion } from "@codemirror/autocomplete";
import { EditorState, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { checkChineseQuotesInFormulaByScan } from "./utils";
import i18next from "i18next";
import { FnMeta, ScanContext, scanFormula, ScanHooks } from "@common/utils";
import { fnMetaField } from "./fnMeta";

//标签
class PlaceholderTag extends WidgetType {
    text: string = "";
    uid: string = ""
    active: boolean = false
    constructor(uid: string,text: string, active: boolean = false) {
        super()
        this.text = text
        this.uid = uid
        this.active = active
    }

    eq(other: PlaceholderTag) { return other.text == this.text  && other.uid === this.uid && other.active === this.active}

    private createSegment(className: string, text: string) {
        const segment = document.createElement("span");
        segment.className = className;
        segment.textContent = text;
        return segment;
    }

    toDOM() {
        const elt = document.createElement("span");
        if (!this.text) return elt;
        elt.className = "cm-tag";
        elt.title = this.text;

        const openParenIndex = this.text.indexOf("(");
        const closeParenIndex = this.text.lastIndexOf(")");
        const isAggregateToken = openParenIndex > 0 && closeParenIndex === this.text.length - 1;

        if (!isAggregateToken) {
            elt.textContent = this.text;
            return elt;
        }

        const fnText = this.text.slice(0, openParenIndex).trim();
        const fieldText = this.text.slice(openParenIndex + 1, closeParenIndex).trim();

        if (!fnText || !fieldText) {
            elt.textContent = this.text;
            return elt;
        }

        elt.classList.add("cm-tag--aggregate");
        if (this.active) {
            elt.classList.add("cm-tag--active");
        }
        elt.appendChild(this.createSegment("cm-tag__fn", fnText));
        elt.appendChild(this.createSegment("cm-tag__paren", "("));
        elt.appendChild(this.createSegment("cm-tag__field", fieldText));
        elt.appendChild(this.createSegment("cm-tag__paren", ")"));
        return elt;
    }

    ignoreEvent() { return false }
}

class HiddenFnIdWidget extends WidgetType {
    toDOM() {
        const elt = document.createElement("span");
        elt.style.display = "none";
        return elt;
    }

    ignoreEvent() { return true }
}

export type PlaceholderTagMeta = {
    uid: string,
    text: string,
    from: number,
    to: number,
}

const buildPlaceholderDecorations = (view: EditorView) => {
    const builder = new RangeSetBuilder<Decoration>();
    const text = view.state.doc.toString();
    const activeTag = view.state.field(tagActiveField, false);
    const regex = /\[\[([a-zA-Z0-9.:_]+(?:\.[a-zA-Z0-9_]+)*),([^\]]+?)\]\]/gu;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text))) {
        const from = match.index;
        const to = from + match[0].length;
        const isActive = Boolean(activeTag && activeTag.from === from && activeTag.to === to);
        builder.add(from, to, Decoration.replace({
            widget: new PlaceholderTag(match[1], match[2], isActive)
        }));
    }

    return builder.finish();
};
const placeholderTag = ViewPlugin.fromClass(
    class {
        placeholders: DecorationSet;
        constructor(view: EditorView) {
            this.placeholders = buildPlaceholderDecorations(view);
        }
        update(update: ViewUpdate) {
            this.placeholders = buildPlaceholderDecorations(update.view);
        }
    },
    {
        decorations: instance => instance.placeholders,
        provide: plugin => EditorView.atomicRanges.of(view => {
            return view.plugin(plugin)?.placeholders || Decoration.none
        })
    }
);

function getTagMetaByPos(view: EditorView, pos: number): PlaceholderTagMeta | null {
    const text = view.state.doc.toString()
    const regex = /\[\[([a-zA-Z0-9.:_]+(?:\.[a-zA-Z0-9_]+)*),([^\]]+?)\]\]/gu

    let match: RegExpExecArray | null
    while ((match = regex.exec(text))) {
        const from = match.index
        const to = from + match[0].length
        if (pos >= from && pos <= to) {
            return {
                uid: match[1],
                text: match[2],
                from,
                to,
            }
        }
    }

    return null
}

const tagsPlugin = (onClick?: Function) => ViewPlugin.fromClass(
    class {},
    {
        eventHandlers: {
            mousedown(event, view) {
                const coords = { x: event.clientX, y: event.clientY }
                const pos = view.posAtCoords(coords)
                view.focus()

                if (pos == null) return

                const tagMeta = getTagMetaByPos(view, pos)
                onClick?.({ view, tagMeta, pos })
            }
        }
    }
)

const fnIdMatcher = new MatchDecorator({
    regexp: /<([a-zA-Z0-9_-]+)>/g,
    decoration: () => {
        return Decoration.replace({
            widget: new HiddenFnIdWidget()
        });
    },
});
const hideFnIdPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = fnIdMatcher.createDeco(view);
        }
        update(update: ViewUpdate) {
            this.decorations = fnIdMatcher.updateDeco(
                update,
                this.decorations
            );
        }
    },
    {
        decorations: instance => instance.decorations,
        provide: plugin => EditorView.atomicRanges.of(view => {
            return view.plugin(plugin)?.decorations || Decoration.none
        })
    }
);

//函数
const keywordsPlugin = (keywords, onClick) => {

  const keywordPattern = new RegExp(
    `\\b(${keywords.join('|')})\\b`,
    'g'
  )

  const matcher = new MatchDecorator({
    regexp: keywordPattern,
    decoration: () => {
      return Decoration.mark({
        class: "cm-keyword",
      })
    }
  })

  return ViewPlugin.fromClass(
    class {
      decorations

      constructor(view) {
        this.decorations = matcher.createDeco(view)
      }

      update(update) {
        this.decorations = matcher.updateDeco(update, this.decorations)
      }
    },
    {
      decorations: v => v.decorations,

      eventHandlers: {
        mousedown(event, view) {
          const coords = { x: event.clientX, y: event.clientY }
          const pos = view.posAtCoords(coords)
          //手动移动光标
          view.focus()
          view.dispatch({
            selection: { anchor: pos },
            scrollIntoView: true
          })

          if (pos == null) return

          const fnMetas = view.state.field(fnMetaField)

          const fnMeta = fnMetas.find(meta =>
            pos >= meta.nameFrom && pos <= meta.nameTo
          )

          onClick?.({ view, fnMeta, pos })
        }
      }
    }
  )
}


// 中文引号高亮插件
const chineseQuotesPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet
        constructor(view: EditorView) {
            this.decorations = this.getDecorations(view);
        }
        update(update: ViewUpdate) {
            this.decorations = this.getDecorations(update.view);
        }
        getDecorations(view: EditorView) {
            const decorations = [];
            const text = view.state.doc.toString();
            
            // 使用utils.ts中的函数检测中文引号
            const chineseQuotes = checkChineseQuotesInFormulaByScan(text);
            
            // 为每个检测到的中文引号创建装饰
            chineseQuotes.forEach(quote => {
                decorations.push(
                    Decoration.mark({
                        class: "cm-chinese-quote-error"
                    }).range(quote.position, quote.position + 1)
                );
            });
            
            return Decoration.set(decorations);
        }
    },
    {
        decorations: instance => instance.decorations
    }
);

//主题颜色
const baseTheme = EditorView.baseTheme({
    ".cm-tag": {
        paddingLeft: "5px",
        paddingRight: "5px",
        margin: "2px",
        fontSize: "14px",
        color: "#2f7deb",
        backgroundColor: "#eaf2fd",
        height: "24px",
        lineHeight: "24px",
        borderRadius: "2px"
    },
    ".cm-tag--aggregate": {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        paddingLeft: "0",
        paddingRight: "0",
        backgroundColor: "transparent",
    },
    ".cm-tag--aggregate .cm-tag__fn": {
        borderRadius: "4px",
        padding: "0 8px",
        lineHeight: "24px",
        height: "24px",
        display: "inline-flex",
        alignItems: "center",
    },
    ".cm-tag--aggregate .cm-tag__field": {
        borderRadius: "4px",
        padding: "0 8px",
        lineHeight: "24px",
        height: "24px",
        display: "inline-flex",
        alignItems: "center",
    },
    ".cm-tag--aggregate .cm-tag__paren": {
        fontSize: "14px",
        lineHeight: "24px",
    },
    ".cm-keyword": {
        color: "rgb(255, 77, 79)",
        backgroundColor: "rgb(255, 235, 232)",
        margin: "2px",
        display: "inline-block",
        height: "24px",
        lineHeight: "24px",
        padding: "0 4px",
        borderRadius: "2px",
    },
    ".cm-keyword:hover": {
        cursor: 'var(--cursor-pointer)',
    },
    ".cm-keyword:has(.cm-fn-scope-bg)": {
        backgroundColor: "rgb(187, 226, 255)",
        margin: 0,
        padding: "0 2px 0 4px",
        height: "32px",
        lineHeight: "32px",
        borderRadius: "4px 0 0 4px",
    },
    ".cm-keyword .cm-fn-scope-bg": {
        backgroundColor: "rgb(255, 235, 232)",
        display: "inline-block",
        height: "24px",
        lineHeight: "24px",
        padding: "0 4px",
        borderRadius: "2px",
    },
    ".cm-keyword:not() .cm-fn-scope-bg:has()": {
        
    },
    ".cm-chinese-quote-error": {
        color: "#ff0000",
        backgroundColor: "#ffe6e6"
    },
    "&.cm-content .cm-string": {
        margin: "2px",
    },
    "&.cm-content .cm-bracket": {
        margin: "2px",
    },
    "&.cm-focused": {
        outline: "none"
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: "var(--text-color-regular)",
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
        fontSize: "14px",
        "& completion-section": {
            height: "32px",
            lineHeight: "32px !important",
            color: "#525967",
            opacity:"1 !important",
            padding:"0px !important",
            borderBottom: "unset !important",
        },
        "& ul": {
            maxWidth: "236px !important",
            minWidth: "unset !important",
            padding: "4px !important",
            maxHeight: "20em !important",
            "&::-webkit-scrollbar-thumb": {
                background: "#858789"
            }
        },
        "& li":{
            display: "flex",
            flexDirection: "column",
            height: "52px",
            justifyContent: "space-between",
            padding: "6px 4px !important",
            borderRadius: "3px",
            "&[aria-selected]": {
                background: "#a6a6a8 !important",
            },
            "& .cm-completionIcon": {
                display: "none"
            },
            "& .cm-completionLabel": {
                fontSize: "14px",
                lineHeight: "20px",
                color:"#141E31",
                "& .cm-completionMatchedText":{
                    textDecoration: "none",
                    color: "#00B899"
                }
            },
            "& .cm-completionDetail": {
                fontSize: "14px",
                lineHeight: "16px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginLeft: "0px",
                fontStyle: "normal",
                color: "#B5B8BE"
            },
            "&.tag-completion": {
                flexDirection: "row",
                height: "32px",
                padding: "0px 4px !important",
                alignItems: "center",
                "& .cm-completionDetail": {
                    borderRadius: "40px",
                    padding: "2px 4px",
                    backgroundColor: "#313e51",
                    marginLeft: "8px"
                }
            },
        }
    },
    ".cm-placeholder": {
        color: "var(--text-color-placeholder)"
    },
    "&.cm-editor": { 
        height: "100%",
    },
    "&.cm-scroller": {
      overflowY: "auto",
      overflowX: "hidden",
    },
    "&.cm-content": {
        minHeight: "100%", // 确保内容区域至少充满编辑器
        flex: 1,
        letterSpacing: "1px",
    },
    // 或者更精确地控制
    ".cm-line": {
        letterSpacing: "1px",
        minHeight: "32px",
        lineHeight: "32px",
    },
    ".cm-fn-scope-bg": {
        backgroundColor: "rgb(187, 226, 255)",
        display: "inline-block",
        height: "32px",
        lineHeight: "32px",
    },
    ".cm-fn-scope-bg:last-child": {
        borderRadius: "0 4px 4px 0",
        paddingRight: "4px",
    },
    ".cm-matchingBracket:not(:last-child) .cm-fn-scope-bg:last-child": {
        borderRadius: "0",
        paddingRight: "0",
    },
    ".cm-keyword:has(.cm-fn-scope-bg) ~ .cm-keyword:has(.cm-fn-scope-bg)": {
        borderRadius: "0",
    }
    // ".cm-comma": {
    //   padding: "0 4px"
    // },
    // ".cm-comma:has(.cm-fn-scope-bg)": {
    //   padding: "0"
    // },
    // ".cm-comma .cm-fn-scope-bg": {
    //   padding: "0 4px",
    //   borderRadius: "0"
    // },
    
});

const insertText = (
    view,
    item,
    type: "fn" | "tag",
    options: Pick<ExtensionOptions, "tagPlugin"> = {}
) => {
    if (view) {
        const content = type === "tag"
            ? (options.tagPlugin?.resolveInsertContent?.(item) || `[[${item.uid},${item.name}]]`)
            : `${item.name}(${item.argStrOfdefault ?? ''})`;
        view.replaceSelection(content)
        if (type === "fn") {
            view.setCursor(view.getCursor() - (item.argStrOfdefault?.length ?? 0) - 1)
        }
        view.focus = true
    }
};

type ExtensionOptions = {
  fnPlugin: {
    clickHandler: Function,
  },
  tagPlugin?: {
    clickHandler?: Function,
    resolveInsertContent?: Function,
  },
}

// const commaDecoration = Decoration.mark({
//   class: "cm-comma"
// })

// function buildCommaDecorations(doc: string) {
//   const builder = new RangeSetBuilder<Decoration>()

//   for (let i = 0; i < doc.length; i++) {
//     if (doc[i] === ",") {
//       builder.add(i, i + 1, commaDecoration)
//     }
//   }

//   return builder.finish()
// }

// const commaPlugin = ViewPlugin.fromClass(
//   class {
//     decorations: DecorationSet

//     constructor(view: EditorView) {
//       this.decorations = buildCommaDecorations(view.state.doc.toString())
//     }

//     update(update: ViewUpdate) {
//       if (update.docChanged) {
//         this.decorations = buildCommaDecorations(update.view.state.doc.toString())
//       }
//     }
//   },
//   {
//     decorations: v => v.decorations
//   }
// )

const createExtensions = (tagList,fnList,options: ExtensionOptions = {fnPlugin: { clickHandler: () => {} }}) => {
    const keywords = fnList.map((item)=>item.name)
    keywords.sort((a, b) => b.length - a.length);
    const getTagInsertContent = (tag) => {
        return options.tagPlugin?.resolveInsertContent?.(tag) || `[[${tag.uid},${tag.name}]]`
    }
    // 自动补全
    const fnCompletions = fnList.map(fn => ({
        label: `${fn.name}`,
        detail: `${fn.subName}`,
        apply: `${fn.name}()`,
        type: 'fn'
    }));
    const tagCompletions = tagList.map(tag => ({
        label: `${tag.name}`,
        detail: `${tag.attr}`,
        apply: (view, _completion, from, to) => {
            const content = getTagInsertContent(tag)
            view.dispatch({
                changes: {
                    from,
                    to,
                    insert: content
                },
                selection: {
                    anchor: from + content.length
                }
            })
        },
        section: i18next.t('codemirror.currentFormField'),
        type: 'tag'
    }));
    const myCompletionSource = (context) => {
        const word = context.matchBefore(/\S+/);
        if (!word || word.from == word.to) return null;
        
        const options = [...tagCompletions,...fnCompletions];
        return {
            from: word.from,
            to: word.to,
            options
        };
    };

    return [
      minimalSetup,
      placeholderTag,
      hideFnIdPlugin,
      fnScopeField,
      tagActiveField,
      keywordsPlugin(keywords, options.fnPlugin.clickHandler),
      tagsPlugin(options.tagPlugin?.clickHandler),
      chineseQuotesPlugin,
      // commaPlugin,
      bracketMatching(),
      autocompletion({
        override: [myCompletionSource],
        optionClass: c => `${c.type}-completion`
      }),
      keymap.of([indentWithTab]),
      baseTheme,
      EditorView.lineWrapping
    ]
}

//获取当前函数参数作用域
export function getFnArgsRange(
  view: EditorView,
  fnMeta: FnMeta
): { start: number; end: number } | null {

  const doc = view.state.doc.toString()

  // 从函数名后开始扫描
  let index = fnMeta.nameTo

  // 跳过可能存在的 <fid>
  if (doc[index] === "<") {
    const fidClose = doc.indexOf(">", index)
    if (fidClose === -1) return null
    index = fidClose + 1
  }

  // 跳过空格
  while (/\s/.test(doc[index])) index++

  // 必须是 "("
  if (doc[index] !== "(") return null

  const openParen = index
  let depth = 0

  for (let i = openParen; i < doc.length; i++) {
    if (doc[i] === "(") depth++
    if (doc[i] === ")") depth--

    if (depth === 0) {
      return {
        start: openParen + 1,
        end: i
      }
    }
  }

  return null
}

// 提取当前函数第一层作用域内的字段
function extractFirstLevelFields(text: string): string[] {

  const result: string[] = []

  let parenDepth = 0          // 所有括号深度
  let functionDepth = 0       // 函数嵌套深度
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < text.length; i++) {

    const ch = text[i]
    const prev = text[i - 1]

    //处理字符串

    if (ch === "'" && !inDoubleQuote && prev !== "\\") {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (ch === '"' && !inSingleQuote && prev !== "\\") {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (inSingleQuote || inDoubleQuote) continue

    // 判断是否为函数调用的 "("

    if (ch === "(") {

      parenDepth++

      // 向前回溯，判断是否是 函数名 或 函数名<id> 后的 (
      let j = i - 1

      // 跳过空格
      // while (j >= 0 && /\s/.test(text[j])) j--

      // // 处理 <fnId>
      // if (text[j] === ">") {
      //   while (j >= 0 && text[j] !== "<") j--
      //   j--
      // }

      // 再向前找到函数名
      let end = j
      while (j >= 0 && /[a-zA-Z0-9_]/.test(text[j])) j--

      const name = text.slice(j + 1, end + 1)

      if (name) {
        functionDepth++
      }

      continue
    }

    //处理 ")"

    if (ch === ")") {
      parenDepth--

      if (functionDepth > 0) {
        functionDepth--
      }

      continue
    }

    // 提取字段
    // 条件：在当前函数第一层作用域

    if (ch === "[" && text[i + 1] === "[" && functionDepth === 0) {

      const end = text.indexOf("]]", i + 2)
      if (end !== -1) {

        const content = text.slice(i + 2, end)

        // 只取字段路径（逗号前）
        result.push(content.split(",")[0])

        i = end + 1
      }
    }
  }

  return result
}



export function getCurrentFnFirstScopeFields({
  view,
  fnMeta
}: {
  view: EditorView
  fnMeta: FnMeta
}): string[] {

  const range = getFnArgsRange(view, fnMeta)
  if (!range) return []

  const text = view.state.doc.sliceString(range.start, range.end + 1)

  return extractFirstLevelFields(text)
}

export {
    createExtensions,
    getTagMetaByPos,
    insertText,
}

export const setFnScopeEffect = StateEffect.define<{
  from: number;
  to: number;
} | null>();

export const setTagActiveEffect = StateEffect.define<{
  from: number;
  to: number;
} | null>();

export const tagActiveField = StateField.define<{
  from: number;
  to: number;
} | null>({
  create() {
    return null;
  },
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setTagActiveEffect)) {
        return e.value;
      }
    }

    if (tr.docChanged) {
        return null;
    }

    return deco;
  },
});

export const fnScopeField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },

  update(deco, tr) {
    deco = deco.map(tr.changes)

    for (let e of tr.effects) {
      if (e.is(setFnScopeEffect)) {

        if (!e.value) {
          return Decoration.none
        }

        const { from, to } = e.value

        return Decoration.set([
          Decoration.mark({
            class: "cm-fn-scope-bg"
          }).range(from, to)
        ])
      }
    }

    return deco
  },

  provide: f => EditorView.decorations.from(f)
})
