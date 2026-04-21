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
  UserPlus,
  LogOut,
  ChevronRight,
  Save,
  CheckCircle2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

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

function App() {
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [authData, setAuthData] = useState({ email: '', password: '' });
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    month: MONTHS[new Date().getMonth()],
    incomeItems: [{ id: Date.now(), description: '', amount: '' }],
    expenseItems: [{ id: Date.now() + 1, description: '', amount: '' }]
  });

  // Check Session & Listen to Changes
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

    if (!error && data) {
      setRecords(data);
    }
    setInitialLoad(true);
  };

  // --- Persistence Logic ---
  
  // Save draft to localStorage whenever formData changes
  useEffect(() => {
    if (session && formData.incomeItems.length > 0) {
      setIsSavingDraft(true);
      const draftKey = `draft_${session.user.id}_${formData.year}_${formData.month}`;
      localStorage.setItem(draftKey, JSON.stringify(formData));
      
      const timer = setTimeout(() => setIsSavingDraft(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [formData, session]);

  // Sync Form with existing data or draft
  useEffect(() => {
    if (!session || !initialLoad) return;
    
    const existing = records.find(r => r.year === Number(formData.year) && r.month === formData.month);
    
    if (existing) {
      setFormData(prev => ({
        ...prev,
        incomeItems: existing.income_items || [],
        expenseItems: existing.expense_items || []
      }));
    } else {
      // Check for draft in localStorage before resetting
      const draftKey = `draft_${session.user.id}_${formData.year}_${formData.month}`;
      const savedDraft = localStorage.getItem(draftKey);
      
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        // Only apply if it matches current period to avoid race conditions
        if (parsed.year === formData.year && parsed.month === formData.month) {
          setFormData(parsed);
        }
      } else {
        setFormData(prev => ({
          ...prev,
          incomeItems: [{ id: Date.now(), description: '', amount: '' }],
          expenseItems: [{ id: Date.now() + 1, description: '', amount: '' }]
        }));
      }
    }
    // We only want to trigger this when period changes or records are refreshed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.month, formData.year, records, session]);

  // Auth Handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    let result;
    
    if (isRegistering) {
      result = await supabase.auth.signUp({
        email: authData.email,
        password: authData.password
      });
      if (!result.error) alert("¡Registro exitoso! Ya puedes entrar.");
    } else {
      result = await supabase.auth.signInWithPassword({
        email: authData.email,
        password: authData.password
      });
    }

    if (result.error) alert(result.error.message);
    setAuthLoading(false);
  };

  const handleLogout = () => supabase.auth.signOut();

  // Financial Calculations
  const processedRecords = useMemo(() => {
    const sorted = [...records].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month);
    });

    let yearlyAccumulated = {};
    return sorted.map(rec => {
      const income = rec.income_items?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;
      const expenses = rec.expense_items?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;
      const utility = income - expenses;
      yearlyAccumulated[rec.year] = (yearlyAccumulated[rec.year] || 0) + utility;
      return { ...rec, income, expenses, utility, accumulated: yearlyAccumulated[rec.year] };
    });
  }, [records]);

  const projections = useMemo(() => {
    if (processedRecords.length === 0) return { nextMonth: 0, yearEnd: 0, growth: 0 };
    const latest = processedRecords[processedRecords.length - 1];
    const previous = processedRecords.length > 1 ? processedRecords[processedRecords.length - 2] : null;
    const totalUtility = processedRecords.reduce((acc, curr) => acc + curr.utility, 0);
    const avgMonthly = totalUtility / processedRecords.length;
    const growth = previous ? latest.utility - previous.utility : 0;
    const nextMonth = latest.utility + growth;
    const curYear = new Date().getFullYear();
    const recordsThisYear = processedRecords.filter(r => r.year === curYear);
    const ytdActual = recordsThisYear.reduce((acc, curr) => acc + curr.utility, 0);
    const yearEnd = ytdActual + ((12 - recordsThisYear.length) * avgMonthly);
    return { nextMonth, yearEnd, growth };
  }, [processedRecords]);

  const displayMonth = formData.month;
  const displayYear = Number(formData.year);

  const stats = useMemo(() => {
    const record = processedRecords.find(r => r.year === displayYear && r.month === displayMonth) || { income: 0, expenses: 0, utility: 0 };
    const currentYearRecords = processedRecords.filter(r => r.year === displayYear);
    const totalAccumulated = currentYearRecords.reduce((acc, curr) => acc + curr.utility, 0);
    return {
      monthIncome: record.income,
      monthExpenses: record.expenses,
      monthUtility: record.utility,
      yearAccumulated: totalAccumulated,
      displayMonth,
      displayYear
    };
  }, [processedRecords, displayMonth, displayYear]);

  // Form Handlers
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

  const saveRecord = async (e) => {
    e.preventDefault();
    const newRecord = {
      user_id: session.user.id,
      year: Number(formData.year),
      month: formData.month,
      income_items: formData.incomeItems,
      expense_items: formData.expenseItems
    };
    const { error } = await supabase.from('finanzas_records').upsert(newRecord, { onConflict: 'year, month, user_id' });
    if (!error) {
      // Clear draft on success
      const draftKey = `draft_${session.user.id}_${formData.year}_${formData.month}`;
      localStorage.removeItem(draftKey);
      
      // Success feedback and reset
      setFormData(prev => ({
        ...prev,
        incomeItems: [{ id: Date.now(), description: '', amount: '' }],
        expenseItems: [{ id: Date.now() + 1, description: '', amount: '' }]
      }));
      
      alert("¡Datos guardados con éxito para " + formData.month + " " + formData.year + "!");
      setIsSuccess(true);
      fetchRecords();
    } else {
      alert("Error: " + error.message);
    }
  };

  const handleNextMonth = () => {
    const currentIndex = MONTHS.indexOf(formData.month);
    const nextIndex = (currentIndex + 1) % 12;
    const nextYear = nextIndex === 0 ? Number(formData.year) + 1 : formData.year;
    
    setFormData({
      ...formData,
      month: MONTHS[nextIndex],
      year: nextYear,
      incomeItems: [{ id: Date.now(), description: '', amount: '' }],
      expenseItems: [{ id: Date.now() + 1, description: '', amount: '' }]
    });
    setIsSuccess(false);
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <Loader2 className="animate-spin" color="var(--primary)" size={48} />
      </div>
    );
  }

  // --- LOGIN SCREEN ---
  if (!session) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="glass-card fade-in" style={{ padding: '50px', width: '100%', maxWidth: '450px', textAlign: 'center' }}>
          <div style={{ background: 'var(--primary)', width: '60px', height: '60px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 20px var(--primary-glow)' }}>
            <Lock color="white" size={30} />
          </div>
          <h1 className="glow-text" style={{ fontSize: '2rem', marginBottom: '10px' }}>Bienvenido a Llevaré</h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: '40px' }}>Inicia sesión para gestionar tus finanzas</p>
          
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '8px', display: 'block' }}>Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: '12px', top: '14px' }} size={18} color="var(--text-dim)" />
                <input 
                  type="email" 
                  style={{ paddingLeft: '45px' }} 
                  placeholder="tu@email.com"
                  value={authData.email}
                  onChange={e => setAuthData({...authData, email: e.target.value})}
                  required 
                />
              </div>
            </div>
            
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '8px', display: 'block' }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '12px', top: '14px' }} size={18} color="var(--text-dim)" />
                <input 
                  type="password" 
                  style={{ paddingLeft: '45px' }} 
                  placeholder="••••••••"
                  value={authData.password}
                  onChange={e => setAuthData({...authData, password: e.target.value})}
                  required 
                />
              </div>
            </div>

            <button type="submit" className="primary" style={{ marginTop: '10px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} disabled={authLoading}>
              {authLoading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? 'Crear Cuenta' : 'Entrar al Sistema')}
              {!authLoading && <ChevronRight size={18} />}
            </button>
          </form>

          <p style={{ marginTop: '30px', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {isRegistering ? '¿Ya tienes cuenta?' : '¿No tienes cuenta todavía?'}
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              style={{ background: 'none', color: 'var(--primary)', fontWeight: '600', marginLeft: '8px' }}
            >
              {isRegistering ? 'Inicia Sesión' : 'Regístrate aquí'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // --- DASHBOARD SCREEN ---
  return (
    <div className="dashboard-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ textAlign: 'left' }}>
           <h1 className="glow-text" style={{ fontSize: '2.2rem', fontWeight: '700' }}>Finanzas <span style={{ color: 'var(--primary)' }}>Llevaré</span></h1>
           <p style={{ color: 'var(--text-dim)' }}>Hola, {session.user.email}</p>
        </div>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '15px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <LogOut size={18} /> Cerrar Sesión
        </button>
      </div>

      <div className="kpi-grid">
        <StatCard title="Ingresos" value={formatCurrency(stats.monthIncome)} icon={<TrendingUp color="var(--success)" />} subtitle={stats.displayMonth} />
        <StatCard title="Gastos" value={formatCurrency(stats.monthExpenses)} icon={<TrendingDown color="var(--danger)" />} subtitle={stats.displayMonth} />
        <StatCard title="Utilidad Real" value={formatCurrency(stats.monthUtility)} icon={<DollarSign color="var(--primary)" />} subtitle={`Neto ${stats.displayMonth}`} isProfit={stats.monthUtility >= 0} />
        <StatCard title="Proyección Año" value={formatCurrency(projections.yearEnd)} icon={<BarChart3 color="#8b5cf6" />} subtitle="Estimado Diciembre" />
      </div>

      <div className="charts-grid" style={{ gridTemplateColumns: '1.2fr 1.8fr' }}>
        <div className="glass-card" style={{ padding: '30px', position: 'relative', overflow: 'hidden' }}>
          {isSuccess ? (
            <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px' }}>
               <div style={{ background: 'var(--success)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)' }}>
                  <CheckCircle2 color="white" size={40} />
               </div>
               <h2 className="glow-text" style={{ fontSize: '1.8rem', color: 'var(--success)', marginBottom: '10px' }}>¡Guardado con Éxito!</h2>
               <p style={{ color: 'var(--text-dim)', marginBottom: '40px' }}>Los datos de {formData.month} {formData.year} ya están en la nube.</p>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                  <button onClick={handleNextMonth} className="primary" style={{ height: '50px', fontSize: '1rem' }}>
                    Pasar al Siguiente Mes
                  </button>
                  <button onClick={() => setIsSuccess(false)} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--glass-border)', padding: '15px' }}>
                    Ver/Editar este mes
                  </button>
               </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                  <PlusCircle size={22} color="var(--primary)" /> Gestionar Periodo
                </h2>
                {isSavingDraft ? (
                  <div className="status-badge saving pulse">
                    <Save size={14} /> Guardando...
                  </div>
                ) : (
                  <div className="status-badge">
                    <CheckCircle2 size={14} color="var(--success)" /> Borrador listo
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Año</label>
                  <input type="number" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Mes</label>
                  <select value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})}>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ borderLeft: '3px solid var(--success)', paddingLeft: '15px' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '15px', color: 'var(--success)' }}>Detalle de Ingresos</h3>
                  {formData.incomeItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                      <input style={{ flex: 2 }} placeholder="Descripción" value={item.description} onChange={e => handleItemChange('income', item.id, 'description', e.target.value)} />
                      <input style={{ flex: 1 }} type="number" placeholder="$" value={item.amount} onChange={e => handleItemChange('income', item.id, 'amount', e.target.value)} />
                      <button onClick={() => removeItem('income', item.id)} style={{ color: 'var(--danger)', background: 'none' }}><Minus size={18} /></button>
                    </div>
                  ))}
                  <button onClick={() => addItem('income')} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: 'var(--success)', background: 'none', border: '1px dashed var(--success)', padding: '5px 10px', borderRadius: '8px' }}><Plus size={14} /> Añadir Ingreso</button>
                </div>
                <div style={{ borderLeft: '3px solid var(--danger)', paddingLeft: '15px' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '15px', color: 'var(--danger)' }}>Detalle de Gastos</h3>
                  {formData.expenseItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                      <input style={{ flex: 2 }} placeholder="Concepto" value={item.description} onChange={e => handleItemChange('expense', item.id, 'description', e.target.value)} />
                      <input style={{ flex: 1 }} type="number" placeholder="$" value={item.amount} onChange={e => handleItemChange('expense', item.id, 'amount', e.target.value)} />
                      <button onClick={() => removeItem('expense', item.id)} style={{ color: 'var(--danger)', background: 'none' }}><Minus size={18} /></button>
                    </div>
                  ))}
                  <button onClick={() => addItem('expense')} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: 'var(--danger)', background: 'none', border: '1px dashed var(--danger)', padding: '5px 10px', borderRadius: '8px' }}><Plus size={14} /> Añadir Gasto</button>
                </div>
              </div>
              <button onClick={saveRecord} className="primary" style={{ width: '100%', marginTop: '30px' }}>Guardar en la Nube</button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '25px', flex: 1 }}>
             <h2 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Comportamiento Comercial</h2>
             <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                  <BarChart data={processedRecords}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--text-dim)" fontSize={11} />
                    <YAxis stroke="var(--text-dim)" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px' }} />
                    <Legend />
                    <Bar dataKey="income" name="Ingresos" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Gastos" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
          <div className="glass-card" style={{ padding: '25px', flex: 1 }}>
             <h2 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Tendencia de Utilidad</h2>
             <div style={{ width: '100%', height: '200px' }}>
                <ResponsiveContainer>
                  <AreaChart data={processedRecords}>
                    <defs>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.4}/><stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" hide /><Tooltip contentStyle={{ background: '#0f172a', border: 'none' }} />
                    <Area type="monotone" dataKey="utility" stroke="var(--success)" fillOpacity={1} fill="url(#colorProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '40px', padding: '30px', overflowX: 'auto' }}>
          <h2 style={{ marginBottom: '20px' }}>Libro Mayor Personal</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-dim)', textAlign: 'left', fontSize: '0.8rem' }}>
                <th style={{ padding: '15px' }}>PERIODO</th><th style={{ padding: '15px' }}>CONCEPTOS</th><th style={{ padding: '15px' }}>TOTAL INGRESOS</th><th style={{ padding: '15px' }}>TOTAL GASTOS</th><th style={{ padding: '15px' }}>UTILIDAD</th><th style={{ padding: '15px' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {processedRecords.slice().reverse().map(rec => (
                <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '15px' }}><strong>{rec.month}</strong> {rec.year}</td>
                  <td style={{ padding: '15px', fontSize: '0.85rem' }}><div style={{ color: 'var(--text-dim)' }}>{rec.income_items?.length || 0} Ingresos | {rec.expense_items?.length || 0} Gastos</div></td>
                  <td style={{ padding: '15px', color: 'var(--success)' }}>{formatCurrency(rec.income)}</td>
                  <td style={{ padding: '15px', color: 'var(--danger)' }}>{formatCurrency(rec.expenses)}</td>
                  <td style={{ padding: '15px', fontWeight: 'bold', color: rec.utility >= 0 ? '#fff' : 'var(--danger)' }}>{formatCurrency(rec.utility)}</td>
                  <td style={{ padding: '15px' }}><button onClick={() => deleteRecord(rec.id)} style={{ color: 'var(--danger)', background: 'none' }}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, subtitle, isProfit = true }) {
  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{title}</p>
        <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '5px 0' }}>{value}</h3>
        <p style={{ fontSize: '0.75rem', color: isProfit ? 'var(--success)' : 'var(--danger)' }}>{subtitle}</p>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '18px' }}>
        {icon}
      </div>
    </div>
  );
}

export default App;
