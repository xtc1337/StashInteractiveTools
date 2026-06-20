import React, {
  ChangeEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { SlideInfo } from 'thehandy/src/types';
import { useInteractiveTools, useStashToolsConfig } from '../hooks';
import { useDebouncedCallback } from 'use-debounce';
import { Form } from 'react-bootstrap';

import { hooks } from '../api';
import { toDeviceConfig } from '../utils/interactive/client';

const StrokeSlider = () => {
  const { initialised } = hooks.useInteractive();
  const { device } = useInteractiveTools();
  const [{ data: config, loading: isConfigLoaded }, setConfig] =
    useStashToolsConfig();

  const [completed, setCompleted] = useState(false);

  const [slideInfo, setSlideInfo] = useState<SlideInfo>({ min: 0, max: 1 });

  const onCommitSliderChanges = useDebouncedCallback(
    async () => {
      setConfig((v) => ({
        ...v,
        slideInfo,
      }));

      if (device.current) {
        await toDeviceConfig(device.current, {
          stroke: slideInfo,
        });
      }
    },
    500,
    { leading: true },
  );
  const onSliderChanged: ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      const name = e.target.name as 'min' | 'max';
      const updatedValue = parseFloat(e.target.value);

      setSlideInfo((v) => ({
        ...v,
        [name]: updatedValue,
      }));
      onCommitSliderChanges()?.catch(console.error);
    },
    [setSlideInfo, onCommitSliderChanges],
  );

  useEffect(() => {
    if (initialised && isConfigLoaded && !completed) {
      if (config.slideInfo.min > 1 || config.slideInfo.max > 1) {
        // fix converting
        setSlideInfo({ min: 0, max: 1 });
      } else {
        setSlideInfo(config.slideInfo);
      }
      onCommitSliderChanges()?.catch(console.error);
      setCompleted(true);
    }
  }, [
    config,
    setSlideInfo,
    initialised,
    completed,
    isConfigLoaded,
    onCommitSliderChanges,
  ]);

  return (
    <>
      <dt>
        Stroke:{' '}
        <span className="stroke-range">
          {slideInfo.min * 100}-{slideInfo.max * 100}
        </span>
      </dt>
      <dd className="form-container row">
        <div className="range-slider col-xl-11 col-lg-11">
          <div className="range-slider-wrapper">
            <div className="range-slider-marker" style={{ left: 0 }}>
              0
            </div>
            <div className="range-slider-marker" style={{ left: '25%' }}>
              25
            </div>
            <div className="range-slider-marker" style={{ left: '50%' }}>
              50
            </div>
            <div className="range-slider-marker" style={{ left: '75%' }}>
              75
            </div>
            <div className="range-slider-marker" style={{ left: '94%' }}>
              100
            </div>
            <Form.Control
              as="input"
              type="range"
              name="min"
              bsPrefix="form-range"
              className="input-control"
              value={slideInfo.min}
              disabled={!initialised}
              min={0}
              step="0.01"
              max={1}
              onChange={onSliderChanged}
            />
            <Form.Control
              as="input"
              type="range"
              min={0}
              max={1}
              step="0.01"
              name="max"
              disabled={!initialised}
              onChange={onSliderChanged}
              value={slideInfo.max}
              bsPrefix="form-range"
              className="input-control"
            />
          </div>
        </div>
      </dd>
    </>
  );
};
export default StrokeSlider;
