// 当前文件放一些不依赖于任何模块的函数，包括类型

export const isCloudRender = () => {
  return (window as any).isCloudRender;
}

export const isMobile = () => {
  const userAgent = navigator.userAgent;
  if (/android/i.test(userAgent)) {
    return true;
  }
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return true;
  }
  if (/mobile|tablet|ip(ad|hone|od)|android|silk|fennec|kindle|opera m(ob|in)i|webos|blackberry|bb|playbook|tizen|bada|maemo|symbian|phone|mini|windows\sce|palm/i.test(userAgent)) {
    return true;
  }
  return false;
}


const stringFactory = (key: string) => {
  return {
    join(...args: string[]) {
      return args.join(key);
    },
    split(str: string) {
      return str.split(key);
    }
  }
}

export const connectionTableUnique = stringFactory("-&-");
