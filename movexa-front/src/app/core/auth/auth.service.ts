import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse } from './auth.models';
import { environment } from '../../../environments/environment';



@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private readonly TOKEN_KEY = 'movexa_token';

  /** « username » accepte l'adresse e-mail : le gateway cherche alors le compte par e-mail */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/authenticate`, credentials).pipe(
      tap(res => this.saveToken(res.id_token, credentials.rememberMe))
    );
  }

  /**
   * Envoie l'e-mail de réinitialisation. Le gateway répond toujours 200,
   * même si l'adresse est inconnue (on ne révèle pas quels comptes existent).
   */
  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/account/reset-password/init`, email, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  /** Enregistre le nouveau mot de passe avec la clé reçue par e-mail (valable 24 h) */
  finishPasswordReset(key: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/account/reset-password/finish`, {
      key,
      newPassword,
    });
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY) ?? sessionStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null;
  }

  private saveToken(token: string, rememberMe: boolean): void {
    this.logout(); // nettoie l'ancien token
    (rememberMe ? localStorage : sessionStorage).setItem(this.TOKEN_KEY, token);
  }
}
