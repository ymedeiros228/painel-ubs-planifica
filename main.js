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

function primaryDataPath() {
  return path.join(app.getPath('userData'), DATA_FILE);
}

function previousDataPath() {
  return path.join(app.getPath('userData'), PREV_FILE);
}

function mirrorDataPath() {
  return path.join(documentsMirrorDir(), DATA_FILE);
}

function dailyBackupPath() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(app.getPath('userData'), 'backups', `painel-dados-${day}.json`);
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

function pickRichestSnapshot(candidates) {
  let best = null;
  let bestCount = -1;
  for (const item of candidates) {
    if (!item || !item.data) continue;
    const count = snapshotActionCount(item.data);
    const updated = Date.parse(item.data.updatedAt || 0) || 0;
    const bestUpdated = best ? Date.parse(best.data.updatedAt || 0) || 0 : 0;
    if (count > bestCount || (count === bestCount && updated >= bestUpdated)) {
      best = item;
      bestCount = count;
    }
  }
  return best;
}

function collectCandidateSnapshots() {
  const paths = [
    { label: 'principal', path: primaryDataPath() },
    { label: 'anterior', path: previousDataPath() },
    { label: 'espelho-documentos', path: mirrorDataPath() },
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

  // Guarda a versão anterior antes de sobrescrever
  try {
    if (fs.existsSync(primary)) {
      fs.copyFileSync(primary, prev);
    }
  } catch (err) {
    console.error('Falha ao preservar backup anterior:', err.message);
  }

  writeJsonAtomic(primary, data);

  try {
    writeJsonAtomic(mirrorDataPath(), data);
  } catch (err) {
    console.error('Falha ao espelhar em Documentos:', err.message);
  }

  try {
    writeJsonAtomic(dailyBackupPath(), data);
  } catch (err) {
    console.error('Falha no backup diário:', err.message);
  }

  return {
    ok: true,
    primary,
    mirror: mirrorDataPath(),
    daily: dailyBackupPath(),
    updatedAt: data.updatedAt,
    actionCount: data.actions.length,
    otCount: data.ots.length
  };
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
    const best = pickRichestSnapshot(collectCandidateSnapshots());
    if (!best) return { ok: false, data: null };
    return {
      ok: true,
      source: best.label,
      path: best.path,
      data: best.data
    };
  });

  ipcMain.handle('backup:save', async (_event, snapshot) => {
    try {
      return saveSnapshot(snapshot || {});
    } catch (err) {
      console.error('backup:save', err);
      return { ok: false, error: String(err && err.message ? err.message : err) };
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
    const data = readJsonSafe(result.filePaths[0]);
    if (!data || (!Array.isArray(data.actions) && !Array.isArray(data.ots))) {
      return { ok: false, error: 'Arquivo JSON inválido para este painel.' };
    }
    const saved = saveSnapshot(data);
    return { ok: true, data, ...saved };
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
                'Versão 3.1.0\n' +
                'Backup automático em arquivo JSON a cada alteração.\n\n' +
                `Pasta de dados:\n${info.userData}\n\n` +
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
