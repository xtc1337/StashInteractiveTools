import React, { ChangeEvent } from 'react';
import { libraries } from '../api';
import Slider, { SliderContext, SliderOnSetup } from './Slider';

const { Form } = libraries.Bootstrap;

const onCommit = async (ctx: SliderContext<number>, nextValue?: number) => {
  let finalOffset = nextValue ?? -1;
  const hstpOffset = await ctx.interactive._handy.getHstpOffset();

  if (finalOffset == -1) {
    // reloaded first time ran
    finalOffset = hstpOffset;
  }

  const h = ctx.interactive._handy as {
    setHstpOffset: (v: number) => Promise<unknown>;
  };
  await h.setHstpOffset(finalOffset);
  return [finalOffset, !ctx.config.alwaysDefaultToStashSyncOffset] as [
    number,
    boolean,
  ];
};
const onAfterCommit = (ctx: SliderContext<number>) => {
  return ctx.withPlayer(async () => {
    if (ctx.interactive._playing) {
      await ctx.interactiveSync();
    }
  });
};
const onChange = (event: ChangeEvent<HTMLInputElement>) =>
  parseInt(event.target.value, 10);
const onSetup: SliderOnSetup<number> = async (ctx, setValue) => {
  const hstpOffset = ctx.config.alwaysDefaultToStashSyncOffset
    ? ctx.config.stashSyncOffset
    : await ctx.interactive._handy.getHstpOffset();

  setValue(hstpOffset);
  const syncInterval = setInterval(async () => {
    ctx.interactive.setServerTimeOffset(
      await ctx.interactive._handy.getServerTimeOffset(10),
    );
  }, 60 * 1000);
  return () => {
    clearInterval(syncInterval);
  };
};
const SyncSlider = () => {
  return (
    <Slider<number>
      defaultValue={-1}
      configName={'syncOffset'}
      onCommit={onCommit}
      onChange={onChange}
      onSetup={onSetup}
      onAfterCommit={onAfterCommit}
    >
      {(currentValue, onSliderChanged, initialised) => (
        <>
          <dt>
            Sync: <span className="stroke-range">{currentValue}ms</span>
          </dt>
          <dd className="form-container row">
            <div className="range-slider col-xl-11 col-lg-11">
              <div className="range-slider-wrapper">
                <div className="range-slider-marker" style={{ left: 0 }}>
                  -250
                </div>
                <div className="range-slider-marker" style={{ left: '25%' }}>
                  -125
                </div>
                <div className="range-slider-marker" style={{ left: '50%' }}>
                  0
                </div>
                <div className="range-slider-marker" style={{ left: '75%' }}>
                  125
                </div>
                <div className="range-slider-marker" style={{ left: '94%' }}>
                  250
                </div>
                <Form.Control
                  as="input"
                  type="range"
                  name="min"
                  bsPrefix="form-range"
                  className="input-control"
                  value={currentValue}
                  min={-250}
                  max={250}
                  disabled={!initialised}
                  onChange={onSliderChanged}
                />
              </div>
            </div>
          </dd>
        </>
      )}
    </Slider>
  );
};
export default SyncSlider;
