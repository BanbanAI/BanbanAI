export function deepClone<T>(obj: T): T {
  if (typeof obj !== "object" || obj === null) return obj;
  const newObj = (Array.isArray(obj) ? [] : {}) as T;
  for (const key in obj as any) {
    const value = (obj as any)[key];
    (newObj as any)[key] = typeof value === "object" && value !== null ? deepClone(value) : value;
  }
  return newObj;
}

export function isEmpty<T>(obj: T): boolean {
  if (obj === undefined || obj === null) return true;
  if (typeof obj === "object") {
    if (Array.isArray(obj)) return obj.length === 0;
    if (obj instanceof Map) return obj.size === 0;
    return Object.keys(obj).length === 0;
  }
  return false;
}

export function equals<T>(obj1: T, obj2: T): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 === "number" && typeof obj2 === "number" && isNaN(obj1) && isNaN(obj2)) return true;
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    return obj1.length === obj2.length && obj1.every((value, index) => equals(value, obj2[index]));
  }
  if (obj1 !== null && obj2 !== null && typeof obj1 === "object" && typeof obj2 === "object") {
    const keys1 = Object.keys(obj1 as any);
    const keys2 = Object.keys(obj2 as any);
    return keys1.length === keys2.length && keys1.every(key => equals((obj1 as any)[key], (obj2 as any)[key]));
  }
  return false;
}

export function replace<T>(object: T, find: string, target: string) {
  if (!object || find === target || find === "") return false;
  let occur = false;
  for (const key in object as any) {
    const value = (object as any)[key];
    if (typeof value === "object" && value !== null) occur = replace(value, find, target) || occur;
    else if (typeof value === "string" && value.includes(find)) {
      (object as any)[key] = value.split(find).join(target);
      occur = true;
    }
    if (key.includes(find)) {
      const newKey = key.split(find).join(target);
      (object as any)[newKey] = (object as any)[key];
      delete (object as any)[key];
      occur = true;
    }
  }
  return occur;
}
