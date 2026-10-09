import type { TFunction, i18n } from 'i18next'

type RendererComponentCustomProperties = {
  $p: (key: string) => any
  $t: TFunction
  $i18next: i18n
}

declare module 'vue' {
  interface ComponentCustomProperties extends RendererComponentCustomProperties {}
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties extends RendererComponentCustomProperties {}
}

export {}
