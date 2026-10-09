export type RecordMatrix<R = any> = Map<string, Map<string, R>>;

export interface DrillNode {
  key: string;
  value: string;
  path: string[];
  leafDepth?: number;
  children?: DrillNode[];
  hasChild?: boolean;
}

export interface BuildingCtx {
  peculiarity: Set<string>;
}
