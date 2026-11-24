import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MovexaApi } from '@core/api/movexa-api.service';
import { ToastService } from '@core/notifications/toast.service';
import { apiError } from '@shared/format';
import { PASSWORD_RULES } from '@shared/password-policy';

/** Pop-up « Changer mon mot de passe », ouverte depuis la barre du haut (tous les rôles). */
@Component({
  selector: 'app-change-password',
  imports: [FormsModule],
  template: `
    <div class="modal-backdrop" (keydown.escape)="close()">
      <form class="modal modal--s" role="dialog" aria-modal="true" aria-labelledby="cp-title" (ngSubmit)="save()">
        <header class="modal-head">
          <div class="modal-head-text"><h2 id="cp-title" class="modal-title">Changer mon mot de passe</h2></div>
        </header>
        <div class="modal-body">
          @if (error(); as e) { <div class="alert alert--error" role="alert">{{ e }}</div> }
          <div class="field">
            <label for="cp-current">Mot de passe actuel</label>
            <input id="cp-current" name="current" class="input-line" type="password" autocomplete="current-password" [(ngModel)]="current" />
          </div>
          <div class="field">
            <label for="cp-new">Nouveau mot de passe</label>
            <input id="cp-new" name="next" class="input-line" type="password" autocomplete="new-password" [(ngModel)]="next" />
            <ul class="cp-rules">
              @for (r of rules; track r.key) {
                <li [class.cp-ok]="r.test(next)">{{ r.test(next) ? '✓' : '·' }} {{ r.label }}</li>
              }
            </ul>
          </div>
          <div class="field">
            <label for="cp-confirm">Confirmer le nouveau mot de passe</label>
            <input id="cp-confirm" name="confirm" class="input-line" type="password" autocomplete="new-password" [(ngModel)]="confirm" />
          </div>
        </div>
        <footer class="modal-foot cp-foot">
          <button type="button" class="btn btn-outline" [disabled]="saving()" (click)="close()">Annuler</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </footer>
      </form>
    </div>
  `,
  styles: `
    .cp-foot { display: flex; justify-content: flex-end; gap: var(--space-2); }
    .cp-rules { margin: 6px 0 0; padding: 0; list-style: none; font-size: 0.9em; color: var(--color-text-muted); }
    .cp-ok { color: var(--color-success-strong, #15803d); }
  `,
})
export class ChangePassword {
  private readonly api = inject(MovexaApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly closed = output<void>();
  readonly rules = PASSWORD_RULES;

  current = '';
  next = '';
  confirm = '';
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  close(): void {
    if (!this.saving()) this.closed.emit();
  }

  save(): void {
    if (this.saving()) return;
    if (!this.current) return this.error.set('Saisissez votre mot de passe actuel.');
    if (PASSWORD_RULES.some(r => !r.test(this.next))) return this.error.set('Le nouveau mot de passe ne respecte pas toutes les règles.');
    if (this.next !== this.confirm) return this.error.set('Les deux nouveaux mots de passe ne sont pas identiques.');
    if (this.next === this.current) return this.error.set('Le nouveau mot de passe doit être différent de l’actuel.');

    this.saving.set(true);
    this.error.set(null);
    this.api.changeMyPassword(this.current, this.next).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Mot de passe modifié.');
        this.closed.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        // Les règles sont vérifiées avant l'envoi : un 400 du gateway veut donc dire « mot de passe actuel faux »
        this.error.set(err.status === 400 ? 'Mot de passe actuel incorrect.' : apiError(err, 'Changement impossible.'));
      },
    });
  }
}
