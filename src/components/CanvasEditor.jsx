import React, { useEffect, useRef, forwardRef, useCallback } from 'react';
const CanvasEditor = forwardRef(({
  image,
  blur,
  pixelation,
  texts,
  selectedTextId,
  onTextSelect,
  onTextChange
}, ref) => {
  const canvasRef = ref || useRef(null);
  const isDraggingRef = useRef(false);
  const dragTextIdRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const applyPixelation = useCallback((ctx, width, height, pixelSize) => {
    if (pixelSize <= 0) return;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let y = 0; y < height; y += pixelSize) {
      for (let x = 0; x < width; x += pixelSize) {
        const pixelIndex = (y * width + x) * 4;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];   
        for (let py = y; py < Math.min(y + pixelSize, height); py++) {
          for (let px = x; px < Math.min(x + pixelSize, width); px++) {
            const index = (py * width + px) * 4;
            data[index] = r;
            data[index + 1] = g;
            data[index + 2] = b;
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);
  const getImageDimensions = useCallback(() => {
    if (!image) return { width: 0, height: 0, x: 0, y: 0, scale: 1 };
    const canvas = canvasRef.current;
    if (!canvas) return { width: 0, height: 0, x: 0, y: 0, scale: 1 };
    const maxWidth = canvas.width;
    const maxHeight = canvas.height;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (maxWidth - width) / 2;
    const y = (maxHeight - height) / 2;
    return { width, height, x, y, scale };
  }, [image]);
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (image) {
      const imgDims = getImageDimensions();
      if (blur > 0) {
        ctx.filter = `blur(${blur}px)`;
      }
      ctx.drawImage(image, imgDims.x, imgDims.y, imgDims.width, imgDims.height);
      ctx.filter = 'none';
      if (pixelation > 0) {
        const imageData = ctx.getImageData(imgDims.x, imgDims.y, imgDims.width, imgDims.height);
        const pixelCtx = document.createElement('canvas').getContext('2d');
        pixelCtx.canvas.width = imgDims.width;
        pixelCtx.canvas.height = imgDims.height;
        pixelCtx.putImageData(imageData, 0, 0);
        const pixelSize = Math.max(1, Math.floor(pixelation * (imgDims.width / 200)));
        applyPixelation(pixelCtx, imgDims.width, imgDims.height, pixelSize);
        ctx.clearRect(imgDims.x, imgDims.y, imgDims.width, imgDims.height);
        ctx.drawImage(pixelCtx.canvas, imgDims.x, imgDims.y);
      }
    }
    texts.forEach(text => {
      const {
        content, fontSize, color, strokeWidth, uppercase, scale: textScale = 1, pixelation: textPixelation = 0
      } = text;
      const imgDims = getImageDimensions();
      const canvasX = imgDims.x + (text.x * imgDims.scale);
      const canvasY = imgDims.y + (text.y * imgDims.scale);
      ctx.save();
      ctx.translate(canvasX, canvasY);
      ctx.scale(textScale, textScale);
      const displayText = uppercase ? content.toUpperCase() : content;
      ctx.font = `bold ${fontSize}px system-ui, "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = strokeWidth;
      if (textPixelation > 0) {
        ctx.imageSmoothingEnabled = false;
      }
      ctx.strokeText(displayText, 0, 0);
      ctx.fillText(displayText, 0, 0);
      if (text.id === selectedTextId) {
        const textWidth = ctx.measureText(displayText).width;
        const textHeight = fontSize;
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(-textWidth/2 - 15, -textHeight/2 - 15, textWidth + 30, textHeight + 30);
        ctx.setLineDash([]);
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(-textWidth/2 - 20, -textHeight/2 - 20, 10, 10);
        ctx.fillRect(textWidth/2 + 10, -textHeight/2 - 20, 10, 10);
        ctx.fillRect(-textWidth/2 - 20, textHeight/2 + 10, 10, 10);
        ctx.fillRect(textWidth/2 + 10, textHeight/2 + 10, 10, 10);
      }
      
      ctx.restore();
    });
  }, [image, blur, pixelation, texts, selectedTextId, getImageDimensions, applyPixelation]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const maxWidth = Math.min(container.clientWidth - 40, 1000);
    const maxHeight = Math.min(container.clientHeight - 60, 700);
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    canvasSizeRef.current = { width: maxWidth, height: maxHeight };
    renderCanvas();
  }, [renderCanvas]);
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);
  const getRelativePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const imgDims = getImageDimensions();
    const relativeX = (mouseX - imgDims.x) / imgDims.scale;
    const relativeY = (mouseY - imgDims.y) / imgDims.scale;
    return { x: relativeX, y: relativeY };
  };
  const handleMouseDown = (e) => {
    const pos = getRelativePos(e);
    for (let i = texts.length - 1; i >= 0; i--) {
      const text = texts[i];
      const ctx = canvasRef.current.getContext('2d');
      const displayText = text.uppercase ? text.content.toUpperCase() : text.content;
      ctx.font = `bold ${text.fontSize}px system-ui, "Noto Color Emoji", sans-serif`;
      const textWidth = ctx.measureText(displayText).width;
      const textHeight = text.fontSize;
      if (
        pos.x >= text.x - textWidth/2 - 25 &&
        pos.x <= text.x + textWidth/2 + 25 &&
        pos.y >= text.y - textHeight/2 - 25 &&
        pos.y <= text.y + textHeight/2 + 25
      ) {
        isDraggingRef.current = true;
        dragTextIdRef.current = text.id;
        dragOffsetRef.current = {
          x: pos.x - text.x,
          y: pos.y - text.y
        };
        onTextSelect(text.id);
        return;
      }
    }
  };
  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const pos = getRelativePos(e);
    const textId = dragTextIdRef.current;
    onTextChange(textId, {
      x: pos.x - dragOffsetRef.current.x,
      y: pos.y - dragOffsetRef.current.y
    });
  };
  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragTextIdRef.current = null;
  };
  return (
    <canvas
      ref={canvasRef}
      className="editor-canvas"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
});
export default CanvasEditor;