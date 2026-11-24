import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { switchMap } from 'rxjs';
import { CurrentUserStore } from '@core/auth/current-user.store';
import { AuthLayout } from '../auth-layout/auth-layout';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout],
  templateUrl: './login.html',
  styleUrls: ['../auth-form.css', './login.css'],
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private store = inject(CurrentUserStore);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [true],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password, rememberMe } = this.form.getRawValue();
    this.auth
      // Le gateway reconnaît une adresse e-mail dans « username » et cherche le compte par e-mail
      .login({ username: email.trim(), password, rememberMe })
      .pipe(switchMap(() => this.store.load(true)))
      .subscribe({
        next: () => {
          this.loading.set(false);
          if (!this.store.isStaff()) {
            this.auth.logout();
            this.store.clear();
            this.errorMessage.set('Ce compte n’a pas accès à MOVEXA. Demandez au gérant de vous attribuer un rôle.');
            return;
          }
          this.router.navigate(['/reception']);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.auth.logout();
          this.store.clear();
          this.errorMessage.set(
            err.status === 401
              ? 'Adresse e-mail ou mot de passe incorrect.'
              : 'Connexion impossible. Réessaie plus tard.'
          );
        },
      });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }
}
