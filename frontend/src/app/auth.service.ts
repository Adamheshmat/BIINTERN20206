import { computed, inject, Injectable, signal } from '@angular/core';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { Observable, tap } from 'rxjs';

import type { AuthSession } from './auth.models';

export const AUTH_SESSION_KEY = 'sdk-product-crud.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = inject(PublicApiClient);
  private readonly sessionState = signal<AuthSession | null>(this.restore());
  readonly session = this.sessionState.asReadonly();
  readonly token = computed(() => this.sessionState()?.token ?? null);

  login(userName: string, password: string): Observable<AuthSession> {
    return this.client
      .post<AuthSession>('/Auth/Login', { userName, password })
      .pipe(tap((session) => this.store(session)));
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    this.sessionState.set(null);
  }

  private store(session: AuthSession): void {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    this.sessionState.set(session);
  }

  private restore(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw) as AuthSession;
      const expiresAt = Date.parse(session.expiresAt);
      if (!session.token || Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        return null;
      }

      return session;
    } catch {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
  }
}
