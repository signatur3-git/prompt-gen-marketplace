import { ref, onMounted } from 'vue';

export type Theme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'prompt-gen-theme';
const currentTheme = ref<Theme>('auto');

export function useTheme() {
  const applyTheme = (theme: Theme) => {
    currentTheme.value = theme;
    localStorage.setItem(STORAGE_KEY, theme);

    // Remove any existing theme attribute
    document.documentElement.removeAttribute('data-theme');

    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    // If 'auto', the CSS @media (prefers-color-scheme) will handle it
  };

  const setTheme = (theme: Theme) => {
    applyTheme(theme);
  };

  const getSystemTheme = (): 'light' | 'dark' => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };

  const getEffectiveTheme = (): 'light' | 'dark' => {
    if (currentTheme.value === 'auto') {
      return getSystemTheme();
    }
    return currentTheme.value;
  };

  onMounted(() => {
    // Load saved theme or default to auto
    const savedTheme = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initialTheme = savedTheme || 'auto';
    applyTheme(initialTheme);

    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        if (currentTheme.value === 'auto') {
          // Force re-apply to update any reactive components
          applyTheme('auto');
        }
      };
      mediaQuery.addEventListener('change', handler);
    }
  });

  return {
    currentTheme,
    setTheme,
    getEffectiveTheme,
    getSystemTheme,
  };
}
