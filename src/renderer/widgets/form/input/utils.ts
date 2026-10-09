
// 图片压缩 (用于二维码识别)
export async function compressImage(file: File, maxSide = 1400, quality = 0.8): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);

    // 计算缩放比例
    let width = bitmap.width;
    let height = bitmap.height;

    if (width > maxSide || height > maxSide) {
      const ratio = Math.max(width / maxSide, height / maxSide);
      width = Math.round(width / ratio);
      height = Math.round(height / ratio);
    } else {
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Canvas 不可用');

    ctx.drawImage(bitmap, 0, 0, width, height);
    ctx.imageSmoothingEnabled = false; // 锐化

    bitmap.close();

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          }));
        } else {
          reject(new Error('Compression failed'));
        }
      }, 'image/jpeg', quality);
    });

  } catch (err) {
    console.warn("图像压缩失败", err);
    return file;
  }
};