import { DataTypes } from 'bi-interfaces';
import type { PublicApiClient } from '@salesbuzz/public-sdk';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { Product } from './product.model';
import { ProductDataSource } from './product-data-source';

const product: Product = {
  Id: 3,
  Name: 'Widget',
  Price: 12.5,
  StockQuantity: 8,
  IsActive: true,
};

function createClient() {
  return {
    get: vi.fn((url: string) =>
      of(
        url === '/Products?$skip=0&$top=10&$count=true'
          ? { value: [product], '@odata.count': 1 }
          : { value: [product] },
      ),
    ),
    post: vi.fn(() => of(product)),
    put: vi.fn(() => of(product)),
    patch: vi.fn(() => of(product)),
    delete: vi.fn(() => of(undefined)),
  } as unknown as PublicApiClient;
}

describe('ProductDataSource', () => {
  it('reads an OData result into the grid data result', () => {
    const client = createClient();
    const source = new ProductDataSource(client);

    source.read('$skip=0&$top=10&$count=true');

    expect(client.get).toHaveBeenCalledWith('/Products?$skip=0&$top=10&$count=true');
    expect(source.getValue()).toEqual({ data: [product], total: 1 });
  });

  it('posts a new product to the Products collection', () => {
    const client = createClient();
    const source = new ProductDataSource(client);

    source.add(product).subscribe((response) => expect(response).toEqual(product));

    expect(client.post).toHaveBeenCalledWith('/Products', product);
  });

  it('patches a product at its OData entity URL', () => {
    const client = createClient();
    const source = new ProductDataSource(client);
    const changes = { Name: 'Updated widget' };

    source.patch(changes, 3).subscribe((response) => expect(response).toEqual(product));

    expect(client.patch).toHaveBeenCalledWith('/Products(3)', changes);
  });

  it('deletes a product at its OData entity URL', () => {
    const client = createClient();
    const source = new ProductDataSource(client);

    source.delete(3).subscribe();

    expect(client.delete).toHaveBeenCalledWith('/Products(3)');
  });

  it('gets the supplied URL without changing it', () => {
    const client = createClient();
    const source = new ProductDataSource(client);
    const url = '/Products?$filter=Id eq 3';

    source.get(url).subscribe((response) => expect(response).toEqual({ value: [product] }));

    expect(client.get).toHaveBeenCalledWith(url);
  });

  it('reports a failed entity refresh while preserving the original error', () => {
    const client = createClient();
    const failure = new Error('refresh failed');
    vi.mocked(client.get).mockReturnValueOnce(throwError(() => failure));
    const source = new ProductDataSource(client);
    let received: unknown;

    source.get('/Products?$filter=Id eq 3').subscribe({ error: (error) => (received = error) });

    expect(received).toBe(failure);
    expect(source.errorMessage()).toBe('Unable to load products. Please try again.');
  });

  it('defines the five BI Grid columns for the PascalCase product fields', () => {
    const source = new ProductDataSource(createClient());

    expect(source.Columns.map((column) => column.Name)).toEqual([
      'Id',
      'Name',
      'Price',
      'StockQuantity',
      'IsActive',
    ]);
    expect(source.Columns.map((column) => column.DataType)).toEqual([
      DataTypes.NUMERIC,
      DataTypes.Text,
      DataTypes.NUMERIC,
      DataTypes.NUMERIC,
      DataTypes.Boolean,
    ]);
    expect(source.Columns.map((column) => column.controlType)).toEqual([
      'numeric',
      'text',
      'numeric',
      'numeric',
      'boolean',
    ]);
    expect(source.Columns.map((column) => column.DisplayName)).toEqual([
      'Id',
      'Product Name',
      'Price',
      'Stock Quantity',
      'Active',
    ]);
    expect(source.Columns[0].IsEditable).toBe(false);
    expect(source.Columns[4].DefaultValue).toBe(true);

    const nameValidators = source.Columns[1].Validators!;
    const priceValidators = source.Columns[2].Validators!;
    const stockValidators = source.Columns[3].Validators!;

    expect(nameValidators[0]({ value: '' } as never)).toEqual({ required: true });
    expect(priceValidators[0]({ value: null } as never)).toEqual({ required: true });
    expect(priceValidators[1]({ value: -1 } as never)).toEqual({ min: { min: 0, actual: -1 } });
    expect(stockValidators[1]({ value: -1 } as never)).toEqual({ min: { min: 0, actual: -1 } });
  });

  it('reports a read failure without ending the data stream so a later read can retry', () => {
    const client = createClient();
    vi.mocked(client.get)
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ value: [product], '@odata.count': 1 }));
    const source = new ProductDataSource(client);

    source.read('$skip=0&$top=10&$count=true');
    expect(source.errorMessage()).toBe('Unable to load products. Please try again.');

    source.read('$skip=0&$top=10&$count=true');
    expect(source.errorMessage()).toBe('');
    expect(source.getValue()).toEqual({ data: [product], total: 1 });
  });

  it.each([
    ['add', (source: ProductDataSource) => source.add(product), 'post'],
    ['patch', (source: ProductDataSource) => source.patch({ Price: 13 }, 3), 'patch'],
    ['delete', (source: ProductDataSource) => source.delete(3), 'delete'],
  ] as const)('reports a failed %s mutation while preserving the original error', (_, mutate, method) => {
    const client = createClient();
    const failure = new Error('write failed');
    vi.mocked(client[method]).mockReturnValueOnce(throwError(() => failure));
    const source = new ProductDataSource(client);
    let received: unknown;

    mutate(source).subscribe({ error: (error) => (received = error) });

    expect(received).toBe(failure);
    expect(source.errorMessage()).toBe('Unable to save product. Please try again.');
  });
});
