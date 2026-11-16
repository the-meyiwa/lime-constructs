import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const paths: Record<string, React.ReactNode> = {
  cube: <><Path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" /><Path d="M4 7.5 12 12l8-4.5M12 12v9" /></>,
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  rotate: <><Path d="M20 12a8 8 0 1 1-2.3-5.6" /><Path d="M20 4v5h-5" /></>,
  up: <Path d="M12 19V5M6 11l6-6 6 6" />,
  down: <Path d="M12 5v14M6 13l6 6 6-6" />,
  copy: <><Rect x="8" y="8" width="12" height="12" rx="2.5" /><Path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>,
  trash: <><Path d="M4 7h16" /><Path d="M9 7V4.5h6V7" /><Path d="M6.5 7 7.6 20h8.8L17.5 7" /></>,
  plan: <><Rect x="4" y="4" width="16" height="16" rx="2.5" /><Path d="M4 12h8V4M12 12v8" /></>,
  reset: <><Path d="M4 12a8 8 0 0 1 13.7-5.7" /><Path d="M20 4v5h-5" /><Circle cx="12" cy="12" r="1" /></>,
  quote: <><Path d="M6 3.5h9l4 4V20.5H6z" /><Path d="M14.5 3.5V8H19" /><Path d="M9 12h6M9 16h4" /></>,
  layers: <><Path d="M12 3 3 8l9 5 9-5z" /><Path d="m3 12 9 5 9-5" /><Path d="m3 16 9 5 9-5" /></>,
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  warn: <><Path d="M12 3.5 2.5 20h19z" /><Path d="M12 10v4.5M12 17.4v.1" /></>,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  chevron: <Path d="m9 6 6 6-6 6" />,
  dots: <><Circle cx="5" cy="12" r="1.4" /><Circle cx="12" cy="12" r="1.4" /><Circle cx="19" cy="12" r="1.4" /></>,
  fit: <><Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  ruler: <><Path d="M3 15 15 3l6 6L9 21z" /><Path d="m7 11 2 2M11 7l2 2M15 11l2 2" /></>,
};

export function Icon({ name, size = 18, color = '#F2F3F5', stroke = 1.7 }: { name: string; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </Svg>
  );
}
