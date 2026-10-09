import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

export function unique(size = 12) {
  return customAlphabet(alphabet, size)();
}
