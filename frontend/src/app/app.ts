import { Component, DestroyRef, inject, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BIGridComponent, BIModulesModule } from 'bi-modules';
import type { IChangeset } from 'bi-interfaces';
import { PublicApiClient } from '@salesbuzz/public-sdk';

import { productColumns } from './product-columns';
import { ProductDataSource } from './product-data-source';

const editableFields = ['Name', 'Price', 'StockQuantity', 'IsActive'];

@Component({
  selector: 'app-root',
  imports: [BIModulesModule],
  template: `
    <main class="page">
      <h1>Products</h1>

      <div class="toolbar" aria-label="Product actions">
        <button type="button" (click)="add()">Add</button>
        <button type="button" (click)="edit()">Edit</button>
        <button type="button" (click)="save()">Save</button>
        <button type="button" (click)="remove()">Delete</button>
        <button type="button" (click)="cancel()">Cancel</button>
      </div>

      @if (message) {
        <p class="message" aria-live="polite">{{ message }}</p>
      }

      <BI-Grid
        #grid
        [DataService]="dataSource"
        [Columns]="columns"
        [changeSet]="changeSet"
        [GridName]="'Products'"
        [DomID]="'ProductsGrid'"
        [HasPaging]="true"
        (RowChange)="onRowChange()"
        (AfterSave)="onSaved()"
        (AfterAdd)="onAdded()"
      ></BI-Grid>
    </main>
  `,
  styles: [],
})
export class App {
  @ViewChild('grid') grid!: BIGridComponent;

  private readonly destroyRef = inject(DestroyRef);
  readonly dataSource = new ProductDataSource(inject(PublicApiClient));
  readonly columns = productColumns.map((column) => ({ ...column, IsEditable: false }));
  readonly changeSet: IChangeset = { changesetArr: [] };

  message = '';
  private hasPersistedSelection = false;
  private changeActive = false;
  private deletePending = false;

  constructor() {
    this.dataSource.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.deletePending) {
        this.deletePending = false;
        this.hasPersistedSelection = false;
        this.message = 'Product deleted.';
      }
    });
  }

  add(): void {
    if (this.changeActive) {
      this.message = 'Finish the current change first.';
      return;
    }

    this.changeActive = true;
    this.grid.AddRow();
    this.setEditable(true);
    this.message = 'Adding product.';
  }

  edit(): void {
    if (!this.hasPersistedSelection) {
      this.message = 'Select a saved product first.';
      return;
    }

    if (this.changeActive) {
      this.message = 'Finish the current change first.';
      return;
    }

    this.changeActive = true;
    this.setEditable(true);
    this.message = 'Editing product.';
  }

  save(): void {
    if (!this.changeActive) {
      this.message = 'Nothing to save.';
      return;
    }

    const hasPendingChanges = this.grid.IsDirty(this.grid.formGroups);
    this.grid.Save();

    if (!hasPendingChanges) {
      this.changeActive = false;
      this.setEditable(false);
      this.message = 'No changes to save.';
      return;
    }

    this.message = 'Saving product.';
  }

  remove(): void {
    if (this.changeActive) {
      this.message = 'Finish the current change first.';
      return;
    }

    if (!this.hasPersistedSelection) {
      this.message = 'Select a saved product first.';
      return;
    }

    if (!window.confirm('Delete this product?')) {
      return;
    }

    this.deletePending = true;
    this.grid.DeleteRow();
    this.message = 'Deleting product.';
  }

  cancel(): void {
    if (!this.changeActive) {
      this.message = 'Nothing to cancel.';
      return;
    }

    this.grid.Cancel();
    this.changeActive = false;
    this.setEditable(false);
    this.message = 'Changes cancelled.';
  }

  onRowChange(): void {
    this.refreshPersistedSelection();

    if (!this.changeActive) {
      this.setEditable(false);
    }
  }

  onSaved(): void {
    this.changeActive = false;
    this.setEditable(false);
    this.message = 'Changes saved.';
  }

  onAdded(): void {
    this.changeActive = false;
    this.refreshPersistedSelection();
    this.setEditable(false);
    this.message = 'Product added.';
  }

  private setEditable(editable: boolean): void {
    this.grid.EnableDisable_columns(editableFields, editable);
  }

  private refreshPersistedSelection(): void {
    const selectedRow = this.grid.GetRowValue();
    this.hasPersistedSelection = selectedRow?.[this.dataSource.Key] !== null
      && selectedRow?.[this.dataSource.Key] !== undefined;
  }
}
