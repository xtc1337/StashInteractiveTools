import React, {
  ChangeEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { SlideInfo } from 'thehandy/src/types';
import { useStashToolsConfig } from '../hooks';
import { useDebouncedCallback } from 'use-debounce';
import { Form } from 'react-bootstrap';

import { hooks } from '../api';

const StrokeSlider = () => {
  const { interactive, initialised } = hooks.useInteractive();
  const [{ data: config, loading: isConfigLoaded }, setConfig] =
    useStashToolsConfig();
  const [completed, setCompleted] = useState(false);

  const [slideInfo, setSlideInfo] = useState<SlideInfo>({ min: 0, max: 100 });

  const onCommitSliderChanges = useDebouncedCallback(async () => {
    setConfig((v) => ({
      ...v,
      slideInfo,
    }));

    await interactive._handy.setSlideSettings(slideInfo.min, slideInfo.max);
  }, 500);
  const onSliderChanged: ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      const name = e.target.name as 'min' | 'max';
      const updatedValue = parseInt(e.target.value, 10);

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
      setSlideInfo(config.slideInfo);
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
          {slideInfo.min}-{slideInfo.max}
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
              max={100}
              onChange={onSliderChanged}
            />
            <Form.Control
              as="input"
              type="range"
              min={0}
              max={100}
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
