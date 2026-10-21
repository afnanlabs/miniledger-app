/**
 * API configuration.
 *
 * The phone cannot reach `localhost` - that would point at the phone itself.
 * The API therefore lives on the development machine's LAN address, which is
 * what `expo start` prints in the QR code.
 *
 * Override without touching this file by creating `mobile/.env`:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.30:4000/api/v1
 */
const LAN_HOST = '192.168.1.30';
const API_PORT = 4000;

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return `http://${LAN_HOST}:${API_PORT}/api/v1`;
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Shown in the UI footer so connection problems are easy to diagnose. */
export const API_HOST_LABEL = API_BASE_URL.replace(/^https?:\/\//, '').replace(/\/api\/v1$/, '');

export const REQUEST_TIMEOUT_MS = 15_000;
