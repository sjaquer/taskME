'use client';

/**
 * useGoogleCalendar — Google Calendar read + push sync hook
 *
 * Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local
 *
 * Setup in Google Cloud Console:
 *  1. Enable "Google Calendar API"
 *  2. Create OAuth 2.0 credentials (Web application)
 *  3. Add Authorized JS origins: http://localhost:3000 (+ production URL)
 *  4. Copy the Client ID to NEXT_PUBLIC_GOOGLE_CLIENT_ID
 */

import { useState, useEffect, useCallback } from 'react';
import { addDays, format, isSameDay, parseISO } from 'date-fns';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const STORAGE_KEY = 'taskme_gcal_token';
const GIS_SCRIPT_ID = 'gsi-client-script';

type GoogleCalendarActionResult = {
  ok: boolean;
  message?: string;
};

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
}

interface StoredToken {
  access_token: string;
  expires_at: number;
}

type GisTokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

type GisOAuth2 = {
  initTokenClient: (opts: object) => GisTokenClient;
  revoke?: (token: string, done?: () => void) => void;
};

function storeToken(token: string, expiresIn: number) {
  const data: StoredToken = {
    access_token: token,
    expires_at: Date.now() + expiresIn * 1000,
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function loadToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: StoredToken = JSON.parse(raw);
    // Expire 90 seconds early to avoid edge-case races
    if (Date.now() >= data.expires_at - 90_000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data.access_token;
  } catch { return null; }
}

function clearToken() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

function getNextDateString(dateString: string) {
  return format(addDays(new Date(`${dateString}T00:00:00`), 1), 'yyyy-MM-dd');
}

function getConfigMessage() {
  return 'Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID en .env.local.';
}

function getGoogleAuthMessage(error?: string) {
  switch (error) {
    case 'popup_closed':
      return 'Cerraste la ventana de Google antes de completar la autorización.';
    case 'popup_failed_to_open':
      return 'El navegador bloqueó la ventana emergente de Google. Permite popups e inténtalo otra vez.';
    case 'access_denied':
      return 'La cuenta rechazó el permiso para sincronizar Google Calendar.';
    case 'idpiframe_initialization_failed':
      return 'Google no pudo inicializar la autenticación. Revisa orígenes autorizados y cookies del navegador.';
    case 'immediate_failed':
      return 'Google no pudo reutilizar la sesión actual. Vuelve a intentar la conexión.';
    default:
      return 'No se pudo completar la autorización con Google Calendar.';
  }
}

async function getCalendarApiErrorMessage(response: Response) {
  try {
    const data = await response.json();
    const message = data?.error?.message;
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // ignore JSON parsing failures and fall back to status-based message
  }

  if (response.status === 401) return 'La sesión de Google expiró. Vuelve a conectar la cuenta.';
  if (response.status === 403) return 'Google rechazó la solicitud. Revisa el permiso calendar.events y que tu cuenta esté como usuario de prueba.';
  return `Google Calendar devolvió error ${response.status}.`;
}

function getGis() {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    google?: {
      accounts?: {
        oauth2?: GisOAuth2;
      };
    };
  };
  return w.google?.accounts?.oauth2 ?? null;
}

export function useGoogleCalendar() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const fetchEvents = useCallback(async (token: string) => {
    setIsSyncing(true);
    setError(null);
    try {
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString();
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 401) {
        clearToken();
        setAccessToken(null);
        setGoogleEvents([]);
        setError('La sesión de Google expiró. Vuelve a conectar la cuenta.');
        return { ok: false, message: 'La sesión de Google expiró. Vuelve a conectar la cuenta.' } satisfies GoogleCalendarActionResult;
      }
      if (!res.ok) {
        const message = await getCalendarApiErrorMessage(res);
        setError(message);
        return { ok: false, message } satisfies GoogleCalendarActionResult;
      }
      const data = await res.json();
      setGoogleEvents((data.items as GoogleCalendarEvent[]) ?? []);
      setLastSyncedAt(Date.now());
      return { ok: true } satisfies GoogleCalendarActionResult;
    } catch (e) {
      console.error('[TaskMe] Google Calendar sync error:', e);
      setError('No se pudieron sincronizar los eventos de Google Calendar.');
      return { ok: false, message: 'No se pudieron sincronizar los eventos de Google Calendar.' } satisfies GoogleCalendarActionResult;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Restore persisted token on mount
  useEffect(() => {
    const token = loadToken();
    if (token) {
      setAccessToken(token);
      fetchEvents(token);
    }
  }, [fetchEvents]);

  // Inject GIS script once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!clientId) {
      setIsReady(false);
      setError(getConfigMessage());
      return;
    }

    if (getGis()) {
      setIsReady(true);
      setError(null);
      return;
    }

    const onLoad = () => {
      setIsReady(true);
      setError(null);
    };

    const onError = () => {
      setIsReady(false);
      setError('No se pudo cargar Google Identity Services.');
    };

    const existingScript = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', onLoad);
      existingScript.addEventListener('error', onError);
      return () => {
        existingScript.removeEventListener('load', onLoad);
        existingScript.removeEventListener('error', onError);
      };
    }

    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
  }, [clientId]);

  const connect = useCallback(async (): Promise<GoogleCalendarActionResult> => {
    if (!clientId) {
      const message = getConfigMessage();
      console.warn('[TaskMe] Configura NEXT_PUBLIC_GOOGLE_CLIENT_ID en .env.local para usar Google Calendar');
      setError(message);
      return { ok: false, message };
    }

    setIsConnecting(true);
    setError(null);

    return new Promise<GoogleCalendarActionResult>((resolve) => {
      let isResolved = false;

      const finish = (result: GoogleCalendarActionResult) => {
        if (isResolved) return;
        isResolved = true;
        setIsConnecting(false);
        resolve(result);
      };

      const tryInit = (): boolean => {
        const oauth2 = getGis();
        if (!oauth2) return false;

        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: async (response: { error?: string; access_token?: string; expires_in?: number }) => {
            if (response.error || !response.access_token || !response.expires_in) {
              const message = getGoogleAuthMessage(response.error);
              setError(message);
              finish({ ok: false, message });
              return;
            }

            storeToken(response.access_token, response.expires_in);
            setAccessToken(response.access_token);
            const syncResult = await fetchEvents(response.access_token);
            if (!syncResult.ok) {
              finish(syncResult);
              return;
            }

            finish({ ok: true });
          },
        });

        client.requestAccessToken({ prompt: 'consent' });
        return true;
      };

      if (tryInit()) return;

      let attempts = 0;
      const poll = setInterval(() => {
        if (tryInit()) {
          clearInterval(poll);
          return;
        }

        attempts += 1;
        if (attempts > 25) {
          clearInterval(poll);
          const message = 'Google Identity Services no terminó de cargar. Revisa tu conexión e inténtalo otra vez.';
          setError(message);
          finish({ ok: false, message });
        }
      }, 300);
    });
  }, [clientId, fetchEvents]);

  const pushEvent = useCallback(async (event: {
    title: string;
    description?: string;
    location?: string;
    allDay: boolean;
    startISO: string;
    endISO: string;
    startDate: string;
    endDate: string;
  }) => {
    if (!accessToken) {
      return { ok: false, message: 'Primero debes conectar Google Calendar.' } satisfies GoogleCalendarActionResult;
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const body: Record<string, unknown> = {
      summary: event.title,
    };

    if (event.allDay) {
      body.start = { date: event.startDate };
      body.end = { date: getNextDateString(event.endDate) };
    } else {
      body.start = { dateTime: event.startISO, timeZone: tz };
      body.end = { dateTime: event.endISO, timeZone: tz };
    }

    if (event.location) body.location = event.location;
    if (event.description) body.description = event.description;

    try {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const message = await getCalendarApiErrorMessage(res);
        setError(message);
        return { ok: false, message } satisfies GoogleCalendarActionResult;
      }

      await fetchEvents(accessToken);
      return { ok: true } satisfies GoogleCalendarActionResult;
    } catch (e) {
      console.error('[TaskMe] Google Calendar push error:', e);
      setError('No se pudo crear el evento en Google Calendar.');
      return { ok: false, message: 'No se pudo crear el evento en Google Calendar.' } satisfies GoogleCalendarActionResult;
    }
  }, [accessToken, fetchEvents]);

  const syncNow = useCallback(async () => {
    if (!accessToken) {
      return { ok: false, message: 'Primero debes conectar Google Calendar.' } satisfies GoogleCalendarActionResult;
    }

    return fetchEvents(accessToken);
  }, [accessToken, fetchEvents]);

  const disconnect = useCallback(() => {
    const oauth2 = getGis();
    if (accessToken && oauth2?.revoke) {
      oauth2.revoke(accessToken, () => undefined);
    }

    clearToken();
    setAccessToken(null);
    setGoogleEvents([]);
    setLastSyncedAt(null);
    setError(null);
  }, [accessToken]);

  /**
   * Filter Google events for a given day (handles both dateTime and all-day events)
   */
  const getEventsForDay = useCallback((day: Date): GoogleCalendarEvent[] => {
    return googleEvents.filter((ev) => {
      const d = ev.start.dateTime
        ? parseISO(ev.start.dateTime)
        : ev.start.date
        ? new Date(ev.start.date + 'T00:00:00')
        : null;
      return d ? isSameDay(d, day) : false;
    });
  }, [googleEvents]);

  return {
    isConnected: !!accessToken,
    isSyncing,
    isConnecting,
    isReady,
    hasClientId: !!clientId,
    error,
    lastSyncedAt,
    googleEvents,
    getEventsForDay,
    connect,
    pushEvent,
    syncNow,
    disconnect,
  };
}
