export type SerialNumberCounterState = {
  count?: number;
  resetTime?: number | null;
  updateTime?: number | null;
}

export type RuntimeState = {
  version: 1;
  serialNumber: {
    counters: Record<string, Record<string, SerialNumberCounterState>>;
  };
}

export type MergeSerialNumberRuntimeStateResult = {
  runtimeState: RuntimeState;
  changed: boolean;
}

const cloneCounter = (counter?: SerialNumberCounterState | null): SerialNumberCounterState => {
  const clonedCounter: SerialNumberCounterState = {};
  if (counter?.count !== undefined) {
    clonedCounter.count = counter.count;
  }
  if (counter?.resetTime !== undefined) {
    clonedCounter.resetTime = counter.resetTime;
  }
  if (counter?.updateTime !== undefined) {
    clonedCounter.updateTime = counter.updateTime;
  }
  return clonedCounter;
};

const cloneRuntimeState = (runtimeState: RuntimeState): RuntimeState => {
  const counters: RuntimeState["serialNumber"]["counters"] = {};

  for (const [tableId, fieldCounters] of Object.entries(runtimeState?.serialNumber?.counters || {})) {
    counters[tableId] = {};
    for (const [fieldId, counter] of Object.entries(fieldCounters || {})) {
      counters[tableId][fieldId] = cloneCounter(counter);
    }
  }

  return {
    version: 1,
    serialNumber: { counters },
  };
};

export const mergeNewerSerialNumberRuntimeState = (
  currentRuntimeState: RuntimeState,
  submittedRuntimeState: RuntimeState,
): MergeSerialNumberRuntimeStateResult => {
  const runtimeState = cloneRuntimeState(currentRuntimeState);
  let changed = false;

  for (const [tableId, submittedFieldCounters] of Object.entries(submittedRuntimeState?.serialNumber?.counters || {})) {
    for (const [fieldId, submittedCounter] of Object.entries(submittedFieldCounters || {})) {
      const submittedUpdateTime = submittedCounter?.updateTime;
      if (typeof submittedUpdateTime !== "number" || !Number.isFinite(submittedUpdateTime)) {
        continue;
      }

      const currentCounter = runtimeState.serialNumber.counters?.[tableId]?.[fieldId];
      const currentUpdateTime = typeof currentCounter?.updateTime === "number"
        ? currentCounter.updateTime
        : 0;
      if (submittedUpdateTime <= currentUpdateTime) {
        continue;
      }

      if (!runtimeState.serialNumber.counters[tableId]) {
        runtimeState.serialNumber.counters[tableId] = {};
      }
      runtimeState.serialNumber.counters[tableId][fieldId] = cloneCounter({
        ...currentCounter,
        ...submittedCounter,
      });
      changed = true;
    }
  }

  return { runtimeState, changed };
};
