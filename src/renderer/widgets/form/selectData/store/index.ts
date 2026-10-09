import { defineStore } from "pinia";

export const useSelectDataStore = defineStore("selectData", () => {
  return {
    show<T extends string = string>(key: T){
      this[key] = true;
    },
    close(key: string){
      this[key] = false;
    },
  }
})