import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Polygon, Polyline, Line, Text as SvgText } from 'react-native-svg';
import { buildScene, detailLines, edges, inPoly, project, setView, unitBox, type Face } from '../geo';
import { TYPE } from '../data';
import type { Cam, Unit, ViewMode } from '../types';
import { c } from '../theme';

export function Viewport({
  units,
  selected,
  onSelect,
  mode,
  cam,
  setCam,
}: {
  units: Unit[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  mode: ViewMode;
  cam: Cam;
  setCam: (c: Cam) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const facesRef = useRef<Face[]>([]);
  const start = useRef({ az: 0, el: 0, dist: 0, x: 0, y: 0, pinch: 0, moved: false });

  const scene = useMemo(() => {
    if (!size.w || !size.h) return { faces: [] as Face[], grid: [] as number[][][], detail: [] as { pts: number[][]; stroke: string }[], ground: [] as number[][] };

    const boxes = units.map(unitBox);
    const bx0 = boxes.length ? Math.min(...boxes.map((b) => b.x0)) : 0;
    const bx1 = boxes.length ? Math.max(...boxes.map((b) => b.x0 + b.L)) : 6;
    const bz0 = boxes.length ? Math.min(...boxes.map((b) => b.z0)) : 0;
    const bz1 = boxes.length ? Math.max(...boxes.map((b) => b.z0 + b.W)) : 6;
    const by0 = boxes.length ? Math.min(...boxes.map((b) => b.y0)) : 0;
    const by1 = boxes.length ? Math.max(...boxes.map((b) => b.y0 + b.H)) : 3;

    const pivot: [number, number, number] = [(bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2];
    setView(pivot, 1);
    const corners: [number, number, number][] = [];
    for (const x of [bx0, bx1]) for (const y of [by0, by1]) for (const z of [bz0, bz1]) corners.push([x, y, z]);
    const projected = corners.map((p) => project(p, cam, size.w, size.h));
    const pw = Math.max(...projected.map((p) => p.x)) - Math.min(...projected.map((p) => p.x));
    const ph = Math.max(...projected.map((p) => p.y)) - Math.min(...projected.map((p) => p.y));
    const fit = pw > 1 && ph > 1 ? Math.min((size.w * 0.8) / pw, (size.h * 0.78) / ph) : 1;
    setView(pivot, Math.max(0.15, Math.min(4, fit)));

    const faces = buildScene(units, cam, size.w, size.h, selected).sort((a, b) => b.depth - a.depth);
    facesRef.current = faces.filter((f) => !f.hidden);

    const minX = bx0 - 2.5;
    const maxX = bx1 + 2.5;
    const minZ = bz0 - 2.5;
    const maxZ = bz1 + 2.5;

    const grid: number[][][] = [];
    const step = 1.2;
    for (let x = Math.ceil(minX); x <= maxX; x += step) {
      const a = project([x, 0, minZ], cam, size.w, size.h);
      const b = project([x, 0, maxZ], cam, size.w, size.h);
      grid.push([[a.x, a.y], [b.x, b.y]]);
    }
    for (let z = Math.ceil(minZ); z <= maxZ; z += step) {
      const a = project([minX, 0, z], cam, size.w, size.h);
      const b = project([maxX, 0, z], cam, size.w, size.h);
      grid.push([[a.x, a.y], [b.x, b.y]]);
    }

    const g = [
      project([minX, 0, minZ], cam, size.w, size.h),
      project([maxX, 0, minZ], cam, size.w, size.h),
      project([maxX, 0, maxZ], cam, size.w, size.h),
      project([minX, 0, maxZ], cam, size.w, size.h),
    ];
    const detail = detailLines(units, cam, size.w, size.h);
    return { faces, grid, detail, ground: g.map((p) => [p.x, p.y]) as number[][] }; 
  }, [units, cam, size, selected]);

  const sel = useMemo(
    () => (selected && size.w ? edges(units, cam, size.w, size.h, selected) : []),
    [selected, units, cam, size]
  );

  const labels = useMemo(() => {
    if (!size.w) return [] as { x: number; y: number; text: string; sel: boolean }[];
    return units.map((u) => {
      const box = unitBox(u);
      const p = project([box.x0 + box.L / 2, box.y0 + box.H + 0.05, box.z0 + box.W / 2], cam, size.w, size.h);
      return { x: p.x, y: p.y - 8, text: TYPE[u.type].short + (u.level ? ' · L' + (u.level + 1) : ''), sel: u.id === selected };
    });
  }, [units, cam, size, selected]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          start.current = { ...camRef.current, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, pinch: 0, moved: false };
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;
          if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) start.current.moved = true;
          if (touches.length >= 2) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const dist = Math.hypot(dx, dy);
            if (!start.current.pinch) start.current.pinch = dist;
            const k = start.current.pinch / Math.max(dist, 1);
            setCam({ ...camRef.current, dist: Math.max(8, Math.min(70, start.current.dist * k)) });
          } else if (mode === '3d') {
            setCam({
              az: start.current.az + g.dx * 0.009,
              el: Math.max(0.06, Math.min(1.45, start.current.el - g.dy * 0.006)),
              dist: camRef.current.dist,
            });
          } else {
            setCam({
              az: camRef.current.az + g.dx * 0.001,
              el: camRef.current.el,
              dist: Math.max(8, Math.min(70, camRef.current.dist - g.dy * 0.06)),
            });
          }
        },
        onPanResponderRelease: (e) => {
          if (start.current.moved) return;
          const x = e.nativeEvent.locationX;
          const y = e.nativeEvent.locationY;
          const hit = facesRef.current.find((f) => inPoly([x, y], f.pts));
          onSelect(hit ? hit.unit : null);
        },
      }),
    [mode, onSelect, setCam]
  );

  return (
    <View style={styles.wrap} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...responder.panHandlers}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <Polygon points={scene.ground.map((p) => p.join(',')).join(' ')} fill="#0B0C0E" stroke={c.line} strokeWidth={1} />
          {scene.grid.map((l, i) => (
            <Line key={'g' + i} x1={l[0][0]} y1={l[0][1]} x2={l[1][0]} y2={l[1][1]} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          ))}
          {scene.faces.map((f) =>
            f.hidden ? null : (
              <Polygon
                key={f.key}
                points={f.pts.map((p) => p.join(',')).join(' ')}
                fill={f.fill}
                stroke={f.stroke}
                strokeWidth={0.7}
              />
            )
          )}
          {scene.detail.map((l, i) => (
            <Line key={'d' + i} x1={l.pts[0][0]} y1={l.pts[0][1]} x2={l.pts[1][0]} y2={l.pts[1][1]} stroke={l.stroke} strokeWidth={1} />
          ))}
          {sel.map((e, i) => (
            <Polyline key={'e' + i} points={e.map((p) => p.join(',')).join(' ')} fill="none" stroke={c.lime} strokeWidth={1.4} opacity={0.9} />
          ))}
          {labels.map((l, i) => (
            <SvgText
              key={'l' + i}
              x={l.x}
              y={l.y}
              fill={l.sel ? c.lime : 'rgba(255,255,255,0.55)'}
              fontSize={11}
              textAnchor="middle"
            >
              {l.text}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: c.bg },
});
