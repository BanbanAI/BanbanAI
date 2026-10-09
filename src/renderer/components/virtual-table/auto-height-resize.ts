export const DEFAULT_VIRTUAL_TABLE_AUTO_HEIGHT_RESIZE_SETTLE_MS = 120;

type AutoHeightResizeControllerOptions<TTimer> = {
  schedule: (callback: () => void, delayMs: number) => TTimer;
  cancel: (timer: TTimer) => void;
  onSettled: () => void;
  delayMs?: number;
};

export const createVirtualTableAutoHeightResizeController = <TTimer>(
  options: AutoHeightResizeControllerOptions<TTimer>,
) => {
  const delayMs = Math.max(
    0,
    Math.floor(Number(options.delayMs) || DEFAULT_VIRTUAL_TABLE_AUTO_HEIGHT_RESIZE_SETTLE_MS),
  );

  let timer: TTimer | null = null;
  let active = false;
  let generation = 0;

  const clearTimer = () => {
    if (timer == null) {
      return;
    }
    options.cancel(timer);
    timer = null;
  };

  const settle = (generationAtSchedule: number) => {
    if (generationAtSchedule !== generation) {
      return;
    }
    timer = null;
    active = false;
    options.onSettled();
  };

  return {
    request() {
      active = true;
      generation += 1;
      const nextGeneration = generation;
      clearTimer();
      timer = options.schedule(() => settle(nextGeneration), delayMs);
    },
    cancel() {
      generation += 1;
      active = false;
      clearTimer();
    },
    isActive() {
      return active;
    },
  };
};
