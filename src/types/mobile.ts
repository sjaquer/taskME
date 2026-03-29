export type MobilePlatform = 'android' | 'web';

export interface DeviceRegistrationPayload {
  platform: MobilePlatform;
  pushToken: string;
  appVersion?: string;
  osVersion?: string;
  deviceModel?: string;
  locale?: string;
  timezone?: string;
}

export interface MobileNotificationUpdatePayload {
  notificationId: string;
  source: MobilePlatform;
}

export interface MobileLogEventPayload {
  name: string;
  source: MobilePlatform;
  level?: 'debug' | 'info' | 'warn' | 'error';
  appBuild?: string;
  correlationId?: string;
  data?: Record<string, unknown>;
}

export interface NativeBridgeRequest {
  action: string;
  requestId: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export interface NativeBridgeResponse {
  requestId: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
