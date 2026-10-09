import {
  AnyEntity,
  EntityProperty,
  MetadataStorage,
  MetadataValidator,
  PrimaryKey as MikroPrimaryKey,
  PrimaryKeyOptions as MikroPrimaryKeyOptions,
  ReferenceType,
  Utils,
} from "@mikro-orm/core";

export interface PrimaryKeyOptions<T> extends MikroPrimaryKeyOptions<T> {
  mongoLike?: boolean;
}

export function PrimaryKey<T>(options: PrimaryKeyOptions<T> = {}) {
  if (options.mongoLike === false) {
    return MikroPrimaryKey(options);
  }

  return function (target: AnyEntity, propertyName: string) {
    const meta = MetadataStorage.getMetadataFromDecorator(target.constructor);
    const phantomKey = "_id_";

    Object.defineProperty(target.constructor.prototype, "_id", {
      get() {
        if (!this[phantomKey]) {
          this[phantomKey] = this[propertyName];
        }
        return this[phantomKey];
      },
      set(value) {
        this[phantomKey] = value;
      },
      configurable: false,
      enumerable: false,
    });

    const type = Reflect.getMetadata("design:type", target, propertyName);
    Reflect.defineMetadata("design:type", type, target, "_id");

    MetadataValidator.validateSingleDecorator(meta, "_id", ReferenceType.SCALAR);
    meta.properties["_id"] = Object.assign(
      { name: "_id", reference: ReferenceType.SCALAR },
      { ...options, primary: true },
    ) as EntityProperty;

    MetadataValidator.validateSingleDecorator(meta, propertyName, ReferenceType.SCALAR);
    meta.properties[propertyName] = Object.assign(
      { name: propertyName, reference: ReferenceType.SCALAR },
      { ...options, serializedPrimaryKey: true },
    ) as EntityProperty;

    return Utils.propertyDecoratorReturnValue();
  };
}
