import { BackTodoOptions, CancelTodoOptions, CheckProcessVersionDeletableParams, CheckProcessVersionDeletableResult, DeleteTodoOptions, DeleteTodosOptions, FinishTodoOptions, GetAllProcessParams, GetFlowRecordsParams, GetTodoParams, GetTodosParams, GetTodosResult, GetTransferTodoUsersOptions, RejectTodoOptions, StashTodoOptions, SubmitTodoOptions, TODO, TodoCategory, TransferTodoOptions } from '@common/types/nocode';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import type { GetAllCategoryTodoCountParams } from '@common/types/nocode';

export const formFlowApi = {
  async getTodos(options: GetTodosParams): Promise<GetTodosResult> {
    try {
      const { data } = await axios.get("/form-flow/get-todos", {
        params: {
          ...options,
          filter: typeof options.filter === "string" || !options.filter
            ? options.filter
            : JSON.stringify(options.filter),
        },
      });
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  },
  async getTodo(options: GetTodoParams): Promise<TODO | null> {
    try {
      const { data } = await axios.get("/form-flow/get-todo", { params: options });
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  },
  async getAllProcess(options: GetAllProcessParams) {
    try {
      const { data } = await axios.get("/form-flow/get-all-process", { params: options });
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  async getFlowRecords(options: GetFlowRecordsParams) {
    try {
      const { data } = await axios.get("/form-flow/get-flow-records", { params: options });
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  async submitTodo(options: SubmitTodoOptions) {
    try {
      const { data } = await axios.post("/form-flow/submit-todo", options);
      return data;
    } catch (err) {
      console.error(err);
      ElMessage.error(err?.response?.data?.message || i18next.t('form-flow.submitFailed'));
      return null;
    }
  },
  async stashTodo(options: StashTodoOptions) {
    try {
      const { data } = await axios.post("/form-flow/stash-todo", options);
      return data;
    } catch (err) {
      console.error(err);
      throw new Error(err?.response?.data?.message || err?.response?.data?.errorMessage || err?.message || "request failed");
    }
  },
  async getAllFlows(options: GetFlowRecordsParams) {
    try {
      const { data } = await axios.get("/form-flow/get-all-flows", { params: options });
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  async backTodo(options: BackTodoOptions) {
    try {
      const { data } = await axios.post("/form-flow/back-todo", options);
      return data;
    } catch (err) {
      console.error(err);
      ElMessage.error(i18next.t('form-flow.rejectFailed'));
      return [];
    }
  },

  async cancelTodo(options: CancelTodoOptions) {
    try {
      const { data } = await axios.post("/form-flow/cancel-todo", options);
      return data;
    } catch (err) {
      console.error(err);
      throw new Error(err?.response?.data?.message || err?.response?.data?.errorMessage || err?.message || "request failed");
    }
  },
  async finishTodo(options: FinishTodoOptions) {
    try {
      const { data } = await axios.post("/form-flow/finish-todo", options);
      return data;
    } catch (err) {
      console.error(err);
      throw new Error(err?.response?.data?.message || err?.response?.data?.errorMessage || err?.message || "request failed");
    }
  },
  async deleteTodo(options: DeleteTodoOptions) {
    try {
      const { data } = await axios.post("/form-flow/delete-todo", options);
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  async deleteTodos(options: DeleteTodosOptions) {
    try {
      const { data } = await axios.post("/form-flow/delete-todos", options);
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  async transferTodo(options: TransferTodoOptions) {
    try {
      const { data } = await axios.post("/form-flow/transfer-todo", options)
      return data
    } catch (error) {
      console.error(error);
      return [];
    }
  },
  async getTransferTodoUsers(options: GetTransferTodoUsersOptions): Promise<string[]> {
    try {
      const { data } = await axios.get("/form-flow/get-transfer-todo-users", { params: options });
      return data || [];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  async rejectTodo(options: RejectTodoOptions) {
    try {
      const { data } = await axios.post("/form-flow/reject-todo", options);
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  async getAllCategoryTodoCount(options: GetAllCategoryTodoCountParams) {
    try {
      const { data } = await axios.get("/form-flow/get-all-category-todo-count", { params: options });
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  },
  async getProcessNocodeSimplifyDatas() {
    try {
      const { data } = await axios.get("/form-flow/get-process-nocode-simplify-datas");
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  },
  async getStartTodoOwners(options: { category: TodoCategory, nocodeId: string }) {
    try {
      const { data } = await axios.get("/form-flow/get-start-todo-owners", { params: options });
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  },
  async checkProcessVersionDeletable(options: CheckProcessVersionDeletableParams): Promise<CheckProcessVersionDeletableResult> {
    try {
      const { data } = await axios.get("/form-flow/check-process-version-deletable", { params: options });
      return data;
    } catch (err) {
      console.error(err);
      return {
        canDelete: false,
        hasData: false,
        versionStatus: null,
      };
    }
  }
}
