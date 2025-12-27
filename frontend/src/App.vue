<template>
  <div id="app">
    <nav>
      <div class="container">
        <router-link to="/" class="logo"> 🎨 Prompt Gen Marketplace </router-link>
        <div style="display: flex; align-items: center; gap: 16px">
          <div>
            <router-link to="/"> Home </router-link>
            <router-link to="/packages"> Packages </router-link>
            <router-link v-if="!isLoggedIn" to="/register"> Register </router-link>
            <router-link v-if="!isLoggedIn" to="/login"> Login </router-link>
            <router-link v-if="isLoggedIn" to="/publish"> Publish </router-link>
            <router-link v-if="isLoggedIn" to="/dashboard"> Dashboard </router-link>
          </div>
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
    <router-view @login="checkLoginStatus" @logout="checkLoginStatus" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import ThemeSwitcher from './components/ThemeSwitcher.vue';

const router = useRouter();
const isLoggedIn = ref(false);
let pollInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  checkLoginStatus();

  // Listen for storage events from other tabs
  // NOTE: storage event only fires for changes from OTHER tabs, not same tab
  window.addEventListener('storage', checkLoginStatus);

  // Also poll periodically to catch any missed updates
  // This ensures tabs stay in sync even if events don't fire
  pollInterval = setInterval(checkLoginStatus, 1000); // Check every second
});

onUnmounted(() => {
  window.removeEventListener('storage', checkLoginStatus);
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});

function checkLoginStatus() {
  const token = localStorage.getItem('marketplace_token');
  const newLoginState = !!token;

  // Only update if state actually changed (prevents unnecessary re-renders)
  if (isLoggedIn.value !== newLoginState) {
    isLoggedIn.value = newLoginState;
  }
}

// Watch for route changes to update login status
router.afterEach(() => {
  checkLoginStatus();
});
</script>
