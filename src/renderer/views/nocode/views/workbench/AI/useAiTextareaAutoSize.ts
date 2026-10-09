import type { Ref } from 'vue';

export const useAiTextareaAutoSize = (
  textareaRef: Ref<HTMLTextAreaElement | null>,
  maxRows = 3,
) => {
  const updateTextareaHeight = () => {
    const textarea = textareaRef.value;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const style = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(style.lineHeight) || 24;
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  return {
    updateTextareaHeight,
  };
};
