export type WidgetLoadOptions = {
  boardIds?: string[],
  includeForeboard?: boolean,
  includeBackboard?: boolean,
}

type WidgetSoulLike = {
  type: string,
  widgets?: WidgetSoulLike[],
}

type BoardLike = {
  uid?: string,
  widgets?: WidgetSoulLike[],
} | null | undefined;

type ProjectLike = {
  foreboard?: BoardLike,
  boards?: BoardLike[],
  backboard?: BoardLike,
}

export function getProjectFirstScreenBoardIds(project: ProjectLike) {
  const firstBoardId = project.boards?.[0]?.uid;
  return firstBoardId ? [firstBoardId] : [];
}

export function getBoardsForWidgetLoad(project: ProjectLike, options: WidgetLoadOptions = {}) {
  const boards: BoardLike[] = [];
  const includeForeboard = options.includeForeboard !== false;
  const includeBackboard = options.includeBackboard !== false;

  if (includeForeboard && project.foreboard) {
    boards.push(project.foreboard);
  }

  if (options.boardIds?.length) {
    const boardIds = new Set(options.boardIds);
    boards.push(...(project.boards || []).filter(board => boardIds.has(board?.uid)));
  } else {
    boards.push(...(project.boards || []));
  }

  if (includeBackboard && project.backboard) {
    boards.push(project.backboard);
  }

  return boards;
}

export function collectWidgetTypesFromBoards(boards: BoardLike[]) {
  const soulTypes = new Set<string>();
  for (const board of boards) {
    if (!board) continue;
    const queue: WidgetSoulLike[] = [ ...(board.widgets || []) ];
    while (queue.length > 0) {
      const soul = queue.pop();
      if (!soul) continue;
      soulTypes.add(soul.type);
      for (const widget of soul.widgets || []) {
        queue.push(widget);
      }
    }
  }
  return soulTypes;
}

export function collectWidgetTypesFromProject(project: ProjectLike, options: WidgetLoadOptions = {}) {
  return collectWidgetTypesFromBoards(getBoardsForWidgetLoad(project, options));
}
