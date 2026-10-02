// Video URL helper & parser supporting YouTube, Google Drive, and Direct Video Files (.mp4, .webm)

export function parseVideoUrl(rawUrl, isMuted = false, shouldLoop = false) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { type: 'unknown', url: '', originalUrl: '' };
  }

  const url = rawUrl.trim();
  const muteFlag = isMuted ? 1 : 0;

  // 1. YouTube Matchers
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;
  const ytMatch = url.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    const ytLoop = shouldLoop ? `&loop=1&playlist=${videoId}` : '&loop=0';
    return {
      type: 'youtube',
      videoId,
      // enablejsapi=1 allows parent window to detect onStateChange=0 (ENDED) and unMute with audio
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=${muteFlag}${ytLoop}&controls=1&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      originalUrl: url
    };
  }

  // 2. TikTok Matchers (Full video link, player link, embed link, or shortlink)
  const tiktokIdRegex = /tiktok\.com\/(?:@[\w.-]+\/video\/|v\/|embed\/v2\/|embed\/|player\/v1\/)(\d+)/i;
  const ttIdMatch = url.match(tiktokIdRegex);
  if (ttIdMatch && ttIdMatch[1]) {
    const videoId = ttIdMatch[1];
    return {
      type: 'tiktok',
      videoId,
      embedUrl: `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&loop=${shouldLoop ? 1 : 0}`,
      thumbnailUrl: null,
      originalUrl: url
    };
  }

  const tiktokShortRegex = /(?:(?:vt|vm)\.tiktok\.com\/|tiktok\.com\/t\/)([a-zA-Z0-9_-]+)/i;
  const ttShortMatch = url.match(tiktokShortRegex);
  if (ttShortMatch && ttShortMatch[1]) {
    const shortcode = ttShortMatch[1];
    return {
      type: 'tiktok',
      shortcode,
      isShortLink: true,
      embedUrl: `https://www.tiktok.com/player/v1/${shortcode}?autoplay=1&loop=${shouldLoop ? 1 : 0}`,
      thumbnailUrl: null,
      originalUrl: url
    };
  }

  // 3. Instagram Matchers (Reels, Posts, IGTV)
  const igRegex = /(?:instagram\.com|instagr\.am)\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i;
  const igMatch = url.match(igRegex);
  if (igMatch && igMatch[1]) {
    const shortcode = igMatch[1];
    return {
      type: 'instagram',
      shortcode,
      embedUrl: `https://www.instagram.com/reel/${shortcode}/embed/`,
      thumbnailUrl: null,
      originalUrl: url
    };
  }

  // 4. Google Drive Matchers
  // Supports: https://drive.google.com/file/d/FILE_ID/view...
  const gdriveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i;
  const gdriveMatch = url.match(gdriveRegex);
  if (gdriveMatch && gdriveMatch[1]) {
    const fileId = gdriveMatch[1];
    return {
      type: 'gdrive',
      fileId,
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      thumbnailUrl: null,
      originalUrl: url
    };
  }

  // 5. Direct Video File or Upload Data URI (.mp4, .webm, .ogg, data:video/...)
  return {
    type: 'direct',
    url,
    thumbnailUrl: null,
    originalUrl: url
  };
}

export function getLayoutGridTemplate(ratio = '50-50', position = 'right') {
  let leftCol = '1fr';
  let rightCol = '1fr';

  switch (ratio) {
    case '60-40':
      leftCol = '6fr';
      rightCol = '4fr';
      break;
    case '40-60':
      leftCol = '4fr';
      rightCol = '6fr';
      break;
    case '70-30':
      leftCol = '7fr';
      rightCol = '3fr';
      break;
    case 'fixed-480':
      leftCol = '1fr';
      rightCol = '480px';
      break;
    case 'fixed-580':
      leftCol = '1fr';
      rightCol = '580px';
      break;
    case 'fixed-680':
      leftCol = '1fr';
      rightCol = '680px';
      break;
    case 'fixed-780':
      leftCol = '1fr';
      rightCol = '780px';
      break;
    case '50-50':
    default:
      leftCol = '1fr';
      rightCol = '1fr';
      break;
  }

  if (position === 'left') {
    return `${rightCol} ${leftCol}`;
  }
  return `${leftCol} ${rightCol}`;
}
