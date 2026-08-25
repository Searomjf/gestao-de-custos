'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type CatalogItem = { id: string; name: string };
type Person = CatalogItem & { calculation_percentage: number; include_in_calculation: boolean };
type Expense = { id: string; title: string; category: string; person: string; origin: string; value: number; date: string; installment: number; installments: number; series: 'single'|'installment'|'fixed'; percentage: number; included: boolean };
const navItems = [['⌂','Início'],['◔','Resumo'],['▦','Parcelas'],['●','Categorias'],['♙','Pessoas'],['◇','Origens']] as const;
const money = (value:number) => value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const addMonths = (date:string,months:number) => { const value=new Date(`${date}T12:00:00`); value.setMonth(value.getMonth()+months); return value.toISOString().slice(0,10); };
const today = () => new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});

export default function Home() {
  const [user,setUser]=useState<User|null>(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [authMode,setAuthMode]=useState<'login'|'signup'>('login');
  const [authName,setAuthName]=useState(''); const [authEmail,setAuthEmail]=useState(''); const [authPassword,setAuthPassword]=useState(''); const [authNotice,setAuthNotice]=useState('');
  const [busy,setBusy]=useState(false); const [loadingData,setLoadingData]=useState(false);
  const [householdId,setHouseholdId]=useState(''); const [householdName,setHouseholdName]=useState('Minha casa'); const [displayName,setDisplayName]=useState('');
  const [categories,setCategories]=useState<CatalogItem[]>([]); const [people,setPeople]=useState<Person[]>([]); const [origins,setOrigins]=useState<CatalogItem[]>([]);
  const [expenses,setExpenses]=useState<Expense[]>([]); const [budget,setBudget]=useState(8000); const [activeTab,setActiveTab]=useState('Início'); const [notice,setNotice]=useState('');
  const [value,setValue]=useState(''); const [date,setDate]=useState(today()); const [category,setCategory]=useState(''); const [person,setPerson]=useState(''); const [origin,setOrigin]=useState(''); const [note,setNote]=useState(''); const [fixed,setFixed]=useState(false); const [installments,setInstallments]=useState(1);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setUser(data.session?.user??null);setAuthLoading(false);});
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user??null);setAuthLoading(false);});
    return ()=>data.subscription.unsubscribe();
  },[]);

  const loadWorkspace=useCallback(async(currentUser:User)=>{
    setLoadingData(true); setNotice('');
    try {
      const {data:membership,error:memberError}=await supabase.from('household_members').select('household_id').eq('user_id',currentUser.id).limit(1).maybeSingle();
      if(memberError) throw memberError;
      let homeId=membership?.household_id as string|undefined;
      const preferredName=String(currentUser.user_metadata?.display_name||currentUser.email?.split('@')[0]||'Usuário');
      if(!homeId){
        const {error:profileError}=await supabase.from('profiles').upsert({user_id:currentUser.id,display_name:preferredName}); if(profileError) throw profileError;
        const {data:home,error:homeError}=await supabase.from('households').insert({name:`Casa de ${preferredName}`,created_by:currentUser.id}).select('id').single(); if(homeError) throw homeError;
        homeId=home.id;
        const {error:joinError}=await supabase.from('household_members').insert({household_id:homeId,user_id:currentUser.id,role:'owner'}); if(joinError) throw joinError;
        const seeds=await Promise.all([
          supabase.from('household_settings').insert({household_id:homeId,monthly_limit:8000,alert_percentage:80,cutoff_day:0}),
          supabase.from('categories').insert([
            {household_id:homeId,name:'Alimentação',kind:'VARIAVEL',icon:'shopping_cart',color_hex:'#059669'},
            {household_id:homeId,name:'Transporte',kind:'VARIAVEL',icon:'directions_car',color_hex:'#1A365D'},
            {household_id:homeId,name:'Saúde',kind:'VARIAVEL',icon:'health',color_hex:'#DC6B5D'},
            {household_id:homeId,name:'Moradia',kind:'FIXO',icon:'home',color_hex:'#8250DF'},
            {household_id:homeId,name:'Assinatura',kind:'FIXO',icon:'subscriptions',color_hex:'#D97706'}]),
          supabase.from('financial_people').insert([
            {household_id:homeId,name:'Eu',calculation_percentage:100,include_in_calculation:true,is_default:true},
            {household_id:homeId,name:'Andressa',calculation_percentage:100,include_in_calculation:true,is_default:false},
            {household_id:homeId,name:'Os Dois',calculation_percentage:50,include_in_calculation:true,is_default:false}]),
          supabase.from('expense_sources').insert(['PIX','Cartão','Boleto','Dívida'].map(name=>({household_id:homeId,name})))
        ]);
        const failed=seeds.find(result=>result.error); if(failed?.error) throw failed.error;
      }
      const [profileResult,homeResult,categoryResult,peopleResult,originResult,settingsResult,expenseResult]=await Promise.all([
        supabase.from('profiles').select('display_name').eq('user_id',currentUser.id).maybeSingle(),
        supabase.from('households').select('name').eq('id',homeId).single(),
        supabase.from('categories').select('id,name').eq('household_id',homeId).order('name'),
        supabase.from('financial_people').select('id,name,calculation_percentage,include_in_calculation').eq('household_id',homeId).order('name'),
        supabase.from('expense_sources').select('id,name').eq('household_id',homeId).order('name'),
        supabase.from('household_settings').select('monthly_limit').eq('household_id',homeId).single(),
        supabase.from('expenses').select('id,amount,expense_date,occurrence_number,occurrence_count,note,category:categories(name),person:financial_people(name,calculation_percentage,include_in_calculation),origin:expense_sources(name),series:expense_series(kind)').eq('household_id',homeId).order('expense_date',{ascending:false})
      ]);
      const foundError=[profileResult,homeResult,categoryResult,peopleResult,originResult,settingsResult,expenseResult].find(result=>result.error)?.error; if(foundError) throw foundError;
      const cats=(categoryResult.data??[]) as CatalogItem[]; const persons=(peopleResult.data??[]).map(item=>({...item,calculation_percentage:Number(item.calculation_percentage)})) as Person[]; const sources=(originResult.data??[]) as CatalogItem[];
      setHouseholdId(homeId!); setHouseholdName(homeResult.data!.name); setDisplayName(profileResult.data?.display_name||preferredName); setCategories(cats); setPeople(persons); setOrigins(sources); setBudget(Number(settingsResult.data!.monthly_limit));
      setCategory(current=>current||cats[0]?.id||''); setPerson(current=>current||persons.find(item=>item.name==='Os Dois')?.id||persons[0]?.id||''); setOrigin(current=>current||sources.find(item=>item.name==='PIX')?.id||sources[0]?.id||'');
      type Row=Record<string,unknown>;
      setExpenses(((expenseResult.data??[]) as Row[]).map(row=>{
        const cat=row.category as {name?:string}|null; const per=row.person as {name?:string;calculation_percentage?:number;include_in_calculation?:boolean}|null; const source=row.origin as {name?:string}|null; const series=row.series as {kind?:string}|null;
        return {id:String(row.id),title:String(row.note||cat?.name||'Lançamento'),category:cat?.name||'Sem categoria',person:per?.name||'Pessoa',origin:source?.name||'Origem',value:Number(row.amount),date:String(row.expense_date),installment:Number(row.occurrence_number),installments:Number(row.occurrence_count),series:series?.kind==='FIXED_RECURRENCE'?'fixed':series?.kind==='INSTALLMENT'?'installment':'single',percentage:Number(per?.calculation_percentage??100),included:per?.include_in_calculation??true};
      }));
    } catch(error){setNotice(error instanceof Error?`Não foi possível carregar os dados: ${error.message}`:'Não foi possível carregar os dados.');}
    finally{setLoadingData(false);}
  },[]);
  useEffect(()=>{if(user) void loadWorkspace(user); else {setExpenses([]);setHouseholdId('');}},[user,loadWorkspace]);

  async function submitAuth(event:FormEvent){
    event.preventDefault(); setBusy(true); setAuthNotice('');
    try{
      if(authMode==='signup'){
        if(!authName.trim()) throw new Error('Informe seu nome.');
        const {data,error}=await supabase.auth.signUp({email:authEmail.trim(),password:authPassword,options:{data:{display_name:authName.trim()},emailRedirectTo:window.location.origin}}); if(error) throw error;
        if(!data.session) setAuthNotice('Conta criada. Abra o e-mail de confirmação e depois volte para entrar.');
      } else {const {error}=await supabase.auth.signInWithPassword({email:authEmail.trim(),password:authPassword}); if(error) throw error;}
    }catch(error){setAuthNotice(error instanceof Error?error.message:'Não foi possível continuar.');}finally{setBusy(false);}
  }

  async function signInWithGoogle(){
    setBusy(true); setAuthNotice('');
    const {error}=await supabase.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:window.location.origin}
    });
    if(error){setAuthNotice(`Não foi possível entrar com Google: ${error.message}`);setBusy(false);}
  }

  async function saveExpense(event:FormEvent){
    event.preventDefault(); if(!user||!householdId)return;
    const parsed=Number(value.replace(/\./g,'').replace(',','.')); if(!parsed||parsed<=0){setNotice('Informe um valor válido.');return;} if(!category||!person||!origin){setNotice('Preencha categoria, pessoa e origem.');return;}
    setBusy(true);setNotice('');
    try{
      const quantity=Math.max(1,Math.min(120,installments)); const kind=fixed?'FIXED_RECURRENCE':quantity>1?'INSTALLMENT':'SINGLE';
      const {data:series,error:seriesError}=await supabase.from('expense_series').insert({household_id:householdId,kind,original_amount:parsed,occurrence_count:quantity,start_date:date,created_by:user.id}).select('id').single(); if(seriesError) throw seriesError;
      const base=Math.floor((parsed/quantity)*100)/100;
      const rows=Array.from({length:quantity},(_,index)=>({household_id:householdId,series_id:series.id,category_id:category,financial_person_id:person,source_id:origin,amount:fixed?parsed:index===quantity-1?Math.round((parsed-base*(quantity-1))*100)/100:base,expense_date:addMonths(date,index),occurrence_number:index+1,occurrence_count:quantity,note:note.trim()||null,created_by:user.id}));
      const {error}=await supabase.from('expenses').insert(rows); if(error) throw error;
      setValue('');setNote('');setInstallments(1);setFixed(false);setNotice(quantity===1?'Lançamento salvo na nuvem.':`${quantity} ocorrências salvas na nuvem.`);await loadWorkspace(user);
    }catch(error){setNotice(error instanceof Error?`Não foi possível salvar: ${error.message}`:'Não foi possível salvar.');}finally{setBusy(false);}
  }
  function exportCsv(){
    const header=['ID','Data','Descrição','Valor','Categoria','Pessoa','Percentual','Origem','Parcela','Total de parcelas','Tipo'];
    const lines=expenses.map(item=>[item.id,item.date,item.title,item.value.toFixed(2),item.category,item.person,item.percentage,item.origin,item.installment,item.installments,item.series]);
    const csv=[header,...lines].map(row=>row.map(cell=>`"${String(cell).replaceAll('"','""')}"`).join(';')).join('\r\n');
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));link.download=`gestao-de-custos-${today()}.csv`;link.click();URL.revokeObjectURL(link.href);
  }

  const currentMonth=today().slice(0,7); const monthExpenses=useMemo(()=>expenses.filter(item=>item.date.startsWith(currentMonth)),[expenses,currentMonth]); const committed=useMemo(()=>monthExpenses.reduce((sum,item)=>sum+(item.included?item.value*item.percentage/100:0),0),[monthExpenses]); const gross=useMemo(()=>monthExpenses.reduce((sum,item)=>sum+item.value,0),[monthExpenses]); const commitment=budget?Math.min(100,Math.round(committed/budget*100)):0; const monthLabel=new Date(`${currentMonth}-02T12:00:00`).toLocaleDateString('pt-BR',{month:'long'});
  if(authLoading)return <main className="auth-shell"><div className="auth-card"><span className="brand-mark large">G</span><p>Preparando seu espaço…</p></div></main>;
  if(!user)return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark large">G</span><div><h1>Gestão de Custos</h1><p>Seus lançamentos seguros e acessíveis no Android e no iPhone.</p></div></div><button type="button" className="google-button" onClick={signInWithGoogle} disabled={busy}><span aria-hidden="true">G</span>Continuar com Google</button><div className="auth-divider"><span>ou use seu e-mail</span></div><div className="auth-tabs"><button className={authMode==='login'?'active':''} onClick={()=>setAuthMode('login')}>Entrar</button><button className={authMode==='signup'?'active':''} onClick={()=>setAuthMode('signup')}>Criar conta</button></div><form onSubmit={submitAuth} className="auth-form">{authMode==='signup'&&<label><span>Seu nome</span><input value={authName} onChange={e=>setAuthName(e.target.value)} autoComplete="name" required /></label>}<label><span>E-mail</span><input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} autoComplete="email" required /></label><label><span>Senha</span><input type="password" minLength={6} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} autoComplete={authMode==='login'?'current-password':'new-password'} required /></label><button className="save auth-submit" disabled={busy}>{busy?'Aguarde…':authMode==='login'?'Entrar':'Criar minha conta'}</button>{authNotice&&<p className="auth-notice" role="status">{authNotice}</p>}</form><small className="privacy-note">Cada casa possui uma área privada. Apenas usuários autorizados conseguem acessar os dados.</small></section></main>;
  const navigation=<>{navItems.map(([icon,label])=><button type="button" className={`nav-item ${activeTab===label?'active':''}`} key={label} onClick={()=>setActiveTab(label)}><span>{icon}</span><span>{label}</span></button>)}</>;
  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">G</span><span>Gestão de Custos</span></div><nav aria-label="Navegação principal">{navigation}</nav><div className="sidebar-foot"><span className="avatar">{displayName.charAt(0).toUpperCase()}</span><div><strong>{displayName}</strong><small>{householdName}</small></div><button type="button" className="logout" onClick={()=>supabase.auth.signOut()} title="Sair">↪</button></div></aside><section className="workspace"><header className="topbar"><div><p className="eyebrow">DADOS PROTEGIDOS NA NUVEM</p><h1>{activeTab==='Início'?`Olá, ${displayName.split(' ')[0]}`:activeTab}</h1></div><div className="status"><span /> {loadingData?'Sincronizando…':'Sincronizado'}</div></header>
  {activeTab==='Início'&&<div className="content-grid"><div className="primary-column"><section className="hero-card"><div><p className="eyebrow light">ORÇAMENTO DE {monthLabel.toUpperCase()}</p><h2>{money(committed)}</h2><p>comprometidos de {money(budget)}</p></div><div><div className="progress-label"><span>{commitment}% utilizado</span><strong>{money(Math.max(0,budget-committed))} disponíveis</strong></div><div className="progress"><span style={{width:`${commitment}%`}} /></div></div></section><section className="panel entry-panel"><div className="panel-title"><div><p className="eyebrow">NOVO LANÇAMENTO</p><h2>Registrar gasto</h2></div><button type="button" className="ai-button">✦ Ler comprovante com Gemini</button></div><form onSubmit={saveExpense}><div className="form-grid"><label className="value-field"><span>Valor do gasto</span><div><b>R$</b><input value={value} onChange={e=>setValue(e.target.value)} inputMode="decimal" placeholder="0,00" /></div></label><label><span>Data</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label><label><span>Categoria</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>Pessoa</span><select value={person} onChange={e=>setPerson(e.target.value)}>{people.map(item=><option value={item.id} key={item.id}>{item.name} ({item.calculation_percentage}%)</option>)}</select></label><label><span>Origem</span><select value={origin} onChange={e=>setOrigin(e.target.value)}>{origins.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>Observação</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Opcional" /></label><label><span>{fixed?'Quantidade de meses':'Quantidade de parcelas'}</span><input type="number" min="1" max="120" value={installments} onChange={e=>setInstallments(Number(e.target.value))} /></label></div><div className="form-footer"><label className="check"><input type="checkbox" checked={fixed} onChange={e=>setFixed(e.target.checked)} /> Custo fixo mensal</label><div className="actions"><button type="button" className="attach">＋ Anexar</button><button type="submit" className="save" disabled={busy}>{busy?'Salvando…':'Salvar lançamento'}</button></div></div>{notice&&<p className="form-notice" role="status">{notice}</p>}</form></section></div><aside className="secondary-column"><section className="panel recent-panel"><div className="panel-title"><div><p className="eyebrow">MOVIMENTAÇÕES</p><h2>Recentes</h2></div><button type="button" className="link-button" onClick={()=>setActiveTab('Resumo')}>Ver todas</button></div><div className="expense-list">{expenses.slice(0,5).map(item=><article className="expense" key={item.id}><span className="expense-icon">{item.category==='Alimentação'?'🛒':item.category==='Transporte'?'⛽':'⌁'}</span><div><strong>{item.title}</strong><small>{item.category} · {item.person} · {item.origin}{item.installments>1?` · ${item.installment}/${item.installments}`:''}</small></div><b>{money(item.value)}</b></article>)}{!expenses.length&&<p className="empty-copy">Seu primeiro lançamento aparecerá aqui.</p>}</div></section><section className="insight-card"><span className="insight-icon">↗</span><div><p className="eyebrow">REGRA PRESERVADA</p><h3>“Os Dois” calcula 50%</h3><p>O valor integral fica salvo; o comprometimento usa o percentual configurado.</p></div></section></aside></div>}
  {activeTab==='Resumo'&&<section className="panel full-panel"><div className="summary-cards"><div><small>Total bruto</small><strong>{money(gross)}</strong></div><div><small>Comprometido</small><strong>{money(committed)}</strong></div><div><small>Lançamentos</small><strong>{monthExpenses.length}</strong></div></div><div className="table-head"><h2>Lançamentos de {monthLabel}</h2><button type="button" className="attach" onClick={exportCsv}>Exportar CSV completo</button></div><div className="data-list">{monthExpenses.map(item=><article key={item.id}><span>{new Date(item.date+'T12:00:00').toLocaleDateString('pt-BR')}</span><strong>{item.title}</strong><small>{item.person} · {item.category}</small><b>{money(item.value)}</b></article>)}</div></section>}
  {activeTab==='Parcelas'&&<section className="panel full-panel"><div className="table-head"><div><p className="eyebrow">PROJEÇÃO</p><h2>Parcelas e custos futuros</h2></div></div><div className="data-list">{expenses.filter(item=>item.installments>1).map(item=><article key={item.id}><span>{new Date(item.date+'T12:00:00').toLocaleDateString('pt-BR')}</span><strong>{item.title}</strong><small>{item.series==='fixed'?'Custo fixo':'Parcelado'} · {item.installment}/{item.installments}</small><b>{money(item.value)}</b></article>)}</div></section>}
  {!['Início','Resumo','Parcelas'].includes(activeTab)&&<section className="panel empty-state"><span>{navItems.find(item=>item[1]===activeTab)?.[0]}</span><h2>{activeTab}</h2><p>Os dados desta área já são criados na nuvem. A edição visual será a próxima etapa.</p></section>}
  <nav className="mobile-nav" aria-label="Navegação móvel">{navItems.slice(0,4).map(([icon,label])=><button type="button" className={activeTab===label?'active':''} key={label} onClick={()=>setActiveTab(label)}><span>{icon}</span><small>{label}</small></button>)}</nav></section></main>;
}

