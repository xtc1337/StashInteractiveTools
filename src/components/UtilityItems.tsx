import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  addSITEventListener,
  ConnectionState,
  createDebugConsole,
  HandyIconState,
  removeSITEventListener,
  SITEvent,
  SITEvents,
  SITPluginConfig,
  TheHandyIcon,
} from '../utils';
import { GQL, utils } from '../api';
import { useDebouncedCallback } from 'use-debounce';
import { Button } from 'react-bootstrap';

const SHOULD_ANIMATE_CONNECTION_STATES = [
  ConnectionState.Uploading,
  ConnectionState.Connecting,
  ConnectionState.Syncing,
];

const logger = createDebugConsole("'MainNavBar.UtilityItems");
export const UtilityItems = (props: PropsWithChildren) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Missing,
  );

  const { data: stashConfig } = GQL.useConfigurationQuery();

  const sitPluginConfig: SITPluginConfig | undefined =
    stashConfig?.configuration?.plugins?.['StashInteractiveTools'];

  const disableHapticInterface = useMemo(() => {
    return sitPluginConfig?.disableHapticInterface ?? false;
  }, [sitPluginConfig]);
  const [updatePluginConfig] = utils.StashService.useConfigurePlugin();

  const onToggleInteractive = useDebouncedCallback(
    async () => {
      if (!sitPluginConfig) return;
      const disabled = !sitPluginConfig.disableHapticInterface;

      logger.debug('Toggling interactive', disabled);
      await updatePluginConfig({
        variables: {
          plugin_id: 'StashInteractiveTools',
          input: {
            ...sitPluginConfig,
            disableHapticInterface: disabled,
          },
        },
      });
    },
    500,
    {
      leading: true,
    },
  );
  const onSITEvent = useCallback(
    (event: SITEvents) => {
      switch (event.detail.event) {
        case SITEvent.CONNECTION_STATUS_UPDATED:
          logger.debug('Connection state updated:', event.detail.data.state);
          setConnectionState(event.detail.data.state);
          break;
        case SITEvent.INCORRECT_SETUP:
          break;
      }
    },
    [setConnectionState],
  );

  useEffect(() => {
    logger.debug('Setting up connection state listener');
    addSITEventListener(
      [SITEvent.CONNECTION_STATUS_UPDATED, SITEvent.INCORRECT_SETUP],
      logger.namespace,
      onSITEvent,
    );

    return () => {
      removeSITEventListener(
        [SITEvent.CONNECTION_STATUS_UPDATED, SITEvent.INCORRECT_SETUP],
        logger.namespace,
      );
    };
  }, [onSITEvent]);
  const animate =
    !disableHapticInterface &&
    SHOULD_ANIMATE_CONNECTION_STATES.includes(connectionState);
  const error = connectionState === ConnectionState.Error;
  const iconState: HandyIconState = error
    ? 'error'
    : animate
      ? 'animated'
      : disableHapticInterface
        ? 'disabled'
        : 'static';

  return (
    <>
      {props.children}
      <div className="stash-interactive-tools-utility-item">
        <Button
          className="nav-utility minimal"
          title={'toggle interactive'}
          onClick={onToggleInteractive}
        >
          <TheHandyIcon size={20} state={iconState} />
        </Button>
      </div>
    </>
  );
};
