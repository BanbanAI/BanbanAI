type LinvoDBOptions = {
  filename?: string,
  db?: any,
}


declare module 'linvodb3' {
  class LinvoDB {
    constructor(name: string);
    constructor(name: string, options: LinvoDBOptions);
    constructor(name: string, schema, options: LinvoDBOptions);

    store: levelup;

    addListener(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): void;

    count(query: any, callback: (err: any, count: number) => void, quiet?: boolean): Cursor;
    distinct(field: string, query: any, callback?: (err: any, res: {value: any, count: number}[]) => void, quiet?: boolean): Cursor;
    find(query: any, callback?: (err: any, docs: any[]) => void, quiet?: boolean): Cursor;
    findById(id: string, callback: (err: any, doc: any) => void): Cursor;
    findOne(query: any, callback?: (err: any, doc: any) => void): Cursor;
    getAllData(): any;
    initStore(): any;
    insert(doc: any, callback: (err: any, doc: any) => void): void;


    /**
     * Remove all docs matching the query
     * For now very naive implementation (similar to update)
     * @param {Object} query
     * @param {Object} options Optional options
     *                 options.multi If true, can update multiple documents (defaults to false)
     * @param {Function} cb Optional callback, signature: err, numRemoved
     *
     * @api private Use Model.remove which has the same signature
     */
    remove(query: any, options?: LinvoRemoveOptions, callback?: (err: any, doc: any) => void): void;
    save(docs: any, callback: (err: any, docs: any) => void, quiet: boolean): void;
    /**
     * Update all docs matching query
     * @param {Object} query
     * @param {Object} updateQuery
     * @param {Object} options Optional options
     *                 options.multi If true, can update multiple documents (defaults to false)
     *                 options.upsert If true, document is inserted if the query doesn't match anything
     * @param {Function} cb Optional callback, signature: err, numReplaced, upsert (set to true if the update was in fact an upsert)
     *
     * @api private Use Model.update which has the same signature
     *
     * NOTE things are a bit wonky here with atomic updating and lock/unlock mechanisms; I'm not sure how it will fare with deep object
     * updating, since constructing a new document instance via the constructor does shallow copy; but seems it will be OK, since
     * we only do that at the end, when everything is successful
     */
    update(query: any, updateQuery: any, options?: LinvoUpdateOptions, callback?: (err: any, doc: any) => void): void;

  }

  export = LinvoDB;
}
