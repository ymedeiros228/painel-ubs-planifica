/**
 * Gera o PDF oficial de entrega do Painel UBS Planifica.
 * Visual próprio (navy/âmbar do app) — padrão de estrutura inspirado no
 * manual de entrega do SIGAPS, sem copiar a identidade visual.
 *
 * Uso: node scripts/generate-manual-pdf.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { marked } from 'marked';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manualDir = join(root, 'docs', 'manual');
const input = join(manualDir, 'MANUAL_ENTREGA.md');
const output = join(manualDir, 'PainelUBS_Manual_Entrega_Oficial.pdf');
const REPO_URL = 'https://github.com/ymedeiros228/painel-ubs-planifica';
const DOC_DATE = '04/08/2026';
const DOC_DATE_LONG = '04 de agosto de 2026';
const APP_VERSION = '3.1.1';

mkdirSync(join(manualDir, 'assets'), { recursive: true });

let qrDataUrl = '';
try {
  const QRCode = require('qrcode');
  const qrBuffer = await QRCode.toBuffer(REPO_URL, {
    type: 'png',
    width: 400,
    margin: 1,
    color: { dark: '#172554', light: '#ffffff' }
  });
  const qrPath = join(manualDir, 'assets', 'qrcode-repo.png');
  writeFileSync(qrPath, qrBuffer);
  qrDataUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;
} catch (err) {
  console.warn('QR Code opcional não gerado:', err.message);
}

const logoPath = join(manualDir, 'assets', 'logo-app.png');
const logoDataUrl = existsSync(logoPath)
  ? `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`
  : '';

const coverHtml = `
<section class="cover-sheet">
  <div class="cover-wash"></div>
  <div class="cover-accent"></div>
  <div class="cover-badge">DOCUMENTO OFICIAL DE ENTREGA</div>
  <div class="cover-inner">
    ${logoDataUrl ? `<img class="cover-logo" src="${logoDataUrl}" alt="Logo Painel UBS Planifica" />` : ''}
    <p class="cover-org">PlanificaSUS · Passagem Franca (MA)</p>
    <p class="cover-city">Entrega ao cliente · Jonas Almeida Medeiros · Enfermeiro APS</p>
    <h1 class="cover-title">Painel UBS<br>Planifica</h1>
    <p class="cover-subtitle">Registro e acompanhamento do plano de ações das UBS<br>no desktop Windows — offline, com backup automático</p>
    <div class="cover-doc-label">MANUAL TÉCNICO · TERMO DE ENTREGA E ACEITE</div>
    <table class="cover-table">
      <tr><td class="lbl">Cliente / Receptor</td><td class="val">Jonas Almeida Medeiros — Enfermeiro da APS</td></tr>
      <tr><td class="lbl">Município</td><td class="val">Passagem Franca — Maranhão</td></tr>
      <tr><td class="lbl">Desenvolvedor</td><td class="val">Yuri Medeiros Bandeira — Programador / Responsável técnico</td></tr>
      <tr><td class="lbl">Versão do sistema</td><td class="val">${APP_VERSION} — Portable Windows</td></tr>
      <tr><td class="lbl">Data da entrega</td><td class="val">${DOC_DATE_LONG}</td></tr>
      <tr><td class="lbl">Formato</td><td class="val">Aplicativo desktop Electron (sem nuvem)</td></tr>
      <tr><td class="lbl">Repositório</td><td class="val">github.com/ymedeiros228/painel-ubs-planifica</td></tr>
    </table>
    <div class="cover-tags">
      <span>Electron</span><span>Windows Portable</span><span>Backup JSON</span><span>PlanificaSUS</span><span>APS</span><span>Offline</span>
    </div>
  </div>
  <div class="cover-bottom">
    Manual de entrega — Painel UBS Planifica v${APP_VERSION} · Cliente: Jonas Almeida Medeiros · Passagem Franca/MA
  </div>
</section>
`;

const backCoverHtml = `
<section class="back-cover">
  <div class="back-wash"></div>
  <div class="back-accent"></div>
  <div class="back-inner">
    ${logoDataUrl ? `<img class="back-logo" src="${logoDataUrl}" alt="Logo" />` : ''}
    <p class="back-title">Painel UBS Planifica</p>
    <p class="back-version">v${APP_VERSION}</p>
    <p class="back-text">Aplicativo desktop entregue e documentado para o registro do plano de ações das UBS no PlanificaSUS de Passagem Franca/MA.</p>
    <table class="back-table">
      <tr><td class="lbl">Desenvolvedor</td><td class="val">Yuri Medeiros Bandeira</td></tr>
      <tr><td class="lbl">Cliente</td><td class="val">Jonas Almeida Medeiros — Enfermeiro APS</td></tr>
      <tr><td class="lbl">Município</td><td class="val">Passagem Franca — Maranhão</td></tr>
      <tr><td class="lbl">Data da entrega</td><td class="val">${DOC_DATE_LONG}</td></tr>
      <tr><td class="lbl">Repositório</td><td class="val">github.com/ymedeiros228/painel-ubs-planifica</td></tr>
    </table>
    ${
      qrDataUrl
        ? `<div class="back-qr">
      <img src="${qrDataUrl}" alt="QR Code do repositório" class="back-qr-img" />
      <p class="back-qr-label">Repositório do projeto</p>
      <p class="back-qr-url">github.com/ymedeiros228/painel-ubs-planifica</p>
    </div>`
        : ''
    }
    <p class="back-note">Uso interno · UNLICENSED · Dados locais no computador do cliente</p>
  </div>
</section>
`;

const css = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: "DM Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: #0F172A;
  }

  .cover-sheet {
    width: 210mm; height: 297mm; page-break-after: always;
    position: relative; overflow: hidden;
    background: linear-gradient(125deg, #0B1220 0%, #172554 38%, #1E3A8A 72%, #1D4ED8 100%);
    color: #fff;
  }
  .cover-wash {
    position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(900px 520px at 10% -10%, rgba(96,165,250,0.28), transparent 55%),
      radial-gradient(700px 420px at 110% 20%, rgba(253,230,138,0.12), transparent 50%),
      radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: auto, auto, 18px 18px;
  }
  .cover-accent {
    position: absolute; top: 0; left: 0; right: 0; height: 7mm;
    background: linear-gradient(90deg, #F59E0B, #60A5FA, #1D4ED8);
  }
  .cover-badge {
    position: absolute; top: 14mm; right: 16mm; z-index: 2;
    font-size: 7.5pt; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
    padding: 6px 12px; border: 1px solid rgba(255,255,255,0.35); border-radius: 999px;
    background: rgba(15,23,42,0.35);
  }
  .cover-inner {
    position: relative; z-index: 1;
    padding: 18mm 16mm 14mm; height: calc(297mm - 16mm);
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .cover-logo {
    width: 28mm; height: 28mm; border-radius: 6mm;
    margin: 4mm 0 5mm; box-shadow: 0 10px 28px rgba(0,0,0,0.35);
  }
  .cover-org {
    margin: 0; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1.6px;
    color: #BFDBFE; font-weight: 700;
  }
  .cover-city { margin: 6px 0 10px; font-size: 11.5pt; font-weight: 600; color: #E2E8F0; }
  .cover-title {
    margin: 2mm 0 0; font-family: "Sora", "Segoe UI Semibold", sans-serif;
    font-size: 34pt; font-weight: 800; letter-spacing: -0.5px;
    line-height: 1.05; border: none; color: #fff;
  }
  .cover-subtitle {
    margin: 12px 0 16px; font-size: 11.5pt; line-height: 1.55;
    max-width: 155mm; color: #DBEAFE; opacity: 0.95;
  }
  .cover-doc-label {
    display: inline-block; padding: 8px 18px;
    border: 1px solid rgba(253,230,138,0.55); border-radius: 999px;
    font-size: 8.8pt; font-weight: 700; letter-spacing: 0.7px;
    margin-bottom: 14px; background: rgba(245,158,11,0.12); color: #FDE68A;
  }
  .cover-table {
    width: 100%; max-width: 168mm; border-collapse: collapse;
    font-size: 9.2pt; text-align: left; margin-bottom: 14px;
  }
  .cover-table td {
    padding: 6.5px 10px; border-bottom: 1px solid rgba(255,255,255,0.14);
    vertical-align: top; background: transparent !important; color: #fff !important;
  }
  .cover-table .lbl { width: 36%; font-weight: 700; color: #FDE68A !important; white-space: nowrap; }
  .cover-table .val { color: #F8FAFC !important; }
  .cover-tags { margin-top: auto; display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; padding-bottom: 14mm; }
  .cover-tags span {
    font-size: 8pt; padding: 4px 11px; border-radius: 999px;
    border: 1px solid rgba(147,197,253,0.4); background: rgba(15,23,42,0.28); color: #DBEAFE;
  }
  .cover-bottom {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 2;
    padding: 8mm 16mm; font-size: 8pt; text-align: center; color: #CBD5E1;
    border-top: 1px solid rgba(255,255,255,0.16); background: rgba(2,6,23,0.35);
  }

  .back-cover {
    width: 210mm; height: 297mm; page-break-before: always;
    position: relative; background: #0B1220; color: #fff;
    display: flex; align-items: center; justify-content: center;
  }
  .back-wash {
    position: absolute; inset: 0;
    background: radial-gradient(700px 500px at 50% 0%, rgba(29,78,216,0.35), transparent 60%);
  }
  .back-accent {
    position: absolute; bottom: 0; left: 0; right: 0; height: 6mm;
    background: linear-gradient(90deg, #1D4ED8, #60A5FA, #F59E0B);
  }
  .back-inner { position: relative; z-index: 1; text-align: center; padding: 18mm; max-width: 155mm; }
  .back-logo { width: 22mm; height: 22mm; border-radius: 5mm; margin: 0 auto 10px; display: block; }
  .back-title {
    font-family: "Sora", "Segoe UI Semibold", sans-serif;
    font-size: 20pt; font-weight: 800; letter-spacing: -0.3px; margin: 0;
  }
  .back-version { margin: 4px 0 12px; color: #FDE68A; font-weight: 700; font-size: 11pt; }
  .back-text { font-size: 10.5pt; line-height: 1.6; color: #CBD5E1; margin-bottom: 18px; }
  .back-table { width: 100%; font-size: 9.3pt; border-collapse: collapse; margin: 0 auto 16px; text-align: left; }
  .back-table td {
    padding: 7px 10px; border-bottom: 1px solid rgba(255,255,255,0.12);
    background: transparent !important; color: #fff !important;
  }
  .back-table .lbl { font-weight: 700; color: #FDE68A !important; width: 38%; white-space: nowrap; }
  .back-table .val { color: #F8FAFC !important; }
  .back-qr { margin: 18px auto 8px; text-align: center; page-break-inside: avoid; }
  .back-cover .back-qr-img {
    display: block !important; width: 40mm !important; height: 40mm !important;
    max-width: 40mm !important; margin: 0 auto !important; padding: 3.5mm !important;
    background: #fff !important; border: 2px solid rgba(147,197,253,0.5) !important;
    border-radius: 10px !important; box-shadow: none !important;
  }
  .back-qr-label { font-size: 10pt; font-weight: 700; margin: 10px 0 3px; color: #fff; }
  .back-qr-url { font-size: 9pt; margin: 0; color: #93C5FD; letter-spacing: 0.2px; }
  .back-note { font-size: 8.5pt; color: #94A3B8; margin-top: 16px; }

  .doc-body { padding: 17mm 16mm 20mm; font-size: 10.4pt; line-height: 1.62; text-align: justify; }
  h1 {
    color: #1E3A8A; font-family: "Sora", "Segoe UI Semibold", sans-serif;
    font-size: 17.5pt; border-bottom: 3px solid #1D4ED8;
    padding-bottom: 8px; margin-top: 0; page-break-before: always;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 {
    color: #1D4ED8; font-size: 12.8pt; margin-top: 20px;
    border-left: 4px solid #F59E0B; padding-left: 11px;
  }
  h3 { color: #334155; font-size: 11.2pt; margin-top: 15px; }
  .doc-body table { border-collapse: collapse; width: 100%; margin: 11px 0; font-size: 9.3pt; page-break-inside: avoid; }
  .doc-body th, .doc-body td { border: 1px solid #C7D7F0; padding: 7px 9px; text-align: left; vertical-align: top; }
  .doc-body th { background: #EFF6FF; color: #1E3A8A; font-weight: 700; }
  .doc-body tr:nth-child(even) td { background: #F8FAFC; }
  .doc-body img {
    display: block; width: 100%; max-width: 176mm; height: auto; margin: 12px auto;
    border: 1px solid #C7D7F0; border-radius: 8px; box-shadow: 0 6px 18px rgba(30,58,138,0.10);
    page-break-inside: avoid;
  }
  .fig-caption {
    text-align: center; font-size: 8.7pt; color: #64748B; font-style: italic;
    margin: -4px 0 15px; line-height: 1.45;
  }
  .fig-caption.fig-hero {
    font-size: 9.6pt; font-weight: 650; font-style: normal; color: #334155; margin-bottom: 18px;
  }
  .toc { page-break-after: always; padding-bottom: 6mm; }
  .toc h2 { border: none; padding: 0; margin: 0 0 14px; font-size: 16pt; color: #1E3A8A; text-align: center; }
  .toc ol { padding-left: 0; list-style: none; counter-reset: toc; max-width: 168mm; margin: 0 auto; }
  .toc ol li {
    counter-increment: toc; padding: 7px 0; border-bottom: 1px dotted #C7D7F0; font-size: 10pt;
  }
  .toc ol li::before { content: counter(toc) ". "; font-weight: 700; color: #1D4ED8; margin-right: 6px; }
  .toc ol li a { color: #0F172A; text-decoration: none; }
  .contract-banner {
    background: linear-gradient(135deg, #FFFBEB, #EFF6FF);
    border: 1px solid #93C5FD; border-radius: 10px; padding: 13px 15px; margin: 14px 0;
    page-break-inside: avoid; text-align: center;
  }
  .contract-banner strong { color: #1E3A8A; font-size: 10.8pt; }
  .flow-step {
    background: #F8FAFC; border: 1px solid #BFDBFE; border-radius: 10px;
    padding: 12px 14px; margin: 10px 0; page-break-inside: avoid;
  }
  .flow-step strong { color: #1D4ED8; }
  .info-box {
    background: #EFF6FF; border: 1px solid #93C5FD; border-radius: 10px;
    padding: 11px 14px; margin: 11px 0; page-break-inside: avoid;
  }
  .warning-box {
    background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 10px;
    padding: 11px 14px; margin: 11px 0; page-break-inside: avoid;
  }
  .signature-page { page-break-before: always; }
  .signature-page h1 { color: #0F172A; border-bottom-color: #0F172A; }
  .signature-block { margin: 26px 0; page-break-inside: avoid; }
  .signature-block h3 {
    margin-top: 0; color: #1D4ED8; font-size: 12pt;
    border-bottom: 2px solid #E2E8F0; padding-bottom: 6px;
  }
  .signature-line {
    border-top: 2px solid #0F172A; margin-top: 0; padding-top: 9px; width: 88%; font-size: 10pt;
  }
  .signature-blank { min-height: 100px; margin: 8px 0 0; }
  hr { border: none; border-top: 1px solid #E2E8F0; margin: 16px 0; }
  ul, ol { padding-left: 22px; }
  li { margin-bottom: 4px; }
  p { orphans: 3; widows: 3; }
  code { background: #F1F5F9; padding: 1px 5px; border-radius: 3px; font-size: 9pt; }
`;

let md = readFileSync(input, 'utf8');
const screenshotDir = join(manualDir, 'screenshots').replace(/\\/g, '/');
md = md.replace(/\]\(screenshots\//g, `](file:///${screenshotDir}/`);

const htmlBody = marked.parse(md, { gfm: true });
const html = `<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
<style>${css}</style>
</head><body>${coverHtml}<div class="doc-body">${htmlBody}</div>${backCoverHtml}</body></html>`;

const buildHtml = join(manualDir, '_build.html');
writeFileSync(buildHtml, html, 'utf8');

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
});
const page = await browser.newPage();
await page.goto(`file:///${buildHtml.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
try {
  await page.waitForFunction(
    () => {
      const imgs = [...document.images];
      return imgs.length === 0 || imgs.every((img) => img.complete);
    },
    { timeout: 45_000 }
  );
} catch (_) {
  console.warn('Timeout aguardando imagens — gerando PDF mesmo assim.');
}
await page.pdf({
  path: output,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', bottom: '14mm', left: '0', right: '0' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#64748B;padding:0 16mm;display:flex;justify-content:space-between;font-family:DM Sans,Segoe UI,Arial,sans-serif;"><span>Painel UBS Planifica — Manual de Entrega · Passagem Franca/MA · ${DOC_DATE}</span><span>Pág. <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
});
await browser.close();
console.log(`PDF gerado: ${output}`);
