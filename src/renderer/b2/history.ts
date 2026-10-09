import { restoreBoardSoul } from "./utils/soul.util";
import { Board } from "./controllers/board";
import { BoardSoul } from "@common/types/project";

const MAX_SIZE = 20;

class B2HistoryCache {
  timestamp: number;
  boardSoul: BoardSoul;
  uid: string;

  constructor(board: Board) {
    this.boardSoul = JSON.parse(JSON.stringify(board.getSoul()));
    this.timestamp = new Date().getTime();
    if (board.historyId) this.uid = board.historyId;
  }

  getTimestamp() {
    return this.timestamp;
  }
}

export const createB2History = (board: Board) => {
  let caches: B2HistoryCache[] = [];
  let cacheIndex: number = -1;

  const add = () => {
    const historyId = board.historyId;

    //通过设置length高效删除指定index后的元素
    caches.length = cacheIndex + 1;

    if (caches.length > 0) {
      const lastCache = caches[cacheIndex];
      const timeBegin = new Date().getTime();
      const deltaTime = timeBegin - lastCache.getTimestamp();
      if (lastCache.uid && historyId && lastCache.uid === historyId) {
        //两次添加的uid相同，合并
        caches[cacheIndex] = new B2HistoryCache(board);
        // console.log('merge history', caches);
        return;
      } else if (deltaTime < 200) {
        //两次添加的历史间隔时间非常短，自动做合并
        //FIXME 通过间隔200ms合并的操作并不可靠,如果进入这里,对触发的地方进行优化,使用id的方式合并
        caches[cacheIndex] = new B2HistoryCache(board);
        // console.log('merge history', caches);
        return;
      }
    }

    caches.push(new B2HistoryCache(board));
    // console.log('history', caches);
    cacheIndex++;
    if (caches.length > MAX_SIZE) {
      //去掉最开头的
      cacheIndex--;
      caches.shift();
    }
  }

  const restoreSoul = () => {
    board.updateHistory(caches[cacheIndex].uid, false);
    const soul: BoardSoul = JSON.parse(JSON.stringify(caches[cacheIndex].boardSoul));
    restoreBoardSoul(board, soul);
  }

  const undo = () => {
    if (cacheIndex >= 1) {
      cacheIndex--;
      restoreSoul();
      return true
    }
    return false
  }

  const redo = () => {
    if (cacheIndex < caches.length - 1) {
      cacheIndex++;
      restoreSoul();
      return true
    }
    return false
  }

  const getTimestamps = () => {
    return caches.map(cache => {
      return {
        historyId: cache.uid,
        timestamp: cache.timestamp
      }
    })
  }

  add();

  return { undo, redo, add, getTimestamps };
}