import { HapticInterface, PatchContext, withPatcher } from '../types';
import { getPlayerPosition } from '../utils';
import { DeviceSettings, HandyDevice } from 'ive-connect';
import { Any } from '../../../api';

type AsyncFunction<T> = (...args: unknown[]) => Promise<T>;
export async function tryError<T>(
  ctx: PatchContext<Any>,
  fn: AsyncFunction<T>,
) {
  const {
    // logger,
    state: {
      current: { device },
    },
  } = ctx;
  let error: Error | undefined;
  const sink = (e: unknown) => {
    error = new Error(e as string);
  };
  device.on('error', sink);
  await fn();
  device.off('error', sink);
  if (error) throw error;
  return;
}
export const connectPatcher = withPatcher('connect', (ctx) => {
  ctx.value(async function connect() {
    const {
      logger,
      state: {
        current: { device },
      },
    } = ctx;

    logger.debug('connecting....');
    await tryError(ctx, () => device.connect(device.getConfig()));

    logger.debug('connected!');
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

export const configurePatcher = withPatcher('configure', (ctx) => {
  ctx.value(async function configure(config: Partial<DeviceSettings>) {
    const {
      state: {
        current: { device },
      },
      logger,
    } = ctx;
    logger.debug('configure', config);
    await device.updateConfig(config);
    logger.debug('configured!');
  });
  /* const client = ctx.api as InteractiveClient;
  requestAnimationFrame(() => {
    client
      .resume('configure', async (m) => {
        logger.debug('configure suspended');
        const { device } = ctx.state.current;
        const config = m.args[0] as Partial<DeviceSettings>;
        if (config.connectionKey) {
          client.handyKey = String(config.connectionKey);
        }
        await device.updateConfig(config);
        return m._resolve();
      })
      .finally(() => {
        logger.debug('configure resumed');
      });
  }); */
});

export const syncPatcher = withPatcher('sync', (ctx) => {
  ctx.value(async function sync() {
    const {
      api,
      state: {
        current: { device },
      },
      logger,
    } = ctx;
    logger.debug('sync');

    const timeMs = (getPlayerPosition() ?? 0) * 1000;
    if (!device.isConnected) {
      logger.debug('connecting to device for sync');
      await device.connect();
      logger.debug('connected to device for sync');
    }
    logger.debug('syncing time', timeMs);
    await device.syncTime(timeMs);
    logger.debug('synced time', timeMs);
    try {
      if (device.id == HapticInterface.HANDY_DEFAULT) {
        return api._handy.estimatedServerTimeOffset;
      } else if (device.id === HapticInterface.HANDY_FW4) {
        return (device as HandyDevice).api.getServerTimeOffset();
      }
    } catch (e) {
      logger.error(e);
    }
    // buttplug || autoblow
    return 0;
  });
});

export const pausePatcher = withPatcher('pause', (ctx) => {
  ctx.value(async function pause() {
    const {
      logger,
      state: {
        current: { device },
      },
    } = ctx;

    logger.debug('pausing...');
    await device.stop();
    logger.debug('paused!');
  });
});

export const ensurePlayingPatcher = withPatcher('ensurePlaying', (ctx) => {
  ctx.value(async function ensurePlaying(position: number) {
    const {
      state: {
        current: { device },
      },
      logger,
    } = ctx;
    logger.debug('ensurePlaying', position, device.isPlaying);
    if (device.isPlaying) {
      logger.debug('ensurePlaying already playing');
      return;
    }

    logger.debug('triggering play for ensurePlaying');
    await device.play(position);
    logger.debug('ensurePlaying triggered play');
  });
});

export const playPatcher = withPatcher('play', (ctx) => {
  ctx.value(async function play(position: number) {
    const {
      state: {
        current: { device },
      },
      logger,
    } = ctx;
    logger.debug('play', position, device.isPlaying);
    if (!device.isConnected) {
      logger.debug('connecting to device for play');
      await device.connect();
      logger.debug('connected to device for play');
    }

    logger.debug('playing at', position, position * 1000);
    await device.play(position * 1000);
    logger.debug('played at', position, position * 1000);
  });
});
