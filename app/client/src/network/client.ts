import { Client } from '@colyseus/sdk';

function getServerUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  // Connect through the same origin (Vite dev proxy on port 5173).
  // This proxies /matchmake and room WebSockets directly to Colyseus on localhost:2567,
  // completely bypassing Windows Firewall blocks on LAN/Wi-Fi!
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host || 'localhost:5173';
  return `${protocol}//${host}/colyseus`;
}

export const client = new Client(getServerUrl());


