'use strict';


const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const winston = require('winston');

const logDir = path.join(__dirname, 'logs');
const originalType = 'avi';
const targetType = 'mp4';

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [

    new winston.transports.File({filename: 'error.log', level: 'error'}),
    new winston.transports.File({filename: 'debug.log', level: 'debug'}),
    new winston.transports.File({filename: 'info.log', level: 'info'}),
    new winston.transports.File({filename: 'combined.log'})
  ]
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

/**
 * Retieves a list of absolute paths to every file in the parent directory and all sub directories
 * @param dir
 * @returns {Array}
 */
function allFilesSync(dir) {
  let fileListRet = [];

  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file);

    if (filePath.indexOf('.@__thumb') < 0) {
      if (fs.statSync(filePath).isDirectory()) {

        let childFiles = allFilesSync(filePath);
        fileListRet = [...fileListRet, ...childFiles];
      } else {
        fileListRet.push(filePath);
      }
    }
  });
  return fileListRet;
}


function filterFileType(fileList, fileType) {

  let updatedList = [];
  fileList.forEach((listItem) => {

    if (listItem.endsWith(fileType)) {
      updatedList.push(listItem);
    }
  });

  return updatedList;
}


function convertAndSaveFile(inputPath) {

  let parsedPath = path.parse(inputPath);
  let targetPath = parsedPath.dir + '/' + parsedPath.name + '.' + targetType;

  return new Promise((resolve, reject) => {

    const ffmpeg = childProcess.spawnSync('ffmpeg', ['-i', `${inputPath}`, '-threads', '2', '-c:v', 'libx264', `${targetPath}`], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    resolve(ffmpeg.output);
  })
}


function convertAndSaveFileAsync(inputPath) {

  let parsedPath = path.parse(inputPath);
  let targetPath = parsedPath.dir + '/' + parsedPath.name + '.' + targetType;

  return new Promise((resolve, reject) => {

    const ffmpeg = childProcess.spawn('ffmpeg', ['-i', `${inputPath}`, '-threads', '1', '-c:v', 'libx264', `${targetPath}`]);

    ffmpeg.stdout.on('data', (data) => {
      logger.info(`${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
      logger.debug(`${data}`);
    });

    ffmpeg.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      if (code == 0) {
        resolve('Conversion of ' + inputPath + ' succeeded');
      } else {
        reject('Conversion of ' + inputPath + ' failed');
      }
    });
  });
}


let files = allFilesSync(__dirname + '/../');
let filteredFiles = filterFileType(files, originalType);
logger.info("There are " + filteredFiles.length + " of type " + originalType);

filteredFiles.forEach((file, fileIt) => {
  logger.info('converting ' + (fileIt + 1) + ' of ' + filteredFiles.length);

  convertAndSaveFileAsync(file)
    .then((output) => {

      logger.info(output);
      fs.unlinkSync(file);
    })
    .catch((err) => {
      logger.error(err);
    })

  }
);