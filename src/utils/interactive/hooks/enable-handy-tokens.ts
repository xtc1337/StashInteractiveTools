import { SITHook, SITHookEvent } from '../types';

import { deviceSupportsHandyTokens, getHandyFeelingUrl } from '../utils';

let cache = {
  id: '',
  url: '',
};

function getJsonFileSize<T>(json: T): number {
  // Convert JSON object to string
  const jsonString = JSON.stringify(json);

  // Calculate the byte size of the JSON string
  return new Blob([jsonString]).size;
}
export const enableHandyTokens: SITHook<SITHookEvent.RESOLVE_FUNSCRIPT_PATH> = {
  event: SITHookEvent.RESOLVE_FUNSCRIPT_PATH,
  name: 'enableHandyTokens',

  async apply(ctx, { funscriptPath }) {
    const {
      state: { current: state },
    } = ctx;
    const { device } = state;

    if (!cache.id || cache.id !== state.id) {
      cache = {
        id: state.id,
        url: '',
      };
    }
    let useOriginal = true;
    if (
      state.script &&
      !state.ivdb &&
      state.config.handleHandyFileTokens &&
      deviceSupportsHandyTokens(device)
    ) {
      const script = state.script;
      const withinTokenFileSize = getJsonFileSize(script) <= 2100;
      const {
        actions: [first],
      } = script;
      const hasTokenFirstPosition = first.pos === 0 && first.at === 66;
      if (withinTokenFileSize && hasTokenFirstPosition) {
        if (cache.url) {
          funscriptPath = cache.url;
        } else {
          cache.url = funscriptPath = await getHandyFeelingUrl(script);
        }
        useOriginal = false;
      }
    }

    if (!state.ivdb && useOriginal) {
      funscriptPath = state.blobUrl || funscriptPath;
      if (deviceSupportsHandyTokens(device)) {
        funscriptPath = await getHandyFeelingUrl(funscriptPath);
      }
    }
    return { funscriptPath };
  },
};
