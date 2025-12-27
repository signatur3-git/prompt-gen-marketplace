<template>
  <div class="container">
    <!-- Breadcrumb -->
    <div style="margin-bottom: 20px">
      <router-link to="/packages" style="color: var(--accent-color); text-decoration: none">
        ← Back to Packages
      </router-link>
    </div>

    <div v-if="loading" style="text-align: center; padding: 60px">
      <div style="font-size: 48px; margin-bottom: 16px">📦</div>
      <h2>Loading package...</h2>
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else-if="packageData">
      <!-- Package Header -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: start">
          <div style="flex: 1">
            <h1 style="margin-bottom: 8px">{{ packageData.namespace }}.{{ packageData.name }}</h1>
            <p style="color: var(--text-secondary); font-size: 18px; margin-bottom: 16px">
              {{ packageData.description || 'No description available' }}
            </p>
            <div
              style="
                display: flex;
                gap: 16px;
                flex-wrap: wrap;
                font-size: 14px;
                color: var(--text-secondary);
              "
            >
              <span>📌 Latest: v{{ packageData.latest_version }}</span>
              <span>📅 Updated: {{ formatDate(packageData.updated_at) }}</span>
              <span v-if="packageData.author_name">✍️ {{ packageData.author_name }}</span>
              <span v-if="packageData.download_count"
                >📥 {{ packageData.download_count }} downloads</span
              >
            </div>
          </div>
          <div>
            <span
              style="
                background: var(--bg-tertiary);
                color: var(--accent-color);
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 14px;
              "
            >
              {{ packageData.protection_level || 'public' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Versions -->
      <div class="card">
        <h2 style="margin-bottom: 16px">Versions</h2>

        <div v-if="!versions || versions.length === 0">
          <p style="color: var(--text-secondary)">No versions available.</p>
        </div>

        <div v-else>
          <div
            v-for="version in versions"
            :key="version.id"
            style="
              border: 1px solid var(--border-color);
              border-radius: 4px;
              padding: 16px;
              margin-bottom: 12px;
            "
          >
            <div style="display: flex; justify-content: space-between; align-items: start">
              <div style="flex: 1">
                <h3 style="margin-bottom: 8px">
                  v{{ version.version }}
                  <span
                    v-if="version.version === packageData.latest_version"
                    style="
                      background: var(--success-bg);
                      color: var(--success-text);
                      padding: 2px 8px;
                      border-radius: 4px;
                      font-size: 12px;
                      margin-left: 8px;
                      border: 1px solid var(--success-border);
                    "
                  >
                    Latest
                  </span>
                </h3>

                <div
                  style="
                    display: flex;
                    gap: 16px;
                    margin-bottom: 12px;
                    font-size: 14px;
                    color: var(--text-secondary);
                  "
                >
                  <span>📅 {{ formatDate(version.published_at) }}</span>
                  <span v-if="version.file_size_bytes"
                    >💾 {{ formatSize(version.file_size_bytes) }}</span
                  >
                  <span v-if="version.checksum_sha256">🔒 SHA-256 verified</span>
                </div>

                <!-- Dependencies -->
                <div
                  v-if="version.dependencies && version.dependencies.length > 0"
                  style="margin-top: 12px"
                >
                  <strong style="font-size: 14px">Dependencies:</strong>
                  <ul style="margin-left: 20px; margin-top: 4px; font-size: 14px">
                    <li v-for="(dep, idx) in version.dependencies" :key="idx">
                      <code>{{ dep.package }}</code>
                      <span style="color: var(--text-secondary)">{{ dep.version }}</span>
                    </li>
                  </ul>
                </div>

                <div v-else style="margin-top: 12px; font-size: 14px; color: var(--text-secondary)">
                  No dependencies
                </div>
              </div>

              <div>
                <button class="btn btn-primary" @click="downloadVersion(version)">
                  📥 Download
                </button>
              </div>
            </div>

            <!-- Download status -->
            <div
              v-if="downloadingVersion === version.id"
              style="
                margin-top: 12px;
                padding: 12px;
                background: var(--info-bg);
                border-radius: 4px;
                font-size: 14px;
                color: var(--info-text);
                border: 1px solid var(--info-border);
              "
            >
              ⏳ Downloading...
            </div>
          </div>
        </div>
      </div>

      <!-- Package Information -->
      <div class="card">
        <h2 style="margin-bottom: 16px">Package Information</h2>

        <table style="width: 100%; border-collapse: collapse">
          <tr style="border-bottom: 1px solid var(--border-color)">
            <td style="padding: 12px 0; font-weight: bold; width: 200px">Namespace</td>
            <td style="padding: 12px 0">
              {{ packageData.namespace }}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--border-color)">
            <td style="padding: 12px 0; font-weight: bold">Name</td>
            <td style="padding: 12px 0">
              {{ packageData.name }}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--border-color)">
            <td style="padding: 12px 0; font-weight: bold">Full ID</td>
            <td style="padding: 12px 0">
              <code>{{ packageData.namespace }}.{{ packageData.name }}</code>
            </td>
          </tr>
          <tr v-if="packageData.author_name" style="border-bottom: 1px solid var(--border-color)">
            <td style="padding: 12px 0; font-weight: bold">Author</td>
            <td style="padding: 12px 0">
              {{ packageData.author_name }}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--border-color)">
            <td style="padding: 12px 0; font-weight: bold">Latest Version</td>
            <td style="padding: 12px 0">
              {{ packageData.latest_version }}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--border-color)">
            <td style="padding: 12px 0; font-weight: bold">Total Versions</td>
            <td style="padding: 12px 0">
              {{ versions?.length || 0 }}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--border-color)">
            <td style="padding: 12px 0; font-weight: bold">Protection Level</td>
            <td style="padding: 12px 0">
              {{ packageData.protection_level || 'public' }}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: bold">Created</td>
            <td style="padding: 12px 0">
              {{ formatDate(packageData.created_at) }}
            </td>
          </tr>
        </table>
      </div>

      <!-- Statistics -->
      <div class="card">
        <h2 style="margin-bottom: 16px">📊 Statistics</h2>
        <div
          style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
          "
        >
          <div
            style="
              text-align: center;
              padding: 20px;
              background: var(--bg-code);
              border-radius: 4px;
              border: 1px solid var(--border-color);
            "
          >
            <div style="font-size: 32px; font-weight: bold; color: var(--accent-color)">
              {{ versions.length }}
            </div>
            <div style="color: var(--text-secondary); margin-top: 4px">Versions</div>
          </div>
          <div
            style="
              text-align: center;
              padding: 20px;
              background: var(--bg-code);
              border-radius: 4px;
              border: 1px solid var(--border-color);
            "
          >
            <div style="font-size: 32px; font-weight: bold; color: var(--success-text)">
              {{ packageData.download_count || 0 }}
            </div>
            <div style="color: var(--text-secondary); margin-top: 4px">Total Downloads</div>
          </div>
          <div
            style="
              text-align: center;
              padding: 20px;
              background: var(--bg-code);
              border-radius: 4px;
              border: 1px solid var(--border-color);
            "
          >
            <div style="font-size: 32px; font-weight: bold; color: var(--text-secondary)">
              {{ totalDependencies }}
            </div>
            <div style="color: var(--text-secondary); margin-top: 4px">Dependencies</div>
          </div>
        </div>
      </div>

      <!-- Dependency Tree -->
      <div
        v-if="latestVersion && latestVersion.dependencies && latestVersion.dependencies.length > 0"
        class="card"
      >
        <h2 style="margin-bottom: 16px">🌳 Dependency Tree</h2>
        <div
          style="
            background: var(--bg-code);
            padding: 20px;
            border-radius: 4px;
            font-family: monospace;
            border: 1px solid var(--border-color);
          "
        >
          <div style="margin-bottom: 8px; font-weight: bold">
            📦 {{ packageData.namespace }}.{{ packageData.name }}@{{ latestVersion.version }}
          </div>
          <div
            v-for="(dep, idx) in latestVersion.dependencies"
            :key="idx"
            style="margin-left: 20px; padding: 4px 0"
          >
            <span style="color: var(--text-secondary)">├── </span>
            <span style="color: var(--accent-color)">{{ dep.package }}</span>
            <span style="color: var(--text-secondary)"> {{ dep.version }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="card">
      <h2>Package Not Found</h2>
      <p>The requested package does not exist.</p>
      <router-link
        to="/packages"
        class="btn btn-primary"
        style="text-decoration: none; display: inline-block; margin-top: 12px"
      >
        Browse All Packages
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';

interface PackageData {
  namespace: string;
  name: string;
  description?: string;
  latest_version: string;
  protection_level?: string;
  download_count?: number;
  author_name?: string;
  created_at: string;
  updated_at: string;
}

interface PackageVersion {
  id: string;
  version: string;
  description?: string;
  published_at: string;
  file_size_bytes?: number;
  checksum_sha256?: string;
  dependencies?: Array<{
    package: string;
    version: string;
  }>;
}

const route = useRoute();

const packageData = ref<PackageData | null>(null);
const versions = ref<PackageVersion[]>([]);
const loading = ref(true);
const error = ref('');
const downloadingVersion = ref<string | null>(null);

const namespace = route.params.namespace as string;
const name = route.params.name as string;

const latestVersion = computed(() => {
  if (!versions.value || versions.value.length === 0) return null;
  return (
    versions.value.find((v) => v.version === packageData.value?.latest_version) || versions.value[0]
  );
});

const totalDependencies = computed(() => {
  if (!latestVersion.value || !latestVersion.value.dependencies) return 0;
  return latestVersion.value.dependencies.length;
});

onMounted(async () => {
  await loadPackage();
});

async function loadPackage() {
  loading.value = true;
  error.value = '';

  try {
    // Fetch package metadata
    const res = await fetch(`/api/v1/packages/${namespace}/${name}`);

    if (!res.ok) {
      if (res.status === 404) {
        error.value = 'Package not found';
      } else {
        throw new Error('Failed to load package');
      }
      return;
    }

    const data = await res.json();

    // API returns { package: {...}, stats: {...} }
    // Flatten it for easier access
    packageData.value = {
      ...data.package,
      download_count: data.stats?.total_downloads || 0,
      author_name: data.package.author_persona?.name || 'Unknown',
    };

    // Versions are already included in the package object
    versions.value = data.package.versions || [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load package';
  } finally {
    loading.value = false;
  }
}

async function downloadVersion(version: PackageVersion) {
  downloadingVersion.value = version.id;

  try {
    const res = await fetch(
      `/api/v1/packages/${namespace}/${name}/versions/${version.version}/download`
    );

    if (!res.ok) {
      throw new Error('Failed to download package');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${namespace}.${name}-${version.version}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = `Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  } finally {
    downloadingVersion.value = null;
  }
}

function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
</script>
