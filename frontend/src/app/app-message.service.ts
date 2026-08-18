import { Injectable } from '@angular/core';
import { MessageService } from '@progress/kendo-angular-l10n';

@Injectable()
export class AppMessageService extends MessageService {
  override get(key: string): string {
    return key;
  }
}
