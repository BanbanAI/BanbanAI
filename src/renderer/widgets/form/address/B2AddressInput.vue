<template>
  <b2-form-element :class="{'mobile': isMobile()}" v-bind="$attrs">
  <!-- 移动端 -->
  <template v-if="isMobile()">
    <div class="drop-body" v-if="!widget.isReadonly">
      <el-input class="input-address" size="default" v-model="widget.selectedRegionPath" @click="drawerVisible = true"
        :placeholder="widget.inputValue || widget.selectorPlaceholder" readonly>
      </el-input>
      <mobile-address-drawer ref="addressDrawerRef" v-model="drawerVisible" :defaultValue="widget.selectedRegionPath" :level="widget.addressPrecision" @change="handleChanged" @confirm="handleConfirm" @update:modelValue="updateValue"></mobile-address-drawer>
      <el-input v-if="widget.isAddressDetail" class="textareaInput" v-model="widget.inputAddressDetail" :rows="6" type="textarea"
        :autosize="{ minRows: 2 }" resize="none" :placeholder="widget.inputPlaceholder" :maxlength="widget.maxLength"
        :show-word-limit="widget.wordLimit" :clearable="widget.clearable" />
    </div>
    <div class="value" v-else>
      <div :style="{ color: widget.selectedRegionPath ? 'unset' : 'var(--text-color-inactive)' }">{{ widget.selectedRegionPath || $t('noContent') }}</div>
      <div v-if="widget.isAddressDetail" :style="{ color: widget.inputAddressDetail ? 'unset' : 'var(--text-color-inactive)' }">{{widget.inputAddressDetail || $t('noContent')}}</div>
    </div>
  </template>
  <!-- PC -->
  <template v-else>
    <div class="drop-body" v-if="widget.isInSubForm">
      <teleport to="body">
        <div class="address-popper" :id="`popper-${widget.uid}`"></div>
      </teleport>
      <el-popover
        ref="popoverRef"
        placement="bottom"
        trigger="click"
        width="320"
        :append-to="`#popper-${widget.uid}`"
        :show-arrow="false"
        @show="popoverVisible = true;"
        @hide="popoverVisible = false;"
      >
        <template #reference>
          <el-input class="input-address" v-if="!widget.isReadonly" size="default" v-model="address"
            :placeholder="widget.selectorPlaceholder" readonly>
          </el-input>
        </template>

        <el-tree-select
          class="drop-down"
          :teleported="false"
          :clearable="widget.clearable"
          lazy
          :load="loadNode"
          :render-after-expand="false"
          v-model="selectedRegionKey"
          :data="rootOptions"
          :filterable="true"
          :placeholder="widget.selectorPlaceholder"
          :empty-text="i18next.t('noData')"
          :no-match-text="i18next.t('noSearchData')"
          :current-node-key="selectedRegionKey"
          :highlight-current="true"
          @change="handleTreeChanged"
          @visible-change="handleSelectVisibleChange"
          :props="{
            value: 'value',
            label: 'label',
            children: 'children',
            isLeaf: 'isLeaf',
          }"
        >
          <template #label="{ label }">
            <span>{{ selectedRegionKey || widget.selectedRegionPath || label || widget.selectorPlaceholder }}</span>
          </template>
        </el-tree-select>
        <el-input
          v-if="widget.isAddressDetail"
          class="textareaInput"
          v-model="widget.inputAddressDetail"
          :rows="6"
          type="textarea"
          :autosize="{ minRows: 2 }"
          resize="none"
          :placeholder="widget.inputPlaceholder"
          :maxlength="widget.maxLength"
          :show-word-limit="widget.wordLimit"
          :clearable="widget.clearable"
        />
      </el-popover>
    </div>

    <div class="drop-body" v-else-if="!widget.isReadonly">
      <teleport to="body">
        <div class="tree-select-popper" :id="`popper-${widget.uid}`"></div>
      </teleport>
      <el-tree-select
        class="drop-down"
        :teleported="true"
        :append-to="`#popper-${widget.uid}`"
        :clearable="widget.clearable"
        lazy
        :load="loadNode"
        :render-after-expand="false"
        v-model="selectedRegionKey"
        :data="rootOptions"
        :filterable="true"
        :placeholder="widget.selectorPlaceholder"
        :empty-text="i18next.t('noData')"
        :no-match-text="i18next.t('noSearchData')"
        :current-node-key="selectedRegionKey"
        :highlight-current="true"
        @change="handleTreeChanged"
        @visible-change="handleSelectVisibleChange"
        :props="{
          value: 'value',
          label: 'label',
          children: 'children',
          isLeaf: 'isLeaf',
        }"
      >
        <template #label="{ label }">
          <span>{{ selectedRegionKey || widget.selectedRegionPath || label || widget.selectorPlaceholder }}</span>
        </template>
      </el-tree-select>
      <el-input
        v-if="widget.isAddressDetail"
        class="textareaInput"
        v-model="widget.inputAddressDetail"
        :rows="6"
        type="textarea"
        :autosize="{ minRows: 2 }"
        resize="none"
        :placeholder="widget.inputPlaceholder"
        :maxlength="widget.maxLength"
        :show-word-limit="widget.wordLimit"
        :clearable="widget.clearable"
      />
    </div>
    <div class="value" v-else>
      <div :style="{ color: widget.selectedRegionPath ? 'unset' : 'var(--text-color-inactive)' }" :title="widget.selectedRegionPath || i18next.t('noContent')">{{ widget.selectedRegionPath || i18next.t('noContent') }}</div>
      <div v-if="widget.isAddressDetail" :style="{ color: widget.inputAddressDetail ? 'unset' : 'var(--text-color-inactive)' }" :title="widget.inputAddressDetail || i18next.t('noContent')">{{ widget.inputAddressDetail || i18next.t('noContent') }}</div>
    </div>
  </template>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { ref, onMounted, computed, onBeforeUnmount, watch } from "vue";
import { AddressInput } from "./addressInput";
import { getChinaAddressData } from "@renderer/utils/township";
import { ElPopover, ElTreeSelect, usePopperContainerId } from "element-plus";
import MobileAddressDrawer from './MobileAddressDrawer.vue';
import i18next, { $t } from "@renderer/widgets/i18next";

interface Tree {
  label: string;
  value: string;
  children?: Tree[];
}

const { selector } = usePopperContainerId();
const widget = useWidget<AddressInput>();
const CHINADATA = ref<Tree[]>([]);
const popoverVisible = ref(false);
const drawerVisible = ref(false);
const treeSelectVisible  = ref(false);
const popoverRef = ref();
const selectedRegionKey = ref<string>("");
const rootOptions = ref<Tree[]>([]);

const address = computed(() => {
  if (widget?.inputValue) {
    let [selectedArr, ...inputArr] = widget.inputValue.split(' ').filter(Boolean);
    return selectedArr + '-' + inputArr.join(' ');
  }
  return ''
})

const normalizeRegionPath = (regionPath: string) => {
  return regionPath
    .split('/')
    .filter(Boolean)
    .slice(0, widget.addressPrecision || 4)
    .join('/');
};

const findRegionByPath = (regionPath: string) => {
  const labels = regionPath.split('/').filter(Boolean);

  let nodes = CHINADATA.value as Tree[];
  let matchedNode: Tree | undefined;

  for (const label of labels) {
    matchedNode = nodes.find(node => node.label === label);
    if (!matchedNode) return null;
    nodes = matchedNode.children || [];
  }

  return matchedNode || null;
};

const handleChanged = () => {
  widget.validate();
};

const handleTreeChanged = (value?: string) => {
  if (!value) {
    widget.selectedRegionPath = null;
  } else {
    widget.selectedRegionPath = value;
  }
  widget.validate();
};

const createRegionOption = (node: Tree, parentPath: string, isMaxLevel: boolean) => {
  const { children, ...rest } = node;
  return {
    ...rest,
    value: [parentPath, node.label].filter(Boolean).join('/'),
    isLeaf: isMaxLevel || !children || children.length === 0
  };
};

const loadNode = async (node, resolve: (data) => void) => {
  if (!CHINADATA.value.length) {
    CHINADATA.value = await getChinaAddressData();
  }
  if (node && node.isLeaf) return resolve([])
  const maxLevel = widget.addressPrecision || 4;
  const isMaxLevel = (node.level + 1) >= maxLevel;

  if (node && node.data?.value) {
    const match = findRegionByPath(node.data.value);

    if (match && match.children) {
      resolve(match.children.map(child => createRegionOption(child, node.data.value, isMaxLevel)));
    } else {
      resolve([]);
    }
  } else {
    resolve(CHINADATA.value.map(child => createRegionOption(child, "", isMaxLevel)));
  }
};

const handleSelectVisibleChange = (visible: boolean) => {
  treeSelectVisible.value = visible;
};

const handleDocumentClick = (event: MouseEvent) => {
  if (!popoverVisible.value) return;

  const target = event.target as HTMLElement;
  const popoverElement = popoverRef.value?.popperRef?.contentRef;

  if (treeSelectVisible.value) return;

  if (popoverElement && !popoverElement.contains(target)) {
    popoverRef.value?.hide();
  }
};

const updateValue = (value) => {
  popoverVisible.value = value;
  drawerVisible.value = value;
}

const handleConfirm = (data: string) => {
  widget.selectedRegionPath = data;
}

// void widget.inputValue;

watch(
  () => widget.initialValue ?? widget.defaultValue,
  (value) => {
    widget.syncAddressParts(value);
  },
  { immediate: true }
);

watch(
  [() => widget.selectedRegionPath, () => widget.addressPrecision],
  () => {
    const regionPath = widget.selectedRegionPath || "";
    selectedRegionKey.value = regionPath
      ? normalizeRegionPath(regionPath)
      : "";
  },
  { immediate: true }
);

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
});
</script>

<style lang="scss" scoped>
:deep(.b2widget-body) {
  overflow: visible !important;
}

.addressInputWrapper {
  position: relative;
  display: flex;
  flex-wrap: wrap;
}

.el-select {
  :deep(.el-select__wrapper) {
    height: 32px;
    border-radius: 4px;
  }
}

.textareaInput {
  margin-top: 8px;
}

:deep(.el-textarea__inner) {
  border-radius: 4px;
}


.value {
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 4px 8px;
  line-height: 20px;
}

.address-popver {
  background-color: var(--bg-color-page);
  border-radius: 4px;
}


.address-popper {
  :deep(.el-popper) {
    background-color: var(--bg-color-page);
    border-radius: 4px;
  }
}

.input-address {
  &.mobile {
    margin-bottom: 8px;
  }
  :deep() {
    .el-input__wrapper {
      border-radius: 4px;
    }
  }
}

.mobile {
  .input-address {
    margin-bottom: 8px;
  }
}
</style>
