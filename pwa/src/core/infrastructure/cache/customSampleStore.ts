export type StoredCustomSample = {
  id: string;
  name: string;
  data: ArrayBuffer;
  createdAt: number;
  duration?: number;
};

const DB_NAME = "forever-jukebox-custom-samples";
const DB_VERSION = 1;
const STORE_NAME = "samples";

let customSamplesDbPromise: Promise<IDBDatabase> | null = null;
const memorySamples = new Map<string, StoredCustomSample>();

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

async function openCustomSamplesDb(): Promise<IDBDatabase> {
  if (!customSamplesDbPromise) {
    customSamplesDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB open failed"));
    });
  }
  return customSamplesDbPromise;
}

export async function saveStoredCustomSample(
  sample: StoredCustomSample,
): Promise<void> {
  if (!isIndexedDbAvailable()) {
    memorySamples.set(sample.id, sample);
    return;
  }
  try {
    const db = await openCustomSamplesDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(sample);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Save sample failed"));
    });
  } catch (err) {
    console.warn("Failed to persist custom sample in IndexedDB, using memory:", err);
    memorySamples.set(sample.id, sample);
  }
}

export async function getStoredCustomSamples(): Promise<StoredCustomSample[]> {
  if (!isIndexedDbAvailable()) {
    return Array.from(memorySamples.values()).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }
  try {
    const db = await openCustomSamplesDb();
    return await new Promise<StoredCustomSample[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = (request.result as StoredCustomSample[]) ?? [];
        resolve(results.sort((a, b) => a.createdAt - b.createdAt));
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Get samples failed"));
    });
  } catch (err) {
    console.warn("Failed to load custom samples from IndexedDB:", err);
    return Array.from(memorySamples.values());
  }
}

export async function deleteStoredCustomSample(id: string): Promise<void> {
  memorySamples.delete(id);
  if (!isIndexedDbAvailable()) {
    return;
  }
  try {
    const db = await openCustomSamplesDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Delete sample failed"));
    });
  } catch (err) {
    console.warn("Failed to delete custom sample from IndexedDB:", err);
  }
}

export async function clearAllStoredCustomSamples(): Promise<void> {
  memorySamples.clear();
  if (!isIndexedDbAvailable()) {
    return;
  }
  try {
    const db = await openCustomSamplesDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Clear samples failed"));
    });
  } catch (err) {
    console.warn("Failed to clear custom samples from IndexedDB:", err);
  }
}
