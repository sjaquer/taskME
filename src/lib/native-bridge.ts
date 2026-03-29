'use client';

import type { NativeBridgeRequest, NativeBridgeResponse } from '@/types/mobile';

type PendingRequest = {
  resolve: (value: NativeBridgeResponse) => void;
  reject: (reason?: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT_MS = 6000;
const pendingRequests = new Map<string, PendingRequest>();
let bridgeInitialized = false;

function parseNativeMessage(raw: string): NativeBridgeResponse | null {
  try {
    const parsed = JSON.parse(raw) as NativeBridgeResponse;
    if (!parsed?.requestId || typeof parsed.ok !== 'boolean') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isNativeAndroidContainer(): boolean {
  return typeof window !== 'undefined' && typeof window.AndroidBridge?.postMessage === 'function';
}

export function initializeNativeBridgeListener() {
  if (typeof window === 'undefined' || bridgeInitialized) {
    return;
  }

  window.onNativeMessage = (raw: string) => {
    const parsed = parseNativeMessage(raw);
    if (!parsed) {
      return;
    }

    const pending = pendingRequests.get(parsed.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    pendingRequests.delete(parsed.requestId);
    pending.resolve(parsed);
  };

  bridgeInitialized = true;
}

export async function callNativeBridge(
  action: string,
  payload: Record<string, unknown> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<NativeBridgeResponse> {
  if (!isNativeAndroidContainer()) {
    throw new Error('Native bridge unavailable');
  }

  initializeNativeBridgeListener();

  const request: NativeBridgeRequest = {
    action,
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    payload,
  };

  const promise = new Promise<NativeBridgeResponse>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(request.requestId);
      reject(new Error(`Native bridge timeout for action: ${action}`));
    }, timeoutMs);

    pendingRequests.set(request.requestId, {
      resolve,
      reject,
      timeoutId,
    });
  });

  window.AndroidBridge?.postMessage(JSON.stringify(request));
  return promise;
}
