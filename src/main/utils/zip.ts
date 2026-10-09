import path from "path";
import os from "os";
import fs from "fs";
import { mkdir, unlink, readdir, copyFile } from 'fs/promises'
import {ZipFile} from "yazl";
import yauzl from "yauzl";
import chardet from "chardet";
import iconv from "iconv-lite";

interface DirTree {
  originDir:string,
  dir: string,
  files: string[],
  folders: DirTree[]
}

// 获取文件结构
async function getDirTree(filePath: string, originPath: string) {
  let tree:DirTree = {
    originDir:originPath,
    dir: path.relative(originPath, filePath),
    files: [],
    folders: []
  };
  let files = await readdir(filePath);
  for (let file of files) {
    file = path.join(filePath, file);
    let stat = fs.statSync(file);
    if (stat.isDirectory()) {
      let subTree = await getDirTree(file, originPath);
      tree.folders.push(subTree)
    } else {
      tree.files.push(path.basename(file));
    }
  }
  return tree;
}
// 后面的结构覆盖前面的结构
function mergeTree(dirTrees: DirTree[]){
  let mergedFiles = {};
  let filesList = {};
  for(let n = 0;n < dirTrees.length;n++){
    let patchFiles = getAllFiles(dirTrees[n]);
    filesList[n] = {
      originDir: dirTrees[n].originDir,
      files: patchFiles
    }
  }
  // 最后的优先级最高  [n,m] [i,j,k]
  for(let n = dirTrees.length - 1;n > -1;n--){
    let fileResult = filesList[n];
    for(let i = fileResult.files.length - 1;i > -1;i--){
      let file = fileResult.files[i];
      // 遍历之前的patchtree 有相同路径的，把之前的删掉
      for(let m = n - 1;m > -1;m--){
        let { originDir, files } = filesList[m];
        for(let k = files.length - 1;k > -1;k--){
          let prevFile = files[k];
          if(prevFile.replace(originDir, '') === file.replace(fileResult.originDir, '')){
            files.splice(k, 1);
            break;
          }
        }
      }
    }
  }
  // 当前所有被覆盖的都已经删除
  for(let key in filesList){
    let originDir = filesList[key].originDir;
    if(!mergedFiles[originDir]){
      mergedFiles[originDir] = []
    }
    mergedFiles[originDir] = mergedFiles[originDir].concat(filesList[key].files);
  }
  return mergedFiles;
}

function getAllFiles(tree: DirTree){
  let files:string[] = [];
  for(let file of tree.files){
    files.push(path.join(tree.originDir, tree.dir, file));
  }
  for(let folder of tree.folders){
    let subFiles = getAllFiles(folder);
    files = files.concat(subFiles);
  }
  return files;
}

// 压缩文件
function addFile(zip:ZipFile, files:any, originPath:string){
  let addedDir = [originPath];
  for(let key in files){
    let fileDir = key;
    for(let file of files[key]){
      let fileName = path.basename(file);
      if (/^\./.test(fileName)) continue;
      zip.addFile(file, path.join(path.relative(fileDir, file)));
    }
  }
}

// outputPath xx/xx/xx.zip
// dirPaths  xx/xx/xx
export async function zip(outputPath:string, ...dirPaths:string[]) {
  if (!dirPaths.length) return;
  dirPaths = dirPaths.map((dirPath)=>{ return dirPath.replace(/\\/g, "/")});
  let dirTrees:DirTree[] = [];
  for (let i = 0; i < dirPaths.length; i++) {
    let dirPath = dirPaths[i];
    let dirTree = await getDirTree(dirPath, dirPath);
    dirTrees.push(dirTree);
  }
  //  files = { 'originDir': file[] }
  let files = mergeTree(dirTrees);

  let zip = new ZipFile();
  addFile(zip, files, dirPaths[0]);
  let tmpFile = path.join(os.tmpdir(), Date.now() + '.zip');
  return new Promise((resolve, reject) => {
    zip.outputStream.pipe(fs.createWriteStream(tmpFile))
      .on('error', (error) => {
        reject(error);
      })
      .on('finish', async () => {
        try {
          await copyFile(tmpFile, outputPath);
          await unlink(tmpFile)
          resolve('');
        } catch (error) {
          reject(error);
        }
      });
    zip.end();
  });
}

export async function unzip(zip_file:string, extract_dir:string, _encoding?: string) {
  if(!fs.existsSync(extract_dir)){
    await mkdir(extract_dir, {recursive: true});
  }
  return new Promise<void>((resolve, reject)=>{
      let promises:any = [];
      const failFileList:string[] = [];
      yauzl.open(zip_file, {lazyEntries:true, decodeStrings:false}, function(err, zipfile) {
          if (err) {
              reject(err);
              return;
          }
          zipfile.readEntry();
          zipfile.on("entry", async function(entry) {
            let encoding = _encoding;
            if (!encoding) {
              if (chardet.detect(entry.fileName) === 'UTF-8') {
                encoding = 'utf8';
              } else {
                encoding = 'gbk';
              }
            }
            entry.fileName = iconv.decode(entry.fileName, encoding);
            if (/\/$/.test(entry.fileName)) {
                if(!fs.existsSync(path.join(extract_dir,entry.fileName))){
                    await mkdir(path.join(extract_dir,entry.fileName), {recursive: true});
                }
                zipfile.readEntry();
            } else {
                zipfile.openReadStream(entry, function(err, readStream) {
                    if (err) {
                        failFileList.push(entry.fileName);
                        zipfile.readEntry();
                        return;
                    }
                    let promise = new Promise(async (resolve)=>{
                        let dest_file = path.join(extract_dir, entry.fileName);
                        let dirname = path.dirname(dest_file);
                        if(!fs.existsSync(dirname)){
                          await mkdir(dirname, {recursive: true});
                        }
                        let ws = fs.createWriteStream(dest_file);
                        readStream.on("error", (err) => {
                          failFileList.push(entry.fileName);
                          readStream.destroy();
                          zipfile.readEntry();
                          resolve('');
                        })
                        readStream.pipe(ws);
                        ws.on("finish", function(){
                            zipfile.readEntry();
                            resolve('');
                        }).on("error", function(err){
                            failFileList.push(entry.fileName);
                            zipfile.readEntry();
                            resolve('');
                        })
                    })
                    promises.push(promise);
                });
            }
          }).on("close",function(){
              Promise.all(promises).then(() => {
                if(failFileList.length) {
                  reject(failFileList);
                }else{
                  resolve();
                }
              });
          });
      });
  });
}

// 读取zip里面文件
export function readFile(zip_file:string, relative_file:string){
  return new Promise((resolve, reject) => {
      let buffers:Buffer[] = [];
      yauzl.open(zip_file, {lazyEntries:true, decodeStrings:false}, function(err, zipfile) {
          if (err) {
              reject(err);
              return;
          }
          zipfile.readEntry();
          zipfile.on("entry", function(entry) {
              let name;
              if(chardet.detect(entry.fileName) == "UTF-8") {
                  name = iconv.decode(entry.fileName, 'utf8');
              }else{
                  name = iconv.decode(entry.fileName, 'gbk');
              }
              entry.fileName = name;
              if (entry.fileName != relative_file) {
                  zipfile.readEntry();
              } else {
                  zipfile.openReadStream(entry, function(err, readStream) {
                      if (err) {
                          reject(err);
                          return;
                      }

                      readStream.on("data",(buffer)=>{
                          buffers.push(buffer);
                      }).on('end',function(){
                          resolve(Buffer.concat(buffers));
                      }).on("error", function(err){
                          reject(err);
                      });
                  });
              }
          }).on("close",function(){
              resolve(Buffer.concat(buffers));
          });
      });
  });
}