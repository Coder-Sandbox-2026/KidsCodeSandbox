import * as THREE from 'three';

const EPSILON = 1e-5;

function authoredName(object) {
  return String(object?.userData?.name ?? object?.name ?? '').trim();
}

function edgeKey(a, b) {
  const left = `${a.x.toFixed(5)},${a.y.toFixed(5)},${a.z.toFixed(5)}`;
  const right = `${b.x.toFixed(5)},${b.y.toFixed(5)},${b.z.toFixed(5)}`;
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function pointInTriangleXZ(point, triangle, tolerance = 0.05) {
  const { a, b, c } = triangle;
  const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
  if (Math.abs(denominator) <= EPSILON) return false;
  const u = ((b.z - c.z) * (point.x - c.x) + (c.x - b.x) * (point.z - c.z)) / denominator;
  const v = ((c.z - a.z) * (point.x - c.x) + (a.x - c.x) * (point.z - c.z)) / denominator;
  const w = 1 - u - v;
  return u >= -tolerance && v >= -tolerance && w >= -tolerance;
}

function closestPointOnSegmentXZ(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq <= EPSILON ? 0 : THREE.MathUtils.clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq, 0, 1);
  return new THREE.Vector3(
    start.x + dx * t,
    start.y + (end.y - start.y) * t,
    start.z + dz * t,
  );
}

function closestPointOnTriangleXZ(point, triangle) {
  if (pointInTriangleXZ(point, triangle)) {
    const ab = triangle.b.clone().sub(triangle.a);
    const ac = triangle.c.clone().sub(triangle.a);
    const denominator = ab.x * ac.z - ac.x * ab.z;
    const u = ((point.x - triangle.a.x) * ac.z - (point.z - triangle.a.z) * ac.x) / denominator;
    const v = (ab.x * (point.z - triangle.a.z) - ab.z * (point.x - triangle.a.x)) / denominator;
    return triangle.a.clone().addScaledVector(ab, u).addScaledVector(ac, v);
  }
  return [
    closestPointOnSegmentXZ(point, triangle.a, triangle.b),
    closestPointOnSegmentXZ(point, triangle.b, triangle.c),
    closestPointOnSegmentXZ(point, triangle.c, triangle.a),
  ].reduce((best, candidate) => (
    candidate.distanceToSquared(point) < best.distanceToSquared(point) ? candidate : best
  ));
}

/** Lightweight world-space triangle navigation graph shared by NPC controllers. */
export class NavigationManager {
  constructor(root, { name = 'NavMesh', debug = false } = {}) {
    this.root = root;
    this.name = name;
    this.triangles = [];
    this.adjacency = [];
    this.debugRoot = null;
    this._build();
    if (debug) this.setDebugEnabled(true);
  }

  _build() {
    this.root?.updateMatrixWorld(true);
    let navMeshRoot = null;
    this.root?.traverse(object => {
      if (!navMeshRoot && authoredName(object).toLowerCase() === this.name.toLowerCase()) navMeshRoot = object;
    });
    const meshes = [];
    this.root?.traverse(object => {
      if (object === navMeshRoot) object.visible = false;
      let underNavMesh = false;
      for (let parent = object; parent; parent = parent.parent) {
        if (parent === navMeshRoot) { underNavMesh = true; break; }
      }
      if (object.isMesh && underNavMesh) {
        object.visible = false;
        meshes.push(object);
      }
    });
    if (!navMeshRoot || !meshes.length) {
      console.warn(`[NavigationManager] NavMesh "${this.name}" was not found.`);
      return;
    }

    const edges = new Map();
    for (const mesh of meshes) {
      const position = mesh.geometry?.attributes?.position;
      if (!position) continue;
      const index = mesh.geometry.index;
      const indices = index ? Array.from(index.array) : Array.from({ length: position.count }, (_, i) => i);
      for (let i = 0; i + 2 < indices.length; i += 3) {
        const vertices = [indices[i], indices[i + 1], indices[i + 2]].map(vertexIndex => (
          new THREE.Vector3().fromBufferAttribute(position, vertexIndex).applyMatrix4(mesh.matrixWorld)
        ));
        const [a, b, c] = vertices;
        if (Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).length()) <= EPSILON) continue;
        const triangle = { a, b, c, center: a.clone().add(b).add(c).multiplyScalar(1 / 3), neighbors: [] };
        const triangleIndex = this.triangles.push(triangle) - 1;
        for (const [start, end] of [[a, b], [b, c], [c, a]]) {
          const key = edgeKey(start, end);
          const other = edges.get(key);
          if (other) {
            const portal = start.clone().add(end).multiplyScalar(0.5);
            this.triangles[other.triangle].neighbors.push({ triangle: triangleIndex, portal });
            triangle.neighbors.push({ triangle: other.triangle, portal });
          } else {
            edges.set(key, { triangle: triangleIndex });
          }
        }
      }
    }
    this.adjacency = this.triangles.map(triangle => triangle.neighbors);
    console.info('[NavigationManager] NavMesh discovered:', this.name);
    console.info('[NavigationManager] Navigation triangle count:', this.triangles.length);
    console.info('[NavigationManager] Navigation initialized.');
  }

  _nearestTriangle(point) {
    let best = null;
    let bestDistance = Infinity;
    for (let i = 0; i < this.triangles.length; i++) {
      const triangle = this.triangles[i];
      if (!pointInTriangleXZ(point, triangle)) continue;
      const distance = Math.abs(point.y - triangle.center.y);
      if (distance < bestDistance) best = { index: i, point: closestPointOnTriangleXZ(point, triangle) }, bestDistance = distance;
    }
    if (best) return best;
    for (let i = 0; i < this.triangles.length; i++) {
      const triangle = this.triangles[i];
      const candidate = closestPointOnTriangleXZ(point, triangle);
      const distance = candidate.distanceToSquared(point);
      if (distance < bestDistance) best = { index: i, point: candidate }, bestDistance = distance;
    }
    return best;
  }

  _findTriangle(point) {
    for (let i = 0; i < this.triangles.length; i++) {
      if (pointInTriangleXZ(point, this.triangles[i])) return i;
    }
    return -1;
  }

  _isSegmentNavigable(start, end) {
    const distance = start.distanceTo(end);
    const samples = Math.max(2, Math.ceil(distance / 0.5));
    for (let i = 0; i <= samples; i++) {
      const point = start.clone().lerp(end, i / samples);
      if (this._findTriangle(point) < 0) return false;
    }
    return true;
  }

  /** Validate a sampled line or Curve3 entirely against the traversable mesh. */
  isRouteNavigable(route, divisions = 32) {
    if (!route) return false;
    if (typeof route.getPointAt === 'function') {
      const samples = Math.max(2, divisions);
      for (let i = 0; i <= samples; i++) {
        if (this._findTriangle(route.getPointAt(i / samples, new THREE.Vector3())) < 0) return false;
      }
      return true;
    }
    if (!Array.isArray(route) || !route.length) return false;
    for (let i = 1; i < route.length; i++) {
      if (!this._isSegmentNavigable(route[i - 1], route[i])) return false;
    }
    return true;
  }

  /** Check whether a world-space position lies on the authored NavMesh. */
  isPositionNavigable(point) {
    return !!point && this._findTriangle(point) >= 0;
  }

  // A lightweight funnel/string-pull pass over portal midpoints. It only
  // removes a portal when the direct segment remains inside the NavMesh, so
  // it cannot cut through a hole while eliminating triangle-to-triangle
  // zigzags.
  _stringPullRoute(route) {
    if (route.length <= 2) return route;
    const pulled = [route[0]];
    let anchor = 0;
    while (anchor < route.length - 1) {
      let furthest = anchor + 1;
      for (let candidate = route.length - 1; candidate > furthest; candidate--) {
        if (this._isSegmentNavigable(route[anchor], route[candidate])) {
          furthest = candidate;
          break;
        }
      }
      pulled.push(route[furthest]);
      anchor = furthest;
    }
    return pulled;
  }

  /** Return a world-space route, or null when the two positions are disconnected. */
  findPath(start, target) {
    if (!this.triangles.length) return null;
    const startInfo = this._nearestTriangle(start);
    const targetInfo = this._nearestTriangle(target);
    if (!startInfo || !targetInfo) return null;

    const startInside = this._findTriangle(start) >= 0;
    const targetInside = this._findTriangle(target) >= 0;
    if (!startInside && !this._isSegmentNavigable(start, startInfo.point)) return null;
    if (!targetInside && !this._isSegmentNavigable(target, targetInfo.point)) return null;

    const startIndex = startInfo.index;
    const targetIndex = targetInfo.index;
    const open = new Set([startIndex]);
    const cameFrom = new Map();
    const cost = new Map([[startIndex, 0]]);
    const estimate = index => this.triangles[index].center.distanceToSquared(this.triangles[targetIndex].center);
    const score = new Map([[startIndex, estimate(startIndex)]]);
    while (open.size) {
      let current = null;
      let currentScore = Infinity;
      for (const index of open) {
        if (score.get(index) < currentScore) current = index, currentScore = score.get(index);
      }
      if (current === targetIndex) break;
      open.delete(current);
      for (const link of this.adjacency[current]) {
        const nextCost = cost.get(current) + this.triangles[current].center.distanceTo(this.triangles[link.triangle].center);
        if (nextCost >= (cost.get(link.triangle) ?? Infinity)) continue;
        cameFrom.set(link.triangle, { index: current, portal: link.portal });
        cost.set(link.triangle, nextCost);
        score.set(link.triangle, nextCost + estimate(link.triangle));
        open.add(link.triangle);
      }
    }
    if (startIndex !== targetIndex && !cameFrom.has(targetIndex)) return null;

    const portals = [];
    for (let current = targetIndex; current !== startIndex;) {
      const previous = cameFrom.get(current);
      portals.push(previous.portal);
      current = previous.index;
    }
    portals.reverse();
    const route = [start.clone()];
    if (!startInside) route.push(startInfo.point.clone());
    route.push(...portals);
    if (!targetInside) route.push(targetInfo.point.clone());
    else route.push(target.clone());
    const compact = [route[0]];
    for (let i = 1; i < route.length; i++) {
      if (route[i].distanceToSquared(compact[compact.length - 1]) > 1e-8) compact.push(route[i]);
    }
    return this._stringPullRoute(compact);
  }

  setDebugEnabled(enabled) {
    if (enabled && !this.debugRoot && this.triangles.length && this.root?.parent) {
      this.debugRoot = new THREE.Group();
      this.debugRoot.name = 'NavMesh_Debug';
      const positions = [];
      const edges = new Set();
      for (const triangle of this.triangles) {
        positions.push(...triangle.a.toArray(), ...triangle.b.toArray(), ...triangle.c.toArray());
        for (const [start, end] of [[triangle.a, triangle.b], [triangle.b, triangle.c], [triangle.c, triangle.a]]) {
          const key = edgeKey(start, end);
          if (edges.has(key)) continue;
          edges.add(key);
          const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
          this.debugRoot.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x145a20 })));
        }
      }
      const surface = new THREE.Mesh(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)),
        new THREE.MeshBasicMaterial({ color: 0x31b84a, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
      );
      this.debugRoot.add(surface);
      this.root.parent.add(this.debugRoot);
    } else if (!enabled) {
      this.debugRoot?.traverse(object => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
      this.debugRoot?.removeFromParent();
      this.debugRoot = null;
    }
  }

  clear() {
    this.setDebugEnabled(false);
    this.triangles = [];
    this.adjacency = [];
    this.root = null;
  }
}
