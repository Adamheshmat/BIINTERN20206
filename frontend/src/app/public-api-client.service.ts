import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { PublicApiClient, PublicApiRequestOptions } from '@salesbuzz/public-sdk';

function toHttpOptions(options?: PublicApiRequestOptions) {
  let params = new HttpParams();

  for (const [key, value] of Object.entries(options?.params ?? {})) {
    if (value !== null && value !== undefined) {
      params = params.set(key, String(value));
    }
  }

  return {
    headers: options?.headers,
    params,
    withCredentials: options?.withAuth,
  };
}

@Injectable()
export class AngularPublicApiClient extends PublicApiClient {
  constructor(private readonly http: HttpClient) {
    super();
  }

  get<T>(url: string, options?: PublicApiRequestOptions) {
    return this.http.get<T>(url, toHttpOptions(options));
  }

  post<T>(url: string, body: unknown, options?: PublicApiRequestOptions) {
    return this.http.post<T>(url, body, toHttpOptions(options));
  }

  put<T>(url: string, body: unknown, options?: PublicApiRequestOptions) {
    return this.http.put<T>(url, body, toHttpOptions(options));
  }

  patch<T>(url: string, body: unknown, options?: PublicApiRequestOptions) {
    return this.http.patch<T>(url, body, toHttpOptions(options));
  }

  delete<T>(url: string, options?: PublicApiRequestOptions) {
    return this.http.delete<T>(url, toHttpOptions(options));
  }
}
