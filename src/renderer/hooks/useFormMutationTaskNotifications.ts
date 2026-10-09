import { fetchEventSource } from "@microsoft/fetch-event-source";
import { ElNotification } from "element-plus";
import i18next from "i18next";
import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from "vue";
import {
  FORM_MUTATION_TASK_CREATED_EVENT,
  type FormMutationTaskCreatedDetail,
} from "@renderer/utils/api/form-data";

type FormMutationTaskStatus = "preparing" | "queued" | "running" | "completed" | "failed" | "blocked" | "stale" | "unknown";

type FormMutationTaskSnapshot = {
  taskId: string;
  status: FormMutationTaskStatus;
  error?: string;
};

type FormMutationTaskNotificationOptions = {
  nocodeId: MaybeRefOrGetter<string | undefined>;
  tableUID: MaybeRefOrGetter<string | undefined>;
  active?: MaybeRefOrGetter<boolean>;
  onSettled?: () => void | Promise<void>;
};

export const isFormMutationTaskNotificationTargetActive = (
  detail: Pick<FormMutationTaskCreatedDetail, "nocodeId" | "tableUID">,
  active: boolean,
  nocodeId: string | undefined,
  tableUID: string | undefined,
) => active && detail.nocodeId === nocodeId && detail.tableUID === tableUID;

export function useFormMutationTaskNotifications(options: FormMutationTaskNotificationOptions) {
  const controllers = new Map<string, AbortController>();
  const isActive = () => options.active === undefined || Boolean(toValue(options.active));
  const isCurrentTarget = (detail: FormMutationTaskCreatedDetail) => {
    return isFormMutationTaskNotificationTargetActive(
      detail,
      isActive(),
      toValue(options.nocodeId),
      toValue(options.tableUID),
    );
  };

  const stopAll = () => {
    for (const controller of controllers.values()) controller.abort();
    controllers.clear();
  };

  const notifyTerminalStatus = (
    snapshot: FormMutationTaskSnapshot,
    detail: FormMutationTaskCreatedDetail,
  ) => {
    if (!isCurrentTarget(detail)) return;
    if (snapshot.status === "failed") {
      ElNotification({
        title: i18next.t("NocodeForm.backgroundFlowFailedTitle", { defaultValue: "后台流程执行失败" }),
        message: snapshot.error || i18next.t("NocodeForm.backgroundFlowFailedContent", { defaultValue: "请稍后重试或查看流程日志" }),
        type: "error",
        duration: 0,
      });
    }
  };

  const watchTask = (detail: FormMutationTaskCreatedDetail) => {
    if (!isCurrentTarget(detail) || controllers.has(detail.taskId)) return;

    const controller = new AbortController();
    controllers.set(detail.taskId, controller);
    void fetchEventSource(`/form-data/mutation-task-stream?taskId=${encodeURIComponent(detail.taskId)}`, {
      signal: controller.signal,
      openWhenHidden: false,
      onmessage(message) {
        if (message.event !== "form-mutation-task" || !message.data) return;
        const snapshot = JSON.parse(message.data) as FormMutationTaskSnapshot;
        if (![
          "completed",
          "failed",
          "blocked",
          "stale",
          "unknown",
        ].includes(snapshot.status)) return;
        notifyTerminalStatus(snapshot, detail);
        void options.onSettled?.();
        controller.abort();
        controllers.delete(detail.taskId);
      },
      onclose() {
        controllers.delete(detail.taskId);
      },
      onerror(error) {
        controllers.delete(detail.taskId);
        controller.abort();
        throw error;
      },
    }).catch(() => {
      controllers.delete(detail.taskId);
    });
  };

  const handleTaskCreated = (event: Event) => {
    watchTask((event as CustomEvent<FormMutationTaskCreatedDetail>).detail);
  };

  window.addEventListener(FORM_MUTATION_TASK_CREATED_EVENT, handleTaskCreated);
  watch(
    () => [isActive(), toValue(options.nocodeId), toValue(options.tableUID)] as const,
    (current, previous) => {
      const targetChanged = current[1] !== previous?.[1] || current[2] !== previous?.[2];
      if (!current[0] || targetChanged) stopAll();
    },
  );
  onScopeDispose(() => {
    window.removeEventListener(FORM_MUTATION_TASK_CREATED_EVENT, handleTaskCreated);
    stopAll();
  });
}
