import { WidgetType, MatchDecorator, Decoration, ViewPlugin, DecorationSet, EditorView, ViewUpdate, keymap } from "@codemirror/view";
import { bracketMatching } from "@codemirror/language"
import { indentWithTab } from "@codemirror/commands";
import { minimalSetup } from "codemirror";
import { autocompletion } from "@codemirror/autocomplete";
import { checkChineseQuotesInFormula } from "./utils";
import i18next from "@renderer/widgets/i18next";
//标签
class PlaceholderTag extends WidgetType {
    text: string = "";
    uid: string = ""
    constructor(uid: string,text: string) {
        super()
        this.text = text
        this.uid = uid
    }

    eq(other: PlaceholderTag) { return other.text == this.text  && other.uid === this.uid}

    toDOM() {
        let elt = document.createElement("span");
        if (!this.text) return elt;
        elt.className = "cm-tag";
        elt.textContent = this.text;
        elt.style.display = "inline-block";
        return elt;
    }

    ignoreEvent() { return false }
}
const placeholderTagMatcher = new MatchDecorator({
    regexp: /\[\[([a-zA-Z0-9]+),([\s\S]*?)\]\]/gu,
    decoration: (match) => {
        return Decoration.replace({
            widget: new PlaceholderTag(match[1], match[2])
        });
    },
});
const placeholderTag = ViewPlugin.fromClass(
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
        decorations: instance => instance.placeholders,
        provide: plugin => EditorView.atomicRanges.of(view => {
            return view.plugin(plugin)?.placeholders || Decoration.none
        })
    }
);

//函数
const keywordsPlugin = (keywords) => {
    const keywordPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    const keywordMatcher = new MatchDecorator({
        regexp: keywordPattern,
        decoration: () => {
            return Decoration.mark({
                class: "cm-keyword",
            });
        }
    });
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet
            constructor(view) {
                this.decorations = keywordMatcher.createDeco(view);
            }
            update(update) {
                this.decorations = keywordMatcher.updateDeco(update, this.decorations);
            }
        },
        {
            decorations: (instance) => instance.decorations,
        }
    );
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
            const chineseQuotes = checkChineseQuotesInFormula(text);
            
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
        fontSize: "12px",
        color: "#2f7deb",
        backgroundColor: "#eaf2fd",
        borderRadius: "2px",
    },
    ".cm-keyword": {
        color: "#FF4D4F",
        backgroundColor: "#FF4D4F1A",
        margin: "2px",
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
        borderLeftColor: "white"
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
        fontSize: "12px",
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
                fontSize: "12px",
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
});

const insertText = (view, item, type: "fn" | "tag") => {
    if (view) {
        const content = type === "tag" ? `[[${item.uid},${item.name}]]` : `${item.name}(${item.argStrOfdefault ?? ''})`;
        view.replaceSelection(content)
        if (type === "fn") {
            view.setCursor(view.getCursor() - (item.argStrOfdefault?.length ?? 0) - 1)
        }
        view.focus = true
    }
};

const createExtensions = (tagList,fnList) => {
    const keywords = fnList.map((item)=>item.name)
    keywords.sort((a, b) => b.length - a.length);
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
        apply: `[[${tag.uid},${tag.name}]]`,
        section: i18next.t("currentFormField"),
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

    return [placeholderTag,
        keywordsPlugin(keywords),
        chineseQuotesPlugin,
        bracketMatching(),
        autocompletion(
            {
                override: [myCompletionSource],
                optionClass: (completion) => `${completion.type}-completion`
            }), keymap.of([indentWithTab]),
        baseTheme,
        minimalSetup
    ]
}

export {
    createExtensions,
    insertText
}
