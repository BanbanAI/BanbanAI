import { Board } from "@renderer/b2/controllers/board";
import { WidgetSoul, BoardSoul, ProjectBody } from "@common/types/project";

function isBoard(soul: BoardSoul | WidgetSoul): soul is BoardSoul {
  return soul.type === "board";
}

function isWidget(soul: BoardSoul | WidgetSoul): soul is WidgetSoul {
  return !isBoard(soul);
}
let widgetSoulMap: { [uid: string]: WidgetSoul };

const buildSoulMap = (soul: BoardSoul | WidgetSoul) => {
  soul?.widgets?.forEach((widget) => {
    buildSoulMap(widget);
  });
  if (isWidget(soul)) {
    if (!widgetSoulMap[soul.uid]) {
      widgetSoulMap[soul.uid] = soul;
    }
  }
}

const setWidgets = (toWidgets: WidgetSoul[], fromWidgets: WidgetSoul[]) => {
  for (let i = 0; i < fromWidgets.length; i++) {
    if (toWidgets[i]) {
      if (toWidgets[i].uid === fromWidgets[i].uid) {
        setSoulDeep(toWidgets[i], fromWidgets[i]);
        delete widgetSoulMap[fromWidgets[i].uid];
      } else {
        let soul = widgetSoulMap[fromWidgets[i].uid];
        if (soul) {
          setSoulDeep(soul, fromWidgets[i]);
          toWidgets.splice(i, 1, soul);
          delete widgetSoulMap[fromWidgets[i].uid];
        } else {
          toWidgets[i] = fromWidgets[i];
        }
      }
    } else {
      let soul = widgetSoulMap[fromWidgets[i].uid];
      if (soul) {
        setSoulDeep(soul, fromWidgets[i]);
        toWidgets.push(soul);
        delete widgetSoulMap[fromWidgets[i].uid];
      } else {
        toWidgets.push(fromWidgets[i]);
      }
    }
  }
  if (toWidgets.length > fromWidgets.length) {
    toWidgets.splice(fromWidgets.length, toWidgets.length - fromWidgets.length);
  }
}
const setSoulDeep = function <T extends BoardSoul | WidgetSoul>(to: T, from: T) {
  const toKeys = Object.keys(to);
  const fromKeys = Object.keys(from);
  const allKeys = Array.from(new Set([...toKeys, ...fromKeys]));  
  
  for (let key of allKeys) {
    if (key === 'widgets') {
      setWidgets(to.widgets, from.widgets);
    } else if (!from.hasOwnProperty(key)) {
      delete to[key]
    } else{
      to[key] = from[key];
    }
  }
}
export const restoreBoardSoul = (board: Board, sourceSoul: BoardSoul | ProjectBody["foreboard"] | ProjectBody["backboard"]) => {
  const soul: BoardSoul = JSON.parse(JSON.stringify(sourceSoul));
  widgetSoulMap = {};
  buildSoulMap(board.getSoul());
  setSoulDeep(board.getSoul(), soul);
  for (let key in widgetSoulMap) {
    if (widgetSoulMap[key] && widgetSoulMap[key].type !== 'board') {
      const widget = board.getInstancedWidget(key);
      widget.destroy();
      board.unsetInstancedWidget(key);
    }
  }
}
