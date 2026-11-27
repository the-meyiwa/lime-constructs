import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

const paths: Record<string, React.ReactNode> = {
  side: (
    <G>
      <Rect x="3" y="4" width="18" height="16" rx="2" />
      <Path d="M9 4v16" />
    </G>
  ),
  insp: (
    <G>
      <Rect x="3" y="4" width="18" height="16" rx="2" />
      <Path d="M15 4v16" />
    </G>
  ),
  undo: (
    <G>
      <Path d="M9 14 4 9l5-5" />
      <Path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </G>
  ),
  redo: (
    <G>
      <Path d="m15 14 5-5-5-5" />
      <Path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </G>
  ),
  more: (
    <G>
      <Circle cx="5" cy="12" r="1.2" />
      <Circle cx="12" cy="12" r="1.2" />
      <Circle cx="19" cy="12" r="1.2" />
    </G>
  ),
  search: (
    <G>
      <Circle cx="11" cy="11" r="7" />
      <Path d="m20 20-3.5-3.5" />
    </G>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  box: (
    <G>
      <Path d="M3 8 12 3l9 5v8l-9 5-9-5z" />
      <Path d="M3 8l9 5 9-5M12 13v8" />
    </G>
  ),
  cube: (
    <G>
      <Path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" />
      <Path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </G>
  ),
  cube3: (
    <G>
      <Path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" />
      <Path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </G>
  ),
  trash: (
    <G>
      <Path d="M4 7h16" />
      <Path d="M9 7V4h6v3" />
      <Path d="M6 7l1 13h10l1-13" />
    </G>
  ),
  copy: (
    <G>
      <Rect x="8" y="8" width="12" height="12" rx="2" />
      <Path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </G>
  ),
  rotate: (
    <G>
      <Path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <Path d="M20 4v5h-5" />
    </G>
  ),
  stack: <Path d="M4 15h16v5H4zM4 8h16v5H4z" />,
  roof: (
    <G>
      <Path d="M3 11 12 4l9 7" />
      <Path d="M6 10v9h12v-9" />
    </G>
  ),
  fit: <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  plan: (
    <G>
      <Rect x="4" y="4" width="16" height="16" rx="1" />
      <Path d="M4 12h8V4M12 12v8" />
    </G>
  ),
  grid: (
    <G>
      <Rect x="4" y="4" width="7" height="7" rx="1" />
      <Rect x="13" y="4" width="7" height="7" rx="1" />
      <Rect x="4" y="13" width="7" height="7" rx="1" />
      <Rect x="13" y="13" width="7" height="7" rx="1" />
    </G>
  ),
  info: (
    <G>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 11v5M12 8h.01" />
    </G>
  ),
  warn: (
    <G>
      <Path d="M12 3 2.5 20h19z" />
      <Path d="M12 10v4.5M12 17.5v.01" />
    </G>
  ),
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  download: (
    <G>
      <Path d="M12 4v11" />
      <Path d="m7 10 5 5 5-5" />
      <Path d="M5 20h14" />
    </G>
  ),
  place: (
    <G>
      <Path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" />
      <Circle cx="12" cy="10" r="2" />
    </G>
  ),
  wall: (
    <G>
      <Path d="M4 20V6l8-3 8 3v14" />
      <Path d="M4 12h16" />
    </G>
  ),
  chevron: <Path d="m9 6 6 6-6 6" />,
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  up: <Path d="M12 19V5M6 11l6-6 6 6" />,
  down: <Path d="M12 5v14M6 13l6 6 6-6" />,
  left: <Path d="M19 12H5M11 6l-6 6 6 6" />,
  right: <Path d="M5 12h14M13 6l6 6-6 6" />,
};

export function Icon({ name, size = 16, color = '#F2F3F5', stroke = 1.8 }: { name: string; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </Svg>
  );
}
