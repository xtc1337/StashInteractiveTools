import { SITHookEvent, withPatcher } from '../types';

export const uploadScriptPatcher = withPatcher(
  'uploadScript',
  (ctx, dispatcher) => {
    ctx.value(async function uploadScript(
      funscriptPath: string,
      apiKey?: string,
    ) {
      const { funscriptPath: url } = await dispatcher(
        SITHookEvent.RESOLVE_FUNSCRIPT_PATH,
        {
          funscriptPath,
          apiKey,
        },
      );
      const {
        state: {
          current: { device },
        },
      } = ctx;
      await device.loadScript({
        url,
        type: 'funscript',
      });
    });
  },
);
