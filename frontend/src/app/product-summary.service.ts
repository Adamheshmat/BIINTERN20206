import { Injectable, inject, signal } from '@angular/core';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { finalize } from 'rxjs';

export interface ProductSummary {
  productCount: number;
  totalInventoryValue: number;
  activeProductCount: number;
  lowStockProductCount: number;
}

const emptySummary: ProductSummary = {
  productCount: 0,
  totalInventoryValue: 0,
  activeProductCount: 0,
  lowStockProductCount: 0,
};

@Injectable()
export class ProductSummaryService {
  private readonly client = inject(PublicApiClient);
  private requestGeneration = 0;

  readonly summary = signal<ProductSummary>(emptySummary);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  load(): void {
    const generation = ++this.requestGeneration;
    this.loading.set(true);
    this.errorMessage.set('');
    this.client.get<ProductSummary>('/ProductSummary').pipe(
      finalize(() => {
        if (generation === this.requestGeneration) this.loading.set(false);
      }),
    ).subscribe({
      next: (summary) => {
        if (generation === this.requestGeneration) this.summary.set(summary);
      },
      error: () => {
        if (generation === this.requestGeneration) {
          this.errorMessage.set('Unable to load the product summary.');
        }
      },
    });
  }

  reset(): void {
    this.requestGeneration++;
    this.summary.set(emptySummary);
    this.loading.set(false);
    this.errorMessage.set('');
  }
}
