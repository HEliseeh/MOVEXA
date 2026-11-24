import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthLayout } from '../auth-layout/auth-layout';
import { PASSWORD_MAX_LENGTH, PASSWORD_RULES, passwordPolicyValidator } from '../password-policy';

const passwordsMatch = (group: AbstractControl): ValidationErrors | null =>
  group.get('newPassword')?.value === group.get('confirmPassword')?.value ? null : { mismatch: true };

/**
 * Étape 2 : ouverte depuis le lien de l'e-mail (/account/reset/finish?key=…),
 * la personne choisit son nouveau mot de passe.
 */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout],
  templateUrl: './reset-password.html',
  styleUrls: ['../auth-form.css'],
})
export class ResetPassword {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  readonly key = inject(ActivatedRoute).snapshot.queryParamMap.get('key');

  loading = signal(false);
  done = signal(false);
  showPassword = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.nonNullable.group(
    {
      newPassword: [
        '',
        [Validators.required, Validators.maxLength(PASSWORD_MAX_LENGTH), passwordPolicyValidator],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  private readonly newPassword = toSignal(this.form.controls.newPassword.valueChanges, {
    initialValue: '',
  });

  /** Liste des règles, cochées au fur et à mesure de la saisie */
  readonly rules = computed(() => {
    const value = this.newPassword();
    return PASSWORD_RULES.map(r => ({ label: r.label, ok: r.test(value) }));
  });

  submit(): void {
    if (!this.key) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.finishPasswordReset(this.key, this.form.getRawValue().newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.done.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.status === 400 && err.error?.title?.includes('password')
            ? 'Le mot de passe ne respecte pas les règles demandées.'
            : 'Ce lien a expiré ou a déjà servi. Demande un nouveau lien.',
        );
      },
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }
}
