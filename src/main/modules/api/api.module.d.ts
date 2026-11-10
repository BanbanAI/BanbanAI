// 社区版类型声明：实现为同目录混淆产物 api.module.js
export declare class ApiModule {}
export declare class ApiException extends Error {
  constructor(message: string, details?: object, code?: number);
  message: string;
  details: object;
  code: number;
  toJson(): { code: number; message: string; details: object };
}
