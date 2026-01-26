import React from 'react';
import { SceneDataFragment } from '../generated-graphql';
import { InteractiveToolsProvider, useInteractiveTools } from '../hooks';
import StrokeSlider from './StrokeSlider';
import SyncSlider from './SyncSlider';
import ScriptChooser from './ScriptChooser';
import { ModifyScript } from './ModifyScript';
import { ConnectionState } from '../utils';

type Props = {
  scene: SceneDataFragment;
};

const InteractiveToolsContent = () => {
  const { currentPaths, onChange, entries, defaultPaths, state } =
    useInteractiveTools();

  return (
    <div className="stash-interactive-tools">
      <dl className="container  details-list">
        <ScriptChooser
          disabled={state !== ConnectionState.Ready}
          value={currentPaths.src || ''}
          defaultScript={defaultPaths.src || ''}
          onChange={onChange}
          options={entries}
        />
        <StrokeSlider />
        <SyncSlider />
      </dl>
      <ModifyScript />
    </div>
  );
};
export const InteractiveToolsTab = (props: Props) => {
  return (
    <InteractiveToolsProvider scene={props.scene}>
      <InteractiveToolsContent />
    </InteractiveToolsProvider>
  );
};
