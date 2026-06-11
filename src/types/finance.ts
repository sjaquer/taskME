export type TransactionType = 'ingreso' | 'gasto';

export type FinanceCategory = 
  | 'Alquiler/Hipoteca'
  | 'Servicios'
  | 'Comida/Super'
  | 'Transporte'
  | 'Salud'
  | 'Ocio'
  | 'Sueldo'
  | 'Inversiones'
  | 'Otros';

export type FinanceContext = 'Personal' | 'Hogar' | 'Trabajo';

export interface Transaction {
  id: string;
  userId: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: FinanceCategory;
  date: string; // Formato YYYY-MM-DD
  context: FinanceContext;
  description?: string;
  isRecurring?: boolean;
  recurrenceInterval?: 'semanal' | 'mensual' | 'anual';
  parentTransactionId?: string;
  createdAt?: any;
  updatedAt?: any;
}
