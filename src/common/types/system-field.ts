export enum FormDataStage {
  NORMAL = "normal",
  ADDING = "adding",
  EDITING = "editing",
  DELETING = "deleting",
  DELETED = "deleted",
  DRAFT = "draft",
}

export enum SystemField {
  UUID = "_uuid",
  CREATE_TIME = "_create_time",
  UPDATE_TIME = "_update_time",
  CREATE_OWNER = "_create_owner",
  DATA_OWNER = "_data_owner",
  UPDATE_OWNER = "_update_owner",
  STATUS = "_status",
  CURRENT_NODE = "_current_node",
  CURRENT_OWNER = "_current_owner",
  TODO_ID = "_todo_id",
  TODO_VERSION = "_todo_version",
  KEY = "_key",
  DATA_TITLE = "_data_title",
  SORT = "_sort",
  DATA_STAGE = "_data_stage",
  RELATED_SUB_FORM = "_related_sub_form",
}
