# Manual de entrega — Painel UBS Planifica

Pacote oficial de documentação para entrega ao cliente (Jonas / APS Passagem Franca).

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `MANUAL_ENTREGA.md` | Fonte editável do manual |
| `PainelUBS_Manual_Entrega_Oficial.pdf` | PDF oficial (capa, prints, assinaturas) |
| `screenshots/` | Capturas da aplicação |
| `assets/logo-app.png` | Logo usado na capa |
| `assets/qrcode-repo.png` | QR do repositório (gerado no build) |

## Regenerar o PDF

Na raiz do projeto:

```bash
npm run docs:manual
```

Requisitos: dependências de documentação (`marked`, `playwright`, `qrcode`) e Chromium do Playwright.

## Conteúdo coberto

1. Apresentação e objetivo  
2. Escopo da entrega  
3. Instalação Portable  
4. Cadastro / OTs / Dashboard / Histórico  
5. Backup e recuperação  
6. Fluxo do dia a dia  
7. Termo de aceite com campos de assinatura  

Visual e redação próprios do Painel UBS Planifica (não é cópia do manual do SIGAPS).
