import { getSortedList } from './api.js';

const cache = new Map();

function fetchAndCache(listName) {
  const p = getSortedList(listName).then(items => {
    for (const item of (items || []).slice(0, 2)) {
      if (item.data?.picture) new Image().src = item.data.picture;
    }
    return items;
  }).catch(() => null);
  cache.set(listName, p);
  return p;
}

export function getCachedTopItems(listName) {
  return cache.has(listName) ? cache.get(listName) : fetchAndCache(listName);
}

export function preloadList(listName) {
  if (!cache.has(listName)) fetchAndCache(listName);
}
