import type { IDataSource } from 'bi-interfaces';
import type { PublicApiClient } from '@salesbuzz/public-sdk';
import type { DataResult } from '@progress/kendo-data-query';
import { signal } from '@angular/core';
import { BehaviorSubject, catchError, Observable, throwError } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';

import { productColumns } from './product-columns';
import type { Product } from './product.model';

interface ODataResponse<T> {
  value: T[];
  '@odata.count': number;
}

type GridDataResult = DataResult;
export type ProductNotice = { kind: 'success' | 'error'; text: string };

export class ProductDataSource extends BehaviorSubject<GridDataResult> implements IDataSource {
  readonly errorMessage = signal('');
  readonly notice = signal<ProductNotice | null>(null);
  readonly isLoading = signal(false);
  readonly mutationVersion = signal(0);

  Key = 'Id';
  Key2 = '';
  Key3 = '';
  Key4 = '';
  Key5 = '';
  Key6 = '';
  APIURL = '/Products';
  POSTAPIURL = '/Products';
  PUTAPIURL = '/Products';
  DELETEAPIURL = '/Products';
  Columns = productColumns;
  Params = [];
  Type: IDataSource['Type'] = 'OData' as IDataSource['Type'];
  IsClientSideFilter = false;
  LocalData = false;
  data: Product[] = [];
  HasPaging = true;
  state = { skip: 0, take: 10, sort: [] as [] };
  loading = false;
  excludeDataFromReq: string[] = ['Status'];
  excludeTimeFromReq: string[] = [];

  constructor(private readonly client: PublicApiClient) {
    super({ data: [], total: 0 });
  }

  read(filter: string): void {
    this.clearErrorState();
    this.loading = true;
    this.isLoading.set(true);
    this.client
      .get<ODataResponse<Product>>(this.formatAPIURLWithFilter(filter))
      .pipe(finalize(() => {
        this.loading = false;
        this.isLoading.set(false);
      }))
      .subscribe({
        next: (response) => {
          const products = response.value.map((product) => ({
            ...product,
            Status: product.IsActive ? 'Active' as const : 'Inactive' as const,
          }));
          this.data = products;
          this.next({ data: products, total: response['@odata.count'] });
        },
        error: () => this.reportError('Unable to load products. Please try again.'),
      });
  }

  add(data: Product): Observable<Product> {
    return this.reportWriteResult(
      this.client.post<Product>(this.POSTAPIURL!, data),
      'Product added successfully.',
    );
  }

  edit(data: Partial<Product>, id: number | string): Observable<Product> {
    return this.patch(data, id);
  }

  patch(data: Partial<Product>, id: number | string): Observable<Product> {
    return this.reportWriteResult(
      this.client.patch<Product>(`${this.PUTAPIURL}(${id})`, data),
      'Product updated successfully.',
    );
  }

  delete(id: number | string): Observable<unknown> {
    return this.reportWriteResult(
      this.client.delete(this.entityUrl(id)),
      'Product deleted successfully.',
    );
  }

  batch(
    _createdItems: Array<unknown>,
    _updatedItems: Array<unknown>,
    _deletedItems: Array<unknown>,
  ): Observable<never> {
    return throwError(() => new Error('Batch is not used by this page.'));
  }

  get<T>(url: string): Observable<T> {
    this.clearErrorState();
    return this.client.get<T>(url).pipe(
      map((response) => this.decorateProductResponse(response)),
      catchError((error: unknown) => {
        this.reportError('Unable to load products. Please try again.');
        return throwError(() => error);
      }),
    );
  }

  formatAPIURLWithFilter(filter: string): string {
    return filter ? `${this.APIURL}?${filter}` : this.APIURL;
  }

  formatFilter(filter: string): string {
    return filter;
  }

  private entityUrl(id: number | string): string {
    return `${this.DELETEAPIURL}(${id})`;
  }

  private reportWriteResult<T>(request: Observable<T>, successMessage: string): Observable<T> {
    this.errorMessage.set('');
    this.notice.set(null);
    return request.pipe(
      tap(() => {
        this.notice.set({ kind: 'success', text: successMessage });
        this.mutationVersion.update((version) => version + 1);
      }),
      catchError((error: unknown) => {
        this.reportError('Unable to save product. Please try again.');
        return throwError(() => error);
      }),
    );
  }

  private reportError(message: string): void {
    this.errorMessage.set(message);
    this.notice.set({ kind: 'error', text: message });
  }

  private clearErrorState(): void {
    this.errorMessage.set('');
    if (this.notice()?.kind === 'error') this.notice.set(null);
  }

  private decorateProductResponse<T>(response: T): T {
    if (!response || typeof response !== 'object') return response;

    const candidate = response as Record<string, unknown>;
    if (Array.isArray(candidate['value'])) {
      return {
        ...candidate,
        value: candidate['value'].map((item) => this.decorateProduct(item)),
      } as T;
    }

    return this.decorateProduct(candidate) as T;
  }

  private decorateProduct(product: unknown): unknown {
    if (!product || typeof product !== 'object' || !('IsActive' in product)) return product;
    const candidate = product as Product;
    return { ...candidate, Status: candidate.IsActive ? 'Active' : 'Inactive' };
  }
}
