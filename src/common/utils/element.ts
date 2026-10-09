import { FieldAuthValue } from "@common/types/nocode";
import { FieldUID, WidgetSoul } from "@common/types/project";

export const findWidgetSoulByUID = (souls: WidgetSoul[], uid: string): WidgetSoul => {
  if (!uid) return null;
  for (const soul of souls || []) {
    if (!soul) continue;
    if (soul.uid === uid) return soul;
    const find = findWidgetSoulByUID(soul.widgets || [], uid);
    if (find) return find;
  }
  return null;
}

const resolveFieldAuthValue = (value: unknown): number => {
  if (value === FieldAuthValue.VISIBLE_EDITABLE) return FieldAuthValue.VISIBLE_EDITABLE;
  if (value === FieldAuthValue.VISIBLE) return FieldAuthValue.VISIBLE;
  return 0;
}

export const assignFieldsAuth = (
  fieldsAuth: Record<FieldUID, FieldAuthValue | number>,
  auth: Record<FieldUID, FieldAuthValue | number | null | undefined>,
) => {
  for (const key in auth) {
    const nextValue = resolveFieldAuthValue(auth[key]);
    if (!(key in fieldsAuth)) {
      fieldsAuth[key] = nextValue;
      continue;
    }
    const currentValue = resolveFieldAuthValue(fieldsAuth[key]);
    if (nextValue < currentValue) {
      fieldsAuth[key] = nextValue;
    }
  }
}
