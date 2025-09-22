import { uploadScriptPatcher } from './uploadScript.patch';
import {
  connectPatcher,
  pausePatcher,
  scriptOffsetPatcher,
  syncPatcher,
} from './common';

export const DEFAULT_PATCHES = [
  uploadScriptPatcher,
  connectPatcher,
  scriptOffsetPatcher,
  pausePatcher,
  syncPatcher,
];
