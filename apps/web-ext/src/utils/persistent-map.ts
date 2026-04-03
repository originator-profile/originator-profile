export class PersistentMap<T> {
  #cache: Record<number, T> = {};
  #isLoaded = false;
  #storageKey: string;

  constructor(storageKey: string) {
    this.#storageKey = storageKey;
  }

  async load() {
    if (this.#isLoaded) return;
    try {
      const result = await chrome.storage.session.get(this.#storageKey);
      if (result[this.#storageKey]) {
        this.#cache = result[this.#storageKey] as Record<number, T>;
      }
      this.#isLoaded = true;
    } catch (e) {
      console.error(`Failed to load ${this.#storageKey}:`, e);
      // Fallback to empty cache on error
      this.#isLoaded = true;
    }
  }

  get(key: number): T | undefined {
    return this.#cache[key];
  }

  set(key: number, value: T) {
    this.#cache[key] = value;
    this.#persist();
  }

  delete(key: number) {
    if (key in this.#cache) {
      delete this.#cache[key];
      this.#persist();
    }
  }

  /**
   * Helper to update a nested property.
   * Assumes T is an object.
   */
  update(key: number, updater: (val: T | undefined) => T) {
    const newVal = updater(this.#cache[key]);
    this.set(key, newVal);
  }

  #persist() {
    chrome.storage.session
      .set({ [this.#storageKey]: this.#cache })
      .catch((e) => {
        console.error(`Failed to persist ${this.#storageKey}:`, e);
      });
  }
}
