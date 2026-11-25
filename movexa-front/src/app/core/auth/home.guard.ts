import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { CurrentUserStore } from './current-user.store';

/** Page d'arrivée selon le rôle : tableau de bord (gérant), accès et présence (accueil), prospects (commercial). */
export function homePath(store: CurrentUserStore): string {
  if (store.isManager()) return '/dashboard';
  if (store.isDesk()) return '/access';
  return '/prospects';
}

/** Route « /home » : redirige chacun vers sa page d'arrivée (après connexion, ou quand une page lui est interdite). */
export const homeGuard: CanActivateFn = (): UrlTree => inject(Router).createUrlTree([homePath(inject(CurrentUserStore))]);
