import * as description from "symbol.prototype.description"
if (!Symbol("desc").description) {
  description.shim();
}

if (!globalThis.FinalizationRegistry) {
  globalThis.FinalizationRegistry = class <T> {
    readonly [Symbol.toStringTag]: "FinalizationRegistry";
    register(target: object, heldValue: T, unregisterToken?: object) {}
    unregister(nregisterToken: object) {}
  }
}

if (!globalThis.WeakRef) {
  globalThis.WeakRef = class <T> {
    readonly [Symbol.toStringTag]: "WeakRef";
    deref(): T | undefined {
      return undefined;
    }
  }
}