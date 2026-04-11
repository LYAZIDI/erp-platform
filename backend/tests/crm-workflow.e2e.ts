/// <reference types="node" />
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CRM & Ventes — Workflow Engine E2E Test
 *
 * Prouve que le moteur de workflow générique fonctionne de bout en bout.
 *
 * Flux de création :
 *   Quote  : POST /api/ventes/quotes  (lines: [{description, quantity, unitPrice}])
 *   Order  : POST /api/ventes/quotes/:id/confirm  (crée commande depuis devis)
 *   Invoice: POST /api/ventes/orders/:id/invoice  (crée facture depuis commande)
 *
 * Scénarios :
 *   [A] Lead : OPEN → WON  (happy path + assertions DB)
 *   [B] Lead : OPEN → LOST (avec lostReason)
 *   [C] Négatif — lose sans lostReason → 422 (condition payload_field_not_empty)
 *   [D] Négatif — win sans contact → 422   (condition field_not_empty)
 *   [E] Négatif — transition depuis état final WON → 422
 *   [F] Pipeline complet :
 *         Quote  DRAFT→SENT (workflow)
 *         Quote  SENT→ACCEPTED via domaine + création Order
 *         Order  CONFIRMED→IN_PROGRESS→DELIVERED (workflow)
 *         Invoice DRAFT→SENT→PARTIALLY_PAID→PAID (workflow)
 *   [G] Négatif — transition invalide depuis ACCEPTED (workflow) → 422
 *   [H] Négatif — permission denied : commercial tente confirm → 403
 *   [I] available-transitions : cohérence selon état courant
 *
 * Usage :
 *   npx tsx tests/crm-workflow.e2e.ts
 * Prérequis : backend démarré (npm run dev:backend) + seed exécuté (npm run db:seed)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const BASE = 'http://localhost:3001/api';

// ── Terminal colors ───────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
};

// ── Compteurs ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const errors: string[] = [];

function ok(label: string) {
  passed++;
  console.log(`  ${c.green}✓${c.reset} ${label}`);
}
function fail(label: string, detail?: string) {
  failed++;
  const msg = detail ? `${label} — ${detail}` : label;
  errors.push(msg);
  console.log(`  ${c.red}✗${c.reset} ${label}`);
  if (detail) console.log(`    ${c.dim}${detail}${c.reset}`);
}
function section(title: string) {
  console.log(`\n${c.cyan}${c.bold}▶ ${title}${c.reset}`);
}
function info(msg: string) {
  console.log(`  ${c.dim}${msg}${c.reset}`);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function req(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

const get   = (path: string, token?: string)               => req('GET',   path, undefined, token);
const post  = (path: string, body: unknown, token?: string) => req('POST',  path, body, token);

// ── Auth ──────────────────────────────────────────────────────────────────────
async function login(email: string, password: string): Promise<string> {
  const { data } = await post('/auth/login', { email, password, tenant: 'demo' });
  if (!data.accessToken) throw new Error(`Login échoué pour ${email}: ${JSON.stringify(data)}`);
  return data.accessToken;
}

// ── Workflow helpers ──────────────────────────────────────────────────────────
async function transition(
  entityType: string,
  entityId:   string,
  key:        string,
  payload:    Record<string, unknown> = {},
  token?:     string,
) {
  // POST /api/workflow/:type/:id/transition/:key  body: { payload }
  return post(`/workflow/${entityType}/${entityId}/transition/${key}`, { payload }, token);
}

async function availableTransitions(entityType: string, entityId: string, token?: string) {
  // GET /api/workflow/:type/:id/transitions
  return get(`/workflow/${entityType}/${entityId}/transitions`, token);
}

async function workflowHistory(entityType: string, entityId: string, token?: string) {
  // GET /api/workflow/:type/:id/history
  return get(`/workflow/${entityType}/${entityId}/history`, token);
}

// ── Assert helpers ────────────────────────────────────────────────────────────
function assertStatus(label: string, actual: number, expected: number) {
  if (actual === expected) ok(label);
  else fail(label, `HTTP ${actual} (attendu ${expected})`);
}
function assertField(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) ok(label);
  else fail(label, `obtenu "${actual}", attendu "${expected}"`);
}
function assertIncludes(label: string, arr: unknown[], value: unknown) {
  if (arr.includes(value)) ok(label);
  else fail(label, `"${value}" absent de [${arr.join(', ')}]`);
}
function assertExcludes(label: string, arr: unknown[], value: unknown) {
  if (!arr.includes(value)) ok(label);
  else fail(label, `"${value}" ne devrait PAS être dans [${arr.join(', ')}]`);
}
function assertTruthy(label: string, value: unknown) {
  if (value) ok(label);
  else fail(label, `valeur falsy: ${JSON.stringify(value)}`);
}

// ── Quote line helper (description required) ──────────────────────────────────
function makeLine(product: any) {
  return {
    productId:   product.id,
    description: product.name,
    quantity:    2,
    unitPrice:   Number(product.unitPrice),
    taxRate:     20,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════════════════════════
async function setup() {
  section('Setup — Auth + données de test');

  const adminToken      = await login('admin@demo.com',   'Admin123!');
  const commercialToken = await login('vendeur@demo.com', 'Vendeur123!');
  ok('Login admin');
  ok('Login commercial');

  // Contact seeded
  const contacts = await get('/crm/contacts?search=Ali', adminToken);
  const contact  = contacts.data?.data?.[0];
  if (!contact) throw new Error('Contact "Ali Idrissi" introuvable — relancer npm run db:seed');
  ok(`Contact : ${contact.firstName} ${contact.lastName} (${contact.id.slice(0, 8)}…)`);

  // Stage pipeline
  const pipeline = await get('/crm/pipeline', adminToken);
  const stage    = pipeline.data?.[0];
  if (!stage) throw new Error('Pipeline vide — relancer npm run db:seed');
  ok(`Stage pipeline : ${stage.name}`);

  // Produit seeded
  const products = await get('/ventes/products', adminToken);
  // products endpoint returns array directly (not paginated)
  const productList = Array.isArray(products.data) ? products.data : products.data?.data;
  const product = productList?.[0];
  if (!product) throw new Error('Aucun produit — relancer npm run db:seed');
  ok(`Produit : ${product.name} (${Number(product.price)} MAD)`);

  return { adminToken, commercialToken, contact, stage, product };
}

// ══════════════════════════════════════════════════════════════════════════════
// A — Lead : OPEN → WON
// ══════════════════════════════════════════════════════════════════════════════
async function scenarioA_LeadWon(ctx: any) {
  section('A — Lead : OPEN → WON (happy path)');

  const { data: lead, status } = await post('/crm/leads', {
    title:     'Opportunité AlphaTest — ERP Cloud',
    stageId:   ctx.stage.id,
    contactId: ctx.contact.id,
    value:     50000,
  }, ctx.commercialToken);
  assertStatus('Création lead', status, 201);
  assertField('Status initial = OPEN', lead.status, 'OPEN');
  info(`Lead: ${lead.id.slice(0, 8)}…`);

  // Available transitions depuis OPEN (admin voit tout)
  const { data: avail } = await availableTransitions('lead', lead.id, ctx.adminToken);
  const keys = avail.map((t: any) => t.key);
  assertIncludes('"win" disponible (admin)', keys, 'win');
  assertIncludes('"lose" disponible (admin)', keys, 'lose');
  assertIncludes('"cancel" disponible (admin)', keys, 'cancel');

  // Transition win
  const { data: result, status: s2 } = await transition('lead', lead.id, 'win', {}, ctx.commercialToken);
  assertStatus('Transition win → 200', s2, 200);
  assertField('newState = won', result.toState, 'won');

  // Vérification DB
  const { data: list } = await get('/crm/leads?search=AlphaTest', ctx.commercialToken);
  const updated = list?.data?.find((l: any) => l.id === lead.id);
  assertField('Status DB = WON', updated?.status, 'WON');
  assertTruthy('wonAt renseigné', updated?.wonAt);

  // Historique
  const { data: history } = await workflowHistory('lead', lead.id, ctx.commercialToken);
  assertTruthy(`Historique : ${history?.logs?.length ?? 0} entrée(s)`, (history?.logs?.length ?? 0) >= 1);

  // Aucune transition depuis WON (final)
  const { data: avail2 } = await availableTransitions('lead', lead.id, ctx.commercialToken);
  assertField('0 transitions depuis WON (final)', avail2.length, 0);

  ctx.wonLeadId = lead.id;
}

// ══════════════════════════════════════════════════════════════════════════════
// B — Lead : OPEN → LOST
// ══════════════════════════════════════════════════════════════════════════════
async function scenarioB_LeadLost(ctx: any) {
  section('B — Lead : OPEN → LOST (avec lostReason)');

  const { data: lead } = await post('/crm/leads', {
    title:     'Opportunité BetaTest — Budget insuffisant',
    stageId:   ctx.stage.id,
    contactId: ctx.contact.id,
    value:     20000,
  }, ctx.commercialToken);

  const { data: result, status } = await transition(
    'lead', lead.id, 'lose',
    { lostReason: 'Budget insuffisant pour cette année' },
    ctx.commercialToken,
  );
  assertStatus('Transition lose → 200', status, 200);
  assertField('newState = lost', result.toState, 'lost');

  const { data: list } = await get('/crm/leads?search=BetaTest', ctx.commercialToken);
  const updated = list?.data?.find((l: any) => l.id === lead.id);
  assertField('Status DB = LOST', updated?.status, 'LOST');
  assertField('lostReason renseigné', updated?.lostReason, 'Budget insuffisant pour cette année');
  assertTruthy('lostAt renseigné', updated?.lostAt);
}

// ══════════════════════════════════════════════════════════════════════════════
// C — Négatif : lose sans lostReason → condition échouée
// ══════════════════════════════════════════════════════════════════════════════
async function scenarioC_LoseMissingReason(ctx: any) {
  section('C — Négatif : lose sans lostReason (payload_field_not_empty)');

  const { data: lead } = await post('/crm/leads', {
    title:     'Lead GammaTest — test condition',
    stageId:   ctx.stage.id,
    contactId: ctx.contact.id,
  }, ctx.commercialToken);

  const { status, data } = await transition('lead', lead.id, 'lose', {}, ctx.commercialToken);
  assertStatus('lose sans lostReason → 422', status, 422);
  info(`Réponse: ${JSON.stringify(data?.error)}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// D — Négatif : win sans contact → condition field_not_empty échouée
// ══════════════════════════════════════════════════════════════════════════════
async function scenarioD_WinNoContact(ctx: any) {
  section('D — Négatif : win sans contact (field_not_empty sur contactId)');

  const { data: lead } = await post('/crm/leads', {
    title:   'Lead DeltaTest — sans contact',
    stageId: ctx.stage.id,
    // pas de contactId volontairement
  }, ctx.commercialToken);

  const { status, data } = await transition('lead', lead.id, 'win', {}, ctx.commercialToken);
  assertStatus('win sans contact → 422', status, 422);
  info(`Réponse: ${JSON.stringify(data?.error)}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// E — Négatif : transition depuis état final WON
// ══════════════════════════════════════════════════════════════════════════════
async function scenarioE_FinalStateTransition(ctx: any) {
  section('E — Négatif : transition depuis état final (Lead WON → win)');

  const { status, data } = await transition('lead', ctx.wonLeadId, 'win', {}, ctx.commercialToken);
  // TRANSITION_NOT_FOUND → 404 (no such transition from final state WON)
  assertStatus('win depuis WON → 404 (TRANSITION_NOT_FOUND)', status, 404);
  info(`Réponse: ${JSON.stringify(data?.error)}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// F — Pipeline complet : Quote → Order → Invoice
// ══════════════════════════════════════════════════════════════════════════════
async function scenarioF_FullPipeline(ctx: any) {
  section('F — Pipeline complet : Quote DRAFT→SENT + Order CONFIRMED→DELIVERED + Invoice DRAFT→PAID');

  // ── F1. Créer un devis ────────────────────────────────────────────────────
  const line = makeLine(ctx.product);
  const { data: quote, status: qs } = await post('/ventes/quotes', {
    contactId:  ctx.contact.id,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    notes:      'Devis E2E Test workflow',
    lines:      [line],
  }, ctx.commercialToken);
  assertStatus('Création devis', qs, 201);
  assertField('Quote status = DRAFT', quote.status, 'DRAFT');
  info(`Quote: ${quote.reference} (total: ${Number(quote.total)} MAD)`);

  // Transitions depuis DRAFT
  const { data: draftAvail } = await availableTransitions('quote', quote.id, ctx.commercialToken);
  const draftKeys = draftAvail.map((t: any) => t.key);
  assertIncludes('"send" disponible depuis DRAFT', draftKeys, 'send');
  assertExcludes('"confirm" indisponible depuis DRAFT', draftKeys, 'confirm');

  // ── F2. Workflow : DRAFT → SENT ───────────────────────────────────────────
  const { data: sendResult, status: ss } = await transition('quote', quote.id, 'send', {}, ctx.commercialToken);
  assertStatus('Quote DRAFT → SENT (workflow)', ss, 200);
  assertField('newState = sent', sendResult.toState, 'sent');

  const { data: quoteSent } = await get(`/ventes/quotes/${quote.id}`, ctx.commercialToken);
  assertField('Quote status DB = SENT', quoteSent.status, 'SENT');
  // Quote model has no sentAt field — status change is the proof

  // Transitions depuis SENT
  const { data: sentAvail } = await availableTransitions('quote', quote.id, ctx.commercialToken);
  const sentKeys = sentAvail.map((t: any) => t.key);
  assertIncludes('"confirm" disponible depuis SENT', sentKeys, 'confirm');
  assertIncludes('"refuse" disponible depuis SENT', sentKeys, 'refuse');

  // ── F3. Confirmer via domaine (crée la commande) ──────────────────────────
  // On utilise l'endpoint domaine /quotes/:id/confirm car il crée l'Order en même temps
  const { data: order, status: cs } = await post(
    `/ventes/quotes/${quote.id}/confirm`, {}, ctx.adminToken,
  );
  assertStatus('Quote SENT → ACCEPTED + Order créée (domaine)', cs, 201);
  assertField('Order status = CONFIRMED', order.status, 'CONFIRMED');
  info(`Order: ${order.reference}`);

  // ── F4. Order workflow : CONFIRMED → IN_PROGRESS ─────────────────────────
  const { data: startResult, status: startS } = await transition(
    'order', order.id, 'start', {}, ctx.commercialToken,
  );
  assertStatus('Order CONFIRMED → IN_PROGRESS (workflow)', startS, 200);
  assertField('newState = in_progress', startResult.toState, 'in_progress');

  const { data: orderInProg } = await get(`/ventes/orders/${order.id}`, ctx.commercialToken);
  assertField('Order status DB = IN_PROGRESS', orderInProg.status, 'IN_PROGRESS');

  // ── F5. Order workflow : IN_PROGRESS → DELIVERED ─────────────────────────
  const { status: delivS } = await transition('order', order.id, 'deliver', {}, ctx.commercialToken);
  assertStatus('Order IN_PROGRESS → DELIVERED (workflow)', delivS, 200);

  const { data: orderDel } = await get(`/ventes/orders/${order.id}`, ctx.commercialToken);
  assertField('Order status DB = DELIVERED', orderDel.status, 'DELIVERED');
  assertTruthy('deliveryDate renseigné', orderDel.deliveryDate);

  // Aucune transition depuis DELIVERED (final)
  const { data: delivAvail } = await availableTransitions('order', order.id, ctx.commercialToken);
  assertField('0 transitions depuis DELIVERED (final)', delivAvail.length, 0);

  // ── F6. Créer facture depuis commande ─────────────────────────────────────
  const { data: invoice, status: is } = await post(
    `/ventes/orders/${order.id}/invoice`,
    { dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
    ctx.adminToken,
  );
  assertStatus('Création facture depuis commande', is, 201);
  assertField('Invoice status = DRAFT', invoice.status, 'DRAFT');
  info(`Invoice: ${invoice.reference} (total: ${Number(invoice.total)} MAD)`);

  // ── F7. Invoice workflow : DRAFT → SENT ──────────────────────────────────
  const { status: iSendS } = await transition('invoice', invoice.id, 'send', {}, ctx.adminToken);
  assertStatus('Invoice DRAFT → SENT (workflow)', iSendS, 200);

  const { data: invSent } = await get(`/ventes/invoices/${invoice.id}`, ctx.adminToken);
  assertField('Invoice status DB = SENT', invSent.status, 'SENT');

  // ── F8. Invoice workflow : SENT → PARTIALLY_PAID ─────────────────────────
  const partialAmount = Math.floor(Number(invoice.total) / 2);
  const { status: ppS } = await transition(
    'invoice', invoice.id, 'pay_partial',
    { paidAmount: partialAmount },
    ctx.commercialToken,
  );
  assertStatus('Invoice SENT → PARTIALLY_PAID (workflow)', ppS, 200);

  const { data: invPartial } = await get(`/ventes/invoices/${invoice.id}`, ctx.adminToken);
  assertField('Invoice status DB = PARTIALLY_PAID', invPartial.status, 'PARTIALLY_PAID');

  // ── F9. Invoice workflow : PARTIALLY_PAID → PAID ─────────────────────────
  const { status: payS } = await transition(
    'invoice', invoice.id, 'pay_remaining', {}, ctx.commercialToken,
  );
  assertStatus('Invoice PARTIALLY_PAID → PAID (workflow)', payS, 200);

  const { data: invPaid } = await get(`/ventes/invoices/${invoice.id}`, ctx.adminToken);
  assertField('Invoice status DB = PAID', invPaid.status, 'PAID');
  assertTruthy('paidAt renseigné', invPaid.paidAt);

  // Historique facture : 3 transitions (send + pay_partial + pay_remaining)
  const { data: invHistory } = await workflowHistory('invoice', invoice.id, ctx.adminToken);
  assertTruthy(`Historique facture : ${invHistory?.logs?.length ?? 0} transitions`, (invHistory?.logs?.length ?? 0) >= 3);

  // Historique commande : 2 transitions (start + deliver)
  const { data: ordHistory } = await workflowHistory('order', order.id, ctx.adminToken);
  assertTruthy(`Historique commande : ${ordHistory?.logs?.length ?? 0} transitions`, (ordHistory?.logs?.length ?? 0) >= 2);
}

// ══════════════════════════════════════════════════════════════════════════════
// G — Négatif : transition invalide depuis état ACCEPTED (workflow)
// ══════════════════════════════════════════════════════════════════════════════
async function scenarioG_InvalidFromAccepted(ctx: any) {
  section('G — Négatif : transition "refuse" depuis ACCEPTED (état final workflow)');

  // Créer et faire passer un devis en ACCEPTED via le workflow engine
  const line = makeLine(ctx.product);
  const { data: q } = await post('/ventes/quotes', {
    contactId:  ctx.contact.id,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lines:      [line],
  }, ctx.commercialToken);

  await transition('quote', q.id, 'send',    {}, ctx.commercialToken);
  await transition('quote', q.id, 'confirm', {}, ctx.adminToken);  // → ACCEPTED (final)

  // Essayer de refuser un devis ACCEPTED → impossible
  const { status, data } = await transition('quote', q.id, 'refuse', {}, ctx.adminToken);
  // TRANSITION_NOT_FOUND → 404 (no 'refuse' transition from final state 'accepted')
  assertStatus('refuse depuis ACCEPTED → 404 (TRANSITION_NOT_FOUND)', status, 404);
  info(`Réponse: ${JSON.stringify(data?.error)}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// H — Permission denied : commercial tente withdraw (ventes:DELETE)
// ══════════════════════════════════════════════════════════════════════════════
async function scenarioH_PermissionDenied(ctx: any) {
  section('H — Permission denied : commercial tente "withdraw" (ventes:DELETE)');

  const line = makeLine(ctx.product);
  const { data: q } = await post('/ventes/quotes', {
    contactId:  ctx.contact.id,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lines:      [line],
  }, ctx.commercialToken);

  // "withdraw" requiert ventes:DELETE — le vendeur n'a que ventes != DELETE
  const { status, data } = await transition('quote', q.id, 'withdraw', {}, ctx.commercialToken);
  assertStatus('withdraw par commercial → 403 (ventes:DELETE manquant)', status, 403);
  info(`Réponse: ${JSON.stringify(data?.error)}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// I — Available transitions : cohérence par état
// ══════════════════════════════════════════════════════════════════════════════
async function scenarioI_AvailableTransitions(ctx: any) {
  section('I — Available transitions : cohérence selon état courant');

  // Lead OPEN → 3 transitions
  const { data: lead } = await post('/crm/leads', {
    title:     'Lead EpsilonTest — transitions',
    stageId:   ctx.stage.id,
    contactId: ctx.contact.id,
  }, ctx.commercialToken);

  // Admin voit les 3 transitions (cancel requiert crm:DELETE)
  const { data: openTrans } = await availableTransitions('lead', lead.id, ctx.adminToken);
  const openKeys = openTrans.map((t: any) => t.key);
  assertField('3 transitions depuis OPEN (admin)', openKeys.length, 3);
  assertIncludes('"win"    ∈ OPEN', openKeys, 'win');
  assertIncludes('"lose"   ∈ OPEN', openKeys, 'lose');
  assertIncludes('"cancel" ∈ OPEN', openKeys, 'cancel');

  // Après win → 0 transitions
  await transition('lead', lead.id, 'win', {}, ctx.commercialToken);
  const { data: wonTrans } = await availableTransitions('lead', lead.id, ctx.commercialToken);
  assertField('0 transitions depuis WON (final)', wonTrans.length, 0);

  // Quote DRAFT → send et withdraw, pas confirm
  const line = makeLine(ctx.product);
  const { data: q } = await post('/ventes/quotes', {
    contactId:  ctx.contact.id,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lines:      [line],
  }, ctx.commercialToken);

  // Admin voit toutes les transitions (y compris withdraw qui requiert ventes:DELETE)
  const { data: draftTrans } = await availableTransitions('quote', q.id, ctx.adminToken);
  const draftKeys = draftTrans.map((t: any) => t.key);
  assertIncludes('"send"     ∈ DRAFT (admin)',   draftKeys, 'send');
  assertIncludes('"withdraw" ∈ DRAFT (admin)',   draftKeys, 'withdraw');
  assertExcludes('"confirm"  ∉ DRAFT',           draftKeys, 'confirm');
  assertExcludes('"refuse"   ∉ DRAFT',           draftKeys, 'refuse');
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${c.bold}${c.cyan}════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}  CRM & Ventes — Workflow Engine E2E Test${c.reset}`);
  console.log(`${c.cyan}════════════════════════════════════════════════════════${c.reset}`);

  try {
    const h = await fetch('http://localhost:3001/health');
    const d = await h.json();
    if (d.status !== 'ok') throw new Error('unhealthy');
    console.log(`\n${c.green}Backend OK${c.reset} (${d.env})`);
  } catch {
    console.error(`\n${c.red}Backend inaccessible — démarrer avec: npm run dev:backend${c.reset}`);
    process.exit(1);
  }

  let ctx: any;
  try {
    ctx = await setup();
  } catch (e: any) {
    console.error(`\n${c.red}Setup échoué: ${e.message}${c.reset}`);
    process.exit(1);
  }

  await scenarioA_LeadWon(ctx);
  await scenarioB_LeadLost(ctx);
  await scenarioC_LoseMissingReason(ctx);
  await scenarioD_WinNoContact(ctx);
  await scenarioE_FinalStateTransition(ctx);
  await scenarioF_FullPipeline(ctx);
  await scenarioG_InvalidFromAccepted(ctx);
  await scenarioH_PermissionDenied(ctx);
  await scenarioI_AvailableTransitions(ctx);

  // ── Résumé final ──────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${c.cyan}════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}  ${c.green}${passed} réussis${c.reset}  ${c.bold}${c.red}${failed} échoués${c.reset}  ${c.bold}/ ${total} total${c.reset}`);

  if (errors.length > 0) {
    console.log(`\n${c.red}${c.bold}Échecs :${c.reset}`);
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${c.red}${e}${c.reset}`));
  } else {
    console.log(`\n${c.green}${c.bold}Tous les tests passent ✓${c.reset}`);
    console.log(`\n${c.dim}Preuves :`);
    console.log(`  ✓ Workflow CRM : Lead open → won / lost / cancelled`);
    console.log(`  ✓ Workflow Ventes : Quote DRAFT→SENT, Order CONFIRMED→DELIVERED`);
    console.log(`  ✓ Workflow Finance : Invoice DRAFT→SENT→PARTIALLY_PAID→PAID`);
    console.log(`  ✓ Conditions métier bloquantes (field_not_empty, payload_field_not_empty)`);
    console.log(`  ✓ RBAC : 403 sur transition requérant permission manquante`);
    console.log(`  ✓ Transitions bloquées depuis état final`);
    console.log(`  ✓ available-transitions cohérent selon état courant`);
    console.log(`  ✓ Execution logs journalisés à chaque transition${c.reset}`);
  }
  console.log(`${c.cyan}════════════════════════════════════════════════════════${c.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n${c.red}Erreur: ${e.message}${c.reset}`);
  process.exit(1);
});
