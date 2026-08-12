import { useState, useEffect } from 'react';

export function useDominantColor(imageUrl: string | null | undefined) {
  const [color, setColor] = useState<string>('rgba(0,0,0,0.4)');

  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let r = 0, g = 0, b = 0;
        let count = 0;

        // Sample pixels
        for (let i = 0; i < data.length; i += 4 * 10) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        // Darken it slightly for background if needed, or just return as is
        // We want a gradient feel, so we'll return the RGB
        setColor(`rgb(${r}, ${g}, ${b})`);
      } catch (e) {
        console.error('Failed to extract dominant color', e);
      }
    };
  }, [imageUrl]);

  return color;
}
