import { Field, Table } from "@common/types/project";
import { buildFormulaTableUID, isNocodeFormData } from "@common/utils/connection";
import { linkWidgetTypeMap } from "@common/utils/formula";
import { unique } from "@common/utils/unique";
import { AbstractForm, FormElement, isSubForm } from "@renderer/b2/controllers/form";
import { Widget } from "@renderer/b2/controllers/widget";
import { deepClone } from "@common/utils/object";
import { scanFormula } from "@common/utils";
import i18next from "i18next";

const FORMULA_HIDDEN_FIELD_WIDGET_TYPES = new Set([
  "widget.form.selectData",
  "widget.form.relatedData",
  "widget.form.searchForm",
]);

export const isFormulaHiddenFieldWidgetType = (widgetType?: string) => {
  return FORMULA_HIDDEN_FIELD_WIDGET_TYPES.has(String(widgetType || ""));
};

export const isFormulaHiddenField = (field?: Pick<Field, "meta">) => {
  return isFormulaHiddenFieldWidgetType(field?.meta?.extra?.widgetType as string | undefined);
};

export function checkChineseQuotesInFormulaByScan(
  formula: string
) {
  const result = [];

  scanFormula(formula, {
    onChar(ch, ctx) {
      if (/[“”‘’]/.test(ch)) {
        // 忽略 [[ ... ]] 内
        if (ctx.inBracket || ctx.inDoubleQuote || ctx.inSingleQuote) return;

        result.push({
          position: ctx.index,
          quote: ch,
          context: ctx.inString ? 'inside-string' : 'outside-string',
        });
      }
    }
  });

  return result;
}

// 获取组件设置默认值公式时可使用的字段
const getWidgetList = (widget: FormElement, includeSelf = false): FormElement[] => {
  const form = (widget.topForm) as AbstractForm;

  return form.container.getChildWidgets(true, (w: Widget) => {
    if (w.uid === widget.uid && !includeSelf) return false; // 排除自身
    else if (["widget.form.multipleTabs", "widget.form.tabPanel"].includes(w.getSoul()?.type)
     || (w.parent.getSoul()?.type === "widget.form.subform" && ["widget.form.relatedData", "widget.form.searchForm"].includes(w.getSoul()?.type))) {
      return undefined; // 跳过分组面板，获取children
    }
    else if (w.getSoul()?.type === "widget.form.subform") {
      if (!widget.isInSubForm) {
        return undefined; // 设置公式的widget不在子表单中,跳过子表单
      }
      else {
        if (widget.parent.uid === w.uid) return undefined; // 该子表单为设置公式的widget的parent,则跳过
        else return false;
      }
    }
    else {
      return true;
    }
  }) as FormElement[]
}

const replaceFieldUID = (fields: Field[]) => {
  for (const field of fields) {
    field.uid = field.meta.uid as `f_${string}`;

    if (field.subTableFields) replaceFieldUID(field.subTableFields);
  }
}

const createFieldWithSource = (widget: FormElement, createSubField = false) => { 
  const field = {
    uid: widget.uid as `f_${string}`,
    alias: widget.title,
    type: widget.fieldType,
    meta: {
      name: widget.name,
      uid: widget.uid,
      extra: {
        widgetType: widget.getSoul()?.type
      },
    }
  }

  if (isSubForm(widget)) field['subTableFields'] = createSubField ? widget.children.map(c => createFieldWithSource(c, true)) : [];
  return field
}

const getOtherTables = (widget: FormElement) => { 
  const form = widget.topForm;
  const currentConnectionUID = form.tableUID[0];
  const dataSources = widget.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || [];

  return dataSources.reduce((pre, source) => {
    const tables = source.tables?.filter(t => {
      if (t.meta?.extra?.primaryTable) return false;
      if (t.meta?.extra?.isAggregateTable) return false;
      return !(source.uid === currentConnectionUID && t.uid === form.tableUID[1]);
    }) || [];

    for (const t of tables) {
      const linkTable = deepClone(t);
      linkTable.uid = buildFormulaTableUID(source.uid, t.uid, currentConnectionUID) as unknown as `t_${string}`;
      linkTable['name'] = source.uid === currentConnectionUID || !source.name
        ? linkTable.alias
        : `${source.name}-${linkTable.alias}`;
      linkTable['formulaAlias'] = linkTable['name'];
      linkTable['connectionUID'] = source.uid;
      pre.push(linkTable);
    }

    return pre;
  }, [])
}

export const getSourceTables = (widget: FormElement, includeSelf = false) => { 
  const form = widget.topForm;
  const widgets = getWidgetList(widget, includeSelf);
  const connections = widget.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || [];
  const tables = connections.find(c => c.uid === form.tableUID?.[0])?.tables || [];
  const linkTables = [];
  const currentTable = tables.find(t => t.uid === form.tableUID[1]);
  const targetTable = deepClone(currentTable);
  targetTable.alias = `${targetTable.alias}-${i18next.t('FormDefaultValueFormulaDialog.currentRow')}`

  targetTable.fields = targetTable.fields.reduce((pre, field) => {
    if (field.subTableFields) {
      const subTableFields = field.subTableFields.filter(subField => widgets.some(w => w.uid === subField.meta.uid) && subField.meta.uid !== widget.uid);
      field.subTableFields = subTableFields;

      for (const subTableField of field.subTableFields) {
        const lastName = form.getChildElement(subTableField.meta.uid)?.title;
        if (lastName) subTableField.alias = lastName;
      }

      const lastName = form.getChildElement(field.meta.uid)?.title;
      pre.push({
        ...field,
        alias: lastName ?? field.alias
      });
    } else if (widgets.some(w => w.uid === field.meta.uid)) {
      const lastName = form.getChildElement(field.meta.uid)?.title;
      pre.push({
        ...field,
        alias: lastName ?? field.alias
      });
    }
    return pre
  }, [])

  // 根据当前表单(未保存)创建公式编辑中的数据源表单
  for (const w of widgets) {
    // 创建 查询表单、关联表单 的联动表单
    const key = linkWidgetTypeMap[w.getSoul()?.type];
    if (key) {
      const linkTableUID = w[key];
      const linkConnection = connections.find(connection => connection.uid === linkTableUID?.[0]);
      const t = linkConnection?.tables?.find(t => t.uid === linkTableUID?.[1]);
      if (t) {
        const linkTable = deepClone(t);
        linkTable.uid = `t_${unique()}`;
        linkTable.alias = `${w.title}-${linkTable.alias}`;
        linkTable['linkedForm'] = `${w.topForm.tableUID[1]}.${w.isInSubForm ? w.parent.uid + '.' : ''}${w.uid}`
        linkTable['sourceTableUID'] = t.uid;
        linkTable['sourceConnectionUID'] = linkConnection?.uid || w.topForm.tableUID[0];
        linkTables.push(linkTable);
      }

      continue;
    }

    if (w.uid === widget.uid) continue;

    if (w.isInSubForm) {
      let subFormField = targetTable.fields.find(f => f.meta.uid === w.parent.uid);
      if (!subFormField) {
        subFormField = createFieldWithSource(w.parent as FormElement);
        targetTable.fields.push(subFormField);
      }

      if (!subFormField.subTableFields) subFormField.subTableFields = [];
      const isInexistence = subFormField.subTableFields.every(field => field.meta.uid !== w.uid);
      const subFormElement = form.getChildElement(subFormField.meta?.uid)
      const index = subFormElement?.children.findIndex(c => c.uid === w.uid)
      if (isInexistence) subFormField.subTableFields.splice(index, 0, createFieldWithSource(w));
    } else {
      let index = form?.children.findIndex(c => c.uid === w.uid);
      const currentWidgetIndex = form?.children.findIndex(c => c.uid === widget.uid);
      // 主表上的排序如果大于当前widget，则需要减1
      if (currentWidgetIndex !== -1 && index > currentWidgetIndex) index--;
      const isInexistence = targetTable.fields.every(field => field.meta.uid !== w.uid);
      if (isInexistence) targetTable.fields.splice(index, 0, createFieldWithSource(w));
    }
  }

  // 替换fieldUID 为 widgetUID
  //, ...linkTables
  for (const table of [targetTable]) {
    replaceFieldUID(table.fields)
  }

  return {
    targetTable,
    linkTables,
    otherTables: getOtherTables(widget),
  }
}

type FormulaTokenFieldLike = Pick<Field, 'uid' | 'alias'> & {
  meta?: {
    uid?: string;
    [key: string]: unknown;
  };
}

export const getFormulaTokenFieldUID = (field?: FormulaTokenFieldLike) => {
  return String(field?.uid || field?.meta?.uid || "");
}

export const buildFormulaFieldToken = (options: {
  tableUID: string;
  tableLabel: string;
  field: FormulaTokenFieldLike;
  parentField?: FormulaTokenFieldLike;
}) => {
  const fieldUID = getFormulaTokenFieldUID(options.field);
  if (!fieldUID) return "";

  const parentFieldUID = options.parentField ? getFormulaTokenFieldUID(options.parentField) : "";
  const tokenPath = parentFieldUID
    ? `${options.tableUID}.${parentFieldUID}.${fieldUID}`
    : `${options.tableUID}.${fieldUID}`;
  const titlePath = options.parentField
    ? `${options.tableLabel}.${options.parentField.alias}.${options.field.alias}`
    : `${options.tableLabel}.${options.field.alias}`;

  return `[[${tokenPath},${titlePath}]]`;
}

export const replaceBracketId = (
  str: string, 
  callback: (ids: string[], aliases: string[]) => string
): string => {
  // 匹配两种格式：
  // 1. [[纯id格式]] - 数字大小写字母点下划线
  // 2. [[id格式,任意字符串]] - 逗号前是id格式，逗号后是任意字符
  const regex = /\[\[([a-zA-Z0-9.:_]+(?:,[^[\]]*)?)\]\]/g;

  return str?.replace(regex, (match, content) => {
    const [id, alias] = content.split(",");
    const ids = id?.split(".");
    const aliases = alias?.split(".") ?? [];
    const res = callback(ids, aliases);
    return `[[${res}]]`;
  });
};

const FULLWIDTH_OPERATOR_MAP: Record<string, string> = {
  '《': '<',
  '＜': '<',

  '》': '>',
  '＞': '>',

  '！': '!',

  '，': ',',
};

export function normalizeFormula(formula: string): string {
  if (!formula) return formula;

  let result = '';
  let i = 0;

  let inBracket = 0;        // [[ ... ]]
  let inString = false;    // "..." or '...'
  let stringQuote = '';    // 当前字符串使用的引号

  while (i < formula.length) {
    const char = formula[i];
    const next = formula[i + 1];
    const prev = formula[i - 1];

    /* 字符串内转义 */
    if (inString && char === '\\') {
      result += char + next;
      i += 2;
      continue;
    }

    /* 进入字符串 */
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringQuote = char;
      result += char;
      i++;
      continue;
    }

    /* 退出字符串 */
    if (inString && char === stringQuote) {
      inString = false;
      stringQuote = '';
      result += char;
      i++;
      continue;
    }

    /* 字符串内完全透传 */
    if (inString) {
      result += char;
      i++;
      continue;
    }

    /* 进入 [[ */
    if (char === '[' && next === '[') {
      inBracket++;
      result += '[[';
      i += 2;
      continue;
    }

    /* 退出 ]] */
    if (char === ']' && next === ']' && inBracket > 0) {
      inBracket--;
      result += ']]';
      i += 2;
      continue;
    }

    if (inBracket > 0) {
      result += char;
      i++;
      continue;
    }

    if (FULLWIDTH_OPERATOR_MAP[char]) {
      result += FULLWIDTH_OPERATOR_MAP[char];
      i++;
      continue;
    }

    if (char === '=') {
      if (
        prev === '=' ||
        next === '=' ||
        prev === '!' ||
        prev === '>' ||
        prev === '<'
      ) {
        result += char;
      } else {
        result += '==';
      }
      i++;
      continue;
    }

    /* 默认 */
    result += char;
    i++;
  }

  return result;
}


function normalizeOutside(text: string): string {
  return text
    .replace(/，/g, ',')
    .replace(/(?<!\=)\=(?!\=)/g, '==')
}
