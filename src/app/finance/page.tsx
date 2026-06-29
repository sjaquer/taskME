'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Filter,
  Layers,
  Calendar,
  AlertCircle,
  PiggyBank,
  CreditCard as CreditCardIcon,
  ArrowRight,
  Info,
  Check,
} from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { SectionLabel } from '@/components/atoms';
import {
  buildTransactionsQuery,
  createTransaction,
  deleteTransaction,
} from '@/services/finance-service';
import type { Transaction, FinanceCategory, FinanceContext, BankAccount, IncomeMethod, CreditCard } from '@/types/finance';

// Evitar errores de hidratación de Recharts en Next.js cargándolo dinámicamente
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CATEGORIES: FinanceCategory[] = [
  'Alquiler/Hipoteca',
  'Servicios',
  'Comida/Super',
  'Transporte',
  'Salud',
  'Ocio',
  'Sueldo',
  'Inversiones',
  'Otros',
];

const CONTEXTS: FinanceContext[] = ['Personal', 'Hogar', 'Trabajo'];

// Paleta de colores suizos desaturados para Recharts
const CATEGORY_COLORS = {
  'Alquiler/Hipoteca': '#475569', // Slate-600
  'Servicios': '#64748b',         // Slate-500
  'Comida/Super': '#94a3b8',      // Slate-400
  'Transporte': '#cbd5e1',       // Slate-300
  'Salud': '#334155',            // Slate-700
  'Ocio': '#f43f5e',             // Rose desaturado (gasto discrecional)
  'Sueldo': '#10b981',           // Emerald desaturado
  'Inversiones': '#059669',      // Emerald oscuro
  'Otros': '#1e293b',            // Slate-800
};

function isOccurrenceOnDate(tx: Transaction, targetDateStr: string): boolean {
  const startDate = new Date(tx.date);
  const targetDate = new Date(targetDateStr);
  
  // Normalizar horas en UTC/mediodía para evitar desfases de huso horario
  startDate.setHours(12, 0, 0, 0);
  targetDate.setHours(12, 0, 0, 0);
  
  if (targetDate <= startDate) return false;
  
  const diffTime = Math.abs(targetDate.getTime() - startDate.getTime());
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (tx.recurrenceInterval === 'semanal') {
    return diffDays % 7 === 0;
  } else if (tx.recurrenceInterval === 'mensual') {
    return targetDate.getDate() === startDate.getDate();
  } else if (tx.recurrenceInterval === 'anual') {
    return targetDate.getDate() === startDate.getDate() && targetDate.getMonth() === startDate.getMonth();
  }
  return false;
}

export default function FinancePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Estados locales de filtrado y control
  const [selectedContext, setSelectedContext] = useState<FinanceContext | 'Todos'>('Todos');
  const [isMounted, setIsMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState<'history' | 'projection'>('history');

  // Estados para el formulario de transacción
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'ingreso' | 'gasto'>('gasto');
  const [txCategory, setTxCategory] = useState<FinanceCategory>('Servicios');
  const [txContext, setTxContext] = useState<FinanceContext>('Personal');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txDescription, setTxDescription] = useState('');
  const [txIsRecurring, setTxIsRecurring] = useState(false);
  const [txRecurrence, setTxRecurrence] = useState<'semanal' | 'mensual' | 'anual'>('mensual');
  const [txIncomeOption, setTxIncomeOption] = useState<'yape_bcp' | 'plin_interbank' | 'transferencia_bcp' | 'transferencia_interbank'>('yape_bcp');
  const [txCreditCard, setTxCreditCard] = useState<CreditCard | 'ninguna'>('ninguna');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Construir consulta reactiva de Firebase
  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return buildTransactionsQuery(
      firestore, 
      user.uid, 
      selectedContext === 'Todos' ? undefined : selectedContext
    );
  }, [firestore, user, selectedContext]);

  const { data: rawTransactions, isLoading: isTxLoading } = useCollection<Transaction>(transactionsQuery);

  // Transacciones obtenidas directamente con el filtro de DB aplicado
  const transactions = useMemo(() => {
    return rawTransactions || [];
  }, [rawTransactions]);

  // Cálculos financieros para los Bento Cards
  const stats = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    let bcpBalance = 0;
    let interbankBalance = 0;
    let cardBcpOro = 0;
    let cardIo = 0;
    let cardOh = 0;
    let cardDiners = 0;

    transactions.forEach((tx) => {
      const amount = Number(tx.amount);
      if (tx.type === 'ingreso') {
        ingresos += amount;
        if (tx.bankAccount === 'BCP') {
          bcpBalance += amount;
        } else if (tx.bankAccount === 'Interbank') {
          interbankBalance += amount;
        }
      } else {
        gastos += amount;
        if (tx.creditCard === 'BCP Oro Personal') {
          cardBcpOro += amount;
        } else if (tx.creditCard === 'IO Personal') {
          cardIo += amount;
        } else if (tx.creditCard === 'OH Familiar') {
          cardOh += amount;
        } else if (tx.creditCard === 'Diners Familiar') {
          cardDiners += amount;
        }
      }
    });

    const balance = ingresos - gastos;
    return {
      ingresos,
      gastos,
      balance,
      bcpBalance,
      interbankBalance,
      cardBcpOro,
      cardIo,
      cardOh,
      cardDiners,
    };
  }, [transactions]);

  // Formatear datos para el gráfico de líneas de flujo de caja
  const chartData = useMemo(() => {
    if (transactions.length === 0) return [];

    // Agrupar por fecha
    const grouped: Record<string, { date: string; ingresos: number; gastos: number; balance: number }> = {};
    
    // Generar un set de datos cronológicos ordenados de más antiguo a más nuevo
    const sorted = [...transactions].reverse();

    let cumulativeBalance = 0;

    sorted.forEach((tx) => {
      const dateStr = tx.date;
      if (!grouped[dateStr]) {
        grouped[dateStr] = { date: dateStr, ingresos: 0, gastos: 0, balance: 0 };
      }

      const amount = Number(tx.amount);
      if (tx.type === 'ingreso') {
        grouped[dateStr].ingresos += amount;
        cumulativeBalance += amount;
      } else {
        grouped[dateStr].gastos += amount;
        cumulativeBalance -= amount;
      }
      grouped[dateStr].balance = cumulativeBalance;
    });

    return Object.values(grouped);
  }, [transactions]);

  // Proyección de Flujo de Caja para los próximos 30 días
  const projectionData = useMemo(() => {
    if (transactions.length === 0) return [];
    
    let currentBalance = stats.balance;
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);
    today.setHours(12, 0, 0, 0);

    const recurringTx = transactions.filter((tx) => tx.isRecurring);

    const projection = [];
    
    for (let i = 1; i <= 30; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const targetDateStr = targetDate.toISOString().split('T')[0];
      
      let dayIngresos = 0;
      let dayGastos = 0;
      
      recurringTx.forEach((tx) => {
        if (isOccurrenceOnDate(tx, targetDateStr)) {
          const amount = Number(tx.amount);
          if (tx.type === 'ingreso') {
            dayIngresos += amount;
          } else {
            dayGastos += amount;
          }
        }
      });
      
      currentBalance += (dayIngresos - dayGastos);
      
      projection.push({
        date: targetDateStr,
        ingresos: dayIngresos,
        gastos: dayGastos,
        balance: currentBalance,
        isProjected: true,
      });
    }
    
    return projection;
  }, [transactions, stats.balance]);

  // Autogeneración silenciosa de recurrencias pasadas
  useEffect(() => {
    if (isTxLoading || !rawTransactions || !user || !firestore) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);
    today.setHours(0, 0, 0, 0);
    
    const recurringParents = rawTransactions.filter(tx => tx.isRecurring && !tx.parentTransactionId);
    
    const transactionsToCreate: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [];
    
    recurringParents.forEach(parent => {
      const startDate = new Date(parent.date);
      startDate.setHours(0, 0, 0, 0);
      
      let currentDate = new Date(startDate);
      
      while (true) {
        if (parent.recurrenceInterval === 'semanal') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (parent.recurrenceInterval === 'mensual') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (parent.recurrenceInterval === 'anual') {
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        } else {
          break;
        }
        
        const currentStr = currentDate.toISOString().split('T')[0];
        
        if (currentDate >= today) {
          break;
        }
        
        const alreadyExists = rawTransactions.some(
          tx => tx.parentTransactionId === parent.id && tx.date === currentStr
        );
        
        if (!alreadyExists) {
          transactionsToCreate.push({
            title: `${parent.title} (Recurrente)`,
            amount: parent.amount,
            type: parent.type,
            category: parent.category,
            context: parent.context,
            date: currentStr,
            description: parent.description || undefined,
            parentTransactionId: parent.id,
            isRecurring: false,
            bankAccount: parent.bankAccount || undefined,
            method: parent.method || undefined,
            creditCard: parent.creditCard || undefined,
          });
        }
      }
    });
    
    if (transactionsToCreate.length > 0) {
      const createPromises = transactionsToCreate.map(tx => 
        createTransaction(firestore, user.uid, tx)
      );
      
      Promise.all(createPromises)
        .then(() => {
          toast({
            variant: 'success',
            title: 'Recurrencias Actualizadas',
            description: `Se registraron automáticamente ${transactionsToCreate.length} transacciones recurrentes pendientes.`,
          });
        })
        .catch(err => {
          console.error('Error al generar transacciones recurrentes:', err);
        });
    }
  }, [rawTransactions, isTxLoading, user, firestore]);

  // Formatear datos para el gráfico de torta de gastos por categoría
  const categoryChartData = useMemo(() => {
    const expenses = transactions.filter((tx) => tx.type === 'gasto');
    const totals: Record<string, number> = {};

    expenses.forEach((tx) => {
      totals[tx.category] = (totals[tx.category] || 0) + Number(tx.amount);
    });

    return Object.entries(totals).map(([name, value]) => ({
      name,
      value,
    }));
  }, [transactions]);

  // Guardar nueva transacción
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    if (!txTitle.trim()) {
      toast({ variant: 'destructive', title: 'Operación Inválida', description: 'Por favor añade un título.' });
      return;
    }
    const amountNum = Number(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ variant: 'destructive', title: 'Importe Inválido', description: 'Introduce un número positivo.' });
      return;
    }

    // Mapear opción de cuenta bancaria y método para ingresos, o tarjeta para gastos
    let bankAccount: BankAccount | undefined = undefined;
    let method: IncomeMethod | undefined = undefined;
    let creditCard: CreditCard | undefined = undefined;

    if (txType === 'ingreso') {
      if (txIncomeOption === 'yape_bcp') {
        bankAccount = 'BCP';
        method = 'Yape';
      } else if (txIncomeOption === 'transferencia_bcp') {
        bankAccount = 'BCP';
        method = 'Transferencia';
      } else if (txIncomeOption === 'plin_interbank') {
        bankAccount = 'Interbank';
        method = 'Plin';
      } else if (txIncomeOption === 'transferencia_interbank') {
        bankAccount = 'Interbank';
        method = 'Transferencia';
      }
    } else {
      if (txCreditCard !== 'ninguna') {
        creditCard = txCreditCard;
      }
    }

    try {
      await createTransaction(firestore, user.uid, {
        title: txTitle,
        amount: amountNum,
        type: txType,
        category: txCategory,
        context: txContext,
        date: txDate,
        description: txDescription || undefined,
        isRecurring: txIsRecurring || undefined,
        recurrenceInterval: txIsRecurring ? txRecurrence : undefined,
        bankAccount,
        method,
        creditCard,
      });

      toast({ variant: 'success', title: 'Registro Exitoso', description: 'Movimiento añadido correctamente.' });
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error en Servidor', description: 'No se pudo guardar la transacción.' });
    }
  };

  // Eliminar transacción
  const handleDeleteTransaction = async (id: string) => {
    if (!user || !firestore) return;
    try {
      await deleteTransaction(firestore, user.uid, id);
      toast({ variant: 'success', title: 'Nodo Removido', description: 'Movimiento eliminado correctamente.' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error de Red', description: 'No se pudo completar la operación.' });
    }
  };

  const resetForm = () => {
    setTxTitle('');
    setTxAmount('');
    setTxType('gasto');
    setTxCategory('Servicios');
    setTxContext('Personal');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxDescription('');
    setTxIsRecurring(false);
    setTxIncomeOption('yape_bcp');
    setTxCreditCard('ninguna');
  };

  // Skeletons de Carga alineados a la visual Bento 2.0
  if (isUserLoading || isTxLoading || !isMounted) {
    return (
      <div className="space-y-10 md:space-y-12 pb-12 px-0 max-w-[1400px] mx-auto w-full animate-pulse">
        <div className="space-y-3">
          <Skeleton className="h-10 w-48 bg-muted/30 rounded-lg" />
          <Skeleton className="h-4 w-72 bg-muted/30 rounded-full" />
        </div>
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-[2.5rem] bg-muted/30" />
          ))}
        </div>
        {/* Main Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <Skeleton className="h-[22rem] rounded-[2.5rem] bg-muted/30 w-full" />
          </div>
          <div className="lg:col-span-4">
            <Skeleton className="h-[22rem] rounded-[2.5rem] bg-muted/30 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10 md:space-y-12 pb-12 px-0 max-w-[1400px] mx-auto w-full"
    >
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground">
            Control de <span className="text-primary">Finanzas</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Gestión integrada de cobros, pagos, ahorro personal y del hogar.
          </p>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="w-full sm:w-auto rounded-2xl bg-primary text-primary-foreground hover:bg-primary/95 gap-2 px-5 py-4 sm:py-6 shadow-[0_4px_20px_rgba(var(--primary),0.15)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Añadir Movimiento</span>
        </Button>
      </div>

      {/* FILA 1: Bento Grid de Métricas de Alto Rango (1x3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance General */}
        <div className="glass-card-elevated p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-2xl rounded-full group-hover:scale-125 transition-transform duration-700" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Balance General</span>
            <div className={`p-2 rounded-xl bg-card border border-border`}>
              <PiggyBank className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <p className={`text-3xl md:text-4xl font-black font-data tracking-tight ${stats.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {stats.balance >= 0 ? '+ S/ ' : '- S/ '}{Math.abs(stats.balance).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Suma total del periodo seleccionado</p>
          </div>
        </div>

        {/* Ingresos del Periodo */}
        <div className="glass-card p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Ingresos</span>
            <div className="p-2 rounded-xl bg-card border border-border">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-black font-data tracking-tight text-foreground">
              S/ {stats.ingresos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-emerald-500/80 mt-1 uppercase tracking-widest font-semibold flex items-center gap-1">
              <span>Flujo positivo registrado</span>
            </p>
          </div>
        </div>

        {/* Gastos del Periodo */}
        <div className="glass-card p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Gastos / Egresos</span>
            <div className="p-2 rounded-xl bg-card border border-border">
              <TrendingDown className="w-5 h-5 text-rose-500" />
            </div>
          </div>
          <div>
            <p className="text-3xl md:text-4xl font-black font-data tracking-tight text-foreground">
              S/ {stats.gastos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-rose-500/80 mt-1 uppercase tracking-widest font-semibold">
              Egresos corrientes devengados
            </p>
          </div>
        </div>
      </div>

      {/* FILA EXTRA: Resumen de Cuentas y Tarjetas de Crédito */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cuentas Bancarias */}
        <div className="glass-card p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex flex-col justify-between min-h-[160px] relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Saldos por Cuentas</p>
              <h3 className="text-lg font-black uppercase tracking-wider text-foreground mt-1">Cuentas Bancarias</h3>
            </div>
            <div className="p-2 rounded-xl bg-card border border-border">
              <PiggyBank className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Cuenta BCP</span>
              <p className="text-xl md:text-2xl font-black font-data tracking-tight text-emerald-500">
                S/ {stats.bcpBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Cuenta Interbank</span>
              <p className="text-xl md:text-2xl font-black font-data tracking-tight text-emerald-500">
                S/ {stats.interbankBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Tarjetas de Crédito */}
        <div className="glass-card p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex flex-col justify-between min-h-[160px] relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Consumos de Periodo</p>
              <h3 className="text-lg font-black uppercase tracking-wider text-foreground mt-1">Tarjetas de Crédito</h3>
            </div>
            <div className="p-2 rounded-xl bg-card border border-border">
              <CreditCardIcon className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block truncate">BCP Oro</span>
              <p className="text-base sm:text-lg font-black font-data tracking-tight text-rose-500">
                S/ {stats.cardBcpOro.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block truncate">IO Personal</span>
              <p className="text-base sm:text-lg font-black font-data tracking-tight text-rose-500">
                S/ {stats.cardIo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block truncate">OH Familiar</span>
              <p className="text-base sm:text-lg font-black font-data tracking-tight text-rose-500">
                S/ {stats.cardOh.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block truncate">Diners Fam.</span>
              <p className="text-base sm:text-lg font-black font-data tracking-tight text-rose-500">
                S/ {stats.cardDiners.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FILA 2: Bento de Análisis (Gráficos Asimétricos 70/30) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Gráfico de Tendencia de Flujo (Grande) */}
        <div className="lg:col-span-8 glass-card p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex flex-col justify-between min-h-[360px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Curva de Flujo Temporal</p>
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground mt-1">Evolución Monetaria</h3>
              </div>
              {/* Tabs Selector */}
              <div className="flex bg-muted/40 p-1 rounded-xl border border-border text-xs w-fit">
                <button
                  onClick={() => setActiveChartTab('history')}
                  className={`px-3 py-1 font-bold uppercase tracking-wider rounded-lg transition-all ${
                    activeChartTab === 'history'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Historial
                </button>
                <button
                  onClick={() => setActiveChartTab('projection')}
                  className={`px-3 py-1 font-bold uppercase tracking-wider rounded-lg transition-all ${
                    activeChartTab === 'projection'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Proyección
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-data">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Ingresos</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> Gastos</span>
            </div>
          </div>

          <div className="w-full h-[240px]">
            {(activeChartTab === 'history' ? chartData.length : projectionData.length) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeChartTab === 'history' ? chartData : projectionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(str) => str.substring(8, 10) + '/' + str.substring(5, 7)}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `S/ ${val}`}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="glass p-4 rounded-xl border border-border text-xs space-y-1 font-data">
                            <p className="font-semibold text-muted-foreground">
                              {data.date} {data.isProjected && <span className="text-primary font-bold ml-1">(Proyectado)</span>}
                            </p>
                            <p className="text-emerald-500">Ingresos: S/ {data.ingresos.toLocaleString('es-PE')}</p>
                            <p className="text-rose-500">Gastos: S/ {data.gastos.toLocaleString('es-PE')}</p>
                            <p className="text-primary font-bold border-t border-border pt-1 mt-1">Saldo: S/ {data.balance.toLocaleString('es-PE')}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorBalance)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-border rounded-2xl py-12">
                <Info className="w-8 h-8 text-muted-foreground/35 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-muted-foreground/50 tracking-wider uppercase">Falta historial de transacciones</p>
              </div>
            )}
          </div>
        </div>

        {/* Breakdown de Categorías de Gasto (Pequeño) */}
        <div className="lg:col-span-4 glass-card p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex flex-col justify-between min-h-[360px]">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Distribución del Gasto</p>
            <h3 className="text-lg font-black uppercase tracking-wider text-foreground mt-1">Por Categoría</h3>
          </div>

          <div className="relative w-full h-[180px] flex items-center justify-center my-4">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[entry.name as FinanceCategory] || '#475569'}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        return (
                          <div className="glass px-3 py-2 rounded-lg border border-border text-xs font-data">
                            <p className="font-semibold">{data.name}</p>
                            <p className="text-rose-500">S/ {data.value !== undefined ? Number(data.value).toLocaleString('es-PE') : '0'}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center border border-dashed border-border rounded-2xl">
                <p className="text-xs font-semibold text-muted-foreground/50 tracking-wider uppercase">Sin egresos registrados</p>
              </div>
            )}
            {categoryChartData.length > 0 && (
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase text-muted-foreground tracking-widest font-bold">Total Egresos</span>
                <span className="text-lg font-black font-data tracking-tight text-foreground">S/ {stats.gastos.toLocaleString('es-PE')}</span>
              </div>
            )}
          </div>

          {/* Listado resumido de categorías activas */}
          <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
            {categoryChartData.slice(0, 3).map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[item.name as FinanceCategory] }}
                  />
                  <span className="truncate max-w-[120px]">{item.name}</span>
                </span>
                <span className="font-bold text-foreground font-data">S/ {item.value.toLocaleString('es-PE')}</span>
              </div>
            ))}
            {categoryChartData.length > 3 && (
              <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest pt-1">
                +{categoryChartData.length - 3} categorías adicionales
              </p>
            )}
          </div>
        </div>
      </div>

      {/* FILA 3: Controladores y Listado de Movimientos */}
      <div className="space-y-6">
        {/* Selector de Contexto y Filtros */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
          <SectionLabel icon={<Layers className="w-5 h-5 text-primary" />}>Historial de Movimientos</SectionLabel>
          
          <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-1.5 rounded-2xl border border-border/80 w-full sm:w-auto">
            {(['Todos', ...CONTEXTS] as const).map((ctx) => (
              <button
                key={ctx}
                onClick={() => setSelectedContext(ctx)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 shrink-0 ${
                  selectedContext === ctx
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/65'
                }`}
              >
                {ctx}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla/Lista de Movimientos */}
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {transactions.length > 0 ? (
              transactions.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 100, damping: 20, delay: Math.min(i * 0.03, 0.3) }}
                  className="glass-card px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/20 transition-all duration-300 group active:scale-[0.99] relative"
                >
                  {/* Detalles Izquierda */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2.5 rounded-xl border ${tx.type === 'ingreso' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                      {tx.type === 'ingreso' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                        {tx.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-muted-foreground/60 uppercase tracking-widest text-[10px]">
                          {tx.category}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-data text-[10px]">
                          <Calendar className="w-3 h-3 text-muted-foreground" /> {tx.date}
                        </span>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-bold text-[9px] uppercase tracking-wide border border-border">
                          {tx.context}
                        </span>
                        {tx.type === 'ingreso' && tx.bankAccount && (
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide border flex items-center gap-1 ${
                            tx.bankAccount === 'BCP'
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}>
                            🏦 {tx.bankAccount} {tx.method ? `(${tx.method})` : ''}
                          </span>
                        )}
                        {tx.type === 'gasto' && tx.creditCard && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold uppercase tracking-wide flex items-center gap-1">
                            <CreditCardIcon className="w-2.5 h-2.5" /> {tx.creditCard.replace('Crédito ', '')}
                          </span>
                        )}
                        {tx.isRecurring && (
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-[9px] uppercase tracking-wide border border-primary/20">
                            🔁 Recurrente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Importe y Acciones Derecha */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
                    <div className="text-right">
                      <p className={`text-base sm:text-lg font-black font-data tracking-tight ${tx.type === 'ingreso' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {tx.type === 'ingreso' ? '+ S/ ' : '- S/ '}{tx.amount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTransaction(tx.id)}
                      className="text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/5 h-9 w-9 rounded-xl flex items-center justify-center p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 glass-card border-dashed flex flex-col items-center justify-center max-w-full"
              >
                <AlertCircle className="w-12 h-12 mb-3 stroke-[0.5] text-primary/30" />
                <p className="text-xs font-semibold tracking-wider text-muted-foreground/60 uppercase">Sin movimientos registrados</p>
                <p className="text-[10px] text-muted-foreground/40 mt-1 max-w-[280px] text-center">Registra cobros o egresos para comenzar la visualización de tus finanzas.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MODAL FORMULARIO: REGISTRO DE TRANSACCIÓN */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 px-0">
            {/* Fondo de desenfoque */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />

            {/* Contenedor Modal */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className="glass-card-elevated w-full sm:max-w-md max-h-[85vh] sm:max-h-[90dvh] overflow-y-auto p-6 sm:p-8 rounded-t-[2.5rem] rounded-b-none sm:rounded-[2.5rem] z-10 border border-white/10 shadow-2xl relative scrollbar-hide pb-10 sm:pb-8"
            >
              <div className="mb-5 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-foreground">Registrar Movimiento</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Ingresa los datos para imputar tu cobro o gasto.</p>
              </div>

              <form onSubmit={handleSaveTransaction} className="space-y-4 sm:space-y-5">
                {/* Tipo de Movimiento (Deslizador) */}
                <div className="space-y-1.5">
                  <label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tipo de Movimiento</label>
                  <div className="grid grid-cols-2 gap-2 bg-muted/40 p-1 rounded-2xl border border-border">
                    <button
                      type="button"
                      onClick={() => setTxType('gasto')}
                      className={`py-2.5 sm:py-2 text-sm sm:text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 active:scale-95 ${
                        txType === 'gasto'
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Egreso / Gasto
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType('ingreso')}
                      className={`py-2.5 sm:py-2 text-sm sm:text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 active:scale-95 ${
                        txType === 'ingreso'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Ingreso
                    </button>
                  </div>
                </div>

                {/* Título */}
                <div className="space-y-1.5">
                  <label htmlFor="tx-title" className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Título / Concepto</label>
                  <input
                    id="tx-title"
                    type="text"
                    required
                    placeholder="Ej. Alquiler de Dpto, Honorarios Profesionales"
                    value={txTitle}
                    onChange={(e) => setTxTitle(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/40"
                  />
                </div>

                {/* Importe */}
                <div className="space-y-1.5">
                  <label htmlFor="tx-amount" className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Importe (S/)</label>
                  <input
                    id="tx-amount"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base sm:text-sm font-data text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {/* Categoría */}
                  <div className="space-y-1.5">
                    <label htmlFor="tx-category" className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Categoría</label>
                    <select
                      id="tx-category"
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value as FinanceCategory)}
                      className="w-full h-11 sm:h-10 rounded-2xl border border-border bg-card px-3 text-base sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Contexto */}
                  <div className="space-y-1.5">
                    <label htmlFor="tx-context" className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contexto</label>
                    <select
                      id="tx-context"
                      value={txContext}
                      onChange={(e) => setTxContext(e.target.value as FinanceContext)}
                      className="w-full h-11 sm:h-10 rounded-2xl border border-border bg-card px-3 text-base sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      {CONTEXTS.map((ctx) => (
                        <option key={ctx} value={ctx}>{ctx}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Cuenta de destino (Ingresos) o Tarjeta de crédito (Gastos) */}
                {txType === 'ingreso' ? (
                  <div className="space-y-1.5">
                    <label htmlFor="tx-income-option" className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cuenta de Destino / Método</label>
                    <select
                      id="tx-income-option"
                      value={txIncomeOption}
                      onChange={(e) => setTxIncomeOption(e.target.value as any)}
                      className="w-full h-11 sm:h-10 rounded-2xl border border-border bg-card px-3 text-base sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="yape_bcp">Yape (BCP)</option>
                      <option value="transferencia_bcp">Transferencia BCP</option>
                      <option value="plin_interbank">Plin (Interbank)</option>
                      <option value="transferencia_interbank">Transferencia Interbank</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label htmlFor="tx-credit-card" className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Imputar a Tarjeta de Crédito</label>
                    <select
                      id="tx-credit-card"
                      value={txCreditCard}
                      onChange={(e) => setTxCreditCard(e.target.value as any)}
                      className="w-full h-11 sm:h-10 rounded-2xl border border-border bg-card px-3 text-base sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="ninguna">Ninguna (Efectivo/Débito)</option>
                      <option value="BCP Oro Personal">Crédito BCP Oro Personal</option>
                      <option value="IO Personal">Crédito IO Personal</option>
                      <option value="OH Familiar">Crédito OH Familiar</option>
                      <option value="Diners Familiar">Crédito Diners Familiar</option>
                    </select>
                  </div>
                )}

                {/* Fecha */}
                <div className="space-y-1.5">
                  <label htmlFor="tx-date" className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fecha</label>
                  <input
                    id="tx-date"
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full h-11 sm:h-10 rounded-2xl border border-border bg-card px-4 text-base sm:text-sm font-data text-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
                  />
                </div>

                {/* Switch de Recurrencia */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div className="space-y-0.5">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">¿Es un cobro/gasto recurrente?</span>
                    <p className="text-[8px] sm:text-[9px] text-muted-foreground/60">Se imputará periódicamente de forma automática.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={txIsRecurring}
                    onChange={(e) => setTxIsRecurring(e.target.checked)}
                    className="w-5 h-5 sm:w-4 sm:h-4 rounded border-border accent-primary focus:ring-primary cursor-pointer shrink-0"
                  />
                </div>

                {txIsRecurring && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5"
                  >
                    <label htmlFor="tx-recurrence" className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Frecuencia</label>
                    <select
                      id="tx-recurrence"
                      value={txRecurrence}
                      onChange={(e) => setTxRecurrence(e.target.value as any)}
                      className="w-full h-11 sm:h-10 rounded-2xl border border-border bg-card px-3 text-base sm:text-sm text-foreground focus:outline-none focus:ring-1"
                    >
                      <option value="semanal">Semanal</option>
                      <option value="mensual">Mensual</option>
                      <option value="anual">Anual</option>
                    </select>
                  </motion.div>
                )}

                {/* Acciones del Formulario */}
                <div className="flex gap-3 border-t border-border pt-5 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="w-full rounded-2xl border-border bg-muted/20 hover:bg-muted/40 py-3 text-xs uppercase tracking-wider font-bold active:scale-95 transition-all"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/95 py-3 text-xs uppercase tracking-wider font-bold shadow-[0_4px_20px_rgba(var(--primary),0.15)] active:scale-95 transition-all"
                  >
                    Guardar
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
