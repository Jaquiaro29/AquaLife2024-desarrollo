export type SupplierStatus = 'active' | 'inactive';

export interface SupplierContact {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  currencyPreference?: 'VES' | 'USD';
  paymentTerms?: string;
  notes?: string;
  status: SupplierStatus;
  createdAt?: any;
  updatedAt?: any;
  contacts?: SupplierContact[];
}

export interface PurchaseOrderItem {
  itemId: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitCostBs: number;
  unitCostUsd: number;
  totalBs: number;
  totalUsd: number;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'invoiced' | 'paid' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  createdAt?: any;
  expectedDate?: string;
  receivedDate?: string | null;
  invoiceId?: string | null;
  notes?: string;
  items: PurchaseOrderItem[];
  totals: {
    bs: number;
    usd: number;
  };
}

export type SupplierInvoiceStatus = 'pending' | 'partial' | 'paid';

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  issueDate: string;
  dueDate?: string;
  currency: 'VES' | 'USD';
  amountBs: number;
  amountUsd: number;
  status: SupplierInvoiceStatus;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SupplierPayment {
  id: string;
  invoiceId: string;
  supplierId: string;
  amountBs: number;
  amountUsd: number;
  method: string;
  reference?: string;
  paymentDate: string;
  notes?: string;
  createdAt?: any;
}
