'use strict';


const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
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

    const ffmpegSpawn = childProcess.spawnSync('ffmpeg', ['-i', `${inputPath}`, '-threads', '2', '-c:v', 'libx264', `${targetPath}`], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    resolve(ffmpegSpawn.output);
  })
}


function convertAndSaveFileFFMPEG(inputPath) {

  let parsedPath = path.parse(inputPath);
  let targetPath = parsedPath.dir + '/' + parsedPath.name + '.' + targetType;

  return new Promise((resolve, reject) => {

    var process = new ffmpeg(inputPath)
      .videoCodec('libx264')
      .addOption('-threads', '2')

      .on('progress', function (info) {
        logger.info('progress ' + parsedPath.name + " " + info.percent + '%');
      })

      .on('end', function () {
        resolve(parsedPath.name + ' has been converted succesfully')
      })

      .on('error', function (err) {
        reject(err);
      })
      .save(targetPath);
  });
}


let files = allFilesSync(__dirname + '/../');
let filteredFiles = filterFileType(files, originalType);
logger.info("There are " + filteredFiles.length + " of type " + originalType);

for (let i = 0; i < 2; i++) {
  logger.info('converting ' + (i + 1) + ' of ' + filteredFiles.length);

  convertAndSaveFileFFMPEG(filteredFiles[i])
    .then((output) => {

      logger.info(output);
      fs.unlinkSync(filteredFiles[i]);
    })
    .catch((err) => {
      logger.error(err);
    });
}
