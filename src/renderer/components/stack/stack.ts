import { InjectionKey, Ref } from "vue";

export type StackContext = {
  tabs: string[];
  layers: string[];
  autoOpen: boolean;
  currentName: Ref<string>;
  close: (name: string) => void;
  closed: (name: string) => void;
  beforeLeave: (name: string) => Promise<boolean>;
};

export const stackContextKey: InjectionKey<StackContext> = Symbol("stackContextKey");
