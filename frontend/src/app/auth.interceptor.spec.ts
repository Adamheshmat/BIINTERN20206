import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from './auth.models';
import { authInterceptor } from './auth.interceptor';
import { AuthService, AUTH_SESSION_KEY } from './auth.service';

const session: AuthSession = {
  token: 'test-token',
  expiresAt: '2099-12-31T23:59:59.000Z',
  user: { userName: 'admin', role: 'admin', buid: 'C100' },
  permissions: { canRead: true, canCreate: true, canUpdate: true, canDelete: true },
};

const client = {
  get: <T>() => of(undefined as T),
  post: <T>() => of(undefined as T),
  put: <T>() => of(undefined as T),
  patch: <T>() => of(undefined as T),
  delete: <T>() => of(undefined as T),
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PublicApiClient, useValue: client },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  it('adds the bearer token to product requests when a session exists', () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PublicApiClient, useValue: client },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);

    http.get('/Products').subscribe();

    const request = httpTesting.expectOne('/Products');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ value: [] });
  });

  it('does not add authorization to login requests', () => {
    http.post('/Auth/Login', { userName: 'admin', password: 'secret' }).subscribe();

    const request = httpTesting.expectOne('/Auth/Login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(session);
  });

  it('does not add authorization to an absolute external request', () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PublicApiClient, useValue: client },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);

    http.get('https://example.com/status').subscribe();

    const request = httpTesting.expectOne('https://example.com/status');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ ok: true });
  });

  it('leaves requests unchanged without a session', () => {
    http.get('/Products').subscribe();

    const request = httpTesting.expectOne('/Products');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ value: [] });
  });

  it('clears the session after an unauthorized non-login request', () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PublicApiClient, useValue: client },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);

    let received: unknown;
    http.get('/Products').subscribe({ error: (error) => (received = error) });

    const request = httpTesting.expectOne('/Products');
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(received).toHaveProperty('status', 401);
    expect(auth.session()).toBeNull();
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
  });

  it('preserves the session and login error after an unauthorized login request', () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PublicApiClient, useValue: client },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    let received: unknown;

    http.post('/Auth/Login', { userName: 'admin', password: 'secret' }).subscribe({
      error: (error) => (received = error),
    });

    const request = httpTesting.expectOne('/Auth/Login');
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(received).toHaveProperty('status', 401);
    expect(auth.session()).toEqual(session);
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBe(JSON.stringify(session));
  });

  it('preserves the session after an unauthorized external request', () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PublicApiClient, useValue: client },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);

    http.get('https://example.com/status').subscribe({ error: () => undefined });

    const request = httpTesting.expectOne('https://example.com/status');
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.session()).toEqual(session);
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBe(JSON.stringify(session));
  });
});
