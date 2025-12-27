<template>
  <div class="container">
    <!-- Logged in status -->
    <div
      v-if="isLoggedIn"
      class="card"
      style="background: var(--success-bg, #d4edda); border-color: var(--success-border, #c3e6cb)"
    >
      <h3 style="color: var(--success-text, #155724); margin-bottom: 8px">✅ Logged In</h3>
      <p style="color: var(--success-text, #155724)">
        Welcome back! You're authenticated with public key:
        {{ user?.public_key?.substring(0, 16) }}...
      </p>
      <button class="btn btn-danger" style="margin-top: 12px" @click="logout">Logout</button>
    </div>

    <!-- Main hero -->
    <div class="card" style="text-align: center; padding: 60px 24px">
      <h1 style="font-size: 48px; margin-bottom: 16px">🎨 Prompt Gen Marketplace</h1>
      <p style="font-size: 20px; color: #666; margin-bottom: 32px">
        Publish and discover prompt generation packages
      </p>

      <div
        v-if="!isLoggedIn"
        style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap"
      >
        <router-link to="/register" class="btn btn-primary" style="text-decoration: none">
          Get Started
        </router-link>
        <router-link to="/login" class="btn btn-secondary" style="text-decoration: none">
          Login
        </router-link>
      </div>

      <div v-else style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap">
        <router-link to="/packages" class="btn btn-primary" style="text-decoration: none">
          📦 Browse Packages
        </router-link>
        <router-link to="/dashboard" class="btn btn-secondary" style="text-decoration: none">
          ⚙️ My Dashboard
        </router-link>
      </div>
    </div>

    <!-- ... rest of existing content ... -->
    <div
      style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 40px;
      "
    >
      <div class="card">
        <h2>📦 Publish Packages</h2>
        <p>
          Share your prompt generation packages with the community. Use semantic versioning and
          dependency management.
        </p>
      </div>

      <div class="card">
        <h2>🔍 Discover</h2>
        <p>
          Browse thousands (&#128517; soon &#8482;) of packages created by the community. Find the
          perfect package for your needs.
        </p>
      </div>

      <div class="card">
        <h2>🔐 Secure</h2>
        <p>
          Keypair-based authentication with no passwords. Challenge-response prevents replay
          attacks.
        </p>
      </div>
    </div>

    <div class="card" style="margin-top: 40px">
      <h2>How It Works</h2>
      <ol style="margin-left: 20px; line-height: 2">
        <li><strong>Register:</strong> Create an account and download your key file</li>
        <li><strong>Publish:</strong> Upload your packages using the web UI or CLI</li>
        <li><strong>Download:</strong> Install packages in prompt-gen-web or prompt-gen-desktop</li>
        <li><strong>Collaborate:</strong> Build on packages created by others</li>
      </ol>
    </div>

    <div class="card" style="margin-top: 20px; background: var(--bg-tertiary)">
      <h3>✨ Features</h3>
      <ul style="margin-left: 20px; line-height: 1.8">
        <li>Semantic versioning with dependency resolution</li>
        <li>Locked manifests for reproducible builds</li>
        <li>Namespace protection (public, protected, private)</li>
        <li>Multiple personas per user</li>
        <li>OAuth integration for webapps</li>
        <li>Package signing and verification</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

interface User {
  id: string;
  public_key: string;
  created_at: string;
  is_admin?: boolean;
}

const router = useRouter();
const isLoggedIn = ref(false);
const user = ref<User | null>(null);

onMounted(() => {
  checkLoginStatus();
});

function checkLoginStatus() {
  const token = localStorage.getItem('marketplace_token');
  const userData = localStorage.getItem('marketplace_user');

  if (token && userData) {
    isLoggedIn.value = true;
    user.value = JSON.parse(userData) as User;
  }
}

function logout() {
  localStorage.removeItem('marketplace_token');
  localStorage.removeItem('marketplace_user');
  isLoggedIn.value = false;
  user.value = null;
  router.push('/');
}
</script>
