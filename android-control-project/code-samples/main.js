/**
 * Main Application Entry Point
 * Electron main process for Android Device Control System
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DeviceManager = require('./device-manager');
const VideoDownloader = require('./video-downloader');
const DouyinAutomation = require('./douyin-automation');

let mainWindow;
const deviceManager = new DeviceManager();
const videoDownloader = new VideoDownloader({
  downloadDirectory: path.join(app.getPath('userData'), 'downloads')
});
const douyinAutomation = new DouyinAutomation();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  deviceManager.startScanning();
  
  registerIpcHandlers();
  
  forwardEvents();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', async () => {
  deviceManager.stopScanning();
  
  const sessions = douyinAutomation.getAllSessions();
  for (const session of sessions) {
    await douyinAutomation.closeSession(session.deviceId);
  }
});

function registerIpcHandlers() {
  ipcMain.handle('device:get-all', () => {
    return Array.from(deviceManager.devices.values());
  });
  
  ipcMain.handle('device:execute-command', async (event, { deviceId, command }) => {
    return await deviceManager.executeCommand(deviceId, command);
  });
  
  ipcMain.handle('device:get-battery-info', async (event, { deviceId }) => {
    return await deviceManager.getBatteryInfo(deviceId);
  });
  
  ipcMain.handle('device:get-storage-info', async (event, { deviceId }) => {
    return await deviceManager.getStorageInfo(deviceId);
  });
  
  ipcMain.handle('device:take-screenshot', async (event, { deviceId }) => {
    const outputPath = path.join(app.getPath('temp'), `screenshot_${deviceId}_${Date.now()}.png`);
    return await deviceManager.takeScreenshot(deviceId, outputPath);
  });
  
  ipcMain.handle('device:execute-batch-command', async (event, { deviceIds, command }) => {
    return await deviceManager.executeBatchCommand(deviceIds, command);
  });
  
  ipcMain.handle('video:queue-download', (event, { url, metadata }) => {
    return videoDownloader.queueDownload(url, metadata);
  });
  
  ipcMain.handle('video:cancel-download', (event, { id }) => {
    return videoDownloader.cancelDownload(id);
  });
  
  ipcMain.handle('video:get-all-downloads', () => {
    return videoDownloader.getAllDownloads();
  });
  
  ipcMain.handle('video:get-download', (event, { id }) => {
    return videoDownloader.getDownload(id);
  });
  
  ipcMain.handle('video:pause-all', () => {
    videoDownloader.pauseAll();
    return true;
  });
  
  ipcMain.handle('video:resume-all', () => {
    videoDownloader.resumeAll();
    return true;
  });
  
  ipcMain.handle('douyin:create-session', async (event, { deviceId, accountInfo }) => {
    return await douyinAutomation.createSession(deviceId, accountInfo);
  });
  
  ipcMain.handle('douyin:close-session', async (event, { deviceId }) => {
    return await douyinAutomation.closeSession(deviceId);
  });
  
  ipcMain.handle('douyin:login', async (event, { deviceId }) => {
    return await douyinAutomation.login(deviceId);
  });
  
  ipcMain.handle('douyin:upload-video', async (event, { deviceId, videoPath, options }) => {
    return await douyinAutomation.uploadVideo(deviceId, videoPath, options);
  });
  
  ipcMain.handle('douyin:take-screenshot', async (event, { deviceId }) => {
    const outputPath = path.join(app.getPath('temp'), `douyin_screenshot_${deviceId}_${Date.now()}.png`);
    return await douyinAutomation.takeScreenshot(deviceId, outputPath);
  });
  
  ipcMain.handle('douyin:get-all-sessions', () => {
    return douyinAutomation.getAllSessions();
  });
  
  ipcMain.handle('fs:select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile']
    });
    
    if (result.canceled) {
      return null;
    }
    
    return result.filePaths[0];
  });
  
  ipcMain.handle('fs:select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (result.canceled) {
      return null;
    }
    
    return result.filePaths[0];
  });
}

function forwardEvents() {
  deviceManager.on('device:connected', (device) => {
    if (mainWindow) {
      mainWindow.webContents.send('device:connected', device);
    }
  });
  
  deviceManager.on('device:disconnected', (device) => {
    if (mainWindow) {
      mainWindow.webContents.send('device:disconnected', device);
    }
  });
  
  deviceManager.on('devices:updated', (devices) => {
    if (mainWindow) {
      mainWindow.webContents.send('devices:updated', devices);
    }
  });
  
  deviceManager.on('error', (error) => {
    if (mainWindow) {
      mainWindow.webContents.send('error', { source: 'device-manager', error });
    }
  });
  
  videoDownloader.on('download:queued', (downloadItem) => {
    if (mainWindow) {
      mainWindow.webContents.send('download:queued', downloadItem);
    }
  });
  
  videoDownloader.on('download:started', (downloadItem) => {
    if (mainWindow) {
      mainWindow.webContents.send('download:started', downloadItem);
    }
  });
  
  videoDownloader.on('download:progress', (progressInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('download:progress', progressInfo);
    }
  });
  
  videoDownloader.on('download:completed', (downloadItem) => {
    if (mainWindow) {
      mainWindow.webContents.send('download:completed', downloadItem);
    }
  });
  
  videoDownloader.on('download:error', (errorInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('download:error', errorInfo);
    }
  });
  
  videoDownloader.on('download:cancelled', (downloadItem) => {
    if (mainWindow) {
      mainWindow.webContents.send('download:cancelled', downloadItem);
    }
  });
  
  douyinAutomation.on('session:created', (sessionInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('session:created', sessionInfo);
    }
  });
  
  douyinAutomation.on('session:closed', (sessionInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('session:closed', sessionInfo);
    }
  });
  
  douyinAutomation.on('login:success', (loginInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('login:success', loginInfo);
    }
  });
  
  douyinAutomation.on('login:failed', (loginInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('login:failed', loginInfo);
    }
  });
  
  douyinAutomation.on('login:verification_needed', (verificationInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('login:verification_needed', verificationInfo);
    }
  });
  
  douyinAutomation.on('upload:success', (uploadInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('upload:success', uploadInfo);
    }
  });
  
  douyinAutomation.on('upload:failed', (uploadInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('upload:failed', uploadInfo);
    }
  });
  
  douyinAutomation.on('error', (error) => {
    if (mainWindow) {
      mainWindow.webContents.send('error', { source: 'douyin-automation', error });
    }
  });
}
