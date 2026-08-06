import './style.scss';

import {
  RunPluginOperationDocument,
  SceneDataFragment,
} from './generated-graphql';
import React, { PropsWithChildren } from 'react';
import { InteractiveToolsTab } from './components';
import { Nav, Tab } from 'react-bootstrap';
import { patch } from './api';
import {
  appendToNativeResult,
  createDebugConsole,
  deepSnakeCase,
  DEFAULT_NAMESPACE,
  enableInteractiveTools,
} from './utils';
import {
  PluginSettings,
  PluginSettingsProps,
} from './components/PluginSettings';
import './utils/interactive/client-provider';
import { UtilityItems } from './components/UtilityItems';
import { ApolloClient, ApolloLink } from '@apollo/client';
import type { NormalizedCacheObject } from '@apollo/client/cache/inmemory/types';
import getClient = PluginApi.utils.StashService.getClient;

interface SceneFileInfoPanelProps {
  scene: SceneDataFragment;
}
const logger = createDebugConsole('index');

patch.after(
  'ScenePage.Tabs',
  (props: PropsWithChildren<SceneFileInfoPanelProps>, ...args) => {
    logger.info('ScenePage.Tabs:', {
      children: props.children,
      args,
    });

    return appendToNativeResult(
      args,
      enableInteractiveTools(props.scene) ? (
        <Nav.Item>
          <Nav.Link eventKey="scene-interactive-panel">Interactive</Nav.Link>
        </Nav.Item>
      ) : undefined,
    );
  },
);

patch.after(
  'ScenePage.TabContent',
  (props: PropsWithChildren<SceneFileInfoPanelProps>, ...args) => {
    logger.info('ScenePage.TabContent', {
      children: props.children,
      args,
    });

    return appendToNativeResult(
      args,
      enableInteractiveTools(props.scene) ? (
        <Tab.Pane
          eventKey="scene-interactive-panel"
          className="stash-interactive-tools-tab"
        >
          <InteractiveToolsTab scene={props.scene} />
        </Tab.Pane>
      ) : undefined,
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

patch.after('MainNavBar.UtilityItems', (props, ...args) => {
  // const result = args[args.length - 1];

  return appendToNativeResult(
    args,
    <UtilityItems key={`${DEFAULT_NAMESPACE}-utility-items`} {...props} />,
  );
});

const interceptLink = new ApolloLink((operation, forward) => {
  if (operation.operationName != 'ScenesDestroy') return forward(operation);
  if (!operation.variables.delete_file) return forward(operation);
  const variables = operation.variables;

  operation.operationName = 'RunPluginOperation';
  operation.query = RunPluginOperationDocument;
  operation.variables = {
    plugin_id: 'StashInteractiveTools',
    args: {
      mode: 'manage',
      action: 'DELETE_SCENES',
      payload: deepSnakeCase(variables),
    },
  };

  return forward(operation).map((response) => {
    return {
      ...response,
      data: {
        ...response.data,
        scenesDestroy: response.data?.runPluginOperation.scenesDestroy,
      },
    };
  });
});

const client: ApolloClient<NormalizedCacheObject> = getClient();
client.setLink(ApolloLink.from([interceptLink, client.link]));
