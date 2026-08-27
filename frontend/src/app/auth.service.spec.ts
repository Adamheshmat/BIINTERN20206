import { TestBed } from '@angular/core/testing';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from './auth.models';
import { AuthService, AUTH_SESSION_KEY } from './auth.service';

const session: AuthSession = {
  token: 'test-token',
  expiresAt: '2099-12-31T23:59:59.000Z',
  user: { userName: 'admin', role: 'admin', buid: 'C100' },
  permissions: { canRead: true, canCreate: true, canUpdate: true, canDelete: true },
};

class RecordingPublicApiClient extends PublicApiClient {
  request: { url: string; body: unknown } | undefined;

  override get<T>() {
    return of(undefined as T);
  }

  override post<T>(url: string, body: unknown) {
    this.request = { url, body };
    return of(session as T);
  }

  override put<T>() {
    return of(undefined as T);
  }

  override patch<T>() {
    return of(undefined as T);
  }

  override delete<T>() {
    return of(undefined as T);
  }
}

describe('AuthService', () => {
  let client: RecordingPublicApiClient;

  beforeEach(() => {
    sessionStorage.clear();
    client = new RecordingPublicApiClient();
    TestBed.configureTestingModule({
      providers: [{ provide: PublicApiClient, useValue: client }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  it('stores the login response and exposes it as the current session', () => {
    const auth = TestBed.inject(AuthService);

    auth.login('admin', 'secret').subscribe();

    expect(client.request).toEqual({
      url: '/Auth/Login',
      body: { userName: 'admin', password: 'secret' },
    });
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBe(JSON.stringify(session));
    expect(auth.session()).toEqual(session);
    expect(auth.token()).toBe('test-token');
  });

  it('restores a non-expired stored session during construction', () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));

    const auth = TestBed.inject(AuthService);

    expect(auth.session()).toEqual(session);
    expect(auth.token()).toBe('test-token');
  });

  it.each([
    ['expired', JSON.stringify({ ...session, expiresAt: '2020-01-01T00:00:00.000Z' })],
    ['invalid expiry', JSON.stringify({ ...session, expiresAt: 'not-an-iso-date' })],
    ['malformed', '{not valid json'],
  ])('removes a %s stored session during construction', (_, storedSession) => {
    sessionStorage.setItem(AUTH_SESSION_KEY, storedSession);

    const auth = TestBed.inject(AuthService);

    expect(auth.session()).toBeNull();
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
  });

  it('clears the session and storage on logout', () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    const auth = TestBed.inject(AuthService);

    auth.logout();

    expect(auth.session()).toBeNull();
    expect(auth.token()).toBeNull();
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
  });
});
