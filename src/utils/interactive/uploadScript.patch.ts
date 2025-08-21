import { MethodPatcher } from './types';

export const uploadScriptPatcher: MethodPatcher<'uploadScript'> = {
  name: 'uploadScript',
  bind: (ctx) => {
    return async function (funscriptPath: string, apiKey?: string) {
      if (!ctx.state.current.ivdb) return ctx.original(funscriptPath, apiKey);
      try {
        const handy = ctx.api._handy;

        if (handy.currentMode !== 1) {
          await handy.setMode(1); // hssp
        }

        const json: { result: number } = await handy.putJson('hssp/setup', {
          url: funscriptPath,
        });
        // can't call handy.setHsspSetup because it does an un-needed encodeURI call which breaks the token url
        handy.hsspPreparedUrl = funscriptPath;

        handy.hsspState = 3; // stopped
        ctx.api._connected = handy.connected = json.result === 1;
        /*interactiveApi._connected = await handy
                 .setHsspSetup(funscriptPath)
                 .then((result: number) => result === 1); // HsspSetupResult.downloaded*/
      } catch (e) {
        console.error(e);
      }
    };
  },
};
