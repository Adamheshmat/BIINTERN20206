import { Component, inject, OnInit, signal } from '@angular/core';
import { BIModulesModule } from 'bi-modules';
import type { IChangeset, INavBtn } from 'bi-interfaces';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { finalize } from 'rxjs';

import { AuthService } from './auth.service';
import { productColumns } from './product-columns';
import { ProductDataSource } from './product-data-source';

@Component({
  selector: 'app-root',
  imports: [BIModulesModule],
  template: `
    <main class="page">
      @if (!auth.session()) {
        <section class="login-card" aria-labelledby="login-title">
          <h1 id="login-title">Product Demo Login</h1>
          <form (submit)="login(userName.value, password.value, $event)">
            <label for="userName">Username</label>
            <input #userName id="userName" name="userName" autocomplete="username" required />
            <label for="password">Password</label>
            <input #password id="password" name="password" type="password"
                   autocomplete="current-password" required />
            <button type="submit" [disabled]="loginPending()">
              {{ loginPending() ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>
          @if (loginError()) {
            <p class="login-error" role="alert">{{ loginError() }}</p>
          }
        </section>
      } @else {
        <header class="session-bar">
          <div>
            <strong>{{ auth.session()!.user.userName }}</strong>
            <span>{{ auth.session()!.user.role }}</span>
            <span>BU {{ auth.session()!.user.buid }}</span>
          </div>
          <button type="button" (click)="logout()">Log out</button>
        </header>
        <h1>Products</h1>
        <BI-Nav
          [BIGrid]="grid"
          [DomID]="'ProductsNav'"
          [CanInsert]="auth.session()!.permissions.canCreate"
          [CanUpdate]="auth.session()!.permissions.canUpdate"
          [CanDelete]="auth.session()!.permissions.canDelete"
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
      }
    </main>
  `,
  styles: [],
})
export class App implements OnInit {
  readonly auth = inject(AuthService);
  readonly dataSource = new ProductDataSource(inject(PublicApiClient));
  readonly columns = productColumns;
  readonly loginError = signal('');
  readonly loginPending = signal(false);
  readonly changeSet: IChangeset = { changesetArr: [] };
  readonly navButtons: INavBtn = {
    attach: { visibility: false, disable: false },
    info: { visibility: false, disable: false },
    ColView: { visibility: false, disable: false },
  };

  ngOnInit(): void {
    if (this.auth.session()) this.searchProducts('');
  }

  login(userName: string, password: string, event: Event): void {
    event.preventDefault();
    this.loginError.set('');
    this.loginPending.set(true);
    this.auth.login(userName.trim(), password).pipe(
      finalize(() => this.loginPending.set(false)),
    ).subscribe({
      next: () => this.searchProducts(''),
      error: () => this.loginError.set('Invalid username or password.'),
    });
  }

  logout(): void {
    this.auth.logout();
    this.dataSource.next({ data: [], total: 0 });
  }

  searchProducts(value: string): void {
    const name = value.trim().replaceAll("'", "''");
    const filter = name ? `$filter=contains(Name,'${name}')&` : '';
    this.dataSource.read(`${filter}$skip=0&$top=10&$count=true`);
  }
}
