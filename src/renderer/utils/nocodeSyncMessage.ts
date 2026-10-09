import { Warning } from "@element-plus/icons-vue";
import { ElMessage, type MessageHandler } from "element-plus";
import i18next from "i18next";
import { h, type Ref } from "vue";

let syncConflictMessage: MessageHandler | null = null;

const STYLE_ID = "nocode-sync-conflict-message-style";
const NOCODE_SYNC_CONFLICT_TYPE = "NOCODE_SYNC_CONFLICT";

const ensureSyncMessageStyle = () => {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .nocode-sync-conflict-message {
      top: 12px !important;
      padding: 0 !important;
      border: 1px solid rgba(253, 228, 146, 1);
      background: rgba(255, 251, 232, 1) !important;
      border-radius: 4px !important;
      min-width: 535px !important;
      max-width: min(720px, calc(100vw - 16px)) !important;
      align-items: stretch !important;
      box-shadow: 0px 8px 20px rgba(0, 0, 0, 0.1);
    }

    .nocode-sync-conflict-message .el-message__content {
      width: 100%;
      padding: 0;
      overflow: visible;
    }

    .nocode-sync-conflict-message .el-message__icon,
    .nocode-sync-conflict-message .el-message__closeBtn {
      display: none !important;
    }

    .nocode-sync-conflict-message__body {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-height: 40px;
      padding: 0 12px;
      box-sizing: border-box;
    }

    .nocode-sync-conflict-message__icon {
      flex: 0 0 18px;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      color: #d8a634;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      line-height: 1;
      font-weight: 600;
      box-sizing: border-box;
    }

    .nocode-sync-conflict-message__text {
      flex: 1;
      min-width: 0;
      color: rgb(207, 135, 12);
      font-size: 13px;
      line-height: 20px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .nocode-sync-conflict-message__actions {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-left: auto;
      padding-left: 16px;
    }

    .nocode-sync-conflict-message__link {
      appearance: none;
      border: none;
      background: transparent;
      padding: 0;
      font-size: 13px;
      line-height: 20px;
      cursor: pointer;
      white-space: nowrap;
    }

    .nocode-sync-conflict-message__link--primary {
      color: #2f73ff;
      font-weight: 500;
    }

    .nocode-sync-conflict-message__link--default {
      color: #6f7480;
      font-weight: 400;
    }

    @media (max-width: 640px) {
      .nocode-sync-conflict-message {
        min-width: auto !important;
      }

      .nocode-sync-conflict-message__body {
        flex-wrap: wrap;
        padding-top: 8px;
        padding-bottom: 8px;
      }

      .nocode-sync-conflict-message__text {
        white-space: normal;
      }

      .nocode-sync-conflict-message__actions {
        width: 100%;
        padding-left: 26px;
        justify-content: flex-end;
      }
    }
  `;

  document.head.appendChild(style);
};

const reloadCurrentPage = () => {
  const currentHref = window.location.href;

  window.location.reload();

  window.setTimeout(() => {
    if (window.location.href === currentHref) {
      window.location.replace(currentHref);
    }
  }, 150);
};

export const closeNocodeSyncConflictMessage = () => {
  syncConflictMessage?.close();
  syncConflictMessage = null;
};

export const showNocodeSyncConflictMessage = () => {
  if (syncConflictMessage) {
    return syncConflictMessage;
  }

  ensureSyncMessageStyle();

  let handler: MessageHandler | null = null;

  const close = () => {
    handler?.close();
    syncConflictMessage = null;
  };

  handler = ElMessage({
    type: "warning",
    duration: 0,
    showClose: false,
    customClass: "nocode-sync-conflict-message",
    message: h("div" as any, { class: "nocode-sync-conflict-message__body" }, [
      h("span" as any, { class: "nocode-sync-conflict-message__icon" }, [h(Warning as any)]),
      h(
        "div" as any,
        { class: "nocode-sync-conflict-message__text" },
        String(i18next.t("nocodeSyncMessage.text")),
      ),
      h("div" as any, { class: "nocode-sync-conflict-message__actions" }, [
        h(
          "button" as any,
          {
            type: "button",
            class: "nocode-sync-conflict-message__link nocode-sync-conflict-message__link--primary",
            onClick: () => {
              close();
              reloadCurrentPage();
            },
          },
          String(i18next.t("nocodeSyncMessage.refreshAction")),
        ),
        h(
          "button" as any,
          {
            type: "button",
            class: "nocode-sync-conflict-message__link nocode-sync-conflict-message__link--default",
            onClick: close,
          },
          String(i18next.t("nocodeSyncMessage.closeAction")),
        ),
      ]),
    ]),
    onClose: () => {
      syncConflictMessage = null;
    },
  });

  syncConflictMessage = handler;

  return handler;
};

const getNocodeSyncConflictDetails = (errorOrResponse: any) => {
  const data = errorOrResponse?.response?.data ?? errorOrResponse?.data ?? errorOrResponse;
  return data?.error?.details ?? data?.details ?? null;
};

export const isNocodeSyncConflictError = (errorOrResponse: any) => {
  const details = getNocodeSyncConflictDetails(errorOrResponse);
  return details?.type === NOCODE_SYNC_CONFLICT_TYPE || details?.source === "NocodeSyncGuard";
};

export const handleNocodeSyncConflictError = (errorOrResponse: any, isLatest?: Ref<boolean> | null) => {
  if (!isNocodeSyncConflictError(errorOrResponse)) {
    return false;
  }

  if (isLatest) {
    isLatest.value = false;
  }

  showNocodeSyncConflictMessage();
  return true;
};

export const checkNocodeSyncBeforeRequest = (isLatest?: Ref<boolean> | null) => {
  if (!isLatest || isLatest.value) {
    return true;
  }

  showNocodeSyncConflictMessage();
  return false;
};