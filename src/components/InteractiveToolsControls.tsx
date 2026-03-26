import { Button, Col, Row } from 'react-bootstrap';
import { faClipboardCheck } from '@fortawesome/free-solid-svg-icons';
import React, { useCallback } from 'react';
import { DebugConsoleHandle } from './DebugConsoleModal';
import { components } from '../api';

const { Icon } = components;
interface InteractiveTogglesProps {
  debugHandle: DebugConsoleHandle;
}
export const InteractiveToolsControls = ({
  debugHandle,
}: InteractiveTogglesProps) => {
  const onToggleDebugConsole = useCallback(() => {
    debugHandle.toggle();
  }, [debugHandle]);
  return (
    <Row className="d-flex justify-content-end align-items-center">
      <Col xs="auto">
        <Button
          onClick={onToggleDebugConsole}
          className="minimal d-flex align-items-center h-100"
          title="Open SIT Debug console"
        >
          <Icon icon={faClipboardCheck} />
        </Button>
      </Col>
    </Row>
  );
};
