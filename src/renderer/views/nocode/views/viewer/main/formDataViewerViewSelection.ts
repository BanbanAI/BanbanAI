import { isVirtualTableLabRoute } from "../../../utils/virtualTableLabRoute";

type FormDataViewerViewLike = {
  uid: string;
  type?: string;
};

type ResolvePreferredFormDataViewerTabUidArgs = {
  views: FormDataViewerViewLike[];
  currentUid?: string;
  query?: Record<string, string | string[] | null | undefined>;
};

export const resolvePreferredFormDataViewerTabUid = ({
  views,
  currentUid,
  query,
}: ResolvePreferredFormDataViewerTabUidArgs) => {
  if (!views.length) {
    return "";
  }

  if (currentUid && views.some((view) => view.uid === currentUid)) {
    return currentUid;
  }

  if (isVirtualTableLabRoute(query)) {
    const tableView = views.find((view) => view.type === "table");
    if (tableView?.uid) {
      return tableView.uid;
    }
  }

  return views[0]?.uid || "";
};
