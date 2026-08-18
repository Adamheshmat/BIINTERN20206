import { Validators } from '@angular/forms';
import { DataTypes, IColumns } from 'bi-interfaces';
import type { IDataSource } from 'bi-interfaces';

export const productColumns: Array<IColumns & IDataSource['Columns'][number]> = [
  {
    DomID: '',
    Name: 'Id',
    DisplayName: 'Id',
    DataType: DataTypes.NUMERIC,
    IsEditable: false,
    IsFilterable: true,
    IsVisible: true,
  },
  {
    DomID: '',
    Name: 'Name',
    DisplayName: 'Name',
    DataType: DataTypes.Text,
    IsEditable: true,
    IsFilterable: true,
    IsVisible: true,
    Validators: [Validators.required],
  },
  {
    DomID: '',
    Name: 'Price',
    DisplayName: 'Price',
    DataType: DataTypes.NUMERIC,
    IsEditable: true,
    IsFilterable: true,
    IsVisible: true,
    Validators: [Validators.required, Validators.min(0)],
  },
  {
    DomID: '',
    Name: 'StockQuantity',
    DisplayName: 'Stock Quantity',
    DataType: DataTypes.NUMERIC,
    IsEditable: true,
    IsFilterable: true,
    IsVisible: true,
    Validators: [Validators.required, Validators.min(0)],
  },
  {
    DomID: '',
    Name: 'IsActive',
    DisplayName: 'Is Active',
    DataType: DataTypes.Boolean,
    IsEditable: true,
    IsFilterable: true,
    IsVisible: true,
    DefaultValue: true,
  },
];
