const { app, BrowserWindow, Menu, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const log = require('electron-log');

log.transports.file.resolvePath = () => path.join(__dirname, 'logs/main.log');

(async () => {
    const loadLibraries = async (name) => {
        return import(name)
    }

    const imagemin = (await loadLibraries('imagemin')).default
    const imageminJpegtran = (await loadLibraries('imagemin-jpegtran')).default
    const imageminPngquant = (await loadLibraries('imagemin-pngquant')).default
    const slash = (await loadLibraries('slash')).default

    process.env.NODE_ENV = 'production'

    const isDev = process.env.NODE_ENV !== 'production'
    const isMac = process.platform === 'darwin'

    let mainWindow
    let aboutWindow

    const createWindow = () => {
        mainWindow = new BrowserWindow({
            width: 500,
            height: 600,
            title: 'ImageShrink',
            icon: `${__dirname}/assets/icons/Icon_256x256.png`,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        })

        mainWindow.loadFile(`${__dirname}/app/index.html`)
    }

    const createAboutWindow = () => {
        aboutWindow = new BrowserWindow({
            width: 500,
            height: 600,
            title: 'About ImageShrink',
            icon: `${__dirname}/assets/icons/Icon_256x256.png`,
            resizable: false,
        })

        aboutWindow.loadFile(`${__dirname}/app/about.html`)
    }

    const menu = [
        ...(isMac ? [
            {
                label: app.name,
                submenu: [
                    {
                        label: 'About',
                        click: createAboutWindow
                    }
                ]
            }
        ] : []),
        ...(!isMac ? [
            {
                label: 'help',
                submenu: [
                    {
                        label: 'About',
                        click: createAboutWindow
                    }
                ]
            }
        ] : []),
        {
            role: 'fileMenu'
        },
        ...(isDev ? [{
            label: 'Developer',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { type: 'separator' },
                { role: 'toggledevtools' }
            ]
        }] : [])
    ]

    app.whenReady().then(() => {
        createWindow()

        const mainMenu = Menu.buildFromTemplate(menu)
        Menu.setApplicationMenu(mainMenu)

        globalShortcut.register('CmdOrCtrl+R', () => mainWindow.reload())
        globalShortcut.register(isMac ? 'Command+Alt+I' : 'Ctrl+Shift+I', () => mainWindow.toggleDevTools())

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow()
            }
        })
    })

    const imageShrink = async ({ imgPath, quality, dest }) => {
        const pngQuality = quality / 100

        try {
            const files = await imagemin([slash(imgPath)], {
                destination: dest,
                plugins: [
                    imageminJpegtran(),
                    imageminPngquant({
                        quality: [pngQuality, pngQuality]
                    })
                ]
            })

            shell.openPath(dest)

            log.info(files)

            mainWindow.webContents.send('image:done')
        } catch (err) {
            log.error(err)
        }
    }

    ipcMain.on('image:minimize', (e, options) => {
        options.dest = path.join(os.homedir(), 'downloads')
        imageShrink(options)
    })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit()
        }
    })
})();