import { FieldUID, OptionTableUID } from "@common/types/project";

export interface RelatedData {
  getRelatedRows(fieldUID: FieldUID, uuids: string[]): object[];
  getRelatedRowKey(fieldUID: FieldUID): FieldUID;
  getRelatedTitleFieldUID(fieldUID: FieldUID): FieldUID;
  getRelatedTableUID(fieldUID: FieldUID): OptionTableUID;
}