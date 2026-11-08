import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const ONBOARDED_KEY = 'cmp_onboarded';

export const onboardingGuard: CanActivateFn = () => {
  if (localStorage.getItem(ONBOARDED_KEY) || inject(AuthService).loggedIn()) return true;
  return inject(Router).createUrlTree(['/welcome']);
};

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.loggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { next: state.url } });
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() ? true : inject(Router).createUrlTree(['/home']);
};
