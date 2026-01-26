import { FunMapper } from 'funscript-utils';

import { utils } from '../../api';
import { Funscript, HapticDevice } from 'ive-connect';

const canvas = document.createElement('canvas');
canvas.width = 1280;
canvas.height = 60;
const rootVars = document.documentElement;

export function replaceHeatMap(url: string) {
  rootVars.style.setProperty(
    '--stash-interactive-tools-heatmap',
    `url(${url})`,
    'important',
  );
}

export async function getFunscript(url: string) {
  return (await fetch(url).then((response) => response.json())) as Funscript;
}
export async function generateHeatmap(urlOrFunscript: string | Funscript) {
  const script =
    typeof urlOrFunscript === 'string'
      ? await getFunscript(urlOrFunscript)
      : urlOrFunscript;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  FunMapper.renderHeatmap(canvas, script, {
    background: 'rgba(255,255, 255, 0)',
  });
  return canvas.toDataURL('image/png');
}

export const VIDEO_PLAYER_ID = 'VideoJsPlayer';
export const getPlayerPosition = () =>
  utils.InteractiveUtils.getPlayer()?.currentTime();

export function deviceSupportsHandyTokens(device: HapticDevice) {
  return device.id === 'default';
}

// Converting to CSV first instead of uploading Funscripts is required
// Reference for Funscript format:
// https://pkg.go.dev/github.com/funjack/launchcontrol/protocol/funscript
export function convertFunscriptToCSV(funscript: Funscript) {
  const lineTerminator = '\r\n';
  if (funscript?.actions?.length > 0) {
    return funscript.actions.reduce((prev: string, curr) => {
      return `${prev}${curr.at},${curr.pos}${lineTerminator}`;
    }, `#Created by stash.app(SIT) ${new Date().toUTCString()}\n`);
  }
  throw new Error('Not a valid funscript');
}
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

export async function getHandyFeelingUrl(
  script: Funscript | string,
): Promise<string> {
  const csv =
    typeof script !== 'string'
      ? convertFunscriptToCSV(script)
      : await fetch(script)
          .then((response) => response.json())
          .then((json) => convertFunscriptToCSV(json as Funscript));

  const fileName = `${Math.round(Math.random() * 100000000)}.csv`;
  const csvFile = new File([csv], fileName);

  return await uploadCsv(csvFile).then((response) => response.url);
}
