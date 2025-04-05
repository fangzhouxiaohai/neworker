/**
 * Video Downloader Module
 * Handles downloading videos from various sources
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const EventEmitter = require('events');

class VideoDownloader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.downloadQueue = [];
    this.activeDownloads = new Map();
    this.maxConcurrent = options.maxConcurrent || 5;
    this.downloadDirectory = options.downloadDirectory || path.join(process.cwd(), 'downloads');
    this.isProcessing = false;
    
    if (!fs.existsSync(this.downloadDirectory)) {
      fs.mkdirSync(this.downloadDirectory, { recursive: true });
    }
  }

  /**
   * Add a video to the download queue
   * @param {string} url - URL of the video to download
   * @param {object} metadata - Additional metadata for the video
   * @returns {string} - Download ID
   */
  queueDownload(url, metadata = {}) {
    const downloadId = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const downloadItem = {
      id: downloadId,
      url,
      metadata,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      filename: metadata.filename || this._generateFilename(url)
    };
    
    this.downloadQueue.push(downloadItem);
    this.emit('download:queued', downloadItem);
    
    if (!this.isProcessing) {
      this._processQueue();
    }
    
    return downloadId;
  }

  /**
   * Generate a filename from a URL
   * @param {string} url - URL to generate filename from
   * @returns {string} - Generated filename
   * @private
   */
  _generateFilename(url) {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      let filename = path.basename(pathname);
      
      if (!filename || filename === '' || !path.extname(filename)) {
        filename = `video_${Date.now()}.mp4`;
      }
      
      return filename;
    } catch (error) {
      return `video_${Date.now()}.mp4`;
    }
  }

  /**
   * Process the download queue
   * @private
   */
  _processQueue() {
    if (this.downloadQueue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    
    while (this.downloadQueue.length > 0 && this.activeDownloads.size < this.maxConcurrent) {
      const downloadItem = this.downloadQueue.shift();
      this._startDownload(downloadItem);
    }
  }

  /**
   * Start downloading a video
   * @param {object} downloadItem - Download item to process
   * @private
   */
  _startDownload(downloadItem) {
    const { id, url, filename } = downloadItem;
    const filePath = path.join(this.downloadDirectory, filename);
    
    downloadItem.status = 'downloading';
    downloadItem.startedAt = Date.now();
    downloadItem.filePath = filePath;
    
    this.activeDownloads.set(id, downloadItem);
    this.emit('download:started', downloadItem);
    
    const fileStream = fs.createWriteStream(filePath);
    
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        fileStream.close();
        fs.unlinkSync(filePath);
        
        downloadItem.url = redirectUrl;
        this._startDownload(downloadItem);
        return;
      }
      
      if (response.statusCode !== 200) {
        fileStream.close();
        fs.unlinkSync(filePath);
        
        this._handleError(id, new Error(`HTTP Error: ${response.statusCode}`));
        return;
      }
      
      const contentLength = parseInt(response.headers['content-length'], 10) || 0;
      let downloadedBytes = 0;
      
      if (response.headers['content-type']) {
        downloadItem.contentType = response.headers['content-type'];
      }
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        
        if (contentLength > 0) {
          const progress = Math.round((downloadedBytes / contentLength) * 100);
          this._updateProgress(id, progress, downloadedBytes, contentLength);
        }
      });
      
      response.on('end', () => {
        fileStream.end();
      });
      
      response.pipe(fileStream);
    });
    
    request.on('error', (error) => {
      fileStream.close();
      fs.unlinkSync(filePath);
      
      this._handleError(id, error);
    });
    
    fileStream.on('error', (error) => {
      request.abort();
      
      this._handleError(id, error);
    });
    
    fileStream.on('close', () => {
      if (downloadItem.status !== 'error') {
        this._completeDownload(id);
      }
    });
    
    downloadItem.request = request;
    downloadItem.fileStream = fileStream;
  }

  /**
   * Update download progress
   * @param {string} id - Download ID
   * @param {number} progress - Download progress (0-100)
   * @param {number} downloadedBytes - Bytes downloaded
   * @param {number} totalBytes - Total bytes to download
   * @private
   */
  _updateProgress(id, progress, downloadedBytes, totalBytes) {
    const downloadItem = this.activeDownloads.get(id);
    
    if (!downloadItem) return;
    
    downloadItem.progress = progress;
    downloadItem.downloadedBytes = downloadedBytes;
    downloadItem.totalBytes = totalBytes;
    
    this.emit('download:progress', {
      id,
      progress,
      downloadedBytes,
      totalBytes,
      url: downloadItem.url,
      filename: downloadItem.filename
    });
  }

  /**
   * Complete a download
   * @param {string} id - Download ID
   * @private
   */
  _completeDownload(id) {
    const downloadItem = this.activeDownloads.get(id);
    
    if (!downloadItem) return;
    
    downloadItem.status = 'completed';
    downloadItem.completedAt = Date.now();
    downloadItem.progress = 100;
    
    this.activeDownloads.delete(id);
    
    this.emit('download:completed', downloadItem);
    
    this._processQueue();
  }

  /**
   * Handle download error
   * @param {string} id - Download ID
   * @param {Error} error - Error object
   * @private
   */
  _handleError(id, error) {
    const downloadItem = this.activeDownloads.get(id);
    
    if (!downloadItem) return;
    
    downloadItem.status = 'error';
    downloadItem.error = error.message;
    
    this.activeDownloads.delete(id);
    
    this.emit('download:error', {
      id,
      url: downloadItem.url,
      error: error.message
    });
    
    this._processQueue();
  }

  /**
   * Cancel a download
   * @param {string} id - Download ID to cancel
   * @returns {boolean} - Whether the download was cancelled
   */
  cancelDownload(id) {
    const queueIndex = this.downloadQueue.findIndex(item => item.id === id);
    
    if (queueIndex !== -1) {
      const downloadItem = this.downloadQueue.splice(queueIndex, 1)[0];
      downloadItem.status = 'cancelled';
      
      this.emit('download:cancelled', downloadItem);
      return true;
    }
    
    if (this.activeDownloads.has(id)) {
      const downloadItem = this.activeDownloads.get(id);
      
      if (downloadItem.request) {
        downloadItem.request.abort();
      }
      
      if (downloadItem.fileStream) {
        downloadItem.fileStream.close();
      }
      
      if (downloadItem.filePath && fs.existsSync(downloadItem.filePath)) {
        fs.unlinkSync(downloadItem.filePath);
      }
      
      downloadItem.status = 'cancelled';
      this.activeDownloads.delete(id);
      
      this.emit('download:cancelled', downloadItem);
      
      this._processQueue();
      
      return true;
    }
    
    return false;
  }

  /**
   * Get all downloads (active and queued)
   * @returns {object[]} - Array of download items
   */
  getAllDownloads() {
    const activeDownloads = Array.from(this.activeDownloads.values());
    return [...activeDownloads, ...this.downloadQueue];
  }

  /**
   * Get a specific download by ID
   * @param {string} id - Download ID
   * @returns {object|null} - Download item or null if not found
   */
  getDownload(id) {
    if (this.activeDownloads.has(id)) {
      return this.activeDownloads.get(id);
    }
    
    const queuedDownload = this.downloadQueue.find(item => item.id === id);
    return queuedDownload || null;
  }

  /**
   * Pause all downloads
   */
  pauseAll() {
    this.activeDownloads.forEach((downloadItem) => {
      if (downloadItem.request) {
        downloadItem.request.abort();
      }
      
      if (downloadItem.fileStream) {
        downloadItem.fileStream.close();
      }
      
      downloadItem.status = 'paused';
      this.downloadQueue.unshift(downloadItem);
      
      this.emit('download:paused', downloadItem);
    });
    
    this.activeDownloads.clear();
    this.isProcessing = false;
  }

  /**
   * Resume all downloads
   */
  resumeAll() {
    if (!this.isProcessing && this.downloadQueue.length > 0) {
      this._processQueue();
    }
  }
}

module.exports = VideoDownloader;
