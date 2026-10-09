type SettingChangeFlagOptions = {
  activeName?: string | null,
  isChanged?: boolean,
  publishChanged?: boolean,
}

const PUBLISH_SETTING_TABS = new Set([
  'publish',
  'publish-inner',
  'publish-public',
])

export const isPublishSettingTab = (activeName?: string | null) => (
  !!activeName && PUBLISH_SETTING_TABS.has(activeName)
)

export const shouldShowSettingChangeFlag = ({
  activeName,
  isChanged,
  publishChanged,
}: SettingChangeFlagOptions) => (
  isPublishSettingTab(activeName)
    ? !!publishChanged
    : !!isChanged
)
