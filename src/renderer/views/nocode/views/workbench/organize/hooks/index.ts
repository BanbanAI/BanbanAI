import { provide, InjectionKey, Ref, inject } from "vue";
import { ArchitectureContext } from "../types";


const ACTIVE_ORGANIZE_TAB: InjectionKey<Ref<string>> = Symbol("activeOrganizeTab");
const ARCHITECTURE_CONTEXT: InjectionKey<ArchitectureContext> = Symbol("architectureContext");

export const provideActiveOrganizeTab = (data: Ref<string>) => {
  provide(ACTIVE_ORGANIZE_TAB, data);
}
export const useActiveOrganizeTab = () => {
  return inject(ACTIVE_ORGANIZE_TAB);
}

export const provideArchitectureContext = (data) => {
  provide(ARCHITECTURE_CONTEXT, data); 
}

export const useArchitectureContext = () => {
  return inject(ARCHITECTURE_CONTEXT);
}
