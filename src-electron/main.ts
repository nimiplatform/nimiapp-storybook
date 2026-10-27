import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, session, shell, webContents } from 'electron';
import { externalWebUrl } from './external-links.js';
import { configureNimiElectronAppHostProfile } from '@nimiplatform/kit/shell/electron/host-profile';

// @nimi-authority: rule.storybook.runtime-ai.r001
try {
  configureNimiElectronAppHostProfile(app);
} catch (error) {
  process.stderr.write(`[nimi-app-host-profile] ${error instanceof Error ? error.message : String(error)}\n`);
  app.exit(78);
  throw error;
}

const {
  createNimiElectronStandardApplicationMenuTemplate,
  isAllowedElectronRendererUrl,
  registerNimiElectronAppAssetProtocolScheme,
  registerNimiElectronAppBridge,
} = await import('@nimiplatform/kit/shell/electron/main');

const STORYBOOK_APP_ID = 'nimi.storybook';
declare const __NIMI_ELECTRON_PRODUCTION__: boolean;
const IS_PRODUCTION_BUNDLE = typeof __NIMI_ELECTRON_PRODUCTION__ !== 'undefined'
  && __NIMI_ELECTRON_PRODUCTION__;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDir, '..');
if (process.platform === 'win32') app.setAppUserModelId(`ai.nimi.${app.isPackaged ? '' : 'dev.'}apps.nimi.storybook`);
const appIconPath = path.join(appRoot, 'assets', 'native', process.platform === 'win32' ? 'windows.ico' : process.platform === 'darwin' ? 'macos.png' : 'app.png');
const preloadPath = path.join(currentDir, 'preload.cjs');
const rendererDistUrl = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).toString();
const developmentRendererUrl = readDevelopmentRendererUrl();
let resettingRenderer = false;
let quitting = false;

app.setName('Storybook');
app.commandLine.appendSwitch('disable-background-networking');
Menu.setApplicationMenu(Menu.buildFromTemplate(
  createNimiElectronStandardApplicationMenuTemplate({ appName: 'Storybook' }),
));
registerNimiElectronAppAssetProtocolScheme(protocol);

void app.whenReady().then(bootstrapElectron).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error || 'Storybook Electron startup failed')}\n`);
  app.quit();
});

async function bootstrapElectron(): Promise<void> {
  // The development Electron bundle has its own Dock icon on macOS.
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(appIconPath);
  registerNimiElectronAppBridge({
    appId: STORYBOOK_APP_ID,
    allowedRendererUrls: [activeRendererUrl()],
    assetMediaPlatform: { protocol, webRequest: session.defaultSession.webRequest, webContents },
    ipcMain,
    onSessionInvalidated: resetAccountScopedRenderer,
  });
  await createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !resettingRenderer && BrowserWindow.getAllWindows().length === 0) app.quit();
});
app.on('before-quit', () => { quitting = true; });

function resetAccountScopedRenderer(): void {
  const windows = BrowserWindow.getAllWindows();
  if (quitting || windows.length === 0) return;
  resettingRenderer = true;
  try {
    for (const window of windows) window.destroy();
    void createMainWindow().catch((error: unknown) => {
      process.stderr.write(`[nimi-app-session-reset] ${error instanceof Error ? error.message : String(error)}\n`);
    });
  } finally { resettingRenderer = false; }
}

async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 390,
    minHeight: 620,
    title: 'Storybook',
    icon: appIconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(({ url }) => {
    const destination = externalWebUrl(url);
    if (destination) void shell.openExternal(destination).catch(() => {
      dialog.showErrorBox('链接未能打开', `请稍后重试，或复制此地址到浏览器：\n${destination}`);
    });
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedElectronRendererUrl(url, [activeRendererUrl()])) event.preventDefault();
  });
  try { await window.loadURL(activeRendererUrl()); }
  catch (error) { if (!window.isDestroyed()) throw error; }
  return window;
}

function activeRendererUrl(): string {
  return developmentRendererUrl || rendererDistUrl;
}

function readDevelopmentRendererUrl(): string {
  const prefix = '--nimi-dev-renderer-url=';
  const values = process.argv.filter((value) => value.startsWith(prefix));
  if (IS_PRODUCTION_BUNDLE && values.length > 0) {
    throw new Error("Production App does not accept development renderer arguments.");
  }
  if (values.length === 0) return '';
  if (values.length !== 1) throw new Error('Nimi development renderer URL must be singular.');
  const raw = values[0]?.slice(prefix.length) ?? '';
  const parsed = new URL(raw);
  if (
    parsed.protocol !== 'http:'
    || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname.toLowerCase())
    || !parsed.port
    || parsed.username
    || parsed.password
    || (parsed.pathname !== '/' && parsed.pathname !== '')
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('Nimi development renderer URL must be exact loopback.');
  }
  return parsed.origin;
}
