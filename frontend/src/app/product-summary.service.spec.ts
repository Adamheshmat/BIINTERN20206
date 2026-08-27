import { TestBed } from '@angular/core/testing';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProductSummary } from './product-summary.service';
import { ProductSummaryService } from './product-summary.service';

const summary: ProductSummary = {
  productCount: 3,
  totalInventoryValue: 259,
  activeProductCount: 2,
  lowStockProductCount: 1,
};

describe('ProductSummaryService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('loads the current-BU summary and exposes loading state', () => {
    const response = new Subject<ProductSummary>();
    const client = { get: vi.fn(() => response.asObservable()) };
    TestBed.configureTestingModule({
      providers: [ProductSummaryService, { provide: PublicApiClient, useValue: client }],
    });
    const service = TestBed.inject(ProductSummaryService);

    service.load();
    expect(service.loading()).toBe(true);

    response.next(summary);
    response.complete();

    expect(client.get).toHaveBeenCalledExactlyOnceWith('/ProductSummary');
    expect(service.summary()).toEqual(summary);
    expect(service.loading()).toBe(false);
    expect(service.errorMessage()).toBe('');
  });

  it('reports a summary failure without discarding the last successful values', () => {
    const client = { get: vi.fn(() => of(summary)) };
    TestBed.configureTestingModule({
      providers: [ProductSummaryService, { provide: PublicApiClient, useValue: client }],
    });
    const service = TestBed.inject(ProductSummaryService);
    service.load();

    client.get.mockReturnValueOnce(throwError(() => new Error('offline')));
    service.load();

    expect(service.summary()).toEqual(summary);
    expect(service.loading()).toBe(false);
    expect(service.errorMessage()).toBe('Unable to load the product summary.');
  });

  it('ignores an older response after a newer summary load starts', () => {
    const first = new Subject<ProductSummary>();
    const second = new Subject<ProductSummary>();
    const client = { get: vi.fn()
      .mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(second.asObservable()) };
    TestBed.configureTestingModule({
      providers: [ProductSummaryService, { provide: PublicApiClient, useValue: client }],
    });
    const service = TestBed.inject(ProductSummaryService);
    service.load();
    service.load();

    first.next(summary);
    first.complete();
    expect(service.summary().productCount).toBe(0);
    expect(service.loading()).toBe(true);

    second.next({ ...summary, productCount: 2, totalInventoryValue: 157.5 });
    second.complete();
    expect(service.summary().productCount).toBe(2);
    expect(service.loading()).toBe(false);
  });

  it('ignores a response that arrives after logout reset', () => {
    const response = new Subject<ProductSummary>();
    const client = { get: vi.fn(() => response.asObservable()) };
    TestBed.configureTestingModule({
      providers: [ProductSummaryService, { provide: PublicApiClient, useValue: client }],
    });
    const service = TestBed.inject(ProductSummaryService);
    service.load();
    service.reset();

    response.next(summary);
    response.complete();

    expect(service.summary().productCount).toBe(0);
    expect(service.loading()).toBe(false);
  });
});
