import { Component, EventEmitter, Input, NgModule, Output } from '@angular/core';

@Component({
  selector: 'BI-Grid',
  standalone: true,
  template: '',
})
export class BIGridComponent {
  @Input() DataService: unknown;
  @Input() changeSet: unknown;
  @Input() Columns: unknown;
  @Input() GridName = '';
  @Input() DomID = '';
  @Input() HasPaging = false;

  @Output() readonly RowChange = new EventEmitter<unknown>();
  @Output() readonly AfterSave = new EventEmitter<unknown>();
  @Output() readonly AfterAdd = new EventEmitter<unknown>();

  readonly calls: string[] = [];
  rowValue: Record<string, unknown> = {};

  AddRow(): void {
    this.calls.push('AddRow');
  }

  EnableDisable_columns(columns: string[], editable: boolean): void {
    this.calls.push(`EnableDisable_columns:${columns.join(',')}:${editable}`);
  }

  Save(): void {
    this.calls.push('Save');
  }

  DeleteRow(): void {
    this.calls.push('DeleteRow');
  }

  Cancel(): void {
    this.calls.push('Cancel');
  }

  GetRowValue(): Record<string, unknown> {
    return this.rowValue;
  }
}

@NgModule({
  imports: [BIGridComponent],
  exports: [BIGridComponent],
})
export class BIModulesModule {}
