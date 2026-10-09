import { ComputedRef, inject, InjectionKey, provide, ref, Ref } from "vue";
import { Table } from "./table";
import { FormMode, TableProps } from "./types";

const TABLE: InjectionKey<Table> = Symbol("table");
const TABLE_PROPS: InjectionKey<TableProps> = Symbol("table_props");
const FORM_MODE: InjectionKey<ComputedRef<FormMode>> = Symbol("form_mode");

export const provideTable = (table: Table) => {
  provide(TABLE, table);
}

export const useTable = () => {
  return inject(TABLE);
}

export const provideTableProps = (props: TableProps) => {
  provide(TABLE_PROPS, props);
}

export const useTableProps = () => {
  return inject(TABLE_PROPS);
}

export const provideFormMode = (formMode: ComputedRef<FormMode>) => {
  provide(FORM_MODE, formMode);
}

export const useFormMode = () => {
  return inject(FORM_MODE, ref(FormMode.Add) as any);
}