(async function () {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) return;
    const config = await response.json();
    const client = config.adsenseClientId;
    if (!/^ca-pub-\d{10,}$/.test(client || '')) return;
    const slots = { home: config.adsenseHomeSlotId, guide: config.adsenseGuideSlotId };
    if (!Object.values(slots).some(Boolean)) return;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
    document.head.appendChild(script);
    document.querySelectorAll('[data-ad-slot]').forEach(container => {
      const slot = slots[container.dataset.adSlot];
      if (!slot || !/^\d{5,}$/.test(slot)) return;
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.dataset.adClient = client;
      ins.dataset.adSlot = slot;
      ins.dataset.adFormat = 'auto';
      ins.dataset.fullWidthResponsive = 'true';
      container.replaceChildren(ins);
      container.hidden = false;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
      catch (error) { console.warn('Ad slot could not initialize:', error); }
    });
  } catch (error) {
    console.info('CareerOS ads are not enabled:', error.message);
  }
})();