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
      const { funscriptPath: url } = await dispatcher(
        SITHookEvent.RESOLVE_FUNSCRIPT_PATH,
        {
          funscriptPath,
          apiKey,
        },
      );
      if (device.id === HapticInterface.HANDY_DEFAULT) {
        await (device as DefaultHandyClient).loadScript({
          url,
          type: 'funscript',
        });
      } else if (url) {
        const results = await loadScript({ url, type: 'funscript' });
        if (!results.funscript)
          throw new Error(`Failed to load script from ${url}`);
        if (!device.isConnected) {
          ctx.logger.debug(
            `connecting to device ${device.id} for upload ${url}`,
          );
          await device.connect();
        }
        await device.prepareScript(results.funscript);
      }
    });
  },
);
