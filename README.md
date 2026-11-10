# M4S Fluxo — Produção, Estoque e Full

PWA leve, instalável no Android, em português do Brasil. Projeto independente, sem dependências JavaScript de produção e pronto para um repositório GitHub. Não é um APK nativo. Não exige serviços pagos, cadastro em outro banco de dados ou Netlify.

## Começar no computador

1. Extraia o ZIP. Entre na pasta `m4s-fluxo`.
2. Tenha Python 3 instalado. No terminal execute:

```bash
python3 -m http.server 8080
```

No Windows, se `python3` não existir:

```powershell
py -m http.server 8080
```

3. Abra `http://localhost:8080` no navegador.

Não abra `index.html` com duplo clique: módulos JavaScript e service worker precisam de HTTP/HTTPS. Não há `npm install`: o app não utiliza pacotes externos. Node.js 22 ou superior é necessário apenas para executar os testes (`npm test`).

## Publicar no GitHub e instalar no Android

1. Crie um repositório vazio no GitHub.
2. Envie **o conteúdo** da pasta `m4s-fluxo` para a raiz, incluindo `.github/workflows/pages.yml`. Não envie o ZIP como único arquivo.
3. Use a branch `main` ou ajuste o nome no workflow.
4. Em Settings → Pages, selecione GitHub Actions como origem da publicação.
5. Em Actions, acompanhe “Publicar PWA no GitHub Pages”. O workflow executa os testes antes de publicar. A URL aparece no job e em Settings → Pages.
6. No Android, abra essa URL no Chrome. No menu, use “Instalar aplicativo” ou “Adicionar à tela inicial”. O botão de instalação dentro do app aparece quando o navegador disponibiliza esse recurso.
7. Abra uma vez com conexão antes de usar offline. A instalação não produz um arquivo APK; não é necessário APK para usar como aplicativo.

GitHub Pages precisa estar habilitado e disponível para seu plano e tipo de repositório. A publicação não foi realizada por este pacote. Para clonar depois de criar o repositório, use `git clone` com a URL exibida pelo seu próprio GitHub.

Os caminhos são relativos, inclusive manifesto e service worker, permitindo hospedar em um subdiretório de repositório. Não há URLs de CDN, fontes remotas ou bibliotecas externas. Para atualizar uma versão publicada, altere o nome de cache em `sw.js`; feche todas as janelas do app e reabra para ativar a nova versão.

## Primeiro uso

O app começa vazio, sem dados fictícios na sua operação.

1. **Produtos e contas:** cadastre Mercado Livre — Mast4Shop, Mercado Livre — Mast4Store, Shopee — Conta 1 e Shopee — Conta 2 (ou seus próprios nomes).
2. Cadastre peças físicas com SKU único e contas vinculadas.
3. Cadastre os kits marcando “Este produto é um kit” e adicionando uma ou mais peças à composição. Kits não podem conter outros kits. O mesmo produto pode estar vinculado a várias contas.
4. **Estoque e histórico:** registre o saldo inicial pronto como entrada, com motivo. Não inclua peças cortadas ou peças nas costureiras neste saldo.
5. **Corte e fabricação:** registre cortes. Finalize internamente ou envie os cortes para uma costureira cadastrada.
6. **Costureiras:** cadastre nome, bairro, valor por peça e dias de acerto. O valor é guardado em centavos, sem erros de arredondamento decimal. O lote conserva o valor por peça vigente no envio.
7. Retire lotes parcial ou totalmente. Peças boas alimentam o estoque pronto e a dívida. Perdas baixam o lote, mas não geram dívida. Registre pagamentos feitos fora do aplicativo. O botão de pagamento é apenas um registro contábil; não transfere dinheiro.
8. **Planejamento Full:** informe as vendas acumuladas dos últimos 7, 15 e 30 dias, cobertura desejada e data planejada. As vendas devem se referir à mesma data de consulta.
9. Informe o estoque atual disponível no Full pelo botão “Atualizar saldo Full”. Esse saldo precisa ser conferido manualmente após vendas: não existe conexão automática com Mercado Livre/Shopee.
10. Confirme um envio para consumir o estoque geral e criar trânsito. Após a chegada, use “Receber no Full”; aceita recebimentos parciais.

## Regras de cálculo físico

Todas as vendas, saldos e envios Full são informados em **unidades do anúncio**. Para um kit de 3, “100” significa 100 kits.

```text
Giro diário = maior de (vendas7 / 7, vendas15 / 15, vendas30 / 30)
Cobertura atual = saldo disponível no Full / giro diário
Envio sugerido = máximo(0, teto(giro × dias desejados − saldo Full − trânsito))
Capacidade de montagem = menor piso(estoque componente / quantidade no kit)
```

É uma política conservadora contra rupturas: usa a maior média, não a soma de janelas sobrepostas. Não calcula sazonalidade, prazo de recebimento, demanda futura garantida ou limites oficiais das plataformas. Datas de envio são planejamento manual; não são promessas da transportadora ou lembretes automáticos.

Exemplo: 1.000 balaclavas prontas; envio de 100 kits com 3; consumo de 300 balaclavas; estoque geral passa a 700. Enquanto não houver recebimento, 100 kits ficam em trânsito. Ao receber 40 kits, ficam 60 em trânsito e 40 entram no Full. O recebimento não desconta o estoque geral novamente.

O relatório soma a demanda de peças de todos os anúncios planejados antes de calcular faltas, evitando contar a mesma disponibilidade várias vezes. Sugestões individuais do Full compartilham o mesmo estoque geral: a confirmação de envio sempre valida o saldo atualizado.

No cadastro de produtos não existem preços ou custos. Valores financeiros aparecem somente na conta corrente das costureiras, conforme o requisito de acerto de produção.

## Backup, privacidade e WhatsApp

- Dados ficam no `localStorage` do navegador, no aparelho e na origem (URL) em uso. Fechar e reabrir preserva os registros.
- Limpar dados do site, usar aba anônima, perder o aparelho ou mudar a URL pode fazer os dados ficarem indisponíveis. Faça backup diário ou após movimentações importantes.
- Em “Backup e relatório”, baixe o JSON completo. Guarde uma cópia fora do aparelho.
- A restauração valida os eventos, referências e saldos antes de substituir os dados. Pede confirmação e inicia o download do backup anterior. Verifique se o navegador concluiu o download. Restauração substitui o conjunto; não mescla dois backups.
- O arquivo de backup contém informações da operação e valores de acerto. Compartilhe com cuidado.
- O app não sincroniza aparelhos automaticamente. Para transferir dados, exporte no aparelho de origem e restaure no destino. Evite editar cópias divergentes em paralelo.
- As abas da mesma origem se atualizam por evento de armazenamento. O navegador com Web Locks serializa gravações entre abas; em navegador sem esse recurso, mantenha apenas uma aba ativa.
- O aplicativo não envia dados automaticamente. WhatsApp abre uma mensagem pronta, revisável, para você escolher o contato e confirmar o envio. Há opção de copiar manualmente. A mensagem inclui produção, cortes necessários, costureiras, saldos e datas de envio planejadas.
- O código hospedado pode ser público; os dados locais não são incluídos no repositório ou compartilhados por conhecer a URL. Pessoas com acesso ao navegador/aparelho conseguem visualizar os dados: não há login ou criptografia local.

## Histórico e limitações importantes

A interface não possui botão de apagar ou editar registros históricos. Cada comando gera um UUID e timestamp ISO automático, e as telas usam data/hora local do aparelho. Nunca altere o relógio para simular registros anteriores. Lotes e envios têm identificadores próprios.

O histórico é preservado por um registro de eventos e reconstruído a cada leitura. Não há garantia de imutabilidade contra manipulação externa do armazenamento, alteração do relógio ou backup adulterado que permaneça semanticamente válido. Auditoria inviolável, assinaturas de servidor, usuários, permissões, sincronização e recuperação remota exigem um backend autenticado — não estão implementados nesta versão local.

Cadastros e composições não são editáveis nesta versão para não reescrever referências históricas. Para nova composição, cadastre outro SKU. Entradas de estoque permitem saldo inicial e compras externas; saídas são realizadas pelos envios Full. Não há fluxo de cancelamento/estorno de eventos ou ajustes negativos livres. Revise as quantidades antes de confirmar. Faça backup antes de operações grandes.

O armazenamento local tem limite variável conforme o navegador. Falha de gravação não aplica a movimentação no estado em memória; exporte um backup se houver erro de espaço. O app não é substituto de ERP fiscal, financeiro, integração de pedidos ou WMS de marketplace.

## Estrutura

```text
index.html                  Estrutura acessível e navegação
src/core.js                 Regras, eventos, saldos, previsão, validação de backup
src/app.js                  Formulários, dashboard, persistência, relatório
src/style.css               Layout responsivo e componentes visuais
icons/                      Ícones PNG 192 e 512
manifest.webmanifest        Identidade e instalação PWA
sw.js                       Cache offline da aplicação
.github/workflows/pages.yml Publicação GitHub Pages com testes
 tests/core.test.js          Testes de domínio (node:test)
```

A função `command` não altera o estado anterior: valida uma operação e retorna um novo histórico. `state` reconstrói estoques, cortes, lotes, saldo Full e dívida. A gravação completa ocorre antes de atualizar a interface; falhas não exibem saldo fictício.

## Verificação

```bash
npm test
node --check src/app.js
node --check src/core.js
```

Testes cobrem: consumo de 100 kits de 3; kits mistos; bloqueio de estoque insuficiente sem movimentação parcial; trânsito e chegada parcial; produção interna; lote com retirada parcial e perdas; pagamento e saldo devedor; entradas inválidas; SKU duplicado; vendas incoerentes; restauração válida e rejeição de histórico inválido; acerto no fim de fevereiro; giro zero.

Verificação manual de interface realizada no Chrome de desktop: abertura do painel, cadastro de conta, cadastro de produto e confirmação de salvamento. O CSS possui pontos de adaptação para celular e tablet; instalação em dispositivo Android físico e operação offline em aparelho físico não foram verificadas neste ambiente. Testes não garantem ausência absoluta de bugs.

Roteiro recomendado antes de usar em produção: cadastrar uma conta e peça de teste, registrar 500 cortes, enviar 250 à costureira, retirar 245 com 5 perdas, finalizar os 250 internos; conferir 495 prontas; criar kit de 3 e enviar 100; conferir 195 peças; receber 40 kits, conferir 60 em trânsito e 40 no Full; exportar e restaurar o backup. Use um perfil de navegador separado para esse ensaio.
