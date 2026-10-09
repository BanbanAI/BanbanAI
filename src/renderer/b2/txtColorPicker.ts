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

const TXT_COLOR_SVG = "<svg viewBox=\"0 0 1024 1024\"><path d=\"M64 864h896v96H64zM360.58 576h302.85l81.53 224h102.16L579.24 64H444.77L176.89 800h102.16l81.53-224zM512 159.96L628.49 480H395.52L512 159.96z\"></path></svg>";

class TxtColorPicker implements IDropPanelMenu {
    readonly title: string
    readonly tag: string
    readonly iconSvg: string
    readonly showDropPanel: boolean

    private panelContentElemCache: DOMElement | null = null

    constructor() {
        this.title = i18next.t('txtColorPicker.textColor')
        this.iconSvg= TXT_COLOR_SVG
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
        defaultColor.style.backgroundColor = '#333333'
        defaultColor.style.width = '20px'
        defaultColor.style.height = '20px'
        defaultColor.style.cursor = 'pointer'
        defaultColor.style.border = '1px solid #ccc'
        defaultColor.style.marginRight = '8px'
        clearBtnTxt.textContent = i18next.t('txtColorPicker.defaultColor')
        clearBtnTxt.style.fontSize = '14px'

        clearBtn.appendChild(defaultColor)
        clearBtn.appendChild(clearBtnTxt)

        clearBtn.addEventListener('click', () => {
            editor.addMark('color', '#333333')
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
        presetColors.forEach(color => {
            const swatch = document.createElement('div')
            swatch.style.width = '20px'
            swatch.style.height = '20px'
            swatch.style.backgroundColor = color
            swatch.style.cursor = 'pointer'
            swatch.style.border = '1px solid #ccc'

            swatch.addEventListener('click', () => {
                editor.addMark('color', color)
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
        inputTxt.textContent = i18next.t('txtColorPicker.customColor')

        colorInput.addEventListener('change', () => {
            const selectedColor = colorInput.value
            editor.addMark('color', selectedColor)
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

export const txtColorPickerMenu = {
    key: 'txtColorPicker', // 定义 menu key ：要保证唯一、不重复（重要）
    factory() {
        return new TxtColorPicker() // 把 `YourMenuClass` 替换为你菜单的 class
    },
}
