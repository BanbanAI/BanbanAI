import MarkdownIt from "markdown-it";
import markdownItSub from "markdown-it-sub";
import markdownItSup from "markdown-it-sup";
import katex from "katex";

type MarkdownEditorField = {
  uid: string;
  meta?: {
    subType?: string;
    extra?: {
      widgetType?: string;
      subTableUID?: string[];
    };
  };
};

type MarkdownEditorTable = {
  uid: string;
  fields?: MarkdownEditorField[];
};

type MarkdownEditorFormData = {
  tables?: MarkdownEditorTable[];
};

type MarkdownEditorRow = Record<string, any>;

const markdownEditorWidgetType = "widget.form.markdownEditor";
const subformWidgetType = "widget.form.subform";

const markdownHtmlRenderer = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
})
  .use(markdownItSub)
  .use(markdownItSup);

markdownHtmlRenderer.inline.ruler.before("html_inline", "underline", (state, silent) => {
  const isOpenTag = state.src.startsWith("<u>", state.pos);
  const isCloseTag = state.src.startsWith("</u>", state.pos);
  if (!isOpenTag && !isCloseTag) return false;

  if (!silent) {
    state.push(isOpenTag ? "underline_open" : "underline_close", "u", 0);
  }
  state.pos += isOpenTag ? 3 : 4;
  return true;
});
markdownHtmlRenderer.renderer.rules.underline_open = () => "<u>";
markdownHtmlRenderer.renderer.rules.underline_close = () => "</u>";

const mathInline = (state: any, silent: boolean) => {
  const delimiters = [["$", "$"], ["\\(", "\\)"]];
  for (const [open, close] of delimiters) {
    if (!state.src.startsWith(open, state.pos)) continue;
    const start = state.pos + open.length;
    let match = start;
    while ((match = state.src.indexOf(close, match)) !== -1) {
      let backslashCount = 0;
      for (let index = match - 1; index >= 0 && state.src[index] === "\\"; index--) backslashCount++;
      if (backslashCount % 2 === 0) break;
      match += close.length;
    }
    if (match === -1) return false;
    if (!silent) {
      const token = state.push("math_inline", "math", 0);
      token.content = state.src.slice(start, match);
    }
    state.pos = match + close.length;
    return true;
  }
  return false;
};

const mathBlock = (state: any, startLine: number, endLine: number, silent: boolean) => {
  const delimiters = [["$$", "$$"], ["\\[", "\\]"]];
  const lineStart = state.bMarks[startLine] + state.tShift[startLine];
  const lineEnd = state.eMarks[startLine];
  for (const [open, close] of delimiters) {
    if (state.src.slice(lineStart, lineStart + open.length) !== open) continue;
    if (silent) return true;
    let nextLine = startLine;
    let content = state.src.slice(lineStart + open.length, lineEnd);
    let found = content.trimEnd().endsWith(close);
    if (found) content = content.trimEnd().slice(0, -close.length);
    while (!found && ++nextLine < endLine) {
      const currentStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const currentEnd = state.eMarks[nextLine];
      const currentLine = state.src.slice(currentStart, currentEnd);
      if (currentLine.trimEnd().endsWith(close)) {
        content += `\n${currentLine.trimEnd().slice(0, -close.length)}`;
        found = true;
      } else {
        content += `\n${currentLine}`;
      }
    }
    if (!found) return false;
    state.line = nextLine + 1;
    const token = state.push("math_block", "math", 0);
    token.block = true;
    token.content = content.trim();
    return true;
  }
  return false;
};

markdownHtmlRenderer.inline.ruler.before("escape", "math_inline", mathInline);
markdownHtmlRenderer.block.ruler.after("blockquote", "math_block", mathBlock, {
  alt: ["paragraph", "reference", "blockquote", "list"],
});
markdownHtmlRenderer.renderer.rules.math_inline = (tokens, index) =>
  `<span class="md-editor-katex-inline">${katex.renderToString(tokens[index].content, { throwOnError: false })}</span>`;
markdownHtmlRenderer.renderer.rules.math_block = (tokens, index) =>
  `<p class="md-editor-katex-block">${katex.renderToString(tokens[index].content, { displayMode: true, throwOnError: false })}</p>`;

const defaultFenceRenderer = markdownHtmlRenderer.renderer.rules.fence!;
markdownHtmlRenderer.renderer.rules.fence = (tokens, index, options, env, self) => {
  const token = tokens[index];
  if (token.info.trim() === "mermaid") {
    return `<div class="md-editor-mermaid" data-mermaid-theme="default">${markdownHtmlRenderer.utils.escapeHtml(token.content.trim())}</div>`;
  }
  return defaultFenceRenderer(tokens, index, options, env, self);
};
const markdownSourcePrefix = "<!-- b2-markdown-source:v1:";
const markdownSourceSuffix = " -->";

function decodeMarkdownSource(html: string): string | null {
  if (!html.startsWith(markdownSourcePrefix)) return null;
  const suffixIndex = html.indexOf(markdownSourceSuffix, markdownSourcePrefix.length);
  if (suffixIndex === -1) return null;
  const encodedSource = html.slice(markdownSourcePrefix.length, suffixIndex);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encodedSource) || encodedSource.length % 4 !== 0) return null;

  try {
    const markdownSource = Buffer.from(encodedSource, "base64").toString("utf8");
    return Buffer.from(markdownSource, "utf8").toString("base64") === encodedSource
      ? markdownSource
      : null;
  } catch {
    return null;
  }
}

export function convertMarkdownEditorValue(value: unknown, targetFormat: "markdown" | "html") {
  if (value !== null && typeof value === "object") {
    throw new TypeError("Markdown editor value must be a primitive value.");
  }

  const currentValue = value === null || value === undefined ? "" : String(value);
  if (!currentValue) return currentValue;

  const markdownSource = decodeMarkdownSource(currentValue);
  if (targetFormat === "markdown") {
    return markdownSource ?? currentValue;
  }
  if (markdownSource !== null) {
    return currentValue;
  }

  const encodedSource = Buffer.from(currentValue, "utf8").toString("base64");
  return `${markdownSourcePrefix}${encodedSource}${markdownSourceSuffix}\n${markdownHtmlRenderer.render(currentValue)}`;
}

export function convertMarkdownEditorFieldValue(value: unknown, field: MarkdownEditorField) {
  if (field.meta?.extra?.widgetType !== markdownEditorWidgetType) {
    return value;
  }

  return convertMarkdownEditorValue(value, field.meta?.subType === "html" ? "html" : "markdown");
}

export function convertMarkdownEditorRowValues(
  row: MarkdownEditorRow,
  table: MarkdownEditorTable,
  formData: MarkdownEditorFormData,
) {
  for (const field of table.fields || []) {
    if (!Object.prototype.hasOwnProperty.call(row, field.uid)) continue;

    if (field.meta?.extra?.widgetType === markdownEditorWidgetType) {
      row[field.uid] = convertMarkdownEditorFieldValue(row[field.uid], field);
      continue;
    }

    if (field.meta?.extra?.widgetType !== subformWidgetType || !Array.isArray(row[field.uid])) continue;
    const subTableUID = field.meta?.extra?.subTableUID?.[1];
    const subTable = formData.tables?.find(item => item.uid === subTableUID);
    if (!subTable) continue;
    row[field.uid].forEach((subRow: MarkdownEditorRow) => convertMarkdownEditorRowValues(subRow, subTable, formData));
  }

  return row;
}
