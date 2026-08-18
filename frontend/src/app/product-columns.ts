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
    DisplayName: 'Price',
    DataType: DataTypes.NUMERIC,
    controlType: numericControl,
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
    controlType: numericControl,
    IsEditable: true,
    IsFilterable: true,
    IsVisible: true,
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
];
