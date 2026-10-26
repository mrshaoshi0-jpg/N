async function generateThumbnail(file, maxSize = 400) {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
          } else {
            if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
          }
          canvas.width = Math.max(1, Math.round(w));
          canvas.height = Math.max(1, Math.round(h));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(url);
            resolve(blob);
          }, 'image/jpeg', 0.8);
        } catch (e) {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } else if (file.type.startsWith('video/')) {
      // More robust for iOS Safari
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      let resolved = false;

      const done = (blob) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        try { URL.revokeObjectURL(url); } catch(e){}
        try { video.src = ''; video.load(); } catch(e){}
        resolve(blob);
      };

      // 4 second timeout - iOS sometimes never fires events
      const timer = setTimeout(() => {
        done(null);
      }, 4000);

      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.preload = 'auto';

      const captureFrame = () => {
        try {
          if (!video.videoWidth || !video.videoHeight) {
            done(null);
            return;
          }
          const canvas = document.createElement('canvas');
          let w = video.videoWidth;
          let h = video.videoHeight;
          if (w > h) {
            if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
          } else {
            if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
          }
          canvas.width = Math.max(1, Math.round(w));
          canvas.height = Math.max(1, Math.round(h));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            done(blob);
          }, 'image/jpeg', 0.8);
        } catch (e) {
          done(null);
        }
      };

      video.addEventListener('loadeddata', function onLoaded() {
        video.removeEventListener('loadeddata', onLoaded);
        try {
          // Seek a little to avoid pure black first frame on some videos
          const t = Math.min(0.5, (video.duration || 1) * 0.1);
          video.currentTime = t;
        } catch (e) {
          captureFrame();
        }
      });

      video.addEventListener('seeked', function onSeeked() {
        video.removeEventListener('seeked', onSeeked);
        captureFrame();
      });

      video.addEventListener('error', function onErr() {
        video.removeEventListener('error', onErr);
        done(null);
      });

      video.src = url;

      // Force iOS to start decoding
      const p = video.play();
      if (p && p.then) {
        p.then(() => { try { video.pause(); } catch(e){} }).catch(() => {});
      }
    } else {
      resolve(null);
    }
  });
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let finished = false;
    const finish = (val) => {
      if (finished) return;
      finished = true;
      try { URL.revokeObjectURL(url); } catch(e){}
      resolve(val || 0);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(0);
    setTimeout(() => finish(0), 3000);
    video.src = url;
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

window.mediaUtils = {
  generateThumbnail,
  formatDuration,
  getVideoDuration,
  uid
};
