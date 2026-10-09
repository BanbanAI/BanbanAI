export type ParsedOptionType = {
  parsedType: string;
  generics: Record<string, string>;
  args: Record<string, string>;
}

export function parseOptionType(type: string): ParsedOptionType {
  if (!type) {
    return { parsedType: "unknown", generics: {}, args: {} };
  }
  const m = /^([\w-]+)(?:<(.+)>)?(?:\((.*)\))?$/.exec(type);
  const parsedType = m[1];
  const generics = {};
  const args = {};
  m[2]?.split(',').forEach(item => {
    let [name, value] = item.trim().split('=');
    if (value === undefined) value = 'true';
    generics[name] = value;
  });
  m[3]?.split(',').forEach(item => {
    let [name, value] = item.trim().split('=');
    if (value === undefined) value = 'true';
    args[name] = value;
  });
  return { parsedType, generics, args };
}

export function getOptionComponentName(parsedType: string): string {
  let typeUpper = '';
  if (parsedType.includes('-')) {
    const typeArr = parsedType.split('-');
    typeUpper = typeArr.reduce((prev, item) => prev + item.slice(0, 1).toUpperCase() + item.slice(1).toLowerCase(), '');
  } else {
    typeUpper = parsedType.slice(0, 1).toUpperCase() + parsedType.slice(1).toLowerCase();
  }
  return `${typeUpper}Option`;
}
