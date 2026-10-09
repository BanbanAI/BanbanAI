<template>
    <transition name="viewer-fade">
        <div
            ref="wrapper"
            :tabindex="-1"
            class="el-image-viewer__wrapper"
            :style="{ zIndex }"
        >
            <div
                class="el-image-viewer__mask"
                @click.self="hideOnClickModal && hide()"
            ></div>
            <!-- CLOSE -->
            <span
                class="el-image-viewer__btn el-image-viewer__close"
                @click="hide"
            >
                <el-icon>
                    <i-ep-close></i-ep-close>
                </el-icon>
            </span>
            <!-- ARROW -->
            <template v-if="!isSingle">
                <span
                    class="el-image-viewer__btn el-image-viewer__prev"
                    :class="{ 'is-disabled': !infinite && isFirst }"
                    @click="prev"
                >
                    <el-icon>
                        <i-ep-arrow-left></i-ep-arrow-left>
                    </el-icon>
                </span>
                <span
                    class="el-image-viewer__btn el-image-viewer__next"
                    :class="{ 'is-disabled': !infinite && isLast }"
                    @click="next"
                >
                    <el-icon>
                        <i-ep-arrow-right></i-ep-arrow-right>
                    </el-icon>
                </span>
            </template>
            <!-- ACTIONS -->
            <div
                v-if="isImage(currentMedia) && false"
                class="el-image-viewer__btn el-image-viewer__actions"
            >
                <div class="el-image-viewer__actions__inner">
                    <el-icon @click="handleActions('zoomOut')">
                        <i-ep-zoom-out></i-ep-zoom-out>
                    </el-icon>
                    <el-icon @click="handleActions('zoomIn')">
                        <i-ep-zoom-in></i-ep-zoom-in>
                    </el-icon>
                    <el-icon @click="toggleMode">
                        <i-ep-delete></i-ep-delete>
                    </el-icon>
                    <el-icon @click="handleActions('anticlocelise')">
                        <i-ep-refresh-left></i-ep-refresh-left>
                    </el-icon>
                    <el-icon @click="handleActions('clocelise')">
                        <i-ep-refresh-right></i-ep-refresh-right>
                    </el-icon>
                </div>
            </div>
            <!-- CANVAS -->
            <div class="el-image-viewer__canvas">
              <template v-for="(url, i) in urlList" :key="url">
                  <img
                    v-if="isImage(url)"
                    v-show="i === index"
                    ref="media"
                    :src="url"
                    :style="mediaStyle"
                    class="el-image-viewer__img"
                    @load="handleMediaLoad"
                    @error="handleMediaError"
                    @mousedown="handleMouseDown"
                  />
                  <video
                    v-if="isVideo(url)"
                    controls="controls"
                    v-show="i === index"
                    ref="media"
                    :src="url"
                    :style="mediaStyle"
                    class="el-image-viewer__img"
                    @load="handleMediaLoad"
                    @error="handleMediaError"
                    @mousedown="handleMouseDown"
                    :autoplay="autoplay"
                  ></video>
                  <iframe
                    v-if="isPDF(url)"
                    v-show="i === index"
                    :src="url + '#scrollbars=0&statusbar=0&view=FitH,top'"
                    width="80%" 
                    height="80%"
                    style="z-index: 0;"
                  ></iframe>
              </template>
            </div>
        </div>
    </transition>
</template>

<script>
import { ElMessage } from 'element-plus'
import i18next from 'i18next'
import { computed, ref, onMounted, watch, nextTick } from 'vue'

const EVENT_CODE = {
    tab: 'Tab',
    enter: 'Enter',
    space: 'Space',
    left: 'ArrowLeft', // 37
    up: 'ArrowUp', // 38
    right: 'ArrowRight', // 39
    down: 'ArrowDown', // 40
    esc: 'Escape',
    delete: 'Delete',
    backspace: 'Backspace',
}

const isFirefox = function () {
    return !!window.navigator.userAgent.match(/firefox/i)
}

const rafThrottle = function (fn) {
    let locked = false
    return function (...args) {
        if (locked) return
        locked = true
        window.requestAnimationFrame(() => {
            fn.apply(this, args)
            locked = false
        })
    }
}

const Mode = {
    CONTAIN: {
        name: 'contain',
        icon: 'el-icon-full-screen',
    },
    ORIGINAL: {
        name: 'original',
        icon: 'el-icon-c-scale-to-original',
    },
}

const mousewheelEventName = isFirefox() ? 'DOMMouseScroll' : 'mousewheel'
const CLOSE_EVENT = 'close'
const SWITCH_EVENT = 'switch'

export default {
    name: 'MediaViewer',
    props: {
        urlList: {
            type: Array,
            default: () => [],
        },
        zIndex: {
            type: Number,
            default: 2000,
        },
        initialIndex: {
            type: Number,
            default: 0,
        },
        infinite: {
            type: Boolean,
            default: true,
        },
        hideOnClickModal: {
            type: Boolean,
            default: false,
        },
        autoplay: {
            type: Boolean,
            default: false,
        }
    },
    emits: [CLOSE_EVENT, SWITCH_EVENT],
    setup(props, { emit }) {
        let _keyDownHandler = null
        let _mouseWheelHandler = null
        let _dragHandler = null

        const loading = ref(true)
        const index = ref(props.initialIndex)
        const wrapper = ref(null)
        const media = ref(null)
        const previewPdfRef = ref(null)
        const mode = ref(Mode.CONTAIN)
        const transform = ref({
            scale: 1,
            deg: 0,
            offsetX: 0,
            offsetY: 0,
            enableTransition: false,
        })

        const isSingle = computed(() => {
            const { urlList } = props
            return urlList.length <= 1
        })

        const isFirst = computed(() => {
            return index.value === 0
        })

        const isLast = computed(() => {
            return index.value === props.urlList.length - 1
        })

        const isVideo = url => {
          const videoExtenstions = [
              ".mp4",
              ".avi",
              ".mov",
              ".rmvb",
              ".mkv",
              ".wmv",
              ".flv",
              ".avchd",
              ".webm"
          ]
          return videoExtenstions.some(ext => url.toLowerCase().endsWith(ext))
        }
        const isImage = url => {
            const imageExtensions = [
                ".bmp",
                ".jpg",
                ".jpeg",
                ".png",
                ".tif",
                ".gif",
                ".pcx",
                ".tga",
                ".exif",
                ".fpx",
                ".svg",
                ".psd",
                ".cdr",
                ".pcd",
                ".dxf",
                ".ufo",
                ".eps",
                ".ai",
                ".raw",
                ".WMF",
                ".webp",
                ".avif",
                ".apng",
            ];
          return imageExtensions.some(ext => url.toLowerCase().endsWith(ext))
        }
        const isPDF = url => {
          const pdfExtenstions = ['.pdf']
          return pdfExtenstions.some(ext => url.toLowerCase().endsWith(ext))
        }
        const currentMedia = computed(() => {
            return props.urlList[index.value];
        })

        const mediaStyle = computed(() => {
            const { scale, deg, offsetX, offsetY, enableTransition } =
                transform.value
            const style = {
                transform: `scale(${scale}) rotate(${deg}deg)`,
                transition: enableTransition ? 'transform .3s' : '',
                marginLeft: `${offsetX}px`,
                marginTop: `${offsetY}px`,
            }
            if (mode.value.name === Mode.CONTAIN.name) {
                style.maxWidth = style.maxHeight = '100%'
            }
            return style
        })

        function hide() {
            deviceSupportUninstall()
            emit(CLOSE_EVENT)
        }

        function deviceSupportInstall() {
            _keyDownHandler = rafThrottle((e) => {
                switch (e.code) {
                    // ESC
                    case EVENT_CODE.esc:
                        hide()
                        break
                    // SPACE
                    case EVENT_CODE.space:
                        toggleMode()
                        break
                    // LEFT_ARROW
                    case EVENT_CODE.left:
                        prev()
                        break
                    // UP_ARROW
                    case EVENT_CODE.up:
                        handleActions('zoomIn')
                        break
                    // RIGHT_ARROW
                    case EVENT_CODE.right:
                        next()
                        break
                    // DOWN_ARROW
                    case EVENT_CODE.down:
                        handleActions('zoomOut')
                        break
                }
            })

            _mouseWheelHandler = rafThrottle((e) => {
                const delta = e.wheelDelta ? e.wheelDelta : -e.detail
                if (delta > 0) {
                    handleActions('zoomIn', {
                        zoomRate: 0.015,
                        enableTransition: false,
                    })
                } else {
                    handleActions('zoomOut', {
                        zoomRate: 0.015,
                        enableTransition: false,
                    })
                }
            })

            document.addEventListener('keydown', _keyDownHandler, false)
            document.addEventListener(
                mousewheelEventName,
                _mouseWheelHandler,
                false
            )
        }

        function deviceSupportUninstall() {
            document.removeEventListener('keydown', _keyDownHandler, false)
            document.removeEventListener(
                mousewheelEventName,
                _mouseWheelHandler,
                false
            )
            _keyDownHandler = null
            _mouseWheelHandler = null
        }

        function handleMediaLoad() {
            loading.value = false
        }

        function handleMediaError() {
            loading.value = false
            const url = currentMedia.value || ''
            if (isVideo(url)) {
                ElMessage.error(i18next.t('tableMediaViewer.unsupportedVideo'))
                return
            }
            ElMessage.error(i18next.t('tableMediaViewer.previewFailed'))
        }

        function handleMouseDown(e) {
            if (loading.value || e.button !== 0) return

            const { offsetX, offsetY } = transform.value
            const startX = e.pageX
            const startY = e.pageY

            const divLeft = wrapper.value.clientLeft
            const divRight =
                wrapper.value.clientLeft + wrapper.value.clientWidth
            const divTop = wrapper.value.clientTop
            const divBottom =
                wrapper.value.clientTop + wrapper.value.clientHeight

            _dragHandler = rafThrottle((ev) => {
                transform.value = {
                    ...transform.value,
                    offsetX: offsetX + ev.pageX - startX,
                    offsetY: offsetY + ev.pageY - startY,
                }
            })
            document.addEventListener('mousemove', _dragHandler, false)
            document.addEventListener(
                'mouseup',
                (e) => {
                    const mouseX = e.pageX
                    const mouseY = e.pageY
                    if (
                        mouseX < divLeft ||
                        mouseX > divRight ||
                        mouseY < divTop ||
                        mouseY > divBottom
                    ) {
                        reset()
                    }
                    document.removeEventListener(
                        'mousemove',
                        _dragHandler,
                        false
                    )
                },
                false
            )

            e.preventDefault()
        }

        function reset() {
            transform.value = {
                scale: 1,
                deg: 0,
                offsetX: 0,
                offsetY: 0,
                enableTransition: false,
            }
        }

        function toggleMode() {
            if (loading.value) return

            const modeNames = Object.keys(Mode)
            const modeValues = Object.values(Mode)
            const currentMode = mode.value.name
            const index = modeValues.findIndex((i) => i.name === currentMode)
            const nextIndex = (index + 1) % modeNames.length
            mode.value = Mode[modeNames[nextIndex]]
            reset()
        }

        function prev() {
            if (isFirst.value && !props.infinite) return
            const len = props.urlList.length
            index.value = (index.value - 1 + len) % len
        }

        function next() {
            if (isLast.value && !props.infinite) return
            const len = props.urlList.length
            index.value = (index.value + 1) % len
        }

        function handleActions(action, options = {}) {
            if (loading.value) return
            const { zoomRate, rotateDeg, enableTransition } = {
                zoomRate: 0.2,
                rotateDeg: 90,
                enableTransition: true,
                ...options,
            }
            switch (action) {
                case 'zoomOut':
                    if (transform.value.scale > 0.2) {
                        transform.value.scale = parseFloat(
                            (transform.value.scale - zoomRate).toFixed(3)
                        )
                    }
                    break
                case 'zoomIn':
                    transform.value.scale = parseFloat(
                        (transform.value.scale + zoomRate).toFixed(3)
                    )
                    break
                case 'clocelise':
                    transform.value.deg += rotateDeg
                    break
                case 'anticlocelise':
                    transform.value.deg -= rotateDeg
                    break
            }
            transform.value.enableTransition = enableTransition
        }
        
        watch(currentMedia, () => {
            nextTick(() => {
                const $media = media.value
                if (!$media.complete) {
                    loading.value = true
                }
            })
        })

        watch(index, (val) => {
            reset()
            emit(SWITCH_EVENT, val)
        })

        onMounted(() => {
            deviceSupportInstall()
            // add tabindex then wrapper can be focusable via Javascript
            // focus wrapper so arrow key can't cause inner scroll behavior underneath
            wrapper.value?.focus?.()
        })

        return {
            index,
            wrapper,
            media,
            isSingle,
            isFirst,
            isLast,
            currentMedia,
            isImage,
            isVideo,
            isPDF,
            mediaStyle,
            mode,
            handleActions,
            prev,
            next,
            hide,
            toggleMode,
            handleMediaLoad,
            handleMediaError,
            handleMouseDown,
        }
    },
}
</script>

<style scoped lang="scss">
.el-image-viewer__mask {
  z-index: 0;
}

.el-image-viewer__canvas {
  position: relative;
  z-index: 1;
}

.el-image-viewer__img,
iframe {
  position: relative;
  z-index: 1;
}

.el-image-viewer__btn {
  z-index: 2;
}
</style>
