import React from 'react';

export type HandyIconState = 'animated' | 'static' | 'disabled' | 'error';
type HandyIconProps = {
  animate?: boolean;
  color?: string;
  size?: number | string;
  className?: string;
  title?: string;
  state?: HandyIconState;
};

const animatedPath =
  'M12 5.5C12 3.567 10.433 2 8.5 2C6.567 2 5 3.567 5 5.5H12ZM5 18.5C5 20.433 6.567 22 8.5 22C10.433 22 12 20.433 12 18.5H5ZM20 13.5C20 11.567 18.433 10 16.5 10C14.567 10 13 11.567 13 13.5H20ZM13 18.5V22H20V18.5H13ZM5 5.5V18.5H12V5.5H5ZM13 13.5V18.5H20V13.5H13Z; M12 13.5C12 11.567 10.433 10 8.5 10C6.567 10 5 11.567 5 13.5H12ZM5 18.5C5 20.433 6.567 22 8.5 22C10.433 22 12 20.433 12 18.5H5ZM20 5.5C20 3.567 18.433 2 16.5 2C14.567 2 13 3.567 13 5.5H20ZM13 18.5V22H20V18.5H13ZM5 13.5V18.5H12V13.5H5ZM13 5.5V18.5H20V5.5H13Z; M12 5.5C12 3.567 10.433 2 8.5 2C6.567 2 5 3.567 5 5.5H12ZM5 18.5C5 20.433 6.567 22 8.5 22C10.433 22 12 20.433 12 18.5H5ZM20 13.5C20 11.567 18.433 10 16.5 10C14.567 10 13 11.567 13 13.5H20ZM13 18.5V22H20V18.5H13ZM5 5.5V18.5H12V5.5H5ZM13 13.5V18.5H20V13.5H13Z';

const staticPath =
  'M12 5.5C12 3.567 10.433 2 8.5 2C6.567 2 5 3.567 5 5.5H12ZM5 18.5C5 20.433 6.567 22 8.5 22C10.433 22 12 20.433 12 18.5H5ZM20 13.5C20 11.567 18.433 10 16.5 10C14.567 10 13 11.567 13 13.5H20ZM13 18.5V22H20V18.5H13ZM5 5.5V18.5H12V5.5H5ZM13 13.5V18.5H20V13.5H13Z';

export const TheHandyIcon = ({
  size = 24,
  className,
  title,
  state,
}: HandyIconProps) => {
  const disabled = state === 'disabled';
  const animate = state === 'animated';
  const error = state === 'error';
  const color = error
    ? 'var(--error)'
    : disabled
      ? 'var(--warning)'
      : 'currentColor';
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      style={{ color: disabled ? 'var(--warning)' : color }}
      fill="none"
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" style={!animate ? { display: 'none' } : {}}>
        <animate
          attributeName="d"
          dur="1s"
          values={animatedPath}
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.65 0.05 0.03 1;0.65 0.05 0.03 1"
        />
      </path>

      <path
        fill="currentColor"
        d={staticPath}
        style={animate ? { display: 'none' } : {}}
      />
    </svg>
  );
};
