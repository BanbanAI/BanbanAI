import type { OptionTableUID } from "@common/types/project";

export const resolveRefreshOptionTableUIDs = (
  loadedOptionTableUIDs: OptionTableUID[],
  explicitOptionTableUIDs?: OptionTableUID[],
) => {
  const optionTableUIDs = explicitOptionTableUIDs ?? loadedOptionTableUIDs;
  return Array.from(new Map(
    optionTableUIDs
      .filter(optionTableUID => optionTableUID?.[0] && optionTableUID?.[1])
      .map(optionTableUID => [`${optionTableUID[0]}__${optionTableUID[1]}`, optionTableUID]),
  ).values());
};

export const waitForAll = async (promises: Promise<unknown>[]) => {
  const results = await Promise.allSettled(promises);
  const rejectedResult = results.find(result => result.status === "rejected");
  if (rejectedResult?.status === "rejected") throw rejectedResult.reason;
};

type RefreshTaskOwner = {
  getting?: boolean,
  refreshTask?: {
    resolve: () => void,
    reject: (error: unknown) => void,
  },
};

export const settleRefreshTask = (owner: RefreshTaskOwner, error?: unknown) => {
  const refreshTask = owner.refreshTask;
  owner.refreshTask = undefined;
  owner.getting = false;
  if (error === undefined) {
    refreshTask?.resolve();
  } else {
    refreshTask?.reject(error);
  }
};

export const createTrailingSingleFlightRunner = <TArgs extends unknown[], TResult>(
  task: (...args: TArgs) => Promise<TResult>,
) => {
  let activePromise: Promise<TResult> | undefined;
  let pendingArgs: TArgs | undefined;

  return (...args: TArgs) => {
    if (activePromise) {
      pendingArgs = args;
      return activePromise;
    }

    const promise = (async () => {
      let currentArgs: TArgs | undefined = args;
      let result: TResult;
      while (currentArgs) {
        pendingArgs = undefined;
        result = await task(...currentArgs);
        currentArgs = pendingArgs;
      }
      return result;
    })().finally(() => {
      if (activePromise === promise) activePromise = undefined;
    });
    activePromise = promise;
    return promise;
  };
};

export const createKeyedSingleFlightRunner = <TKey, TArgs extends unknown[], TResult>(
  task: (key: TKey, ...args: TArgs) => Promise<TResult>,
) => {
  const activePromises = new Map<TKey, Promise<TResult>>();

  const run = (key: TKey, ...args: TArgs) => {
    const activePromise = activePromises.get(key);
    if (activePromise) return activePromise;

    const promise = Promise.resolve().then(() => task(key, ...args)).finally(() => {
      if (activePromises.get(key) === promise) activePromises.delete(key);
    });
    activePromises.set(key, promise);
    return promise;
  };

  run.clear = () => activePromises.clear();
  return run;
};
