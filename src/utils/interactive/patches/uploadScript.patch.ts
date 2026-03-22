import { HapticInterface, SITHookEvent, withPatcher } from '../types';
import { getFunscript } from '../utils';
import { DefaultHandyClient } from '../client';
import { loadScript } from 'ive-connect';

export const uploadScriptPatcher = withPatcher(
  'uploadScript',
  (ctx, dispatcher) => {
    ctx.value(async function uploadScript(
      funscriptPath: string,
      apiKey?: string,
    ) {
      const {
        logger,
        state: {
          current: { device, script, blobUrl },
        },
      } = ctx;

      if (device.id === 'buttplug') {
        const content =
          script ?? (await getFunscript(blobUrl || funscriptPath));
        await device.prepareScript(content, {});
        return;
      }
      logger.debug('dispatching resolve funscript path', funscriptPath);
      const { funscriptPath: url } = await dispatcher(
        SITHookEvent.RESOLVE_FUNSCRIPT_PATH,
        {
          funscriptPath,
          apiKey,
        },
      );
      logger.debug('resolved funscript', { funscriptPath, url });
      if (device.id === HapticInterface.HANDY_DEFAULT) {
        await (device as DefaultHandyClient).loadScript({
          url,
          type: 'funscript',
        });
      } else if (url) {
        logger.debug('uploading script', url);
        const results = await loadScript({ url, type: 'funscript' });
        if (!results.funscript)
          throw new Error(`Failed to load script from ${url}`);
        if (!device.isConnected) {
          ctx.logger.debug(
            `connecting to device ${device.id} for upload ${url}`,
          );
          await device.connect();
          logger.debug(`connected to device ${device.id} for upload ${url}`);
        }
        logger.debug('preparing script');
        await device.prepareScript(results.funscript);
        logger.debug('prepared script');
      }
    });
  },
);
