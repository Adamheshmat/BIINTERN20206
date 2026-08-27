import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { BIGridComponent, BiNavComponent, CreateDialog } from 'bi-modules';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthSession } from './auth.models';
import { AUTH_SESSION_KEY } from './auth.service';
import { App } from './app';
import { appConfig } from './app.config';

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

globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

describe('App with the shipped BI Grid package', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  beforeEach(() => sessionStorage.clear());

  async function createFixture(session: AuthSession) {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    const client = {
      get: vi.fn(() => of({ value: [], '@odata.count': 0 })),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [...appConfig.providers, { provide: PublicApiClient, useValue: client }],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, client };
  }

  it('connects the shipped BI navigation to the grid and renders all product headers', async () => {
    const { fixture, client } = await createFixture(adminSession);

    const grid = fixture.debugElement.query(By.directive(BIGridComponent))
      .componentInstance as BIGridComponent;
    const navigationElement = fixture.debugElement.query(By.directive(BiNavComponent));
    const navigation = navigationElement.componentInstance as BiNavComponent;
    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('.k-column-title'),
      (header: Element) => header.textContent?.trim(),
    ).filter(Boolean);
    const navigationButtons = Array.from(
      navigationElement.nativeElement.querySelectorAll('button[id]'),
      (button: Element) => button.id,
    );

    expect(grid.customizeColumnsDialog).toBeInstanceOf(CreateDialog);
    expect(navigation.BIGrid).toBe(grid);
    expect(navigation.CanInsert).toBe(true);
    expect(navigation.CanUpdate).toBe(true);
    expect(navigation.CanDelete).toBe(true);
    expect(navigationButtons).toEqual([
      'Add_ProductsNav',
      'Save_ProductsNav',
      'Delete_ProductsNav',
      'Cancel_ProductsNav',
    ]);
    expect(headers).toEqual(['Id', 'Product Name', 'Price', 'Stock Quantity', 'Active']);
    expect(client.get).toHaveBeenCalledExactlyOnceWith(
      '/Products?$skip=0&$top=10&$count=true',
    );
  });

  it('passes read-only mutation permissions to the shipped BI navigation for a Viewer', async () => {
    const { fixture } = await createFixture(viewerSession);
    const navigation = fixture.debugElement.query(By.directive(BiNavComponent))
      .componentInstance as BiNavComponent;

    expect(navigation.CanInsert).toBe(false);
    expect(navigation.CanUpdate).toBe(false);
    expect(navigation.CanDelete).toBe(false);
  });
});
