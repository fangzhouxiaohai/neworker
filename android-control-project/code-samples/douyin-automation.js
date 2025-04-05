/**
 * Douyin Automation Module
 * Handles automation of Douyin app using Appium
 */

const { remote } = require('webdriverio');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class DouyinAutomation extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessions = new Map();
    this.appiumServerUrl = options.appiumServerUrl || 'http://localhost:4723';
    this.douyinPackage = 'com.ss.android.ugc.aweme';
    this.douyinActivity = '.main.MainActivity';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000;
  }

  /**
   * Create a new Appium session for a device
   * @param {string} deviceId - Device identifier
   * @param {object} accountInfo - Account information for login
   * @returns {Promise<string>} - Session ID
   */
  async createSession(deviceId, accountInfo) {
    try {
      if (this.sessions.has(deviceId)) {
        await this.closeSession(deviceId);
      }
      
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const capabilities = {
        platformName: 'Android',
        'appium:deviceName': deviceId,
        'appium:udid': deviceId,
        'appium:automationName': 'UiAutomator2',
        'appium:appPackage': this.douyinPackage,
        'appium:appActivity': this.douyinActivity,
        'appium:noReset': true,
        'appium:newCommandTimeout': 60,
        'appium:autoGrantPermissions': true
      };
      
      const client = await remote({
        hostname: new URL(this.appiumServerUrl).hostname,
        port: parseInt(new URL(this.appiumServerUrl).port, 10),
        path: '/wd/hub',
        capabilities,
        logLevel: 'error'
      });
      
      this.sessions.set(deviceId, {
        id: sessionId,
        client,
        deviceId,
        accountInfo,
        status: 'created',
        createdAt: Date.now()
      });
      
      this.emit('session:created', { deviceId, sessionId });
      
      return sessionId;
    } catch (error) {
      this.emit('error', { deviceId, error: error.message });
      throw error;
    }
  }

  /**
   * Close an Appium session
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>} - Whether session was closed
   */
  async closeSession(deviceId) {
    if (!this.sessions.has(deviceId)) {
      return false;
    }
    
    const session = this.sessions.get(deviceId);
    
    try {
      await session.client.deleteSession();
      this.sessions.delete(deviceId);
      
      this.emit('session:closed', { deviceId, sessionId: session.id });
      return true;
    } catch (error) {
      this.emit('error', { deviceId, error: error.message });
      
      this.sessions.delete(deviceId);
      return false;
    }
  }

  /**
   * Login to Douyin account
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>} - Whether login was successful
   */
  async login(deviceId) {
    if (!this.sessions.has(deviceId)) {
      throw new Error(`No session found for device ${deviceId}`);
    }
    
    const session = this.sessions.get(deviceId);
    const { client, accountInfo } = session;
    
    try {
      session.status = 'logging_in';
      
      await client.pause(3000);
      
      const isLoggedIn = await this._checkIfLoggedIn(client);
      
      if (isLoggedIn) {
        session.status = 'logged_in';
        this.emit('login:success', { deviceId, accountInfo });
        return true;
      }
      
      await this._navigateToProfileTab(client);
      
      await this._retryOperation(async () => {
        const loginButton = await client.$('//android.widget.TextView[contains(@text, "登录") or contains(@text, "Login")]');
        await loginButton.click();
      });
      
      await client.pause(2000);
      
      await this._retryOperation(async () => {
        const phoneLoginButton = await client.$('//android.widget.TextView[contains(@text, "手机号") or contains(@text, "Phone")]');
        await phoneLoginButton.click();
      });
      
      await this._retryOperation(async () => {
        const phoneInput = await client.$('//android.widget.EditText[contains(@resource-id, "phone")]');
        await phoneInput.setValue(accountInfo.phone);
      });
      
      await this._retryOperation(async () => {
        const nextButton = await client.$('//android.widget.Button[contains(@text, "下一步") or contains(@text, "Next")]');
        await nextButton.click();
      });
      
      await client.pause(2000);
      
      if (accountInfo.verificationCode) {
        await this._retryOperation(async () => {
          const codeInput = await client.$('//android.widget.EditText[contains(@resource-id, "code")]');
          await codeInput.setValue(accountInfo.verificationCode);
        });
        
        await this._retryOperation(async () => {
          const verifyButton = await client.$('//android.widget.Button[contains(@text, "验证") or contains(@text, "Verify")]');
          await verifyButton.click();
        });
      } else {
        this.emit('login:verification_needed', { deviceId, accountInfo });
        
        await client.pause(30000);
      }
      
      await client.pause(5000);
      
      const loginSuccessful = await this._checkIfLoggedIn(client);
      
      if (loginSuccessful) {
        session.status = 'logged_in';
        this.emit('login:success', { deviceId, accountInfo });
        return true;
      } else {
        session.status = 'login_failed';
        this.emit('login:failed', { deviceId, accountInfo });
        return false;
      }
    } catch (error) {
      session.status = 'login_failed';
      this.emit('error', { deviceId, error: error.message });
      return false;
    }
  }

  /**
   * Check if user is logged in
   * @param {object} client - WebdriverIO client
   * @returns {Promise<boolean>} - Whether user is logged in
   * @private
   */
  async _checkIfLoggedIn(client) {
    try {
      await this._navigateToProfileTab(client);
      
      const profileElements = await client.$$('//android.widget.TextView[contains(@text, "粉丝") or contains(@text, "Followers")]');
      
      return profileElements.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Navigate to profile tab
   * @param {object} client - WebdriverIO client
   * @returns {Promise<void>}
   * @private
   */
  async _navigateToProfileTab(client) {
    await this._retryOperation(async () => {
      const profileTab = await client.$('//android.widget.TextView[contains(@text, "我") or contains(@text, "Me")]');
      await profileTab.click();
    });
    
    await client.pause(1000);
  }

  /**
   * Upload a video to Douyin
   * @param {string} deviceId - Device identifier
   * @param {string} videoPath - Path to video file on device
   * @param {object} options - Upload options (caption, hashtags, etc.)
   * @returns {Promise<boolean>} - Whether upload was successful
   */
  async uploadVideo(deviceId, videoPath, options = {}) {
    if (!this.sessions.has(deviceId)) {
      throw new Error(`No session found for device ${deviceId}`);
    }
    
    const session = this.sessions.get(deviceId);
    const { client } = session;
    
    try {
      session.status = 'uploading';
      
      if (!await this._checkFileExistsOnDevice(client, videoPath)) {
        throw new Error(`Video file not found on device: ${videoPath}`);
      }
      
      await this._retryOperation(async () => {
        const uploadButton = await client.$('//android.widget.ImageView[contains(@resource-id, "plus_icon")]');
        await uploadButton.click();
      });
      
      await client.pause(2000);
      
      await this._retryOperation(async () => {
        const uploadOption = await client.$('//android.widget.TextView[contains(@text, "上传") or contains(@text, "Upload")]');
        await uploadOption.click();
      });
      
      await client.pause(2000);
      
      await this._retryOperation(async () => {
        const videoThumbnail = await client.$('//android.widget.ImageView[contains(@resource-id, "media_thumbnail")]');
        await videoThumbnail.click();
      });
      
      await this._retryOperation(async () => {
        const nextButton = await client.$('//android.widget.TextView[contains(@text, "下一步") or contains(@text, "Next")]');
        await nextButton.click();
      });
      
      await client.pause(2000);
      
      await this._retryOperation(async () => {
        const nextButton = await client.$('//android.widget.TextView[contains(@text, "下一步") or contains(@text, "Next")]');
        await nextButton.click();
      });
      
      await client.pause(2000);
      
      if (options.caption) {
        await this._retryOperation(async () => {
          const captionInput = await client.$('//android.widget.EditText[contains(@resource-id, "caption_input")]');
          await captionInput.setValue(options.caption);
        });
      }
      
      if (options.hashtags && options.hashtags.length > 0) {
        const hashtagText = options.hashtags.map(tag => `#${tag}`).join(' ');
        
        await this._retryOperation(async () => {
          const captionInput = await client.$('//android.widget.EditText[contains(@resource-id, "caption_input")]');
          await captionInput.addValue(' ' + hashtagText);
        });
      }
      
      await this._retryOperation(async () => {
        const postButton = await client.$('//android.widget.TextView[contains(@text, "发布") or contains(@text, "Post")]');
        await postButton.click();
      });
      
      await client.pause(10000);
      
      const uploadSuccessful = await this._checkUploadSuccess(client);
      
      if (uploadSuccessful) {
        session.status = 'upload_completed';
        this.emit('upload:success', { deviceId, videoPath });
        return true;
      } else {
        session.status = 'upload_failed';
        this.emit('upload:failed', { deviceId, videoPath });
        return false;
      }
    } catch (error) {
      session.status = 'upload_failed';
      this.emit('error', { deviceId, error: error.message });
      return false;
    }
  }

  /**
   * Check if a file exists on the device
   * @param {object} client - WebdriverIO client
   * @param {string} filePath - Path to file on device
   * @returns {Promise<boolean>} - Whether file exists
   * @private
   */
  async _checkFileExistsOnDevice(client, filePath) {
    try {
      const result = await client.executeScript('mobile: shell', [{
        command: 'ls',
        args: [filePath]
      }]);
      
      return !result.includes('No such file');
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if upload was successful
   * @param {object} client - WebdriverIO client
   * @returns {Promise<boolean>} - Whether upload was successful
   * @private
   */
  async _checkUploadSuccess(client) {
    try {
      const successElements = await client.$$('//android.widget.TextView[contains(@text, "发布成功") or contains(@text, "Published successfully")]');
      
      return successElements.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Retry an operation multiple times
   * @param {Function} operation - Operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} delay - Delay between retries in milliseconds
   * @returns {Promise<any>} - Result of operation
   * @private
   */
  async _retryOperation(operation, maxRetries = this.maxRetries, delay = this.retryDelay) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Take a screenshot of the current app state
   * @param {string} deviceId - Device identifier
   * @param {string} outputPath - Path to save screenshot
   * @returns {Promise<string>} - Path to saved screenshot
   */
  async takeScreenshot(deviceId, outputPath) {
    if (!this.sessions.has(deviceId)) {
      throw new Error(`No session found for device ${deviceId}`);
    }
    
    const session = this.sessions.get(deviceId);
    const { client } = session;
    
    try {
      const screenshot = await client.takeScreenshot();
      
      const directory = path.dirname(outputPath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, Buffer.from(screenshot, 'base64'));
      
      this.emit('screenshot:taken', { deviceId, path: outputPath });
      return outputPath;
    } catch (error) {
      this.emit('error', { deviceId, error: error.message });
      throw error;
    }
  }

  /**
   * Get all active sessions
   * @returns {object[]} - Array of session information
   */
  getAllSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      deviceId: session.deviceId,
      status: session.status,
      createdAt: session.createdAt
    }));
  }
}

module.exports = DouyinAutomation;
