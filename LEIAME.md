# Site Naturalle Restaurante

Site estático (HTML, CSS e JS puros). Não precisa de servidor especial: publique a pasta inteira
na Hostinger, Netlify, Vercel, GitHub Pages ou no próprio domínio naturallerestaurante.com.br.

## Testar no computador
    cd naturalle
    python -m http.server 8000
Abra http://localhost:8000. Não funciona abrindo o index.html direto, por causa dos módulos JS.

## O que editar
- **Horários, taxa de entrega, pedido mínimo e WhatsApp:** `js/app.js`, objeto `CONFIG` no topo.
- **Pratos e preços:** `js/menu.js`. Cada linha é `[id, nome, descrição, preço]`.
  Pratos de dia fixo usam `{ days: [3] }` (0 = domingo, 6 = sábado).

## Como o delivery funciona
O cliente escolhe almoço ou jantar, monta a sacola, informa endereço, horário e pagamento,
e o pedido chega formatado no WhatsApp (81) 99816-5515. Os dados do cliente ficam salvos
no navegador para o próximo pedido.
