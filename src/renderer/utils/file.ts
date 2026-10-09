import { FileSystemAccessShowOpenFileOptions, useSupported } from "@vueuse/core"
import { ref } from "vue";
import axios from 'axios';

export const readFile = async (file: File, dataType: DateType) => {
  return new Promise( (resolve, reject) => {

    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = (err) => {
      reject(err);
    }

    if (dataType === 'Text') {
      reader.readAsText(file, 'utf8');
    } else if (dataType === 'ArrayBuffer') {
      reader.readAsArrayBuffer(file);
    } else if (dataType === 'Base64') {
      reader.readAsDataURL(file);
    }
  })
}
type DateType = 'Text' | 'ArrayBuffer' | 'Base64';
type useFileSystemAccess = FileSystemAccessShowOpenFileOptions & {
  dataType?: DateType,
}
export const useFileSystemAccess = (options: useFileSystemAccess) => {
  const isSupported = useSupported(() => window && 'showSaveFilePicker' in window && 'showOpenFilePicker' in window)
  const file = ref<File>();
  const data = ref();
  const fileName = ref<string>();
  const fileSize = ref<number>();
  const fileType = ref<string>();
  const fileLastModified = ref<number>();

  const useCallbackFactory = () => {
    const callbacks = [];
    const callbackListener = (callback: Function) => {
      if (!callbacks.includes(callback)) {
        callbacks.push(callback);
      }
    }
    const triggerCallback = (...args: any[]) => {
      for (const cb of callbacks) {
        cb(...args);
      }
    }
    return {
      callbackListener,
      triggerCallback,
    }
  }

  const { triggerCallback: triggerOpenCancel, callbackListener: onOpenCancel } = useCallbackFactory();
  const { triggerCallback: triggerLoadstart, callbackListener: onLoadstart } = useCallbackFactory();
  const { triggerCallback: triggerLoadend, callbackListener: onLoadend } = useCallbackFactory();


  const open = async (_options: FileSystemAccessShowOpenFileOptions = {}) => {
    if (!isSupported.value)
    return
    let fileHandles: FileSystemFileHandle[];
    try {
      fileHandles = await (window as any).showOpenFilePicker({ ...options, ..._options });
    } catch (err) {
      triggerOpenCancel();
    }
    triggerLoadstart();
    file.value = await fileHandles[0].getFile();
    fileName.value = file.value.name;
    fileSize.value = file.value.size;
    fileLastModified.value = file.value.lastModified;
    fileType.value = file.value.type;
    data.value = await readFile(file.value, options.dataType || 'Text');
    triggerLoadend();
  }

  return {
    isSupported,
    file,
    data,
    fileName,
    fileSize,
    fileType,
    fileLastModified,
    open,
    onOpenCancel,
    onLoadstart,
    onLoadend,
  }
}

export const isVideo = (url: string) => {
  if(!url) return false;
  const extName = `.${url?.split('.')?.pop()}`;
  return ['.mp4', '.avi', '.mkv', '.mov', '.webm', '.dv'].includes(extName);
}

export const getVideoBlobURL = async (url: string) => {
  const response = await axios.get(url, {
    responseType: "blob",
  });
  return URL.createObjectURL(response.data);
}

export const base64ToBlob = (base64: string) => {
  let arr = base64.split(','),
    fileType = arr[0].match(/:(.*?);/)[1],
    bstr = atob(arr[1]),
    l = bstr.length,
    u8Arr = new Uint8Array(l);

  while (l--) {
    u8Arr[l] = bstr.charCodeAt(l);
  }
  return new Blob([u8Arr], {
    type: fileType
  });
}