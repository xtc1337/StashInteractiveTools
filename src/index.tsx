import './style.scss';

import { SceneDataFragment } from './generated-graphql';
import React, { PropsWithChildren } from 'react';
import { InteractiveToolsTab } from './components';
import { Nav, Tab } from 'react-bootstrap';
import { patch } from './api';
import { DEFAULT_NAMESPACE, enableInteractiveTools } from './utils';
import {
  PluginSettings,
  PluginSettingsProps,
} from './components/PluginSettings';
import './utils/interactive/client-provider';
import { UtilityItems } from './components/UtilityItems';

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

patch.after('MainNavBar.UtilityItems', (props) => {
  return <UtilityItems {...props} />;
});
