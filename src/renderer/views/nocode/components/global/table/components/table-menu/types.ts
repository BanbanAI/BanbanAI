import { MenuInstance } from "element-plus";
import { Component, inject, InjectionKey, provide, Ref } from "vue";

export interface MenuItem {
  index: string,
  clickTrigger?: boolean,
  children?: MenuItem[],
  title: string,
  disabled?: boolean,
  icon?: Component,
  click?: (event: MouseEvent) => void,
  visible?: boolean,
}
export type Menus = MenuItem[];

const TABLE_MENU: InjectionKey<Ref<MenuInstance>> = Symbol('tableMenu');
export const provideTableMenu = (data: Ref<MenuInstance>) => {
  provide(TABLE_MENU, data);
}

export const useTableMenu = () => {
  return inject(TABLE_MENU)
}
