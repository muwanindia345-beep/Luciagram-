import React, { useRef, forwardRef, useImperativeHandle } from 'react';

const GboardInput = forwardRef(function GboardInput(
  { onText, onMedia, onSend, onPaste, style }, ref
) {
  const divRef = useRef();

  useImperativeHandle(ref, () => ({
    clear: () => { if (divRef.current) divRef.current.textContent = ''; },
    focus: () => divRef.current?.focus(),
  }));

  const handleInput = (e) => {
    const div = e.currentTarget;

    // Gboard sticker/GIF — img tag inject karta hai
    const imgs = div.querySelectorAll('img');
    if (imgs.length > 0) {
      const img = imgs[0];
      const src = img.src;
      imgs.forEach(i => i.remove());
      const txt = div.textContent || '';
      div.textContent = txt;
      if (onText) onText(txt);

      const processBlob = (blob) => {
        const rd = new FileReader();
        rd.onloadend = () => {
          if (onMedia) onMedia(rd.result, blob.type === 'image/gif' ? 'gif' : 'image');
        };
        rd.readAsDataURL(blob);
      };

      if (src.startsWith('data:')) {
        if (onMedia) onMedia(src, src.includes('gif') ? 'gif' : 'image');
      } else {
        fetch(src)
          .then(r => r.blob())
          .then(processBlob)
          .catch(() => { if (onMedia) onMedia(src, 'gif'); });
      }
      return;
    }

    if (onText) onText(div.textContent || '');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (onSend) onSend();
    }
  };

  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        data-ph="Message..."
        style={{
          flex: 1,
          background: '#1e1e2e',
          borderRadius: '20px',
          padding: '0.55rem 0.9rem',
          color: 'white',
          fontSize: '0.95rem',
          outline: 'none',
          minWidth: 0,
          minHeight: '36px',
          maxHeight: '120px',
          overflowY: 'auto',
          wordBreak: 'break-word',
          lineHeight: '1.5',
          ...style,
        }}
      />
      <style>{`
        [data-ph]:empty::before {
          content: attr(data-ph);
          color: #555;
          pointer-events: none;
          position: absolute;
          left: 0.9rem;
          top: 50%;
          transform: translateY(-50%);
        }
      `}</style>
    </div>
  );
});

export default GboardInput;
