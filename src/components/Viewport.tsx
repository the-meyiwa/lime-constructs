import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon, Polyline, Line, Text as SvgText, Circle, G } from 'react-native-svg';
import {
  buildScene,
  detailLines,
  dimensionOverlay,
  edges,
  inPoly,
  project,
  screenDeltaToWorldXZ,
  setView,
  unitBox,
  type DimensionLine,
  type Face,
  type GroundShadow,
} from '../geo';
import { FITOUT, TYPE } from '../data';
import type { Cam, Unit, ViewMode } from '../types';
import { c } from '../theme';

const BASE_CAM_3D: Cam = { az: 0.8, el: 0.58, dist: 21 };

export function Viewport({
  units,
  selected,
  warningUnitIds,
  onSelect,
  onDragStart,
  onMoveUnit,
  onDragEnd,
  moveMode,
  mode,
  cam,
  setCam,
  showDimensions,
  imperial,
  levelFilter,
}: {
  units: Unit[];
  selected: string | null;
  warningUnitIds?: string[];
  onSelect: (id: string | null) => void;
  onDragStart?: (id: string) => void;
  onMoveUnit?: (id: string, x: number, z: number) => void;
  onDragEnd?: (id: string) => void;
  moveMode?: boolean;
  mode: ViewMode;
  cam: Cam;
  setCam: (c: Cam) => void;
  showDimensions?: boolean;
  imperial?: boolean;
  levelFilter?: number | null;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draggingUnitId, setDraggingUnitId] = useState<string | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const camRef = useRef(cam);
  camRef.current = cam;
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const moveModeRef = useRef(Boolean(moveMode));
  moveModeRef.current = Boolean(moveMode);
  const callbacksRef = useRef({ onSelect, onDragStart, onMoveUnit, onDragEnd, setCam });
  callbacksRef.current = { onSelect, onDragStart, onMoveUnit, onDragEnd, setCam };

  const containerRef = useRef<any>(null);
  const viewOffsetRef = useRef({ x: 0, y: 0 });
  const facesRef = useRef<Face[]>([]);
  const lockedViewRef = useRef<{
    pivot: [number, number, number];
    fit: number;
    bounds: { bx0: number; bx1: number; bz0: number; bz1: number };
  } | null>(null);

  const measureContainer = () => {
    containerRef.current?.measureInWindow?.((x: number, y: number) => {
      if (typeof x === 'number' && typeof y === 'number') {
        viewOffsetRef.current = { x, y };
      }
    });
  };

  const start = useRef({
    az: 0,
    el: 0,
    dist: 0,
    x: 0,
    y: 0,
    pinch: 0,
    moved: false,
    hitUnitId: null as string | null,
    draggingId: null as string | null,
    unitStartX: 0,
    unitStartZ: 0,
    dragOffsetDx: 0,
    dragOffsetDy: 0,
  });
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => clearHoldTimer, []);

  const visibleUnits = useMemo(
    () => (levelFilter === null || levelFilter === undefined ? units : units.filter((u) => u.level === levelFilter)),
    [units, levelFilter]
  );

  const scene = useMemo(() => {
    if (!size.w || !size.h) {
      return {
        faces: [] as Face[],
        groundShadows: [] as GroundShadow[],
        grid: [] as number[][][],
        detail: [] as { pts: number[][]; stroke: string; strokeWidth?: number }[],
        ground: [] as number[][],
        dims: [] as DimensionLine[],
        compass: null as { cx: number; cy: number; nx: number; ny: number } | null,
        sel: [] as number[][][],
        warnEdges: [] as { id: string; lines: number[][][] }[],
        labels: [] as { x: number; y: number; text: string; sub: string; sel: boolean; warn: boolean; dragging: boolean }[],
      };
    }

    const boxes = (visibleUnits.length ? visibleUnits : units).map(unitBox);
    const rawBx0 = boxes.length ? Math.min(...boxes.map((b) => b.x0)) : 0;
    const rawBx1 = boxes.length ? Math.max(...boxes.map((b) => b.x0 + b.L)) : 6;
    const rawBz0 = boxes.length ? Math.min(...boxes.map((b) => b.z0)) : 0;
    const rawBz1 = boxes.length ? Math.max(...boxes.map((b) => b.z0 + b.W)) : 6;
    const by0 = boxes.length ? Math.min(...boxes.map((b) => b.y0)) : 0;
    const by1 = boxes.length ? Math.max(...boxes.map((b) => b.y0 + b.H)) : 3;

    let bx0 = rawBx0;
    let bx1 = rawBx1;
    let bz0 = rawBz0;
    let bz1 = rawBz1;

    if (draggingUnitId && lockedViewRef.current) {
      // Keep camera pivot and scale frozen while dragging a unit so the grid never shifts under the finger!
      setView(lockedViewRef.current.pivot, lockedViewRef.current.fit);
      bx0 = Math.min(rawBx0, lockedViewRef.current.bounds.bx0);
      bx1 = Math.max(rawBx1, lockedViewRef.current.bounds.bx1);
      bz0 = Math.min(rawBz0, lockedViewRef.current.bounds.bz0);
      bz1 = Math.max(rawBz1, lockedViewRef.current.bounds.bz1);
    } else {
      const pivot: [number, number, number] = [(bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2];
      setView(pivot, 1);
      const corners: [number, number, number][] = [];
      for (const x of [bx0, bx1]) for (const y of [by0, by1]) for (const z of [bz0, bz1]) corners.push([x, y, z]);
      const refCam: Cam = mode === 'plan' ? { az: 0, el: 1.52, dist: 27 } : BASE_CAM_3D;
      const projected = corners.map((p) => project(p, refCam, size.w, size.h));
      const pw = Math.max(...projected.map((p) => p.x)) - Math.min(...projected.map((p) => p.x));
      const ph = Math.max(...projected.map((p) => p.y)) - Math.min(...projected.map((p) => p.y));
      const rawFit = pw > 1 && ph > 1 ? Math.min((size.w * 0.72) / pw, (size.h * 0.72) / ph) : 1;
      const clampedFit = Math.max(0.15, Math.min(4, rawFit));
      setView(pivot, clampedFit);
      lockedViewRef.current = { pivot, fit: clampedFit, bounds: { bx0, bx1, bz0, bz1 } };
    }

    const { faces, groundShadows } = buildScene(visibleUnits, cam, size.w, size.h, selected);
    faces.sort((a, b) => b.depth - a.depth);
    facesRef.current = faces.filter((f) => !f.hidden);

    const minX = bx0 - 2.5;
    const maxX = bx1 + 2.5;
    const minZ = bz0 - 2.5;
    const maxZ = bz1 + 2.5;

    const grid: number[][][] = [];
    const step = 1.22; // Half ISO container width module (4 ft / 1.22 m)
    for (let x = Math.ceil(minX); x <= maxX; x += step) {
      const a = project([x, 0, minZ], cam, size.w, size.h);
      const b = project([x, 0, maxZ], cam, size.w, size.h);
      grid.push([
        [a.x, a.y],
        [b.x, b.y],
      ]);
    }
    for (let z = Math.ceil(minZ); z <= maxZ; z += step) {
      const a = project([minX, 0, z], cam, size.w, size.h);
      const b = project([maxX, 0, z], cam, size.w, size.h);
      grid.push([
        [a.x, a.y],
        [b.x, b.y],
      ]);
    }

    const g = [
      project([minX, 0, minZ], cam, size.w, size.h),
      project([maxX, 0, minZ], cam, size.w, size.h),
      project([maxX, 0, maxZ], cam, size.w, size.h),
      project([minX, 0, maxZ], cam, size.w, size.h),
    ];
    const detail = detailLines(visibleUnits, cam, size.w, size.h);
    const dims = showDimensions ? dimensionOverlay(visibleUnits, cam, size.w, size.h, selected, imperial) : [];

    const sel = selected ? edges(visibleUnits, cam, size.w, size.h, selected) : [];
    const warnEdges = (warningUnitIds || [])
      .filter((id) => id !== selected)
      .map((id) => ({ id, lines: edges(visibleUnits, cam, size.w, size.h, id) }));

    const labels = visibleUnits.map((u) => {
      const box = unitBox(u);
      const p = project([box.x0 + box.L / 2, box.y0 + box.H + 0.08, box.z0 + box.W / 2], cam, size.w, size.h);
      const t = TYPE[u.type] || TYPE['20ft'];
      const fit = FITOUT[u.fitout || 'raw'] || FITOUT.raw;
      const isDragging = u.id === draggingUnitId;
      const title =
        (u.label ? u.label + ' · ' : '') +
        t.short +
        ' L' +
        (u.level + 1) +
        (isDragging ? ` (${u.x.toFixed(2)}m, ${u.z.toFixed(2)}m)` : '');
      return {
        x: p.x,
        y: p.y - 8,
        text: title,
        sub: isDragging ? 'DRAGGING · RELEASE TO DROP' : fit.short + (u.openings.length ? ' · ' + u.openings.length + ' op' : ''),
        sel: u.id === selected,
        warn: Boolean(warningUnitIds?.includes(u.id)),
        dragging: isDragging,
      };
    });

    // Compass indicator at bottom-left
    const cx = 36;
    const cy = size.h - 38;
    const nx = cx - Math.sin(cam.az) * 14;
    const ny = cy - Math.cos(cam.az) * 14;

    return {
      faces,
      groundShadows,
      grid,
      detail,
      ground: g.map((p) => [p.x, p.y]) as number[][],
      dims,
      compass: { cx, cy, nx, ny },
      sel,
      warnEdges,
      labels,
    };
  }, [visibleUnits, units, cam, size, selected, warningUnitIds, mode, showDimensions, imperial, draggingUnitId]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          clearHoldTimer();
          measureContainer();
          const ne = e.nativeEvent;
          const lx =
            typeof ne.locationX === 'number' && (ne.locationX !== 0 || ne.locationY !== 0)
              ? ne.locationX
              : ne.pageX - viewOffsetRef.current.x;
          const ly =
            typeof ne.locationY === 'number' && (ne.locationX !== 0 || ne.locationY !== 0)
              ? ne.locationY
              : ne.pageY - viewOffsetRef.current.y;
          const frontToBack = [...facesRef.current].reverse();
          const hit = frontToBack.find((f) => inPoly([lx, ly], f.pts));
          const hitId = hit ? hit.unit : null;
          const hitUnit = hitId ? unitsRef.current.find((u) => u.id === hitId) : null;

          // Start dragging immediately if:
          // 1) Move mode is active and user touched any unit
          // 2) User is in Plan view and touched the currently selected unit
          const immediateDrag =
            Boolean(hitUnit) && (moveModeRef.current || (modeRef.current === 'plan' && hitId === selectedRef.current));

          start.current = {
            ...camRef.current,
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
            pinch: 0,
            moved: false,
            hitUnitId: hitId,
            draggingId: immediateDrag && hitUnit ? hitUnit.id : null,
            unitStartX: hitUnit ? hitUnit.x : 0,
            unitStartZ: hitUnit ? hitUnit.z : 0,
            dragOffsetDx: 0,
            dragOffsetDy: 0,
          };

          if (immediateDrag && hitUnit) {
            setDraggingUnitId(hitUnit.id);
            callbacksRef.current.onSelect(hitUnit.id);
            callbacksRef.current.onDragStart?.(hitUnit.id);
          } else if (hitUnit) {
            // Touch-and-hold (260ms) on ANY unit enters direct drag mode!
            holdTimerRef.current = setTimeout(() => {
              if (!start.current.moved && start.current.hitUnitId === hitUnit.id) {
                start.current.draggingId = hitUnit.id;
                start.current.unitStartX = hitUnit.x;
                start.current.unitStartZ = hitUnit.z;
                setDraggingUnitId(hitUnit.id);
                callbacksRef.current.onSelect(hitUnit.id);
                callbacksRef.current.onDragStart?.(hitUnit.id);
              }
            }, 260);
          }
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;
          if (touches && touches.length >= 2) {
            clearHoldTimer();
            start.current.moved = true;
            if (start.current.draggingId) {
              callbacksRef.current.onDragEnd?.(start.current.draggingId);
              start.current.draggingId = null;
              setDraggingUnitId(null);
            }
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const dist = Math.hypot(dx, dy);
            if (!start.current.pinch) start.current.pinch = dist;
            const k = start.current.pinch / Math.max(dist, 1);
            callbacksRef.current.setCam({
              ...camRef.current,
              dist: Math.max(7, Math.min(75, start.current.dist * k)),
            });
            return;
          }

          if (Math.abs(g.dx) > 7 || Math.abs(g.dy) > 7) {
            start.current.moved = true;
            clearHoldTimer();
          }

          // If dragging a unit, translate screen delta to world X/Z with magnetic edge alignment + 0.1m grid snap
          if (start.current.draggingId) {
            const dragId = start.current.draggingId;
            const sz = sizeRef.current;
            const [dX, dZ] = screenDeltaToWorldXZ(
              g.dx - start.current.dragOffsetDx,
              g.dy - start.current.dragOffsetDy,
              camRef.current,
              sz.w,
              sz.h
            );
            let nextX = Math.round((start.current.unitStartX + dX) * 10) / 10;
            let nextZ = Math.round((start.current.unitStartZ + dZ) * 10) / 10;

            // Magnetic edge snapping when within 0.22m of an adjacent unit on the same or lower level
            const draggedUnit = unitsRef.current.find((u) => u.id === dragId);
            if (draggedUnit) {
              const db = unitBox({ ...draggedUnit, x: nextX, z: nextZ });
              for (const other of unitsRef.current) {
                if (other.id === dragId) continue;
                const ob = unitBox(other);
                const snapXCandidates = [ob.x0, ob.x0 + ob.L, ob.x0 - db.L, ob.x0 + ob.L - db.L];
                for (const sx of snapXCandidates) {
                  if (Math.abs(nextX - sx) < 0.22) {
                    nextX = Number(sx.toFixed(2));
                    break;
                  }
                }
                const snapZCandidates = [ob.z0, ob.z0 + ob.W, ob.z0 - db.W, ob.z0 + ob.W - db.W];
                for (const szPos of snapZCandidates) {
                  if (Math.abs(nextZ - szPos) < 0.22) {
                    nextZ = Number(szPos.toFixed(2));
                    break;
                  }
                }
              }
            }

            callbacksRef.current.onMoveUnit?.(dragId, Number(nextX.toFixed(2)), Number(nextZ.toFixed(2)));
            return;
          }

          if (!start.current.moved) return;

          if (modeRef.current === '3d') {
            callbacksRef.current.setCam({
              az: start.current.az - g.dx * 0.009,
              el: Math.max(0.06, Math.min(1.48, start.current.el + g.dy * 0.006)),
              dist: camRef.current.dist,
            });
          } else {
            callbacksRef.current.setCam({
              az: start.current.az - g.dx * 0.005,
              el: camRef.current.el,
              dist: Math.max(7, Math.min(75, start.current.dist + g.dy * 0.08)),
            });
          }
        },
        onPanResponderRelease: () => {
          clearHoldTimer();
          if (start.current.draggingId) {
            const finishedId = start.current.draggingId;
            start.current.draggingId = null;
            setDraggingUnitId(null);
            callbacksRef.current.onDragEnd?.(finishedId);
            return;
          }
          if (!start.current.moved) {
            callbacksRef.current.onSelect(start.current.hitUnitId);
          }
        },
        onPanResponderTerminate: () => {
          clearHoldTimer();
          if (start.current.draggingId) {
            const finishedId = start.current.draggingId;
            start.current.draggingId = null;
            setDraggingUnitId(null);
            callbacksRef.current.onDragEnd?.(finishedId);
          }
        },
      }),
    []
  );

  const webWheelProps =
    Platform.OS === 'web'
      ? {
          onWheel: (e: any) => {
            const raw = e.deltaY || 0;
            if (!raw) return;
            // Invert previous sign so scroll directions feel natural on both trackpad and mouse wheel
            const delta = raw > 0 ? -2.2 : 2.2;
            setCam({
              ...camRef.current,
              dist: Math.max(7, Math.min(75, camRef.current.dist + delta)),
            });
          },
        }
      : {};

  return (
    <View
      ref={containerRef}
      style={styles.wrap}
      onLayout={(e) => {
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
        measureContainer();
      }}
      {...responder.panHandlers}
      {...(webWheelProps as any)}
    >
      {size.w > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={size.w} height={size.h}>
            <Polygon points={scene.ground.map((p) => p.join(',')).join(' ')} fill="#0B0C0E" stroke={c.line} strokeWidth={1} />
            {scene.grid.map((l, i) => (
              <Line key={'g' + i} x1={l[0][0]} y1={l[0][1]} x2={l[1][0]} y2={l[1][1]} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            ))}
            {scene.groundShadows.map((s) => (
              <Polygon
                key={s.key}
                points={s.pts.map((p) => p.join(',')).join(' ')}
                fill={s.fill}
                opacity={s.opacity ?? 1}
              />
            ))}
            {scene.faces.map((f) =>
              f.hidden ? null : (
                <Polygon
                  key={f.key}
                  points={f.pts.map((p) => p.join(',')).join(' ')}
                  fill={f.fill}
                  stroke={f.stroke}
                  strokeWidth={f.strokeWidth ?? 0.7}
                  opacity={f.opacity ?? 1}
                />
              )
            )}
            {scene.detail.map((l, i) => (
              <Line
                key={'d' + i}
                x1={l.pts[0][0]}
                y1={l.pts[0][1]}
                x2={l.pts[1][0]}
                y2={l.pts[1][1]}
                stroke={l.stroke}
                strokeWidth={l.strokeWidth ?? 1}
              />
            ))}
          {scene.warnEdges.map((w) =>
            w.lines.map((e, i) => (
              <Polyline
                key={'we' + w.id + i}
                points={e.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke="#E4A0A0"
                strokeWidth={1.3}
                strokeDasharray="4,3"
                opacity={0.85}
              />
            ))
          )}
          {scene.sel.map((e, i) => (
            <Polyline
              key={'e' + i}
              points={e.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={c.lime}
              strokeWidth={draggingUnitId ? 2.4 : 1.6}
              strokeDasharray={draggingUnitId ? '5,3' : undefined}
              opacity={0.98}
            />
          ))}
          {scene.dims.map((d, i) => (
            <G key={'dim' + i}>
              <Line
                x1={d.a[0]}
                y1={d.a[1]}
                x2={d.b[0]}
                y2={d.b[1]}
                stroke={d.accent ? c.lime : 'rgba(255,255,255,0.35)'}
                strokeWidth={1.1}
                strokeDasharray={d.accent ? undefined : '3,3'}
              />
              <Circle cx={d.a[0]} cy={d.a[1]} r={2.2} fill={d.accent ? c.lime : 'rgba(255,255,255,0.45)'} />
              <Circle cx={d.b[0]} cy={d.b[1]} r={2.2} fill={d.accent ? c.lime : 'rgba(255,255,255,0.45)'} />
              <SvgText
                x={d.x}
                y={d.y}
                fill={d.accent ? c.lime : 'rgba(255,255,255,0.75)'}
                fontSize={10.5}
                fontWeight="600"
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            </G>
          ))}
          {scene.labels.map((l, i) => (
            <G key={'l' + i}>
              <SvgText
                x={l.x}
                y={l.y}
                fill={l.dragging || l.sel ? c.lime : l.warn ? '#E4A0A0' : 'rgba(255,255,255,0.75)'}
                fontSize={l.dragging ? 12 : 11}
                fontWeight="700"
                textAnchor="middle"
              >
                {l.text}
              </SvgText>
              <SvgText
                x={l.x}
                y={l.y + 12}
                fill={l.dragging ? c.lime : l.sel ? 'rgba(201,242,77,0.75)' : 'rgba(255,255,255,0.38)'}
                fontSize={9.5}
                fontWeight={l.dragging ? '700' : '400'}
                textAnchor="middle"
              >
                {l.sub}
              </SvgText>
            </G>
          ))}
          {scene.compass ? (
            <G>
              <Circle cx={scene.compass.cx} cy={scene.compass.cy} r={17} fill="rgba(10,11,13,0.75)" stroke={c.line} strokeWidth={1} />
              <Line
                x1={scene.compass.cx}
                y1={scene.compass.cy}
                x2={scene.compass.nx}
                y2={scene.compass.ny}
                stroke={c.lime}
                strokeWidth={1.8}
              />
              <SvgText x={scene.compass.nx} y={scene.compass.ny - 3} fill={c.lime} fontSize={8.5} fontWeight="700" textAnchor="middle">
                N
              </SvgText>
            </G>
          ) : null}
          </Svg>
        </View>
      )}
      {draggingUnitId && (
        <View style={styles.dragHud} pointerEvents="none">
          <View style={styles.dragDot} />
          <Text style={styles.dragHudText}>
            Dragging unit · slide finger to reposition (magnetic snap active)
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: c.bg },
  dragHud: {
    position: 'absolute',
    bottom: 34,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10,11,13,0.92)',
    borderWidth: 1,
    borderColor: c.lime,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dragDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.lime,
  },
  dragHudText: {
    color: c.lime,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
