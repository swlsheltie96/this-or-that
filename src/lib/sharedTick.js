const listeners = new Set();
setInterval(() => listeners.forEach((fn) => fn()), 300);

export function onTick(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
