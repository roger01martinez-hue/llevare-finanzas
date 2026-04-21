import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Trash2, 
  PlusCircle, 
  BarChart3, 
  Plus,
  Minus,
  Loader2,
  Lock,
  Mail,
  LogOut,
  ChevronRight,
  Save,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Area, ComposedChart, Bar 
} from 'recharts';
import * as XLSX from 'xlsx';

// Initialize Supabase
const supabase = createClient(
  'https://nvvddemynfovwowurnxi.supabase.co', 
  'sb_publishable_J8fdS8EQup3EacVEo3a97g_V4lFoQvJ'
);

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const formatCurrency = (val) => 
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const TrendChart = ({ data }) => {
  // Ensure we have data for all 12 months for a smooth chart
  const fullYearData = MONTHS.map(m => {
    const record = data.find(r => r.month === m);
    return {
      month: m.substring(0, 3),
      income: record?.income || 0,
      expenses: record?.expenses || 0,
      utility: record?.utility || 0
    };
  });

  return (
    <div className="glass-card" style={{ padding: '30px' }}>
      <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <TrendingUp size={20} color="var(--primary)" /> Rendimiento Anual
      </h3>
      <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer>
          <ComposedChart data={fullYearData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000000}M`} />
            <Tooltip 
              contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
              formatter={(value) => formatCurrency(value)}
            />
            <Legend verticalAlign="top" height={36}/>
            <Bar dataKey="income" name="Ingresos" fill="var(--success)" opacity={0.6} radius={[4, 4, 0, 0]} barSize={20} />
            <Bar dataKey="expenses" name="Gastos" fill="var(--danger)" opacity={0.6} radius={[4, 4, 0, 0]} barSize={20} />
            <Area type="monotone" dataKey="utility" name="Utilidad" stroke="var(--primary)" fill="rgba(59, 130, 246, 0.1)" strokeWidth={3} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authData, setAuthData] = useState({ email: '', password: '' });
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isExpanded, setIsExpanded] = useState({ income: false, expense: false });
  
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    month: MONTHS[new Date().getMonth()],
    incomeItems: [{ id: Date.now(), description: '', amount: '' }],
    expenseItems: [{ id: Date.now() + 1, description: '', amount: '' }]
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchRecords();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchRecords();
  }, [session]);

  const fetchRecords = async () => {
    const { data, error } = await supabase
      .from('finanzas_records')
      .select('*')
      .order('year', { ascending: true });

    if (!error && data) setRecords(data);
    setInitialLoad(true);
  };

  // Process data for charts and stats (DEFENSIVE)
  const processedRecords = useMemo(() => {
    if (!records || records.length === 0) return [];
    return records.map(r => {
      const inc = (r.income_items || []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const exp = (r.expense_items || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      return { ...r, income: inc, expenses: exp, utility: inc - exp };
    });
  }, [records]);

  const stats = useMemo(() => {
    const current = processedRecords.find(r => r.month === formData.month && r.year === Number(formData.year));
    const yearRecs = processedRecords.filter(r => r.year === Number(formData.year));
    const totalYearUtility = yearRecs.reduce((sum, r) => sum + (r.utility || 0), 0);

    return {
      monthIncome: current?.income || 0,
      monthExpenses: current?.expenses || 0,
      monthUtility: current?.utility || 0,
      yearAccumulated: totalYearUtility,
      displayMonth: formData.month
    };
  }, [processedRecords, formData]);

  const projections = useMemo(() => {
    const yearRecs = processedRecords.filter(r => r.year === Number(formData.year));
    if (yearRecs.length === 0) return { yearEnd: 0 };
    
    const avgMonthlyUtility = yearRecs.reduce((sum, r) => sum + r.utility, 0) / yearRecs.length;
    return {
      yearEnd: avgMonthlyUtility * 12
    };
  }, [processedRecords, formData.year]);

  const currentMonthRecord = useMemo(() => {
    return records.find(r => r.year === Number(formData.year) && r.month === formData.month);
  }, [records, formData.month, formData.year]);

  // Handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    let result;
    if (isRegistering) {
      result = await supabase.auth.signUp({ email: authData.email, password: authData.password });
      if (!result.error) alert("¡Registro exitoso! Ya puedes entrar.");
    } else {
      result = await supabase.auth.signInWithPassword({ email: authData.email, password: authData.password });
    }
    if (result.error) alert(result.error.message);
    setAuthLoading(false);
  };

  const deleteRecord = async (id) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este registro?")) {
      const { error } = await supabase.from('finanzas_records').delete().eq('id', id);
      if (!error) fetchRecords();
      else alert("Error: " + error.message);
    }
  };

  const handleItemChange = (type, id, field, value) => {
    const list = type === 'income' ? 'incomeItems' : 'expenseItems';
    setFormData(prev => ({
      ...prev,
      [list]: prev[list].map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const addItem = (type) => {
    const list = type === 'income' ? 'incomeItems' : 'expenseItems';
    setFormData(prev => ({
      ...prev,
      [list]: [...prev[list], { id: Date.now(), description: '', amount: '' }]
    }));
  };

  const removeItem = (type, id) => {
    const list = type === 'income' ? 'incomeItems' : 'expenseItems';
    if (formData[list].length > 1) {
      setFormData(prev => ({ ...prev, [list]: prev[list].filter(item => item.id !== id) }));
    }
  };

  const onClickGuardar = async () => {
    const newIncomes = formData.incomeItems.filter(item => item.description || item.amount);
    const newExpenses = formData.expenseItems.filter(item => item.description || item.amount);

    if (newIncomes.length === 0 && newExpenses.length === 0) {
      alert("No hay datos para guardar.");
      return;
    }

    const existing = records.find(r => r.year === Number(formData.year) && r.month === formData.month);
    const finalIncomes = existing ? [...(existing.income_items || []), ...newIncomes] : newIncomes;
    const finalExpenses = existing ? [...(existing.expense_items || []), ...newExpenses] : newExpenses;

    const newRecord = {
      user_id: session.user.id,
      year: Number(formData.year),
      month: formData.month,
      income_items: finalIncomes,
      expense_items: finalExpenses
    };

    const { error } = await supabase.from('finanzas_records').upsert(newRecord, { onConflict: 'year, month, user_id' });
    
    if (!error) {
      fetchRecords();
      setFormData(prev => ({
        ...prev,
        incomeItems: [{ id: Date.now(), description: '', amount: '' }],
        expenseItems: [{ id: Date.now() + 1, description: '', amount: '' }]
      }));
      alert("¡Datos guardados correctamente!");
    } else {
      alert("Error: " + error.message);
    }
  };

  const exportToExcel = () => {
    if (records.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const sortedRecords = [...records].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month);
    });

    const header = ['Concepto', ...sortedRecords.map(r => `${r.month} ${r.year}`)];
    const incomeConcepts = [...new Set(sortedRecords.flatMap(r => (r.income_items || []).map(i => i.description?.trim())))].filter(Boolean);
    const expenseConcepts = [...new Set(sortedRecords.flatMap(r => (r.expense_items || []).map(e => e.description?.trim())))].filter(Boolean);

    const matrixRows = [];

    // Incomes
    incomeConcepts.forEach(concept => {
      const row = [concept.charAt(0).toUpperCase() + concept.slice(1).toLowerCase()];
      sortedRecords.forEach(rec => {
        const total = (rec.income_items || []).filter(i => i.description?.trim() === concept).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
        row.push(total);
      });
      matrixRows.push(row);
    });

    const totalIncRow = ['TOTAL INGRESOS'];
    sortedRecords.forEach(rec => totalIncRow.push((rec.income_items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0)));
    matrixRows.push(totalIncRow, []);

    // Expenses
    expenseConcepts.forEach(concept => {
      const row = [concept.charAt(0).toUpperCase() + concept.slice(1).toLowerCase()];
      sortedRecords.forEach(rec => {
        const total = (rec.expense_items || []).filter(e => e.description?.trim() === concept).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        row.push(total);
      });
      matrixRows.push(row);
    });

    const totalExpRow = ['TOTAL GASTOS'];
    sortedRecords.forEach(rec => totalExpRow.push((rec.expense_items || []).reduce((s, e) => s + (Number(e.amount) || 0), 0)));
    matrixRows.push(totalExpRow, []);

    const subtotalRow = ['UTILIDAD NETA (SUBTOTAL)'];
    const accumulatedRow = ['TOTAL ACUMULADO'];
    let acc = 0;
    sortedRecords.forEach(rec => {
      const u = (rec.income_items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0) - (rec.expense_items || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      acc += u;
      subtotalRow.push(u);
      accumulatedRow.push(acc);
    });
    matrixRows.push(subtotalRow, accumulatedRow);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...matrixRows]);
    worksheet['!cols'] = header.map((_, i) => ({ wch: i === 0 ? 35 : 15 }));
    
    // Apply Formatting
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ c: C, r: R })];
        if (cell && cell.t === 'n') cell.z = '"$" #,##0';
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Balance");
    XLSX.writeFile(workbook, `Reporte_Llevare_${new Date().getFullYear()}.xlsx`);
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}><Loader2 className="animate-spin" color="var(--primary)" size={48} /></div>;

  if (!session) return (
    <div className="dashboard-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-card fade-in" style={{ padding: '50px', width: '100%', maxWidth: '450px', textAlign: 'center' }}>
        <div style={{ background: 'var(--primary)', width: '60px', height: '60px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 20px var(--primary-glow)' }}><Lock color="white" size={30} /></div>
        <h1 className="glow-text" style={{ fontSize: '2rem', marginBottom: '10px' }}>Bienvenido a Llevaré</h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '40px' }}>Inicia sesión para gestionar tus finanzas</p>
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '8px', display: 'block' }}>Correo Electrónico</label>
            <div style={{ position: 'relative' }}><Mail style={{ position: 'absolute', left: '12px', top: '14px' }} size={18} color="var(--text-dim)" /><input type="email" style={{ paddingLeft: '45px' }} value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})} required /></div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '8px', display: 'block' }}>Contraseña</label>
            <div style={{ position: 'relative' }}><Lock style={{ position: 'absolute', left: '12px', top: '14px' }} size={18} color="var(--text-dim)" /><input type="password" style={{ paddingLeft: '45px' }} value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} required /></div>
          </div>
          <button type="submit" className="primary" disabled={authLoading}>{authLoading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? 'Crear Cuenta' : 'Entrar')}</button>
        </form>
        <button onClick={() => setIsRegistering(!isRegistering)} style={{ background: 'none', color: 'var(--primary)', marginTop: '20px' }}>{isRegistering ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}</button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div><h1 className="glow-text" style={{ fontSize: '2.2rem', fontWeight: '700' }}>Finanzas <span style={{ color: 'var(--primary)' }}>Llevaré</span></h1><p style={{ color: 'var(--text-dim)' }}>{session.user.email}</p></div>
        <div style={{ display: 'flex', gap: '15px' }}><button onClick={exportToExcel} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', color: 'var(--success)', border: '1px solid rgba(52, 211, 153, 0.2)', fontWeight: 'bold' }}><FileSpreadsheet size={18} /> Excel</button><button onClick={() => supabase.auth.signOut()} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', background: 'none' }}><LogOut size={18} /> Salir</button></div>
      </div>

      <div className="kpi-grid">
        <StatCard title="Ingresos" value={formatCurrency(stats.monthIncome)} icon={<TrendingUp color="var(--success)" />} subtitle={stats.displayMonth} />
        <StatCard title="Gastos" value={formatCurrency(stats.monthExpenses)} icon={<TrendingDown color="var(--danger)" />} subtitle={stats.displayMonth} />
        <StatCard title="Utilidad" value={formatCurrency(stats.monthUtility)} icon={<DollarSign color="var(--primary)" />} subtitle="Mensual" />
        <StatCard title="Acumulado" value={formatCurrency(stats.yearAccumulated)} icon={<Calendar color="var(--primary)" />} subtitle="Del Año" />
        <StatCard title="Proyección" value={formatCurrency(projections.yearEnd)} icon={<BarChart3 color="#8b5cf6" />} subtitle="Fín de Año" />
      </div>

      <div className="charts-grid" style={{ gridTemplateColumns: '1.2fr 1.8fr' }}>
        <div className="glass-card" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}><h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}><PlusCircle size={22} color="var(--primary)" /> Gestionar</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
            <div><label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Año</label><input type="number" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} /></div>
            <div><label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Mes</label><select value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})}>{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><h3 style={{ color: 'var(--success)', margin: 0, fontSize: '1rem' }}>Ingresos</h3><button onClick={() => setIsExpanded({ ...isExpanded, income: !isExpanded.income })} style={{ fontSize: '0.7rem', color: 'var(--success)', background: 'none' }}>{isExpanded.income ? 'Cerrar' : 'Historial'}</button></div>
              {isExpanded.income && currentMonthRecord?.income_items?.map((it, idx) => <div key={idx} style={{ opacity: 0.5, fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}><span>• {it.description}</span><span>{formatCurrency(it.amount)}</span></div>)}
              {formData.incomeItems.map(it => <div key={it.id} style={{ display: 'flex', gap: '5px', marginTop: '10px' }}><input style={{ flex: 2 }} placeholder="Concepto" value={it.description} onChange={e => handleItemChange('income', it.id, 'description', e.target.value)} /><input style={{ flex: 1 }} type="number" placeholder="$" value={it.amount} onChange={e => handleItemChange('income', it.id, 'amount', e.target.value)} /><button onClick={() => removeItem('income', it.id)} style={{ color: 'var(--danger)', background: 'none' }}><Minus size={16} /></button></div>)}
              <button onClick={() => addItem('income')} style={{ marginTop: '10px', color: 'var(--success)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', background: 'none' }}><Plus size={14} /> Nuevo</button>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><h3 style={{ color: 'var(--danger)', margin: 0, fontSize: '1rem' }}>Gastos</h3><button onClick={() => setIsExpanded({ ...isExpanded, expense: !isExpanded.expense })} style={{ fontSize: '0.7rem', color: 'var(--danger)', background: 'none' }}>{isExpanded.expense ? 'Cerrar' : 'Historial'}</button></div>
              {isExpanded.expense && currentMonthRecord?.expense_items?.map((it, idx) => <div key={idx} style={{ opacity: 0.5, fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}><span>• {it.description}</span><span>{formatCurrency(it.amount)}</span></div>)}
              {formData.expenseItems.map(it => <div key={it.id} style={{ display: 'flex', gap: '5px', marginTop: '10px' }}><input style={{ flex: 2 }} placeholder="Concepto" value={it.description} onChange={e => handleItemChange('expense', it.id, 'description', e.target.value)} /><input style={{ flex: 1 }} type="number" placeholder="$" value={it.amount} onChange={e => handleItemChange('expense', it.id, 'amount', e.target.value)} /><button onClick={() => removeItem('expense', it.id)} style={{ color: 'var(--danger)', background: 'none' }}><Minus size={16} /></button></div>)}
              <button onClick={() => addItem('expense')} style={{ marginTop: '10px', color: 'var(--danger)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', background: 'none' }}><Plus size={14} /> Nuevo</button>
            </div>
          </div>
          <button onClick={onClickGuardar} className="primary" style={{ width: '100%', marginTop: '30px' }}>Guardar en la Nube</button>
        </div>
        <TrendChart data={processedRecords} />
      </div>

      <div className="glass-card" style={{ marginTop: '40px', padding: '30px', overflowX: 'auto' }}>
        <h2>Historial de Registros</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-dim)', textAlign: 'left' }}><th style={{ padding: '15px' }}>PERIODO</th><th style={{ padding: '15px' }}>INGRESOS</th><th style={{ padding: '15px' }}>GASTOS</th><th style={{ padding: '15px' }}>UTILIDAD</th><th style={{ padding: '15px' }}>ACCIONES</th></tr></thead>
          <tbody>
            {processedRecords.slice().reverse().map(rec => (
              <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '15px' }}><strong>{rec.month}</strong> {rec.year}</td>
                <td style={{ padding: '15px', color: 'var(--success)' }}>{formatCurrency(rec.income)}</td>
                <td style={{ padding: '15px', color: 'var(--danger)' }}>{formatCurrency(rec.expenses)}</td>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>{formatCurrency(rec.utility)}</td>
                <td style={{ padding: '15px' }}><button onClick={() => deleteRecord(rec.id)} style={{ color: 'var(--danger)', background: 'none' }}><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, subtitle }) {
  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div><p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{title}</p><h3 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '5px 0' }}>{value}</h3><p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{subtitle}</p></div>
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '18px' }}>{icon}</div>
    </div>
  );
}

export default App;
