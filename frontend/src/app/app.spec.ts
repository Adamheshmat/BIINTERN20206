import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { BiNavComponent } from 'bi-modules';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthSession } from './auth.models';
import { AUTH_SESSION_KEY } from './auth.service';
import { App } from './app';

const adminSession: AuthSession = {
  token: 'admin-token',
  expiresAt: '2099-12-31T23:59:59.000Z',
  user: { userName: 'admin', role: 'admin', buid: 'C100' },
  permissions: { canRead: true, canCreate: true, canUpdate: true, canDelete: true },
};

const viewerSession: AuthSession = {
  token: 'viewer-token',
  expiresAt: '2099-12-31T23:59:59.000Z',
  user: { userName: 'viewer', role: 'viewer', buid: 'C200' },
  permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
};

describe('App', () => {
  let client: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  async function configure(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: PublicApiClient, useValue: client }],
    }).compileComponents();
  }

  function createFixture(): ReturnType<typeof TestBed.createComponent<App>> {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    sessionStorage.clear();
    client = {
      get: vi.fn(() => of({ value: [], '@odata.count': 0 })),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  it('shows only the login form and does not read products without a stored session', async () => {
    await configure();
    const fixture = createFixture();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.debugElement.query(By.directive(BiNavComponent))).toBeNull();
    expect(fixture.nativeElement.querySelector('BI-Grid')).toBeNull();
    expect(client.get).not.toHaveBeenCalled();
  });

  it('submits trimmed admin credentials, shows pending, and reads the first page once after login', async () => {
    const response = new Subject<AuthSession>();
    client.post.mockReturnValue(response.asObservable());
    await configure();
    const fixture = createFixture();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const userName = fixture.nativeElement.querySelector('#userName') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;

    userName.value = '  admin  ';
    password.value = 'secret';
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(client.post).toHaveBeenCalledExactlyOnceWith('/Auth/Login', {
      userName: 'admin',
      password: 'secret',
    });
    expect(fixture.nativeElement.querySelector('button[type="submit"]')?.textContent.trim()).toBe(
      'Signing in…',
    );

    response.next(adminSession);
    response.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent.trim()).toBe('Products');
    expect(client.get).toHaveBeenCalledExactlyOnceWith(
      '/Products?$skip=0&$top=10&$count=true',
    );
  });

  it('keeps the login form visible and explains unauthorized login failures', async () => {
    client.post.mockReturnValue(throwError(() => ({ status: 401 })));
    await configure();
    const fixture = createFixture();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;

    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent.trim()).toBe(
      'Invalid username or password.',
    );
  });

  it('shows the admin account summary and grants all BI navigation mutations to an Admin', async () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(adminSession));
    await configure();
    const fixture = createFixture();
    const navigation = fixture.debugElement.query(By.directive(BiNavComponent))
      .componentInstance as BiNavComponent;

    expect(fixture.nativeElement.querySelector('.session-bar strong')?.textContent).toBe('admin');
    expect(
      Array.from(fixture.nativeElement.querySelectorAll('.session-bar span'), (span: Element) =>
        span.textContent?.trim(),
      ),
    ).toEqual(['admin', 'BU C100']);
    expect(navigation.CanInsert).toBe(true);
    expect(navigation.CanUpdate).toBe(true);
    expect(navigation.CanDelete).toBe(true);
  });

  it('shows the viewer account summary and makes BI navigation read-only for a Viewer', async () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(viewerSession));
    await configure();
    const fixture = createFixture();
    const navigation = fixture.debugElement.query(By.directive(BiNavComponent))
      .componentInstance as BiNavComponent;

    expect(fixture.nativeElement.querySelector('.session-bar strong')?.textContent).toBe('viewer');
    expect(
      Array.from(fixture.nativeElement.querySelectorAll('.session-bar span'), (span: Element) =>
        span.textContent?.trim(),
      ),
    ).toEqual(['viewer', 'BU C200']);
    expect(navigation.CanInsert).toBe(false);
    expect(navigation.CanUpdate).toBe(false);
    expect(navigation.CanDelete).toBe(false);
  });

  it('clears the Products UI and returns to login after logout', async () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(adminSession));
    await configure();
    const fixture = createFixture();

    (fixture.nativeElement.querySelector('.session-bar button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.debugElement.query(By.directive(BiNavComponent))).toBeNull();
    expect(fixture.componentInstance.dataSource.value).toEqual({ data: [], total: 0 });
  });

  it('preserves escaped search requests and data-source errors after login', async () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(adminSession));
    client.get.mockReturnValue(throwError(() => new Error('offline')));
    client.post.mockReturnValue(throwError(() => new Error('write failed')));
    await configure();
    const fixture = createFixture();

    expect(fixture.nativeElement.querySelector('.message')?.textContent.trim()).toBe(
      'Unable to load products. Please try again.',
    );

    const search = fixture.nativeElement.querySelector(
      'input[aria-label="Search products"]',
    ) as HTMLInputElement;
    search.value = "  Bob's Coffee  ";
    search.dispatchEvent(new Event('input'));
    expect(client.get).toHaveBeenLastCalledWith(
      "/Products?$filter=contains(Name,'Bob''s Coffee')&$skip=0&$top=10&$count=true",
    );

    fixture.componentInstance.dataSource.add({
      Id: 0,
      Name: 'New product',
      Price: 1,
      StockQuantity: 1,
      IsActive: true,
    }).subscribe({ error: () => undefined });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.message')?.textContent.trim()).toBe(
      'Unable to save product. Please try again.',
    );
  });
});
