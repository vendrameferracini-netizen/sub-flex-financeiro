import { getSupabase } from "./supabase";

export type Period = { tipo_periodo: "semanal" | "quinzenal"; numero_periodo: number; mes: number; ano: number };
export type WeeklyCalendarEntry = { ano: number; mes: number; numero_semana: number; data_inicio: string; data_fim: string; quinzena: 1 | 2 };

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase não configurado");
  return client;
}

export async function listPartners() {
  const { data, error } = await db().from("socios").select("id,nome,percentual_participacao").eq("ativo", true).order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function loadWeeklyCalendar(mes: number, ano: number) {
  const { data, error } = await db().from("calendario_competencias_semanais").select("ano,mes,numero_semana,data_inicio,data_fim,quinzena").eq("mes", mes).eq("ano", ano).order("numero_semana");
  if (error) throw error;
  return (data ?? []) as WeeklyCalendarEntry[];
}

export async function saveWeeklyCalendar(entries: WeeklyCalendarEntry[]) {
  if (!entries.length) return;
  const { error } = await db().from("calendario_competencias_semanais").upsert(entries, { onConflict: "ano,mes,numero_semana" });
  if (error) throw error;
}

export async function createCarrier(nome: string, tipoPagamento: "semanal" | "quinzenal") {
  const normalizedName = nome.trim().replace(/\s+/g, " ").toUpperCase();
  if (!normalizedName) throw new Error("Informe o nome da transportadora.");
  const { data: existing, error: lookupError } = await db()
    .from("transportadoras")
    .select("id")
    .ilike("nome", normalizedName)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) throw new Error("Esta transportadora já está cadastrada.");
  const { data, error } = await db()
    .from("transportadoras")
    .insert({ nome: normalizedName, tipo_pagamento: tipoPagamento, ativo: true })
    .select("id,nome,tipo_pagamento,ativo")
    .single();
  if (error?.code === "23505") throw new Error("Esta transportadora já está cadastrada.");
  if (error) throw error;
  return data;
}

export async function updateCarrier(id: string, nome: string, tipoPagamento: "semanal" | "quinzenal") {
  const normalizedName = nome.trim().replace(/\s+/g, " ").toUpperCase();
  if (!normalizedName) throw new Error("Informe o nome da transportadora.");
  const { data: duplicate, error: lookupError } = await db()
    .from("transportadoras")
    .select("id")
    .ilike("nome", normalizedName)
    .neq("id", id)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (duplicate) throw new Error("Esta transportadora já está cadastrada.");
  const { data, error } = await db()
    .from("transportadoras")
    .update({ nome: normalizedName, tipo_pagamento: tipoPagamento })
    .eq("id", id)
    .select("id,nome,tipo_pagamento,ativo")
    .single();
  if (error?.code === "23505") throw new Error("Esta transportadora já está cadastrada.");
  if (error) throw error;
  return data;
}

export async function setCarrierActive(id: string, ativo: boolean) {
  const { error } = await db().from("transportadoras").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function createRider(nome: string, tipoPagamento: "semanal" | "quinzenal") {
  const normalizedName = nome.trim().replace(/\s+/g, " ");
  if (!normalizedName) throw new Error("Informe o nome do motoboy.");
  const { data: existing, error: lookupError } = await db().from("motoboys").select("id").ilike("nome", normalizedName).limit(1).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) throw new Error("Este motoboy já está cadastrado.");
  const { data, error } = await db().from("motoboys").insert({ nome: normalizedName, tipo_pagamento: tipoPagamento, ativo: true }).select("id,nome,tipo_pagamento,ativo").single();
  if (error?.code === "23505") throw new Error("Este motoboy já está cadastrado.");
  if (error) throw error;
  return data;
}

export async function updateRider(id: string, nome: string, tipoPagamento: "semanal" | "quinzenal") {
  const normalizedName = nome.trim().replace(/\s+/g, " ");
  if (!normalizedName) throw new Error("Informe o nome do motoboy.");
  const { data: duplicate, error: lookupError } = await db().from("motoboys").select("id").ilike("nome", normalizedName).neq("id", id).limit(1).maybeSingle();
  if (lookupError) throw lookupError;
  if (duplicate) throw new Error("Este motoboy já está cadastrado.");
  const { data, error } = await db().from("motoboys").update({ nome: normalizedName, tipo_pagamento: tipoPagamento }).eq("id", id).select("id,nome,tipo_pagamento,ativo").single();
  if (error?.code === "23505") throw new Error("Este motoboy já está cadastrado.");
  if (error) throw error;
  return data;
}

export async function setRiderActive(id: string, ativo: boolean) {
  const { error } = await db().from("motoboys").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function riderHasHistory(id: string) {
  const [{ count: payments, error: paymentError }, { count: advances, error: advanceError }] = await Promise.all([
    db().from("pagamentos_motoboys").select("id", { count: "exact", head: true }).eq("motoboy_id", id),
    db().from("vales_extravios").select("id", { count: "exact", head: true }).eq("motoboy_id", id),
  ]);
  if (paymentError || advanceError) throw paymentError || advanceError;
  return Number(payments ?? 0) + Number(advances ?? 0) > 0;
}

export async function removeRiderSafely(id: string) {
  const { data, error } = await db().rpc("remover_motoboy_sem_historico", { p_motoboy_id: id });
  if (error) throw error;
  return Boolean(data);
}

async function ensureFastCarrier() {
  const { data, error } = await db()
    .from("transportadoras")
    .select("id,nome,tipo_pagamento,ativo")
    .ilike("nome", "FAST")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { error: insertError } = await db().from("transportadoras").insert({ nome: "FAST", tipo_pagamento: "quinzenal", ativo: true });
    if (insertError?.code !== "23505") {
      if (insertError) throw insertError;
    }
    return;
  }
  if (data.nome !== "FAST" || data.tipo_pagamento !== "quinzenal" || !data.ativo) {
    const { error: updateError } = await db().from("transportadoras").update({ nome: "FAST", tipo_pagamento: "quinzenal", ativo: true }).eq("id", data.id);
    if (updateError) throw updateError;
  }
}

async function ensureHpjIsFortnightly() {
  const { data, error } = await db()
    .from("transportadoras")
    .select("id,tipo_pagamento")
    .ilike("nome", "HPJ")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data && data.tipo_pagamento !== "quinzenal") {
    const { error: updateError } = await db().from("transportadoras").update({ tipo_pagamento: "quinzenal" }).eq("id", data.id);
    if (updateError) throw updateError;
  }
}

export async function loadCarrierSheet(period: Period) {
  const [{ data: carriers, error: carrierError }, { data: receipts, error: receiptError }] = await Promise.all([
    db().from("transportadoras").select("id,nome,tipo_pagamento,ativo").order("nome"),
    db().from("recebimentos_transportadoras").select("*").match(period),
  ]);
  if (carrierError) throw carrierError;
  if (receiptError) throw receiptError;
  return { carriers: carriers ?? [], receipts: receipts ?? [] };
}

export async function saveCarrierReceipts(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const { error } = await db().from("recebimentos_transportadoras").upsert(rows, { onConflict: "transportadora_id,tipo_periodo,numero_periodo,mes,ano" });
  if (error) throw error;
}

function samePeriod(a: Period, b: Period) {
  return a.tipo_periodo === b.tipo_periodo && a.numero_periodo === b.numero_periodo && a.mes === b.mes && a.ano === b.ano;
}

function periodReference(period: Period) {
  const requestedDay = period.tipo_periodo === "quinzenal" ? (period.numero_periodo === 1 ? 1 : 16) : 1 + (period.numero_periodo - 1) * 7;
  const lastDay = new Date(period.ano, period.mes, 0).getDate();
  const day = Math.min(requestedDay, lastDay);
  return `${period.ano}-${String(period.mes).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function periodDateRange(period: Period) {
  const lastDay = new Date(period.ano, period.mes, 0).getDate();
  const startDay = period.tipo_periodo === "quinzenal" ? (period.numero_periodo === 1 ? 1 : 16) : 1 + (period.numero_periodo - 1) * 7;
  const endDay = period.tipo_periodo === "quinzenal" ? (period.numero_periodo === 1 ? 15 : lastDay) : Math.min(startDay + 6, lastDay);
  const prefix = `${period.ano}-${String(period.mes).padStart(2, "0")}-`;
  return { start: `${prefix}${String(startDay).padStart(2, "0")}`, end: `${prefix}${String(endDay).padStart(2, "0")}` };
}

export async function previewCarrierReceiptMove(origin: Period, destination: Period) {
  if (samePeriod(origin, destination)) throw new Error("O período de destino deve ser diferente do período de origem.");
  const [{ data: source, error: sourceError }, { data: target, error: targetError }] = await Promise.all([
    db().from("recebimentos_transportadoras").select("transportadora_id").match(origin),
    db().from("recebimentos_transportadoras").select("transportadora_id").match(destination),
  ]);
  if (sourceError) throw sourceError;
  if (targetError) throw targetError;
  const sourceIds = [...new Set((source ?? []).map(row => row.transportadora_id))];
  if (!sourceIds.length) throw new Error("Não há lançamentos no período de origem.");
  const targetIds = new Set((target ?? []).map(row => row.transportadora_id));
  const conflictIds = sourceIds.filter(id => targetIds.has(id));
  let conflictNames: string[] = [];
  if (conflictIds.length) {
    const { data: carriers, error: carrierError } = await db().from("transportadoras").select("id,nome").in("id", conflictIds).order("nome");
    if (carrierError) throw carrierError;
    conflictNames = (carriers ?? []).map(carrier => carrier.nome);
  }
  return { count: sourceIds.length, conflictNames };
}

export async function moveCarrierReceipts(origin: Period, destination: Period) {
  const preview = await previewCarrierReceiptMove(origin, destination);
  if (preview.conflictNames.length) throw new Error(`Conflito no destino: ${preview.conflictNames.join(", ")}.`);
  const { data, error } = await db()
    .from("recebimentos_transportadoras")
    .update({ ...destination, data_referencia: periodReference(destination) })
    .match(origin)
    .select("id");
  if (error?.code === "23505") throw new Error("O período de destino recebeu lançamentos conflitantes. Nenhum registro foi movido.");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function loadRiderSheet(period: Period) {
  const [{ data: riders, error: riderError }, { data: payments, error: paymentError }, { data: discounts, error: discountError }] = await Promise.all([
    db().from("motoboys").select("id,nome,tipo_pagamento,ativo").order("nome"),
    db().from("pagamentos_motoboys").select("*").match(period),
    db().from("vales_extravios").select("id,motoboy_id,tipo,valor").eq("status", "pendente").eq("mes_desconto", period.mes).eq("ano_desconto", period.ano).eq("periodo_desconto", period.numero_periodo),
  ]);
  if (riderError) throw riderError;
  if (paymentError) throw paymentError;
  if (discountError) throw discountError;
  return { riders: riders ?? [], payments: payments ?? [], discounts: discounts ?? [] };
}

export async function saveRiderPayments(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const { error } = await db().from("pagamentos_motoboys").upsert(rows, { onConflict: "motoboy_id,tipo_periodo,numero_periodo,mes,ano" });
  if (error) throw error;
}

export async function signIn(email: string, password: string) {
  const { error } = await db().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() { await db().auth.signOut(); }

export async function currentUserId() {
  const { data } = await db().auth.getUser();
  return data.user?.id ?? null;
}

export async function loadCosts(period: Period) {
  const range = periodDateRange(period);
  const { data, error } = await db().from("custos").select("*,socios(nome)").eq("mes", period.mes).eq("ano", period.ano).gte("data", range.start).lte("data", range.end).neq("status", "cancelado").order("data", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveCost(value: Record<string, unknown>) {
  const user = await currentUserId();
  const payload = { ...value, created_by: user };
  const query = value.id ? db().from("custos").update(payload).eq("id", value.id) : db().from("custos").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function cancelRecord(table: "custos" | "vales_extravios" | "repasses_socios", id: string) {
  const { error } = await db().from(table).update({ status: "cancelado" }).eq("id", id);
  if (error) throw error;
}

export async function loadAdvances(period: Period) {
  const { data, error } = await db().from("vales_extravios").select("*,motoboys!inner(id,nome,tipo_pagamento),socios(nome)").eq("motoboys.tipo_pagamento", period.tipo_periodo).eq("mes_desconto", period.mes).eq("ano_desconto", period.ano).eq("periodo_desconto", period.numero_periodo).neq("status", "cancelado").order("data", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listRiders() {
  const { data, error } = await db().from("motoboys").select("id,nome,tipo_pagamento").eq("ativo", true).order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function saveAdvance(value: Record<string, unknown>) {
  const user = await currentUserId();
  const payload = { ...value, created_by: user };
  const query = value.id ? db().from("vales_extravios").update(payload).eq("id", value.id) : db().from("vales_extravios").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function loadSettings() {
  const { data, error } = await db().from("configuracoes").select("chave,valor");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(x => [x.chave, x.valor]));
}

export async function saveSettings(values: Record<string, string>) {
  const rows = Object.entries(values).map(([chave, valor]) => ({ chave, valor }));
  const { error } = await db().from("configuracoes").upsert(rows, { onConflict: "chave" });
  if (error) throw error;
}

async function loadSummaryRiderPayments(period: Period) {
  const columns = "id,valor_liquido,status,pago_por_socio_id";
  const { data: direct, error: directError } = await db().from("pagamentos_motoboys").select(columns).match(period).neq("status", "cancelado");
  if (directError) throw directError;
  if (period.tipo_periodo === "semanal") return { payments: direct ?? [], fortnightly: [], weekly: direct ?? [], includedWeeks: [period.numero_periodo] };

  const { data: calendar, error: calendarError } = await db().from("calendario_competencias_semanais").select("numero_semana").eq("mes", period.mes).eq("ano", period.ano).eq("quinzena", period.numero_periodo).order("numero_semana");
  if (calendarError) throw calendarError;
  const includedWeeks = [...new Set((calendar ?? []).map(row => Number(row.numero_semana)))];
  let weekly: typeof direct = [];
  if (includedWeeks.length) {
    const { data, error } = await db().from("pagamentos_motoboys").select(columns).eq("tipo_periodo", "semanal").eq("mes", period.mes).eq("ano", period.ano).in("numero_periodo", includedWeeks).neq("status", "cancelado");
    if (error) throw error;
    weekly = data ?? [];
  }
  const payments = [...new Map([...(direct ?? []), ...(weekly ?? [])].map(row => [row.id, row])).values()];
  return { payments, fortnightly: direct ?? [], weekly: weekly ?? [], includedWeeks };
}

export async function loadFinancialSummary(period: Period) {
  const range = periodDateRange(period);
  const [{ data: receipts, error: e1 }, riderSummary, { data: costs, error: e3 }, { data: partners, error: e4 }] = await Promise.all([
    db().from("recebimentos_transportadoras").select("valor,status,recebido_por_socio_id").match(period).neq("status", "cancelado"),
    loadSummaryRiderPayments(period),
    db().from("custos").select("valor,status,pago_por_socio_id").eq("mes", period.mes).eq("ano", period.ano).gte("data", range.start).lte("data", range.end).neq("status", "cancelado"),
    db().from("socios").select("id,nome,percentual_participacao").eq("ativo", true),
  ]);
  if (e1 || e3 || e4) throw e1 || e3 || e4;
  const payments = riderSummary.payments;
  const received = (receipts ?? []).filter(x=>x.status==="recebido").reduce((a,x)=>a+Number(x.valor),0);
  const paidRiders = (payments ?? []).filter(x=>x.status==="pago").reduce((a,x)=>a+Number(x.valor_liquido),0);
  const paidRidersFortnightly = riderSummary.fortnightly.filter(x=>x.status==="pago").reduce((a,x)=>a+Number(x.valor_liquido),0);
  const paidRidersWeekly = riderSummary.weekly.filter(x=>x.status==="pago").reduce((a,x)=>a+Number(x.valor_liquido),0);
  const paidCosts = (costs ?? []).filter(x=>x.status==="pago").reduce((a,x)=>a+Number(x.valor),0);
  const byPartner = (partners ?? []).map(p=>({ ...p, received:(receipts??[]).filter(x=>x.status==="recebido"&&x.recebido_por_socio_id===p.id).reduce((a,x)=>a+Number(x.valor),0), paid:(payments??[]).filter(x=>x.status==="pago"&&x.pago_por_socio_id===p.id).reduce((a,x)=>a+Number(x.valor_liquido),0)+(costs??[]).filter(x=>x.status==="pago"&&x.pago_por_socio_id===p.id).reduce((a,x)=>a+Number(x.valor),0) }));
  return { received, paidRiders, paidRidersFortnightly, paidRidersWeekly, includedWeeks: riderSummary.includedWeeks, paidCosts, profit: received-paidRiders-paidCosts, partners: byPartner };
}

export type BiFilters = { ano: number; mesInicial: number; mesFinal: number; socioId?: string | null };

export async function loadFinancialBI(filters: BiFilters) {
  const { ano, mesInicial, mesFinal, socioId } = filters;
  const [receiptsResult, paymentsResult, costsResult, advancesResult, partnersResult, calendarResult, closuresResult] = await Promise.all([
    db().from("recebimentos_transportadoras").select("id,valor,status,recebido_por_socio_id,tipo_periodo,numero_periodo,mes,ano,transportadoras(nome),socios(nome)").eq("ano", ano).gte("mes", mesInicial).lte("mes", mesFinal).neq("status", "cancelado"),
    db().from("pagamentos_motoboys").select("id,valor_liquido,valor_vales,valor_extravios,status,pago_por_socio_id,tipo_periodo,numero_periodo,mes,ano,motoboys(nome,tipo_pagamento),socios(nome)").eq("ano", ano).gte("mes", mesInicial).lte("mes", mesFinal).neq("status", "cancelado"),
    db().from("custos").select("id,descricao,valor,status,pago_por_socio_id,data,mes,ano,socios(nome)").eq("ano", ano).gte("mes", mesInicial).lte("mes", mesFinal).neq("status", "cancelado"),
    db().from("vales_extravios").select("id,tipo,valor,status,realizado_por_socio_id,periodo_desconto,mes_desconto,ano_desconto,motoboys(nome,tipo_pagamento)").eq("ano_desconto", ano).gte("mes_desconto", mesInicial).lte("mes_desconto", mesFinal).neq("status", "cancelado"),
    db().from("socios").select("id,nome,percentual_participacao").eq("ativo", true),
    db().from("calendario_competencias_semanais").select("mes,numero_semana,quinzena").eq("ano", ano).gte("mes", mesInicial).lte("mes", mesFinal),
    db().from("fechamentos").select("mes,ano,numero_periodo,status").eq("ano", ano).eq("tipo_periodo", "quinzenal").gte("mes", mesInicial).lte("mes", mesFinal),
  ]);
  const error = receiptsResult.error || paymentsResult.error || costsResult.error || advancesResult.error || partnersResult.error || calendarResult.error || closuresResult.error;
  if (error) throw error;
  const partners = partnersResult.data ?? [], calendar = calendarResult.data ?? [];
  const ownerMatches = (id: string | null) => !socioId || id === socioId;
  const periods = Array.from({ length: mesFinal - mesInicial + 1 }, (_, monthIndex) => [1, 2].map(numero => ({ mes: mesInicial + monthIndex, numero }))).flat();
  const rows = periods.map(({ mes, numero }) => {
    const includedWeeks = calendar.filter(item => item.mes === mes && item.quinzena === numero).map(item => Number(item.numero_semana));
    const receipts = (receiptsResult.data ?? []).filter(item => item.mes === mes && item.tipo_periodo === "quinzenal" && item.numero_periodo === numero && item.status === "recebido" && ownerMatches(item.recebido_por_socio_id));
    const fortnightlyPayments = (paymentsResult.data ?? []).filter(item => item.mes === mes && item.tipo_periodo === "quinzenal" && item.numero_periodo === numero && item.status === "pago" && ownerMatches(item.pago_por_socio_id));
    const weeklyPayments = (paymentsResult.data ?? []).filter(item => item.mes === mes && item.tipo_periodo === "semanal" && includedWeeks.includes(Number(item.numero_periodo)) && item.status === "pago" && ownerMatches(item.pago_por_socio_id));
    const payments = [...new Map([...fortnightlyPayments, ...weeklyPayments].map(item => [item.id, item])).values()];
    const startDay = numero === 1 ? 1 : 16, endDay = numero === 1 ? 15 : new Date(ano, mes, 0).getDate();
    const costs = (costsResult.data ?? []).filter(item => item.mes === mes && item.status === "pago" && Number(String(item.data).slice(8, 10)) >= startDay && Number(String(item.data).slice(8, 10)) <= endDay && ownerMatches(item.pago_por_socio_id));
    const advances = (advancesResult.data ?? []).filter(item => {
      if (item.mes_desconto !== mes || !ownerMatches(item.realizado_por_socio_id)) return false;
      const riderRelation = item.motoboys as unknown as { tipo_pagamento?: string } | { tipo_pagamento?: string }[] | null;
      const paymentType = Array.isArray(riderRelation) ? riderRelation[0]?.tipo_pagamento : riderRelation?.tipo_pagamento;
      return paymentType === "semanal"
        ? includedWeeks.includes(Number(item.periodo_desconto))
        : item.periodo_desconto === numero;
    });
    const receita = receipts.reduce((sum, item) => sum + Number(item.valor), 0);
    const motoboys = payments.reduce((sum, item) => sum + Number(item.valor_liquido), 0);
    const custos = costs.reduce((sum, item) => sum + Number(item.valor), 0);
    const vales = advances.filter(item => item.tipo === "vale").reduce((sum, item) => sum + Number(item.valor), 0);
    const extravios = advances.filter(item => item.tipo === "extravio").reduce((sum, item) => sum + Number(item.valor), 0);
    const lucro = receita - motoboys - custos;
    const hasMovement = receipts.length + payments.length + costs.length + advances.length > 0;
    const closure = (closuresResult.data ?? []).find(item => item.mes === mes && item.numero_periodo === numero);
    const partnerStats = partners.map(partner => ({ ...partner, received: receipts.filter(item => item.recebido_por_socio_id === partner.id).reduce((sum, item) => sum + Number(item.valor), 0), paid: payments.filter(item => item.pago_por_socio_id === partner.id).reduce((sum, item) => sum + Number(item.valor_liquido), 0) + costs.filter(item => item.pago_por_socio_id === partner.id).reduce((sum, item) => sum + Number(item.valor), 0) }));
    const carrierTotals = new Map<string, number>();
    for (const item of receipts) {
      const relation = item.transportadoras as unknown as { nome?: string } | { nome?: string }[] | null;
      const name = (Array.isArray(relation) ? relation[0]?.nome : relation?.nome) ?? "Não informada";
      carrierTotals.set(name, (carrierTotals.get(name) ?? 0) + Number(item.valor));
    }
    return { ano, mes, numero, label: `${String(monthNamesForBI[mes - 1])}/${String(ano).slice(2)} - ${numero}ª`, receita, motoboys, custos, vales, extravios, lucro, margem: receita ? lucro / receita * 100 : 0, includedWeeks, partners: partnerStats, carriers: [...carrierTotals].map(([nome, value]) => ({ nome, receita: value })), hasMovement, closed: Boolean(closure && closure.status !== "aberto"), details: { receipts, payments, costs, advances } };
  });
  const carriers = new Map<string, number>();
  for (const item of receiptsResult.data ?? []) if (item.status === "recebido" && ownerMatches(item.recebido_por_socio_id)) { const relation = item.transportadoras as unknown as { nome?: string } | { nome?: string }[] | null; const name = (Array.isArray(relation) ? relation[0]?.nome : relation?.nome) ?? "Não informada"; carriers.set(name, (carriers.get(name) ?? 0) + Number(item.valor)); }
  return { rows, carriers: [...carriers].map(([nome, receita]) => ({ nome, receita })).sort((a, b) => b.receita - a.receita), partners };
}

const monthNamesForBI = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function loadClosures(period: Period) {
  const { data, error } = await db().from("fechamentos").select("*,repasses_socios(*)").match(period).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveClosure(value: Record<string, unknown>) {
  const user = await currentUserId();
  const { data, error } = await db().from("fechamentos").upsert({ ...value, fechado_por: user, fechado_em: new Date().toISOString() }, { onConflict: "tipo_periodo,numero_periodo,mes,ano" }).select().single();
  if (error) throw error;
  return data;
}

export async function saveTransfer(value: Record<string, unknown>) {
  const user = await currentUserId();
  const { error } = await db().from("repasses_socios").insert({ ...value, created_by: user });
  if (error) throw error;
}
