import fs from "fs";
import crypto from "crypto";

export const getFileMd5 = (filePath: string): Promise<string> => new Promise((resolve, reject) => {
  const md5 = crypto.createHash("md5");
  fs.createReadStream(filePath).on("data", chunk => md5.update(chunk)).on("end", () => resolve(md5.digest("hex"))).on("error", reject);
});

export async function compareFileMd5(filePath1: string, filePath2: string) {
  const [first, second] = await Promise.all([getFileMd5(filePath1), getFileMd5(filePath2)]);
  return first === second;
}
