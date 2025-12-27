<template>
  <div class="container">
    <div class="card" style="max-width: 600px; margin: 40px auto">
      <h1>Register for Marketplace</h1>

      <p style="margin-bottom: 24px">
        Create your marketplace account to publish and download packages.
      </p>

      <div v-if="error" class="error">
        {{ error }}
      </div>

      <form v-if="!keyfile" @submit.prevent="register">
        <label>
          Persona Name:
          <input
            v-model="personaName"
            type="text"
            placeholder="e.g., 'John Doe' or 'Anonymous'"
            required
          />
        </label>
        <p style="font-size: 14px; color: #666; margin: -8px 0 16px 0">
          This is your public identity on the marketplace. You can create additional personas later.
        </p>

        <button
          type="submit"
          class="btn btn-primary"
          :disabled="loading || !personaName.trim()"
          style="width: 100%"
        >
          {{ loading ? 'Creating Account...' : 'Create Account' }}
        </button>
      </form>
    </div>

    <!-- Key Download Modal -->
    <div v-if="keyfile" class="modal">
      <div class="modal-content">
        <h2>⚠️ SAVE YOUR KEY FILE</h2>

        <div class="warning">
          <p><strong>CRITICAL:</strong> This is your ONLY copy of the secret key.</p>
          <p style="margin-top: 8px">We CANNOT recover it if you lose it!</p>
          <p style="margin-top: 8px">Without this key, you cannot:</p>
          <ul style="margin-left: 20px; margin-top: 8px">
            <li>Login to your account</li>
            <li>Publish packages</li>
            <li>Manage your namespaces</li>
          </ul>
        </div>

        <p style="margin: 16px 0">Click the button below to download your key file:</p>

        <button
          class="btn btn-primary"
          style="width: 100%; margin-bottom: 16px"
          @click="downloadKey"
        >
          📥 Download Key File ({{ keyfile.filename }})
        </button>

        <div
          style="
            background: var(--bg-code);
            padding: 12px;
            border-radius: 4px;
            margin: 16px 0;
            font-family: monospace;
            font-size: 12px;
            word-break: break-all;
            border: 1px solid var(--border-color);
          "
        >
          {{ keyfile.content.substring(0, 100) }}...
        </div>

        <label>
          <input v-model="confirmed" type="checkbox" />
          <strong>I have saved my key file and understand I cannot recover it</strong>
        </label>

        <button
          :disabled="!confirmed"
          class="btn btn-primary"
          style="width: 100%"
          @click="complete"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const personaName = ref('');
const loading = ref(false);
const error = ref('');
const keyfile = ref<{ filename: string; content: string } | null>(null);
const confirmed = ref(false);

async function register() {
  loading.value = true;
  error.value = '';

  try {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona_name: personaName.value.trim(),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Registration failed');
    }

    const data = await res.json();
    keyfile.value = data.keyfile;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Registration failed';
  } finally {
    loading.value = false;
  }
}

function downloadKey() {
  if (!keyfile.value) return;

  const blob = new Blob([keyfile.value.content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = keyfile.value.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function complete() {
  if (!confirmed.value) return;

  // Clear the keyfile from memory
  keyfile.value = null;

  // Redirect to login page
  router.push('/login');
}
</script>
