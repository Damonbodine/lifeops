const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const server = require('./app'); // Import the Express app

let mainWindow;

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
  const port = 3000;
  server.listen(port, () => {
    console.log(`✅ Server started on http://localhost:${port}`);
  });

  // Load the app
  mainWindow.loadURL(`http://localhost:${port}/index.html`);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Open DevTools for debugging
    mainWindow.webContents.openDevTools();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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