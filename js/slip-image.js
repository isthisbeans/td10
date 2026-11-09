// Prepare one bounded JPEG. The same bytes are used by preview and upload.
(function () {
  const maxBytes = 500000;
  async function prepare(file, isCurrent = () => true) {
    const image = new Image();
    const canvas = document.createElement('canvas');
    const url = URL.createObjectURL(file);
    function check() {
      if (!isCurrent()) { const error = new Error('Image selection changed'); error.name = 'AbortError'; throw error; }
    }
    function encode(quality) {
      check();
      return new Promise((resolve, reject) => canvas.toBlob(blob => {
        if (!blob || blob.type !== 'image/jpeg' || !blob.size) reject(new Error('Could not prepare image'));
        else resolve(blob);
      }, 'image/jpeg', quality));
    }
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Invalid image'));
        image.src = url;
      });
      check();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Invalid image dimensions');
      let scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      let result;
      for (let attempt = 0; attempt < 8; attempt++) {
        check();
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        result = await encode(0.9);
        if (result.size <= maxBytes) break;
        result = await encode(0.65);
        if (result.size <= maxBytes) {
          // Preserve resolution and choose the highest tested quality that fits.
          let low = 0.65, high = 0.9;
          for (let step = 0; step < 3; step++) {
            const quality = (low + high) / 2;
            const candidate = await encode(quality);
            if (candidate.size <= maxBytes) { low = quality; result = candidate; }
            else high = quality;
          }
          break;
        }
        scale *= Math.min(0.85, Math.sqrt(maxBytes / result.size) * 0.9);
      }
      check();
      if (!result || result.size > maxBytes) throw new Error('Could not prepare image');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(result);
      });
      check();
      return dataUrl;
    } finally {
      URL.revokeObjectURL(url);
      image.src = '';
      image.onload = image.onerror = null;
      canvas.width = canvas.height = 0;
    }
  }
  window.TD_SlipImage = { prepare, maxBytes };
})();
