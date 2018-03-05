'use strict';


const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const logDir = path.join(__dirname, 'logs');
const originalType = 'avi';
const targetType = 'mp4';

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
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

  const ffmpeg = childProcess.spawnSync('ffmpeg', ['-i', `${inputPath}`, '-threads', '2', '-c:v', 'libx264', `${targetPath}`], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf-8'
  });
  console.info(ffmpeg.output);
  fs.unlinkSync(inputPath);
}

let files = allFilesSync(__dirname + '/../');
let filteredFiles = filterFileType(files, originalType);
console.info("There are " + filteredFiles.length + " of type " + originalType);

filteredFiles.forEach((file, fileIt) => {
    console.info('converting ' + (fileIt + 1) + ' of ' + filteredFiles.length);
    convertAndSaveFile(file);
  }
);