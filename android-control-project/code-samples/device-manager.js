/**
 * Device Manager Module
 * Handles connection and management of Android devices via ADB
 */

const { exec } = require('child_process');
const EventEmitter = require('events');

class DeviceManager extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map();
    this.isScanning = false;
    this.scanInterval = null;
  }

  /**
   * Start scanning for connected devices
   * @param {number} interval - Scan interval in milliseconds
   */
  startScanning(interval = 5000) {
    if (this.isScanning) return;
    
    this.isScanning = true;
    this.scanInterval = setInterval(() => this.scanDevices(), interval);
    this.scanDevices(); // Initial scan
    
    this.emit('scanning:started');
  }

  /**
   * Stop scanning for devices
   */
  stopScanning() {
    if (!this.isScanning) return;
    
    clearInterval(this.scanInterval);
    this.isScanning = false;
    
    this.emit('scanning:stopped');
  }

  /**
   * Scan for connected devices using ADB
   */
  scanDevices() {
    exec('adb devices -l', (error, stdout, stderr) => {
      if (error) {
        this.emit('error', error);
        return;
      }
      
      const lines = stdout.trim().split('\n');
      const deviceLines = lines.slice(1).filter(line => line.trim() !== '');
      
      const currentDevices = new Map();
      
      deviceLines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const deviceId = parts[0];
        
        if (parts[1] === 'device') {
          const properties = {};
          parts.slice(2).forEach(part => {
            const [key, value] = part.split(':');
            if (key && value) {
              properties[key] = value;
            }
          });
          
          const device = {
            id: deviceId,
            status: 'online',
            properties,
            lastSeen: Date.now()
          };
          
          currentDevices.set(deviceId, device);
          
          if (!this.devices.has(deviceId)) {
            this.emit('device:connected', device);
          }
        }
      });
      
      this.devices.forEach((device, deviceId) => {
        if (!currentDevices.has(deviceId)) {
          this.emit('device:disconnected', device);
        }
      });
      
      this.devices = currentDevices;
      this.emit('devices:updated', Array.from(this.devices.values()));
    });
  }

  /**
   * Execute a command on a specific device
   * @param {string} deviceId - The device identifier
   * @param {string} command - The command to execute
   * @returns {Promise<string>} - Command output
   */
  executeCommand(deviceId, command) {
    return new Promise((resolve, reject) => {
      if (!this.devices.has(deviceId)) {
        reject(new Error(`Device ${deviceId} not found`));
        return;
      }
      
      const adbCommand = `adb -s ${deviceId} ${command}`;
      
      exec(adbCommand, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Get device battery information
   * @param {string} deviceId - The device identifier
   * @returns {Promise<object>} - Battery information
   */
  async getBatteryInfo(deviceId) {
    try {
      const output = await this.executeCommand(
        deviceId, 
        'shell dumpsys battery'
      );
      
      const batteryInfo = {};
      const lines = output.split('\n');
      
      lines.forEach(line => {
        const [key, value] = line.split(':').map(part => part.trim());
        if (key && value) {
          batteryInfo[key] = value;
        }
      });
      
      return batteryInfo;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get device storage information
   * @param {string} deviceId - The device identifier
   * @returns {Promise<object>} - Storage information
   */
  async getStorageInfo(deviceId) {
    try {
      const output = await this.executeCommand(
        deviceId, 
        'shell df /sdcard'
      );
      
      const lines = output.split('\n');
      if (lines.length < 2) {
        throw new Error('Invalid storage information format');
      }
      
      const parts = lines[1].split(/\s+/);
      if (parts.length < 6) {
        throw new Error('Invalid storage information format');
      }
      
      return {
        total: parseInt(parts[1], 10) * 1024, // Convert to bytes
        used: parseInt(parts[2], 10) * 1024,
        free: parseInt(parts[3], 10) * 1024,
        usedPercentage: parseInt(parts[4], 10)
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Install an APK on a device
   * @param {string} deviceId - The device identifier
   * @param {string} apkPath - Path to the APK file
   * @returns {Promise<void>}
   */
  async installApp(deviceId, apkPath) {
    try {
      await this.executeCommand(
        deviceId,
        `install -r "${apkPath}"`
      );
      
      this.emit('app:installed', { deviceId, apkPath });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Uninstall an app from a device
   * @param {string} deviceId - The device identifier
   * @param {string} packageName - Package name to uninstall
   * @returns {Promise<void>}
   */
  async uninstallApp(deviceId, packageName) {
    try {
      await this.executeCommand(
        deviceId,
        `uninstall "${packageName}"`
      );
      
      this.emit('app:uninstalled', { deviceId, packageName });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Take a screenshot on a device
   * @param {string} deviceId - The device identifier
   * @param {string} outputPath - Path to save the screenshot
   * @returns {Promise<string>} - Path to the saved screenshot
   */
  async takeScreenshot(deviceId, outputPath) {
    try {
      const tempPath = '/sdcard/screenshot.png';
      await this.executeCommand(
        deviceId,
        `shell screencap -p ${tempPath}`
      );
      
      await this.executeCommand(
        deviceId,
        `pull ${tempPath} "${outputPath}"`
      );
      
      await this.executeCommand(
        deviceId,
        `shell rm ${tempPath}`
      );
      
      this.emit('screenshot:taken', { deviceId, path: outputPath });
      return outputPath;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Execute batch commands on multiple devices
   * @param {string[]} deviceIds - Array of device identifiers
   * @param {string} command - Command to execute
   * @returns {Promise<Map<string, string>>} - Map of device IDs to command outputs
   */
  async executeBatchCommand(deviceIds, command) {
    const results = new Map();
    const promises = deviceIds.map(async (deviceId) => {
      try {
        const output = await this.executeCommand(deviceId, command);
        results.set(deviceId, output);
      } catch (error) {
        results.set(deviceId, { error: error.message });
      }
    });
    
    await Promise.all(promises);
    return results;
  }
}

module.exports = DeviceManager;
