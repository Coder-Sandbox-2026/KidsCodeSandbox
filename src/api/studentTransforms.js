/** Only editor-created options use percentages/degrees. Internal factories retain factors/radians. */
export function studentCreationOptions(options) {
  if (!options || typeof options !== 'object') return options;
  const result = { ...options };
  if (options.scale !== undefined) {
    result.scale = Array.isArray(options.scale)
      ? [0, 1, 2].map(i => (options.scale[i] ?? 100) / 100) : options.scale / 100;
  }
  if (options.rotation !== undefined) {
    result.rotation = [0, 1, 2].map(i => (options.rotation[i] ?? 0) * Math.PI / 180);
  }
  return result;
}

const views = new WeakMap();
export function studentObject(object) {
  if (!object) return object;
  if (views.has(object)) return views.get(object);
  const vectors = new Map();
  const methods = new Map();
  const method = (key, fn) => {
    if (!methods.has(key)) methods.set(key, fn);
    return methods.get(key);
  };
  let view;
  view = new Proxy(object, {
    get(target, key) {
      if (key === 'scale' || key === 'rotation') {
        if (!vectors.has(key)) {
          const factor = key === 'scale' ? 100 : 180 / Math.PI;
          const value = target[key];
          vectors.set(key, new Proxy(value, {
            get(vector, axis) {
              if (['x', 'y', 'z'].includes(axis)) return vector[axis] * factor;
              if (axis === 'set' || axis === 'setScalar') return (...args) => {
                if (axis === 'setScalar') args = [args[0], args[0], args[0]];
                value.set(...args.map(n => n / factor));
                if (key === 'scale') target._rebuildColliders();
                return vectors.get(key);
              };
              if (axis === 'toArray') return () => ['x', 'y', 'z'].map(a => vector[a] * factor);
              const member = vector[axis];
              return typeof member === 'function' ? member.bind(vector) : member;
            },
            set(vector, axis, next) {
              vector[axis] = ['x', 'y', 'z'].includes(axis) ? next / factor : next;
              if (key === 'scale') target._rebuildColliders();
              return true;
            },
          }));
        }
        return vectors.get(key);
      }
      if (key === 'setScale') return method(key, (...args) => { target.setScale(...args.map(n => n / 100)); return view; });
      if (key === 'onClick') return method(key, callback => {
        if (typeof callback !== 'function') throw new TypeError('onClick() expects a function');
        target.onClick(event => callback(event == null ? event : { ...event, gameObject: studentObject(event.gameObject) }));
        return view;
      });
      if (key === 'onCollision') return method(key, callback => {
        if (typeof callback !== 'function') throw new TypeError('onCollision() expects a function');
        target.onCollision(other => callback(other?.mesh ? studentObject(other) : other));
        return view;
      });
      const member = Reflect.get(target, key, target);
      if (typeof member !== 'function') return member;
      return method(key, (...args) => {
        const result = member.apply(target, args);
        return result === target ? view : result;
      });
    },
  });
  views.set(object, view);
  return view;
}
