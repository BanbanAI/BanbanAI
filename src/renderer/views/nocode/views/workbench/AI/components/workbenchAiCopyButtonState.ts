import { ref } from 'vue';

export const DEFAULT_COPY_FEEDBACK_RESET_DELAY = 1200;

type CopyFeedbackTimerApi = {
  setTimeout: typeof window.setTimeout;
  clearTimeout: typeof window.clearTimeout;
};

export const createCopyFeedbackState = (
  timerApi: CopyFeedbackTimerApi = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
  },
) => {
  const isCopied = ref(false);
  let resetTimer: number | null = null;

  const clearResetTimer = () => {
    if (resetTimer !== null) {
      timerApi.clearTimeout(resetTimer);
      resetTimer = null;
    }
  };

  const markCopied = () => {
    clearResetTimer();
    isCopied.value = true;
    resetTimer = timerApi.setTimeout(() => {
      isCopied.value = false;
      resetTimer = null;
    }, DEFAULT_COPY_FEEDBACK_RESET_DELAY);
  };

  const dispose = () => {
    clearResetTimer();
  };

  return {
    isCopied,
    markCopied,
    dispose,
  };
};
