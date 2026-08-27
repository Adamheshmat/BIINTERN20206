import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const isLoginRequest = request.url === '/Auth/Login';
  const token = auth.token();
  const authorizedRequest = !isLoginRequest && token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (!isLoginRequest && error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout();
      }

      return throwError(() => error);
    }),
  );
};
