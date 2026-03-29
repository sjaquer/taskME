# Cabine Grid - Especificacion Tecnica App Android (WebView+)

## 1) Objetivo
Definir una app Android basada en WebView (no nativa full) pero con capacidades profesionales para superar las limitaciones clasicas:
- Push notifications nativas (FCM), incluso con app cerrada.
- Integracion segura Web <-> Android via bridge.
- Deep links y apertura contextual de pantallas.
- Sincronizacion estable de sesion, datos y estado de notificaciones.
- Telemetria, seguridad y estrategia de escalado.

---

## 2) Alcance funcional
La app Android sera un contenedor WebView avanzado de la plataforma web Cabine Grid, manteniendo:
- UX web central para features existentes.
- Capacidades nativas puntuales donde WebView no alcanza.

Incluye:
- Login y sesion persistente.
- Modulos web existentes (kanban, calendario, schedule, settings).
- Push nativo y centro de notificaciones sincronizado.
- Cache offline basico para carga inicial y reconexion.

No incluye en esta fase:
- Reescritura completa en Kotlin/Compose.
- Replica nativa de todas las pantallas web.

---

## 3) Arquitectura objetivo (WebView+)

### 3.1 Capas
1. Capa Web (Next.js actual)
- UI principal y reglas de negocio existentes.
- Endpoints API y servicios Firebase.

2. Capa Android Shell (Kotlin)
- Activity principal con WebView.
- Gestion de permisos, push FCM, deep links.
- Bridge seguro para exponer capacidades nativas al JS.

3. Capa Backend/Servicios
- Firebase Auth + Firestore + Cloud Messaging.
- Endpoint de registro de dispositivo para push.
- Orquestacion de eventos de notificacion.

### 3.2 Flujo de alto nivel
1. Usuario inicia sesion en web embebida.
2. Android obtiene token FCM y registra dispositivo en backend.
3. Backend asocia usuario <-> dispositivo <-> token.
4. Evento de dominio (ej. tarea por vencer) dispara push.
5. Push abre app y navega a URL interna via deep link.
6. WebView consume payload y actualiza UI/estado.

---

## 4) Stack tecnologico recomendado

### Web
- Next.js + TypeScript.
- Firebase Auth, Firestore, Cloud Functions.
- Service Worker (canal web push opcional).
- API facade en rutas server-side para logica sensible.

### Android (APK)
- Kotlin.
- AndroidX WebKit + WebView.
- Firebase Messaging.
- OkHttp (opcional para endpoints nativos).
- DataStore o SharedPreferences cifradas.
- WorkManager para retries en background.

### Build y distribucion
- Gradle Kotlin DSL.
- Flavors: dev/staging/prod.
- Firma release + Play Integrity recomendado.

---

## 5) Especificacion WebView profesional

### 5.1 Configuracion WebView minima
- JavaScript habilitado.
- DomStorage habilitado.
- Mixed content bloqueado en prod.
- File access deshabilitado cuando no sea requerido.
- Safe Browsing habilitado.
- User-Agent custom para deteccion controlada del shell Android.

### 5.2 Politica de navegacion
Permitir solo dominios confiables:
- https://cabinegrid.com
- https://www.cabinegrid.com
- Subdominios autorizados de entorno.

Regla:
- URL interna: abrir en el mismo WebView.
- URL externa: abrir con intent del sistema.

### 5.3 Sesion y cookies
- CookieManager con third-party cookies solo si es necesario.
- Persistencia de sesion con expiracion controlada.
- Logout web debe disparar limpieza de token local nativo.

---

## 6) Bridge seguro Android <-> Web

### 6.1 Principios
- Nada de exponer metodos sensibles en global sin validacion.
- Bridge habilitado solo en dominios allowlist.
- Cada mensaje JS debe incluir:
  - action
  - requestId
  - timestamp
  - payload
- Respuesta nativa con:
  - requestId
  - ok
  - data o error

### 6.2 Acciones del bridge (v1)
1. app.getDeviceInfo
2. app.getPushToken
3. app.requestNotificationPermission
4. app.openExternalUrl
5. app.vibrate
6. app.share
7. app.logEvent

### 6.3 Ejemplo web (JS) para invocar bridge
```ts
// src/lib/native-bridge.ts
export type NativeRequest = {
  action: string;
  requestId: string;
  timestamp: number;
  payload?: Record<string, unknown>;
};

export function callNative(action: string, payload: Record<string, unknown> = {}) {
  const request: NativeRequest = {
    action,
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    payload,
  };

  // Android inyecta window.AndroidBridge.postMessage
  const bridge = (window as any)?.AndroidBridge;
  if (!bridge?.postMessage) {
    throw new Error("Android bridge no disponible");
  }

  bridge.postMessage(JSON.stringify(request));
  return request.requestId;
}
```

### 6.4 Ejemplo web para recibir respuestas nativas
```ts
// src/lib/native-bridge-listener.ts
export function registerNativeResponseListener(
  onMessage: (msg: any) => void
) {
  (window as any).onNativeMessage = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      onMessage(parsed);
    } catch {
      // opcional: loggear parse error
    }
  };
}
```

---

## 7) Push notifications nativas + sincronizacion web

### 7.1 Objetivo
Unificar notificaciones del sistema Android con el centro de notificaciones web para evitar inconsistencias y duplicados.

### 7.2 Modelo de datos recomendado
Coleccion: users/{userId}/devices/{deviceId}
- platform: "android" | "web"
- pushToken: string
- appVersion: string
- osVersion: string
- locale: string
- timezone: string
- lastSeenAt: timestamp
- isActive: boolean

Coleccion: users/{userId}/notifications/{notificationId}
- type: "task_due" | "event_reminder" | "system"
- title: string
- body: string
- deepLink: string
- dedupeKey: string
- createdAt: timestamp
- sentAt: timestamp | null
- readAt: timestamp | null

### 7.3 Flujo recomendado
1. Android obtiene FCM token.
2. WebView (via bridge) entrega user context al shell.
3. Shell registra token en endpoint seguro.
4. Backend emite push por evento de negocio.
5. Al tocar push:
- Abre app.
- Carga URL deepLink en WebView.
- Marca notificacion como opened.
6. Web sincroniza y refleja estado read/opened.

### 7.4 Endpoint de registro de dispositivo
POST /api/v1/devices/register
Headers:
- Authorization: Bearer <firebase_id_token>
Body:
- platform: "android"
- pushToken: string
- appVersion: string
- osVersion: string
- deviceModel: string
- locale: string
- timezone: string

Response 200:
- ok: true
- deviceId: string

### 7.5 Ejemplo web para solicitar registro push nativo
```ts
// src/components/notification-setup.tsx (idea de integracion)
import { callNative } from "@/lib/native-bridge";

export async function ensureNativePushRegistration() {
  try {
    // 1) pedir permiso desde shell nativo
    callNative("app.requestNotificationPermission");

    // 2) pedir token
    const requestId = callNative("app.getPushToken");

    // 3) cuando llegue respuesta en onNativeMessage,
    // enviar token al backend con sesion web actual
    return requestId;
  } catch {
    return null;
  }
}
```

---

## 8) API y contratos recomendados

### 8.1 Convenciones
- Versionado por prefijo: /api/v1
- Auth: Firebase ID token
- Errores estandar:
  - code: string
  - message: string
  - details?: object

### 8.2 Endpoints clave
1. POST /api/v1/devices/register
2. DELETE /api/v1/devices/{deviceId}
3. GET /api/v1/notifications?limit=50&cursor=...
4. POST /api/v1/notifications/{id}/read
5. POST /api/v1/notifications/{id}/opened
6. POST /api/v1/events/mobile-log

### 8.3 Campos recomendados para trazabilidad
- correlationId (request)
- source: "web" | "android"
- appBuild
- clientTimestamp

---

## 9) Seguridad

### 9.1 Reglas base
- No hardcodear secrets en APK ni en JS cliente.
- Validar ID token en backend siempre.
- Bridge solo en origenes permitidos.
- Desactivar debugging WebView en build release.
- Certificate pinning opcional para endpoints criticos.

### 9.2 Riesgos y mitigaciones
1. Riesgo: inyeccion JS en WebView.
- Mitigar con CSP estricta + dominio allowlist + bridge cerrado.

2. Riesgo: robo de token push.
- Mitigar con registro autenticado y rotacion por logout.

3. Riesgo: phishing por navegacion externa.
- Mitigar con validacion de URL y apertura externa controlada.

---

## 10) Rendimiento y resiliencia

1. Carga inicial:
- Splash nativo corto + precarga URL principal.

2. Offline:
- Pagina offline local HTML como fallback.
- Reintento de carga con backoff.

3. Crash handling:
- Captura de errores en WebChromeClient/WebViewClient.
- Reporte a Crashlytics.

4. Observabilidad:
- Eventos: app_open, push_received, push_opened, webview_error, bridge_error.

---

## 11) Plan de implementacion por fases

### Fase 1 - Shell WebView seguro
- Proyecto Android base + WebView hardening.
- Navegacion controlada y deep links.
- Integracion de sesion basica.

### Fase 2 - Bridge v1
- Contrato JSON request/response.
- Acciones basicas (device info, open url, share).
- Listener JS en web.

### Fase 3 - Push nativo
- FCM + registro de token + endpoint backend.
- Apertura contextual por deepLink.
- Estado opened/read sincronizado.

### Fase 4 - Calidad productiva
- Telemetria y crash monitoring.
- Pruebas E2E Android + smoke tests web.
- Hardening release y checklist Play Store.

---

## 12) Criterios de aceptacion

1. La app recibe push nativo con app en foreground/background/killed.
2. Al tocar notificacion, abre pantalla web correcta en menos de 2.5s (p95).
3. No hay duplicados de notificacion para un mismo dedupeKey.
4. Logout invalida sesion y token asociado del dispositivo.
5. Bridge rechaza mensajes desde origen no permitido.
6. Tasa de crash < 1% en primera release interna.

---

## 13) Checklist tecnico para desarrollador

- [ ] Crear app Android shell con flavors dev/staging/prod.
- [ ] Configurar WebView con seguridad recomendada.
- [ ] Implementar deep links y politica de navegacion.
- [ ] Implementar bridge JSON con requestId.
- [ ] Integrar FCM y ciclo de vida de token.
- [ ] Crear endpoint /api/v1/devices/register.
- [ ] Persistir devices en Firestore por usuario.
- [ ] Implementar envio push por eventos de negocio.
- [ ] Sincronizar estados read/opened en coleccion notifications.
- [ ] Instrumentar telemetria y errores.

---

## 14) Nota de evolucion futura
Cuando se detecten cuellos de UX/rendimiento en modulos especificos (por ejemplo calendario o kanban), migrar ese modulo a pantalla nativa Compose sin descartar el enfoque WebView+ del resto de la app. Esto permite evolucion gradual y control de costos.
