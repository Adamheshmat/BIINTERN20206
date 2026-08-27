import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const isProtectedApiRequest = /^\/Products(?:$|[?(])/.test(request.url);
  const token = auth.token();
  const authorizedRequest = isProtectedApiRequest && token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (isProtectedApiRequest && error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout();
      }

      return throwError(() => error);
    }),
  );
};
