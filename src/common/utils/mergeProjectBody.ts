import { BoardSoul, CoEditingAccount, ProjectBody } from "@common/types/project";

function handleMergeProjectModule(originProjectBody: ProjectBody, newProjectBody: ProjectBody, boardUIDs?: string[]): ProjectBody {
  const boards: BoardSoul[] = [];
  //  board的增 删 改顺序
  // boards用旧的,其余全用新的
  for (let i = 0; i < newProjectBody.boards.length; i++) {
    const board = newProjectBody.boards[i];
    const oldBoard = originProjectBody.boards.find(bo => bo.uid === board.uid);
    if (!oldBoard || (boardUIDs && boardUIDs.length > 0 && boardUIDs.includes(board.uid))) {
      boards.push(board)
    } else {
      boards.push(oldBoard)
    }
  }
  if (newProjectBody.foreboard && originProjectBody.foreboard && (!boardUIDs || !boardUIDs.includes(newProjectBody.foreboard.uid))) {
    newProjectBody.foreboard = originProjectBody.foreboard
  }
  if (newProjectBody.backboard && originProjectBody.backboard && (!boardUIDs || !boardUIDs.includes(newProjectBody.backboard.uid))) {
    newProjectBody.backboard = originProjectBody.backboard
  }
  newProjectBody.boards = boards;
  return newProjectBody;
}

function handleMergeBoardModule(originProjectBody: ProjectBody, newProjectBody: ProjectBody, boardUIDs: string[]): ProjectBody {
  // 这里不会涉及到board的增删改  只存在 旧board的内容与新board之间的内容覆盖
  // 只改了board的内容
  for (let i = 0; i < originProjectBody.boards.length; i++) {
    const board = originProjectBody.boards[i];
    if (boardUIDs.includes(board.uid)) {
      originProjectBody.boards[i] = newProjectBody.boards.find(item => item.uid === board.uid);
    }
  }
  if (boardUIDs.includes(newProjectBody.foreboard?.uid)) {
    originProjectBody.foreboard = newProjectBody.foreboard;
  }
  if (boardUIDs.includes(newProjectBody.backboard?.uid)) {
    originProjectBody.backboard = newProjectBody.backboard;
  }
  return originProjectBody;
}

export async function handleMergeProjectBody(coEditingAccount: CoEditingAccount, originProjectBody: ProjectBody, newProjectBody: ProjectBody) {
  let projectBody: ProjectBody;
  if (coEditingAccount.editModule === 'project') {
    // 改除了boards的部分
    projectBody = handleMergeProjectModule(originProjectBody, newProjectBody);
  } else if (coEditingAccount.editModule === 'board') {
    // 只改 boards部分
    projectBody = handleMergeBoardModule(originProjectBody, newProjectBody, coEditingAccount.boardUIDs);
  } else {
    // 都要改
    // 先改项目
    projectBody = handleMergeProjectModule(originProjectBody, newProjectBody, coEditingAccount.boardUIDs);
  }
  projectBody.manualChanged = newProjectBody.manualChanged;
  return projectBody;
}