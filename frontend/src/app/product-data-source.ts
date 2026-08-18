import type { IDataSource } from 'bi-interfaces';
import type { PublicApiClient } from '@salesbuzz/public-sdk';
import type { DataResult } from '@progress/kendo-data-query';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { productColumns } from './product-columns';
import type { Product } from './product.model';

interface ODataResponse<T> {
  value: T[];
  '@odata.count': number;
}

type GridDataResult = DataResult;

export class ProductDataSource extends BehaviorSubject<GridDataResult> implements IDataSource {
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
  excludeDataFromReq: string[] = [];
  excludeTimeFromReq: string[] = [];

  constructor(private readonly client: PublicApiClient) {
    super({ data: [], total: 0 });
  }

  read(filter: string): void {
    this.loading = true;
    this.client
      .get<ODataResponse<Product>>(this.formatAPIURLWithFilter(filter))
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((response) => {
        this.data = response.value;
        this.next({ data: response.value, total: response['@odata.count'] });
      });
  }

  add(data: Product): Observable<Product> {
    return this.client.post<Product>(this.POSTAPIURL!, data);
  }

  edit(data: Partial<Product>, id: number | string): Observable<Product> {
    return this.patch(data, id);
  }

  patch(data: Partial<Product>, id: number | string): Observable<Product> {
    return this.client.patch<Product>(`${this.PUTAPIURL}(${id})`, data);
  }

  delete(id: number | string): Observable<unknown> {
    return this.client.delete(this.entityUrl(id));
  }

  batch(
    _createdItems: Array<unknown>,
    _updatedItems: Array<unknown>,
    _deletedItems: Array<unknown>,
  ): Observable<never> {
    return throwError(() => new Error('Batch is not used by this page.'));
  }

  get<T>(url: string): Observable<T> {
    return this.client.get<T>(url);
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
}
