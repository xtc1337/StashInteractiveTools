import React, { useCallback } from 'react';
import { SceneDataFragment } from '../generated-graphql';
import {
  InteractiveBackendOperation,
  InteractiveToolsProvider,
  useInteractiveTools,
} from '../hooks';
import StrokeSlider from './StrokeSlider';
import SyncSlider from './SyncSlider';
import ScriptChooser from './ScriptChooser';
import { ModifyScript } from './ModifyScript';
import { ConnectionState } from '../utils';
import { DebugConsoleModal, useDebugConsole } from './DebugConsoleModal';
import { InteractiveToolsControls } from './InteractiveToolsControls';
import { useInteractiveBackend } from '../hooks/useInteractiveBackend';
import { Button } from 'react-bootstrap';

type Props = {
  scene: SceneDataFragment;
};

const DEFAULT_ERROR_MESSAGE = 'Setup failed. Please check your configuration.';
const InteractiveToolsContent = () => {
  const {
    currentPaths,
    onChange,
    entries,
    defaultPaths,
    state,
    hasSetupError,
  } = useInteractiveTools();
  const debugHandle = useDebugConsole();
  const [verifyingInstall, setVerifyingInstall] = React.useState(false);
  const [runInstallBackendTask, installBackendTaskResults] =
    useInteractiveBackend<{ installed?: boolean; error?: string }>(
      InteractiveBackendOperation.INSTALL,
    );
  const [errorMessage] = React.useState<string>(DEFAULT_ERROR_MESSAGE);
  const onVerifyInstall = useCallback(async () => {
    setVerifyingInstall(true);
    runInstallBackendTask()
      .then(() => {
        setVerifyingInstall(false);
      })
      .catch(() => {
        setVerifyingInstall(false);
      });
  }, [setVerifyingInstall, runInstallBackendTask]);

  return (
    <>
      <DebugConsoleModal handle={debugHandle} />
      {hasSetupError ? (
        <div className="setup-error">
          {errorMessage}
          <br />
          <Button onClick={onVerifyInstall} disabled={verifyingInstall}>
            Verify Install
          </Button>
          {installBackendTaskResults?.data?.error && (
            <div className="error-message">
              {installBackendTaskResults.data?.error}
            </div>
          )}
        </div>
      ) : (
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
      )}
    </>
  );
};
export const InteractiveToolsTab = (props: Props) => {
  return (
    <InteractiveToolsProvider scene={props.scene}>
      <InteractiveToolsContent />
    </InteractiveToolsProvider>
  );
};
