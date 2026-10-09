import './types'
import { Board } from './controllers/board'
import { SubFormRow } from './controllers/form'
import { buildElement } from "./utils/element.util";

export default {
  install() {
    buildElement(Board);
    buildElement(SubFormRow);
  }
}
