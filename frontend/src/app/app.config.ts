import { DecimalPipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  importProvidersFrom,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { MessageService } from '@progress/kendo-angular-l10n';
import { TranslateModule } from '@ngx-translate/core';
import { BIModulesModule, CreateDialog } from 'bi-modules';
import { PublicApiClient, PublicSdkModule } from '@salesbuzz/public-sdk';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { AppMessageService } from './app-message.service';
import { AngularPublicApiClient } from './public-api-client.service';

export function createDialogFactory(): () => CreateDialog {
  const dialog = new CreateDialog();
  return () => dialog;
}

export function defaultLocaleFactory(): string {
  const language = localStorage.getItem('lang');
  if (language) return language;

  localStorage.setItem('lang', 'en-US');
  return 'en-US';
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideRouter([]),
    importProvidersFrom(TranslateModule.forRoot(), PublicSdkModule, BIModulesModule),
    { provide: LOCALE_ID, useFactory: defaultLocaleFactory },
    { provide: 'CreateDialog', useFactory: createDialogFactory },
    { provide: PublicApiClient, useClass: AngularPublicApiClient },
    { provide: MessageService, useClass: AppMessageService },
    DecimalPipe,
  ],
};
