import { FormWidgetType } from "@common/types/nocode"

export type LinkageFillFormElementLike = {
  uid?: string
  type?: string
  widgets?: LinkageFillFormElementLike[]
  children?: LinkageFillFormElementLike[]
}

type IncludeSubFormChildren<T extends LinkageFillFormElementLike> = boolean | ((subForm: T) => boolean)

type FlattenLinkageFillFormElementsOptions<T extends LinkageFillFormElementLike> = {
  includeSubFormElement?: boolean
  includeSubFormChildren?: IncludeSubFormChildren<T>
}

const getChildElements = <T extends LinkageFillFormElementLike>(element: T): T[] => {
  const children: T[] = []
  const seen = new Set<string | T>()

  const append = (items?: LinkageFillFormElementLike[]) => {
    if (!Array.isArray(items)) return
    for (const item of items as T[]) {
      if (!item) continue
      const key = item.uid || item
      if (seen.has(key)) continue
      seen.add(key)
      children.push(item)
    }
  }

  append(element.widgets)
  append(element.children)
  return children
}

const shouldIncludeSubFormChildren = <T extends LinkageFillFormElementLike>(
  includeSubFormChildren: IncludeSubFormChildren<T>,
  element: T,
) => {
  return typeof includeSubFormChildren === 'function'
    ? includeSubFormChildren(element)
    : includeSubFormChildren
}

export const flattenLinkageFillFormElements = <T extends LinkageFillFormElementLike>(
  elements: T[] = [],
  options: FlattenLinkageFillFormElementsOptions<T> = {},
): T[] => {
  const includeSubFormElement = options.includeSubFormElement ?? true
  const includeSubFormChildren = options.includeSubFormChildren ?? false
  const result: T[] = []

  for (const element of elements) {
    if (!element) continue

    if (element.type === FormWidgetType.MULTIPLE_TABS || element.type === FormWidgetType.TAB_PANEL) {
      result.push(...flattenLinkageFillFormElements(getChildElements(element), options))
      continue
    }

    if (element.type === FormWidgetType.SUBFORM) {
      if (includeSubFormElement) {
        result.push(element)
      }
      if (shouldIncludeSubFormChildren(includeSubFormChildren, element)) {
        result.push(...flattenLinkageFillFormElements(getChildElements(element), options))
      }
      continue
    }

    result.push(element)
  }

  return result
}
