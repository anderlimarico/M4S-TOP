import {
  initial,
  state,
  command,
  forecast,
  components,
  nextPay,
  validateBackup,
} from "./core.js";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  num = (n) => Number(n).toLocaleString("pt-BR"),
  money = (n) =>
    (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  date = (v) => new Date(v).toLocaleString("pt-BR"),
  day = (v) => new Date(v + "T12:00:00").toLocaleDateString("pt-BR");
const KEY = "m4s-fluxo-v1";
let db, loadError;
try {
  db = JSON.parse(localStorage.getItem(KEY)) || initial();
  if (db.schema !== 1 || !Array.isArray(db.events)) throw Error();
  state(db);
} catch {
  db = initial();
  loadError = true;
}
let s = state(db);
const pages = {
  dashboard: ["◈", "Visão geral"],
  full: ["▣", "Planejamento Full"],
  production: ["✂", "Corte e fabricação"],
  workers: ["♧", "Costureiras"],
  stock: ["▤", "Estoque e histórico"],
  products: ["◇", "Produtos e contas"],
  backup: ["↗", "Backup e relatório"],
};
let page = "dashboard";
const name = (id) => s.products.find((x) => x.id === id)?.name || "Produto",
  worker = (id) => s.workers.find((x) => x.id === id)?.name || "",
  account = (id) => s.accounts.find((x) => x.id === id)?.name || "";
const empty = (t) => `<div class="empty">${t}</div>`;
const btn = (label, action, arg = "", cls = "") =>
  `<button class="${cls}" data-action="${action}" data-id="${esc(arg)}">${label}</button>`;
const options = (items, label = (x) => x.name) =>
  items
    .map((x) => `<option value="${esc(x.id)}">${esc(label(x))}</option>`)
    .join("");
const input = (label, key, type = "number", value = "", hint = "") =>
  `<label for="${key}">${label}</label><input id="${key}" name="${key}" type="${type}" value="${esc(value)}" ${type === "number" ? 'min="0" max="10000000" step="1"' : ""} required>${hint ? `<p class="hint">${hint}</p>` : ""}`;
const select = (label, key, items) =>
  `<label for="${key}">${label}</label><select id="${key}" name="${key}" required><option value="">Selecione…</option>${items}</select>`;
const units = () => s.products.filter((x) => !x.parts.length);
const pairOptions = () =>
  s.products
    .flatMap((p) =>
      p.accounts.map(
        (a) =>
          `<option value="${a}|${p.id}">${esc(account(a) + " · " + p.name)}</option>`,
      ),
    )
    .join("");
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const metric = (t, v, sub, color) =>
  `<article class="card metric" style="--accent:${color}"><span class="muted">${t}</span><div class="value">${num(v)}</div><span class="muted">${sub}</span></article>`;
function notify(t) {
  $("#notice").textContent = t;
}
function commit(type, d) {
  if (loadError)
    throw Error(
      "Dados locais não puderam ser lidos. Exporte os dados originais antes de restaurar um backup válido.",
    );
  const run = () => {
    const raw = localStorage.getItem(KEY);
    const latest = raw ? JSON.parse(raw) : initial();
    const next = command(latest, type, d);
    localStorage.setItem(KEY, JSON.stringify(next));
    db = next;
    s = state(db);
  };
  return navigator.locks
    ? navigator.locks.request(KEY, run)
    : Promise.resolve().then(run);
}
function render() {
  s = state(db);
  $("#title").textContent = pages[page][1];
  $("#nav").innerHTML = Object.entries(pages)
    .map(
      ([k, [i, t]]) =>
        `<a href="#${k}" class="${k === page ? "active" : ""}">${i} &nbsp; ${t}</a>`,
    )
    .join("");
  $("#connection").textContent = navigator.onLine
    ? "● Salvo neste aparelho"
    : "● Modo offline";
  $("#view").innerHTML = views[page]();
  if (loadError)
    notify(
      "Os dados locais não puderam ser lidos. Abra Backup para exportar o original e recuperar com segurança.",
    );
}
const views = {
  dashboard() {
    const pending = s.lots.reduce(
        (a, l) => a + l.quantity - l.returned - l.lost,
        0,
      ),
      critical = Object.keys(s.sales).filter(
        (k) => forecast(s, k).suggested > 0,
      ).length;
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - 6 + i);
      return d.toLocaleDateString("en-CA");
    });
    const totals = days.map((d) =>
      db.events
        .filter(
          (e) =>
            new Date(e.at).toLocaleDateString("en-CA") === d &&
            ["finish", "return"].includes(e.type),
        )
        .reduce((a, e) => a + e.data.quantity, 0),
    );
    return `<div class="hero"><div><span class="eyebrow">ORGANIZAR. PRODUZIR. ABASTECER.</span><h2>Seu fluxo, sob controle.</h2><p>Acompanhe cada peça, do corte ao Full. Confirme as movimentações para manter sua operação atualizada.</p></div>${btn("Planejar o Full →", "goto", "full")}</div><div class="grid">${metric("Prontas para enviar", sum(s.stock), "peças no estoque geral", "#1db399")}${metric("Aguardando fabricação", sum(s.cut), "peças cortadas disponíveis", "#f3b249")}${metric("Nas costureiras", pending, "peças em produção externa", "#8885e9")}${metric("Full precisa de atenção", critical, "anúncios com envio sugerido", "#ee8593")}</div><div class="two"><article class="card"><h2>Produção nos últimos 7 dias</h2><span class="muted">Peças prontas • produção interna + retiradas</span><div class="bar-chart">${totals.map((v, i) => `<div class="bar-col"><b>${num(v)}</b><div class="bar" style="height:${Math.max(3, (v / Math.max(1, ...totals)) * 120)}px"></div>${day(days[i]).slice(0, 5)}</div>`).join("")}</div></article><article class="card"><h2>Ritmo das costureiras</h2>${
      s.workers
        .map((w) => {
          const ls = s.lots.filter((l) => l.worker === w.id),
            total = ls.reduce((a, l) => a + l.quantity, 0),
            done = ls.reduce((a, l) => a + l.returned, 0);
          return `<div class="row"><div style="width:100%"><strong>${esc(w.name)}</strong><p>${num(done)} entregues / ${num(total)} enviadas · histórico total</p><div class="progress"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div></div></div>`;
        })
        .join("") ||
      empty("Cadastre suas costureiras para acompanhar as entregas.")
    }</article></div><article class="card"><h2>Próximas ações</h2>${
      Object.keys(s.sales)
        .map((k) => {
          const f = forecast(s, k);
          return f.suggested
            ? `<div class="row"><div><strong>${esc(name(k.split("|")[1]))}</strong><p>${esc(account(k.split("|")[0]))} · planejar ${num(f.suggested)} unidades de anúncio em ${day(s.sales[k].date)}</p></div><span class="badge warn">${num(Math.max(0, f.suggested - f.available))} faltantes</span></div>`
            : "";
        })
        .join("") ||
      empty("Cadastre os dados de vendas para gerar o planejamento.")
    }</article>`;
  },
  products() {
    return `<div class="toolbar"><p class="muted">Cadastre as peças primeiro. Depois, monte os kits com seus componentes.</p><div class="actions">${btn("+ Conta", "account")}${btn("+ Produto", "product", "", "primary")}</div></div><article class="card"><h2>Suas contas</h2>${s.accounts.map((a) => `<span class="pill">${esc(a.name)}</span>`).join("") || empty("Comece cadastrando as contas de venda.")}</article><br><div class="list">${s.products.map((p) => `<article class="card"><div class="toolbar"><div><span class="eyebrow">${esc(p.sku)}</span><h2>${esc(p.name)}</h2></div><span class="badge ${p.parts.length ? "warn" : ""}">${p.parts.length ? "KIT" : "UNITÁRIO"}</span></div><p class="muted">${p.parts.length ? p.parts.map((c) => `${num(c.quantity)} × ${esc(name(c.product))}`).join(" + ") : "Peça física de estoque"}</p>${p.accounts.map((a) => `<span class="pill">${esc(account(a))}</span>`).join("")}</article>`).join("") || empty("Nenhum produto cadastrado. Use “+ Produto”.")}</div>`;
  },
  production() {
    return `<div class="toolbar"><p class="muted">Cortes são separados das peças prontas e dos lotes externos.</p><div class="actions">${btn("+ Registrar corte", "cut")}${btn("✓ Finalizar peças", "finish", "", "primary")}${btn("Enviar lote", "lot")}</div></div><div class="list">${
      units()
        .map(
          (p) =>
            `<article class="card"><h2>${esc(p.name)}</h2><div class="mini-grid"><div>Cortadas disponíveis<b>${num(s.cut[p.id] || 0)}</b></div><div>Nas costureiras<b>${num(s.lots.filter((l) => l.product === p.id).reduce((a, l) => a + l.quantity - l.returned - l.lost, 0))}</b></div><div>Prontas<b>${num(s.stock[p.id] || 0)}</b></div></div></article>`,
        )
        .join("") ||
      empty("Cadastre um produto unitário para registrar cortes.")
    }</div>`;
  },
  workers() {
    return `<div class="toolbar"><p class="muted">Pagamentos calculados nas peças prontas retiradas. Perdas não geram cobrança.</p>${btn("+ Costureira", "worker", "", "primary")}</div><div class="list">${
      s.workers
        .map(
          (w) =>
            `<article class="card"><div class="toolbar"><div><h2>${esc(w.name)}</h2><span class="muted">${esc(w.neighborhood)} · ${money(w.rate)} / peça</span></div>${btn("Registrar pagamento", "pay", w.id)}</div><div class="mini-grid"><div>Saldo devido<b>${money(s.owed[w.id])}</b></div><div>Próximo acerto<b>${nextPay(w.days).toLocaleDateString("pt-BR")}</b></div><div>Dias fixos<b>${w.days.join(" / ")}</b></div></div><h3>Lotes e retiradas</h3>${
              s.lots
                .filter((l) => l.worker === w.id)
                .map(
                  (l) =>
                    `<div class="row"><div><strong>${esc(name(l.product))}</strong><p>Lote ${l.id.slice(0, 8)} · ${num(l.quantity)} enviadas · ${num(l.returned)} prontas · ${num(l.lost)} perdas</p><span class="badge">${num(l.quantity - l.returned - l.lost)} pendentes</span></div>${l.quantity > l.returned + l.lost ? btn("Retirar / dar baixa", "return", l.id) : '<span class="muted">Concluído</span>'}</div>`,
                )
                .join("") || empty("Nenhum lote enviado.")
            }</article>`,
        )
        .join("") ||
      empty("Cadastre as costureiras e envie peças cortadas em lotes.")
    }</div>`;
  },
  full() {
    return `<div class="toolbar"><p class="muted">Quantidades em unidades do anúncio (kits ou unitários).</p><div class="actions">${btn("+ Planejar anúncio", "sales", "", "primary")}${btn("Atualizar saldo Full", "fullSet")}${btn("Confirmar envio", "ship")}</div></div><div class="list">${
      Object.keys(s.sales)
        .map((k) => {
          const f = forecast(s, k),
            v = s.sales[k];
          return `<article class="card"><div class="toolbar"><div><span class="eyebrow">${esc(account(k.split("|")[0]))}</span><h2>${esc(name(k.split("|")[1]))}</h2><span class="muted">Planejado: ${day(v.date)} · cobertura alvo ${v.days} dias</span></div>${btn("Atualizar vendas", "sales", k)}</div><div class="mini-grid"><div>Giro diário<b>${num(+f.daily.toFixed(2))}</b></div><div>Dias no Full<b>${f.days === null ? "Sem giro" : num(+f.days.toFixed(1))}</b></div><div>Enviar<b>${num(f.suggested)}</b></div></div><p class="muted">No Full: ${num(f.on)} · Em trânsito: ${num(f.transit)} · Disponível para montar/enviar: ${num(f.available)}</p><span class="badge ${f.available < f.suggested ? "warn" : ""}">${f.available < f.suggested ? "Produção necessária" : "Estoque disponível"}</span><details><summary>Como foi calculado</summary><p class="muted">Maior média entre ${v.s7}/7, ${v.s15}/15 e ${v.s30}/30. Sugestão = arredondar para cima (giro × ${v.days} − Full − trânsito), mínimo zero. Estoque Full é informado manualmente e deve ser atualizado após vendas.</p></details>${btn("Preparar envio", "ship", k, "primary")}</article>`;
        })
        .join("") ||
      empty("Cadastre produtos e contas e informe suas vendas acumuladas.")
    }</div><br><article class="card"><h2>Envios em trânsito</h2>${
      s.shipments
        .filter((x) => x.received < x.quantity)
        .map(
          (sh) =>
            `<div class="row"><div><strong>${esc(name(sh.key.split("|")[1]))}</strong><p>${esc(account(sh.key.split("|")[0]))} · ${num(sh.quantity - sh.received)} aguardando chegada</p></div>${btn("Receber no Full", "receive", sh.id)}</div>`,
        )
        .join("") || empty("Nenhum envio pendente.")
    }</article>`;
  },
  stock() {
    return `<div class="toolbar"><p class="muted">Kits são montados a partir das peças disponíveis.</p>${btn("+ Entrada inicial / ajuste", "adjust", "", "primary")}</div><div class="grid">${units()
      .map((p) =>
        metric(esc(p.name), s.stock[p.id] || 0, esc(p.sku), "#1db399"),
      )
      .join(
        "",
      )}</div><article class="card"><h2>Histórico permanente <span class="muted">${db.events.length} registros</span></h2><p class="muted">Sem edição ou exclusão de registros. Ajustes criam novos eventos.</p><div class="table-wrap"><table><thead><tr><th>Data e hora</th><th>Operação</th><th>Detalhes</th></tr></thead><tbody>${db.events
      .slice()
      .reverse()
      .map(
        (e) =>
          `<tr><td>${date(e.at)}<br><small>${esc(e.id.slice(0, 8))}</small></td><td>${labels[e.type]}</td><td>${esc(detail(e))}</td></tr>`,
      )
      .join("")}</tbody></table></div></article>`;
  },
  backup() {
    return `<div class="hero"><div><span class="eyebrow">CUIDADO COM SUA OPERAÇÃO</span><h2>Seus dados, sempre com você.</h2><p>Baixe um backup antes de trocar de aparelho ou limpar o navegador. O arquivo contém todo o histórico e os cadastros.</p></div>${btn("↓ Backup completo", "export")}</div><div class="two"><article class="card"><h2>Restaurar backup</h2><p class="muted">Substitui os dados deste aparelho após validação. Um backup dos dados atuais será baixado antes da restauração.</p><label for="restore">Arquivo JSON exportado pelo aplicativo</label><input id="restore" type="file" accept=".json,application/json"><p class="hint">Restaure apenas arquivos de confiança. Os dados não são sincronizados automaticamente entre aparelhos.</p>${loadError ? btn("Exportar dados originais", "raw") : ""}</article><article class="card"><h2>Conversa da operação</h2><p class="muted">Resumo com faltas de peças, produção, costureiras e datas planejadas. Revise antes de compartilhar.</p>${btn("Gerar relatório", "report", "", "primary")}</article></div><article class="card"><h2>Privacidade e histórico</h2><p class="muted">Sem login, servidor de dados ou conexão com marketplaces. O histórico é preservado pela interface, mas não é inviolável contra alterações externas no navegador ou no backup. Para auditoria inviolável e sincronização será necessário um backend autenticado.</p></article>`;
  },
};
const labels = {
  account: "Conta cadastrada",
  product: "Produto cadastrado",
  worker: "Costureira cadastrada",
  adjust: "Entrada de estoque",
  cut: "Corte registrado",
  finish: "Produção finalizada",
  lot: "Lote enviado",
  return: "Retirada / perda",
  pay: "Pagamento",
  sales: "Planejamento Full",
  ship: "Envio ao Full",
  receive: "Chegada no Full",
  fullSet: "Saldo Full informado",
};
function detail(e) {
  const d = e.data;
  if (["product", "account", "worker"].includes(e.type)) return d.name;
  if (e.type === "pay") return `${worker(d.worker)} · ${money(d.cents)}`;
  if (e.type === "return") {
    const l = s.lots.find((x) => x.id === d.lot);
    return `${worker(l?.worker)} · ${d.quantity} prontas · ${d.loss} perdas · lote ${d.lot.slice(0, 8)}`;
  }
  if (d.key)
    return `${account(d.key.split("|")[0])} · ${name(d.key.split("|")[1])} · ${d.quantity ?? "vendas atualizadas"} ${d.reason || ""}`;
  if (e.type === "receive")
    return `${d.quantity} unidades de anúncio · envio ${d.shipment.slice(0, 8)}`;
  return `${name(d.product)} · ${d.quantity} peças ${d.reason || ""}${d.worker ? " · " + worker(d.worker) : ""}`;
}
let submit;
function modal(title, fields, handler) {
  $("#modal-title").textContent = title;
  $("#fields").innerHTML = fields;
  $("#error").textContent = "";
  submit = handler;
  $("#modal").showModal();
}
const productSelect = () =>
  select("Produto unitário", "product", options(units()));
function cents(v) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(v))
    throw Error("Informe um valor com até duas casas decimais.");
  return Math.round(Number(v.replace(",", ".")) * 100);
}
const actions = {
  goto: (id) => {
    location.hash = id;
  },
  account: () =>
    modal(
      "Nova conta",
      input(
        "Nome da conta",
        "name",
        "text",
        "",
        "Ex.: Mercado Livre · Mast4Shop",
      ),
      (d) => commit("account", d),
    ),
  product: () => {
    if (!s.accounts.length) throw Error("Cadastre uma conta primeiro.");
    modal(
      "Novo produto",
      input("SKU único", "sku", "text") +
        input("Nome do produto", "name", "text") +
        "<label>Contas vinculadas</label>" +
        s.accounts
          .map(
            (a) =>
              `<label class="check"><input type="checkbox" name="accounts" value="${a.id}">${esc(a.name)}</label>`,
          )
          .join("") +
        '<label class="check"><input type="checkbox" id="isKit"> Este produto é um kit</label><div id="parts" hidden><p class="hint">Adicione uma ou mais peças unitárias à composição.</p><div id="component-list"></div><button type="button" id="add-component">+ Componente</button></div>',
      (d, f) => {
        d.accounts = f.getAll("accounts");
        d.parts = $("#isKit").checked
          ? [...document.querySelectorAll(".component")].map((r) => ({
              product: r.querySelector("select").value,
              quantity: r.querySelector("input").value,
            }))
          : [];
        if ($("#isKit").checked && !d.parts.length)
          throw Error("Adicione componentes ao kit.");
        return commit("product", d);
      },
    );
    $("#isKit").onchange = (e) => ($("#parts").hidden = !e.target.checked);
    $("#add-component").onclick = () => {
      const r = document.createElement("div");
      r.className = "component";
      r.innerHTML = `<select aria-label="Peça componente" required>${options(units())}</select><input aria-label="Quantidade do componente" type="number" min="1" step="1" value="3" required><button type="button" aria-label="Remover componente">✕</button>`;
      r.querySelector("button").onclick = () => r.remove();
      $("#component-list").append(r);
    };
  },
  worker: () =>
    modal(
      "Nova costureira",
      input("Nome", "name", "text") +
        input("Bairro", "neighborhood", "text") +
        input("Valor por peça (R$)", "rate", "text", "1,00") +
        input(
          "Dias de acerto",
          "days",
          "text",
          "15,30",
          "Separe por vírgula. Dias 29–31 são ajustados ao último dia do mês.",
        ),
      (d) => {
        d.rate = cents(d.rate);
        d.days = d.days.split(",").map((x) => x.trim());
        return commit("worker", d);
      },
    ),
  cut: () =>
    modal(
      "Registrar corte",
      productSelect() + input("Peças cortadas", "quantity"),
      (d) => commit("cut", d),
    ),
  finish: () =>
    modal(
      "Finalizar produção interna",
      productSelect() +
        input("Peças finalizadas", "quantity") +
        '<p class="hint">Consome cortes disponíveis e alimenta o estoque de peças prontas.</p>',
      (d) => commit("finish", d),
    ),
  adjust: () =>
    modal(
      "Entrada de estoque",
      productSelect() +
        input("Quantidade de entrada", "quantity") +
        input(
          "Motivo / origem",
          "reason",
          "text",
          "",
          "Ex.: saldo inicial ou compra externa",
        ),
      (d) => commit("adjust", d),
    ),
  lot: () =>
    modal(
      "Enviar lote para costureira",
      productSelect() +
        select("Costureira", "worker", options(s.workers)) +
        input("Quantidade de peças cortadas", "quantity"),
      (d) => commit("lot", d),
    ),
  return: (id) => {
    const l = s.lots.find((x) => x.id === id);
    modal(
      "Retirar lote",
      `<p>${esc(worker(l.worker))} · ${esc(name(l.product))}<br>Saldo: ${num(l.quantity - l.returned - l.lost)} peças</p>` +
        input(
          "Peças prontas retiradas",
          "quantity",
          "number",
          l.quantity - l.returned - l.lost,
        ) +
        input("Perdas confirmadas", "loss", "number", 0),
      (d) => commit("return", { ...d, lot: id }),
    );
  },
  pay: (id) =>
    modal(
      "Registrar pagamento",
      `<p>${esc(worker(id))} · Saldo ${money(s.owed[id])}</p>` +
        input("Valor pago (R$)", "amount", "text"),
      (d) => commit("pay", { worker: id, cents: cents(d.amount) }),
    ),
  sales: (key) => {
    const v = s.sales[key];
    modal(
      "Planejar abastecimento Full",
      select("Conta e produto", "key", pairOptions()) +
        input("Vendas acumuladas: últimos 7 dias", "s7", "number", v?.s7 ?? 0) +
        input(
          "Vendas acumuladas: últimos 15 dias",
          "s15",
          "number",
          v?.s15 ?? 0,
        ) +
        input(
          "Vendas acumuladas: últimos 30 dias",
          "s30",
          "number",
          v?.s30 ?? 0,
        ) +
        input("Dias de cobertura desejados", "days", "number", v?.days ?? 15) +
        input(
          "Data planejada de envio",
          "date",
          "date",
          v?.date ?? new Date().toLocaleDateString("en-CA"),
        ),
      (d) => commit("sales", d),
    );
    if (key) $("#key").value = key;
  },
  fullSet: () =>
    modal(
      "Atualizar saldo no Full",
      select("Conta e produto", "key", pairOptions()) +
        input("Estoque disponível no Full", "quantity") +
        input("Motivo / referência da conferência", "reason", "text") +
        '<p class="hint">Este saldo substitui a contagem anterior no Full. Não altera o estoque geral ou os envios em trânsito.</p>',
      (d) => commit("fullSet", d),
    ),
  ship: (key) => {
    modal(
      "Confirmar envio ao Full",
      select("Conta e produto", "key", pairOptions()) +
        input(
          "Quantidade de anúncios / kits",
          "quantity",
          "number",
          key ? forecast(s, key)?.suggested || 1 : 1,
        ) +
        '<div id="consumption" class="hint"></div>',
      (d) => commit("ship", d),
    );
    if (key) $("#key").value = key;
    const update = () => {
      try {
        const p = $("#key").value.split("|")[1],
          q = Number($("#quantity").value);
        $("#consumption").textContent =
          "Serão consumidas: " +
          components(s, p)
            .map(
              (c) =>
                `${q * c.quantity} peças de ${name(c.product)} (estoque: ${s.stock[c.product] || 0})`,
            )
            .join("; ");
      } catch {
        $("#consumption").textContent =
          "Selecione um produto para conferir o consumo.";
      }
    };
    $("#key").onchange = update;
    $("#quantity").oninput = update;
    update();
  },
  receive: (id) => {
    const sh = s.shipments.find((x) => x.id === id);
    modal(
      "Receber envio no Full",
      input(
        "Quantidade recebida (anúncios / kits)",
        "quantity",
        "number",
        sh.quantity - sh.received,
      ),
      (d) => commit("receive", { ...d, shipment: id }),
    );
  },
  export: () => download(JSON.stringify(db, null, 2)),
  raw: () => download(localStorage.getItem(KEY) || "{}"),
  report: () => {
    const text = report();
    modal(
      "Resumo para compartilhar",
      `<label for="report">Revise sua mensagem</label><textarea id="report">${esc(text)}</textarea><div class="actions"><button type="button" id="copy">Copiar mensagem</button><button type="button" id="whatsapp" class="primary">Abrir WhatsApp</button></div><p class="hint">O WhatsApp abrirá para você escolher o contato e confirmar o envio.</p>`,
      () => {},
    );
    $("#form button[type=submit]").hidden = true;
    $("#copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText($("#report").value);
        $("#copy").textContent = "Copiado ✓";
      } catch {
        $("#report").select();
        $("#error").textContent = "Selecione e copie a mensagem manualmente.";
      }
    };
    $("#whatsapp").onclick = () =>
      window.open(
        "https://wa.me/?text=" + encodeURIComponent($("#report").value),
        "_blank",
        "noopener",
      );
  },
};
function report() {
  const needs = {};
  const full = Object.keys(s.sales).map((k) => {
    const f = forecast(s, k);
    for (const c of components(s, k.split("|")[1]))
      needs[c.product] = (needs[c.product] || 0) + f.suggested * c.quantity;
    return `• ${account(k.split("|")[0])} / ${name(k.split("|")[1])}: enviar ${f.suggested} anúncios em ${day(s.sales[k].date)}. Full ${f.on}; trânsito ${f.transit}.`;
  });
  const plan = Object.entries(needs).map(([p, n]) => {
    const need = Math.max(0, n - (s.stock[p] || 0)),
      external = s.lots
        .filter((l) => l.product === p)
        .reduce((a, l) => a + l.quantity - l.returned - l.lost, 0);
    return `• ${name(p)}: demanda ${n} peças; fabricar/receber ${need}. Cortar mais ${Math.max(0, need - (s.cut[p] || 0) - external)}. Cortes disponíveis ${s.cut[p] || 0}; externas pendentes ${external}.`;
  });
  return `Olá! 😊 Resumo M4S · ${new Date().toLocaleDateString("pt-BR")}\n\n📦 FULL — datas planejadas\n${full.join("\n") || "Sem planejamento cadastrado."}\n\n✂️ CORTE E FABRICAÇÃO\n${plan.join("\n") || "Informe vendas para calcular as necessidades."}\n\n🧵 COSTUREIRAS\n${s.workers.map((w) => `• ${w.name}: ${s.lots.filter((l) => l.worker === w.id).reduce((a, l) => a + l.quantity - l.returned - l.lost, 0)} pendentes. Saldo ${money(s.owed[w.id])}; próximo acerto ${nextPay(w.days).toLocaleDateString("pt-BR")}.`).join("\n") || "Nenhuma cadastrada."}\n\n✅ ESTOQUE PRONTO\n${
    units()
      .map((p) => `• ${p.name}: ${s.stock[p.id] || 0} peças.`)
      .join("\n") || "Sem produtos."
  }\n\nVamos conferir as prioridades antes de enviar. As datas são planejadas e os saldos Full são informados manualmente.`;
}
function download(content) {
  const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `m4s-backup-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b)
    try {
      actions[b.dataset.action](b.dataset.id);
    } catch (err) {
      notify(err.message);
    }
});
$("#close").onclick = () => $("#modal").close();
$("#modal").addEventListener("close", () => {
  $("#form button[type=submit]").hidden = false;
});
$("#form").onsubmit = async (e) => {
  e.preventDefault();
  const b = $("#form button[type=submit]");
  b.disabled = true;
  try {
    const f = new FormData(e.target);
    await submit(Object.fromEntries(f), f);
    $("#modal").close();
    render();
    notify("Registro salvo. Estoques e histórico atualizados.");
  } catch (err) {
    $("#error").textContent =
      err.message ||
      "Não foi possível salvar. Exporte um backup e verifique o espaço do aparelho.";
  } finally {
    b.disabled = false;
  }
};
document.addEventListener("change", async (e) => {
  if (e.target.id !== "restore") return;
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 25000000) throw Error("Backup excede 25 MB.");
    const next = validateBackup(JSON.parse(await file.text()));
    if (
      !confirm(
        `Restaurar ${next.events.length} registros? Os dados atuais serão substituídos; um backup será baixado primeiro.`,
      )
    )
      return;
    download(localStorage.getItem(KEY) || JSON.stringify(db));
    const restore = () => {
      localStorage.setItem(KEY, JSON.stringify(next));
      db = next;
      loadError = false;
      render();
      notify("Backup validado e restaurado.");
    };
    if (navigator.locks) await navigator.locks.request(KEY, restore);
    else restore();
  } catch (err) {
    notify("Restauração cancelada: " + err.message);
  } finally {
    e.target.value = "";
  }
});
window.addEventListener("hashchange", () => {
  page = pages[location.hash.slice(1)] ? location.hash.slice(1) : "dashboard";
  render();
});
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    try {
      db = JSON.parse(e.newValue) || initial();
      s = state(db);
      render();
    } catch {
      notify("Falha ao atualizar dados de outra aba.");
    }
  }
});
window.addEventListener("online", render);
window.addEventListener("offline", render);
let prompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  prompt = e;
  $("#install").hidden = false;
});
$("#install").onclick = async () => {
  if (prompt) {
    await prompt.prompt();
    prompt = null;
    $("#install").hidden = true;
  }
};
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("./sw.js")
    .catch(() => notify("Modo offline indisponível. Use HTTPS ou localhost."));
page = pages[location.hash.slice(1)] ? location.hash.slice(1) : "dashboard";
render();
