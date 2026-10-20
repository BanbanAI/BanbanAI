import { Injectable } from "@nestjs/common";

type FormDataAuditAction =
  | "addData"
  | "stashData"
  | "deleteData"
  | "deleteAllData"
  | "restoreData"
  | "purgeData"
  | "updateData"
  | "recalculateTableField"
  | "deleteTable"
  | "executeViewAction"
  | "createFormData"
  | "updateFormData"
  | "deleteFormData";

// 数据审计的直通实现：直接执行回调，不做审计记录。
@Injectable()
export class FormDataAuditService {
  async execute<T>(action: FormDataAuditAction, config: Record<string, unknown>, run: () => Promise<T>): Promise<T> {
    return await run();
  }
}
