import { Component } from '@angular/core';
import { StaffAccounts } from './staff-accounts/staff-accounts';

/**
 * Équipe et rôles (gérant uniquement) : comptes de l'équipe, rôle de chacun
 * (gérant, réceptionniste, commercial) et ce que chaque rôle peut faire.
 * Les coachs, qui n'ont pas de compte, sont gérés dans « Cours et coachs ».
 */
@Component({
  selector: 'app-team',
  imports: [StaffAccounts],
  template: `
    <div class="page-sheet">
      <header class="sheet-header">
        <h1 class="page-title">Équipe et rôles</h1>
        <p class="help">
          Chaque rôle voit tout le menu, mais les modules non autorisés sont grisés.
          Désactiver un compte bloque la connexion sans effacer son historique.
        </p>
      </header>
      <div class="team-body">
        <app-staff-accounts />
      </div>
    </div>
  `,
  styles: `
    .team-body { padding: var(--space-4) var(--space-6, 32px) var(--space-6, 32px); }
    .sheet-header .help { margin: 4px 0 0; }
  `,
})
export class Team {}
