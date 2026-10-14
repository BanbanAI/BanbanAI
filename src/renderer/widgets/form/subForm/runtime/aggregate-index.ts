import { RowStore } from "./row-store";
import { ChangeSet, RowId } from "./types";

export type AggregateType = "SUM" | "COUNT" | "AVG" | "MAX" | "MIN";
export type AggregateDefinition = {
  readonly id: string;
  readonly fieldId: string;
  readonly type: AggregateType;
};

type AggregateState = {
  definition: AggregateDefinition;
  value: number | null;
  revision: number;
  values: Map<RowId, unknown>;
};

const isCountable = (value: unknown) => value !== undefined && value !== null && value !== "";
const asNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : Number(value);

export class AggregateIndex {
  private readonly states = new Map<string, AggregateState>();
  private readonly stopListening: () => boolean;

  constructor(private readonly store: RowStore, definitions: readonly AggregateDefinition[]) {
    for (const definition of definitions) {
      const values = new Map<RowId, unknown>();
      for (const rowId of store.rowIds) values.set(rowId, store.getValue({ rowId, fieldId: definition.fieldId }));
      const state: AggregateState = { definition, values, value: null, revision: 0 };
      this.states.set(definition.id, state);
      state.value = this.calculate(state);
    }
    this.stopListening = store.subscribe(changeSet => this.apply(changeSet));
  }

  get(id: string) {
    return this.states.get(id)?.value;
  }

  getRevision(id: string) {
    return this.states.get(id)?.revision || 0;
  }

  dispose() {
    this.stopListening();
    this.states.clear();
  }

  private apply(changeSet: ChangeSet) {
    for (const state of this.states.values()) {
      const { fieldId } = state.definition;
      for (const rowId of changeSet.deletedRows) state.values.delete(rowId);
      for (const rowId of changeSet.addedRows) {
        state.values.set(rowId, this.store.getValue({ rowId, fieldId }));
      }
      for (const change of changeSet.changes) {
        if (change.address.fieldId === fieldId && !changeSet.deletedRows.includes(change.address.rowId)) {
          state.values.set(change.address.rowId, change.newValue);
        }
      }
      const nextValue = this.calculate(state);
      if (!Object.is(nextValue, state.value)) {
        state.value = nextValue;
        state.revision += 1;
      }
    }
  }

  private calculate(state: AggregateState): number | null {
    const values = [...state.values.values()];
    switch (state.definition.type) {
      case "COUNT":
        return values.filter(isCountable).length;
      case "SUM": {
        const numbers = values.map(asNumber).filter(Number.isFinite);
        return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) : null;
      }
      case "AVG": {
        const numbers = values.map(asNumber).filter(Number.isFinite);
        return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
      }
      case "MAX": {
        const numbers = values.map(asNumber).filter(Number.isFinite);
        return numbers.length ? Math.max(...numbers) : null;
      }
      case "MIN": {
        const numbers = values.map(asNumber).filter(Number.isFinite);
        return numbers.length ? Math.min(...numbers) : null;
      }
    }
  }
}

