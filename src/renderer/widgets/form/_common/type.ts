import { FieldUID } from "@common/types/project";
import { TableUID } from "@common/types/project";

export enum FormTableRowHeight {
    AUTO = "auto",
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large"
}

export enum FormMode {
  Edit = 'edit',
  Add = 'add'
}

export type DistinctFields = { baseTable: FieldUID[], subTables: Record<TableUID, FieldUID[]> }