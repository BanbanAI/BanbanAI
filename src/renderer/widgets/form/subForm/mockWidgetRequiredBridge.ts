import type { FormElement } from "@renderer/b2/controllers/form";

const getInheritedIsRequiredDescriptor = (widget: FormElement): PropertyDescriptor | null => {
  let currentPrototype: object | null = Object.getPrototypeOf(widget);

  while (currentPrototype) {
    const descriptor = Object.getOwnPropertyDescriptor(currentPrototype, "isRequired");
    if (descriptor?.get) {
      return descriptor;
    }
    currentPrototype = Object.getPrototypeOf(currentPrototype);
  }

  return null;
};

export const attachMockWidgetRequiredBridge = (mockWidget: FormElement, templateWidget: FormElement) => {
  const inheritedDescriptor = getInheritedIsRequiredDescriptor(mockWidget);

  Object.defineProperty(mockWidget, "isRequired", {
    configurable: true,
    enumerable: inheritedDescriptor?.enumerable ?? false,
    get() {
      const rowRequired = inheritedDescriptor?.get ? !!inheritedDescriptor.get.call(this) : false;
      const processRequired = (templateWidget as any)?._isRequiredInProcess?.value === true;
      return rowRequired || processRequired;
    }
  });
};
