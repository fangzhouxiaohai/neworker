# Android Device Control System - Setup Guide

This guide provides detailed instructions for setting up and running the Android Device Control System.

## Prerequisites

### System Requirements
- Windows 10 or later (64-bit)
- 8GB RAM minimum (16GB recommended)
- 100MB free disk space for the application (plus additional space for downloaded videos)
- Internet connection

### Required Software
1. **Node.js (v14+)**
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node -v` and `npm -v`

2. **Android Debug Bridge (ADB)**
   - Install Android SDK Platform Tools from [developer.android.com](https://developer.android.com/studio/releases/platform-tools)
   - Add ADB to your system PATH
   - Verify installation: `adb version`

3. **Appium Server**
   - Install via npm: `npm install -g appium`
   - Install UiAutomator2 driver: `appium driver install uiautomator2`
   - Verify installation: `appium -v`

## Device Setup

For each Android device you want to control:

1. **Enable Developer Options**
   - Go to Settings > About phone
   - Tap "Build number" 7 times to enable developer options
   - Go back to Settings > System > Developer options

2. **Enable USB Debugging**
   - In Developer options, enable "USB debugging"
   - Connect device to computer via USB
   - Accept the "Allow USB debugging" prompt on the device

3. **Install Douyin App**
   - Download and install the Douyin app from an app store or APK source
   - Open the app and verify it works correctly

## Application Installation

### Method 1: Using Pre-built Executable

1. Download the latest release from the releases page
2. Run the installer and follow the on-screen instructions
3. Launch the application from the Start menu

### Method 2: Building from Source

1. Clone the repository
   ```
   git clone https://github.com/yourusername/android-device-control-system.git
   cd android-device-control-system
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the application in development mode
   ```
   npm start
   ```

4. Build the application (optional)
   ```
   npm run build
   ```
   This will create distributable packages in the `dist` directory.

## First-Time Setup

When you first launch the application:

1. **ADB Server Setup**
   - The application will attempt to start the ADB server
   - If prompted, allow the application through your firewall

2. **Appium Server Setup**
   - The application will start an Appium server instance
   - Default port: 4723 (configurable in settings)

3. **Device Detection**
   - Connected devices should appear automatically in the Devices tab
   - If devices are not detected, check USB connections and debugging settings

4. **Account Setup**
   - Go to the Accounts tab to add your Douyin accounts
   - You'll need to complete verification steps for each account

## Configuration

### Application Settings

Access settings from the main menu:

1. **Device Management**
   - ADB path: Path to ADB executable
   - Scan interval: How often to scan for new devices (seconds)
   - Connection timeout: Maximum time to wait for device connection (seconds)

2. **Video Download**
   - Download directory: Where to store downloaded videos
   - Max concurrent downloads: Number of simultaneous downloads
   - Retry attempts: Number of times to retry failed downloads

3. **Douyin Automation**
   - Appium server URL: URL of the Appium server
   - Action timeout: Maximum time to wait for UI actions (seconds)
   - Screenshot directory: Where to store automation screenshots

### Device Groups

Create device groups to organize and batch-control devices:

1. Go to Devices > Device Groups
2. Click "Add Group" and enter a name
3. Select devices to add to the group
4. Use the group for batch operations

## Troubleshooting

### Common Issues

1. **Devices not detected**
   - Ensure USB debugging is enabled
   - Try a different USB cable or port
   - Restart ADB server: `adb kill-server` followed by `adb start-server`

2. **Download failures**
   - Check internet connection
   - Verify the video URL is accessible
   - Check available disk space

3. **Automation failures**
   - Ensure Douyin app is installed and updated
   - Check if device screen is on and unlocked
   - Verify Appium server is running

### Logs

Application logs are stored in:
- Windows: `%APPDATA%\android-device-control-system\logs`

## Advanced Usage

### Command Line Interface

The application supports the following command line arguments:

```
android-device-control-system.exe [options]

Options:
  --no-gui          Run in headless mode
  --config <path>   Specify config file path
  --port <number>   Specify Appium server port
  --debug           Enable debug logging
```

### API Integration

The application exposes a REST API for integration with other systems:

1. Enable the API in Settings > Advanced > Enable API
2. Configure the API port (default: 8080)
3. Access the API documentation at http://localhost:8080/docs

## Support

For additional help:
- Check the [FAQ](FAQ.md)
- Visit the [GitHub repository](https://github.com/yourusername/android-device-control-system)
- Submit issues on the [Issue Tracker](https://github.com/yourusername/android-device-control-system/issues)
