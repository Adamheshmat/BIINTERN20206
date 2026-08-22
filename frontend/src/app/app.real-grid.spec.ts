import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { BIGridComponent, BiNavComponent, CreateDialog } from 'bi-modules';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './app';
import { appConfig } from './app.config';

globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

describe('App with the shipped BI Grid package', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('connects the shipped BI navigation to the grid and renders all product headers', async () => {
    const client = {
      get: vi.fn(() => of({ value: [], '@odata.count': 0 })),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        ...appConfig.providers,
        { provide: PublicApiClient, useValue: client },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

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
});
