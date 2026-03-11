'use client';

/**
 * useGoogleCalendar — Google Calendar bidirectional sync hook
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
import { isSameDay, parseISO } from 'date-fns';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const STORAGE_KEY = 'taskme_gcal_token';

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

function getGis() {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (opts: object) => GisTokenClient;
        };
      };
    };
  };
  return w.google?.accounts?.oauth2 ?? null;
}

export function useGoogleCalendar() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const fetchEvents = useCallback(async (token: string) => {
    setIsSyncing(true);
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
        return;
      }
      if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
      const data = await res.json();
      setGoogleEvents((data.items as GoogleCalendarEvent[]) ?? []);
    } catch (e) {
      console.error('[TaskMe] Google Calendar sync error:', e);
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
    if (!clientId || typeof window === 'undefined') return;
    if (document.getElementById('gsi-client-script')) return;
    const script = document.createElement('script');
    script.id = 'gsi-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    document.head.appendChild(script);
  }, [clientId]);

  const connect = useCallback(() => {
    if (!clientId) {
      console.warn('[TaskMe] Configura NEXT_PUBLIC_GOOGLE_CLIENT_ID en .env.local para usar Google Calendar');
      return;
    }

    const tryInit = (): boolean => {
      const oauth2 = getGis();
      if (!oauth2) return false;
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response: { error?: string; access_token: string; expires_in: number }) => {
          if (response.error) return;
          storeToken(response.access_token, response.expires_in);
          setAccessToken(response.access_token);
          fetchEvents(response.access_token);
        },
      });
      // Use empty prompt to try silently first, but popup if needed
      client.requestAccessToken({ prompt: '' });
      return true;
    };

    if (!tryInit()) {
      let attempts = 0;
      const poll = setInterval(() => {
        if (tryInit() || ++attempts > 25) clearInterval(poll);
      }, 300);
    }
  }, [clientId, fetchEvents]);

  const pushEvent = useCallback(async (event: {
    title: string;
    startISO: string;
    location?: string;
  }) => {
    if (!accessToken) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const endISO = new Date(new Date(event.startISO).getTime() + 3_600_000).toISOString();
    const body: Record<string, unknown> = {
      summary: event.title,
      start: { dateTime: event.startISO, timeZone: tz },
      end: { dateTime: endISO, timeZone: tz },
    };
    if (event.location) body.location = event.location;

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
      if (res.ok) fetchEvents(accessToken);
    } catch (e) {
      console.error('[TaskMe] Google Calendar push error:', e);
    }
  }, [accessToken, fetchEvents]);

  const syncNow = useCallback(() => {
    if (accessToken) fetchEvents(accessToken);
  }, [accessToken, fetchEvents]);

  const disconnect = useCallback(() => {
    clearToken();
    setAccessToken(null);
    setGoogleEvents([]);
  }, []);

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
    googleEvents,
    getEventsForDay,
    connect,
    pushEvent,
    syncNow,
    disconnect,
  };
}
