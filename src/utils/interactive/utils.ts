import { Funscript } from 'funscript-utils/lib/types';
import { FunMapper } from 'funscript-utils';
import videojs from 'video.js';

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
  videojs.getPlayer(VIDEO_PLAYER_ID)?.currentTime();
