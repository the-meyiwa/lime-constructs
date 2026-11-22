import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

const paths: Record<string, React.ReactNode> = {
  cube: (
    <G>
      <Path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" />
      <Path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </G>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  rotate: (
    <G>
      <Path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <Path d="M20 4v5h-5" />
    </G>
  ),
  undo: (
    <G>
      <Path d="M4 9h10a5 5 0 0 1 0 10H9" />
      <Path d="M8 5 4 9l4 4" />
    </G>
  ),
  redo: (
    <G>
      <Path d="M20 9H10a5 5 0 0 0 0 10h5" />
      <Path d="m16 5 4 4-4 4" />
    </G>
  ),
  up: <Path d="M12 19V5M6 11l6-6 6 6" />,
  down: <Path d="M12 5v14M6 13l6 6 6-6" />,
  left: <Path d="M19 12H5M11 6l-6 6 6 6" />,
  right: <Path d="M5 12h14M13 6l6 6-6 6" />,
  copy: (
    <G>
      <Rect x="8" y="8" width="12" height="12" rx="2.5" />
      <Path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </G>
  ),
  trash: (
    <G>
      <Path d="M4 7h16" />
      <Path d="M9 7V4.5h6V7" />
      <Path d="M6.5 7 7.6 20h8.8L17.5 7" />
    </G>
  ),
  plan: (
    <G>
      <Rect x="4" y="4" width="16" height="16" rx="2.5" />
      <Path d="M4 12h8V4M12 12v8" />
    </G>
  ),
  reset: (
    <G>
      <Path d="M4 12a8 8 0 0 1 13.7-5.7" />
      <Path d="M20 4v5h-5" />
      <Circle cx="12" cy="12" r="1" />
    </G>
  ),
  quote: (
    <G>
      <Path d="M6 3.5h9l4 4V20.5H6z" />
      <Path d="M14.5 3.5V8H19" />
      <Path d="M9 12h6M9 16h4" />
    </G>
  ),
  layers: (
    <G>
      <Path d="M12 3 3 8l9 5 9-5z" />
      <Path d="m3 12 9 5 9-5" />
      <Path d="m3 16 9 5 9-5" />
    </G>
  ),
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  warn: (
    <G>
      <Path d="M12 3.5 2.5 20h19z" />
      <Path d="M12 10v4.5M12 17.4v.1" />
    </G>
  ),
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  chevron: <Path d="m9 6 6 6-6 6" />,
  dots: (
    <G>
      <Circle cx="5" cy="12" r="1.4" />
      <Circle cx="12" cy="12" r="1.4" />
      <Circle cx="19" cy="12" r="1.4" />
    </G>
  ),
  fit: <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  ruler: (
    <G>
      <Path d="M3 15 15 3l6 6L9 21z" />
      <Path d="m7 11 2 2M11 7l2 2M15 11l2 2" />
    </G>
  ),
  magnet: (
    <G>
      <Path d="M6 4v7a6 6 0 0 0 12 0V4" />
      <Path d="M4 4h4M16 4h4M6 8h2M16 8h2" />
    </G>
  ),
  sun: (
    <G>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </G>
  ),
  save: (
    <G>
      <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <Path d="M17 21v-8H7v8M7 3v5h8" />
    </G>
  ),
  share: (
    <G>
      <Path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <Path d="M16 6l-4-4-4 4M12 2v13" />
    </G>
  ),
  move: (
    <G>
      <Path d="M12 2v20M2 12h20" />
      <Path d="m9 5 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />
    </G>
  ),
};

export function Icon({ name, size = 18, color = '#F2F3F5', stroke = 1.7 }: { name: string; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </Svg>
  );
}
