import type { Ref } from "vue";
import { unref } from "vue";

type MaybeRefBoolean = boolean | Ref<boolean>;

type ResolveNocodeTableEditingRuntimeStateOptions = {
  isCellEdit: MaybeRefBoolean;
  isAdmin: MaybeRefBoolean;
};

export const resolveNocodeTableEditingRuntimeState = (
  options: ResolveNocodeTableEditingRuntimeStateOptions,
) => ({
  isCellEdit: Boolean(unref(options.isCellEdit)),
  isAdmin: Boolean(unref(options.isAdmin)),
});
