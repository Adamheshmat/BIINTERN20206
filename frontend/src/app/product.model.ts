export interface Product {
  Id: number;
  Name: string;
  Price: number;
  StockQuantity: number;
  IsActive: boolean;
  Status?: 'Active' | 'Inactive';
}
