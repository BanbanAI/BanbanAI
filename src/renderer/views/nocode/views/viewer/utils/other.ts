import { nextTick, defineAsyncComponent } from 'vue';

/**
 * 设置 自定义 tagsView 名称、 自定义 tagsView 名称国际化
 * @param params 路由 query、params 中的 tagsViewName
 * @returns 返回当前 tagsViewName 名称
 */
export function setTagsViewNameI18n(item: any) {
  let tagsViewName: string = '';
  const { query, params, meta } = item;
  // 修复tagsViewName匹配到其他含下列单词的路由
  // https://gitee.com/lyt-top/vue-next-admin/pulls/44/files
  const pattern = /^\{("(zh-cn|en|zh-tw)":"[^,]+",?){1,3}}$/;
  if (query?.tagsViewName || params?.tagsViewName) {
    if (pattern.test(query?.tagsViewName) || pattern.test(params?.tagsViewName)) {
      // 国际化
      const urlTagsParams = (query?.tagsViewName && JSON.parse(query?.tagsViewName)) || (params?.tagsViewName && JSON.parse(params?.tagsViewName));
    } else {
      // 非国际化
      tagsViewName = query?.tagsViewName || params?.tagsViewName;
    }
  }
  return tagsViewName;
}

/**
 * 图片懒加载
 * @param el dom 目标元素
 * @param arr 列表数据
 * @description data-xxx 属性用于存储页面或应用程序的私有自定义数据
 */
export const lazyImg = (el: string, arr: EmptyArrayType) => {
  const io = new IntersectionObserver((res) => {
    res.forEach((v: any) => {
      if (v.isIntersecting) {
        const { img, key } = v.target.dataset;
        v.target.src = img;
        v.target.onload = () => {
          io.unobserve(v.target);
          arr[key]['loading'] = false;
        };
      }
    });
  });
  nextTick(() => {
    document.querySelectorAll(el).forEach((img) => io.observe(img));
  });
};

/**
 * 对象深克隆
 * @param obj 源对象
 * @returns 克隆后的对象
 */
export function deepClone(obj: EmptyObjectType) {
  let newObj: EmptyObjectType;
  try {
    newObj = obj.push ? [] : {};
  } catch (error) {
    newObj = {};
  }
  for (let attr in obj) {
    if (obj[attr] && typeof obj[attr] === 'object') {
      newObj[attr] = deepClone(obj[attr]);
    } else {
      newObj[attr] = obj[attr];
    }
  }
  return newObj;
}

/**
 * 判断是否是移动端
 */
export function isMobile() {
  if (
    navigator.userAgent.match(
      /('phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone')/i
    )
  ) {
    return true;
  } else {
    return false;
  }
}

/**
 * 判断数组对象中所有属性是否为空，为空则删除当前行对象
 * @description @感谢大黄
 * @param list 数组对象
 * @returns 删除空值后的数组对象
 */
export function handleEmpty(list: EmptyArrayType) {
  const arr = [];
  for (const i in list) {
    const d = [];
    for (const j in list[i]) {
      d.push(list[i][j]);
    }
    const leng = d.filter((item) => item === '').length;
    if (leng !== d.length) {
      arr.push(list[i]);
    }
  }
  return arr;
}

/**
 * 自动滚动到指定元素
 * @param elementOrSelector 目标元素
 * @param options 滚动选项
 */
export function autoScrollToElement(elementOrSelector: HTMLElement | string, options?: ScrollIntoViewOptions) {
  if (!elementOrSelector) return;

  let targetElement: HTMLElement | null = null;

  if (typeof elementOrSelector === 'string') {
    targetElement = document.querySelector(elementOrSelector);
  } else {
    targetElement = elementOrSelector;
  }

  if (targetElement) {
    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      ...options
    });
  }
}

/**
 * 统一批量导出
 * @method elSvg 导出全局注册 element plus svg 图标
 * @method useTitle 设置浏览器标题国际化
 * @method setTagsViewNameI18n 设置 自定义 tagsView 名称、 自定义 tagsView 名称国际化
 * @method lazyImg 图片懒加载
 * @method globalComponentSize() element plus 全局组件大小
 * @method deepClone 对象深克隆
 * @method isMobile 判断是否是移动端
 * @method handleEmpty 判断数组对象中所有属性是否为空，为空则删除当前行对象
 * @method handleOpenLink 打开外部链接
 */
const other = {

};

// 统一批量导出
export default other;
