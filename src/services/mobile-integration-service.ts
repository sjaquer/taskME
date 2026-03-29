'use client';

import type { User } from 'firebase/auth';
import { callNativeBridge, initializeNativeBridgeListener, isNativeAndroidContainer } from '@/lib/native-bridge';
import type { DeviceRegistrationPayload, MobileLogEventPayload } from '@/types/mobile';

type NativePayload = {
  token?: string;
  pushToken?: string;
  appVersion?: string;
  osVersion?: string;
  deviceModel?: string;
};

async function postWithAuth(user: User, path: string, body: unknown) {
  const idToken = await user.getIdToken();

  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
}

function buildClientLocaleData() {
  return {
    locale: typeof navigator !== 'undefined' ? navigator.language : 'es-CL',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function extractPushToken(data: NativePayload | undefined): string | null {
  if (!data) return null;
  if (typeof data.pushToken === 'string' && data.pushToken.length > 20) {
    return data.pushToken;
  }
  if (typeof data.token === 'string' && data.token.length > 20) {
    return data.token;
  }
  return null;
}

export async function registerMobileLogEvent(user: User, payload: MobileLogEventPayload) {
  const response = await postWithAuth(user, '/api/v1/events/mobile-log', payload);
  return response.ok;
}

export async function markNotificationAsOpened(user: User, notificationId: string) {
  const response = await postWithAuth(user, `/api/v1/notifications/${notificationId}/opened`, {});
  return response.ok;
}

export async function markNotificationAsRead(user: User, notificationId: string) {
  const response = await postWithAuth(user, `/api/v1/notifications/${notificationId}/read`, {});
  return response.ok;
}

export async function registerNativeAndroidDevice(user: User) {
  if (!isNativeAndroidContainer()) {
    return { ok: false, reason: 'not-native-container' } as const;
  }

  initializeNativeBridgeListener();

  try {
    await callNativeBridge('app.requestNotificationPermission');

    const [deviceInfoResponse, tokenResponse] = await Promise.all([
      callNativeBridge('app.getDeviceInfo').catch(() => ({ ok: false, requestId: '', data: {} })),
      callNativeBridge('app.getPushToken'),
    ]);

    if (!tokenResponse.ok) {
      return { ok: false, reason: tokenResponse.error || 'native-token-error' } as const;
    }

    const pushToken = extractPushToken(tokenResponse.data as NativePayload | undefined);
    if (!pushToken) {
      return { ok: false, reason: 'missing-push-token' } as const;
    }

    const deviceInfo = (deviceInfoResponse.data || {}) as NativePayload;

    const payload: DeviceRegistrationPayload = {
      platform: 'android',
      pushToken,
      appVersion: deviceInfo.appVersion,
      osVersion: deviceInfo.osVersion,
      deviceModel: deviceInfo.deviceModel,
      ...buildClientLocaleData(),
    };

    const response = await postWithAuth(user, '/api/v1/devices/register', payload);
    if (!response.ok) {
      return { ok: false, reason: `register-failed-${response.status}` } as const;
    }

    await registerMobileLogEvent(user, {
      name: 'mobile_device_registered',
      source: 'android',
      level: 'info',
      data: {
        hasDeviceInfo: Boolean(deviceInfo.appVersion || deviceInfo.osVersion || deviceInfo.deviceModel),
      },
    });

    return { ok: true } as const;
  } catch (error) {
    console.error('Error registering native Android device:', error);
    return { ok: false, reason: 'unexpected-error' } as const;
  }
}
