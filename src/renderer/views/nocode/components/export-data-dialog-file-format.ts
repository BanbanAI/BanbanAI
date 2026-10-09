export type ExportFieldNode = {
  uid: string
  extra?: {
    widgetType?: string
  }
  subColumns?: ExportFieldNode[]
}

const IMAGE_UPLOADER_WIDGET_TYPE = 'widget.form.image-uploader'
const FILE_UPLOADER_WIDGET_TYPE = 'widget.form.file-uploader'

function flattenFields(fields: ExportFieldNode[]): ExportFieldNode[] {
  const result: ExportFieldNode[] = []

  for (const field of fields) {
    result.push(field)

    if (field.subColumns?.length) {
      result.push(...flattenFields(field.subColumns))
    }
  }

  return result
}

export function isUploadExportField(field?: ExportFieldNode): boolean {
  return field?.extra?.widgetType === IMAGE_UPLOADER_WIDGET_TYPE
    || field?.extra?.widgetType === FILE_UPLOADER_WIDGET_TYPE
}

export function shouldAutoEnableFileFormatExport(
  prevIds: string[],
  nextIds: string[],
  fields: ExportFieldNode[],
): boolean {
  const prevIdSet = new Set(prevIds)
  const addedIdSet = new Set(nextIds.filter(id => !prevIdSet.has(id)))

  if (addedIdSet.size === 0) {
    return false
  }

  return flattenFields(fields).some(field => addedIdSet.has(field.uid) && isUploadExportField(field))
}
