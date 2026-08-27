import { Validators } from '@angular/forms';
import { ControlTypes, DataTypes, IColumns } from 'bi-interfaces';
import type { IDataSource } from 'bi-interfaces';

const numericControl = 'numeric' as ControlTypes;
const booleanControl = 'boolean' as ControlTypes;

export const productColumns: Array<IColumns & IDataSource['Columns'][number]> = [
  {
    DomID: '',
    Name: 'Id',
    DisplayName: 'Id',
    DataType: DataTypes.NUMERIC,
    controlType: numericControl,
    IsEditable: false,
    IsFilterable: true,
    IsVisible: true,
  },
  {
    DomID: '',
    Name: 'Name',
    DisplayName: 'Product Name',
    DataType: DataTypes.Text,
    controlType: ControlTypes.Text,
    IsEditable: true,
    IsFilterable: true,
    IsVisible: true,
    Validators: [Validators.required],
  },
  {
    DomID: '',
    Name: 'Price',
    DisplayName: 'Price (EGP)',
    DataType: DataTypes.NUMERIC,
    controlType: numericControl,
    IsEditable: true,
    IsFilterable: true,
    IsVisible: true,
    Precision: 2,
    ConditionalCellStyleFn: () => ({ fontWeight: '600' }),
    Validators: [Validators.required, Validators.min(0)],
  },
  {
    DomID: '',
    Name: 'StockQuantity',
    DisplayName: 'Stock Quantity',
    DataType: DataTypes.NUMERIC,
    controlType: numericControl,
    IsEditable: true,
    IsFilterable: true,
    IsVisible: true,
    ConditionalCellStyleFn: (product: { StockQuantity?: number | null }) =>
      (product.StockQuantity ?? 0) < 10
        ? {
            backgroundColor: '#fff1df',
            borderRadius: '999px',
            color: '#9a4b00',
            fontWeight: '700',
            padding: '0.15rem 0.5rem',
          }
        : {},
    Validators: [Validators.required, Validators.min(0)],
  },
  {
    DomID: '',
    Name: 'IsActive',
    DisplayName: 'Active',
    DataType: DataTypes.Boolean,
    controlType: booleanControl,
    IsEditable: true,
    IsFilterable: true,
    IsVisible: true,
    DefaultValue: true,
  },
  {
    DomID: '',
    Name: 'Status',
    DisplayName: 'Status',
    DataType: DataTypes.Text,
    controlType: ControlTypes.Text,
    IsEditable: false,
    IsFilterable: false,
    IsVisible: true,
    ConditionalCellStyleFn: (product: { IsActive?: boolean }) => ({
      backgroundColor: product.IsActive ? '#e6f6ec' : '#f1f2f4',
      borderRadius: '999px',
      color: product.IsActive ? '#17653a' : '#596068',
      fontWeight: '700',
      padding: '0.15rem 0.55rem',
    }),
  },
];
