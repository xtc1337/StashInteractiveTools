import { IndexedDBWrapper } from './indexdb-wrapper';
import { DEFAULT_NAMESPACE } from './common';
import { PossibleValues } from '../components/modifiers';

export type DBSchema = {
  presets: {
    key: number;
    value: {
      id?: number;
      name: string;
      modifiers: {
        id: string;
        values: Record<string, PossibleValues>;
      }[];
    };
  };
};

const DB_VERSION = 1;
const onUpgradeV1 = (db: IDBDatabase) => {
  if (!db.objectStoreNames.contains('presets')) {
    db.createObjectStore('presets', { keyPath: 'id', autoIncrement: true });
  }
};
const UPGRADE_CALLBACKS = [onUpgradeV1];

const onUpgrade = (db: IDBDatabase) => {
  UPGRADE_CALLBACKS.forEach((cb) => cb(db));
};

export { IndexedDBWrapper };
export const DB = new IndexedDBWrapper<DBSchema>(
  DEFAULT_NAMESPACE,
  DB_VERSION,
  onUpgrade,
);
