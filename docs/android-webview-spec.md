# TaskMe - Guia Tecnica Simple para APK WebView

## 1. Objetivo

Este documento define como conectar la APK Android (WebView simple) con la web actual de TaskMe, para que el programador Android pueda implementar mejoras sin rehacer la app completa.

Meta principal:

1. Mantener WebView como base.
2. Agregar conexion correcta con push nativo.
3. Sincronizar estado entre app y web (open/read, logs, dispositivo).
4. Mejorar seguridad y estabilidad sin aumentar complejidad.

## 2. Estado real de la web (codigo actual)

### 2.1 Bridge Web ya implementado

Archivo: src/lib/native-bridge.ts

```ts
export function isNativeAndroidContainer(): boolean {
  return typeof window !== 'undefined' && typeof window.AndroidBridge?.postMessage === 'function';
}

export async function callNativeBridge(action: string, payload: Record<string, unknown> = {}) {
  if (!isNativeAndroidContainer()) {
    throw new Error('Native bridge unavailable');
  }

  const request: NativeBridgeRequest = {
    action,
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    payload,
  };

  const promise = new Promise<NativeBridgeResponse>((resolve, reject) => {
    // Se resuelve cuando Android responde via window.onNativeMessage.
  });

  window.AndroidBridge?.postMessage(JSON.stringify(request));
  return promise;
}
```

Conclusion para Android:

1. La APK debe exponer window.AndroidBridge.postMessage(...).
2. La APK debe responder por window.onNativeMessage(...).

### 2.2 Registro automatico de dispositivo Android

Archivo: src/services/mobile-integration-service.ts

```ts
await callNativeBridge('app.requestNotificationPermission');

const [deviceInfoResponse, tokenResponse] = await Promise.all([
  callNativeBridge('app.getDeviceInfo').catch(() => ({ ok: false, requestId: '', data: {} })),
  callNativeBridge('app.getPushToken'),
]);

const response = await postWithAuth(user, '/api/v1/devices/register', payload);
```

Conclusion para Android:

1. Debe soportar acciones app.getDeviceInfo, app.getPushToken y app.requestNotificationPermission.
2. El token FCM se registra automaticamente en backend cuando hay sesion.

### 2.3 Monitor de notificaciones enlazado con deep link

Archivo: src/components/notification-monitor.tsx

```ts
const notificationId = searchParams.get('notificationId');
if (notificationId) {
  markNotificationAsOpened(user, notificationId).catch(() => {});
}
```

Conclusion para Android:

1. Al tocar push, abrir la URL web con query param notificationId.
2. La web marcara opened automaticamente.

### 2.4 Endpoint de registro de dispositivo ya disponible

Archivo: src/app/api/v1/devices/register/route.ts

```ts
const registerDeviceSchema = z.object({
  platform: z.enum(['android', 'web']),
  pushToken: z.string().min(20).max(4096),
  appVersion: z.string().max(64).optional(),
  osVersion: z.string().max(64).optional(),
  deviceModel: z.string().max(120).optional(),
  locale: z.string().max(20).optional(),
  timezone: z.string().max(64).optional(),
});
```

## 3. Contrato minimo WebView <-> Android

### 3.1 Mensaje JS -> Android

```json
{
  "action": "app.getPushToken",
  "requestId": "uuid",
  "timestamp": 1710000000000,
  "payload": {}
}
```

### 3.2 Mensaje Android -> JS

```json
{
  "requestId": "uuid",
  "ok": true,
  "data": {
    "pushToken": "fcm-token"
  }
}
```

### 3.3 Acciones que la APK debe soportar

1. app.getPushToken
2. app.getDeviceInfo
3. app.requestNotificationPermission
4. app.openExternalUrl (recomendado)

## 4. Endpoints web que debe usar la APK

Base: /api/v1

1. POST /devices/register
2. DELETE /devices/{deviceId}
3. POST /notifications/{notificationId}/opened
4. POST /notifications/{notificationId}/read
5. POST /events/mobile-log

Autenticacion:

1. Header Authorization: Bearer <firebase_id_token>
2. Token obtenido de la sesion Firebase del usuario.

## 5. Flujo operativo recomendado (simple)

1. Usuario entra a la web en WebView y se autentica.
2. Web detecta AndroidBridge.
3. Web pide permiso push + token FCM por bridge.
4. Web registra el device en /api/v1/devices/register.
5. Backend envia push FCM.
6. APK abre URL con notificationId.
7. Web marca opened en /api/v1/notifications/{id}/opened.

## 6. Reglas de datos y seguridad ya alineadas

Archivo: firestore.rules

Ya existen reglas para:

1. users/{userId}/devices
2. users/{userId}/notifications (solo read/opened desde cliente)
3. users/{userId}/mobile_logs

Esto permite separar:

1. Escritura de notificaciones desde backend trusted.
2. Confirmacion opened/read desde clientes autenticados.

## 7. Mejoras simples y utiles para la APK (alineadas a tu idea)

1. Deep link estandar
Formato recomendado: https://tu-dominio/ruta?notificationId=<id>&source=android_push

2. Reintento de bridge
Si app.getPushToken falla, reintentar 1 vez luego de 3 segundos.

3. Cola offline minima
Guardar localmente eventos opened/read y enviarlos al recuperar red.

4. User-Agent identificable
Agregar sufijo en WebView, por ejemplo CabineGridAndroid/1.0, para analitica y debugging.

5. Log tecnico minimo
Enviar mobile-log en estos casos: app_open, bridge_error, push_opened, push_register_failed.

## 8. Checklist para pasar al programador APK

1. Implementar AndroidBridge con postMessage y respuesta a onNativeMessage.
2. Implementar acciones app.getPushToken, app.getDeviceInfo, app.requestNotificationPermission.
3. Abrir pushes con query notificationId.
4. Asegurar que WebView conserve sesion (cookies/storage habilitados).
5. Permitir solo dominios oficiales de TaskMe.
6. Agregar logica de reintento simple para token push.
7. Reportar errores al endpoint /api/v1/events/mobile-log.

## 9. Resumen ejecutivo

La web ya esta preparada para conectarse con una APK WebView mejorada. El trabajo principal en Android es implementar bien el bridge, el flujo de push y la apertura por deep link con notificationId. Con eso, la conexion web-app queda operativa, trazable y lista para evolucionar.
