const screenshot = require('screenshot-desktop');
const Jimp = require('jimp');
const pixelmatch = require('pixelmatch');
const robot = require('robotjs');
const fs = require('fs');


const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const minDiffForScreenshot = config.minDiffForScreenshot ?? 10000;
const showConsoleMessages = config.showConsoleMessages ?? true;
const screenshotFormat = config.screenshotFormat || 'png';  // Значение по умолчанию: 'png'
const screenshotQuality = config.screenshotQuality || 100;  // Значение по умолчанию: 100

let previousImage = null;
let captureRegion = null;
const screenshotsDir = './screenshots';

if (!fs.existsSync(screenshotsDir)){
    fs.mkdirSync(screenshotsDir);
}

function getCurrentDateDir() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; // Форматируем дату как YYYY-MM-DD
}


function showTimer(duration, callback) {
    let dots = 0;
    let timerString = "[" + " ".repeat(10) + "]"; // Создаем пустую строку с 10 пробелами
    process.stdout.write(timerString);

    let timerInterval = setInterval(() => {
        dots++;
        process.stdout.write("\r" + "[" + ".".repeat(dots) + " ".repeat(10 - dots) + "]"); // Обновляем строку с точками и пробелами

        if (dots >= 10) {
            clearInterval(timerInterval);
            process.stdout.write("\n");
            callback();
        }
    }, 500);
}

function getCaptureRegion() {
    console.log("Place the cursor at the top-left corner of the desired region.");
    showTimer(5, () => {
        const topLeft = robot.getMousePos();
        console.log(`Top-left corner set at x=${topLeft.x}, y=${topLeft.y}`);
        console.log("Now place the cursor at the bottom-right corner of the desired region.");

        showTimer(5, () => {
            const bottomRight = robot.getMousePos();
            console.log(`Bottom-right corner set at x=${bottomRight.x}, y=${bottomRight.y}`);
            captureRegion = {
                x: topLeft.x,
                y: topLeft.y,
                width: bottomRight.x - topLeft.x,
                height: bottomRight.y - topLeft.y
            };
            console.log("Capture region set:", captureRegion);
            setInterval(captureScreen, 5000); // start capturing the screen
        });
    });
}


function captureScreen() {
    if (!captureRegion) {
        console.error("Capture region not set.");
        return;
    }

    screenshot({format: 'png'}).then((imgBuffer) => {
        Jimp.read(imgBuffer)
            .then(image => {
                // Обрезаем изображение до указанной области
                const croppedImage = image.crop(captureRegion.x, captureRegion.y, captureRegion.width, captureRegion.height);
                if (!previousImage) {
                    previousImage = croppedImage.clone();
                    console.log('First screenshot taken');
                } else {
                    const numDiffPixels = pixelmatch(previousImage.bitmap.data, croppedImage.bitmap.data, null, croppedImage.bitmap.width, croppedImage.bitmap.height, {threshold: 0.1});
                    if (showConsoleMessages) {
                        console.log(`Changes detected: ${numDiffPixels} differences.`);
                    }
                    if (numDiffPixels > minDiffForScreenshot) {
                        const dateDir = getCurrentDateDir();
                        const fullDirPath = `${screenshotsDir}/${dateDir}`;
                        if (!fs.existsSync(fullDirPath)){
                            fs.mkdirSync(fullDirPath, { recursive: true }); // Создаем директорию, если не существует
                        }

                        console.log(`Significant changes detected: ${numDiffPixels} differences. Saving screenshot.`);
                        const timestamp = new Date().toISOString().replace(/:/g, '-');
                        const filepath = `${fullDirPath}/screenshot_${timestamp}.${screenshotFormat}`;

                        // Сохраняем изображение в указанном формате и качестве
                        if (screenshotFormat.toLowerCase() === 'jpg' || screenshotFormat.toLowerCase() === 'jpeg') {
                            croppedImage.quality(screenshotQuality).write(filepath, () => {
                                console.log(`Saved ${filepath}`);
                            });
                        } else {
                            croppedImage.write(filepath, () => {
                                console.log(`Saved ${filepath}`);
                            });
                        }
                    }
                    previousImage = croppedImage.clone(); // Обновляем предыдущее изображение
                }
            })
            .catch((error) => {
                console.error('Error processing image:', error);
            });
    }).catch((error) => {
        console.error('Error taking screenshot:', error);
    });
}


getCaptureRegion();
