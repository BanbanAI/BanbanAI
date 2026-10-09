import { Row, TableUID } from '@common/types/project';
import { RenderContentContext } from 'element-plus';

export type TreeNode = RenderContentContext['node'];

export type CustomNodeData = {
  id: string,
  label: string,
  type: 'document' | 'catalog',
  parentIds: string[],
  tableId: TableUID,
  rename: boolean,
  hover: boolean,
  sort: number,
  row: Row,
  children?: CustomNodeData[],
  num?: number,
  canContainChildren?: boolean,
};

export type CommandHandles = {
  addCatalog: Function
  addDocument: Function,
  addDocumentAbove?: Function,
  addDocumentBelow?: Function,
  copyNode: Function,
  renameNode: Function,
  deleteNode: Function
}
