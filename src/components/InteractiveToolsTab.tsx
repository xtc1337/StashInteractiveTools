import React from 'react';
import { SceneDataFragment } from '../generated-graphql';
import { InteractiveToolsProvider, useInteractiveTools } from '../hooks';
import StrokeSlider from './StrokeSlider';
import SyncSlider from './SyncSlider';
import ScriptChooser from './ScriptChooser';
import { ModifyScript } from './ModifyScript';
import { ConnectionState } from '../utils';
import { DebugConsoleModal, useDebugConsole } from './DebugConsoleModal';
import { InteractiveToolsControls } from './InteractiveToolsControls';

type Props = {
  scene: SceneDataFragment;
};

const InteractiveToolsContent = () => {
  const { currentPaths, onChange, entries, defaultPaths, state } =
    useInteractiveTools();
  const debugHandle = useDebugConsole();

  return (
    <>
      <DebugConsoleModal handle={debugHandle} />
      <div className="stash-interactive-tools">
        <InteractiveToolsControls debugHandle={debugHandle} />
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
    </>
  );
};
export const InteractiveToolsTab = (props: Props) => {
  console.log(`InteractiveToolsTab interactive=${props.scene.interactive}`);
  return (
    <InteractiveToolsProvider scene={props.scene}>
      <InteractiveToolsContent />
    </InteractiveToolsProvider>
  );
};
