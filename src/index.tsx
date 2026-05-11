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
    if (!enableInteractiveTools(props.scene)) {
      return props.children;
    }
    logger.info('ScenePage.Tabs:', {
      children: props.children,
      args,
    });
    return [
      props.children,

      <Nav.Item>
        <Nav.Link eventKey="scene-interactive-panel">Interactive</Nav.Link>
      </Nav.Item>,
    ];
  },
);

patch.after(
  'ScenePage.TabContent',
  (props: PropsWithChildren<SceneFileInfoPanelProps>, ...args) => {
    if (!enableInteractiveTools(props.scene)) {
      return props.children;
    }
    logger.info('ScenePage.TabContent', {
      children: props.children,
      args,
    });

    return [
      props.children,
      <Tab.Pane
        eventKey="scene-interactive-panel"
        className="stash-interactive-tools-tab"
      >
        <InteractiveToolsTab scene={props.scene} />
      </Tab.Pane>,
    ];
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
  logger.info('MainNavBar.UtilityItems', {
    props,
    args,
  });

  return [
    ...args.filter((c) => c && '$$typeof' in c),
    <UtilityItems {...props} />,
  ];
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
