<template>
  <div class="container">
    <h1>📤 Publish Package</h1>
    <p style="color: #666; margin-bottom: 32px">
      Upload a package to the marketplace. Your package will be validated before publishing.
    </p>

    <div v-if="!isLoggedIn" class="card">
      <h2>Login Required</h2>
      <p>You must be logged in to publish packages.</p>
      <router-link
        to="/login"
        class="btn btn-primary"
        style="text-decoration: none; display: inline-block; margin-top: 16px"
      >
        Login
      </router-link>
    </div>

    <div v-else>
      <!-- Upload Section -->
      <div class="card">
        <h2>Upload Package File</h2>

        <div
          @drop.prevent="handleDrop"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          :style="{
            border: dragOver ? '2px dashed #007bff' : '2px dashed #ddd',
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            background: dragOver ? '#f0f8ff' : '#f8f9fa',
            cursor: 'pointer',
            marginBottom: '16px',
          }"
          @click="$refs.fileInput.click()"
        >
          <div style="font-size: 48px; margin-bottom: 16px">📦</div>
          <p style="font-size: 18px; margin-bottom: 8px">
            <strong>Drag and drop your YAML file here</strong>
          </p>
          <p style="color: #666">or click to browse</p>
          <input
            ref="fileInput"
            type="file"
            accept=".yaml,.yml"
            @change="handleFileSelect"
            style="display: none"
          />
        </div>

        <div
          v-if="fileName"
          style="background: #e7f3ff; padding: 12px; border-radius: 4px; margin-bottom: 16px"
        >
          <strong>Selected file:</strong> {{ fileName }}
          <button
            @click="clearFile"
            style="
              margin-left: 12px;
              background: none;
              border: none;
              color: #dc3545;
              cursor: pointer;
            "
          >
            ✕ Clear
          </button>
        </div>

        <div v-if="validationErrors.length > 0" class="error" style="margin-bottom: 16px">
          <strong>Validation Errors:</strong>
          <ul style="margin-left: 20px; margin-top: 8px">
            <li v-for="(err, idx) in validationErrors" :key="idx">{{ err }}</li>
          </ul>
        </div>
      </div>

      <!-- Package Preview -->
      <div v-if="packageData && !validationErrors.length" class="card">
        <h2>Package Preview</h2>

        <table style="width: 100%; border-collapse: collapse">
          <tr style="border-bottom: 1px solid #ddd">
            <td style="padding: 12px 0; font-weight: bold; width: 200px">Package ID</td>
            <td style="padding: 12px 0">
              <code>{{ packageData.id }}</code>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd">
            <td style="padding: 12px 0; font-weight: bold">Name</td>
            <td style="padding: 12px 0">{{ packageData.metadata?.name }}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd">
            <td style="padding: 12px 0; font-weight: bold">Version</td>
            <td style="padding: 12px 0">{{ packageData.version }}</td>
          </tr>
          <tr v-if="packageData.metadata?.description" style="border-bottom: 1px solid #ddd">
            <td style="padding: 12px 0; font-weight: bold">Description</td>
            <td style="padding: 12px 0">{{ packageData.metadata.description }}</td>
          </tr>
          <tr
            v-if="packageData.dependencies && packageData.dependencies.length > 0"
            style="border-bottom: 1px solid #ddd"
          >
            <td style="padding: 12px 0; font-weight: bold">Dependencies</td>
            <td style="padding: 12px 0">
              <ul style="margin: 0; padding-left: 20px">
                <li v-for="(dep, idx) in packageData.dependencies" :key="idx">
                  {{ dep.package }} {{ dep.version }}
                </li>
              </ul>
            </td>
          </tr>
          <tr v-if="packageData.datatypes" style="border-bottom: 1px solid #ddd">
            <td style="padding: 12px 0; font-weight: bold">Datatypes</td>
            <td style="padding: 12px 0">{{ Object.keys(packageData.datatypes).length }}</td>
          </tr>
          <tr v-if="packageData.templates" style="border-bottom: 1px solid #ddd">
            <td style="padding: 12px 0; font-weight: bold">Templates</td>
            <td style="padding: 12px 0">{{ Object.keys(packageData.templates).length }}</td>
          </tr>
          <tr v-if="packageData.rulebooks">
            <td style="padding: 12px 0; font-weight: bold">Rulebooks</td>
            <td style="padding: 12px 0">{{ Object.keys(packageData.rulebooks).length }}</td>
          </tr>
        </table>
      </div>

      <!-- Publishing Options -->
      <div v-if="packageData && !validationErrors.length" class="card">
        <h2>Publishing Options</h2>

        <div style="margin-bottom: 20px">
          <label style="display: block; font-weight: bold; margin-bottom: 8px">
            Namespace <span style="color: #dc3545">*</span>
          </label>
          <p style="color: #666; font-size: 14px; margin-bottom: 8px">
            From package: <code>{{ parsedNamespace }}</code>
          </p>
          <p v-if="namespaceInfo" style="color: #666; font-size: 14px">
            {{ namespaceInfo }}
          </p>
        </div>

        <div style="margin-bottom: 20px">
          <label style="display: block; font-weight: bold; margin-bottom: 8px">
            Publish as <span style="color: #dc3545">*</span>
          </label>
          <select
            v-model="selectedPersonaId"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px"
          >
            <option value="">-- Select Persona --</option>
            <option v-for="persona in personas" :key="persona.id" :value="persona.id">
              {{ persona.name }} {{ persona.is_primary ? '(Primary)' : '' }}
            </option>
          </select>
        </div>

        <div v-if="publishError" class="error" style="margin-bottom: 16px">
          {{ publishError }}
        </div>

        <div v-if="publishing" style="text-align: center; padding: 20px">
          <p>Publishing package...</p>
        </div>

        <div v-else style="display: flex; gap: 12px">
          <button @click="publishPackage" class="btn btn-primary" :disabled="!selectedPersonaId">
            📤 Publish Package
          </button>
          <button @click="clearFile" class="btn" style="background: #6c757d; color: white">
            Cancel
          </button>
        </div>
      </div>

      <!-- Success Message -->
      <div v-if="publishSuccess" class="card" style="background: #d4edda; border-color: #c3e6cb">
        <h2 style="color: #155724">✅ Package Published Successfully!</h2>
        <p style="color: #155724">
          Your package <strong>{{ publishedPackage }}</strong> has been published to the
          marketplace.
        </p>
        <div style="margin-top: 16px; display: flex; gap: 12px">
          <router-link
            :to="`/packages/${parsedNamespace}/${parsedPackageName}`"
            class="btn btn-primary"
            style="text-decoration: none"
          >
            View Package
          </router-link>
          <button @click="resetForm" class="btn" style="background: #6c757d; color: white">
            Publish Another
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import yaml from 'js-yaml';

const router = useRouter();

const isLoggedIn = ref(false);
const dragOver = ref(false);
const fileName = ref('');
const fileContent = ref('');
const packageData = ref<any>(null);
const validationErrors = ref<string[]>([]);
const personas = ref<any[]>([]);
const selectedPersonaId = ref('');
const publishing = ref(false);
const publishError = ref('');
const publishSuccess = ref(false);
const publishedPackage = ref('');

const parsedNamespace = computed(() => {
  if (!packageData.value?.id) return '';
  const parts = packageData.value.id.split('.');
  return parts.slice(0, -1).join('.');
});

const parsedPackageName = computed(() => {
  if (!packageData.value?.id) return '';
  const parts = packageData.value.id.split('.');
  return parts[parts.length - 1];
});

const namespaceInfo = ref('');

onMounted(async () => {
  checkLoginStatus();
  if (isLoggedIn.value) {
    await loadPersonas();
  }
});

function checkLoginStatus() {
  const token = sessionStorage.getItem('marketplace_token');
  isLoggedIn.value = !!token;
}

async function loadPersonas() {
  try {
    const token = sessionStorage.getItem('marketplace_token');
    const res = await fetch('/api/v1/personas', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      personas.value = data.personas || [];

      // Auto-select primary persona
      const primary = personas.value.find((p) => p.is_primary);
      if (primary) {
        selectedPersonaId.value = primary.id;
      }
    }
  } catch (err) {
    console.error('Failed to load personas:', err);
  }
}

function handleDrop(e: DragEvent) {
  dragOver.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    handleFile(target.files[0]);
  }
}

function handleFile(file: File) {
  fileName.value = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    fileContent.value = e.target?.result as string;
    validateAndParsePackage();
  };
  reader.readAsText(file);
}

function validateAndParsePackage() {
  validationErrors.value = [];
  packageData.value = null;
  namespaceInfo.value = '';

  try {
    // Parse YAML
    const parsed = yaml.load(fileContent.value) as any;

    // Basic validation
    if (!parsed.id) {
      validationErrors.value.push('Package must have an "id" field');
    }
    if (!parsed.version) {
      validationErrors.value.push('Package must have a "version" field');
    }
    if (!parsed.metadata?.name) {
      validationErrors.value.push('Package must have a "metadata.name" field');
    }

    if (validationErrors.value.length === 0) {
      packageData.value = parsed;
      checkNamespace();
    }
  } catch (err: any) {
    validationErrors.value.push(`YAML parsing error: ${err.message}`);
  }
}

async function checkNamespace() {
  if (!parsedNamespace.value) return;

  try {
    const res = await fetch(`/api/v1/namespaces/${parsedNamespace.value}`);

    if (res.ok) {
      const data = await res.json();
      namespaceInfo.value = `Namespace exists (${data.namespace.protection_level})`;
    } else if (res.status === 404) {
      namespaceInfo.value = 'Namespace will be created automatically';
    }
  } catch (err) {
    // Ignore errors
  }
}

async function publishPackage() {
  if (!selectedPersonaId.value) {
    publishError.value = 'Please select a persona';
    return;
  }

  publishing.value = true;
  publishError.value = '';

  try {
    const token = sessionStorage.getItem('marketplace_token');
    const res = await fetch('/api/v1/packages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        yaml_content: fileContent.value,
        persona_id: selectedPersonaId.value,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to publish package');
    }

    const data = await res.json();
    publishSuccess.value = true;
    publishedPackage.value = data.package.id;
  } catch (err: any) {
    publishError.value = err.message;
  } finally {
    publishing.value = false;
  }
}

function clearFile() {
  fileName.value = '';
  fileContent.value = '';
  packageData.value = null;
  validationErrors.value = [];
  publishError.value = '';
  publishSuccess.value = false;
}

function resetForm() {
  clearFile();
  selectedPersonaId.value = '';
  const primary = personas.value.find((p) => p.is_primary);
  if (primary) {
    selectedPersonaId.value = primary.id;
  }
}
</script>
