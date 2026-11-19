import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Polygon, Polyline, Line, Text as SvgText } from 'react-native-svg';
import {
  buildScene,
  edges,
  inPoly,
  itemEdges,
  itemWorldBox,
  localDelta,
  project,
  setView,
  unitBox,
  unprojectGround,
  type Face,
} from '../geo';
import { TYPE } from '../data';
import { FURN } from '../furniture';
import type { Cam, Unit, ViewMode } from '../types';
import { c } from '../theme';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const SNAP = 0.05;

type Gesture = {
  kind: 'idle' | 'orbit' | 'pinch' | 'item' | 'unit';
  lx: number;
  ly: number;
  az0: number;
  el0: number;
  dist0: number;
  pinch0: number;
  moved: boolean;
  uid: string | null;
  iid: string | null;
  baseX: number;
  baseZ: number;
  gx0: number;
  gz0: number;
  floorY: number;
};

const GESTURE: Gesture = {
  kind: 'idle',
  lx: 0,
  ly: 0,
  az0: 0,
  el0: 0,
  dist0: 0,
  pinch0: 0,
  moved: false,
  uid: null,
  iid: null,
  baseX: 0,
  baseZ: 0,
  gx0: 0,
  gz0: 0,
  floorY: 0,
};

export function Viewport({
  units,
  selected,
  selectedItem,
  onSelect,
  onMoveItem,
  onMoveUnit,
  mode,
  cam,
  setCam,
  cut,
}: {
  units: Unit[];
  selected: string | null;
  selectedItem: string | null;
  onSelect: (unitId: string | null, itemId: string | null) => void;
  onMoveItem: (unitId: string, itemId: string, x: number, z: number) => void;
  onMoveUnit: (unitId: string, x: number, z: number) => void;
  mode: ViewMode;
  cam: Cam;
  setCam: (c: Cam) => void;
  cut: boolean;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const facesRef = useRef<Face[]>([]);
  const g = useRef<Gesture>({ ...GESTURE });
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const originRef = useRef({ x: 0, y: 0 });
  const boxRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const [preview, setPreview] = useState<{ pts: number[][]; faint: number[][] } | null>(null);

  const measured = () => {
    const b = boxRef.current as unknown as { measureInWindow?: (cb: (x: number, y: number) => void) => void };
    if (b && b.measureInWindow) b.measureInWindow((x, y) => (originRef.current = { x, y }));
  };

  const localOf = (pageX: number, pageY: number): [number, number] => [
    pageX - originRef.current.x,
    pageY - originRef.current.y,
  ];

  /** nearest face first, so a piece in front wins over the wall behind it */
  const hitAt = (x: number, y: number): Face | null => {
    const faces = facesRef.current;
    for (let i = faces.length - 1; i >= 0; i--) if (inPoly([x, y], faces[i].pts)) return faces[i];
    return null;
  };

  const scene = useMemo(() => {
    if (!size.w || !size.h) return { faces: [] as Face[], grid: [] as number[][][], shadows: [] as { pts: number[][]; a: number }[], ground: [] as number[][] };

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
    const fit = pw > 1 && ph > 1 ? Math.min((size.w * 0.82) / pw, (size.h * 0.8) / ph) : 1;
    setView(pivot, Math.max(0.15, Math.min(4, fit)));

    const built = buildScene(units, cam, size.w, size.h, { unit: selected, item: selectedItem }, cut);
    facesRef.current = built.faces.slice().sort((a, b) => b.depth - a.depth);

    const minX = bx0 - 3;
    const maxX = bx1 + 3;
    const minZ = bz0 - 3;
    const maxZ = bz1 + 3;

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

    const gr = [
      project([minX, 0, minZ], cam, size.w, size.h),
      project([maxX, 0, minZ], cam, size.w, size.h),
      project([maxX, 0, maxZ], cam, size.w, size.h),
      project([minX, 0, maxZ], cam, size.w, size.h),
    ];
    return {
      faces: facesRef.current,
      grid,
      shadows: built.shadows,
      ground: gr.map((p) => [p.x, p.y]) as number[][],
    };
  }, [units, cam, size, selected, selectedItem, cut]);

  const sel = useMemo(() => {
    if (!size.w || !selected) return [];
    if (selectedItem) return itemEdges(units, cam, size.w, size.h, selected, selectedItem);
    return edges(units, cam, size.w, size.h, selected);
  }, [selected, selectedItem, units, cam, size]);

  const labels = useMemo(() => {
    if (!size.w) return [] as { x: number; y: number; text: string; sel: boolean }[];
    return units.map((u) => {
      const box = unitBox(u);
      const p = project([box.x0 + box.L / 2, box.y0 + box.H + 0.05, box.z0 + box.W / 2], cam, size.w, size.h);
      return { x: p.x, y: p.y - 8, text: TYPE[u.type].short + (u.level ? ' · L' + (u.level + 1) : ''), sel: u.id === selected };
    });
  }, [units, cam, size, selected]);

  /** ghost of the piece under the finger, redrawn while it is being dragged */
  const buildPreview = (uid: string, iid: string, nx: number, nz: number) => {
    const u = unitsRef.current.find((v) => v.id === uid);
    const s = sizeRef.current;
    if (!u || !s.w) return setPreview(null);
    const it = u.items.find((v) => v.id === iid);
    const f = it && FURN[it.kind];
    if (!it || !f) return setPreview(null);
    const box = unitBox(u);
    const moved = { ...it, x: nx, z: nz };
    const b = itemWorldBox(u, box, moved, 0, 0, 0, 0, 0, 0);
    const x0 = b.wx - b.su / 2;
    const x1 = b.wx + b.su / 2;
    const z0 = b.wz - b.sd / 2;
    const z1 = b.wz + b.sd / 2;
    const yb = box.y0;
    const yt = box.y0 + f.h * 0.55;
    const at = (x: number, y: number, z: number) => {
      const p = project([x, y, z], camRef.current, s.w, s.h);
      return [p.x, p.y];
    };
    const floor = [at(x0, yb, z0), at(x1, yb, z0), at(x1, yb, z1), at(x0, yb, z1)];
    const top = [at(x0, yt, z0), at(x1, yt, z0), at(x1, yt, z1), at(x0, yt, z1)];
    setPreview({ pts: floor, faint: top });
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const t = e.nativeEvent.touches[0] || e.nativeEvent;
          const [lx, ly] = localOf(t.pageX, t.pageY);
          const d = g.current;
          d.kind = 'idle';
          d.lx = lx;
          d.ly = ly;
          d.az0 = camRef.current.az;
          d.el0 = camRef.current.el;
          d.dist0 = camRef.current.dist;
          d.pinch0 = 0;
          d.moved = false;
          d.uid = null;
          d.iid = null;

          const hit = hitAt(lx, ly);
          if (hit && hit.item) {
            const u = unitsRef.current.find((v) => v.id === hit.unit);
            const it = u?.items.find((v) => v.id === hit.item);
            if (u && it) {
              const box = unitBox(u);
              d.kind = 'item';
              d.uid = u.id;
              d.iid = it.id;
              d.baseX = it.x;
              d.baseZ = it.z;
              d.floorY = box.y0;
              const gp = unprojectGround(lx, ly, camRef.current, sizeRef.current.w, sizeRef.current.h, box.y0);
              d.gx0 = gp[0];
              d.gz0 = gp[1];
              onSelect(u.id, it.id);
              return;
            }
          }
          if (hit && mode === 'plan' && hit.unit === selected) {
            const u = unitsRef.current.find((v) => v.id === hit.unit);
            if (u) {
              const box = unitBox(u);
              d.kind = 'unit';
              d.uid = u.id;
              d.baseX = u.x;
              d.baseZ = u.z;
              d.floorY = box.y0;
              const gp = unprojectGround(lx, ly, camRef.current, sizeRef.current.w, sizeRef.current.h, box.y0);
              d.gx0 = gp[0];
              d.gz0 = gp[1];
            }
          }
        },
        onPanResponderMove: (e) => {
          const d = g.current;
          const touches = e.nativeEvent.touches;
          const camNow = camRef.current;

          if (touches.length >= 2) {
            if (d.kind !== 'pinch') {
              d.kind = 'pinch';
              d.pinch0 = 0;
              setPreview(null);
            }
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const dist = Math.max(1, Math.hypot(dx, dy));
            if (!d.pinch0) d.pinch0 = dist;
            const k = d.pinch0 / dist;
            setCam({ ...camNow, dist: clamp(d.dist0 * k, 8, 70) });
            d.moved = true;
            return;
          }

          const t = touches[0] || e.nativeEvent;
          const [lx, ly] = localOf(t.pageX, t.pageY);
          if (Math.abs(lx - d.lx) > 3 || Math.abs(ly - d.ly) > 3) d.moved = true;

          if (d.kind === 'item' && d.uid && d.iid) {
            const u = unitsRef.current.find((v) => v.id === d.uid);
            const it = u?.items.find((v) => v.id === d.iid);
            if (!u || !it) return;
            const box = unitBox(u);
            const s = sizeRef.current;
            const gp = unprojectGround(lx, ly, camNow, s.w, s.h, d.floorY);
            const [dx, dz] = localDelta(u, box, it, gp[0] - d.gx0, gp[1] - d.gz0);
            const nx = Math.round((d.baseX + dx) / SNAP) * SNAP;
            const nz = Math.round((d.baseZ + dz) / SNAP) * SNAP;
            buildPreview(u.id, it.id, nx, nz);
            (d as Gesture & { nx?: number; nz?: number }).nx = nx;
            (d as Gesture & { nx?: number; nz?: number }).nz = nz;
            return;
          }

          if (d.kind === 'unit' && d.uid) {
            const s = sizeRef.current;
            const gp = unprojectGround(lx, ly, camNow, s.w, s.h, d.floorY);
            const nx = Math.round((d.baseX + (gp[0] - d.gx0)) / SNAP) * SNAP;
            const nz = Math.round((d.baseZ + (gp[1] - d.gz0)) / SNAP) * SNAP;
            (d as Gesture & { nx?: number; nz?: number }).nx = nx;
            (d as Gesture & { nx?: number; nz?: number }).nz = nz;
            return;
          }

          if (d.kind === 'idle') d.kind = 'orbit';
          if (d.kind !== 'orbit') return;

          const dxs = lx - d.lx;
          const dys = ly - d.ly;
          if (mode === '3d') {
            setCam({
              az: d.az0 + dxs * 0.009,
              el: clamp(d.el0 - dys * 0.006, 0.06, 1.45),
              dist: camRef.current.dist,
            });
          } else {
            setCam({
              az: camNow.az + dxs * 0.0025,
              el: camNow.el,
              dist: clamp(camNow.dist - dys * 0.06, 8, 70),
            });
            d.lx = lx;
            d.ly = ly;
          }
        },
        onPanResponderRelease: (e) => {
          const d = g.current;
          const extra = d as Gesture & { nx?: number; nz?: number };
          if (d.kind === 'item' && d.uid && d.iid && d.moved && extra.nx !== undefined && extra.nz !== undefined) {
            onMoveItem(d.uid, d.iid, extra.nx, extra.nz);
          } else if (d.kind === 'unit' && d.uid && d.moved && extra.nx !== undefined && extra.nz !== undefined) {
            onMoveUnit(d.uid, extra.nx, extra.nz);
          } else if (d.kind === 'idle' && !d.moved) {
            const hit = hitAt(d.lx, d.ly);
            if (!hit) onSelect(null, null);
            else onSelect(hit.unit, hit.item ?? null);
          }
          extra.nx = undefined;
          extra.nz = undefined;
          d.kind = 'idle';
          setPreview(null);
        },
        onPanResponderTerminate: () => {
          const d = g.current;
          const extra = d as Gesture & { nx?: number; nz?: number };
          extra.nx = undefined;
          extra.nz = undefined;
          d.kind = 'idle';
          setPreview(null);
        },
      }),
    [mode, onSelect, onMoveItem, onMoveUnit, setCam]
  );

  return (
    <View
      ref={boxRef}
      style={styles.wrap}
      onLayout={(e) => {
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
        measured();
      }}
      {...responder.panHandlers}
    >
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <Polygon points={scene.ground.map((p) => p.join(',')).join(' ')} fill="#15171A" stroke={c.line} strokeWidth={1} />
          {scene.grid.map((l, i) => (
            <Line key={'g' + i} x1={l[0][0]} y1={l[0][1]} x2={l[1][0]} y2={l[1][1]} stroke="rgba(255,255,255,0.045)" strokeWidth={1} />
          ))}
          {scene.shadows.map((s, i) => (
            <Polygon key={'sh' + i} points={s.pts.map((p) => p.join(',')).join(' ')} fill={'rgba(0,0,0,' + s.a + ')'} stroke="none" />
          ))}
          {scene.faces.map((f) => (
            <Polygon
              key={f.key}
              points={f.pts.map((p) => p.join(',')).join(' ')}
              fill={f.fill}
              stroke={f.stroke}
              strokeWidth={f.kind === 'item' ? 0.5 : 0.7}
            />
          ))}
          {sel.map((e, i) => (
            <Polyline key={'e' + i} points={e.map((p) => p.join(',')).join(' ')} fill="none" stroke={c.lime} strokeWidth={1.4} opacity={0.9} />
          ))}
          {preview && (
            <>
              <Polygon points={preview.pts.map((p) => p.join(',')).join(' ')} fill="rgba(198,241,53,0.16)" stroke={c.lime} strokeWidth={1.2} />
              <Polyline points={preview.faint.map((p) => p.join(',')).join(' ')} fill="none" stroke={c.lime} strokeWidth={0.8} opacity={0.5} />
            </>
          )}
          {labels.map((l, i) => (
            <SvgText key={'l' + i} x={l.x} y={l.y} fill={l.sel ? c.lime : 'rgba(255,255,255,0.5)'} fontSize={11} textAnchor="middle">
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
