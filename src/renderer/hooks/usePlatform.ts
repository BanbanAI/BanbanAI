export const usePlatform = () => {
  let isMac = false;
  if (navigator.userAgent.indexOf("Macintosh") >= 0) {
    isMac = true;
  }
  return { 
    isMac, //是否是mac
  };
};
