import { getSupabase } from "./supabase";

export type Period = { tipo_periodo: "semanal" | "quinzenal"; numero_periodo: number; mes: number; ano: number };

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
  await Promise.all([ensureFastCarrier(), ensureHpjIsFortnightly()]);
  const [{ data: carriers, error: carrierError }, { data: receipts, error: receiptError }] = await Promise.all([
    db().from("transportadoras").select("id,nome,tipo_pagamento,ativo").eq("ativo", true).order("nome"),
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

export async function loadRiderSheet(period: Period) {
  const [{ data: riders, error: riderError }, { data: payments, error: paymentError }, { data: discounts, error: discountError }] = await Promise.all([
    db().from("motoboys").select("id,nome,tipo_pagamento,ativo").eq("ativo", true).order("nome"),
    db().from("pagamentos_motoboys").select("*").match(period),
    db().from("vales_extravios").select("id,motoboy_id,tipo,valor").eq("status", "pendente").eq("mes_desconto", period.mes).eq("ano_desconto", period.ano),
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

export async function loadCosts(mes: number, ano: number) {
  const { data, error } = await db().from("custos").select("*,socios(nome)").eq("mes", mes).eq("ano", ano).neq("status", "cancelado").order("data", { ascending: false });
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

export async function loadAdvances(mes: number, ano: number) {
  const { data, error } = await db().from("vales_extravios").select("*,motoboys(id,nome),socios(nome)").eq("mes_desconto", mes).eq("ano_desconto", ano).neq("status", "cancelado").order("data", { ascending: false });
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

export async function loadFinancialSummary(period: Period) {
  const [{ data: receipts, error: e1 }, { data: payments, error: e2 }, { data: costs, error: e3 }, { data: partners, error: e4 }] = await Promise.all([
    db().from("recebimentos_transportadoras").select("valor,status,recebido_por_socio_id").match(period).neq("status", "cancelado"),
    db().from("pagamentos_motoboys").select("valor_liquido,status,pago_por_socio_id").match(period).neq("status", "cancelado"),
    db().from("custos").select("valor,status,pago_por_socio_id").eq("mes", period.mes).eq("ano", period.ano).neq("status", "cancelado"),
    db().from("socios").select("id,nome,percentual_participacao").eq("ativo", true),
  ]);
  if (e1 || e2 || e3 || e4) throw e1 || e2 || e3 || e4;
  const received = (receipts ?? []).filter(x=>x.status==="recebido").reduce((a,x)=>a+Number(x.valor),0);
  const paidRiders = (payments ?? []).filter(x=>x.status==="pago").reduce((a,x)=>a+Number(x.valor_liquido),0);
  const paidCosts = (costs ?? []).filter(x=>x.status==="pago").reduce((a,x)=>a+Number(x.valor),0);
  const byPartner = (partners ?? []).map(p=>({ ...p, received:(receipts??[]).filter(x=>x.status==="recebido"&&x.recebido_por_socio_id===p.id).reduce((a,x)=>a+Number(x.valor),0), paid:(payments??[]).filter(x=>x.status==="pago"&&x.pago_por_socio_id===p.id).reduce((a,x)=>a+Number(x.valor_liquido),0)+(costs??[]).filter(x=>x.status==="pago"&&x.pago_por_socio_id===p.id).reduce((a,x)=>a+Number(x.valor),0) }));
  return { received, paidRiders, paidCosts, profit: received-paidRiders-paidCosts, partners: byPartner };
}

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
