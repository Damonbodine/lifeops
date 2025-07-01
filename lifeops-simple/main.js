const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  // Start the Express server
  startServer();

  // Wait for server to start before loading
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000/dashboard.html');
  }, 3000);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Open DevTools for debugging
    mainWindow.webContents.openDevTools();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Kill the server when window closes
    if (serverProcess) {
      serverProcess.kill();
    }
  });
}

function startServer() {
  console.log('Starting Express server...');
  serverProcess = spawn('node', ['app.js'], {
    stdio: 'pipe',
    detached: false
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });

  // Wait a moment for server to start
  setTimeout(() => {
    if (mainWindow) {
      mainWindow.loadURL('http://localhost:3000/dashboard.html');
    }
  }, 2000);
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
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

// Kill server on app quit
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});