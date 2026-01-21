import { Any } from '../components/modifiers';

type UpgradeCallback = (db: IDBDatabase) => void;

/**
 * Represents a mapping of store names to their corresponding record types.
 */
export type StoreSchemas = {
  [storeName: string]: { key: IDBValidKey; value: Any };
};

export class IndexedDBWrapper<Stores extends StoreSchemas> {
  private db: IDBDatabase | null = null;

  constructor(
    private readonly dbName: string,
    private readonly version: number = 1,
    private upgradeCallback?: UpgradeCallback,
  ) {}

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        if (this.upgradeCallback) {
          this.upgradeCallback((event.target as IDBOpenDBRequest).result);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.db;
  }

  private _getStore<K extends keyof Stores>(
    storeName: K,
    mode: IDBTransactionMode = 'readonly',
  ): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not opened yet');
    }
    return this.db
      .transaction(storeName as string, mode)
      .objectStore(storeName as string);
  }

  async add<S extends keyof Stores, K = Stores[S]['key']>(
    storeName: S,
    value: Stores[S]['value'],
  ): Promise<K> {
    await this.open();
    return new Promise((resolve, reject) => {
      const store = this._getStore(storeName, 'readwrite');
      const request = store.add(value);

      request.onsuccess = () => resolve(request.result as K);
      request.onerror = () => reject(request.error);
    });
  }

  async put<S extends keyof Stores, K = Stores[S]['key']>(
    storeName: S,
    value: Stores[S]['value'],
  ): Promise<K> {
    await this.open();
    return new Promise((resolve, reject) => {
      const store = this._getStore(storeName, 'readwrite');
      const request = store.put(value);

      request.onsuccess = () => resolve(request.result as K);
      request.onerror = () => reject(request.error);
    });
  }

  async get<K extends keyof Stores>(
    storeName: K,
    key: Stores[K]['key'],
  ): Promise<Stores[K]['value'] | undefined> {
    await this.open();
    return new Promise((resolve, reject) => {
      const store = this._getStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<K extends keyof Stores>(
    storeName: K,
  ): Promise<Stores[K]['value'][]> {
    await this.open();
    return new Promise((resolve, reject) => {
      const store = this._getStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as Stores[K]['value'][]);
      request.onerror = () => reject(request.error);
    });
  }

  async delete<K extends keyof Stores>(
    storeName: K,
    key: Stores[K]['key'],
  ): Promise<void> {
    await this.open();
    return new Promise((resolve, reject) => {
      const store = this._getStore(storeName, 'readwrite');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
