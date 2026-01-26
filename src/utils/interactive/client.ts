import {
  DeviceCapability,
  DeviceInfo,
  DeviceScriptLoadResult,
  DeviceSettings,
  Funscript,
  HandyDeviceInfo,
  HandySettings,
  HapticDevice,
  ScriptData,
} from 'ive-connect';
import { ConnectionState } from 'ive-connect';
import { Any, InteractiveAPI } from '../../api';

import Handy from 'thehandy';
export enum HandyFirmwareStatus {
  upToDate = 0,
  updateRequired = 1,
  updateAvailable = 2,
}
type Config = HandySettings;

const DEFAULT_CONFIG: Config = {
  id: 'default',
  name: 'Handy',
  connectionKey: '',

  enabled: true,
  offset: 0,
  stroke: {
    min: 0,
    max: 1,
  },
};

export interface DefaultDeviceSettings extends DeviceSettings {
  offset?: number;
  stroke?: {
    min: number;
    max: number;
  };
}

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
    this._config = { ...DEFAULT_CONFIG, ...this._config, ...config };
    this._handy.connectionKey = this._config.connectionKey;
    const connected = await this._handy.getConnected();
    if (!connected) {
      throw new Error('Handy not connected');
    }
    const info = await this._handy.getInfo();
    console.log('info', info);
    if (info.fwStatus === HandyFirmwareStatus.updateRequired) {
      throw new Error('Handy firmware update required');
    }
    const offset = await this._handy.getHstpOffset();
    const slideInfo = await this._handy.getSlideSettings();
    this._config = {
      ...this._config,
      stroke: slideInfo,
      offset,
    };
    this._connectionState = ConnectionState.CONNECTED;
    return this.isConnected;
  }

  async disconnect(): Promise<boolean> {
    if (this._isPlaying) {
      await this.stop();
    }
    this._connectionState = ConnectionState.DISCONNECTED;

    return true;
  }
  getConfig(): DefaultDeviceSettings {
    return this._config;
  }
  async updateConfig({
    stroke,
    offset,
    ...config
  }: Partial<DefaultDeviceSettings>): Promise<boolean> {
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

    if (stroke) {
      await this._handy.setSlideSettings(stroke.min * 100, stroke.max * 100);
      this._config.stroke = stroke;
    }
    if (offset !== undefined) {
      await this._handy.setHstpoffset(offset);
      this._config.offset = offset;
    }
    return true;
  }
  async prepareScript(_funscript: Funscript): Promise<DeviceScriptLoadResult> {
    throw new Error('Method not implemented.');
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
        Math.round(timeMs + this._config.offset),
        this._handy.estimatedServerTimeOffset + Date.now(), // our guess of the Handy server's UNIX epoch time
      )
      .then(() => true);

    return this._isPlaying;
  }
  async stop(): Promise<boolean> {
    if (!this.isConnected) {
      return true;
    }
    if (this._isPlaying) {
      this._isPlaying = await this._handy.setHsspStop().then(() => false);
    }
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
