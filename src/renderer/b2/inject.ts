import { InjectionKey, Ref } from "vue";
import { Element } from "@renderer/b2/controllers/element";

export const OPTION_ELEMENT: InjectionKey<Element | Ref<Element>> = Symbol();
export const GET_OPTION_VALUE: InjectionKey<() => any> = Symbol();
export const UPDATE_OPTION: InjectionKey<(value: any, type?: 'transient') => void> = Symbol();
export const GET_DEFAULT_OPTION_VALUE: InjectionKey<() => any> = Symbol();
export const IS_OPTION_GROUP_UNFOLD: InjectionKey<Ref<boolean>> = Symbol();
export const IS_OPTION_GROUP_DISABLE: InjectionKey<Ref<boolean>> = Symbol();
export const BULK_UPDATE_VALUE: InjectionKey<(callback: (element: Element)=> void) => void> = Symbol();
