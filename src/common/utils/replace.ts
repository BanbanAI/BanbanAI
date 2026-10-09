import i18next from "i18next";

export function replaceByParams(str: string, callback: (key: string, originKey?: string)=>string) {
  if (!str) {
    return str;
  }
  return str.replaceAll(/\{\s*:(.*?)\s*\}/g, ($0, $1)=>{
    return callback($1, $0);
  });
}

//处理复制逻辑的命名拼接
export const handleCopyName = (sourceName: string) => {
  const copyNameSuffix = i18next.t("commonReplace.copyNameSuffix")
  const regex = new RegExp(`${copyNameSuffix}(\\d+)?$`);
  const match = sourceName.match(regex);

  if (match) {
    const num = match[1] ? parseInt(match[1]) + 1 : 1;
    return sourceName.replace(regex, `${copyNameSuffix}${num}`);
  } else {
    return `${sourceName}${copyNameSuffix}`;
  }
}

export const replaceUID = (options: any, uidMap: Record<string, string>) => {
  if (Array.isArray(options)) {
    return options.map(option => replaceUID(option, uidMap));
  } else if (options instanceof Object) {
    for (const key in options) {
      if (uidMap[key]) {
        options[uidMap[key]] = replaceUID(options[key], uidMap);
        delete options[key];
      } else {
        options[key] = replaceUID(options[key], uidMap);
      }
    }
  } else {
    if (uidMap[options]) {
      return uidMap[options];
    } else if (typeof options === "string") {
      return options.replace(/\w+/g, match => uidMap[match] || match);
    }
  }
  return options;
}

const illegalChars = new RegExp('[\\\\/:*?"<>|]', 'g');
export const replaceIllegalChars = (str: string) => str.replaceAll(illegalChars, '_');