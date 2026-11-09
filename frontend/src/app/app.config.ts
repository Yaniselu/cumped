import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { RouteReuseStrategy } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { AuthService } from './core/auth.service';
import { I18n } from './core/i18n.service';
import { Theme } from './core/theme.service';
import { registerIcons } from './core/icons';
import { cumpedNavAnimation } from './core/nav-animation';
import { Motion } from './core/motion.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'ios', swipeBackEnabled: true, navAnimation: cumpedNavAnimation }),
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => {
      const theme = inject(Theme), i18n = inject(I18n), auth = inject(AuthService), motion = inject(Motion);
      registerIcons();
      theme.init();
      motion.init();
      // Refracția SVG pe fundal funcționează doar în motoarele Chromium.
      const ua = navigator.userAgent;
      if (/Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua)) document.documentElement.classList.add('lg-refract');
      return i18n.init().then(() => auth.init());
    }),
  ],
};
