'use client';

// La redirección a la "Página de inicio" elegida en Ajustes solo debe ocurrir una
// vez por arranque de la app. Después, navegar a "/" muestra el Dashboard.
let launchRedirectConsumed = false;

/** Devuelve true solo la primera vez que se llama en esta sesión de la app. */
export function consumeLaunchRedirect(): boolean {
  if (launchRedirectConsumed) return false;
  launchRedirectConsumed = true;
  return true;
}
