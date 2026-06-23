import React from 'react';

/**
 * A macOS-style arrow cursor. Pure SVG so it stays crisp at any scale and
 * matches a real screen capture. Position/opacity are driven by the parent
 * scene via interpolate — this component is intentionally dumb.
 */
export const Cursor: React.FC<{
  x: number;
  y: number;
  opacity?: number;
  pressed?: boolean;
}> = ({ x, y, opacity = 1, pressed = false }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: `scale(${pressed ? 0.86 : 1})`,
        transformOrigin: 'top left',
        zIndex: 50,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 3l14 7.5-6.2 1.4L9.5 19 5 3z"
          fill="#fff"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
