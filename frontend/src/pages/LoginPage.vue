<template>
  <div class="container">
    <div class="card" style="max-width: 600px; margin: 40px auto">
      <h1>Login to Marketplace</h1>

      <p style="margin-bottom: 24px">Login with your key file to access the marketplace.</p>

      <div v-if="error" class="error">
        {{ error }}
      </div>

      <div
        v-if="success"
        class="warning"
        style="background: #d4edda; border-color: #c3e6cb; color: #155724"
      >
        {{ success }}
      </div>

      <!-- Step 1: Upload keyfile -->
      <div v-if="!keyData && !isLoggingIn">
        <h3>Step 1: Upload Your Key File</h3>

        <input type="file" accept=".pem" style="margin-bottom: 16px" @change="handleFileUpload" />

        <p style="font-size: 14px; color: #666">
          Upload the .pem file you downloaded during registration.
        </p>

        <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 4px">
          <p><strong>Or paste your keys manually:</strong></p>
          <textarea
            v-model="manualKey"
            placeholder="Paste the contents of your .pem file here..."
            rows="8"
            style="font-family: monospace; font-size: 12px"
          />
          <button
            class="btn btn-primary"
            :disabled="!manualKey.trim()"
            style="margin-top: 8px"
            @click="parseManualKey"
          >
            Use This Key
          </button>
        </div>
      </div>

      <!-- Step 2: Sign challenge -->
      <div v-if="keyData && !isLoggingIn">
        <h3>✅ Key File Loaded</h3>
        <p style="color: #28a745; margin-bottom: 16px">
          Public Key: {{ keyData.publicKey.substring(0, 16) }}...
        </p>

        <button class="btn btn-primary" style="width: 100%" @click="login">
          Login with This Key
        </button>

        <button
          class="btn"
          style="width: 100%; margin-top: 8px; background: #6c757d; color: white"
          @click="reset"
        >
          Use Different Key
        </button>
      </div>

      <!-- Step 3: Logging in -->
      <div v-if="isLoggingIn" style="text-align: center; padding: 40px">
        <div style="font-size: 48px; margin-bottom: 16px">🔐</div>
        <h3>Authenticating...</h3>
        <p style="color: #666">
          {{ loginStatus }}
        </p>
      </div>
    </div>

    <div class="card" style="max-width: 600px; margin: 0 auto; background: #e7f3ff">
      <h3>Don't have a key file?</h3>
      <p>If you haven't registered yet, you'll need to create an account first.</p>
      <router-link
        to="/register"
        class="btn btn-primary"
        style="margin-top: 12px; display: inline-block; text-decoration: none"
      >
        Register for Account
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { sha512 } from '@noble/hashes/sha2.js';
import * as ed25519Import from '@noble/ed25519';

type Ed25519Mutable = typeof ed25519Import & {
  hashes?: { sha512?: (...m: Uint8Array[]) => Uint8Array };
  etc?: {
    sha512Sync?: (...m: Uint8Array[]) => Uint8Array;
    sha512Async?: (...m: Uint8Array[]) => Promise<Uint8Array>;
  };
};

// Create a local mutable handle so bundlers don't see us mutating an import namespace.
const ed25519 = ed25519Import as Ed25519Mutable;

// CRITICAL: Set up SHA-512 IMMEDIATELY after imports, before any other code
// The @noble/ed25519 library requires this to be set before calling any functions
const sha512Impl = (...m: Uint8Array[]) => {
  const totalLength = m.reduce((acc, arr) => acc + arr.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of m) {
    combined.set(arr, offset);
    offset += arr.length;
  }
  return sha512(combined);
};

// Set on HASHES object (this is what the library checks!)
ed25519.hashes = { ...(ed25519.hashes ?? {}) };
ed25519.hashes.sha512 = sha512Impl;

// Also set on etc for good measure
ed25519.etc = { ...(ed25519.etc ?? {}) };
ed25519.etc.sha512Sync = sha512Impl;
ed25519.etc.sha512Async = (...m: Uint8Array[]) => Promise.resolve(sha512Impl(...m));

const router = useRouter();

const keyData = ref<{ publicKey: string; secretKey: string } | null>(null);
const manualKey = ref('');
const error = ref('');
const success = ref('');
const isLoggingIn = ref(false);
const loginStatus = ref('');

async function handleFileUpload(event: Event) {
  error.value = '';
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  try {
    const text = await file.text();
    parseKeyFile(text);
  } catch (err: any) {
    error.value = `Failed to read file: ${err.message}`;
  }
}

function parseManualKey() {
  error.value = '';
  parseKeyFile(manualKey.value);
}

function parseKeyFile(content: string) {
  try {
    // Extract public key
    const publicKeyMatch = content.match(/Public Key:\s*([a-f0-9]+)/i);
    if (!publicKeyMatch) {
      throw new Error('Could not find Public Key in file');
    }

    // Extract secret key
    const secretKeyMatch = content.match(/Secret Key[^:]*:\s*([a-f0-9]+)/i);
    if (!secretKeyMatch) {
      throw new Error('Could not find Secret Key in file');
    }

    keyData.value = {
      publicKey: publicKeyMatch[1],
      secretKey: secretKeyMatch[1],
    };

    success.value = 'Key file loaded successfully!';
  } catch (err: any) {
    error.value = `Failed to parse key file: ${err.message}`;
  }
}

async function login() {
  if (!keyData.value) return;

  isLoggingIn.value = true;
  error.value = '';
  success.value = '';

  try {
    // Step 1: Get challenge
    loginStatus.value = 'Requesting authentication challenge...';
    const challengeRes = await fetch(
      `/api/v1/auth/challenge?public_key=${keyData.value.publicKey}`
    );

    if (!challengeRes.ok) {
      const data = await challengeRes.json();
      throw new Error(data.error || 'Failed to get challenge');
    }

    const { challenge } = await challengeRes.json();
    loginStatus.value = 'Signing challenge...';

    // Step 2: Sign challenge
    // Ed25519 secret keys are 64 bytes (32-byte seed + 32-byte public key)
    // The sign() function needs only the first 32 bytes (the seed)
    const secretKeyBytes = hexToBytes(keyData.value.secretKey);
    const seedBytes = secretKeyBytes.slice(0, 32); // Use only the first 32 bytes
    const messageBytes = new TextEncoder().encode(challenge);

    // console.log('Signing challenge...', {
    //   seedLength: seedBytes.length,
    //   messageLength: messageBytes.length,
    //   sha512Configured: !!ed25519.etc.sha512Async,
    // });

    const signature = await ed25519.sign(messageBytes, seedBytes);
    const signatureHex = bytesToHex(signature);

    // Step 3: Submit signature
    loginStatus.value = 'Verifying signature...';
    const loginRes = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_key: keyData.value.publicKey,
        challenge,
        signature: signatureHex,
      }),
    });

    if (!loginRes.ok) {
      const data = await loginRes.json();
      throw new Error(data.error || 'Login failed');
    }

    const { token, user } = await loginRes.json();

    // Step 4: Store token (in memory only, for this session)
    sessionStorage.setItem('marketplace_token', token);
    sessionStorage.setItem('marketplace_user', JSON.stringify(user));

    loginStatus.value = 'Login successful!';
    success.value = `Welcome back! Redirecting...`;

    // Redirect to home or dashboard
    setTimeout(() => {
      router.push('/');
    }, 1500);
  } catch (err: any) {
    error.value = err.message;
    isLoggingIn.value = false;
  }
}

function reset() {
  keyData.value = null;
  manualKey.value = '';
  error.value = '';
  success.value = '';
}

// Helper functions
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
</script>
