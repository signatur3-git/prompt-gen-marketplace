<template>
  <div id="app">
    <nav>
      <div class="container">
        <router-link to="/" class="logo">🎨 Prompt Gen Marketplace</router-link>
        <div>
          <router-link to="/">Home</router-link>
          <router-link to="/packages">Packages</router-link>
          <router-link v-if="!isLoggedIn" to="/register">Register</router-link>
          <router-link v-if="!isLoggedIn" to="/login">Login</router-link>
          <router-link v-if="isLoggedIn" to="/publish">Publish</router-link>
          <router-link v-if="isLoggedIn" to="/dashboard">Dashboard</router-link>
        </div>
      </div>
    </nav>
    <router-view @login="checkLoginStatus" @logout="checkLoginStatus" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const isLoggedIn = ref(false);

onMounted(() => {
  checkLoginStatus();

  // Listen for storage events (logout in another tab)
  window.addEventListener('storage', checkLoginStatus);
});

function checkLoginStatus() {
  const token = sessionStorage.getItem('marketplace_token');
  isLoggedIn.value = !!token;
}

// Watch for route changes to update login status
router.afterEach(() => {
  checkLoginStatus();
});
</script>

