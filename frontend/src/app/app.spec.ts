import { TestBed } from '@angular/core/testing';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './app';

describe('App', () => {
  afterEach(() => TestBed.resetTestingModule());

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: PublicApiClient,
          useValue: {
            get: vi.fn(() => of({ value: [], '@odata.count': 0 })),
            post: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  it('starts the initial counted first-page read exactly once', () => {
    const fixture = TestBed.createComponent(App);
    const client = TestBed.inject(PublicApiClient);

    fixture.detectChanges();

    expect(client.get).toHaveBeenCalledExactlyOnceWith(
      '/Products?$skip=0&$top=10&$count=true',
    );
  });

  it('shows data-source read and mutation failures in the page message area', () => {
    const client = TestBed.inject(PublicApiClient);
    vi.mocked(client.get).mockReturnValue(throwError(() => new Error('offline')));
    vi.mocked(client.post).mockReturnValue(throwError(() => new Error('write failed')));
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.message')?.textContent.trim()).toBe(
      'Unable to load products. Please try again.',
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
