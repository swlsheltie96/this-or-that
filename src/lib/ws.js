import { writable } from "svelte/store";

export const onlineCount = writable(0);
export const votesLastHour = writable(0);
export const chatMessages = writable([]);

function makeRandomName() {
  const adj = ["swift", "quiet", "bright", "clever", "wild", "calm", "bold", "crisp"];
  const noun = ["fox", "owl", "bear", "wolf", "hawk", "deer", "lynx", "crow"];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const n = noun[Math.floor(Math.random() * noun.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${a}-${n}-${num}`;
}

function loadName() {
  try {
    return localStorage.getItem("chat-name") || makeRandomName();
  } catch {
    return makeRandomName();
  }
}

export const chatName = writable(loadName());
chatName.subscribe((name) => {
  try { localStorage.setItem("chat-name", name); } catch {}
});

let ws = null;
let currentListName = null;
let reconnectTimer = null;

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

function connect() {
  if (ws && ws.readyState <= WebSocket.OPEN) return; // already connecting or open
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onopen = () => {
    if (currentListName) {
      ws.send(JSON.stringify({ type: "join", listName: currentListName }));
    }
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "stats") {
        onlineCount.set(msg.online);
        votesLastHour.set(msg.votesLastHour);
      } else if (msg.type === "history") {
        chatMessages.set(msg.comments);
      } else if (msg.type === "comment") {
        chatMessages.update((msgs) => [...msgs, msg]);
      }
    } catch {}
  };

  ws.onclose = () => scheduleReconnect();
  ws.onerror = () => scheduleReconnect(); // don't call ws.close(), just schedule reconnect
}

export function joinList(listName) {
  currentListName = listName;
  chatMessages.set([]);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "join", listName }));
  }
}

export function sendComment(listName, author, text) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "comment", listName, author, text }));
  }
}

if (typeof window !== "undefined") connect();
