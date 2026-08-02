# Painel UBS Planifica

App Electron (desktop) do Painel de Ações das UBS — PlanificaSUS Passagem Franca (MA).

## Comandos locais

- Instalar: `npm ci`
- Rodar app: `npm start` (abre janela Electron)
- Empacotar Windows: `npm run dist`

## Cursor Cloud specific instructions

- Este projeto é um app **Electron**. No Cloud, use o remote desktop / computer use para ver a UI.
- Dependências de sistema vêm do `.cursor/Dockerfile` (GTK, NSS, dbus-x11, etc.).
- Após `npm ci`, inicie com `npm start` (usa `scripts/start.js`, que no Linux cria um session bus D-Bus se faltar).
- No Cloud já existe display gráfico em `DISPLAY=:1`, então `DISPLAY=:1 npm start` abre a janela direto. Use `xvfb-run -a npm start` só se não houver display.
- `main.js` desliga GPU acelerada de propósito (software raster) — evita o crash do processo GPU em containers/remote desktop.
- Todos os dados ficam em `localStorage` (perfil em `~/.config/painel-ubs-planifica`); não há backend/DB.
- Não há scripts de lint/test; valide mudanças rodando o app.
- Não rode `npm run dist` no Cloud a menos que a tarefa peça build Windows — o target principal do builder é Windows (`--win`).
