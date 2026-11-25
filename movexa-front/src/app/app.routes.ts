import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { roleGuard } from '@core/auth/role.guard';

/**
 * Droits par page (le serveur applique les mêmes règles) :
 * - gérant : tout ;
 * - réceptionniste : accueil, pointage, encaissements, abonnements, membres, prospects, relances ;
 * - commercial : membres, prospects, relances (pas de caisse ni de pointage).
 * Sans le rôle, on est renvoyé vers « fallback ».
 */
const MANAGER_ONLY = { roles: ['ROLE_ADMIN'], fallback: '/reception' };
/** Travail d'accueil : le commercial est renvoyé vers ses prospects */
const DESK = { roles: ['ROLE_ADMIN', 'ROLE_RECEPTION'], fallback: '/prospects' };

export const routes: Routes = [
  // ---- Pages publiques ----
  {
    path: 'login',
    loadComponent: () => import('@features/auth/login/login').then(m => m.Login),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('@features/auth/forgot-password/forgot-password').then(m => m.ForgotPassword),
  },
  {
    // Chemin du lien envoyé par le gateway (templates/mail/passwordResetEmail.html)
    path: 'account/reset/finish',
    loadComponent: () =>
      import('@features/auth/reset-password/reset-password').then(m => m.ResetPassword),
  },

  // ---- Pages envoyées au membre par WhatsApp (sans compte, sans menu) ----
  {
    path: 'carte/:token',
    loadComponent: () => import('@features/public/member-card/member-card').then(m => m.MemberCard),
  },
  {
    path: 'recu/:token',
    loadComponent: () => import('@features/public/public-receipt/public-receipt').then(m => m.PublicReceiptPage),
  },

  // ---- Zone authentifiée (layout avec menu) ----
  {
    path: '',
    loadComponent: () => import('./layouts/connected/connected-layout').then(m => m.ConnectedLayout),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: MANAGER_ONLY,
        loadComponent: () => import('@features/dashboard/dashboard').then(m => m.Dashboard),
      },
      {
        path: 'reception',
        canActivate: [roleGuard],
        data: DESK,
        loadComponent: () => import('@features/reception/reception').then(m => m.Reception),
      },
      {
        path: 'access',
        canActivate: [roleGuard],
        data: DESK,
        loadComponent: () => import('@features/access/access').then(m => m.Access),
      },
      {
        path: 'payments',
        canActivate: [roleGuard],
        data: DESK,
        loadComponent: () => import('@features/payments/payments').then(m => m.Payments),
      },
      {
        path: 'members',
        loadComponent: () => import('@features/members/members').then(m => m.Members),
      },
      {
        path: 'members/import',
        canActivate: [roleGuard],
        data: { roles: ['ROLE_ADMIN'], fallback: '/members' },
        loadComponent: () => import('@features/members/member-import/member-import').then(m => m.MemberImport),
      },
      {
        path: 'members/:id',
        loadComponent: () => import('@features/members/member-detail/member-detail').then(m => m.MemberDetail),
      },
      {
        path: 'prospects',
        loadComponent: () => import('@features/prospects/prospects').then(m => m.Prospects),
      },
      {
        path: 'subscriptions',
        canActivate: [roleGuard],
        data: DESK,
        loadComponent: () => import('@features/subscriptions/subscriptions').then(m => m.Subscriptions),
      },
      {
        path: 'planning',
        canActivate: [roleGuard],
        data: DESK,
        loadComponent: () => import('@features/planning/planning').then(m => m.Planning),
      },
      {
        path: 'plans',
        canActivate: [roleGuard],
        data: MANAGER_ONLY,
        loadComponent: () => import('@features/plans/plans').then(m => m.Plans),
      },
      {
        path: 'team',
        canActivate: [roleGuard],
        data: MANAGER_ONLY,
        loadComponent: () => import('@features/team/team').then(m => m.Team),
      },
      {
        path: 'coaches',
        canActivate: [roleGuard],
        data: MANAGER_ONLY,
        loadComponent: () => import('@features/coaches/coaches').then(m => m.Coaches),
      },
      {
        path: 'reminders',
        loadComponent: () => import('@features/reminders/reminders').then(m => m.Reminders),
      },
      {
        path: 'receipts/:id',
        canActivate: [roleGuard],
        data: DESK,
        loadComponent: () => import('@features/payments/receipt/receipt').then(m => m.ReceiptPage),
      },
      {
        // Gérant : gestion + commercial ; commercial : partie commerciale seulement
        path: 'stats',
        canActivate: [roleGuard],
        data: { roles: ['ROLE_ADMIN', 'ROLE_COMMERCIAL'], fallback: '/reception' },
        loadComponent: () => import('@features/stats/stats').then(m => m.Stats),
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: MANAGER_ONLY,
        loadComponent: () => import('@features/settings/settings').then(m => m.Settings),
      },
      {
        path: 'forbidden',
        loadComponent: () => import('@features/forbidden/forbidden').then(m => m.Forbidden),
      },

      // Tout le monde arrive sur l'accueil (le tableau de bord reste dans le menu du gérant)
      { path: '', redirectTo: 'reception', pathMatch: 'full' },
    ],
  },

  // ---- Fallback global ----
  { path: '**', redirectTo: 'login' },
];
