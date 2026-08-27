import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { TextBoxModule } from '@progress/kendo-angular-inputs';
import { BIModulesModule } from 'bi-modules';
import type { IChangeset, INavBtn } from 'bi-interfaces';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { finalize } from 'rxjs';

import { AuthService } from './auth.service';
import { productColumns } from './product-columns';
import { ProductDataSource } from './product-data-source';
import { ProductSummaryService } from './product-summary.service';

@Component({
  selector: 'app-root',
  imports: [BIModulesModule, ButtonsModule, DecimalPipe, TextBoxModule],
  providers: [ProductSummaryService],
  template: `
    <main class="page">
      @if (!auth.session()) {
        <section class="login-shell" aria-labelledby="login-title">
          <div class="login-brand" aria-hidden="true">
            <span class="brand-mark">BI</span>
            <div><strong>Product Management</strong><span>Secure business-unit workspace</span></div>
          </div>
          <div class="login-card">
          <p class="eyebrow">Welcome back</p>
          <h1 id="login-title">Sign in to Products</h1>
          <p class="login-intro">Use your demo account to open its assigned business unit.</p>
          <form (submit)="login(userName.value, password.value, $event)">
            <label for="userName">Username</label>
            <input kendoTextBox #userName id="userName" name="userName"
                   autocomplete="username" placeholder="Enter username" required />
            <label for="password">Password</label>
            <div class="password-field">
              <input kendoTextBox #password id="password" name="password"
                     [type]="showPassword() ? 'text' : 'password'"
                     autocomplete="current-password" placeholder="Enter password" required />
              <button kendoButton type="button" class="password-toggle"
                      [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                      (click)="togglePasswordVisibility()">
                <img [src]="showPassword() ? '/assets/icons/eye-slash-icon.svg' : '/assets/icons/eye-icon.svg'" alt="" />
              </button>
            </div>
            <button kendoButton themeColor="primary" type="submit" [disabled]="loginPending()">
              {{ loginPending() ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>
          @if (loginError()) {
            <p class="login-error" role="alert">{{ loginError() }}</p>
          }
          <div class="demo-hint">
            <span><strong>Admin:</strong> admin / admin123</span>
            <span><strong>Viewer:</strong> viewer / viewwer123</span>
          </div>
          </div>
        </section>
      } @else {
        <header class="session-bar">
          <div class="identity">
            <strong>{{ auth.session()!.user.userName }}</strong>
            <span class="role-badge">{{ accessLabel() }}</span>
            <span class="bu-badge">BU {{ auth.session()!.user.buid }}</span>
          </div>
          <button kendoButton type="button" (click)="logout()">Log out</button>
        </header>
        <div class="page-heading">
          <div><p class="eyebrow">Business unit {{ auth.session()!.user.buid }}</p><h1>Products</h1></div>
          <p class="access-explanation">{{ accessExplanation() }}</p>
        </div>

        <section class="summary-grid" aria-label="Product summary" [attr.aria-busy]="summary.loading()">
          <article class="summary-card"><span>Products</span><strong>{{ summary.summary().productCount }}</strong></article>
          <article class="summary-card"><span>Inventory value</span><strong>{{ summary.summary().totalInventoryValue | number:'1.2-2' }} EGP</strong></article>
          <article class="summary-card summary-active"><span>Active</span><strong>{{ summary.summary().activeProductCount }}</strong></article>
          <article class="summary-card summary-warning"><span>Low stock (&lt; 10)</span><strong>{{ summary.summary().lowStockProductCount }}</strong></article>
        </section>
        @if (summary.loading()) { <p class="loading-message" aria-live="polite">Updating summary…</p> }
        @if (summary.errorMessage()) { <p class="message error" role="alert">{{ summary.errorMessage() }}</p> }
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

        @if (dataSource.isLoading()) {
          <p class="loading-message" aria-live="polite">Loading products…</p>
        }
        @if (dataSource.notice(); as notice) {
          <p class="message toast" [class.success]="notice.kind === 'success'"
             [class.error]="notice.kind === 'error'" aria-live="polite">{{ notice.text }}</p>
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
  readonly showPassword = signal(false);
  readonly summary = inject(ProductSummaryService);
  readonly changeSet: IChangeset = { changesetArr: [] };
  readonly navButtons: INavBtn = {
    attach: { visibility: false, disable: false },
    info: { visibility: false, disable: false },
    ColView: { visibility: false, disable: false },
  };
  private lastMutationVersion = 0;

  constructor() {
    effect(() => {
      const version = this.dataSource.mutationVersion();
      if (version > this.lastMutationVersion && this.auth.session()) this.summary.load();
      this.lastMutationVersion = version;
    });
  }

  ngOnInit(): void {
    if (this.auth.session()) this.loadProductsView();
  }

  login(userName: string, password: string, event: Event): void {
    event.preventDefault();
    this.loginError.set('');
    this.loginPending.set(true);
    this.auth.login(userName.trim(), password).pipe(
      finalize(() => this.loginPending.set(false)),
    ).subscribe({
      next: () => this.loadProductsView(),
      error: () => this.loginError.set('Invalid username or password.'),
    });
  }

  logout(): void {
    this.auth.logout();
    this.dataSource.next({ data: [], total: 0 });
    this.summary.reset();
  }

  searchProducts(value: string): void {
    const name = value.trim().replaceAll("'", "''");
    const filter = name ? `$filter=contains(Name,'${name}')&` : '';
    this.dataSource.read(`${filter}$skip=0&$top=10&$count=true`);
  }

  accessLabel(): string {
    return this.auth.session()?.user.role === 'admin'
      ? 'Administrator — Full access'
      : 'Viewer — Read only';
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  accessExplanation(): string {
    return this.auth.session()?.permissions.canCreate
      ? 'You can add, edit, and delete products in this business unit.'
      : 'Viewing is enabled. Add, edit, and delete are unavailable for this account.';
  }

  private loadProductsView(): void {
    this.searchProducts('');
    this.summary.load();
  }
}
