const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Em containers / remote desktop a GPU acelerada costuma falhar
// ("Exiting GPU process due to errors during initialization").
// Este app é UI HTML local — software raster é suficiente e evita o crash.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');

const APP_DIR_NAME = 'painel-ubs-planifica';
const DATA_FILE = 'painel-dados.json';
const PREV_FILE = 'painel-dados-anterior.json';
const MIRROR_DIR_NAME = 'PainelUBSPlanifica';
const DESKTOP_BACKUP_DIR_NAME = 'Backup UBS Planifica';
const DESKTOP_README = 'LEIA-ME-BACKUP.txt';

function isPortable() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}

function configureUserDataPath() {
  // Portable: dados ao lado do .exe (pasta estável, fácil de copiar/backup)
  if (isPortable()) {
    const portableRoot = process.env.PORTABLE_EXECUTABLE_DIR;
    const dataDir = path.join(portableRoot, 'painel-ubs-dados');
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (_) {}
    app.setPath('userData', dataDir);
  }
}

configureUserDataPath();

function legacyAppDataDir() {
  // Perfil antigo (antes de redirecionar o Portable)
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), APP_DIR_NAME);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_DIR_NAME);
  }
  return path.join(os.homedir(), '.config', APP_DIR_NAME);
}

function documentsMirrorDir() {
  const docs = app.getPath('documents');
  return path.join(docs, MIRROR_DIR_NAME);
}

function desktopBackupDir() {
  return path.join(app.getPath('desktop'), DESKTOP_BACKUP_DIR_NAME);
}

function primaryDataPath() {
  return path.join(app.getPath('userData'), DATA_FILE);
}

function previousDataPath() {
  return path.join(app.getPath('userData'), PREV_FILE);
}

function mirrorDataPath() {
  return path.join(documentsMirrorDir(), DATA_FILE);
}

function desktopDataPath() {
  return path.join(desktopBackupDir(), DATA_FILE);
}

function desktopLastGoodPath() {
  return path.join(desktopBackupDir(), 'painel-dados-ultimo-com-dados.json');
}

function dailyBackupPath() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(app.getPath('userData'), 'backups', `painel-dados-${day}.json`);
}

function ensureDesktopBackupFolder() {
  const dir = desktopBackupDir();
  fs.mkdirSync(dir, { recursive: true });
  const readmePath = path.join(dir, DESKTOP_README);
  const readme = [
    'BACKUP AUTOMÁTICO — Painel UBS Planifica',
    '========================================',
    '',
    'Esta pasta é atualizada sozinha a cada alteração no app.',
    '',
    'Arquivo principal:     painel-dados.json  (estado atual)',
    'Último com dados:      painel-dados-ultimo-com-dados.json',
    'Cópia anterior:        painel-dados-anterior.json',
    '',
    'Se o app abrir vazio:',
    '1. Se aparecer “Backup encontrado”, clique em Restaurar',
    '2. Ou Dashboard → Importar → prefira',
    '   painel-dados-ultimo-com-dados.json',
    '',
    'Mantenha o .exe e a pasta painel-ubs-dados juntos.',
    'Pode copiar esta pasta inteira para pen drive.',
    ''
  ].join('\n');
  try {
    // Sempre atualiza o LEIA-ME do backup (instruções mudam entre versões)
    fs.writeFileSync(readmePath, readme, 'utf8');
  } catch (_) {}
  return dir;
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Falha ao ler JSON:', filePath, err.message);
    return null;
  }
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(tmp, payload, 'utf8');
  fs.renameSync(tmp, filePath);
}

function snapshotActionCount(snap) {
  if (!snap || !Array.isArray(snap.actions)) return 0;
  return snap.actions.length;
}

function collectCandidateSnapshots() {
  const paths = [
    { label: 'principal', path: primaryDataPath() },
    { label: 'anterior', path: previousDataPath() },
    { label: 'espelho-documentos', path: mirrorDataPath() },
    { label: 'espelho-area-trabalho', path: desktopDataPath() },
    {
      label: 'espelho-area-trabalho-anterior',
      path: path.join(desktopBackupDir(), PREV_FILE)
    },
    { label: 'ultimo-com-dados', path: desktopLastGoodPath() },
    { label: 'legado-appdata', path: path.join(legacyAppDataDir(), DATA_FILE) },
    { label: 'legado-espelho', path: path.join(legacyAppDataDir(), MIRROR_DIR_NAME, DATA_FILE) }
  ];

  // backups diários (mais recentes primeiro)
  const backupDir = path.join(app.getPath('userData'), 'backups');
  try {
    if (fs.existsSync(backupDir)) {
      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith('painel-dados-') && f.endsWith('.json'))
        .sort()
        .reverse();
      for (const f of files.slice(0, 14)) {
        paths.push({ label: `backup:${f}`, path: path.join(backupDir, f) });
      }
    }
  } catch (_) {}

  return paths
    .map((p) => ({ ...p, data: readJsonSafe(p.path) }))
    .filter((p) => p.data && (Array.isArray(p.data.actions) || Array.isArray(p.data.ots)));
}

function saveSnapshot(snapshot) {
  const data = {
    version: 1,
    updatedAt: new Date().toISOString(),
    seedFlags: snapshot && snapshot.seedFlags ? snapshot.seedFlags : undefined,
    ots: Array.isArray(snapshot.ots) ? snapshot.ots : [],
    actions: Array.isArray(snapshot.actions) ? snapshot.actions : []
  };
  if (!data.seedFlags) delete data.seedFlags;

  const primary = primaryDataPath();
  const prev = previousDataPath();
  const incomingCount = snapshotActionCount(data);
  const existingPrimary = readJsonSafe(primary);
  const existingCount = snapshotActionCount(existingPrimary);

  // Guarda versão anterior só quando o estado atual ainda tem dados
  // (evita que um "anterior" rico desfaça exclusões no próximo boot)
  try {
    if (existingPrimary && existingCount > 0 && incomingCount > 0) {
      fs.copyFileSync(primary, prev);
    } else if (existingPrimary && existingCount > 0 && incomingCount === 0) {
      // Apagou tudo de propósito: preserva o último estado com dados no "anterior"
      fs.copyFileSync(primary, prev);
    }
  } catch (err) {
    console.error('Falha ao preservar backup anterior:', err.message);
  }

  writeJsonAtomic(primary, data);

  try {
    // Espelho acompanha o estado atual (inclusive vazio intencional)
    writeJsonAtomic(mirrorDataPath(), data);
  } catch (err) {
    console.error('Falha ao espelhar em Documentos:', err.message);
  }

  try {
    ensureDesktopBackupFolder();
    const deskPrimary = desktopDataPath();
    const deskPrev = path.join(desktopBackupDir(), PREV_FILE);
    const existingDesk = readJsonSafe(deskPrimary);
    if (existingDesk && snapshotActionCount(existingDesk) > 0) {
      try {
        fs.copyFileSync(deskPrimary, deskPrev);
      } catch (_) {}
    }
    // painel-dados.json da Área de Trabalho = mesmo estado do app
    writeJsonAtomic(deskPrimary, data);
    // Último com dados: nunca sobrescreve com vazio (recuperação manual)
    if (incomingCount > 0) {
      writeJsonAtomic(desktopLastGoodPath(), data);
    }
  } catch (err) {
    console.error('Falha ao espelhar na Área de Trabalho:', err.message);
  }

  try {
    if (incomingCount > 0) {
      writeJsonAtomic(dailyBackupPath(), data);
    }
  } catch (err) {
    console.error('Falha no backup diário:', err.message);
  }

  return {
    ok: true,
    primary,
    mirror: mirrorDataPath(),
    desktop: desktopDataPath(),
    desktopDir: desktopBackupDir(),
    daily: dailyBackupPath(),
    updatedAt: data.updatedAt,
    actionCount: data.actions.length,
    otCount: data.ots.length
  };
}

let saveQueue = Promise.resolve();
let pendingSaveSnapshot = null;
function enqueueSaveSnapshot(snapshot) {
  // Coalescing: várias alterações rápidas → grava só a mais recente
  pendingSaveSnapshot = snapshot || {};
  const job = saveQueue.then(() => {
    const toSave = pendingSaveSnapshot;
    pendingSaveSnapshot = null;
    if (!toSave) return { ok: true, skipped: true };
    try {
      return saveSnapshot(toSave);
    } catch (err) {
      console.error('backup:save', err);
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  saveQueue = job.then(
    () => undefined,
    () => undefined
  );
  return job;
}

function getBackupInfo() {
  const primary = primaryDataPath();
  const snap = readJsonSafe(primary);
  return {
    portable: isPortable(),
    userData: app.getPath('userData'),
    primary,
    previous: previousDataPath(),
    mirror: mirrorDataPath(),
    documentsDir: documentsMirrorDir(),
    desktop: desktopDataPath(),
    desktopDir: desktopBackupDir(),
    legacyAppData: legacyAppDataDir(),
    exists: Boolean(snap),
    updatedAt: snap && snap.updatedAt ? snap.updatedAt : null,
    actionCount: snapshotActionCount(snap),
    otCount: snap && Array.isArray(snap.ots) ? snap.ots.length : 0
  };
}

function registerIpc() {
  ipcMain.handle('backup:getInfo', async () => getBackupInfo());

  ipcMain.handle('backup:load', async () => {
    // Fonte da verdade = arquivo principal. NÃO usa "mais rico"
    // (isso desfazia exclusões ao reabrir o app).
    const primaryPath = primaryDataPath();
    const data = readJsonSafe(primaryPath);
    if (data && (Array.isArray(data.actions) || Array.isArray(data.ots))) {
      return {
        ok: true,
        source: 'principal',
        path: primaryPath,
        data
      };
    }
    return { ok: false, data: null, empty: true };
  });

  ipcMain.handle('backup:probe', async () => {
    const candidates = collectCandidateSnapshots()
      .map((c) => ({
        label: c.label,
        path: c.path,
        actionCount: snapshotActionCount(c.data),
        otCount: Array.isArray(c.data.ots) ? c.data.ots.length : 0,
        updatedAt: c.data.updatedAt || null
      }))
      .filter((c) => c.label !== 'principal') // recuperação = cópias auxiliares
      .sort((a, b) => {
        if (b.actionCount !== a.actionCount) return b.actionCount - a.actionCount;
        return (Date.parse(b.updatedAt || 0) || 0) - (Date.parse(a.updatedAt || 0) || 0);
      });
    const best = candidates[0] || null;
    return {
      ok: true,
      primary: getBackupInfo(),
      candidates,
      best
    };
  });

  ipcMain.handle('backup:loadFromPath', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') {
      return { ok: false, error: 'Caminho inválido.' };
    }
    const data = readJsonSafe(filePath);
    if (!data || (!Array.isArray(data.actions) && !Array.isArray(data.ots))) {
      return { ok: false, error: 'Arquivo de backup inválido.' };
    }
    return { ok: true, path: filePath, data };
  });

  ipcMain.handle('backup:save', async (_event, snapshot) => {
    return enqueueSaveSnapshot(snapshot || {});
  });

  ipcMain.on('backup:saveSync', (event, snapshot) => {
    try {
      // Descarta pendências assíncronas obsoletas; o fechamento manda o estado final
      pendingSaveSnapshot = null;
      event.returnValue = saveSnapshot(snapshot || {});
    } catch (err) {
      event.returnValue = {
        ok: false,
        error: String(err && err.message ? err.message : err)
      };
    }
  });

  ipcMain.handle('backup:openFolder', async () => {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
    return { ok: true, path: dir };
  });

  ipcMain.handle('backup:openDocuments', async () => {
    const dir = documentsMirrorDir();
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
    return { ok: true, path: dir };
  });

  ipcMain.handle('backup:openDesktop', async () => {
    const dir = ensureDesktopBackupFolder();
    await shell.openPath(dir);
    return { ok: true, path: dir };
  });

  ipcMain.handle('backup:exportCopy', async () => {
    const snap = readJsonSafe(primaryDataPath());
    if (!snap) {
      return { ok: false, error: 'Nenhum backup principal encontrado.' };
    }
    const result = await dialog.showSaveDialog({
      title: 'Exportar backup do Painel UBS',
      defaultPath: path.join(
        app.getPath('documents'),
        `painel-ubs-backup-${new Date().toISOString().slice(0, 10)}.json`
      ),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    writeJsonAtomic(result.filePath, snap);
    return { ok: true, path: result.filePath };
  });

  ipcMain.handle('backup:importFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Importar backup JSON',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) {
      return { ok: false, canceled: true };
    }
    const filePath = result.filePaths[0];
    const data = readJsonSafe(filePath);
    if (!data || (!Array.isArray(data.actions) && !Array.isArray(data.ots))) {
      return { ok: false, error: 'Arquivo JSON inválido para este painel.' };
    }
    // Só lê — a confirmação e a gravação ficam no renderer
    return {
      ok: true,
      path: filePath,
      data,
      actionCount: snapshotActionCount(data),
      otCount: Array.isArray(data.ots) ? data.ots.length : 0
    };
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#E8EEF8',
    title: 'Painel UBS Planifica',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { type: 'separator' },
        {
          label: 'Abrir pasta de dados…',
          click: async () => {
            const dir = app.getPath('userData');
            fs.mkdirSync(dir, { recursive: true });
            await shell.openPath(dir);
          }
        },
        {
          label: 'Abrir backup em Documentos…',
          click: async () => {
            const dir = documentsMirrorDir();
            fs.mkdirSync(dir, { recursive: true });
            await shell.openPath(dir);
          }
        },
        {
          label: 'Abrir Backup UBS Planifica (Área de Trabalho)…',
          click: async () => {
            const dir = ensureDesktopBackupFolder();
            await shell.openPath(dir);
          }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' }
      ]
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'togglefullscreen', label: 'Tela cheia' },
        { role: 'zoomIn', label: 'Aumentar zoom' },
        { role: 'zoomOut', label: 'Diminuir zoom' },
        { role: 'resetZoom', label: 'Zoom padrão' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre',
          click: () => {
            const info = getBackupInfo();
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre',
              message: 'Painel UBS Planifica',
              detail:
                'Registro manual de ações das UBS — PlanificaSUS\nPassagem Franca (MA)\n\n' +
                'Versão 3.1.2\n' +
                'Backup automático em arquivo JSON a cada alteração.\n\n' +
                `Pasta de dados:\n${info.userData}\n\n` +
                `Área de Trabalho:\n${info.desktopDir}\n\n` +
                `Espelho em Documentos:\n${info.mirror}`
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  try {
    ensureDesktopBackupFolder();
  } catch (err) {
    console.error('Falha ao criar pasta de backup na Área de Trabalho:', err.message);
  }
  registerIpc();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
