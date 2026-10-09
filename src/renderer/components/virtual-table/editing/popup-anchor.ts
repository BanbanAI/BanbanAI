import { VirtualTableEditSession } from "./types";

type PopupAnchorLike = {
  isConnected?: boolean;
};

type PopupContainerLike = {
  contains?: (node: Node | null | undefined) => boolean;
};

const isPopupAnchorAttached = (
  anchorEl?: PopupAnchorLike | null,
  containerEl?: PopupContainerLike | null,
) => {
  return Boolean(
    anchorEl
    && anchorEl.isConnected !== false
    && containerEl?.contains?.(anchorEl as Node) !== false
  );
};

export const resolveVirtualTablePopupAnchorAction = (
  options: {
    session?: VirtualTableEditSession | null;
    anchorEl?: PopupAnchorLike | null;
    fallbackAnchorEl?: PopupAnchorLike | null;
    containerEl?: PopupContainerLike | null;
  },
) => {
  if (options.session?.mode !== "popup" || options.session.status !== "editing") {
    return {
      type: "none",
    } as const;
  }

  if (isPopupAnchorAttached(options.anchorEl, options.containerEl)) {
    return {
      type: "sync",
      anchorEl: options.anchorEl,
    } as const;
  }

  if (isPopupAnchorAttached(options.fallbackAnchorEl, options.containerEl)) {
    return {
      type: "sync",
      anchorEl: options.fallbackAnchorEl,
    } as const;
  }

  return {
    type: "detach",
  } as const;
};
