type CompareResult = -1 | 0 | 1;

export function formatFloat(value: number, num: number, padding = false): string {
  let val = Number(value);
  if (num < 0) return String(val);
  let str = val.toFixed(num);
  if (!padding) str = String(parseFloat(str));
  return str;
}

export function fixFloat(num: number) {
  let str = String(num);
  if (str.match(/^[+-]?((0\.\d{16,})|([\d\.]{17,}))$/)) {
    if (str.match(/\.\d*?(0{3,}\d$)/)) return Number(str.replace(/0{3,}\d$/, ""));
    if (str.match(/\.\d*?(9{3,}\d$)/)) {
      str = str.replace(/9{3,}\d$/, "").replace(/\d$/, value => `${parseInt(value) + 1}`);
      return Number(str) + (str.endsWith(".") ? 1 : 0);
    }
  }
  return num;
}

export function compareVersion(version1: string, version2: string): CompareResult {
  const a = version1.split(/[.-]/).map(value => /^\d+$/.test(value) ? Number(value) : value);
  const b = version2.split(/[.-]/).map(value => /^\d+$/.test(value) ? Number(value) : value);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left === right) continue;
    if (typeof left === "number" && typeof right === "number") return left > right ? 1 : -1;
    return String(left) > String(right) ? 1 : -1;
  }
  return 0;
}
