import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PublicApiClient } from '@salesbuzz/public-sdk';
import { BIGridComponent } from 'bi-modules';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './app';

const editableFields = ['Name', 'Price', 'StockQuantity', 'IsActive'];

describe('App', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: PublicApiClient,
          useValue: {
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the Products page with one grid and its five toolbar commands in order', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button'));

    expect(fixture.nativeElement.querySelector('h1')?.textContent?.trim()).toBe('Products');
    expect(fixture.nativeElement.querySelectorAll('BI-Grid')).toHaveLength(1);
    expect(buttons.map((button) => button.textContent.trim())).toEqual([
      'Add',
      'Edit',
      'Save',
      'Delete',
      'Cancel',
    ]);
  });

  it('uses the BI Grid commands only while the matching page state is active', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const page = fixture.componentInstance as unknown as {
      add(): void;
      edit(): void;
      save(): void;
      remove(): void;
      cancel(): void;
      onRowChange(): void;
      onSaved(): void;
      onAdded(): void;
      message: string;
    };
    const grid = fixture.debugElement.query(By.directive(BIGridComponent))
      .componentInstance as BIGridComponent;
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

    buttons[1].click();
    buttons[3].click();
    buttons[2].click();
    buttons[4].click();
    expect(grid.calls).toEqual([]);
    expect(page.message).toBe('Nothing to cancel.');

    grid.rowValue = { Id: 3 };
    page.onRowChange();
    buttons[1].click();
    expect(grid.calls).toEqual([
      `EnableDisable_columns:${editableFields.join(',')}:false`,
      `EnableDisable_columns:${editableFields.join(',')}:true`,
    ]);

    grid.hasPendingChanges = true;
    buttons[2].click();
    expect(grid.calls).toEqual([
      `EnableDisable_columns:${editableFields.join(',')}:false`,
      `EnableDisable_columns:${editableFields.join(',')}:true`,
      'Save',
    ]);

    page.onSaved();
    expect(grid.calls.at(-1)).toBe(`EnableDisable_columns:${editableFields.join(',')}:false`);

    vi.stubGlobal('confirm', vi.fn(() => true));
    buttons[3].click();
    expect(grid.calls.at(-1)).toBe('DeleteRow');

    buttons[0].click();
    expect(grid.calls.slice(-2)).toEqual([
      'AddRow',
      `EnableDisable_columns:${editableFields.join(',')}:true`,
    ]);
    expect(grid.currentRowEditable).toBe(true);

    buttons[4].click();
    expect(grid.calls.slice(-2)).toEqual([
      'Cancel',
      `EnableDisable_columns:${editableFields.join(',')}:false`,
    ]);
  });

  it('does not confirm or delete a persisted row while an edit is active', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const grid = fixture.debugElement.query(By.directive(BIGridComponent))
      .componentInstance as BIGridComponent;
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);

    grid.rowValue = { Id: 3 };
    page.onRowChange();
    buttons[1].click();
    buttons[3].click();

    expect(confirm).not.toHaveBeenCalled();
    expect(grid.calls).not.toContain('DeleteRow');
    expect(page.message).toBe('Finish the current change first.');
  });

  it('does not confirm or delete while adding a new row', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const grid = fixture.debugElement.query(By.directive(BIGridComponent))
      .componentInstance as BIGridComponent;
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);

    buttons[0].click();
    buttons[3].click();

    expect(confirm).not.toHaveBeenCalled();
    expect(grid.calls).not.toContain('DeleteRow');
    expect(page.message).toBe('Finish the current change first.');
  });

  it('keeps a newly added persisted row selected', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const grid = fixture.debugElement.query(By.directive(BIGridComponent))
      .componentInstance as BIGridComponent;
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    vi.stubGlobal('confirm', vi.fn(() => true));

    grid.rowValue = { Id: 12 };
    page.onAdded();
    buttons[1].click();
    expect(grid.calls.at(-1)).toBe(`EnableDisable_columns:${editableFields.join(',')}:true`);
  });

  it('clears cached selection when a confirmed delete command starts and ignores later data reads', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const grid = fixture.debugElement.query(By.directive(BIGridComponent))
      .componentInstance as BIGridComponent;
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);

    grid.rowValue = { Id: 12 };
    page.onRowChange();
    buttons[3].click();
    expect(confirm).toHaveBeenCalledWith('Delete this product?');
    expect(grid.calls.at(-1)).toBe('DeleteRow');
    expect(page.message).toBe('Deleting product.');

    buttons[1].click();
    expect(page.message).toBe('Select a saved product first.');

    page.dataSource.next({ data: [], total: 0 });
    expect(page.message).toBe('Select a saved product first.');
  });

  it('ends an unchanged edit immediately but waits for AfterSave during an async update', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const grid = fixture.debugElement.query(By.directive(BIGridComponent))
      .componentInstance as BIGridComponent;
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

    grid.rowValue = { Id: 3 };
    page.onRowChange();
    buttons[1].click();
    grid.hasPendingChanges = false;
    buttons[2].click();
    expect(grid.calls.slice(-2)).toEqual([
      'Save',
      `EnableDisable_columns:${editableFields.join(',')}:false`,
    ]);
    expect(page.message).toBe('No changes to save.');

    buttons[1].click();
    grid.hasPendingChanges = true;
    buttons[2].click();
    expect(grid.calls.at(-1)).toBe('Save');
    expect(page.message).toBe('Saving product.');

    page.onSaved();
    expect(grid.calls.at(-1)).toBe(`EnableDisable_columns:${editableFields.join(',')}:false`);
    expect(page.message).toBe('Changes saved.');
  });
});
