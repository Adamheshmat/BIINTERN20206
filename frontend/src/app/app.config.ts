import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { MessageService } from '@progress/kendo-angular-l10n';
import { TranslateModule } from '@ngx-translate/core';
import { BIModulesModule, CreateDialog } from 'bi-modules';
import { PublicApiClient, PublicSdkModule } from '@salesbuzz/public-sdk';
import { provideRouter } from '@angular/router';

import { AppMessageService } from './app-message.service';
import { AngularPublicApiClient } from './public-api-client.service';

export function createDialogFactory(): () => CreateDialog {
  const dialog = new CreateDialog();
  return () => dialog;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter([]),
    importProvidersFrom(TranslateModule.forRoot(), PublicSdkModule, BIModulesModule),
    { provide: 'CreateDialog', useFactory: createDialogFactory },
    { provide: PublicApiClient, useClass: AngularPublicApiClient },
    { provide: MessageService, useClass: AppMessageService },
  ],
};
