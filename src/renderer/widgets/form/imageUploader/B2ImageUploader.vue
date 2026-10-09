<template>
  <div class="image-uploader-widget" ref="imageUploaderWidgetRef" :style="{ width: widget.isEditable || isMobileDevice ? `100%` : `calc(100% * ${widget.widthRatio} - 15px)` }">
    <b2-form-element>
      <div v-if="!(widget.isReadonly && imageList.length === 0)" class="image-uploader-container" :class="{'mobile': isMobileDevice, [widget.fileListType]: true}">

        <!-- 除"PC下拉列表"外的其他图片展示类型 -->
        <template v-if="widget.fileListType !== 'drop-down' || isMobileDevice">
          <!-- 移动端-上传区域 -->
          <template v-if="isMobileDevice">
          <!-- 移动端: 卡片 -->
          <template v-if="widget.fileListType === 'picture-card'">
            <div class="mobile-image-card-uploader" :class="{'hide-upload-box': !showUploadBox}" v-if="!placeholderVisible">
              <el-upload
                ref="uploadRef"
                action="javascript:void(0);"
                list-type="picture-card"
                v-model:file-list="imageList"
                :multiple="!widget.isOnlyCamera && widget.fileSelectMode === 'select-mulitple'"
                :accept="widget.isOnlyCamera ? 'image/*' : widget.fileAccept"
                :before-upload="beforeUpload"
                :http-request="uploadFile"
                :on-progress="handleProgress"
                :on-success="handleSuccess"
                :on-change="handleChange"
                v-bind="$attrs"
                :disabled="widget.isReadonly"
              >
                <div class="mobile-upload-trigger">
                  <el-icon><i-ven-icon-widget-form-image-uploader-upload class="custom-btn-icon" /></el-icon>
                  <span>{{ uploadButtonText }}</span>
                </div>
                <template #file="{ file }">
                  <div class="mobile-file-item">
                    <img
                      class="el-upload-list__item-thumbnail"
                      :src="file.url"
                      alt=""
                      @click="openImageViewer(imageList.findIndex(item => item.uid === file.uid))"
                    />
                    <div class="loading-overlay" v-if="file.loading">
                      <span class="loading-text">{{ file.percentage || 0 }}%</span>
                    </div>
                    <span v-if="!widget.isReadonly" class="mobile-file-delete" @click.stop="widget.beforeRemove(file)">
                        <el-icon><CircleCloseFilled /></el-icon>
                    </span>
                  </div>
                </template>
              </el-upload>
            </div>
          </template>
          <!-- 移动端: 列表 -->
          <el-upload v-if="widget.fileListType === 'picture' || widget.fileListType === 'text' || (widget.fileListType === 'drop-down' && imageList.length === 0)"
            :drag="true"
            class="img-preview upload-button-wrapper mobile"
            :class="{'isEdit': widget.isEditable}"
            action="javascript:void(0);"
            ref="uploadRef"
            v-model:file-list="widget.fileList"
            :multiple="!widget.isOnlyCamera && widget.fileSelectMode === 'select-mulitple'"
            :accept="widget.isOnlyCamera ? 'image/*' : widget.fileAccept"
            :before-upload="beforeUpload"
            :http-request="uploadFile"
            :on-preview="handlePictureCardPreview"
            :on-remove="widget.beforeRemove"
            :on-progress="handleProgress"
            :on-success="handleSuccess"
            :on-change="handleChange"
            v-bind="$attrs"
            :show-file-list="false"
            :style="{
              display: showUploadBox ? 'block': 'none',
              marginTop: (!imageList.length) || !widget.isReadonly ? '' : '-20px',
              '--list-item-width': '100%',
              '--card-item-width': '100%'
            }"
            @paste="handlePaste"
          >
            <template #trigger v-if="!imageList.length || !widget.isReadonly">
              <div class="upload-container">

                <div class="upload-container" @click.stop>
                  <div type="primary" class="upload-button">
                    <span  @click.stop="triggerUpload" class="upload-span" v-if="!widget.isReadonly" title="">
                      <el-icon :size="16"><i-ven-icon-widget-form-image-uploader-upload class="custom-btn-icon" /></el-icon>
                      {{ uploadButtonText }}&nbsp;
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </el-upload>
          <!-- 移动端: 下拉列表 -->
          <div class="preview-img-drop-down" v-if="widget.fileList?.length && widget.fileListType === 'drop-down'" :style="{
            '--list-item-width': '100%',
          }">
            <div class="img-drop-down-btn" @click="showDropPane">
              <div class="small-img-preview">
                <el-image v-for="file in imageList" :key="file.uid" class="image-thumbnail" :src="file.url" fit='contain' :style="{ height: '36px', marginRight: '4px' }">
                  <template #error>
                    <div class="image-thumbnail-default">
                      <i-ven-icon-widget-form-image-uploader-union style="fill: #fff" />
                    </div>
                  </template>
                </el-image>
              </div>
              <el-icon :size="16" v-if="dropPaneVisible"><ArrowUp /></el-icon>
              <el-icon :size="16" v-else><ArrowDown /></el-icon>
            </div>
            <div v-show="dropPaneVisible" class="img-view-pane">
              <el-upload
                v-if="!widget.isReadonly"
                class="img-preview"
                ref="uploadRef"
                :drag="true"
                v-model:file-list="imageList"
                :multiple="!widget.isOnlyCamera && widget.fileSelectMode === 'select-mulitple'"
                :accept="widget.isOnlyCamera ? 'image/*' : widget.fileAccept"
                :before-upload="beforeUpload"
                :http-request="uploadFile"
                :on-preview="handlePictureCardPreview"
                :on-remove="widget.beforeRemove"
                :on-success="handleSuccess"
                :on-change="handleChange"
                :on-progress="handleProgress"
                v-bind="$attrs"
                :show-file-list="false"
                :style="{
                  '--list-item-width': '100%',
                }"
                @paste="handlePaste"
              >
                <template #trigger>
                  <div class="upload-container" @click.stop>
                    <div type="primary" class="upload-button">
                      <span  @click.stop="triggerUpload" class="upload-span" title="">
                        <el-icon :size="16"><i-ven-icon-widget-form-image-uploader-upload class="custom-btn-icon" /></el-icon>
                        {{ uploadButtonText }}&nbsp;
                      </span>
                    </div>
                  </div>
                </template>
              </el-upload>
              <div class="img-list-preview">
                <el-scrollbar max-height="308px">
                  <div class="preview-img-list" v-for="(file, index) in imageList" :key="index" element-loading-background="transparent">
                    <img
                      v-if="file.url"
                      class="image-thumbnail"
                      :src="file.url"
                      @click="openImageViewer(index)"
                    />
                    <div class="image-thumbnail" v-else>
                      <i-ven-icon-widget-form-image-uploader-union style="fill: #fff" />
                    </div>
                    <div class="image-data">
                      <div class="image-name">
                        <span class="img-name-val">{{ file.name?.substring(0, file.name.lastIndexOf(".")) }}</span>
                        <span class="img-suffix">{{ file.name?.substring(file.name.lastIndexOf(".")) }}</span>
                      </div>
                      <div class="image-size">
                        {{ diskSize(file.size) }}
                      </div>
                    </div>
                    <div class="btn-delete">
                      <el-button link @click="downloadFile(file)">
                        <el-icon :size="16" color="var(--el-color-info)">
                          <i-ven-icon-widget-form-image-uploader-download class="custom-btn-icon"/>
                        </el-icon>
                      </el-button>
                      <el-button v-if="!widget.isReadonly" link @click.stop="widget.beforeRemove(file as any)">
                        <el-icon :size="16" color="var(--el-color-danger)">
                          <i-ven-icon-widget-form-image-uploader-delete class="custom-btn-icon"/>
                        </el-icon>
                      </el-button>
                    </div>
                    <el-progress :percentage="(file.percentage ?? 100)" color="#4ba0fc" v-if="['ready', 'uploading'].includes(file.status) || file.loading" :show-text="false"/>
                  </div>
                </el-scrollbar>
              </div>
            </div>
          </div>
          </template>


          <!-- PC: 卡片, 列表 -->
          <el-upload v-if="!isMobileDevice"
            :drag="true"
            class="img-preview upload-button-wrapper"
            :class="{
              'card-img-preview': widget.fileListType !== 'text' && !widget.isInSubForm,
              'list-in-subform': widget.isInSubForm,
              'isEdit': widget.isEditable,
              'mobile': isMobileDevice,
            }"
            ref="uploadRef"
            v-model:file-list="widget.fileList"
            :multiple="!widget.isOnlyCamera && widget.fileSelectMode === 'select-mulitple'"
            :accept="widget.isOnlyCamera ? 'image/*' : widget.fileAccept"
            :before-upload="beforeUpload"
            :http-request="uploadFile"
            :on-preview="handlePictureCardPreview"
            :on-remove="widget.beforeRemove"
            :on-progress="handleProgress"
            :on-success="handleSuccess"
            :on-change="handleChange"
            v-bind="$attrs"
            :show-file-list="false"
            :style="{
              display: showUploadBox ? 'block': 'none',
              marginTop: (!imageList.length && widget.isInSubForm) || (!widget.isReadonly && !widget.isInSubForm) ? '' : '-20px',
              maxWidth: widget.isInSubForm ? '360px' : undefined,
              '--list-item-width': widget.isInSubForm || isMobileDevice ? '100%' : widget.inputWidthStyle,
              '--card-item-width': widget.isInSubForm || isMobileDevice ? '100%' : '360px',
            }"
            @paste="handlePaste"
          >
            <template #trigger v-if="(!imageList.length && widget.isInSubForm) || (!widget.isReadonly && !widget.isInSubForm)">
              <div class="upload-container">

                <div class="upload-container" @click.stop :title="i18next.t('pasteTip')">
                  <div type="primary" class="upload-button">
                    <span  @click.stop="triggerUpload" class="upload-span" v-if="!widget.isReadonly" title="">
                      <el-icon :size="16" color="#4E5969"><i-ven-icon-widget-form-image-uploader-upload class="custom-btn-icon" /></el-icon>
                      {{ uploadButtonText }}&nbsp;
                    </span>
                    <span v-if="!isMobileDevice" class="button-append-text">
                      {{ uploadButtonAppendText  }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
            <div class="wrap-cell-image" v-if="widget.isInSubForm && imageList.length > 0" @click.stop>
              <cell-image ref="cellImageRef" category="image" :imageList="imageList" :listType="widget.fileListType">
                <template #popover-header>
                  <el-upload class="img-preview" ref="uploadRef" :multiple="!widget.isOnlyCamera && widget.fileSelectMode === 'select-mulitple'"
                    v-model:file-list="imageList" :drag="true" :accept="widget.isOnlyCamera ? 'image/*' : widget.fileAccept"
                    :before-upload="beforeUpload"
                    :http-request="uploadFile"
                    :on-preview="handlePictureCardPreview"
                    :on-remove="widget.beforeRemove"
                    :on-success="handleSuccess"
                    :on-change="handleChange"
                    :on-progress="handleProgress"
                    v-bind="$attrs"
                    :show-file-list="!widget.isInSubForm"
                    :style="{
                      '--list-item-width': widget.isInSubForm ? '100%' : widget.inputWidthStyle,
                    }"
                    @paste="handlePaste">
                    <template #trigger>
                      <div class="upload-container" @click.stop :title="i18next.t('pasteTip')">
                        <div type="primary" class="upload-button">
                          <span  @click.stop="triggerUpload" class="upload-span" v-if="!widget.isReadonly" title="">
                            <el-icon :size="16" color="#4E5969"><i-ven-icon-widget-form-image-uploader-upload class="custom-btn-icon" /></el-icon>
                            {{ uploadButtonText }}&nbsp;
                          </span>
                          <span v-if="!isMobileDevice" class="button-append-text">
                            {{ uploadButtonAppendText  }}
                          </span>
                        </div>
                      </div>
                    </template>
                  </el-upload>
                </template>
                <template #list-item-option="{ image }">
                  <div class="btn-delete">
                    <el-button link @click="downloadFile(image as any)">
                      <el-icon :size="16" color="var(--el-color-info)"><i-ven-icon-widget-form-image-uploader-download style="fill: #4E5969;" /></el-icon>
                    </el-button>
                    <el-button
                      v-if="!widget.isReadonly"
                      link
                      @click.stop="widget.beforeRemove(image as any)">
                      <el-icon
                        :size="16" color="var(--el-color-danger)"
                      >
                        <i-ven-icon-widget-form-image-uploader-delete style="fill: #4E5969;" />
                      </el-icon>
                    </el-button>
                  </div>
                </template>
              </cell-image>
            </div>
          </el-upload>

          <!-- 移动/PC-已上传内容区域 -->
          <template v-if="widget.fileList?.length">
            <div
              v-if="isShowUploadedList"
              class="img-preview upload-list-wrapper"
              :class="{
                'card-img-preview': !isMobileDevice && widget.fileListType !== 'text' && !widget.isInSubForm,
                'list-in-subform': widget.isInSubForm,
                'img-preview-Move': !widget.isReadonly,
                'mobile': isMobileDevice,
              }"
              :style="{
                display: placeholderVisible ? 'none' : 'block',
                width: uploadImageWidgetWidth
              }"
            >
              <Draggable
                class="el-upload-list"
                :list="imageList"
                :component-data="{
                  tag: 'transition-group',
                  type: 'transition-group',
                  name: !drag ? 'flip-list' : null
                }"
                :item-key="getImageItemKey"
                v-bind="dragOptions"
                @start="onStart"
                @end="onEnd"
              >
                <template #item="{element: file, index }">
                  <div class="el-upload-list__item">
                    <div
                      class="preview-img-list"
                      element-loading-background="transparent">
                      <img
                        v-if="file.url"
                        class="image-thumbnail"
                        :src="file.url"
                        @click="openImageViewer(index)"
                      />
                      <div class="image-thumbnail" v-else>
                        <i-ven-icon-widget-form-image-uploader-union style="fill: #fff" />
                      </div>
                      <div class="image-data">
                        <div class="image-name">
                          <span class="img-name-val">{{ file.name?.substring(0, file.name.lastIndexOf(".")) }}</span>
                          <span class="img-suffix">{{ file.name?.substring(file.name.lastIndexOf(".")) }}</span>
                        </div>
                        <div class="image-size">
                          {{ diskSize(file.size) }}
                        </div>
                      </div>
                      <div class="btn-delete">
                        <el-button link @click="downloadFile(file)">
                          <el-icon :size="16" color="var(--el-color-info)"><i-ven-icon-widget-form-image-uploader-download class="custom-btn-icon" /></el-icon>
                        </el-button>
                        <el-button
                          v-if="!widget.isReadonly"
                          link
                          @click.stop="widget.beforeRemove(file)">
                          <el-icon
                            :size="16" color="var(--el-color-danger)"
                          >
                            <i-ven-icon-widget-form-image-uploader-delete class="custom-btn-icon" />
                          </el-icon>
                        </el-button>
                      </div>
                      <el-progress :percentage="(file.percentage ?? 100)" color="#4ba0fc" v-if="['ready', 'uploading'].includes(file.status) || file.loading" :show-text="false"/>
                    </div>
                  </div>
                </template>
              </Draggable>
            </div>
          </template>

          <!-- 子表单-只读 -->
          <cell-image v-if="widget.isInSubForm && widget.isReadonly && imageList.length > 0" category="image" :imageList="imageList" :listType="widget.fileListType"></cell-image>
        </template>

        <!-- PC: 下拉列表 -->
        <template v-if="!isMobileDevice">
          <div v-if="widget.fileListType === 'drop-down' && !placeholderVisible" class="drop-drown-subform"
          :class="{
            'is-in-subform': widget.isInSubForm,
            'isEdit': widget.isEditable,
          }">
            <el-upload
              v-if="imageList.length === 0 || widget.isInSubForm"
              class="img-preview"
              ref="uploadRef"
              :drag="true"
              v-model:file-list="imageList"
              :multiple="!widget.isOnlyCamera && widget.fileSelectMode === 'select-mulitple'"
              :accept="widget.isOnlyCamera ? 'image/*' : widget.fileAccept"
              :before-upload="beforeUpload"
              :http-request="uploadFile"
              :on-preview="handlePictureCardPreview"
              :on-remove="widget.beforeRemove"
              :on-success="handleSuccess"
              :on-change="handleChange"
              :on-progress="handleProgress"
              v-bind="$attrs"
              :show-file-list="!widget.isInSubForm"
              :style="{
                '--list-item-width': widget.isInSubForm ? '100%' : widget.inputWidthStyle,
              }"
              @paste="handlePaste"
            >
              <template #trigger v-if="imageList.length === 0 && !widget.isReadonly">
                <div class="upload-container" @click.stop :title="i18next.t('pasteTip')">
                  <div type="primary" class="upload-button">
                    <span  @click.stop="triggerUpload" class="upload-span" title="">
                      <el-icon :size="16" color="#4E5969"><i-ven-icon-widget-form-image-uploader-upload class="custom-btn-icon" /></el-icon>
                      {{ uploadButtonText }}&nbsp;
                    </span>
                    <span v-if="!isMobileDevice" class="button-append-text">
                      {{ uploadButtonAppendText  }}
                    </span>
                  </div>
                </div>
              </template>
              <cell-image v-if="widget.isInSubForm" ref="cellImageRef" category="image" :imageList="imageList" :listType="widget.fileListType">
                <template v-if="!widget.isReadonly" #popover-header>
                  <el-upload class="img-preview" ref="uploadRef" :multiple="!widget.isOnlyCamera && widget.fileSelectMode === 'select-mulitple'"
                    v-model:file-list="imageList" :drag="true" :accept="widget.isOnlyCamera ? 'image/*' : widget.fileAccept"
                    :before-upload="beforeUpload"
                    :http-request="uploadFile"
                    :on-preview="handlePictureCardPreview"
                    :on-remove="widget.beforeRemove"
                    :on-success="handleSuccess"
                    :on-change="handleChange"
                    :on-progress="handleProgress"
                    v-bind="$attrs"
                    :show-file-list="!widget.isInSubForm"
                    :style="{
                      '--list-item-width': widget.isInSubForm ? '100%' : widget.inputWidthStyle,
                    }"
                    @paste="handlePaste">
                    <template #trigger>
                      <div class="upload-container" @click.stop :title="i18next.t('pasteTip')">
                        <div type="primary" class="upload-button">
                          <span  @click.stop="triggerUpload" class="upload-span" title="">
                            <el-icon :size="16" color="#4E5969"><i-ven-icon-widget-form-image-uploader-upload class="custom-btn-icon" /></el-icon>
                            {{ uploadButtonText }}&nbsp;
                          </span>
                          <span v-if="!isMobileDevice" class="button-append-text">
                            {{ uploadButtonAppendText  }}
                          </span>
                        </div>
                      </div>
                    </template>
                  </el-upload>
                </template>
                <template #list-item-option="{ image }">
                  <div class="btn-delete">
                    <el-button link @click="downloadFile(image as any)">
                      <el-icon :size="16" color="var(--el-color-info)"><i-ven-icon-widget-form-image-uploader-download style="fill: #4E5969;" /></el-icon>
                    </el-button>
                    <el-button
                      v-if="!widget.isReadonly"
                      link
                      @click.stop="widget.beforeRemove(image as any)">
                      <el-icon :size="16" color="var(--el-color-danger)">
                        <i-ven-icon-widget-form-image-uploader-delete style="fill: #4E5969;" />
                      </el-icon>
                    </el-button>
                  </div>
                </template>
              </cell-image>
            </el-upload>
            <div class="preview-img-drop-down" v-else :style="{
                '--list-item-width': widget.isInSubForm ? '100%' : widget.inputWidthStyle,
              }">
              <div class="img-drop-down-btn" @click="showDropPane">
                <div class="small-img-preview">
                  <el-image v-for="file in imageList" :key="file.uid" class="image-thumbnail" :src="file.url" fit='contain' :style="{ height: '16px', marginRight: '4px' }">
                    <template #error>
                      <div style="background-color: #F5F5F7; width: 16px; height: 16px;">
                        <i-ven-icon-widget-form-image-uploader-union style="fill: #fff" />
                      </div>
                    </template>
                  </el-image>
                </div>
                <el-icon :size="16" v-if="dropPaneVisible"><ArrowUp /></el-icon>
                <el-icon :size="16" v-else><ArrowDown /></el-icon>
              </div>
              <div v-show="dropPaneVisible" class="img-view-pane">
                <el-upload
                  class="img-preview"
                  ref="uploadRef"
                  v-if="!widget.isReadonly"
                  :drag="true"
                  v-model:file-list="imageList"
                  :multiple="!widget.isOnlyCamera && widget.fileSelectMode === 'select-mulitple'"
                  :accept="widget.isOnlyCamera ? 'image/*' : widget.fileAccept"
                  :before-upload="beforeUpload"
                  :http-request="uploadFile"
                  :on-preview="handlePictureCardPreview"
                  :on-remove="widget.beforeRemove"
                  :on-success="handleSuccess"
                  :on-change="handleChange"
                  :on-progress="handleProgress"
                  v-bind="$attrs"
                  :show-file-list="false"
                  :style="{
                    '--list-item-width': widget.isInSubForm ? '100%' : widget.inputWidthStyle,
                  }"
                  @paste="handlePaste"
                >
                  <template #trigger>
                    <div class="upload-container" @click.stop :title="i18next.t('pasteTip')">
                      <div type="primary" class="upload-button">
                        <span  @click.stop="triggerUpload" class="upload-span" title="">
                          <el-icon :size="16" color="#4E5969"><i-ven-icon-widget-form-image-uploader-upload class="custom-btn-icon" /></el-icon>
                          {{ uploadButtonText }}&nbsp;
                        </span>
                        <span class="button-append-text">
                          {{ uploadButtonAppendText  }}
                        </span>
                      </div>
                    </div>
                  </template>
                </el-upload>
                <div class="img-list-preview">
                  <el-scrollbar max-height="312px">
                    <div class="preview-img-list" v-for="(file, index) in imageList" :key="index" element-loading-background="transparent">
                      <img
                        v-if="file.url"
                        class="image-thumbnail"
                        :src="file.url"
                        @click="openImageViewer(index)"
                      />
                      <div class="image-thumbnail" v-else>
                        <i-ven-icon-widget-form-image-uploader-union style="fill: #fff" />
                      </div>
                      <div class="image-data">
                        <div class="image-name">
                          <span class="img-name-val">{{ file.name?.substring(0, file.name.lastIndexOf(".")) }}</span>
                          <span class="img-suffix">{{ file.name?.substring(file.name.lastIndexOf(".")) }}</span>
                        </div>
                        <div class="image-size">
                          {{ diskSize(file.size) }}
                        </div>
                      </div>
                      <div class="btn-delete">
                        <el-button link @click="downloadFile(file)">
                          <el-icon :size="16" color="var(--el-color-info)">
                            <i-ven-icon-widget-form-image-uploader-download class="custom-btn-icon"/>
                          </el-icon>
                        </el-button>
                        <el-button v-if="!widget.isReadonly" link @click.stop="widget.beforeRemove(file as any)">
                          <el-icon :size="16" color="var(--el-color-danger)">
                            <i-ven-icon-widget-form-image-uploader-delete class="custom-btn-icon"/>
                          </el-icon>
                        </el-button>
                      </div>
                      <el-progress :percentage="(file.percentage ?? 100)" color="#4ba0fc" v-if="['ready', 'uploading'].includes(file.status) || file.loading" :show-text="false"/>
                    </div>
                  </el-scrollbar>
                </div>
              </div>
            </div>
          </div>
        </template>

        <el-dialog
          v-model="dialogVisible"
          :append-to-body="true"
          align-center
          width="auto"
        >
          <img :src="dialogImageUrl" alt="Preview Image" />
        </el-dialog>

        <el-image-viewer
          v-if="isImageViewerVisible"
          :initial-index="activeImageIndex"
          :url-list="imageList.map(image => image.url)"
          @close="isImageViewerVisible = false"
          show-progress
          teleported
        >
          <template #toolbar="{ actions, prev, next, reset, activeIndex, setActiveItem }">
            <el-icon @click="prev"><Back /></el-icon>
            <el-icon @click="next"><Right /></el-icon>
            <el-icon @click="setActiveItem(imageList.length - 1)"><DArrowRight /></el-icon>
            <el-icon @click="actions('zoomOut')"><ZoomOut /></el-icon>
            <el-icon @click="actions('zoomIn', { enableTransition: false, zoomRate: 2 })"><ZoomIn /></el-icon>
            <el-icon @click="actions('clockwise', { rotateDeg: 180, enableTransition: false })"><RefreshRight /></el-icon>
            <el-icon @click="actions('anticlockwise')"><RefreshLeft /></el-icon>
            <el-icon @click="reset"><Refresh /></el-icon>
            <el-icon @click="downloadFile(activeIndex)"><i-ven-icon-widget-form-image-uploader-download  class="custom-btn-icon"/></el-icon>
          </template>
        </el-image-viewer>

      </div>
      <div class="value" :class="{'mobile': isMobileDevice}" v-if="placeholderVisible">{{ i18next.t('noContent') }}</div>
    </b2-form-element>
  </div>
</template>

<script lang="ts" setup>
import { diskSize } from "@common/utils/other";
import { useWidget } from "@renderer/b2/types";
import { REPORT_ID } from "@renderer/types/inject";
import {
  ref,
  inject,
  onMounted,
  watch,
  onBeforeUnmount,
  onUnmounted,
  computed,
  nextTick,
} from "vue";
import {
  ElMessage,
  UploadFile,
  UploadInstance,
  UploadProps,
} from "element-plus";
import { ImageUploader, CustomUploadFile } from "./imageUploader";
import { Uploader } from "@renderer/widgets/form/uploader/uploader";
import { Download, Delete, CircleClose, ArrowDown, ArrowUp, Back, DArrowRight, Refresh, RefreshLeft, RefreshRight, Right, ZoomIn, ZoomOut, Upload, CircleCloseFilled } from "@element-plus/icons-vue";
import IVenIconUpload from "~icons/ven-icon/widget-form-image-uploader-upload";
import IVenIconDelete from "~icons/ven-icon/widget-form-image-uploader-delete";
import IVenIconDownload from "~icons/ven-icon/widget-form-image-uploader-download";
import IVenIconUnion from "~icons/ven-icon/widget-form-image-uploader-union";
import { CellImage } from "../_common/table/index"
import Draggable from 'vuedraggable'
import type { Sortable } from 'sortablejs'
import { isMobile } from '@renderer/utils/pure';
import { getUploadItemKey } from "../uploader/uploadItem";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const uploader = useWidget<Uploader>();
const uploadFile = uploader.uploadFile;

const reportId = inject(REPORT_ID);
const widget = useWidget<ImageUploader>();
const uploadRef = ref<UploadInstance>();
widget.reportId = reportId;

const dialogImageUrl = ref("");
const dialogVisible = ref(false);
const isImageViewerVisible = ref(false);
const activeImageIndex = ref(0);

const imageUploaderWidgetRef = ref()
const cellImageRef = ref();
const dropPaneVisible = ref(false)
const drag = ref(false)

const uploadButtonText = computed(() => {
  if (widget.isOnlyCamera) {
    return i18next.t('clickUpload');
  }
  return i18next.t('uploadImage');
})

const uploadButtonAppendText = computed(() => {
  if (widget.isOnlyCamera) {
    return i18next.t('cameraOnly');
  } else {
    if (widget.fileListType !== 'text' && !widget.isInSubForm) {
      return i18next.t('dragPastePlain');
    } else {
      return i18next.t('dragPaste');
    }
  }
})

// 是否显示已上传列表
const isShowUploadedList = computed(() => {
  // 移动端
  if (isMobileDevice) {
    if (widget.fileListType === 'picture' || widget.fileListType === 'text') {
      return true;
    }
  }
  // PC
  else {
    if (!widget.isInSubForm) {
      return true;
    }
  }
  return false;
});

const imageList = computed<any[]>({
  get: () => widget.fileList,
  set: (value) => { widget.fileList = value }
})

const placeholderVisible = computed(() => {
  return widget.isReadonly && !imageList.value?.length;
})
const showUploadBox = computed(() => {
  // // 是 isInSubForm 直接不展示
  // if (widget.isInSubForm) return false
  // 不是编辑 直接不展示
  if (widget.isReadonly) return false
  return true
})

const showDropPane = () => {
  dropPaneVisible.value = !dropPaneVisible.value
}

const downloadFile = (file: UploadFile | number): void => {
  if (typeof file === "number") file = imageList.value[file] as UploadFile;
  if (!file) return;

  fetch(file.url)
    .then((response) => response.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(blobUrl);
      link.remove();
    });
};

const dragOptions = computed(()=>{
  return {
    animation: 200,
    group: "description",
    disabled: widget.isReadonly,
    ghostClass: "ghost"
  }
})
const onStart = () => {
  drag.value = true
}
const getImageItemKey = (file) => {
  return getUploadItemKey(file, imageList.value.findIndex((item) => item === file));
}
const onEnd = (event: Sortable.SortableEvent) => {
  drag.value = false
  const newIndex = event.newIndex
  const oldIndex = event.oldIndex

  // 拖拽移动数据
  uploader.MoveValue(oldIndex, newIndex)
}

const handlePictureCardPreview: UploadProps["onPreview"] = (uploadFile) => {
  dialogImageUrl.value = uploadFile.url!;
  dialogVisible.value = true;
  isImageViewerVisible
};

const openImageViewer = (index: number): void => {
  activeImageIndex.value = index;
  isImageViewerVisible.value = true;
};

const triggerUpload = () => {
  if(widget.isEditable) {
    return
  }
  if (!isMobileDevice && widget.isCameraUploadDisabled) {
    ElMessage.error(i18next.t('noCamera'));
    return;
  }
  // cellImageRef.value?.changePopoverVisible(false);
  if (uploadRef.value) {
    const triggerEl = uploadRef.value?.$el?.querySelector('.el-upload__input');
    if (triggerEl) {
      triggerEl.click();
    } else {
      uploadRef.value?.submit();
    }
  }
};

const isFocus = ref(false)

const handlePaste = (e) => {
  if(!isFocus.value || widget.isEditable || widget.isOnlyCamera) {
    return
  }
  const items = e.clipboardData.items
  const filteredItems = []
  for(const item of items) {
    // 提取后缀部分（斜杠后面的内容）
    const ext = item.type.split('/')[1]?.toLowerCase();
    // 检查后缀是否存在于图片格式数组中
    if(imageExtensions.includes(ext)){
      filteredItems.push(item)
    }
  }
  const totalImageCount = imageList.value.length + filteredItems.length
  // 检查limit-count限制
  if (widget.getOption("limit-count")) {
    const range = widget.getOption("limit-count-range");
    if (range && totalImageCount > range[1]) {
      ElMessage.error(i18next.t('maxImageCount', { count: range[1] }));
      return;
    }
  }

  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile()
      uploadRef.value.handleStart(file)
      uploadRef.value.submit()
    }
  }
}

const setCaptureAttribute = () => {
  if (!uploadRef.value) return;
  if (!widget.isOnlyCamera) return;
  const inputEl = uploadRef.value.$el.querySelector('input[type="file"]');

  if (inputEl) {
    inputEl.setAttribute('capture', 'environment');
  }
}

const uploadImageWidgetWidth = ref()
let resizeObserver = null
let uploadImageResizeObserver = null

onMounted(async () => {
  if (widget.isOnlyCamera) {
    const stop = watch(() => uploadRef.value, (newVal, oldVal) => {
      if(newVal) {
        setCaptureAttribute();
        !isMobileDevice && widget.checkCameraAvailability();
        nextTick(() => {
          stop()
        })
      }
    })
  }
  if (imageUploaderWidgetRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const val = (entry.target as HTMLElement).offsetWidth
        uploadImageWidgetWidth.value = `${val - 20}px`
      }
    })

    resizeObserver.observe(imageUploaderWidgetRef.value)
  }

  // watch(() => widget.inputValue, () => {
  //   if (widget.inputValue) {
  //     widget.fileList = widget.inputValue.map((file) => {
  //       return {
  //         name: file.name,
  //         uid: file.uid,
  //         status: "success",
  //         size: file.size,
  //         url: file.url,
  //       };
  //     });
  //   }
  // }, {deep: true, immediate: true});

  if (!isMobileDevice) {
    setupGlobalUploadListener();
    if (widget.isInTable) {
      cellImageRef.value?.show();
    }
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  cleanupGlobalListeners();
})

// 全局监听.el-upload元素
function handleGlobalFocusIn(event) {
  // 检查事件目标是否是.el-upload或其子元素
  const uploadEl = event.target.closest('.el-upload');
  if (uploadEl) {
    isFocus.value = true;
  }
}

function handleGlobalFocusOut(event) {
  // 检查事件目标是否是.el-upload或其子元素
  const uploadEl = event.target.closest('.el-upload');
  if (uploadEl) {
    // 延迟检查，确保新的焦点不在任何upload组件内
    setTimeout(() => {
      const activeEl = document.activeElement;
      const isStillInUpload = document.querySelector('.el-upload')?.contains(activeEl) || activeEl.closest('.el-upload');
      if (!isStillInUpload) {
        isFocus.value = false;
      }
    }, 10);
  }
}

function setupGlobalUploadListener() {
  // 监听整个document中的焦点事件，这样可以监听所有upload组件的focusin和focusout事件
  document.addEventListener('focusin', handleGlobalFocusIn, true);
  document.addEventListener('focusout', handleGlobalFocusOut, true);
}

function cleanupGlobalListeners() {
  document.removeEventListener('focusin', handleGlobalFocusIn, true);
  document.removeEventListener('focusout', handleGlobalFocusOut, true);
}

const removeFileState = (uid: number) => {
  const idx = widget.fileList.findIndex((f) => f.uid === uid);
  if (idx !== -1) {
    widget.fileList.splice(idx, 1);
  }
  widget.readyFilesNum = widget.fileList.filter(f => f.status === "ready").length;
};

const beforeUpload: UploadProps["beforeUpload"] = (rawFile) => {
  return new Promise((resolve, reject) => {
    const fileIsImage = isImage(rawFile);
    if (!fileIsImage) {
      ElMessage.error(i18next.t('uploadImageOnly'));
      removeFileState(rawFile.uid);
      return false;
    }
    if (!isMobileDevice && widget.isCameraUploadDisabled) {
      ElMessage.error(i18next.t('noCamera'));
      removeFileState(rawFile.uid);
      return false;
    }
    const totalImageCount = widget.readyFilesNum + imageList.value.length;
    // 检查limit-count限制
    if (widget.getOption("limit-count")) {
      const range = widget.getOption("limit-count-range");
      if (range && totalImageCount > range[1]) {
        ElMessage.error(i18next.t('maxImageCount', { count: range[1] }));
        removeFileState(rawFile.uid);
        return reject(false);
      }
    }
    setTimeout(() => {
      resolve(true);
    }, 100);
  });
};

const handleSuccess: UploadProps["onSuccess"] = (
  response,
  uploadFile,
  uploadFiles
) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const allFileNames = widget.fileList.filter(f => f.status === "success").map((f) => f.name);
      allFileNames.splice(allFileNames.indexOf(uploadFile.name), 1);
      // 释放本地内存
      if (uploadFile.url?.startsWith("blob:")) {
        URL.revokeObjectURL(uploadFile.url);
      }
      // 更新fileList中的对应文件
      const target: any = widget.fileList.find((f) => f.uid === uploadFile.uid);
      if (target) {
        target.status = "success";
        target.url = response.data.url;
        target.name = generateUniqueName(target.name, allFileNames);
        target.size = response.data.fileSize || uploadFile.size;
        delete target.previewUrl;
        target['loading'] = false;
      }

      widget.inputValue = widget.fileList.map((f: CustomUploadFile) => {
        if(f.status === "success") {
          if (f.raw) {
            return {
              name: f.name,
              uid: f.uid,
              status: f.status,
              size: f.size,
              url: f.response?.data.url,
              previewUrl: URL.createObjectURL(f.raw),
            }
          } else {
            return f;
          }
        }
        return null
      }).filter(Boolean);

      nextTick(() => {
        widget.validate()
      })
    }, 700);
  });
};

// 生成唯一文件名（处理重名）
const generateUniqueName = (originalName, allNames) => {
  let newName = originalName;
  let counter = 0;

  // 提取文件名和扩展名（如 "image.jpg" → "image" 和 ".jpg"）
  const dotIndex = originalName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? originalName?.substring(0, dotIndex) : originalName;
  const extension = dotIndex > 0 ? originalName?.substring(dotIndex) : "";

  // 有重名才进入
  if (allNames.includes(newName)) {
    // 检查并递增数字后缀
    allNames.forEach((nameItem: string) => {
      if (nameItem && nameItem.indexOf(baseName) !== -1) {
        counter++;
      }
    });
  }

  if (counter > 0) {
    newName = `${baseName}_${counter}${extension}`;
  }

  return newName;
};

const imageExtensions = [
  "bmp",
  "jpg",
  "jpeg",
  "png",
  "tif",
  "gif",
  "pcx",
  "tga",
  "exif",
  "fpx",
  "svg",
  "psd",
  "cdr",
  "pcd",
  "dxf",
  "ufo",
  "eps",
  "ai",
  "raw",
  "WMF",
  "webp",
  "avif",
  "apng",
];
const isImage = (file) => {
  if (file.type) {
    return file.type.startsWith("image/");
  }
  const fileName = file.name || "";
  const fileExtension = "." + fileName.split(".").pop().toLowerCase();
  return imageExtensions.includes(fileExtension);
};

const handleProgress: UploadProps["onProgress"] = (event, uploadFile: UploadFile) => {
  uploadFile.percentage = Math.min(event.percent, uploadFile.percentage + 1);
  if (uploadFile.percentage === 100) {
    (uploadFile as any).loading = false;
  } else {
    (uploadFile as any).loading = true;
  }
};

const handleChange: UploadProps["onChange"] = (file, fileList) => {};

watch(() => {
  return widget.fileList.filter((f: any) => ["ready", 'uploading'].includes(f.status) || f.loading).length
}, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    widget.readyFilesNum = newVal;
  }
}, {deep: true})
</script>
<style lang="scss" scoped>
// 移动端
.mobile-image-card-uploader {
  .mobile-file-item {
    width: 100%;
    height: 100%;
    position: relative;
    .el-upload-list__item-thumbnail {
      object-fit: cover;
      cursor: pointer;
    }
  }

  .mobile-file-delete {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    .el-icon {
      width: 16px;
      height: 16px;
      font-size: 18px;
      border-radius: 50%;
      color: rgba(0, 0, 0, 0.5);
    }
  }

  // 上传触发器样式
  .mobile-upload-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--el-text-color-regular);
    font-size: 14px;
    line-height: 1.2;
    gap: 4px;

    .el-icon {
      font-size: 16px;
    }
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1;
    .loading-text {
      color: #fff;
      font-size: 14px;
    }
  }

  :deep(.el-upload-list) {
    gap: 8px;
  }

  &.hide-upload-box {
    :deep(.el-upload--picture-card) {
      display: none;
    }
  }
  :deep(.el-upload--picture-card) {
    border: 1px solid var(--el-border-color-darker);
    background: none;
  }
  :deep(.el-upload-list--picture-card .el-upload-list__item),
  :deep(.el-upload--picture-card) {
    --el-upload-picture-card-size: 108px;
    width: 108px;
    height: 108px;
    margin: 0;
  }
  // 移除默认的关闭按钮
  :deep(.el-upload-list__item .el-icon--close) {
    display: none;
  }
}

// 只读
.value {
  display: flex;
  height: 32px;
  align-items: center;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 0 8px;
  line-height: 20px;
  color: var(--text-color-inactive);
}

.custom-btn-icon {
  fill: #4E5969;
}

.image-uploader-widget {
  --list-item-width: 360px;
  min-width: v-bind("widget.isEditable ? 'unset' : 'clac(var(--list-item-min-width) + 10px)'");
  :deep(.background) {
    --bg-color-overlay: v-bind("widget.isInSubForm ? '#fff' : 'var(--bg-color-overlay)'");
  }
  :deep(.b2widget) {
    width: 100% !important;
  }
}
.img-preview {
  --list-item-width: 360px;
  --list-item-min-width: v-bind("widget.isEditable ? 'unset' : 'clac(var(--list-item-min-width) + 10px)'");
  // --list-item-min-width: 300px;
  // --list-item-max-width: 450px;
  --list-item-max-width: 100%;
  // --card-item-width: calc(25% - 16px);
  --card-item-width: 144px;
  --card-item-min-width: 100px;
  --card-item-max-width: 200px;
  &.img-preview-Move {
    .el-upload-list__item {
      cursor: move;
    }
  }

  :deep(.el-upload) {
    width: 100%;
    justify-content: flex-start;
    pointer-events: none;

    .el-upload-dragger {
      pointer-events: none;
      height: 32px;
      width: var(--list-item-width);
      max-width: var(--list-item-max-width);
      min-width: var(--list-item-min-width);
      border-radius: 4px;
      color: var(--text-color-regular);
      padding: 0px;
    }

    &:focus .upload-container .upload-button .upload-span{
      color: var(--color-primary);
      .custom-btn-icon {
        fill: var(--color-primary);
      }
    }
  }

  .upload-container {
    pointer-events: all;
    height: 100%;
    width: 100%;
    max-width: var(--list-item-max-width);
    border: none;
    border-radius: 4px;
    color: var(--text-color-regular);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: var(--cursor-default);

    .upload-button .upload-span{
      color: var(--color-primary);
      .custom-btn-icon {
        fill: var(--color-primary);
      }
    }
  }

  .upload-button {
    display: flex;
    align-items: center;
    justify-content: center;

    .upload-span {
      cursor: var(--cursor-pointer);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      text-wrap: nowrap;
      line-height: 22px;
      color: #4E5969;
    }
  }

  :deep(.el-upload-list) {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;

    .el-upload-list__item {
      width: var(--list-item-width);
      max-width: var(--list-item-max-width);
      transition: none !important;
      margin: 0;
    }
  }

  .preview-img-list {
    overflow: hidden;
    height: 66px;
    padding: 8px;
    display: flex;
    background-color: #fff;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    position: relative;

    &:hover {
      border: 1px solid #C9CDD4;
    }

    :deep(.el-loading-mask) {
      height: 100%;
      .el-loading-spinner {
        top: calc(50% + 5px);
        .circular {
          width: 20px;
          height: 20px;
        }
      }
    }
    .loading-progress {
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      position: absolute;
      top: 0;
      left: 0;
      z-index: 100;
      transition: height 0.5s ease;
      span {
        position: absolute;
        left: calc(50% - 10px);
        top: 34px;
        color: var(--color-primary);
      }
    }

    .image-thumbnail {
      width: 48px;
      height: 48px;
      object-fit: cover;
      margin-right: 16px;
      border-radius: 2px;
      background-position: center;
      background-color: var(--bg-color-overlay);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .image-data {
      height: 100%;
      width: calc(100% - 64px);
      position: relative;
      .image-name {
        width: 100%;
        // white-space: nowrap;
        // overflow: hidden;
        // text-overflow: ellipsis;
        line-height: 20px;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        .img-name-val{
          max-width: calc(100% - 30px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: inline-block;
        }
        .img-suffix {
          display: inline-block;
          width: 30px;
        }
      }
      .image-size {
        color: var(--el-color-info);
        font-size: 12px;
        line-height: 20px;
        height: 24px;
      }

      .file-loading {
        position: relative;
        width: 100%; // 父容器宽度
        height: 4px; // 进度条高度
        background-color: rgba(0,0,0,0.1); // 进度条背景
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 4px;

        .loading {
          height: 100%;
          width: 0%; // 初始宽度
          background-color: var(--color-primary); // 进度条颜色
          transition: width 0.3s ease; // 动画平滑
          border-radius: 3px 0 0 3px;
        }

        span {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
          color: var(--text-color-primary);
          margin-left: 8px;
        }
      }
    }

    .btn-delete {
      display: none;
      position: absolute;
      right: 8px;
      bottom: 8px;
      &.show {
        display: block;
      }

      .el-button {
        margin-left: 8px;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        &:hover {
          background-color: #F2F3F5;
        }
      }
    }
    &:hover .btn-delete {
      display: block;
    }

    :deep(.el-progress) {
      position: absolute !important;
      width: 100%;
      height: 6px;
      top: unset;
      bottom: 0;
      left: 0;
    }
  }

  &.card-img-preview {
    position: relative;
    :deep(.el-upload-dragger) {
      // width: var(--card-item-width);
      width: 144px;
      height: 144px;
      min-width: var(--card-item-min-width);
      max-width: var(--card-item-max-width);
      aspect-ratio: 1/1;
      // height: auto !important;
    }

    .upload-button {
      display: block;
    }

    :deep(.el-upload-list) {
      gap: 16px;

      .el-upload-list__item {
        width: var(--card-item-width);
        min-width: var(--card-item-min-width);
        max-width: var(--card-item-max-width);
        margin: 0;
      }
    }

    .preview-img-list {
      overflow: hidden;
      height: auto;
      padding: 0px;
      flex-direction: column;

      .loading-progress {
        span {
          top: 120px;
        }
      }
      .image-thumbnail {
        width: 100%;
        aspect-ratio: 1/1;
        height: auto !important;
        object-fit: contain;
        margin-right: 0;
        border-radius: 0;
      }

      .image-data {
        height: 56px;
        width: 100%;
        padding: 4px 8px;
        background-color: #fff;
        .image-name .img-name-val{
          max-width: 100%;
        }
      }

      .btn-delete {
        right: 8px;
        bottom: 8px;
      }
    }
  }

  &.list-in-subform {
    height: 32px;
    margin-top: 0 !important;

    &.mobile {
      height: auto;
    }

    .upload-button {
      width: calc(100%);
      height: 32px;
      min-width: 78px;
      margin: 0px 8px;
    }
  }

  .wrap-cell-image {
    pointer-events: all;
    width: 100%;

    :deep(.image-preview-toolbar) {
      height: 32px;
    }
  }
}

:deep(.isEdit) {
  .el-upload:focus {
    .el-upload-dragger {
      border-color: var(--el-border-color) !important;
    }
  }

  .el-upload:hover {
    .el-upload-dragger {
      border-color: var(--el-border-color) !important;
    }
  }

  .upload-container {
    cursor: pointer !important;

    .upload-span {
      cursor: pointer !important;
    }
  }
}

.drop-drown-subform {
  --list-item-width: calc(50% - 16px);
  --list-item-min-width: 300px;
  --list-item-max-width: 450px;
  --card-item-width: calc(25% - 16px);
  --card-item-min-width: 100px;
  --card-item-max-width: 200px;
  width: 100%;

  :deep(.el-upload) {
    // width: var(--list-item-width);
    justify-content: flex-start;
    pointer-events: none;
    border-radius: 4px;
    .el-upload-dragger {
      pointer-events: none;
      height: 32px;
      width: var(--list-item-width);
      max-width: var(--list-item-max-width);
      border-radius: 4px;
      color: var(--text-color-regular);
      padding: 0px;
    }

    &:hover .upload-button .custom-btn-icon {
      fill: var(--color-primary);
    }
  }

  &.is-in-subform {
    height: 32px;

    .img-preview {
      height: 100%;

      :deep(.el-upload) {
        width: 100%;
        height: 100%;
        border-radius: 4px;

        .image-preview-toolbar {
          height: 100%;

          .el-image, .el-button {
            pointer-events: all;
          }
        }
      }
    }
  }

  .upload-button {
    pointer-events: all;
    width: calc(100%);
    height: 32px;
    min-width: 0;
    border-radius: 4px;
  }
  .upload-container {
    pointer-events: all;
    height: 100%;
    width: 100%;
    max-width: var(--list-item-max-width);
    border: none;
    border-radius: 4px;
    color: var(--text-color-regular);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: var(--cursor-default);

    &:hover .upload-button .upload-span{
      color: var(--color-primary);
      .custom-btn-icon {
        fill: var(--color-primary);
      }
    }
  }

  .preview-img-list {
    position: relative;
    overflow: hidden;
    height: 66px;
    padding: 8px;
    display: flex;
    background-color: #fff;
    border: 1px solid var(--border-color);
    border-radius: 4px;

    &:hover {
      border: 1px solid #C9CDD4;
    }
    // &:hover .image-name {
    //   color: var(--color-primary);
    // }

    :deep(.el-progress) {
      position: absolute !important;
      width: 100%;
      height: 6px;
      top: unset;
      bottom: 0;
      left: 0;
    }

    .image-thumbnail {
      width: 48px;
      height: 48px;
      object-fit: cover;
      margin-right: 16px;
      border-radius: 2px;
      display: flex;
      align-items: center;
      background-color: var(--bg-color-overlay);
      justify-content: center;
    }
    .image-data {
      height: 100%;
      width: calc(100% - 64px);
      .image-name {
        width: 100%;
        // white-space: nowrap;
        // overflow: hidden;
        // text-overflow: ellipsis;
        line-height: 20px;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        .img-name-val{
          max-width: calc(100% - 30px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: inline-block;
        }
        .img-suffix {
          display: inline-block;
          width: 30px;
        }
      }
      .image-size {
        color: var(--el-color-info);
        font-size: 12px;
        line-height: 20px;
        height: 24px;
      }
    }

    &:hover .btn-delete {
      display: block;
    }
    .btn-delete {
      display: none;
      position: absolute;
      right: 8px;
      bottom: 8px;
      .el-button {
        margin-left: 8px;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        &:hover {
          background-color: #F2F3F5;
        }
      }
    }
  }

  .preview-img-drop-down {
    .img-drop-down-btn {
      height: 32px;
      width: 100%;
      // min-width: var(--list-item-min-width);
      max-width: var(--list-item-max-width);
      border: 1px dashed var(--border-color);
      border-radius: 4px;
      padding: 8px;
      position: relative;
      .small-img-preview {
        width: calc(100% - 80px);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .el-icon {
        position: absolute;
        right: 8px;
        top: 8px;
      }
    }
    .img-view-pane {
      width: 100%;
      // min-width: var(--list-item-min-width);
      max-width: var(--list-item-max-width);
      max-height: 392px;
      padding: 16px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      margin-top: 4px;
      box-shadow: 0px 6px 6px 0px #0000001A;
      :deep(.el-upload) {
        width: 100%;
        justify-content: flex-start;
        pointer-events: none;
        .el-upload-dragger {
          margin-bottom: 16px;
        }
      }
      .img-list-preview {
        overflow: hidden;
        max-height: 312px;
        width: calc(100% + 8px);
        .preview-img-list {
          margin-bottom: 8px;
          margin-right: 8px;
          position: relative;
        }
      }
    }
  }
}

.image-uploader-container.mobile {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;

  .upload-list-wrapper {
    :deep(.el-upload-list) {
      margin-top: 0;
      gap: 8px;
      .el-upload-list__item {
        background: none;
        min-width: 0;
        width: calc(100% - 10px);
      }
      .preview-img-list {
        background: none;
        border-radius: 4px;
        img {
          border-radius: 4px;
        }
        .btn-delete {
          display: block !important;
        }
      }
    }
  }

  .upload-button-wrapper {
    width: 100%;
    height: 44px;
    :deep(.el-upload-dragger) {
      width: 100%;
      height: 44px;
      border: 1px solid var(--el-border-color);
      .upload-button {
        width: 100%;
        height: 100%;
      }
      .upload-span {
        width: 100%;
        height: 100%;
        font-size: 14px;
        color: var(--el-text-color-regular);
      }
    }
  }

  .preview-img-drop-down {
    .img-drop-down-btn {
      height: 44px;
      width: var(--list-item-width);
      min-width: var(--list-item-min-width);
      max-width: var(--list-item-max-width);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 4px;
      position: relative;
      .small-img-preview {
        width: calc(100% - 80px);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        .image-thumbnail .image-thumbnail-default {
          height: 36px;
          width: 36px;
          background-color: #F5F5F7;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
      .el-icon {
        position: absolute;
        right: 14px;
        top: 14px;
      }
    }

    .img-view-pane {
      width: var(--list-item-width);
      min-width: var(--list-item-min-width);
      max-width: var(--list-item-max-width);
      max-height: 392px;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      margin-top: 4px;
      box-shadow: 0px 6px 6px 0px #0000001A;
      :deep(.el-upload) {
        width: 100%;
        height: 44px;
        justify-content: flex-start;
        pointer-events: none;
        margin-bottom: 16px;
        .el-upload-dragger {
          height: 44px;
          border: 1px solid var(--border-color);
        }
      }

      .img-list-preview {
        overflow: hidden;
        max-height: 312px;
        width: calc(100% + 8px);
        .preview-img-list {
          margin-bottom: 8px;
          margin-right: 8px;
          height: 64px;
          display: flex;
          position: relative;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          &:hover {
            border-color: var(--el-border-color-hover);
          }

          .image-thumbnail {
            width: 48px;
            height: 48px;
            object-fit: cover;
            margin-right: 16px;
            border-radius: 2px;
            background-position: center;
            background-color: var(--bg-color-overlay);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .image-data {
            height: 100%;
            width: calc(100% - 64px);
            position: relative;
            .image-name {
              width: 100%;
              line-height: 20px;
              margin-bottom: 4px;
              display: flex;
              align-items: center;
              justify-content: flex-start;
              .img-name-val{
                max-width: calc(100% - 30px);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: inline-block;
              }
              .img-suffix {
                display: inline-block;
                width: 30px;
              }
            }
            .image-size {
              color: var(--el-color-info);
              font-size: 12px;
              line-height: 20px;
              height: 24px;
            }

            .file-loading {
              position: relative;
              width: 100%; // 父容器宽度
              height: 4px; // 进度条高度
              background-color: rgba(0,0,0,0.1); // 进度条背景
              border-radius: 3px;
              overflow: hidden;
              margin-bottom: 4px;

              .loading {
                height: 100%;
                width: 0%; // 初始宽度
                background-color: var(--color-primary); // 进度条颜色
                transition: width 0.3s ease; // 动画平滑
                border-radius: 3px 0 0 3px;
              }

              span {
                position: absolute;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                font-size: 12px;
                color: var(--text-color-primary);
                margin-left: 8px;
              }
            }
          }

          .btn-delete {
            display: block;
            position: absolute;
            right: 8px;
            bottom: 8px;
            &.show {
              display: block;
            }

            .el-button {
              margin-left: 8px;
              width: 24px;
              height: 24px;
              border-radius: 4px;
              &:hover {
                background-color: #F2F3F5;
              }
            }
          }

          :deep(.el-progress) {
            position: absolute !important;
            width: 100%;
            height: 6px;
            top: unset;
            bottom: 0;
            left: 0;
          }
        }
      }
    }
  }
}

.value.mobile {
  height: 44px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 44px;
}

.button-append-text {
  color: var(--text-color-secondary);
  text-wrap: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

</style>

