import { InteractiveAPI, utils } from '../../api';
import * as GQL from '../../generated-graphql';
import { createDebugConsole } from '../common';
import Handy from 'thehandy';
import { DeviceSettings } from 'ive-connect';
import { InteractiveAPIDeferredMethod, PatchableMethodName } from './types';

export interface IInteractiveClientProviderOptions {
  handyKey: string;
  scriptOffset: number;
  defaultClientProvider: IInteractiveClientProvider;
  stashConfig?: GQL.ConfigDataFragment;
}
interface IInteractiveClientProvider {
  (options: IInteractiveClientProviderOptions): InteractiveAPI;
}
const interactiveUtils = utils.InteractiveUtils as {
  interactiveClientProvider: IInteractiveClientProvider | undefined;
};

const logger = createDebugConsole('interactive-client-provider');

export class InteractiveClient {
  _connected: boolean;
  _playing: boolean;
  _scriptOffset: number;
  _handy: Handy;
  _useStashHostedFunscript: boolean;
  _deferred: boolean;
  private _deferredMethods = {} as Record<
    PatchableMethodName,
    InteractiveAPIDeferredMethod<PatchableMethodName>
  >;

  constructor(private api: InteractiveAPI) {
    this._deferred = true;
    this._handy = api._handy;

    this._scriptOffset = api.scriptOffset;
    this._useStashHostedFunscript = false;
    this._connected = false;
    this._playing = false;
  }

  get connected() {
    return this.api.connected;
  }
  get playing() {
    return this.api.playing;
  }

  async connect() {
    logger.log('connecting...');
  }

  set handyKey(key: string) {
    this._handy.connectionKey = key;
  }

  get handyKey(): string {
    return this._handy.connectionKey;
  }

  set useStashHostedFunscript(useStashHostedFunscript: boolean) {
    this._useStashHostedFunscript = useStashHostedFunscript;
  }

  get useStashHostedFunscript(): boolean {
    return this._useStashHostedFunscript;
  }

  set scriptOffset(offset: number) {
    this._scriptOffset = offset;
  }

  async uploadScript(_funscriptPath: string, _apiKey?: string) {}

  async sync() {
    return this._handy.getServerTimeOffset();
  }

  setServerTimeOffset(offset: number) {
    this._handy.estimatedServerTimeOffset = offset;
  }

  async configure(config: Partial<DeviceSettings>) {
    if (this._deferred) {
      return new Promise<void>((resolve, reject) => {
        this._deferredMethods['configure'] = {
          _resolve: async () => {
            resolve();

            this._deferred = false;
          },
          _reject: () => {
            reject();
          },
          args: [config],
        };
      });
    }
  }

  async play(_position: number) {}

  async pause() {}

  async ensurePlaying(_position: number) {}

  async setLooping(_looping: boolean) {}

  async resume<M extends PatchableMethodName>(
    name: M,
    callback: (d: InteractiveAPIDeferredMethod<M>) => Promise<void>,
  ) {
    if (this._deferredMethods[name]) {
      await callback(this._deferredMethods[name]);
      delete this._deferredMethods[name];
    }
  }
  get deferred() {
    return this._deferred;
  }
}

interactiveUtils.interactiveClientProvider = (
  opts: IInteractiveClientProviderOptions,
) => {
  const provider = opts.defaultClientProvider(opts);

  return new InteractiveClient(provider);
};
