import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from './loading.service';

/** Requête « silencieuse » : pas de loader (recherche pendant la frappe, synchronisation en arrière-plan) */
export const SILENT_REQUEST = new HttpContextToken<boolean>(() => false);

/** À passer en option d'une requête : this.http.get(url, { context: silent() }) */
export function silent(): HttpContext {
  return new HttpContext().set(SILENT_REQUEST, true);
}

/** Toute requête (sauf silencieuse) active le chargement global jusqu'à sa fin, succès ou erreur. */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SILENT_REQUEST)) return next(req);
  const loading = inject(LoadingService);
  loading.begin();
  return next(req).pipe(finalize(() => loading.end()));
};
