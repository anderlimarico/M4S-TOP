export const integer = (v, min = 0) => {
  const n = Number(v);
  if (
    (typeof v !== "number" && typeof v !== "string") ||
    String(v).trim() === "" ||
    !Number.isSafeInteger(n) ||
    n < min ||
    n > 10000000
  )
    throw Error("Informe uma quantidade inteira válida (até 10 milhões).");
  return n;
};
export const text = (v) => {
  if (typeof v !== "string" || !v.trim() || v.length > 120)
    throw Error("Preencha o texto (até 120 caracteres).");
  return v.trim();
};
export const initial = () => ({ schema: 1, events: [] });
export function state(db) {
  const s = {
    products: [],
    accounts: [],
    workers: [],
    lots: [],
    shipments: [],
    stock: {},
    cut: {},
    full: {},
    sales: {},
    owed: {},
  };
  for (const e of db.events) {
    const d = e.data;
    switch (e.type) {
      case "product":
        s.products.push(d);
        break;
      case "account":
        s.accounts.push(d);
        break;
      case "worker":
        s.workers.push(d);
        s.owed[d.id] = 0;
        break;
      case "adjust":
        s.stock[d.product] = (s.stock[d.product] || 0) + d.quantity;
        break;
      case "cut":
        s.cut[d.product] = (s.cut[d.product] || 0) + d.quantity;
        break;
      case "finish":
        s.cut[d.product] -= d.quantity;
        s.stock[d.product] = (s.stock[d.product] || 0) + d.quantity;
        break;
      case "lot":
        s.cut[d.product] -= d.quantity;
        s.lots.push({ ...d, returned: 0, lost: 0 });
        break;
      case "return": {
        const l = s.lots.find((x) => x.id === d.lot);
        l.returned += d.quantity;
        l.lost += d.loss;
        s.stock[l.product] = (s.stock[l.product] || 0) + d.quantity;
        s.owed[l.worker] += d.quantity * l.rate;
        break;
      }
      case "pay":
        s.owed[d.worker] -= d.cents;
        break;
      case "sales":
        s.sales[d.key] = d;
        break;
      case "ship":
        for (const [id, q] of Object.entries(d.consume)) s.stock[id] -= q;
        s.shipments.push({ ...d, received: 0 });
        break;
      case "receive": {
        const sh = s.shipments.find((x) => x.id === d.shipment);
        sh.received += d.quantity;
        s.full[sh.key] = (s.full[sh.key] || 0) + d.quantity;
        break;
      }
      case "fullSet":
        s.full[d.key] = d.quantity;
        break;
    }
  }
  return s;
}
export const components = (s, id) => {
  const p = s.products.find((x) => x.id === id);
  if (!p) throw Error("Produto não encontrado.");
  return p.parts.length ? p.parts : [{ product: id, quantity: 1 }];
};
export function forecast(s, key) {
  const v = s.sales[key];
  if (!v) return null;
  const daily = Math.max(v.s7 / 7, v.s15 / 15, v.s30 / 30);
  const on = s.full[key] || 0;
  const transit = s.shipments
    .filter((x) => x.key === key)
    .reduce((a, x) => a + x.quantity - x.received, 0);
  const suggested = Math.max(0, Math.ceil(daily * v.days - on - transit));
  const product = key.split("|")[1];
  const available = Math.min(
    ...components(s, product).map((x) =>
      Math.floor((s.stock[x.product] || 0) / x.quantity),
    ),
  );
  return {
    daily,
    on,
    transit,
    suggested,
    available,
    days: daily ? on / daily : null,
  };
}
export function command(db, type, input) {
  const s = state(db),
    d = structuredClone(input);
  const id = () => crypto.randomUUID();
  const prod = (x) => {
    const p = s.products.find((p) => p.id === x);
    if (!p) throw Error("Selecione um produto.");
    return p;
  };
  const unit = (x) => {
    const p = prod(x);
    if (p.parts.length) throw Error("Use uma peça unitária nesta operação.");
    return p;
  };
  const qty = () => (d.quantity = integer(d.quantity, 1));
  const key = () => {
    const [a, p] = d.key.split("|");
    if (!s.accounts.some((x) => x.id === a) || !prod(p).accounts.includes(a))
      throw Error("Produto não vinculado à conta.");
  };
  switch (type) {
    case "account":
      d.id = id();
      d.name = text(d.name);
      if (s.accounts.some((x) => x.name.toLowerCase() === d.name.toLowerCase()))
        throw Error("Conta já cadastrada.");
      break;
    case "product":
      d.id = id();
      d.sku = text(d.sku).toUpperCase();
      d.name = text(d.name);
      if (s.products.some((x) => x.sku === d.sku))
        throw Error("SKU já cadastrado.");
      if (
        !d.accounts.length ||
        d.accounts.some((a) => !s.accounts.some((x) => x.id === a))
      )
        throw Error("Vincule ao menos uma conta.");
      d.parts = d.parts.map((x) => {
        unit(x.product);
        return { product: x.product, quantity: integer(x.quantity, 1) };
      });
      if (new Set(d.parts.map((x) => x.product)).size !== d.parts.length)
        throw Error("Componente repetido.");
      break;
    case "worker":
      d.id = id();
      d.name = text(d.name);
      d.neighborhood = text(d.neighborhood);
      d.rate = integer(d.rate);
      d.days = [...new Set(d.days.map((x) => integer(x, 1)))].sort(
        (a, b) => a - b,
      );
      if (!d.days.length || d.days.some((x) => x > 31))
        throw Error("Dias de acerto: 1 a 31.");
      break;
    case "adjust":
      unit(d.product);
      qty();
      d.reason = text(d.reason);
      break;
    case "cut":
      unit(d.product);
      qty();
      break;
    case "finish":
      unit(d.product);
      qty();
      if ((s.cut[d.product] || 0) < d.quantity)
        throw Error("Saldo de cortes insuficiente.");
      break;
    case "lot":
      unit(d.product);
      qty();
      {
        const w = s.workers.find((x) => x.id === d.worker);
        if (!w) throw Error("Selecione uma costureira.");
        d.rate = w.rate;
        d.id = id();
        if ((s.cut[d.product] || 0) < d.quantity)
          throw Error("Saldo de cortes insuficiente.");
      }
      break;
    case "return":
      {
        const l = s.lots.find((x) => x.id === d.lot);
        if (!l) throw Error("Lote não encontrado.");
        d.quantity = integer(d.quantity);
        d.loss = integer(d.loss);
        if (!d.quantity && !d.loss)
          throw Error("Informe peças prontas ou perdas.");
        if (d.quantity + d.loss > l.quantity - l.returned - l.lost)
          throw Error("Quantidade maior que o saldo do lote.");
      }
      break;
    case "pay":
      d.cents = integer(d.cents, 1);
      if (d.cents > (s.owed[d.worker] || 0))
        throw Error("Pagamento maior que o saldo devido.");
      break;
    case "sales":
      key();
      for (const k of ["s7", "s15", "s30"]) d[k] = integer(d[k]);
      if (d.s7 > d.s15 || d.s15 > d.s30)
        throw Error("Vendas acumuladas: 7 dias ≤ 15 dias ≤ 30 dias.");
      d.days = integer(d.days, 1);
      if (d.days > 365) throw Error("Cobertura máxima: 365 dias.");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(d.date) ||
        !Number.isFinite(Date.parse(d.date)) ||
        new Date(d.date).toISOString().slice(0, 10) !== d.date
      )
        throw Error("Informe a data planejada.");
      break;
    case "fullSet":
      key();
      d.quantity = integer(d.quantity);
      d.reason = text(d.reason);
      break;
    case "ship":
      key();
      qty();
      d.id = id();
      d.consume = {};
      for (const c of components(s, d.key.split("|")[1])) {
        const q = c.quantity * d.quantity;
        if (!Number.isSafeInteger(q) || (s.stock[c.product] || 0) < q)
          throw Error("Estoque geral insuficiente para este envio.");
        d.consume[c.product] = q;
      }
      break;
    case "receive":
      {
        const sh = s.shipments.find((x) => x.id === d.shipment);
        qty();
        if (!sh || d.quantity > sh.quantity - sh.received)
          throw Error("Recebimento maior que o saldo em trânsito.");
      }
      break;
    default:
      throw Error("Operação desconhecida.");
  }
  return {
    ...db,
    events: [
      ...db.events,
      { id: id(), at: new Date().toISOString(), type, data: d },
    ],
  };
}
export function validateBackup(raw) {
  if (
    raw?.schema !== 1 ||
    !Array.isArray(raw.events) ||
    raw.events.length > 100000
  )
    throw Error("Backup incompatível.");
  let db = initial();
  const ids = new Set();
  for (const e of raw.events) {
    if (
      !e ||
      typeof e.id !== "string" ||
      ids.has(e.id) ||
      !Number.isFinite(Date.parse(e.at))
    )
      throw Error("Histórico inválido.");
    ids.add(e.id);
    const checked = command(db, e.type, e.data);
    const expected = checked.events.at(-1).data;
    const original = e.data;
    for (const k of ["id"]) if (original[k]) expected[k] = original[k];
    if (JSON.stringify(expected) !== JSON.stringify(original))
      throw Error("Dados inválidos no backup.");
    db.events.push(structuredClone(e));
  }
  return db;
}
export function nextPay(days, now = new Date()) {
  for (let m = 0; m < 3; m++) {
    const y = now.getFullYear(),
      mo = now.getMonth() + m,
      last = new Date(y, mo + 1, 0).getDate();
    for (const day of days) {
      const d = new Date(y, mo, Math.min(day, last));
      if (d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
        return d;
    }
  }
}
