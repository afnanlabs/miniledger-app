import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../constants/config';
import type { FieldError } from '../types';

/**
 * Error thrown for every failure in the API layer.
 * `code` mirrors the backend error code (VALIDATION_ERROR, LOAN_NOT_FOUND, ...)
 * so screens can react to specific problems instead of string matching.
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: FieldError[];

  constructor(message: string, status: number, code: string, details?: FieldError[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/** Maps a validation error to a per-field lookup for form screens. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.details) return {};
  const map: Record<string, string> = {};
  for (const detail of error.details) {
    if (!map[detail.field]) map[detail.field] = detail.message;
  }
  return map;
}

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Called once when an authenticated request receives a 401, so the app can
 * clear a revoked/expired session instead of leaving the user in an error loop.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: FieldError[];
  };
}

/**
 * Thin fetch wrapper.
 * - adds the JSON + bearer headers
 * - unwraps the `{ success, data }` envelope
 * - normalises every failure into an ApiError with a human readable message
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    let envelope: ApiEnvelope<T> | null = null;
    if (raw) {
      try {
        envelope = JSON.parse(raw) as ApiEnvelope<T>;
      } catch {
        envelope = null;
      }
    }

    if (!response.ok || envelope?.success === false) {
      if (response.status === 401 && authToken) {
        // Session was revoked or expired while the app was open.
        authToken = null;
        unauthorizedHandler?.();
      }

      const message =
        envelope?.error?.message ??
        (response.status >= 500
          ? 'The server ran into a problem. Please try again.'
          : `Request failed (${response.status}).`);
      throw new ApiError(
        message,
        response.status,
        envelope?.error?.code ?? 'UNKNOWN_ERROR',
        envelope?.error?.details,
      );
    }

    if (!envelope) {
      throw new ApiError('The server returned an unexpected response.', response.status, 'BAD_RESPONSE');
    }

    return envelope.data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(
        'The server is taking too long to respond. Check your Wi-Fi and try again.',
        0,
        'TIMEOUT',
      );
    }

    throw new ApiError(
      `Cannot reach the server at ${API_BASE_URL}. Make sure the backend is running and both devices are on the same network.`,
      0,
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeout);
  }
}
