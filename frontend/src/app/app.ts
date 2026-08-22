import { Component, inject, OnInit } from '@angular/core';
import { BIModulesModule } from 'bi-modules';
import type { IChangeset, INavBtn } from 'bi-interfaces';
import { PublicApiClient } from '@salesbuzz/public-sdk';

import { productColumns } from './product-columns';
import { ProductDataSource } from './product-data-source';

@Component({
  selector: 'app-root',
  imports: [BIModulesModule],
  template: `
    <main class="page">
      <h1>Products</h1>

      <BI-Nav
        [BIGrid]="grid"
        [DomID]="'ProductsNav'"
        [CanInsert]="true"
        [CanUpdate]="true"
        [CanDelete]="true"
        [deleteConfirmMsg]="true"
        [navButtons]="navButtons"
      >
        <input
          class="product-search"
          type="search"
          aria-label="Search products"
          placeholder="Search products"
          (input)="searchProducts($any($event.target).value)"
        />
      </BI-Nav>

      @if (dataSource.errorMessage()) {
        <p class="message" aria-live="polite">{{ dataSource.errorMessage() }}</p>
      }

      <BI-Grid
        #grid
        [DataService]="dataSource"
        [Columns]="columns"
        [changeSet]="changeSet"
        [GridName]="'Products'"
        [DomID]="'ProductsGrid'"
        [HasPaging]="true"
      ></BI-Grid>
    </main>
  `,
  styles: [],
})
export class App implements OnInit {
  readonly dataSource = new ProductDataSource(inject(PublicApiClient));
  readonly columns = productColumns;
  readonly changeSet: IChangeset = { changesetArr: [] };
  readonly navButtons: INavBtn = {
    attach: { visibility: false, disable: false },
    info: { visibility: false, disable: false },
    ColView: { visibility: false, disable: false },
  };

  ngOnInit(): void {
    this.searchProducts('');
  }

  searchProducts(value: string): void {
    const name = value.trim().replaceAll("'", "''");
    const filter = name ? `$filter=contains(Name,'${name}')&` : '';
    this.dataSource.read(`${filter}$skip=0&$top=10&$count=true`);
  }
}
