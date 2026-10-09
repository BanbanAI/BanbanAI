import { PublishUpdateMethod } from '@common/types/project';

type PublishMetaLike = {
  updateMethod?: PublishUpdateMethod,
  innerUpdateMethod?: PublishUpdateMethod,
  publicUpdateMethod?: PublishUpdateMethod,
};

type PublishProjectLike = {
  sharing?: boolean,
  isPublicShare?: boolean,
};

type TablePublishLike = {
  updateMethod?: PublishUpdateMethod,
};

export const getInnerPublishUpdateMethod = (meta?: PublishMetaLike | null) => {
  return meta?.innerUpdateMethod || PublishUpdateMethod.LIVE;
};

export const getPublicPublishUpdateMethod = (meta?: PublishMetaLike | null) => {
  return meta?.publicUpdateMethod || PublishUpdateMethod.LIVE;
};

export const getFormPublicPublishUpdateMethod = (meta?: PublishMetaLike | null, publish?: TablePublishLike | null) => {
  return publish?.updateMethod || getPublicPublishUpdateMethod(meta);
};

export const isInnerPublishLiveUpdate = (meta?: PublishMetaLike | null) => {
  return getInnerPublishUpdateMethod(meta) === PublishUpdateMethod.LIVE;
};

export const isPublicPublishLiveUpdate = (meta?: PublishMetaLike | null) => {
  return getPublicPublishUpdateMethod(meta) === PublishUpdateMethod.LIVE;
};

export const isFormPublicPublishLiveUpdate = (meta?: PublishMetaLike | null, publish?: TablePublishLike | null) => {
  return getFormPublicPublishUpdateMethod(meta, publish) === PublishUpdateMethod.LIVE;
};

export const hasManualPublishScope = (meta?: PublishMetaLike | null) => {
  return !isInnerPublishLiveUpdate(meta) || !isPublicPublishLiveUpdate(meta);
};

export const shouldMarkProjectManualChanged = (meta?: PublishMetaLike | null, project?: PublishProjectLike | null) => {
  if (!project?.sharing) {
    return false;
  }
  if (!isInnerPublishLiveUpdate(meta)) {
    return true;
  }
  return !!project.isPublicShare && !isPublicPublishLiveUpdate(meta);
};
