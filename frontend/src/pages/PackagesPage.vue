<template>
  <div class="container">
    <h1>Browse Packages</h1>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-if="loading" style="text-align: center; padding: 40px">
      <div style="font-size: 48px; margin-bottom: 16px">📦</div>
      <h3>Loading packages...</h3>
    </div>

    <div v-else>
      <!-- Search and Filters -->
      <div class="card" style="margin-bottom: 20px">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name, namespace, or description..."
            style="
              flex: 1;
              min-width: 250px;
              font-size: 16px;
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 4px;
            "
          />

          <select
            v-model="sortBy"
            style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px"
          >
            <option value="updated">Latest Updated</option>
            <option value="name">Name (A-Z)</option>
            <option value="downloads">Most Downloaded</option>
          </select>
        </div>
      </div>

      <!-- Results info -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        "
      >
        <p style="color: #666">
          Showing {{ paginatedPackages.length }} of {{ filteredPackages.length }} package(s)
        </p>

        <!-- Pagination controls -->
        <div v-if="totalPages > 1" style="display: flex; gap: 8px; align-items: center">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="btn"
            style="padding: 6px 12px; font-size: 14px"
            :style="{
              opacity: currentPage === 1 ? 0.5 : 1,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            }"
          >
            ← Previous
          </button>
          <span style="color: #666">Page {{ currentPage }} of {{ totalPages }}</span>
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="btn"
            style="padding: 6px 12px; font-size: 14px"
            :style="{
              opacity: currentPage === totalPages ? 0.5 : 1,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            }"
          >
            Next →
          </button>
        </div>
      </div>

      <!-- Packages list -->
      <div
        v-if="filteredPackages.length === 0 && searchQuery"
        class="card"
        style="text-align: center; padding: 60px 24px"
      >
        <div style="font-size: 64px; margin-bottom: 16px">🔍</div>
        <h2>No Results Found</h2>
        <p style="color: #666; margin: 16px 0">No packages match your search "{{ searchQuery }}"</p>
        <button @click="searchQuery = ''" class="btn btn-primary" style="margin-top: 12px">
          Clear Search
        </button>
      </div>

      <div
        v-else-if="packages.length === 0"
        class="card"
        style="text-align: center; padding: 60px 24px"
      >
        <div style="font-size: 64px; margin-bottom: 16px">📦</div>
        <h2>No Packages Yet</h2>
        <p style="color: #666; margin: 16px 0">
          The marketplace is empty. Be the first to publish a package!
        </p>
        <router-link
          v-if="isLoggedIn"
          to="/publish"
          class="btn btn-primary"
          style="text-decoration: none; display: inline-block; margin-top: 12px"
        >
          Publish a Package
        </router-link>
      </div>

      <div v-else>
        <div
          v-for="pkg in paginatedPackages"
          :key="pkg.id"
          class="card"
          style="
            cursor: pointer;
            transition:
              transform 0.2s,
              box-shadow 0.2s;
          "
          @click="goToPackage(pkg)"
          @mouseover="
            $event.currentTarget.style.transform = 'translateY(-2px)';
            $event.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          "
          @mouseout="
            $event.currentTarget.style.transform = '';
            $event.currentTarget.style.boxShadow = '';
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: start">
            <div style="flex: 1">
              <h2 style="margin-bottom: 8px; color: #007bff">{{ pkg.namespace }}.{{ pkg.name }}</h2>
              <p style="color: #666; margin-bottom: 12px">
                {{ pkg.description || 'No description available' }}
              </p>
              <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; color: #666">
                <span>📌 Latest: v{{ pkg.latest_version }}</span>
                <span>📅 {{ formatDate(pkg.updated_at) }}</span>
                <span v-if="pkg.download_count">📥 {{ pkg.download_count }} downloads</span>
                <span v-else>📥 0 downloads</span>
              </div>
            </div>
            <div>
              <span
                style="
                  background: #e7f3ff;
                  color: #007bff;
                  padding: 4px 12px;
                  border-radius: 4px;
                  font-size: 14px;
                "
              >
                {{ pkg.protection_level || 'public' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom pagination -->
      <div
        v-if="totalPages > 1"
        style="
          display: flex;
          justify-content: center;
          gap: 8px;
          align-items: center;
          margin-top: 24px;
        "
      >
        <button
          @click="currentPage--"
          :disabled="currentPage === 1"
          class="btn"
          :style="{
            opacity: currentPage === 1 ? 0.5 : 1,
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          }"
        >
          ← Previous
        </button>
        <span style="color: #666">Page {{ currentPage }} of {{ totalPages }}</span>
        <button
          @click="currentPage++"
          :disabled="currentPage === totalPages"
          class="btn"
          :style="{
            opacity: currentPage === totalPages ? 0.5 : 1,
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          }"
        >
          Next →
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const packages = ref<any[]>([]);
const loading = ref(true);
const error = ref('');
const searchQuery = ref('');
const sortBy = ref('updated');
const currentPage = ref(1);
const itemsPerPage = 10;
const isLoggedIn = ref(false);

onMounted(async () => {
  checkLoginStatus();
  await loadPackages();
});

function checkLoginStatus() {
  const token = sessionStorage.getItem('marketplace_token');
  isLoggedIn.value = !!token;
}

// Reset to page 1 when search or sort changes
watch([searchQuery, sortBy], () => {
  currentPage.value = 1;
});

const filteredPackages = computed(() => {
  let filtered = packages.value;

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(query) ||
        pkg.namespace.toLowerCase().includes(query) ||
        (pkg.description && pkg.description.toLowerCase().includes(query)) ||
        `${pkg.namespace}.${pkg.name}`.toLowerCase().includes(query)
    );
  }

  // Sort
  const sorted = [...filtered];
  if (sortBy.value === 'name') {
    sorted.sort((a, b) => `${a.namespace}.${a.name}`.localeCompare(`${b.namespace}.${b.name}`));
  } else if (sortBy.value === 'downloads') {
    sorted.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
  } else if (sortBy.value === 'updated') {
    sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  return sorted;
});

const totalPages = computed(() => Math.ceil(filteredPackages.value.length / itemsPerPage));

const paginatedPackages = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredPackages.value.slice(start, end);
});

async function loadPackages() {
  loading.value = true;
  error.value = '';

  try {
    const res = await fetch('/api/v1/packages');

    if (!res.ok) {
      throw new Error('Failed to load packages');
    }

    const data = await res.json();
    packages.value = data.packages || [];
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function goToPackage(pkg: any) {
  router.push(`/packages/${pkg.namespace}/${pkg.name}`);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
}
</script>

<style scoped>
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}
</style>
