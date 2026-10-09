import { DefinedOption, DefinedOptionCluster, DefinedOptionGroups, DefinedOptionSubgroup } from "@renderer/b2/types";
import { ProcessNode } from "../process/process";

export type DefinedProcessOptionItem = (DefinedOption<ProcessNode> & {
  required?: boolean,
});
export type DefinedProcessOptionItems = DefinedProcessOptionItem[];
export type DefinedProcessOptions = {
  node?: DefinedProcessOptionItems,
  process?: DefinedProcessOptionItems,
}


export interface DefinedProcessOption extends DefinedOption<ProcessNode> {

}
