import { TableUID } from "@common/types/project";
import { SystemField } from "@common/utils";

export type CalculateParam = {
  handle: string,
  data: any,
}

export default async function handleCalculate(params: CalculateParam): Promise<any> {
  if (params.handle === "fillSubFormData") {
    const { buckets, rows, fieldsMap, UUIDField } = params.data;
    for (const bucket of buckets) {
      const fieldUID = fieldsMap.get(bucket.tableId as TableUID);
      const keyField = bucket.fields.find(f => f.meta.name === SystemField.KEY)
      for (const row of rows) {
        row[fieldUID] = bucket.rows?.filter(r => r[keyField.uid] === row[UUIDField?.uid]) ?? row[fieldUID];
      }
    }
    return rows;
  }
}