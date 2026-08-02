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
- Para que a janela apareça no **remote desktop / computer use**, inicie no display VNC já existente: `DISPLAY=:1 npm start`. Não use `xvfb-run` para testes visuais — ele cria um display virtual isolado que **não** é visível no remote desktop. Use `xvfb-run -a npm start` apenas para uma verificação headless "sobe sem erro" quando não há display.
- Dados são salvos localmente via `localStorage` do Electron em `~/.config/painel-ubs-planifica/Local Storage/` (não é um banco externo).
- Não rode `npm run dist` no Cloud a menos que a tarefa peça build Windows — o target principal do builder é Windows (`--win`).
