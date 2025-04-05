/**
 * Preload Script
 * Exposes IPC renderer API to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'api', {
    device: {
      getAll: () => ipcRenderer.invoke('device:get-all'),
      executeCommand: (deviceId, command) => 
        ipcRenderer.invoke('device:execute-command', { deviceId, command }),
      getBatteryInfo: (deviceId) => 
        ipcRenderer.invoke('device:get-battery-info', { deviceId }),
      getStorageInfo: (deviceId) => 
        ipcRenderer.invoke('device:get-storage-info', { deviceId }),
      takeScreenshot: (deviceId) => 
        ipcRenderer.invoke('device:take-screenshot', { deviceId }),
      executeBatchCommand: (deviceIds, command) => 
        ipcRenderer.invoke('device:execute-batch-command', { deviceIds, command })
    },
    
    video: {
      queueDownload: (url, metadata) => 
        ipcRenderer.invoke('video:queue-download', { url, metadata }),
      cancelDownload: (id) => 
        ipcRenderer.invoke('video:cancel-download', { id }),
      getAllDownloads: () => 
        ipcRenderer.invoke('video:get-all-downloads'),
      getDownload: (id) => 
        ipcRenderer.invoke('video:get-download', { id }),
      pauseAll: () => 
        ipcRenderer.invoke('video:pause-all'),
      resumeAll: () => 
        ipcRenderer.invoke('video:resume-all')
    },
    
    douyin: {
      createSession: (deviceId, accountInfo) => 
        ipcRenderer.invoke('douyin:create-session', { deviceId, accountInfo }),
      closeSession: (deviceId) => 
        ipcRenderer.invoke('douyin:close-session', { deviceId }),
      login: (deviceId) => 
        ipcRenderer.invoke('douyin:login', { deviceId }),
      uploadVideo: (deviceId, videoPath, options) => 
        ipcRenderer.invoke('douyin:upload-video', { deviceId, videoPath, options }),
      takeScreenshot: (deviceId) => 
        ipcRenderer.invoke('douyin:take-screenshot', { deviceId }),
      getAllSessions: () => 
        ipcRenderer.invoke('douyin:get-all-sessions')
    },
    
    fs: {
      selectFile: () => ipcRenderer.invoke('fs:select-file'),
      selectDirectory: () => ipcRenderer.invoke('fs:select-directory')
    },
    
    on: (channel, callback) => {
      const validChannels = [
        'device:connected',
        'device:disconnected',
        'devices:updated',
        
        'download:queued',
        'download:started',
        'download:progress',
        'download:completed',
        'download:error',
        'download:cancelled',
        
        'session:created',
        'session:closed',
        'login:success',
        'login:failed',
        'login:verification_needed',
        'upload:success',
        'upload:failed',
        
        'error'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
      }
    },
    
    removeListener: (channel, callback) => {
      ipcRenderer.removeListener(channel, callback);
    }
  }
);
