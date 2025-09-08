import { MethodPatcher } from './types';
import { Funscript } from 'funscript-utils/lib/types';

async function uploadCsv(
  csv: File,
  filename?: string,
): Promise<{ url: string }> {
  const url = 'https://www.handyfeeling.com/api/sync/upload?local=true';
  if (!filename) filename = 'script_' + new Date().valueOf() + '.csv';
  const formData = new FormData();
  formData.append('syncFile', csv, filename);
  const response = await fetch(url, {
    method: 'post',
    body: formData,
  });
  return await response.json();
}
// Converting to CSV first instead of uploading Funscripts is required
// Reference for Funscript format:
// https://pkg.go.dev/github.com/funjack/launchcontrol/protocol/funscript
function convertFunscriptToCSV(funscript: Funscript) {
  const lineTerminator = '\r\n';
  if (funscript?.actions?.length > 0) {
    return funscript.actions.reduce((prev: string, curr) => {
      return `${prev}${curr.at},${curr.pos}${lineTerminator}`;
    }, `#Created by stash.app(SIT) ${new Date().toUTCString()}\n`);
  }
  throw new Error('Not a valid funscript');
}
async function getHandyFeelingUrl(script: Funscript) {
  const csv = convertFunscriptToCSV(script);
  const fileName = `${Math.round(Math.random() * 100000000)}.csv`;
  const csvFile = new File([csv], fileName);

  return await uploadCsv(csvFile).then((response) => response.url);
}
function getJsonFileSize<T>(json: T): number {
  // Convert JSON object to string
  const jsonString = JSON.stringify(json);

  // Calculate the byte size of the JSON string
  return new Blob([jsonString]).size;
}
export const uploadScriptPatcher: MethodPatcher<'uploadScript'> = {
  name: 'uploadScript',
  patch: function (ctx) {
    let cache = {
      id: '',
      url: '',
    };
    return async (funscriptPath: string, apiKey?: string) => {
      const state = ctx.state.current;
      if (!cache.id || cache.id !== state.id) {
        cache = {
          id: state.id,
          url: '',
        };
      }

      if (state.script && !state.ivdb && state.config.handleHandyFileTokens) {
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
        }
      } else if (!state.ivdb) return ctx.original(funscriptPath, apiKey);

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
