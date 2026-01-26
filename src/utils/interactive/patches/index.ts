import { uploadScriptPatcher } from './uploadScript.patch';
import {
  configurePatcher,
  connectPatcher,
  ensurePlayingPatcher,
  pausePatcher,
  playPatcher,
  scriptOffsetPatcher,
  syncPatcher,
} from './common';

export const DEFAULT_PATCHES = [
  uploadScriptPatcher,
  scriptOffsetPatcher,
  pausePatcher,
  syncPatcher,
  ensurePlayingPatcher,
  playPatcher,
  configurePatcher,
  connectPatcher,
];
