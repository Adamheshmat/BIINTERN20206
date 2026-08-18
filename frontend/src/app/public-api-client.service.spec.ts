import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AngularPublicApiClient } from './public-api-client.service';

describe('AngularPublicApiClient', () => {
  let client: AngularPublicApiClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = new AngularPublicApiClient(TestBed.inject(HttpClient));
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('forwards a PATCH body and request options to HttpClient', () => {
    const body = { name: 'Updated product' };
    const options = {
      headers: { 'X-Request-Id': 'adapter-test' },
      params: { includeInactive: false },
    };

    client.patch<{ id: number }>('/Products(1)', body, options).subscribe();

    const request = httpTesting.expectOne('/Products(1)?includeInactive=false');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('X-Request-Id')).toBe('adapter-test');
    request.flush({ id: 1 });
  });
});
