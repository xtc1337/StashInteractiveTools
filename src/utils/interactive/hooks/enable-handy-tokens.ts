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
      logger,
      state: { current: state },
    } = ctx;
    const { device } = state;

    if (!cache.id || cache.id !== state.id) {
      logger.debug('cache invalidated');
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
      logger.debug('checking for handy tokens');
      const script = state.script;
      const withinTokenFileSize = getJsonFileSize(script) <= 2100;
      const {
        actions: [first],
      } = script;
      const hasTokenFirstPosition = first.pos === 0 && first.at === 66;
      if (withinTokenFileSize && hasTokenFirstPosition) {
        logger.debug('handy tokens detected');
        if (cache.url) {
          logger.debug('using cached handy tokens url');
          funscriptPath = cache.url;
        } else {
          logger.debug('generating handy tokens url');
          cache.url = funscriptPath = await getHandyFeelingUrl(script);
        }
        useOriginal = false;
      }
    }

    if (!state.ivdb && useOriginal) {
      logger.debug('using original funscript path');
      funscriptPath = state.blobUrl || funscriptPath;
      if (deviceSupportsHandyTokens(device)) {
        funscriptPath = await getHandyFeelingUrl(funscriptPath);
      }
    } else {
      logger.debug('using ivdb funscript path');
    }
    return { funscriptPath };
  },
};
