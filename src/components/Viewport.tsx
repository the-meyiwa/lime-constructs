import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Polygon, Polyline, Line } from 'react-native-svg';
import {
  buildScene,
  inPoly,
  project,
  sceneBounds,
  screenDeltaToWorldXZ,
  screenToWorldXZ,
  selectionEdges,
  setView,
  worldToUnitLocal,
  type Cam,
  type Face,
  type GroundShadow,
  type P3,
  type SelRef,
} from '../geo';
import { PART, extOf, layoutUnits, planSize, unitRect, type PlacedItem, type UnitModel, type WallId } from '../container-library';
import { c } from '../theme';

const BASE_CAM_ISO: Cam = { az: 0.78, el: 0.52, dist: 21 };

export type HitResult = {
  ref: SelRef;
  point: P3;
  wall?: WallId;
};

const sameRef = (a: SelRef, b: SelRef) => {
  if (!a || !b) return a === b;
  if (a.t !== b.t) return false;
  if (a.t === 'unit' && b.t === 'unit') return a.id === b.id;
  if (a.t === 'site' && b.t === 'site') return a.key === b.key;
  if (a.t === 'item' && b.t === 'item') return a.id === b.id && a.key === b.key;
  return false;
};

function computeCameraView(units: UnitModel[], site: PlacedItem[], w: number, h: number): { pivot: P3; fit: number } {
  const b = sceneBounds(units, site);
  const pivot: P3 = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
  if (!w || !h) return { pivot, fit: 1 };
  setView(pivot, 1);
  const corners: P3[] = [];
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) corners.push([x, y, z]);
  const projected = corners.map((p) => project(p, BASE_CAM_ISO, w, h));
  const pw = Math.max(...projected.map((p) => p.x)) - Math.min(...projected.map((p) => p.x));
  const ph = Math.max(...projected.map((p) => p.y)) - Math.min(...projected.map((p) => p.y));
  const rawFit = pw > 1 && ph > 1 ? Math.min((w * 0.72) / pw, (h * 0.72) / ph) : 1;
  const clampedFit = Math.max(0.18, Math.min(3.6, rawFit));
  return { pivot, fit: clampedFit };
}

export function Viewport({
  units,
  site,
  showRoof,
  level,
  spec,
  sel,
  cam,
  setCam,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onContextMenu,
  onDropPart,
}: {
  units: UnitModel[];
  site: PlacedItem[];
  showRoof: boolean;
  level: 'all' | number;
  spec: Record<string, string>;
  sel: SelRef;
  cam: Cam;
  setCam: React.Dispatch<React.SetStateAction<Cam>>;
  fitTick?: number;
  onSelect: (ref: SelRef) => void;
  onDragStart?: () => void;
  onDragMove?: (ref: SelRef, updater: (u: UnitModel[], s: PlacedItem[]) => { units: UnitModel[]; site: PlacedItem[]; status?: string }) => void;
  onDragEnd?: (moved: boolean) => void;
  onContextMenu?: (screenX: number, screenY: number, hit: HitResult) => void;
  onDropPart?: (partId: string, hit: HitResult) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragLockView, setDragLockView] = useState<{ pivot: P3; fit: number } | null>(null);

  const containerRef = useRef<any>(null);
  const viewOffsetRef = useRef({ x: 0, y: 0 });
  const facesRef = useRef<Face[]>([]);

  const measureContainer = () => {
    containerRef.current?.measureInWindow?.((x: number, y: number) => {
      if (typeof x === 'number' && typeof y === 'number') {
        viewOffsetRef.current = { x, y };
      }
    });
  };

  const scene = useMemo(() => {
    if (!size.w || !size.h) {
      return {
        faces: [] as Face[],
        groundShadows: [] as GroundShadow[],
        grid: [] as number[][][],
        ground: [] as number[][],
        selEdges: [] as number[][][],
      };
    }

    const b = sceneBounds(units, site);

    if (dragLockView) {
      setView(dragLockView.pivot, dragLockView.fit);
    } else {
      const v = computeCameraView(units, site, size.w, size.h);
      setView(v.pivot, v.fit);
    }

    const { faces, groundShadows, layout } = buildScene({ units, site, showRoof, level, spec }, cam, size.w, size.h);

    const pad = Math.max(4, Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.35);
    const minX = Math.floor(b.x0 - pad);
    const maxX = Math.ceil(b.x1 + pad);
    const minZ = Math.floor(b.z0 - pad);
    const maxZ = Math.ceil(b.z1 + pad);

    const grid: number[][][] = [];
    const step = 1.0;
    for (let x = minX; x <= maxX; x += step) {
      const a = project([x, 0, minZ], cam, size.w, size.h);
      const bPt = project([x, 0, maxZ], cam, size.w, size.h);
      grid.push([
        [a.x, a.y],
        [bPt.x, bPt.y],
      ]);
    }
    for (let z = minZ; z <= maxZ; z += step) {
      const a = project([minX, 0, z], cam, size.w, size.h);
      const bPt = project([maxX, 0, z], cam, size.w, size.h);
      grid.push([
        [a.x, a.y],
        [bPt.x, bPt.y],
      ]);
    }

    const g = [
      project([minX, 0, minZ], cam, size.w, size.h),
      project([maxX, 0, minZ], cam, size.w, size.h),
      project([maxX, 0, maxZ], cam, size.w, size.h),
      project([minX, 0, maxZ], cam, size.w, size.h),
    ];

    const selEdges = selectionEdges(sel, units, site, layout, cam, size.w, size.h);

    return {
      faces,
      groundShadows,
      grid,
      ground: g.map((p) => [p.x, p.y]),
      selEdges,
    };
  }, [units, site, showRoof, level, spec, sel, cam, size, dragLockView]);

  useEffect(() => {
    facesRef.current = scene.faces;
  }, [scene.faces]);

  const pickAtScreen = (lx: number, ly: number): HitResult => {
    const frontToBack = [...facesRef.current].reverse();
    const hit = frontToBack.find((f) => inPoly([lx, ly], f.pts));
    if (hit) {
      return { ref: hit.ref, point: hit.worldPt, wall: hit.wall };
    }
    const [wx, wz] = screenToWorldXZ(lx, ly, 0, cam, size.w, size.h);
    return { ref: null, point: [wx, 0, wz] };
  };

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };
  useEffect(() => clearHoldTimer, []);

  const gestureRef = useRef({
    az: 0,
    el: 0,
    dist: 0,
    pageX: 0,
    pageY: 0,
    localX: 0,
    localY: 0,
    pinch: 0,
    moved: false,
    longPressed: false,
    hit: { ref: null, point: [0, 0, 0] } as HitResult,
    dragging: false,
    startX: 0,
    startZ: 0,
    startAlong: 0,
  });

  const snapUnitPosition = (u: UnitModel, cx: number, cz: number, allUnits: UnitModel[]) => {
    const e = extOf(u);
    const turned = (u.rot || 0) % 2;
    const hx = (turned ? e.wid : e.len) / 2;
    const hz = (turned ? e.len : e.wid) / 2;
    let bx = Math.round(cx / 0.05) * 0.05;
    let bz = Math.round(cz / 0.05) * 0.05;
    let dxBest = 0.35;
    let dzBest = 0.35;
    let snapped = false;
    const L = u.level || 0;
    for (const o of allUnits) {
      if (o.id === u.id) continue;
      const r = unitRect(o);
      const lo = o.level || 0;
      if (lo === L) {
        for (const x of [r.x0 - hx, r.x1 + hx, r.x0 + hx, r.x1 - hx, (r.x0 + r.x1) / 2]) {
          if (Math.abs(cx - x) < dxBest) {
            dxBest = Math.abs(cx - x);
            bx = x;
            snapped = true;
          }
        }
        for (const z of [r.z0 - hz, r.z1 + hz, r.z0 + hz, r.z1 - hz, (r.z0 + r.z1) / 2]) {
          if (Math.abs(cz - z) < dzBest) {
            dzBest = Math.abs(cz - z);
            bz = z;
            snapped = true;
          }
        }
      } else if (lo === L - 1) {
        for (const x of [o.cx, r.x0 + hx, r.x1 - hx]) {
          if (Math.abs(cx - x) < dxBest) {
            dxBest = Math.abs(cx - x);
            bx = x;
            snapped = true;
          }
        }
        for (const z of [o.cz, r.z0 + hz, r.z1 - hz]) {
          if (Math.abs(cz - z) < dzBest) {
            dzBest = Math.abs(cz - z);
            bz = z;
            snapped = true;
          }
        }
      }
    }
    return {
      cx: Math.round(bx * 1000) / 1000,
      cz: Math.round(bz * 1000) / 1000,
      snapped,
    };
  };

  const handleResponderGrant = (e: any) => {
    clearHoldTimer();
    measureContainer();
    const ne = e.nativeEvent as any;
    if (ne.button === 2) return;
    const lx =
      typeof ne.locationX === 'number' && (ne.locationX !== 0 || ne.locationY !== 0)
        ? ne.locationX
        : ne.pageX - viewOffsetRef.current.x;
    const ly =
      typeof ne.locationY === 'number' && (ne.locationX !== 0 || ne.locationY !== 0)
        ? ne.locationY
        : ne.pageY - viewOffsetRef.current.y;

    const hit = pickAtScreen(lx, ly);
    const isSelectedHit = Boolean(sel && hit.ref && sameRef(sel, hit.ref));

    let startX = 0;
    let startZ = 0;
    let startAlong = 0;
    if (isSelectedHit && sel) {
      if (sel.t === 'unit') {
        const u = units.find((x) => x.id === sel.id);
        if (u) {
          startX = u.cx;
          startZ = u.cz;
        }
      } else if (sel.t === 'site') {
        const it = site.find((x) => x.key === sel.key);
        if (it) {
          startX = it.x ?? 0;
          startZ = it.z ?? 0;
        }
      } else if (sel.t === 'item') {
        const u = units.find((x) => x.id === sel.id);
        const it = u?.items.find((x) => x.key === sel.key);
        if (it) {
          startX = it.x ?? 0;
          startZ = it.z ?? 0;
          startAlong = it.along ?? 0;
        }
      }
    }

    gestureRef.current = {
      ...cam,
      pageX: ne.pageX,
      pageY: ne.pageY,
      localX: lx,
      localY: ly,
      pinch: 0,
      moved: false,
      longPressed: false,
      hit,
      dragging: isSelectedHit,
      startX,
      startZ,
      startAlong,
    };

    if (isSelectedHit) {
      setIsDragging(true);
      setDragLockView(computeCameraView(units, site, size.w, size.h));
      onDragStart?.();
    }

    holdTimerRef.current = setTimeout(() => {
      if (!gestureRef.current.moved) {
        gestureRef.current.longPressed = true;
        if (gestureRef.current.dragging) {
          gestureRef.current.dragging = false;
          setIsDragging(false);
          setDragLockView(null);
          onDragEnd?.(false);
        }
        onContextMenu?.(gestureRef.current.pageX, gestureRef.current.pageY, gestureRef.current.hit);
      }
    }, 520);
  };

  const handleResponderMove = (e: any) => {
    const ne = e.nativeEvent as any;
    const touches = ne.touches;
    if (touches && touches.length >= 2) {
      clearHoldTimer();
      gestureRef.current.moved = true;
      if (gestureRef.current.dragging) {
        gestureRef.current.dragging = false;
        setIsDragging(false);
        setDragLockView(null);
        onDragEnd?.(false);
      }
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      const dist = Math.hypot(dx, dy);
      if (!gestureRef.current.pinch) gestureRef.current.pinch = dist;
      const k = gestureRef.current.pinch / Math.max(dist, 1);
      setCam((prev) => ({
        ...prev,
        dist: Math.max(6, Math.min(80, gestureRef.current.dist * k)),
      }));
      return;
    }

    const dx = (ne.pageX ?? 0) - gestureRef.current.pageX;
    const dy = (ne.pageY ?? 0) - gestureRef.current.pageY;

    if (Math.hypot(dx, dy) > 6) {
      gestureRef.current.moved = true;
      clearHoldTimer();
    }

    if (gestureRef.current.longPressed || !gestureRef.current.moved) return;

    if (gestureRef.current.dragging && sel) {
      const activeRef = sel;
      const [dX, dZ] = screenDeltaToWorldXZ(dx, dy, cam, size.w, size.h);

      onDragMove?.(activeRef, (prevUnits, prevSite) => {
        if (activeRef.t === 'unit') {
          const u = prevUnits.find((x) => x.id === activeRef.id);
          if (!u) return { units: prevUnits, site: prevSite };
          const snapped = snapUnitPosition(u, gestureRef.current.startX + dX, gestureRef.current.startZ + dZ, prevUnits);
          const nextUnits = prevUnits.map((x) => (x.id === u.id ? { ...x, cx: snapped.cx, cz: snapped.cz } : x));
          return {
            units: nextUnits,
            site: prevSite,
            status: `${u.name || u.preset} · ${snapped.cx.toFixed(2)} m, ${snapped.cz.toFixed(2)} m${snapped.snapped ? ' · snapped' : ''}`,
          };
        }
        if (activeRef.t === 'site') {
          const nextX = Math.round(((gestureRef.current.startX + dX) / 0.05)) * 0.05;
          const nextZ = Math.round(((gestureRef.current.startZ + dZ) / 0.05)) * 0.05;
          const nextSite = prevSite.map((it) =>
            it.key === activeRef.key
              ? { ...it, x: Math.round(nextX * 1000) / 1000, z: Math.round(nextZ * 1000) / 1000 }
              : it
          );
          return { units: prevUnits, site: nextSite };
        }
        if (activeRef.t === 'item') {
          const u = prevUnits.find((x) => x.id === activeRef.id);
          const it = u?.items.find((x) => x.key === activeRef.key);
          if (!u || !it) return { units: prevUnits, site: prevSite };
          const r = ((u.rot || 0) % 4 + 4) % 4;
          const [lx, lz] = (
            [
              [dX, dZ],
              [dZ, -dX],
              [-dX, -dZ],
              [-dZ, dX],
            ] as [number, number][]
          )[r];
          if (it.kind === 'opening' || it.kind === 'facade') {
            const span = it.wall === 'front' || it.wall === 'back' ? u.wid : u.len;
            const deltaAlong =
              it.wall === 'left'
                ? lx
                : it.wall === 'right'
                ? -lx
                : it.wall === 'front'
                ? lz
                : -lz;
            const w = it.w ?? PART[it.type]?.w ?? 1;
            const rawAlong = gestureRef.current.startAlong + deltaAlong;
            const nextAlong = Math.max(w / 2, Math.min(span - w / 2, Math.round(rawAlong / 0.025) * 0.025));
            const nextUnits = prevUnits.map((x) =>
              x.id === u.id
                ? {
                    ...x,
                    items: x.items.map((item) =>
                      item.key === it.key ? { ...item, along: Math.round(nextAlong * 1000) / 1000 } : item
                    ),
                  }
                : x
            );
            return { units: nextUnits, site: prevSite };
          } else {
            const { dx: pdx, dz: pdz } = it.kind === 'fitting' ? planSize(it) : { dx: 0.2, dz: 0.2 };
            const lo = it.kind === 'roof' ? -0.3 : 0;
            const rawX = gestureRef.current.startX + lx;
            const rawZ = gestureRef.current.startZ + lz;
            const nextX = Math.max(lo + pdx / 2, Math.min(u.len - lo - pdx / 2, Math.round(rawX / 0.025) * 0.025));
            const nextZ = Math.max(lo + pdz / 2, Math.min(u.wid - lo - pdz / 2, Math.round(rawZ / 0.025) * 0.025));
            const nextUnits = prevUnits.map((x) =>
              x.id === u.id
                ? {
                    ...x,
                    items: x.items.map((item) =>
                      item.key === it.key
                        ? { ...item, x: Math.round(nextX * 1000) / 1000, z: Math.round(nextZ * 1000) / 1000 }
                        : item
                    ),
                  }
                : x
            );
            return { units: nextUnits, site: prevSite };
          }
        }
        return { units: prevUnits, site: prevSite };
      });
      return;
    }

    // Orbit camera
    setCam((prev) => ({
      ...prev,
      az: gestureRef.current.az - dx * 0.0085,
      el: Math.max(0.05, Math.min(1.52, gestureRef.current.el + dy * 0.0065)),
    }));
  };

  const handleResponderRelease = () => {
    clearHoldTimer();
    if (gestureRef.current.longPressed) return;
    if (gestureRef.current.dragging) {
      const didMove = gestureRef.current.moved;
      gestureRef.current.dragging = false;
      setIsDragging(false);
      setDragLockView(null);
      onDragEnd?.(didMove);
      if (!didMove) {
        onSelect(gestureRef.current.hit.ref);
      }
      return;
    }
    if (!gestureRef.current.moved) {
      onSelect(gestureRef.current.hit.ref);
    }
  };

  const handleResponderTerminate = () => {
    clearHoldTimer();
    if (gestureRef.current.dragging) {
      gestureRef.current.dragging = false;
      setIsDragging(false);
      setDragLockView(null);
      onDragEnd?.(false);
    }
  };

  const webProps =
    Platform.OS === 'web'
      ? {
          onWheel: (e: any) => {
            const raw = e.deltaY || 0;
            if (!raw) return;
            const delta = raw > 0 ? 1.8 : -1.8;
            setCam((prev) => ({
              ...prev,
              dist: Math.max(6, Math.min(80, prev.dist + delta)),
            }));
          },
          onContextMenu: (e: any) => {
            e.preventDefault();
            measureContainer();
            const clientX = e.clientX ?? e.nativeEvent?.pageX ?? 0;
            const clientY = e.clientY ?? e.nativeEvent?.pageY ?? 0;
            const rect = e.currentTarget?.getBoundingClientRect?.();
            const lx = rect ? clientX - rect.left : clientX - viewOffsetRef.current.x;
            const ly = rect ? clientY - rect.top : clientY - viewOffsetRef.current.y;
            const hit = pickAtScreen(lx, ly);
            onContextMenu?.(clientX, clientY, hit);
          },
          onDragOver: (e: any) => {
            if (e.dataTransfer?.types?.includes?.('text/x-cb-part')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          },
          onDrop: (e: any) => {
            const partId = e.dataTransfer?.getData?.('text/x-cb-part');
            if (!partId) return;
            e.preventDefault();
            const rect = e.currentTarget?.getBoundingClientRect?.();
            const lx = rect ? e.clientX - rect.left : e.clientX;
            const ly = rect ? e.clientY - rect.top : e.clientY;
            const hit = pickAtScreen(lx, ly);
            onDropPart?.(partId, hit);
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
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={handleResponderGrant}
      onResponderMove={handleResponderMove}
      onResponderRelease={handleResponderRelease}
      onResponderTerminate={handleResponderTerminate}
      {...(webProps as any)}
    >
      {size.w > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={size.w} height={size.h}>
            <Polygon points={scene.ground.map((p) => p.join(',')).join(' ')} fill="#0C0D10" stroke={c.line} strokeWidth={1} />
            {scene.grid.map((l, i) => (
              <Line key={'g' + i} x1={l[0][0]} y1={l[0][1]} x2={l[1][0]} y2={l[1][1]} stroke="rgba(255,255,255,0.045)" strokeWidth={1} />
            ))}
            {scene.groundShadows.map((s) => (
              <Polygon key={s.key} points={s.pts.map((p) => p.join(',')).join(' ')} fill={s.fill} opacity={s.opacity ?? 1} />
            ))}
            {scene.faces.map((f) => (
              <Polygon
                key={f.key}
                points={f.pts.map((p) => p.join(',')).join(' ')}
                fill={f.fill}
                stroke={f.stroke}
                strokeWidth={f.strokeWidth ?? 0.55}
                opacity={f.opacity ?? 1}
              />
            ))}
            {scene.selEdges.map((e, i) => (
              <Polyline
                key={'sel' + i}
                points={e.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke={c.lime}
                strokeWidth={isDragging ? 2.4 : 1.8}
                strokeDasharray={isDragging ? '5,3' : undefined}
                opacity={0.98}
              />
            ))}
          </Svg>
        </View>
      )}
    </View>
  );
}

/**
 * Helper matching Toolbox's `placementAt(hit, p)`: determines where a part of kind `p`
 * should be placed given a 3D hit result.
 */
export function placementAt(
  hit: HitResult | null,
  p: { kind: string } | null,
  units: UnitModel[]
): { kind: 'wall' | 'roof' | 'site' | 'floor'; unitId?: string; wall?: WallId; along?: number; x?: number; z?: number } | null {
  if (!hit) return null;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  if (hit.ref?.t === 'unit' || hit.ref?.t === 'item') {
    const u = units.find((x) => x.id === (hit.ref as { id: string }).id);
    if (!u) return null;
    const layout = layoutUnits(units);
    const elev = layout.get(u.id)?.elev || 0;
    const lp = worldToUnitLocal(hit.point, u, elev);
    const e = extOf(u);
    const wall: WallId | null =
      hit.wall ||
      (Math.abs(lp[2]) > u.wid / 2 - 0.14
        ? lp[2] < 0
          ? 'left'
          : 'right'
        : Math.abs(lp[0]) > u.len / 2 - 0.14
        ? lp[0] > 0
          ? 'front'
          : 'back'
        : null);
    const onRoof = lp[1] > u.hgt - 0.08;
    if (p?.kind === 'opening' || p?.kind === 'facade') {
      const w: WallId =
        wall ||
        (Math.abs(lp[2]) / (e.wid / 2) > Math.abs(lp[0]) / (e.len / 2)
          ? lp[2] < 0
            ? 'left'
            : 'right'
          : lp[0] > 0
          ? 'front'
          : 'back');
      const a =
        w === 'left'
          ? lp[0] + u.len / 2
          : w === 'right'
          ? u.len / 2 - lp[0]
          : w === 'front'
          ? lp[2] + u.wid / 2
          : u.wid / 2 - lp[2];
      return { kind: 'wall', unitId: u.id, wall: w, along: r3(a) };
    }
    if (p?.kind === 'roof' || (onRoof && !p)) {
      return { kind: 'roof', unitId: u.id, x: r3(lp[0] + u.len / 2), z: r3(lp[2] + u.wid / 2) };
    }
    if (p?.kind === 'site') {
      return { kind: 'site', x: r3(hit.point[0]), z: r3(hit.point[2]) };
    }
    return {
      kind: 'floor',
      unitId: u.id,
      x: r3(Math.max(0.2, Math.min(u.len - 0.2, lp[0] + u.len / 2))),
      z: r3(Math.max(0.2, Math.min(u.wid - 0.2, lp[2] + u.wid / 2))),
      wall: wall || undefined,
    };
  }
  if (hit.point) {
    return { kind: 'site', x: r3(hit.point[0]), z: r3(hit.point[2]) };
  }
  return null;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: c.bg },
});
