import router from '@renderer/router'
import { isAiAssistantTableColumnHidden } from '@common/utils/aiMessageBlocks'
import i18next from 'i18next'
import {
  resolveShadowMarkdownRouteTarget,
  type ShadowMarkdownRouteTarget,
} from './shadowMarkdownRoute'

export type ShadowMarkdownExpandedTablePayload = {
  index: number;
  title: string;
  tableHtml: string;
  tableText: string;
};

type ShadowMarkdownHost = HTMLElement & {
  __shadowRoot?: ShadowRoot;
  __shadowContent?: HTMLDivElement;
  __shadowClickHandler?: (event: MouseEvent) => void;
  __shadowBindingValue?: ShadowMarkdownBindingValue;
  __shadowRawHtml?: string;
};

type ShadowMarkdownBindingValue =
  | string
  | {
      html?: string;
      onRouteClick?: (target: ShadowMarkdownRouteTarget, event: MouseEvent) => boolean | void;
      onTableExpand?: (payload: ShadowMarkdownExpandedTablePayload, event: MouseEvent) => boolean | void;
      enableTableExpand?: boolean;
      tableExpandLabel?: string;
    };

const SHADOW_MARKDOWN_STYLE = `
  :host {
    display: block;
    width: 100%;
    color: #1d2129;
    font-size: 14px;
    line-height: 22px;
    word-break: break-word;
  }

  p {
    margin: 0;
  }

  p + p {
    margin-top: 12px;
  }

  hr {
    margin: 14px 0;
    border: 0;
    border-top: 1px solid #e5e6eb;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0;
    font-weight: 600;
    line-height: 1.5;
  }

  h1 + p,
  h2 + p,
  h3 + p,
  h4 + p,
  h5 + p,
  h6 + p,
  h1 + ul,
  h2 + ul,
  h3 + ul,
  h4 + ul,
  h5 + ul,
  h6 + ul,
  h1 + ol,
  h2 + ol,
  h3 + ol,
  h4 + ol,
  h5 + ol,
  h6 + ol {
    margin-top: 10px;
  }

  p + h1,
  p + h2,
  p + h3,
  p + h4,
  p + h5,
  p + h6,
  ul + h1,
  ul + h2,
  ul + h3,
  ul + h4,
  ul + h5,
  ul + h6,
  ol + h1,
  ol + h2,
  ol + h3,
  ol + h4,
  ol + h5,
  ol + h6 {
    margin-top: 20px;
  }

  ul,
  ol {
    margin: 0;
    padding-left: 20px;
  }

  li + li {
    margin-top: 6px;
  }

  blockquote {
    margin: 8px 0;
    padding-left: 12px;
    border-left: 3px solid #d9dde3;
    color: #4e5969;
  }

  pre {
    margin: 8px 0;
    padding: 12px;
    border-radius: 8px;
    background-color: #f2f3f5;
    overflow-x: auto;
  }

  code {
    font-family: Consolas, Monaco, monospace;
    font-size: 13px;
  }

  :not(pre) > code {
    padding: 2px 6px;
    border-radius: 4px;
    background-color: #f2f3f5;
  }

  a {
    color: #0873ff;
    text-decoration: underline;
  }

  table {
    border-collapse: collapse;
    width: max-content;
    min-width: 100%;
    margin: 8px 0;
  }

  th, td {
    border: 1px solid #e5e6eb;
    padding: 8px 12px;
    text-align: left;
    min-width: 120px;
  }

  th {
    background-color: #f7f8fa;
    font-weight: 600;
  }

  .shadow-markdown-table-card {
    margin: 8px 0;
    border: 1px solid #e5e6eb;
    border-radius: 10px;
    background: #fff;
    overflow: hidden;
  }

  .shadow-markdown-table-card table {
    margin: 0;
  }

  .shadow-markdown-table-toolbar {
    display: flex;
    justify-content: flex-end;
    padding: 6px 8px 2px;
  }

  .shadow-markdown-table-expand {
    display: inline-flex;
    align-items: center;
    border: 1px solid #e5e6eb;
    border-radius: 999px;
    background: #fff;
    color: #4e5969;
    padding: 4px 10px;
    font-size: 12px;
    line-height: 18px;
    cursor: pointer;
  }

  .shadow-markdown-table-expand:hover {
    background: #f7f8fa;
    color: #1d2129;
  }

  .shadow-markdown-table-expand-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 4px;
  }

  .shadow-markdown-table-expand-icon svg {
    width: 14px;
    height: 14px;
  }

  .shadow-markdown-table-expand-text {
    font-size: 12px;
    line-height: 18px;
  }

  .shadow-markdown-table-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 8px 8px;
    scrollbar-width: thin;
    scrollbar-color: #c9cdd4 transparent;
  }

  .shadow-markdown-table-scroll::-webkit-scrollbar {
    height: 6px;
  }

  .shadow-markdown-table-scroll::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #c9cdd4;
  }

  .shadow-markdown-table-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
`;

const SHADOW_MARKDOWN_TABLE_EXPAND_ICON = `
  <svg viewBox="0 0 1024 1024" aria-hidden="true">
    <path
      fill="currentColor"
      d="m160 96.064l192 .192a32 32 0 0 1 0 64l-192-.192V352a32 32 0 0 1-64 0V96h64v.064zm0 831.872V928H96V672a32 32 0 1 1 64 0v191.936l192-.192a32 32 0 1 1 0 64l-192 .192zM864 96.064V96h64v256a32 32 0 1 1-64 0V160.064l-192 .192a32 32 0 1 1 0-64l192-.192zm0 831.872l-192-.192a32 32 0 0 1 0-64l192 .192V672a32 32 0 1 1 64 0v256h-64v-.064z"
    />
  </svg>
`;

const ensureShadowMarkdown = (el: ShadowMarkdownHost) => {
  if (el.__shadowRoot && el.__shadowContent) {
    return el.__shadowContent;
  }

  const shadowRoot = el.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = SHADOW_MARKDOWN_STYLE;
  const content = document.createElement('div');

  shadowRoot.append(style, content);
  el.__shadowRoot = shadowRoot;
  el.__shadowContent = content;

  return content;
};

const resolveShadowMarkdownHtml = (value: ShadowMarkdownBindingValue) => (
  typeof value === 'string' ? value : String(value?.html || '')
);

const normalizeShadowMarkdownText = (value: string | null | undefined) => (
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[：:]\s*$/, '')
    .trim()
);

const isEligibleShadowMarkdownTitle = (element: Element, text: string) => {
  if (!text) {
    return false;
  }

  const tagName = element.tagName.toUpperCase();
  if (/^H[1-6]$/.test(tagName)) {
    return text.length <= 80;
  }

  if (tagName !== 'P') {
    return false;
  }

  if (element.querySelector('strong, b')) {
    return text.length <= 80;
  }

  return text.length <= 24 && !/[，。！？；]/.test(text);
};

const resolveShadowMarkdownTableTitle = (table: HTMLTableElement) => {
  let current: Element | null = table;

  while (current) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      const text = normalizeShadowMarkdownText(sibling.textContent);
      if (isEligibleShadowMarkdownTitle(sibling, text)) {
        return text;
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }

  return '';
};

const syncShadowMarkdownTableToolbar = (
  card: HTMLElement,
  tableExpandEnabled: boolean,
  tableExpandLabel: string,
) => {
  const toolbar = Array.from(card.children).find((child): child is HTMLDivElement => (
    child instanceof HTMLDivElement && child.classList.contains('shadow-markdown-table-toolbar')
  ));

  if (!tableExpandEnabled) {
    toolbar?.remove();
    return;
  }

  const nextToolbar = toolbar || document.createElement('div');
  nextToolbar.className = 'shadow-markdown-table-toolbar';

  let button = nextToolbar.querySelector('[data-shadow-markdown-action="expand-table"]') as HTMLButtonElement | null;
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'shadow-markdown-table-expand';
    button.dataset.shadowMarkdownAction = 'expand-table';

    const icon = document.createElement('span');
    icon.className = 'shadow-markdown-table-expand-icon';
    icon.innerHTML = SHADOW_MARKDOWN_TABLE_EXPAND_ICON;

    const label = document.createElement('span');
    label.className = 'shadow-markdown-table-expand-text';

    button.append(icon, label);
    nextToolbar.appendChild(button);
  }

  button.setAttribute('aria-label', tableExpandLabel);
  const label = button.querySelector('.shadow-markdown-table-expand-text');
  if (label) {
    label.textContent = tableExpandLabel;
  }

  if (!toolbar) {
    card.prepend(nextToolbar);
  }
};

const removeHiddenAiAssistantTableColumns = (table: HTMLTableElement) => {
  const headerRow = table.tHead?.rows?.[0] || table.rows?.[0];
  if (!headerRow) {
    return;
  }

  const hiddenColumnIndexes = Array.from(headerRow.cells)
    .map((cell, index) => (
      isAiAssistantTableColumnHidden({ key: '', label: normalizeShadowMarkdownText(cell.textContent) })
        ? index
        : -1
    ))
    .filter(index => index >= 0)
    .reverse();

  if (!hiddenColumnIndexes.length) {
    return;
  }

  Array.from(table.rows).forEach((row) => {
    const cells = Array.from(row.cells);
    hiddenColumnIndexes.forEach((index) => {
      cells[index]?.remove();
    });
  });
};

const decorateShadowMarkdownTables = (el: ShadowMarkdownHost) => {
  const content = ensureShadowMarkdown(el);
  const defaultTableExpandLabel = i18next.t('shadowMarkdownDirective.expandTable');
  const tableExpandEnabled = typeof el.__shadowBindingValue === 'object'
    ? el.__shadowBindingValue.enableTableExpand !== false && typeof el.__shadowBindingValue.onTableExpand === 'function'
    : false;
  const tableExpandLabel = typeof el.__shadowBindingValue === 'object'
    ? String(el.__shadowBindingValue.tableExpandLabel || '').trim() || defaultTableExpandLabel
    : defaultTableExpandLabel;

  Array.from(content.querySelectorAll('table')).forEach((table, index) => {
    removeHiddenAiAssistantTableColumns(table);

    const existingCard = table.closest('.shadow-markdown-table-card') as HTMLElement | null;
    if (existingCard) {
      existingCard.dataset.tableIndex = String(index);
      syncShadowMarkdownTableToolbar(existingCard, tableExpandEnabled, tableExpandLabel);
      return;
    }

    const parent = table.parentElement;
    if (!parent) {
      return;
    }

    const card = document.createElement('div');
    card.className = 'shadow-markdown-table-card';
    card.dataset.tableIndex = String(index);

    const scroll = document.createElement('div');
    scroll.className = 'shadow-markdown-table-scroll';
    parent.insertBefore(card, table);
    syncShadowMarkdownTableToolbar(card, tableExpandEnabled, tableExpandLabel);
    scroll.appendChild(table);
    card.appendChild(scroll);
  });
};

const bindShadowMarkdownClick = (el: ShadowMarkdownHost) => {
  const content = ensureShadowMarkdown(el);
  if (el.__shadowClickHandler) return;

  const handleClick = (event: MouseEvent) => {
    const eventTarget = event.target instanceof HTMLElement ? event.target : null;
    const expandButton = eventTarget?.closest?.('[data-shadow-markdown-action="expand-table"]') as HTMLButtonElement | null;
    if (expandButton) {
      event.preventDefault();
      event.stopPropagation();

      const tableCard = expandButton.closest('.shadow-markdown-table-card') as HTMLElement | null;
      const table = tableCard?.querySelector('table');
      const onTableExpand = typeof el.__shadowBindingValue === 'object'
        ? el.__shadowBindingValue?.onTableExpand
        : undefined;
      if (table && onTableExpand) {
        onTableExpand({
          index: Number(tableCard?.dataset.tableIndex || 0),
          title: resolveShadowMarkdownTableTitle(table),
          tableHtml: table.outerHTML,
          tableText: String(table.textContent || '').trim(),
        }, event);
      }
      return;
    }

    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) {
      return;
    }

    const path = event.composedPath();
    const anchor = path.find(item => item instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
    if (!anchor) return;

    const routeTarget = resolveShadowMarkdownRouteTarget(anchor.getAttribute('href'));
    if (!routeTarget) return;

    event.preventDefault();
    const onRouteClick = typeof el.__shadowBindingValue === 'object'
      ? el.__shadowBindingValue?.onRouteClick
      : undefined;
    if (onRouteClick) {
      const handled = onRouteClick({
        ...routeTarget,
        displayTitle: normalizeShadowMarkdownText(anchor.textContent),
      }, event);
      if (handled !== false) {
        return;
      }
    }

    void router.push(routeTarget.routePath);
  };

  content.addEventListener('click', handleClick);
  el.__shadowClickHandler = handleClick;
};

const unbindShadowMarkdownClick = (el: ShadowMarkdownHost) => {
  if (!el.__shadowContent || !el.__shadowClickHandler) return;
  el.__shadowContent.removeEventListener('click', el.__shadowClickHandler);
  delete el.__shadowClickHandler;
};

const updateShadowMarkdown = (el: ShadowMarkdownHost, value: ShadowMarkdownBindingValue) => {
  const content = ensureShadowMarkdown(el);
  el.__shadowBindingValue = value;
  const html = resolveShadowMarkdownHtml(value);
  const previousRawHtml = el.__shadowRawHtml || '';
  if (previousRawHtml === html) {
    decorateShadowMarkdownTables(el);
    return;
  }

  el.__shadowRawHtml = html;
  content.innerHTML = html;
  decorateShadowMarkdownTables(el);
};

export const vShadowMarkdown = {
  mounted(el: ShadowMarkdownHost, binding: { value: ShadowMarkdownBindingValue }) {
    bindShadowMarkdownClick(el);
    updateShadowMarkdown(el, binding.value || '');
  },
  updated(
    el: ShadowMarkdownHost,
    binding: { value: ShadowMarkdownBindingValue; oldValue: ShadowMarkdownBindingValue },
  ) {
    if (binding.value === binding.oldValue) return;
    updateShadowMarkdown(el, binding.value || '');
  },
  unmounted(el: ShadowMarkdownHost) {
    unbindShadowMarkdownClick(el);
    delete el.__shadowBindingValue;
    delete el.__shadowRawHtml;
  },
};
