import { HiddenFieldSubmitMode } from "@common/utils/hiddenFieldSubmitPolicy";
import { equals } from "@common/utils/object";

export type HiddenFieldSubmitStateInput = {
  fieldId: string;
  value: unknown;
  isBusinessHidden: boolean;
  mode: HiddenFieldSubmitMode;
};

export type HiddenFieldSubmitRestoreAction = {
  fieldId: string;
  value: unknown;
};

type HiddenFieldCycleState = {
  mode: HiddenFieldSubmitMode;
  snapshot?: unknown;
  frozenValue?: unknown;
};

const cloneValue = <T>(value: T): T => {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item)) as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((result, [key, item]) => {
    result[key] = cloneValue(item);
    return result;
  }, {}) as T;
};

export class HiddenFieldSubmitStateStore {
  private states = new Map<string, HiddenFieldCycleState>();

  sync(inputs: HiddenFieldSubmitStateInput[] = []): HiddenFieldSubmitRestoreAction[] {
    const actions: HiddenFieldSubmitRestoreAction[] = [];
    const currentFieldIds = new Set(inputs.map(item => item.fieldId));

    for (const input of inputs) {
      const previousState = this.states.get(input.fieldId);
      if (!input.isBusinessHidden) {
        // 重新显示时只恢复 keep-original 快照，显示动作本身不触发补算。
        if (previousState?.mode === HiddenFieldSubmitMode.KEEP_ORIGINAL) {
          actions.push({
            fieldId: input.fieldId,
            value: cloneValue(previousState.snapshot),
          });
        }
        this.states.delete(input.fieldId);
        continue;
      }

      if (!previousState || previousState.mode !== input.mode) {
        // 快照和冻结值都取进入本轮隐藏前的页面值，不能回退到数据库值。
        if (input.mode === HiddenFieldSubmitMode.KEEP_ORIGINAL) {
          const snapshot = cloneValue(input.value);
          this.states.set(input.fieldId, {
            mode: input.mode,
            snapshot,
            frozenValue: cloneValue(snapshot),
          });
        } else if (input.mode === HiddenFieldSubmitMode.EMPTY) {
          this.states.set(input.fieldId, {
            mode: input.mode,
            frozenValue: cloneValue(input.value),
          });
        } else {
          this.states.set(input.fieldId, { mode: input.mode });
        }
        continue;
      }

      if (
        previousState.mode !== HiddenFieldSubmitMode.RECALCULATE
        && !equals(previousState.frozenValue, input.value)
      ) {
        // 公式或异步联动若在隐藏期间写入冻结字段，立即恢复本轮冻结值。
        actions.push({
          fieldId: input.fieldId,
          value: cloneValue(previousState.frozenValue),
        });
      }
    }

    for (const fieldId of this.states.keys()) {
      if (!currentFieldIds.has(fieldId)) {
        this.states.delete(fieldId);
      }
    }

    return actions;
  }

  getSnapshot(fieldId: string) {
    const state = this.states.get(fieldId);
    if (state?.mode !== HiddenFieldSubmitMode.KEEP_ORIGINAL) {
      return { hasSnapshot: false, value: undefined };
    }
    return {
      hasSnapshot: true,
      value: cloneValue(state.snapshot),
    };
  }

  isFrozen(fieldId: string) {
    const mode = this.states.get(fieldId)?.mode;
    return mode === HiddenFieldSubmitMode.KEEP_ORIGINAL || mode === HiddenFieldSubmitMode.EMPTY;
  }

  clear() {
    this.states.clear();
  }
}
