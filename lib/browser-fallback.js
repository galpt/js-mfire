// Optional Puppeteer-based fallback to obtain vrf token by listening to network events.
import puppeteer from 'puppeteer';

export async function fetchVrfWithBrowserFallback(q, timeoutMs = 20000) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    let vrf = '';
    await page.setRequestInterception(true);
    page.on('request', (req) => { req.continue().catch(() => {}); });
    page.on('requestfinished', async (req) => {
      try {
        const url = req.url();
        if (url.includes('ajax/manga/search') || url.includes('/filter?')) {
          const u = new URL(url);
          const v = u.searchParams.get('vrf');
          if (v) vrf = v;
        }
      } catch (e) { /* ignore */ }
    });
    await page.goto('https://mangafire.to/home', { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // inject query to trigger client-side request
    await page.evaluate((q) => {
      const el = document.querySelector('.search-inner input[name=keyword]');
      if (!el) return false;
      el.value = q;
      el.dispatchEvent(new Event('keyup'));
      return true;
    }, q);
    const start = Date.now();
    while (!vrf && Date.now() - start < timeoutMs) {
      // wait a bit
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    return vrf || '';
  } finally {
    try { await browser.close(); } catch (e) { }
  }
}
