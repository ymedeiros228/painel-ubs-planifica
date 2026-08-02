# Painel UBS Planifica

App Electron (desktop) do Painel de Ações das UBS — PlanificaSUS Passagem Franca (MA).

## Comandos locais

- Instalar: `npm ci`
- Rodar app: `npm start` (abre janela Electron)
- Empacotar Windows: `npm run dist`

## Cursor Cloud specific instructions

- Este projeto é um app **Electron**. No Cloud, use o remote desktop / computer use para ver a UI.
- Dependências de sistema vêm do `.cursor/Dockerfile` (GTK, NSS, etc.).
- Após `npm ci`, inicie com `npm start` (ou `npx electron .`).
- Se a janela não aparecer, rode com display virtual: `xvfb-run -a npm start`.
- Não rode `npm run dist` no Cloud a menos que a tarefa peça build Windows — o target principal do builder é Windows (`--win`).
