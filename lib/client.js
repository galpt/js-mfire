import * as cheerio from 'cheerio';
import { GenerateVrf } from './vrf.js';
import { Manga } from './models.js';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Upgrade-Insecure-Requests': '1',
  'Referer': 'https://mangafire.to/'
};

export class Client {
  constructor() {
    this.headers = { ...DEFAULT_HEADERS };
  }

  getFetch() {
    if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
    throw new Error('global fetch is not available. Please run on Node 18+ or install node-fetch');
  }

  async fetchDocument(url) {
    const res = await this.getFetch()(url, { headers: this.headers });
    if (!res.ok) throw new Error(`bad status: ${res.status} ${res.statusText}`);
    const body = await res.text();
    return cheerio.load(body);
  }

  async FetchHome(limit = 10) {
    const $ = await this.fetchDocument('https://mangafire.to/home');
    const mangas = [];
    $('.original.card-lg .unit .inner').each((i, el) => {
      if (mangas.length >= limit) return;
      const a = $(el).find('.info > a').first();
      const title = a.text().trim();
      let href = a.attr('href') || '';
      const cover = $(el).find('img').attr('src') || '';
      if (href && !/^https?:\/\//.test(href)) href = 'https://mangafire.to' + href;
      mangas.push(new Manga(title, href, cover));
    });
    return mangas;
  }

  async Search(query, limit = 10) {
    const qTrim = query.trim();
    // preflight fetch to set cookies
    try { await this.fetchDocument('https://mangafire.to/filter'); } catch (e) { /* ignore */ }

    const parts = qTrim.split(/\s+/).map(encodeURIComponent).join('+');
    const vrf = GenerateVrf(qTrim);
    const searchUrl = `https://mangafire.to/filter?keyword=${parts}&vrf=${encodeURIComponent(vrf)}`;
  const res = await this.getFetch()(searchUrl, { headers: { ...this.headers, Referer: 'https://mangafire.to/filter' } });
    if (res.status === 403) {
      // try puppeteer fallback if available
      try {
        const { fetchVrfWithBrowserFallback } = await import('./browser-fallback.js');
        const browserVrf = await fetchVrfWithBrowserFallback(qTrim, 20000);
        if (browserVrf) {
          const retryUrl = `https://mangafire.to/filter?keyword=${parts}&vrf=${encodeURIComponent(browserVrf)}`;
          const res2 = await this.getFetch()(retryUrl, { headers: { ...this.headers, Referer: 'https://mangafire.to/filter' } });
          if (!res2.ok) throw new Error(`bad status: ${res2.status}`);
          const body2 = await res2.text();
          const $2 = cheerio.load(body2);
          return parseMangasFromDoc($2, limit);
        }
      } catch (e) {
        // fallback failed, continue to return error
      }
      throw new Error('search request returned 403');
    }
    if (!res.ok) throw new Error(`bad status: ${res.status}`);
    const body = await res.text();
    const $ = cheerio.load(body);
    return parseMangasFromDoc($, limit);
  }
}

function parseMangasFromDoc($, limit) {
  const mangas = [];
  $('.original.card-lg .unit .inner').each((i, el) => {
    if (mangas.length >= limit) return;
    const a = $(el).find('.info > a').first();
    const title = a.text().trim();
    let href = a.attr('href') || '';
    const cover = $(el).find('img').attr('src') || '';
    if (href && !/^https?:\/\//.test(href)) href = 'https://mangafire.to' + href;
    mangas.push(new Manga(title, href, cover));
  });
  return mangas;
}

export function NewClient() { return new Client(); }
