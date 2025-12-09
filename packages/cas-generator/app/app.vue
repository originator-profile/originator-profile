<template>
  <div class="container h-dvh flex flex-col py-4 gap-y-4">
    <div class="jumpu-card p-4 shrink-0">
      <div class="flex items-center justify-between gap-x-1">
        <h2 class="font-bold text-2xl mb-2">
          Generate Content Attestation Set
        </h2>
        <div class="flex items-center gap-x-2">
          <template v-if="!isLoggedIn">
            <button class="jumpu-button" @click="login">Login</button>
          </template>
          <template v-else>
            <span class="text-xs text-gray-600" v-if="userEmail">{{
              userEmail
            }}</span>
            <button class="jumpu-text-button" @click="logout">Logout</button>
          </template>
        </div>
      </div>
      <div class="flex items-center justify-between gap-x-4">
        <div class="grow">
          <div class="text-sm flex gap-x-4">
            <div class="jumpu-card p-4">
              <div class="text-sm">CAS 生成済み</div>
              <span class="text-2xl font-semibold"> {{ body.length }}</span> /
              {{ selectedFiles.length }}
            </div>
            <div class="jumpu-card p-4 text-green-700">
              <div class="text-sm flex items-center gap-x-1">
                <Icon name="material-symbols:check-rounded" class="text-xl" />
                Successed
              </div>
              <span class="text-2xl font-semibold">
                {{ successed.length }}</span
              >
              /
              {{ selectedFiles.length }}
            </div>
            <div class="jumpu-card p-4 text-amber-600">
              <div class="text-sm flex items-center gap-x-1">
                <Icon
                  name="mage:exclamation-triangle-fill"
                  class="text-xl"
                />Warning
              </div>
              <span class="text-2xl font-semibold"> {{ failed.length }}</span>
              /
              {{ selectedFiles.length }}
            </div>
            <div class="self-end">
              <button
                @click="openSettings"
                class="jumpu-text-button inline-flex items-center gap-x-1"
              >
                <Icon name="uil:cog" class="text-xl" />
                Settings
              </button>
            </div>
          </div>
          <progress
            class="w-full h-2"
            max="100"
            :value="
              selectedFiles.length > 0
                ? (body.length / selectedFiles.length) * 100
                : 0
            "
          ></progress>
        </div>
        <div class="shrink-0">
          <button
            class="jumpu-button inline-flex items-center gap-x-2"
            @click="fetchChatStream(selectedFiles)"
            :disabled="generating || selectedFiles.length === 0 || !isLoggedIn"
          >
            <span v-if="!generating"
              >生成を始める ({{ selectedFiles.length }}件)</span
            >
            <div class="flex items-center gap-x-2" v-else>
              <div class="jumpu-spinner w-4 h-4">
                <svg viewBox="25 25 50 50">
                  <circle cx="50" cy="50" r="20"></circle>
                </svg>
              </div>
              <span>生成中...</span>
            </div>
          </button>
          <div class="text-xs text-amber-600 mt-1" v-if="!isLoggedIn">
            ログインが必要です
          </div>
        </div>
      </div>
    </div>
    <section class="grow shrink overflow-y-auto" ref="scrollSection">
      <table class="w-full relative">
        <thead class="sticky top-0 bg-white shadow-xs z-10">
          <tr class="table-row">
            <th class="w-10">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleAllSelection"
                  class="checkbox"
              /></label>
            </th>
            <th>File name</th>
            <th>status</th>
            <th>title</th>
            <th class="">VC resource path</th>
          </tr>
        </thead>
        <tbody>
          <tr
            class="table-row"
            v-for="(file, index) in htmlfiles"
            :key="file.cas || index"
          >
            <td class="text-center">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="selectedFileIds.has(file.cas)"
                  @change="toggleFileSelection(file.cas)"
                  class="checkbox"
                />
              </label>
            </td>
            <td class="">
              <div class="line-clamp-2" :title="file.cas">{{ file.cas }}</div>
            </td>
            <td>
              <div class="w-16 text-xl text-center">
                <span v-if="!getBodyItemByFile(file)" class="text-gray-400"
                  >-</span
                >
                <span
                  v-else-if="!getBodyItemByFile(file).error"
                  class="text-green-700"
                >
                  <Icon
                    name="material-symbols:check-rounded"
                    class="text-success"
                  />
                </span>
                <span v-else class="text-amber-600">
                  <Icon name="mage:exclamation-triangle-fill" />
                </span>
              </div>
            </td>
            <td>
              <div :title="file.title" class="line-clamp-2">
                {{ file.title }}
              </div>
            </td>
            <td class="">
              <div :title="file.vc_path">
                {{ file.vc_path }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
    <div
      v-if="setting"
      class="jumpu-card p-4 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-95"
    >
      <h2 class="font-bold text-2xl mb-2">Settings</h2>
      <div class="mb-4">
        <h3 class="font-bold text-lg mb-2">Environment Variables</h3>
        <table class="w-full mb-4">
          <tr
            class="table-row"
            v-for="item in Object.entries(settingItems)"
            :key="item"
          >
            <td class="w-1/2">{{ item[0] }}</td>
            <td class="w-1/2">{{ item[1] }}</td>
          </tr>
        </table>
        <h3 class="font-bold text-lg mb-2">Allowed URL Origins</h3>
        <div class="space-y-2">
          <div
            v-for="(_, index) in tempAllowedURLOrigins"
            :key="index"
            class="flex gap-2"
          >
            <input
              type="text"
              v-model="tempAllowedURLOrigins[index]"
              class="jumpu-input flex-1"
              placeholder="Enter URL origin"
            />
            <button
              class="jumpu-icon-button"
              @click="tempAllowedURLOrigins.splice(index, 1)"
            >
              <Icon name="material-symbols:delete-rounded" class="text-xl" />
            </button>
          </div>
          <button
            class="jumpu-text-button inline-flex items-center gap-x-1"
            @click="tempAllowedURLOrigins.push('')"
          >
            <Icon name="material-symbols:add-rounded" class="text-xl" />
            Add URL Origin
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <button class="jumpu-text-button" @click="cancelSettings">
          Cancel
        </button>
        <button class="jumpu-button" @click="saveAllowedURLOriginss">
          Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defaultAllowedURLOriginss } from "#shared/constants";
import { useStorage } from "@vueuse/core";
const scrollSection = ref(null);
const body = ref([]);
const generating = ref(false);
const setting = ref(false);
const selectedFileIds = ref(new Set());
const allowedURLOrigins = useStorage(
  "allowed-url-origins",
  defaultAllowedURLOriginss,
);
const tempAllowedURLOrigins = ref([]);

const { data: settingItems } = useFetch("/api/settings");
const { data: session, refresh: refreshSession } = useFetch(
  "/api/auth/session",
  {
    credentials: "include",
  },
);

const isLoggedIn = computed(() => session.value?.isLoggedIn ?? false);

const userEmail = computed(() => session.value?.email || "");

function login() {
  navigateTo("/login", { external: true });
}

async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } finally {
    await refreshSession();
  }
}

// 選択されたファイルを取得するcomputed
const selectedFiles = computed(() => {
  if (!htmlfiles.value) return [];
  return htmlfiles.value.filter((file) => selectedFileIds.value.has(file.cas));
});

// 全選択状態をチェックするcomputed
const isAllSelected = computed(() => {
  if (!htmlfiles.value || htmlfiles.value.length === 0) return false;
  return htmlfiles.value.every((file) => selectedFileIds.value.has(file.cas));
});

// ファイル選択状態をトグルする関数
function toggleFileSelection(fileId) {
  if (selectedFileIds.value.has(fileId)) {
    selectedFileIds.value.delete(fileId);
  } else {
    selectedFileIds.value.add(fileId);
  }
}

// 全選択/全解除をトグルする関数
function toggleAllSelection() {
  if (!htmlfiles.value) return;

  if (isAllSelected.value) {
    // 全解除
    selectedFileIds.value.clear();
  } else {
    // 全選択
    htmlfiles.value.forEach((file) => {
      selectedFileIds.value.add(file.cas);
    });
  }
}

async function fetchChatStream(prompt, callback) {
  generating.value = true;
  const response = await fetch("http://localhost:4000/cas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      htmlFiles: prompt,
      allowedURLOrigins: allowedURLOrigins.value,
    }),
  });
  const reader = response.body.getReader();
  if (!reader) return;

  let decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const lines = decoder.decode(value);
    console.log(lines);
    const resData = JSON.parse(lines.trim().replace("data:", ""));
    console.log(resData);
    body.value.push(resData);
  }
}

const successed = computed(() => body.value.filter((item) => !item.error));
const failed = computed(() => body.value.filter((item) => item.error));

function getBodyItemByFile(file) {
  return body.value.find((item) => item.cas === file.cas);
}

const { data: htmlfiles, status } = useFetch("/api/htmlFiles/get");

// 設定モーダルを開くときに一時的な設定をコピー
function openSettings() {
  tempAllowedURLOrigins.value = [...allowedURLOrigins.value];
  setting.value = true;
}

// allowedURLOriginsの設定を保存する関数
function saveAllowedURLOriginss() {
  allowedURLOrigins.value = [...tempAllowedURLOrigins.value];
  setting.value = false;
}

// 設定をキャンセルする関数
function cancelSettings() {
  tempAllowedURLOrigins.value = [...allowedURLOrigins.value];
  setting.value = false;
}
</script>

<style scoped>
@reference "./assets/css/tailwind.css";
.table-row {
  @apply text-xs font-mono border-b border-gray-100 py-2;
  td,
  th {
    @apply py-0.5 px-3 border-r border-gray-100;
  }
}
thead {
  th {
    @apply text-gray-600 font-normal text-left;
  }
}
.checkbox-label {
  @apply p-2 flex justify-center aspect-square rounded hover:bg-gray-200;
}
</style>
