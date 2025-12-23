<template>
  <div class="container">
    <h1>Dashboard</h1>

    <div v-if="!isLoggedIn" class="card">
      <h2>Please Login</h2>
      <p>You need to be logged in to access the dashboard.</p>
      <router-link
        to="/login"
        class="btn btn-primary"
        style="text-decoration: none; display: inline-block; margin-top: 12px"
      >
        Go to Login
      </router-link>
    </div>

    <div v-else>
      <div v-if="error" class="error">
        {{ error }}
      </div>

      <!-- Admin Section (only visible to admins) -->
      <div v-if="isAdmin" class="card" style="background: #fff3cd; border-color: #ffc107">
        <h2>🛡️ Admin Tools</h2>
        <p style="color: #856404">You have administrator privileges.</p>
        <div style="display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap">
          <button
            :class="['btn', activeTab === 'users' ? 'btn-primary' : '']"
            @click="activeTab = 'users'"
          >
            👥 Manage Users
          </button>
          <button
            :class="['btn', activeTab === 'packages' ? 'btn-primary' : '']"
            @click="activeTab = 'packages'"
          >
            📦 Moderate Packages
          </button>
        </div>
      </div>

      <!-- Admin Views (top-level, not nested under personas) -->
      <div v-if="isAdmin && activeTab === 'users'">
        <div class="card">
          <h2>👥 User Management</h2>
          <p style="color: #666; margin-bottom: 16px">
            View all users and their personas. This view is only accessible to administrators.
          </p>

          <div v-if="loadingUsers" style="text-align: center; padding: 20px">Loading users...</div>

          <div v-else>
            <div
              v-for="u in allUsers"
              :key="u.id"
              style="border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin-bottom: 12px"
            >
              <div style="display: flex; justify-content: space-between; align-items: start">
                <div>
                  <p><strong>User ID:</strong> {{ u.id }}</p>
                  <p><strong>Public Key:</strong> {{ u.public_key?.substring(0, 32) }}...</p>
                  <p><strong>Joined:</strong> {{ formatDate(u.created_at) }}</p>
                  <div style="margin-top: 8px">
                    <strong>Personas:</strong>
                    <ul style="margin-left: 20px; margin-top: 4px">
                      <li v-for="p in u.personas" :key="p.id">
                        {{ p.name }}
                        <span
                          v-if="p.is_primary"
                          style="
                            background: #007bff;
                            color: white;
                            padding: 2px 8px;
                            border-radius: 4px;
                            font-size: 12px;
                          "
                          >Primary</span
                        >
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="isAdmin && activeTab === 'packages'">
        <div class="card">
          <h2>📦 Package Moderation</h2>
          <p style="color: #666">Package moderation tools coming soon.</p>
        </div>
      </div>

      <!-- Regular User Tabs -->
      <div
        v-if="!isAdmin || (isAdmin && activeTab !== 'users' && activeTab !== 'packages')"
        class="card"
      >
        <div style="display: flex; gap: 12px; border-bottom: 1px solid #ddd; margin-bottom: 20px">
          <button
            :style="{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === 'personas' ? '2px solid #007bff' : '2px solid transparent',
              color: activeTab === 'personas' ? '#007bff' : '#666',
              fontWeight: activeTab === 'personas' ? 'bold' : 'normal',
              cursor: 'pointer',
            }"
            @click="activeTab = 'personas'"
          >
            👤 Personas
          </button>
          <button
            :style="{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === 'mypackages' ? '2px solid #007bff' : '2px solid transparent',
              color: activeTab === 'mypackages' ? '#007bff' : '#666',
              fontWeight: activeTab === 'mypackages' ? 'bold' : 'normal',
              cursor: 'pointer',
            }"
            @click="activeTab = 'mypackages'"
          >
            📦 My Packages
          </button>
          <button
            :style="{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'tokens' ? '2px solid #007bff' : '2px solid transparent',
              color: activeTab === 'tokens' ? '#007bff' : '#666',
              fontWeight: activeTab === 'tokens' ? 'bold' : 'normal',
              cursor: 'pointer',
            }"
            @click="activeTab = 'tokens'"
          >
            🔐 Connected Apps
          </button>
        </div>
      </div>

      <!-- Personas Tab -->
      <div v-if="activeTab === 'personas'">
        <!-- Personas List -->
        <div class="card">
          <h2>Your Account</h2>
          <p><strong>User ID:</strong> {{ user?.id }}</p>
          <p><strong>Public Key:</strong> {{ user?.public_key?.substring(0, 32) }}...</p>
          <p><strong>Member Since:</strong> {{ formatDate(user?.created_at) }}</p>
          <p v-if="isAdmin" style="color: #856404; margin-top: 12px">
            ⚠️ <strong>Admin Note:</strong> Only admins can see user IDs. Regular users cannot link
            personas to user accounts.
          </p>
        </div>

        <!-- Regular User: Persona Management -->
        <div v-if="!isAdmin || activeTab === 'personas'" class="card">
          <h2>Your Personas</h2>
          <p style="color: #666; margin-bottom: 16px">
            Personas are your public identities on the marketplace. You can create multiple personas
            for different purposes.
          </p>

          <div v-if="loadingPersonas" style="text-align: center; padding: 20px">
            Loading personas...
          </div>

          <div v-else>
            <div
              v-for="persona in personas"
              :key="persona.id"
              style="border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin-bottom: 12px"
            >
              <div style="display: flex; justify-content: space-between; align-items: center">
                <div>
                  <h3 style="margin-bottom: 4px">
                    {{ persona.name }}
                  </h3>
                  <p v-if="persona.bio" style="color: #666; font-size: 14px">
                    {{ persona.bio }}
                  </p>
                  <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 14px">
                    <span
                      v-if="persona.is_primary"
                      style="
                        background: #28a745;
                        color: white;
                        padding: 2px 8px;
                        border-radius: 4px;
                      "
                    >
                      Primary
                    </span>
                    <span style="color: #666">Created: {{ formatDate(persona.created_at) }}</span>
                  </div>
                </div>
                <div style="display: flex; gap: 8px">
                  <button
                    v-if="!persona.is_primary"
                    class="btn"
                    style="background: #28a745; color: white"
                    @click="setPrimary(persona.id)"
                  >
                    Set as Primary
                  </button>
                  <button
                    :disabled="persona.is_primary"
                    class="btn btn-danger"
                    :style="persona.is_primary ? 'opacity: 0.5; cursor: not-allowed;' : ''"
                    @click="deletePersona(persona.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <!-- Create new persona -->
            <div v-if="!showCreateForm" style="margin-top: 16px">
              <button class="btn btn-primary" @click="showCreateForm = true">
                + Create New Persona
              </button>
            </div>

            <div
              v-else
              style="border: 1px solid #007bff; border-radius: 4px; padding: 16px; margin-top: 16px"
            >
              <h3>Create New Persona</h3>
              <label>
                Name:
                <input
                  v-model="newPersonaName"
                  type="text"
                  placeholder="e.g., 'Professional Dev'"
                />
              </label>
              <label>
                Bio (optional):
                <textarea v-model="newPersonaBio" placeholder="About this persona..." rows="3" />
              </label>
              <div style="display: flex; gap: 8px; margin-top: 12px">
                <button
                  class="btn btn-primary"
                  :disabled="!newPersonaName.trim()"
                  @click="createPersona"
                >
                  Create Persona
                </button>
                <button class="btn" style="background: #6c757d; color: white" @click="cancelCreate">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- My Packages Tab -->
      <div v-if="activeTab === 'mypackages'">
        <div class="card">
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 16px;
            "
          >
            <h2>📦 My Packages</h2>
            <router-link to="/publish" class="btn btn-primary" style="text-decoration: none">
              ➕ Publish New Package
            </router-link>
          </div>

          <div v-if="loadingMyPackages" style="text-align: center; padding: 20px">Loading...</div>

          <div v-else>
            <div v-if="myPackages.length === 0">
              <p style="color: #666">You haven't published any packages yet.</p>
              <router-link
                to="/publish"
                class="btn btn-primary"
                style="text-decoration: none; display: inline-block; margin-top: 12px"
              >
                Publish Your First Package
              </router-link>
            </div>

            <div v-else>
              <div
                v-for="pkg in myPackages"
                :key="pkg.id"
                style="
                  border: 1px solid #ddd;
                  border-radius: 4px;
                  padding: 16px;
                  margin-bottom: 12px;
                "
              >
                <div style="display: flex; justify-content: space-between; align-items: start">
                  <div style="flex: 1">
                    <h3 style="margin-bottom: 8px">
                      <router-link
                        :to="`/packages/${pkg.namespace}/${pkg.name}`"
                        style="color: #007bff; text-decoration: none"
                      >
                        {{ pkg.namespace }}.{{ pkg.name }}
                      </router-link>
                    </h3>
                    <p style="color: #666; margin-bottom: 8px">
                      {{ pkg.description || 'No description' }}
                    </p>
                    <div style="display: flex; gap: 16px; font-size: 14px; color: #666">
                      <span>📌 Latest: v{{ pkg.latest_version }}</span>
                      <span>📅 {{ formatDate(pkg.updated_at) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Connected Apps Tab -->
      <div v-if="activeTab === 'tokens'">
        <!-- OAuth Tokens -->
        <div class="card">
          <h2>Connected Applications</h2>
          <p style="color: #666; margin-bottom: 16px">
            Applications that have access to your marketplace account via OAuth.
          </p>

          <div v-if="loadingTokens" style="text-align: center; padding: 20px">Loading...</div>

          <div v-else>
            <div v-if="tokens.length === 0">
              <p style="color: #666">No connected applications.</p>
            </div>

            <div v-else>
              <div
                v-for="token in tokens"
                :key="token.id"
                style="
                  border: 1px solid #ddd;
                  border-radius: 4px;
                  padding: 16px;
                  margin-bottom: 12px;
                "
              >
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <div>
                    <p>
                      <strong>{{ token.client_id }}</strong>
                    </p>
                    <p style="color: #666; font-size: 14px; margin-top: 4px">
                      Connected: {{ formatDate(token.created_at) }}
                    </p>
                    <p style="color: #666; font-size: 14px">
                      Expires: {{ formatDate(token.expires_at) }}
                    </p>
                  </div>
                  <button class="btn btn-danger" @click="revokeToken(token.token)">
                    Revoke Access
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const user = ref<any>(null);
const personas = ref<any[]>([]);
const allUsers = ref<any[]>([]);
const tokens = ref<any[]>([]);
const myPackages = ref<any[]>([]);
const isLoggedIn = ref(false);
const isAdmin = ref(false);
const error = ref('');
const loadingPersonas = ref(false);
const loadingUsers = ref(false);
const loadingTokens = ref(false);
const loadingMyPackages = ref(false);

type ActiveTab = 'personas' | 'mypackages' | 'tokens' | 'users' | 'packages';
const activeTab = ref<ActiveTab>('personas');

const showCreateForm = ref(false);
const newPersonaName = ref('');
const newPersonaBio = ref('');

onMounted(async () => {
  checkLoginStatus();
  if (isLoggedIn.value) {
    await loadPersonas();
    await loadTokens();
    await loadMyPackages();
    if (isAdmin.value) {
      await loadAllUsers();
    }
  }
});

function checkLoginStatus() {
  const token = localStorage.getItem('marketplace_token');
  const userData = localStorage.getItem('marketplace_user');

  if (token && userData) {
    isLoggedIn.value = true;
    user.value = JSON.parse(userData);

    // Get admin status from backend
    isAdmin.value = user.value?.is_admin || false;
  }
}

async function loadPersonas() {
  loadingPersonas.value = true;
  error.value = '';

  try {
    const token = localStorage.getItem('marketplace_token');
    const res = await fetch('/api/v1/personas', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to load personas');
    }

    const data = await res.json();
    personas.value = data.personas || [];
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loadingPersonas.value = false;
  }
}

async function loadTokens() {
  loadingTokens.value = true;
  error.value = '';

  try {
    const token = localStorage.getItem('marketplace_token');
    const res = await fetch('/api/v1/oauth/tokens', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to load tokens');
    }

    const data = await res.json();
    tokens.value = data.tokens || [];
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loadingTokens.value = false;
  }
}

async function revokeToken(tokenValue: string) {
  if (!confirm('Are you sure you want to revoke access for this application?')) {
    return;
  }

  error.value = '';

  try {
    const token = localStorage.getItem('marketplace_token');
    const res = await fetch('/api/v1/oauth/revoke', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: tokenValue }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to revoke token');
    }

    await loadTokens();
  } catch (err: any) {
    error.value = err.message;
  }
}

async function loadMyPackages() {
  loadingMyPackages.value = true;
  error.value = '';

  try {
    const token = localStorage.getItem('marketplace_token');
    const res = await fetch('/api/v1/packages/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to load packages');
    }

    const data = await res.json();
    myPackages.value = data.packages || [];
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loadingMyPackages.value = false;
  }
}

async function loadAllUsers() {
  loadingUsers.value = true;
  error.value = '';

  try {
    const token = localStorage.getItem('marketplace_token');
    // TODO: Create admin endpoint GET /api/v1/admin/users
    const res = await fetch('/api/v1/admin/users', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to load users');
    }

    const data = await res.json();
    allUsers.value = data.users || [];
  } catch (err: any) {
    error.value = 'Admin endpoints not yet implemented';
    console.error(err);
  } finally {
    loadingUsers.value = false;
  }
}

async function createPersona() {
  if (!newPersonaName.value.trim()) return;

  error.value = '';

  try {
    const token = localStorage.getItem('marketplace_token');
    const res = await fetch('/api/v1/personas', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: newPersonaName.value.trim(),
        bio: newPersonaBio.value.trim() || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create persona');
    }

    await loadPersonas();
    cancelCreate();
  } catch (err: any) {
    error.value = err.message;
  }
}

async function setPrimary(personaId: string) {
  error.value = '';

  try {
    const token = localStorage.getItem('marketplace_token');
    const res = await fetch(`/api/v1/personas/${personaId}/set-primary`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to set primary persona');
    }

    await loadPersonas();
  } catch (err: any) {
    error.value = err.message;
  }
}

async function deletePersona(personaId: string) {
  if (!confirm('Are you sure you want to delete this persona?')) {
    return;
  }

  error.value = '';

  try {
    const token = localStorage.getItem('marketplace_token');
    const res = await fetch(`/api/v1/personas/${personaId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete persona');
    }

    await loadPersonas();
  } catch (err: any) {
    error.value = err.message;
  }
}

function cancelCreate() {
  showCreateForm.value = false;
  newPersonaName.value = '';
  newPersonaBio.value = '';
}

function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}
</script>

