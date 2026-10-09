import i18next from 'i18next';
import { onBeforeUnmount, onMounted } from 'vue';

export const useLocalizedDocumentTitle = (getTitle: () => string) => {
  const updateTitle = () => {
    document.title = getTitle();
  };

  updateTitle();
  onMounted(() => i18next.on('languageChanged', updateTitle));
  onBeforeUnmount(() => i18next.off('languageChanged', updateTitle));
};
