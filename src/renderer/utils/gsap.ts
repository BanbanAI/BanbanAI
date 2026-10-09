import gsap from 'gsap';

export type FromObj = {
  [key: string]: any
}

export type ToObj = {
  [key: string]: any,
  duration: number, 
  onUpdate?: () => void,
}

export const gsapTo = async (fromObj: FromObj, toObj: ToObj): Promise<void> => {
  return new Promise( (resolve) => {
    gsap.to(fromObj, {
      ...toObj,
      onComplete: () => {
        resolve();
      }
    });
  })
}

type InterpolateValue = number | Array<InterpolateValue>;
/**
 * 插值函数
 * @param start 
 * @param end 
 * @param progress 0~1之间的数字
 * @returns 
 */
export const interpolateValues = (start: InterpolateValue, end: InterpolateValue, progress: number) => {
  if (Array.isArray(start) && Array.isArray(end)) {
    // 如果是数组，则递归处理每个元素
    return start.map((val, i) => interpolateValues(val, end[i], progress));
  } else if (typeof start === 'number' && typeof end === 'number') {
    // 如果是数字，则进行插值计算
    return start + (end - start) * progress;
  } else {
    // start 或 end 是undefined之类的
    return end; 
  }
}