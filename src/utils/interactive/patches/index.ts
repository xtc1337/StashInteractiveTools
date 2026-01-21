import { uploadScriptPatcher } from './uploadScript.patch';
import {
  connectPatcher,
  ensurePlayingPatcher,
  pausePatcher,
  playPatcher,
  scriptOffsetPatcher,
  syncPatcher,
} from './common';

export const DEFAULT_PATCHES = [
  uploadScriptPatcher,
  connectPatcher,
  scriptOffsetPatcher,
  pausePatcher,
  syncPatcher,
  ensurePlayingPatcher,
  playPatcher,
];
