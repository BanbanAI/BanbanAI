import { FnMeta, ScanContext, ScanHooks } from "@common/utils";

export function scanFormulaJump(
  text: string,
  hooks: ScanHooks
): boolean {

  const ctx: ScanContext = {
    index: 0,
    inSingleQuote: false,
    inDoubleQuote: false,
    inString: false,
    inBracket: false
  };

  let i = 0;

  while (i < text.length) {
    ctx.index = i;

    const ch = text[i];
    const next = text[i + 1];

    if (!ctx.inString && ch === "[" && next === "[") {
      ctx.inBracket = true;
      i += 2;

      while (i < text.length) {
        ctx.index = i;

        if (text[i] === "]" && text[i + 1] === "]") {
          i += 2;
          ctx.inBracket = false;
          break;
        }

        if (hooks.onBracketChar?.(text[i], ctx) === false)
          return false;

        i++;
      }

      continue;
    }

    if (!ctx.inBracket && (ch === '"' || ch === "'")) {

      if (ch === '"') {
        ctx.inDoubleQuote = true;
      } else {
        ctx.inSingleQuote = true;
      }

      ctx.inString = true;

      const quote = ch;
      i++;

      while (i < text.length) {
        ctx.index = i;

        if (text[i] === "\\" && i + 1 < text.length) {
          i += 2;
          continue;
        }

        if (text[i] === quote) {
          i++;
          break;
        }

        i++;
      }

      ctx.inSingleQuote = false;
      ctx.inDoubleQuote = false;
      ctx.inString = false;

      continue;
    }

    if (hooks.onChar?.(ch, ctx) === false)
      return false;

    i++;
  }

  return hooks.onEnd ? hooks.onEnd(ctx) : true;
}

export function scanFunctions(text: string): Omit<FnMeta, "fnId">[] {

  const result: Omit<FnMeta, "fnId">[] = []

  let buffer = ""
  let bufferStart = -1

  scanFormulaJump(text, {

    onChar(ch, ctx) {

      if (ctx.inString || ctx.inBracket) {
        buffer = ""
        return
      }

      // 收集函数名字符
      if (/[a-zA-Z0-9_]/.test(ch)) {
        if (!buffer) bufferStart = ctx.index
        buffer += ch
        return
      }

      if (!buffer) return

      const name = buffer
      const nameFrom = bufferStart
      const nameTo = nameFrom + name.length

      // 下一个字符必须是 "(" 才算函数
      if (ch === "(") {
        result.push({
          name,
          nameFrom,
          nameTo
        })
      }

      buffer = ""
    },
  })

  return result
}
