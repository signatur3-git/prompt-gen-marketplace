<template>
  <div class="theme-switcher">
    <button
      class="theme-btn"
      :class="{ active: currentTheme === 'auto' }"
      title="Auto (OS settings)"
      @click="setTheme('auto')"
    >
      🔄
    </button>
    <button
      class="theme-btn"
      :class="{ active: currentTheme === 'light' }"
      title="Light mode"
      @click="setTheme('light')"
    >
      ☀️
    </button>
    <button
      class="theme-btn"
      :class="{ active: currentTheme === 'dark' }"
      title="Dark mode"
      @click="setTheme('dark')"
    >
      🌙
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '../composables/useTheme';

const { currentTheme, setTheme } = useTheme();
</script>

<style scoped>
.theme-switcher {
  display: flex;
  gap: 4px;
  background: var(--bg-primary);
  padding: 4px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.theme-btn {
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.theme-btn.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}
</style>
