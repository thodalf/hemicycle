import { ApplicationConfig, LOCALE_ID, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

// Nombres et dates à la française : « 4 000 € », pas « 4,000 € »
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    // Webapp : hors ligne et installable, seulement sur le site servi avec son manifeste
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && typeof document !== 'undefined' && !!document.querySelector('link[rel="manifest"]'),
      registrationStrategy: 'registerWhenStable:20000',
    }),
  ]
};
