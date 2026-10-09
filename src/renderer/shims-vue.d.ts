declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.xlsx' {
  const src: string;
  export default src;
}

interface Window {
  close: Function;
  hide: Function;
  closeAnyway: Function;
}

type GetElementType<T> = T extends (infer U)[] ? U : never;
