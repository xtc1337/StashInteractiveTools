import './style.scss';

import { SceneDataFragment } from './generated-graphql';
import React, { PropsWithChildren, useEffect, useMemo } from 'react';
import { InteractiveToolsTab } from './components';
import { Button, Nav, Tab } from 'react-bootstrap';
import { GQL, patch, utils } from './api';
import {
  addSITEventListener,
  ConnectionState,
  createDebugConsole,
  DEFAULT_NAMESPACE,
  enableInteractiveTools,
  removeSITEventListener,
  SITConnectionStatusUpdatedEvent,
  SITEvent,
  SITPluginConfig,
  TheHandyIcon,
} from './utils';
import {
  PluginSettings,
  PluginSettingsProps,
} from './components/PluginSettings';
import './utils/interactive/client-provider';
import { useDebouncedCallback } from 'use-debounce';

interface SceneFileInfoPanelProps {
  scene: SceneDataFragment;
}

patch.after(
  'ScenePage.Tabs',
  (props: PropsWithChildren<SceneFileInfoPanelProps>) => {
    if (!enableInteractiveTools(props.scene)) {
      return props.children;
    }
    return (
      <>
        {props.children}
        <Nav.Item>
          <Nav.Link eventKey="scene-interactive-panel">Interactive</Nav.Link>
        </Nav.Item>
      </>
    );
  },
);

patch.after(
  'ScenePage.TabContent',
  (props: PropsWithChildren<SceneFileInfoPanelProps>) => {
    if (!enableInteractiveTools(props.scene)) {
      return props.children;
    }
    return (
      <>
        {props.children}
        <Tab.Pane
          eventKey="scene-interactive-panel"
          className="stash-interactive-tools-tab"
        >
          <InteractiveToolsTab scene={props.scene} />
        </Tab.Pane>
      </>
    );
  },
);

patch.instead(
  'PluginSettings',
  (props: PluginSettingsProps, _, originalComponent) => {
    if (props.pluginID !== DEFAULT_NAMESPACE) return originalComponent(props);
    return <PluginSettings {...props} />;
  },
);

const SHOULD_ANIMATE_CONNECTION_STATES = [
  ConnectionState.Uploading,
  ConnectionState.Connecting,
  ConnectionState.Syncing,
];
const logger = createDebugConsole("'MainNavBar.UtilityItems");
patch.after('MainNavBar.UtilityItems', (props: PropsWithChildren) => {
  const [connectionState, setConnectionState] = React.useState<ConnectionState>(
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

  useEffect(() => {
    const onConnectionStateUpdated = (
      event: SITConnectionStatusUpdatedEvent,
    ) => {
      logger.debug('Connection state updated:', event.detail.data.state);
      setConnectionState(event.detail.data.state);
    };
    logger.debug('Setting up connection state listener');
    addSITEventListener(
      SITEvent.CONNECTION_STATUS_UPDATED,
      logger.namespace,
      onConnectionStateUpdated,
    );
    return () => {
      console.log('REMOVING');
      logger.debug('Removing connection state listener');
      removeSITEventListener(
        SITEvent.CONNECTION_STATUS_UPDATED,
        logger.namespace,
      );
    };
  }, []);
  const animate =
    !disableHapticInterface &&
    SHOULD_ANIMATE_CONNECTION_STATES.includes(connectionState);
  return (
    <>
      {props.children}
      <div className="stash-interactive-tools-utility-item">
        <Button
          className="nav-utility minimal"
          title={'toggle interactive'}
          onClick={onToggleInteractive}
        >
          <TheHandyIcon
            size={20}
            animate={animate}
            disabled={disableHapticInterface}
          />
        </Button>
      </div>
    </>
  );
});
