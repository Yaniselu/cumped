import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { I18n } from './i18n.service';

/** Atașează token-ul doar pe cererile către API-ul nostru și reîncearcă o dată după refresh la 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const i18n = inject(I18n);
  if (!req.url.includes('/api/') || req.url.includes('/api/auth/login') || req.url.includes('/api/auth/register')
      || req.url.includes('/api/auth/refresh')) {
    return next(req);
  }
  const withToken = (r: HttpRequest<unknown>) => {
    const token = auth.accessToken();
    let headers = r.headers.set('Accept-Language', i18n.lang());
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    if (r.url.includes('/api/auth/')) headers = headers.set('X-Requested-With', 'cumped');
    return r.clone({ headers, withCredentials: r.url.includes('/api/auth/') });
  };
  return next(withToken(req)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || !auth.accessToken()) return throwError(() => err);
      return from(auth.refresh()).pipe(switchMap((ok) => (ok ? next(withToken(req)) : throwError(() => err))));
    }),
  );
};
