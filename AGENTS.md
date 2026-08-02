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
- No Cloud já existe um display gráfico ativo em `DISPLAY=:1` (o mesmo do remote desktop / computer use), então `DISPLAY=:1 npm start` abre a janela diretamente — o `xvfb-run -a npm start` só é necessário se não houver display disponível.
- Ao iniciar, o Electron imprime erros de `bus.cc ... Failed to connect to the bus` (D-Bus) e `viz_main_impl.cc ... Exiting GPU process` — são **inofensivos** neste container; o app abre e funciona normalmente mesmo com essas mensagens.
- Todos os dados são gravados via `localStorage` (não há backend nem banco). O estado persiste no perfil do usuário em `~/.config/painel-ubs-planifica`.
- Não há scripts de lint nem de testes automatizados neste projeto (só `start`, `pack` e `dist`); valide mudanças rodando o app.
- Não rode `npm run dist` no Cloud a menos que a tarefa peça build Windows — o target principal do builder é Windows (`--win`).
