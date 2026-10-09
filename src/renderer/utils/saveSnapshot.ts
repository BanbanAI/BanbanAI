
import { SNAPSHOT_IGNORE_CLASS, AllBoard } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { ProjectBody } from "@common/types/project";
import axios from "axios";
import domToImage from 'dom-to-image-more';

const beforeGenerateSnapshot = (allBoard: AllBoard, activeBoardId: string) => {
  const boards: Board[] = [];
  if(allBoard.foreBoard?.uid === activeBoardId){
    boards.push(allBoard.foreBoard);
  }else if(allBoard.backBoard?.uid === activeBoardId){
    boards.push(allBoard.backBoard);
  }else{
    if(allBoard.foreBoard){
      boards.push(allBoard.foreBoard);
    }
    if(allBoard.backBoard){
      boards.push(allBoard.backBoard);
    }
    const activeBoard = Object.values(allBoard.boards || {}).find(board=>board.uid === activeBoardId);
    if(activeBoard) boards.push(activeBoard);
  }
  return Promise.all([
    ...boards.map((board)=>{
      return board.beforeSnapshot();
    }),
  ]);
}

const generateSnapshot = async (project: ProjectBody, activeBoardId: string, allBoard: AllBoard, allBoardDom: { [key: string]: HTMLElement }) => {
  // 最终图片中每个子图片的绘制大小
  let imageSize = { height: 0, width: 0 };
  // 需要合并的图片，按图层顺序自底向上添加进来
  let mergeImages = [];
  // 处理需要截图的 Board
  let uids = [activeBoardId];
  let activeForeOrBack = project.backboard?.uid === activeBoardId || project.foreboard?.uid === activeBoardId;
  if (project.backboard?.uid && !activeForeOrBack) {
    uids.unshift(project.backboard.uid);
  }
  if (project.foreboard?.uid && !activeForeOrBack) {
    uids.push(project.foreboard.uid);
  }
  for (let uid of uids) {
    const boardDom = allBoardDom[uid];
    const boardContainer = boardDom.getElementsByClassName("board-container")[0] as HTMLElement;
    const boardBackground = boardDom.getElementsByClassName("board-background")[0] as HTMLElement;
    if (uid === activeBoardId) {
      imageSize = {
        width: boardContainer.offsetWidth,
        height: boardContainer.offsetHeight,
      };
    }
    const board = getBoardByUID(uid, allBoard);
    const backgroundDataUrl = await domToImage.toPng(boardBackground, {
      width: board.size.width * 1,
      height: board.size.height * 1,
    });
    mergeImages.push(backgroundDataUrl);
    const containerDataUrl = await domToImage.toPng(boardContainer, {
      filter: (node: HTMLElement)=>{
        if(node.classList?.contains(SNAPSHOT_IGNORE_CLASS) || node.style?.display === "none"){
          return false;
        }
        return true;
      },
      width: board.size.width,
      height: board.size.height,
      style: {
        transform: `scale(1) translate(0px, 0px)`,
      }
    });
    mergeImages.push(containerDataUrl);
  }
  const canvas = await mergeImgs(mergeImages, imageSize, imageSize);
  return canvas;
};

const afterGenerateSnapshot = async (allBoard: AllBoard, activeBoardId: string) => {
  const boards: Board[] = [];
  if(allBoard.foreBoard?.uid === activeBoardId){
    boards.push(allBoard.foreBoard);
  }else if(allBoard.backBoard?.uid === activeBoardId){
    boards.push(allBoard.backBoard);
  }else{
    if(allBoard.foreBoard){
      boards.push(allBoard.foreBoard);
    }
    if(allBoard.backBoard){
      boards.push(allBoard.backBoard);
    }
    const activeBoard = Object.values(allBoard.boards || {}).find(board=>board.uid === activeBoardId);
    if(activeBoard) boards.push(activeBoard);
  }
  return Promise.all([
    ...boards.map((board)=>{
      return board.afterSnapshot();
    }),
  ]);
}

const getBoardByUID = (uid: string, allBoard: AllBoard): Board=>{
  if(!uid) return undefined;
  const boards = Object.values(allBoard.boards).concat(allBoard.foreBoard ?? [], allBoard.backBoard ?? []) as Board[];
  let targetBoard: Board;
  for(let board of boards){
    if(board.uid === uid){
      targetBoard = board;
      break;
    }
  }
  return targetBoard;
}

async function mergeImgs(list: string[], canvasSize: { width: number, height: number }, imageSize: { width: number, height: number }): Promise<HTMLCanvasElement> {
  // 创建 canvas 节点并初始化
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize.width;
  canvas.height = canvasSize.height;
  const context = canvas.getContext("2d");
  let imgs = await Promise.all(list.map((item)=>{
    return new Promise<HTMLImageElement>((resolve)=>{
      const img = new Image();
      img.src = item;
      // 跨域
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        resolve(img);
      };
      img.onerror = () => {
        resolve(null);
      }
    });
  }));
  for (const img of imgs) {
    if (!img) continue;
    context.drawImage(img, 0, 0, imageSize.width, imageSize.height);
  }
  return canvas;
}

export const saveSnapshot = async (projectId: string, allBoard: AllBoard, activeBoardId: string, project: ProjectBody, allBoardDom: { [key: string]: HTMLElement }): Promise<string> => {
  await beforeGenerateSnapshot(allBoard, activeBoardId);
  let snapshot: HTMLCanvasElement;
  try{
    snapshot = await generateSnapshot(project, activeBoardId, allBoard, allBoardDom);
  }catch(err){
    console.error("snapshot error:", err)
    await afterGenerateSnapshot(allBoard, activeBoardId);
    return;
  }
  await afterGenerateSnapshot(allBoard, activeBoardId);
  const formData = new FormData();
  formData.append("projectId", projectId);
  formData.append("elementId", activeBoardId);
  formData.append("isCover", "true");
  formData.append("isBoard", "true");
  await new Promise<void>(resolve => {
    snapshot.toBlob(blob => {
      formData.append("file", blob);
      resolve();
    });
  });
  const data = await axios.post("/project/save-element-snapshots", formData, { headers: { "Content-Type": "multipart/form-data" } }).then(({ data }) => data).catch(() => []);
  if (data) {
    return data[0]?.relativePath;
  }
}
