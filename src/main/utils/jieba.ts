import { cut } from "jieba-wasm";
import { join } from "path";
import fs from "fs";


const stopwordsFile = join(__dirname, "./assets/jieba/cn_stopwords.txt");
const stopwords = fs.readFileSync(stopwordsFile, {encoding: "utf-8"}).split("\n");
const stopwordsSet = new Set();
for (const stopword of stopwords) {
  stopwordsSet.add(stopword);
}

export const jieba = {
  cut: (text: string, hmm?: boolean)=>{
    const tokens: string[] = cut(text, hmm);
    return tokens.filter(token=>!stopwordsSet.has(token)).map(token=>token.toLowerCase());
  },
};
