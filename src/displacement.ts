import type { Unit } from './types';
import { unitBox } from './geo';

/**
 * Displaces colliding units when a unit is dragged around,
 * preventing clipping and pushing neighboring containers physically along the collision axis.
 */
export function displaceUnits(
  draggedId: string,
  targetX: number,
  targetZ: number,
  units: Unit[]
): Unit[] {
  const dragged = units.find((u) => u.id === draggedId);
  if (!dragged) return units;

  const dx = targetX - dragged.x;
  const dz = targetZ - dragged.z;
  if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) return units;

  // Clone units with the dragged unit at target position
  const result: Unit[] = units.map((u) => (u.id === draggedId ? { ...u, x: targetX, z: targetZ } : { ...u }));

  const queue: string[] = [draggedId];
  const visited = new Set<string>([draggedId]);

  let safetyCount = 0;
  while (queue.length > 0 && safetyCount < 32) {
    safetyCount++;
    const currentId = queue.shift()!;
    const cur = result.find((u) => u.id === currentId);
    if (!cur) continue;
    const curBox = unitBox(cur);

    for (let i = 0; i < result.length; i++) {
      const other = result[i];
      if (other.id === cur.id || other.level !== cur.level) continue;
      const otherBox = unitBox(other);

      // Check overlap in both X and Z
      const ox = Math.min(curBox.x0 + curBox.L, otherBox.x0 + otherBox.L) - Math.max(curBox.x0, otherBox.x0);
      const oz = Math.min(curBox.z0 + curBox.W, otherBox.z0 + otherBox.W) - Math.max(curBox.z0, otherBox.z0);

      if (ox > 0.02 && oz > 0.02) {
        let newOtherX = other.x;
        let newOtherZ = other.z;

        const curCenterX = curBox.x0 + curBox.L / 2;
        const curCenterZ = curBox.z0 + curBox.W / 2;
        const otherCenterX = otherBox.x0 + otherBox.L / 2;
        const otherCenterZ = otherBox.z0 + otherBox.W / 2;

        // Displace along the axis of minimum penetration or dominant movement
        if (ox < oz) {
          // Push along X
          if (curCenterX <= otherCenterX) {
            newOtherX = Number((curBox.x0 + curBox.L).toFixed(2));
          } else {
            newOtherX = Number((curBox.x0 - otherBox.L).toFixed(2));
          }
        } else {
          // Push along Z
          if (curCenterZ <= otherCenterZ) {
            newOtherZ = Number((curBox.z0 + curBox.W).toFixed(2));
          } else {
            newOtherZ = Number((curBox.z0 - otherBox.W).toFixed(2));
          }
        }

        result[i] = { ...other, x: newOtherX, z: newOtherZ };

        if (!visited.has(other.id)) {
          visited.add(other.id);
          queue.push(other.id);
        }
      }
    }
  }

  return result;
}
