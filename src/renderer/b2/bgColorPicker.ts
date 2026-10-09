import {
    IDomEditor,
    IDropPanelMenu,
    SlateEditor,
    SlateElement,
    SlateNode,
    SlateText,
    SlateTransforms
} from '@wangeditor-next/editor'
import { DOMElement } from '@wangeditor-next/editor/dist/editor/src/utils/dom'
import i18next from 'i18next';

const BG_COLOR_SVG = "<svg viewBox=\"0 0 1024 1024\"><path d=\"M510.030769 315.076923l84.676923 196.923077h-177.230769l76.8-196.923077h15.753846zM945.230769 157.538462v708.923076c0 43.323077-35.446154 78.769231-78.769231 78.769231H157.538462c-43.323077 0-78.769231-35.446154-78.769231-78.769231V157.538462c0-43.323077 35.446154-78.769231 78.769231-78.769231h708.923076c43.323077 0 78.769231 35.446154 78.769231 78.769231z m-108.307692 643.938461L600.615385 216.615385c-5.907692-11.815385-15.753846-19.692308-29.538462-19.692308h-139.815385c-11.815385 0-23.630769 7.876923-27.56923 19.692308l-216.615385 584.861538c-3.938462 11.815385 3.938462 25.6 17.723077 25.6h80.738462c11.815385 0 23.630769-9.846154 27.56923-21.661538l63.015385-175.261539h263.876923l68.923077 175.261539c3.938462 11.815385 15.753846 21.661538 27.569231 21.661538h80.738461c13.784615 0 23.630769-13.784615 19.692308-25.6z\"></path></svg>";

class BgColorPicker implements IDropPanelMenu {
    readonly title: string
    readonly tag: string
    readonly iconSvg: string
    readonly showDropPanel: boolean

    private panelContentElemCache: DOMElement | null = null

    constructor() {
        this.title = i18next.t('bgColorPicker.bgColor')
        this.iconSvg= BG_COLOR_SVG
        this.tag = 'button'
        this.showDropPanel = true
    }

    isActive(editor: IDomEditor): boolean {
        return false
    }

    getValue(editor: IDomEditor): string | boolean {
        return ''
    }

    isDisabled(editor: IDomEditor): boolean {
        return false
    }

    exec(editor: IDomEditor, value: string | boolean) {
        // DropPanel menu 不需要实现
    }

    getPanelContentElem(editor: IDomEditor): DOMElement {
        if (this.panelContentElemCache) {
            return this.panelContentElemCache
        }
        const container = document.createElement('div')

        // ===== 0. 清除背景颜色按钮 =====
        const clearBtnTxt = document.createElement('div')
        const clearBtn = document.createElement('div')
        const defaultColor = document.createElement('div')
        clearBtn.style.cursor = 'pointer'
        clearBtn.style.marginBottom = '10px'
        clearBtn.style.display = 'flex'
        clearBtn.style.alignItems = 'center'
        defaultColor.innerHTML = '<svg viewBox="0 0 1024 1024" style="width: 16px; height: 16px;"><path d="M236.8 128L896 787.2V128H236.8z m614.4 704L192 172.8V832h659.2zM192 64h704c38.4 0 64 25.6 64 64v704c0 38.4-25.6 64-64 64H192c-38.4 0-64-25.6-64-64V128c0-38.4 25.6-64 64-64z"></path></svg>'
        defaultColor.style.marginRight = '8px'
        defaultColor.style.display = 'flex'
        defaultColor.style.alignItems = 'center'
        clearBtnTxt.textContent = i18next.t('bgColorPicker.noFill')
        clearBtnTxt.style.fontSize = '14px'

        clearBtn.appendChild(defaultColor)
        clearBtn.appendChild(clearBtnTxt)
        
        clearBtn.addEventListener('click', () => {
            editor.addMark('bgColor', 'transparent')
        })

        // ===== 1. 默认色卡 =====
        const presetColors = [
            '#ffffff', '#000000', '#e8e8e8', '#0e2841', '#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e',
            '#f2f2f2', '#7f7f7f', '#d0d0d0', '#dbe9f7', '#c1e4f5', '#fae2d6', '#c1f0c8', '#caedfb', '#f1ceee', '#d9f2d0',
            '#d8d8d8', '#595959', '#aeaeae', '#a6c9eb', '#83caeb', '#f6c6ac', '#84e291', '#95dcf7', '#e49edd', '#b3e5a1',
            '#bfbfbf', '#3f3f3f', '#747474', '#4d94d8', '#45b0e1', '#f1a984', '#47d45a', '#60cbf3', '#d76dcc', '#8ed873',
            '#a5a5a5', '#262626', '#3a3a3a', '#215e99', '#0f4861', '#bf4f14', '#12501b', '#0b769f', '#78206e', '#3a7d22',
            '#7f7f7f', '#0c0c0c', '#171717', '#153d64', '#0a3041', '#7f340d', '#0c3512', '#074f6a', '#501549', '#265316',
        ]
        const colorGrid = document.createElement('div')
        colorGrid.style.display = 'grid'
        colorGrid.style.gridTemplateColumns = 'repeat(10, 20px)'
        colorGrid.style.gap = '8px'
        colorGrid.style.borderRadius = '4px'
        presetColors.forEach(color => {
            const swatch = document.createElement('div')
            swatch.style.width = '20px'
            swatch.style.height = '20px'
            swatch.style.backgroundColor = color
            swatch.style.cursor = 'pointer'
            swatch.style.border = '1px solid #ccc'

            swatch.addEventListener('click', () => {
                editor.addMark('bgColor', color)
            })

            colorGrid.appendChild(swatch)
        })


        // ===== 2. 取色器 =====
        const inputContainer = document.createElement('div')
        const inputTxt = document.createElement('div')
        const colorInput = document.createElement('input')
        colorInput.type = 'color'
        colorInput.value = '#ffffff' // 默认值
        colorInput.style.width = '40px'
        colorInput.style.cursor = 'pointer'
        colorInput.style.display = 'flex'
        colorInput.style.marginRight = '8px'
        inputContainer.style.display = 'flex'
        inputContainer.style.marginTop = '10px'
        inputContainer.style.alignItems = 'center'
        inputTxt.textContent = i18next.t('bgColorPicker.customColor')

        colorInput.addEventListener('change', () => {
            const selectedColor = colorInput.value
            editor.addMark('bgColor', selectedColor)
        })

        
        inputContainer.appendChild(colorInput)
        inputContainer.appendChild(inputTxt)
        // ===== 组装到容器 =====
        container.appendChild(clearBtn)
        container.appendChild(colorGrid)
        container.appendChild(inputContainer)

        // ===== 导出容器 =====
        this.panelContentElemCache = container
        return container
    }
}

export const bgColorPickerMenu = {
    key: 'bgColorPicker', // 定义 menu key ：要保证唯一、不重复（重要）
    factory() {
        return new BgColorPicker() // 把 `YourMenuClass` 替换为你菜单的 class
    },
}
