import { withPatcher } from '../types';
import { getPlayerPosition } from '../utils';

export const connectPatcher = withPatcher('connect', (ctx) => {
  ctx.value(async function connect() {
    const {
      api,
      logger,
      state: {
        current: { device },
      },
    } = ctx;

    logger.debug('connect');
    if (device.id === 'handy') {
      await device.connect({
        connectionKey: api.handyKey,
      });
    } else {
      await device.connect();
    }
  });
});

export const scriptOffsetPatcher = withPatcher('scriptOffset', (ctx) => {
  ctx.set((value: number) => {
    const device = ctx.state.current.device;
    const config = device.getConfig();
    if ('offset' in config) {
      config.offset = value;
    }
    return value;
  });
});

export const syncPatcher = withPatcher('sync', (ctx) => {
  ctx.value(async function sync() {
    const {
      api,
      state: {
        current: { device },
      },
    } = ctx;

    const timeMs = (getPlayerPosition() ?? 0) * 1000;
    await device.syncTime(timeMs);

    return api._handy.estimatedServerTimeOffset;
  });
});

export const pausePatcher = withPatcher('pause', (ctx) => {
  ctx.value(async function pause() {
    const {
      state: {
        current: { device },
      },
    } = ctx;

    await device.stop();
  });
});

export const ensurePlayingPatcher = withPatcher('ensurePlaying', (ctx) => {
  ctx.value(async function ensurePlaying(position: number) {
    const {
      state: {
        current: { device },
      },
    } = ctx;
    ctx.logger.debug('ensurePlaying', position, device.isPlaying);
    if (device.isPlaying) {
      return;
    }

    await device.play(position);
  });
});

export const playPatcher = withPatcher('play', (ctx) => {
  ctx.value(async function play(position: number) {
    const {
      state: {
        current: { device },
      },
    } = ctx;
    ctx.logger.debug('play', position, device.isPlaying);

    await device.play(position);
  });
});
