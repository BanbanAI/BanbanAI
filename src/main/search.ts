import { Document } from "flexsearch";
import { jieba } from '@main/utils/jieba';
import { DocumentIndexKey, SearchParam } from './modules/formData/types';
import { threadId } from "worker_threads";

const documentIndex: Record<DocumentIndexKey, Document> = {};

export default async function handleDocumentIndex(params: SearchParam): Promise<any> {
  const requestId = Math.random();
  console.log(requestId, "index ", params.handle,params.indexKey);
  const t = Date.now();
  if (params.handle === "search") {
    const result = documentIndex[params.indexKey].search(params.query);
    console.log(requestId, "index threadId", threadId, params.handle,params.indexKey, Date.now() - t);
    return result;
  }
  if (params.handle === "create") {
    if (documentIndex[params.indexKey]) {
      console.log("created ", params.indexKey);
      return true;
    }
    const dIndex = new Document({
      encoder: (content: string): string[]=>{
        const tokens = jieba.cut(content);
        return tokens;
      },
      tokenize: "exact",
      document: {
        id: params.uid,
        store: true, // 是否存储document内容
        index: params.fields
      }
    });
    for (const row of params.rows) {
      dIndex.add(row);
    }
    documentIndex[params.indexKey] = dIndex;
    console.log(requestId, "threadId", threadId, params.handle,params.indexKey, Date.now() - t);
    return true;
  }
  for (const row of params.rows) {
    documentIndex[params.indexKey][params.handle](row);
  }
  console.log(requestId, "threadId", threadId, params.handle,params.indexKey, Date.now() - t);
  return true;
}