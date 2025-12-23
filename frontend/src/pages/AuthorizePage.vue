<template>
  <div class="container">
    <div v-if="loading" style="text-align: center; padding: 60px">
      <div style="font-size: 48px; margin-bottom: 16px">🔐</div>
      <h2>Loading...</h2>
    </div>

    <div v-else-if="error" class="card">
      <h2 style="color: #dc3545">Authorization Error</h2>
      <p>{{ error }}</p>
      <button class="btn btn-primary" style="margin-top: 16px" @click="$router.push('/')">
        Go Home
      </button>
    </div>

    <div v-else-if="client" class="card" style="max-width: 600px; margin: 40px auto">
      <div style="text-align: center; margin-bottom: 24px">
        <div style="font-size: 64px; margin-bottom: 16px">🔐</div>
        <h1 style="margin-bottom: 8px">Authorize Application</h1>
        <p style="color: #666">{{ client.client_name }} is requesting access to your account</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 4px; margin-bottom: 24px">
        <h3 style="margin-bottom: 12px">Application Details</h3>
        <p><strong>App Name:</strong> {{ client.client_name }}</p>
        <p><strong>Client ID:</strong> {{ clientId }}</p>
        <p style="margin-top: 16px">
          <strong>Permissions Requested:</strong>
        </p>
        <ul style="margin-left: 20px; margin-top: 8px">
          <li>Access your profile information</li>
          <li>Browse packages on your behalf</li>
          <li>Download packages</li>
        </ul>
      </div>

      <div
        v-if="user"
        style="background: #e7f3ff; padding: 16px; border-radius: 4px; margin-bottom: 24px"
      >
        <p style="margin-bottom: 4px">
          <strong>Authorizing as:</strong>
        </p>
        <p style="font-size: 18px">{{ user.public_key?.substring(0, 32) }}...</p>
      </div>

      <div v-if="processing" style="text-align: center; padding: 20px">
        <p>Processing...</p>
      </div>

      <div v-else style="display: flex; gap: 12px; justify-content: center">
        <button class="btn btn-primary" style="min-width: 120px" @click="approve">
          ✅ Authorize
        </button>
        <button
          class="btn"
          style="min-width: 120px; background: #6c757d; color: white"
          @click="deny"
        >
          ❌ Deny
        </button>
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 24px; text-align: center">
        By authorizing, you allow this application to access your marketplace account. You can
        revoke access at any time from your dashboard.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineEmits } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const emit = defineEmits(['login']);

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref('');
const processing = ref(false);

const client = ref<any>(null);
const user = ref<any>(null);

const clientId = ref('');
const redirectUri = ref('');
const codeChallenge = ref('');
const codeChallengeMethod = ref('');
const state = ref('');

onMounted(async () => {
  await loadAuthorizationRequest();
});

async function loadAuthorizationRequest() {
  loading.value = true;
  error.value = '';

  try {
    // Get query parameters
    clientId.value = route.query.client_id as string;
    redirectUri.value = route.query.redirect_uri as string;
    codeChallenge.value = route.query.code_challenge as string;
    codeChallengeMethod.value = route.query.code_challenge_method as string;
    state.value = (route.query.state as string) || '';

    if (
      !clientId.value ||
      !redirectUri.value ||
      !codeChallenge.value ||
      !codeChallengeMethod.value
    ) {
      error.value = 'Missing required OAuth parameters';
      return;
    }

    // Check authentication - MUST have both user data and token
    const userData = localStorage.getItem('marketplace_user');
    const token = localStorage.getItem('marketplace_token');

    // If either is missing, clear both and redirect to login
    if (!userData || !token) {
      // Clear any stale data to prevent inconsistent state
      localStorage.removeItem('marketplace_user');
      localStorage.removeItem('marketplace_token');

      // Not logged in - redirect to login
      const loginUrl = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      router.push(loginUrl);
      return;
    }

    user.value = JSON.parse(userData);

    // Notify parent component that user is logged in (updates navbar)
    emit('login');

    // Get client info from backend
    const params = new URLSearchParams({
      client_id: clientId.value,
      redirect_uri: redirectUri.value,
      code_challenge: codeChallenge.value,
      code_challenge_method: codeChallengeMethod.value,
    });
    if (state.value) params.set('state', state.value);

    const res = await fetch(`/api/v1/oauth/authorize?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load authorization request');
    }

    const data = await res.json();
    client.value = data.client;
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function approve() {
  processing.value = true;
  error.value = '';

  try {
    const token = localStorage.getItem('marketplace_token');
    const res = await fetch('/api/v1/oauth/authorize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId.value,
        redirect_uri: redirectUri.value,
        code_challenge: codeChallenge.value,
        code_challenge_method: codeChallengeMethod.value,
        approved: true,
        state: state.value || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to authorize');
    }

    const data = await res.json();

    // Redirect back to client with authorization code
    window.location.href = data.redirect_uri;
  } catch (err: any) {
    error.value = err.message;
    processing.value = false;
  }
}

async function deny() {
  processing.value = true;
  error.value = '';

  try {
    const token = localStorage.getItem('marketplace_token');
    const res = await fetch('/api/v1/oauth/authorize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId.value,
        redirect_uri: redirectUri.value,
        approved: false,
        state: state.value || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to process denial');
    }

    const data = await res.json();

    // Redirect back to client with error
    window.location.href = data.redirect_uri;
  } catch (err: any) {
    error.value = err.message;
    processing.value = false;
  }
}
</script>
