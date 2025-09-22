import {
  DeviceCapability,
  DeviceInfo,
  DeviceSettings,
  HandyDeviceInfo,
  HandySettings,
  HapticDevice,
  ScriptData,
} from 'ive-connect';
import { ConnectionState } from 'ive-connect/dist/core/device-interface';
import { Any, InteractiveAPI } from '../../api';

import Handy, { HandyFirmwareStatus } from 'thehandy';

type Config = HandySettings;

const DEFAULT_CONFIG: Config = {
  id: 'handy',
  name: 'Handy',
  connectionKey: '',

  enabled: true,
  offset: 0,
  stroke: {
    min: 0,
    max: 1,
  },
};

export class DefaultHandyClient implements HapticDevice {
  readonly id: string = 'default';
  readonly name: string = 'Default';
  readonly type: string = 'handy';
  private _handy: InteractiveAPI['_handy'];
  private _config: Config;
  private _connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private _deviceInfo: HandyDeviceInfo | null = null;
  private _isPlaying: boolean = false;

  readonly capabilities: DeviceCapability[] = [
    DeviceCapability.LINEAR,
    DeviceCapability.STROKE,
  ];
  constructor(handy: Handy, handyKey: string = '', scriptOffset: number = 0) {
    this._handy = handy;

    this._config = {
      ...DEFAULT_CONFIG,
      connectionKey: handyKey,
      offset: scriptOffset,
    };
  }
  get isConnected(): boolean {
    return this._connectionState === ConnectionState.CONNECTED;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }
  async connect(config?: Config) {
    this._config = config ?? { ...DEFAULT_CONFIG };
    this._handy.connectionKey = this._config.connectionKey;
    const connected = await this._handy.getConnected();
    if (!connected) {
      throw new Error('Handy not connected');
    }
    const info = await this._handy.getInfo();
    if (info.fwStatus === HandyFirmwareStatus.updateRequired) {
      throw new Error('Handy firmware update required');
    }
    const slideInfo = await this._handy.getSlideSettings();
    this._config = {
      ...this._config,
      stroke: slideInfo,
    };
    this._connectionState = ConnectionState.CONNECTED;
    return this.isConnected;
  }

  disconnect(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  getConfig(): DeviceSettings {
    return this._config;
  }
  async updateConfig(config: Partial<DeviceSettings>): Promise<boolean> {
    if (config.looping) {
      await this._handy.setHsspLoop(config.looping as boolean);
    }
    if (config.estimatedServerTimeOffset) {
      this._handy.estimatedServerTimeOffset = config.estimatedServerTimeOffset;
    }
    this._config = {
      ...this._config,
      ...config,
    };
    this._handy.connectionKey = this._config.connectionKey;
    return true;
  }
  async loadScript(
    scriptData: ScriptData,
  ): Promise<{ success: boolean; scriptContent?: ScriptData }> {
    if (!scriptData.url) throw new Error('Script URL is required');

    if (this._handy.currentMode !== 1) {
      await this._handy.setMode(1); // hssp
    }

    const json: { result: number } = await (this._handy as Any).putJson(
      'hssp/setup',
      {
        url: scriptData.url,
      },
    );
    // can't call handy.setHsspSetup because it does an un-needed encodeURI call which breaks the token url
    this._handy.hsspPreparedUrl = scriptData.url;

    this._handy.hsspState = 3; // stopped
    this._handy.connected = json.result === 1;
    if (this._handy.connected) {
      this._connectionState = ConnectionState.CONNECTED;
    }
    return { success: true };
  }
  async play(timeMs: number) {
    if (!this.isConnected) {
      return false;
    }
    this._isPlaying = await this._handy
      .setHsspPlay(
        Math.round(timeMs * 1000 + this._config.offset),
        this._handy.estimatedServerTimeOffset + Date.now(), // our guess of the Handy server's UNIX epoch time
      )
      .then(() => true);

    return this._isPlaying;
  }
  async stop(): Promise<boolean> {
    if (!this.isConnected) {
      return true;
    }
    this._isPlaying = await this._handy.setHsspStop().then(() => false);
    return true;
  }
  syncTime(_timeMs: number, _filter?: number): Promise<boolean> {
    return this._handy.getServerTimeOffset();
  }
  getDeviceInfo(): DeviceInfo | null {
    throw new Error('Method not implemented.');
  }
  on(_event: string, _callback: (data: Any) => void): void {
    throw new Error('Method not implemented.');
  }
  off(_event: string, _callback: (data: Any) => void): void {
    throw new Error('Method not implemented.');
  }
}
