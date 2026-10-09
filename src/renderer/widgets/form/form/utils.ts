export function checkChineseQuotesInFormula(formulaStr) {
  // 判断字符是否为中文引号
  function isChineseQuote(char) {
    return ['“', '”', '‘', '’'].includes(char);
  }

  // 判断字符是否为字符串分隔符
  function isStringDelimiter(char, stack) {
    if (!isChineseQuote(char) && char !== '"' && char !== "'") return false;

    if (stack.length === 0) return true;

    const lastDelimiter = stack[stack.length - 1];

    // 检查是否匹配栈顶的分隔符
    if (
      (lastDelimiter === '"' && char === '"') ||
      (lastDelimiter === "'" && char === "'") ||
      ((lastDelimiter === '“' || lastDelimiter === '”') &&
        (char === '“' || char === '”')) ||
      ((lastDelimiter === '‘' || lastDelimiter === '’') &&
        (char === '‘' || char === '’'))
    ) {
      return true;
    }

    return false;
  }

  const stack = [];
  const chineseQuotesFound = [];

  for (let i = 0; i < formulaStr.length; i++) {
    const char = formulaStr[i];

    // 处理转义字符
    if (char === '\\') {
      i++;
      continue;
    }

    if (isStringDelimiter(char, stack)) {
      if (stack.length > 0) {
        const openingQuote = stack.pop();
        if (isChineseQuote(openingQuote) || isChineseQuote(char)) {
          chineseQuotesFound.push({
            position: i,
            quote: char,
            type: 'closing',
            isChinese: isChineseQuote(char)
          });
        }
      } else {
        stack.push(char);
        if (isChineseQuote(char)) {
          chineseQuotesFound.push({
            position: i,
            quote: char,
            type: 'opening',
            isChinese: true
          });
        }
      }
    }
  }

  return chineseQuotesFound;
}