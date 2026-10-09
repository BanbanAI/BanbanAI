import type { FormElement } from "@renderer/b2/controllers/form";

const getInheritedIsReadonlyDescriptor = (widget: FormElement): PropertyDescriptor | null => {
  let currentPrototype: object | null = Object.getPrototypeOf(widget);

  while (currentPrototype) {
    const descriptor = Object.getOwnPropertyDescriptor(currentPrototype, "isReadonly");
    if (descriptor?.get) {
      return descriptor;
    }
    currentPrototype = Object.getPrototypeOf(currentPrototype);
  }

  return null;
};

export const attachMockWidgetReadonlyBridge = (mockWidget: FormElement, templateWidget: FormElement) => {
  const inheritedDescriptor = getInheritedIsReadonlyDescriptor(mockWidget);

  Object.defineProperty(mockWidget, "isReadonly", {
    configurable: true,
    enumerable: inheritedDescriptor?.enumerable ?? false,
    get() {
      const rowReadonly = inheritedDescriptor?.get ? !!inheritedDescriptor.get.call(this) : false;
      return rowReadonly || templateWidget.isReadonly;
    }
  });
};
