import { HapticInterface, withPatcher } from '../types';
import { getPlayerPosition } from '../utils';
import { DeviceSettings, HandyDevice } from 'ive-connect';

export const connectPatcher = withPatcher('connect', (ctx) => {
  ctx.value(async function connect() {
    const {
      logger,
      state: {
        current: { device },
      },
    } = ctx;

    logger.debug('connecting....');

    await device.connect(device.getConfig());
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
    } = ctx;
    ctx.logger.debug('configure', config);
    await device.updateConfig(config);
  });
  /* const client = ctx.api as InteractiveClient;
  requestAnimationFrame(() => {
    client
      .resume('configure', async (m) => {
        ctx.logger.debug('configure suspended');
        const { device } = ctx.state.current;
        const config = m.args[0] as Partial<DeviceSettings>;
        if (config.connectionKey) {
          client.handyKey = String(config.connectionKey);
        }
        await device.updateConfig(config);
        return m._resolve();
      })
      .finally(() => {
        ctx.logger.debug('configure resumed');
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
    } = ctx;
    ctx.logger.debug('sync');

    const timeMs = (getPlayerPosition() ?? 0) * 1000;
    if (!device.isConnected) {
      ctx.logger.debug('connecting to device for sync');
      await device.connect();
    }
    ctx.logger.debug('syncing time', timeMs);
    await device.syncTime(timeMs);
    ctx.logger.debug('synced time', timeMs);
    try {
      if (device.id == HapticInterface.HANDY_DEFAULT) {
        return api._handy.estimatedServerTimeOffset;
      } else if (device.id === HapticInterface.HANDY_FW4) {
        return (device as HandyDevice).api.getServerTimeOffset();
      }
    } catch (e) {
      ctx.logger.error(e);
    }
    // buttplug || autoblow
    return 0;
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
    if (!device.isConnected) {
      ctx.logger.debug('connecting to device for play');
      await device.connect();
    }
    ctx.logger.debug(
      'play connected',
      position,
      device.isPlaying,
      device.isConnected,
    );

    await device.play(position * 1000);
  });
});
