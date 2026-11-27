import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { AuthLayout } from '../auth-layout/auth-layout';

/** Étape 1 : la personne donne son adresse, le gateway lui envoie un lien par e-mail. */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout],
  templateUrl: './forgot-password.html',
  styleUrls: ['../auth-form.css'],
})
export class ForgotPassword {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  loading = signal(false);
  /** Adresse à laquelle le lien a été envoyé (affiche l'écran de confirmation) */
  sentTo = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.form.getRawValue().email.trim();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.requestPasswordReset(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.sentTo.set(email);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set("L'envoi a échoué. Réessaie dans un instant.");
      },
    });
  }

  /** Revenir au formulaire pour corriger l'adresse ou renvoyer le lien */
  retry(): void {
    this.sentTo.set(null);
  }
}
