#!/usr/bin/env node
import readline from 'readline';
import { NewClient } from '../index.js';

const client = NewClient();

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  async function question(prompt) {
    return new Promise((resolve) => rl.question(prompt, (ans) => resolve(ans)));
  }

  while (true) {
    // fetch top 10
    let mangas = [];
    try {
      mangas = await client.FetchHome(10);
    } catch (e) {
      console.error('Error fetching home:', e.message || e);
      process.exit(1);
    }
    console.log('======');
    console.log('------');
    console.log('-- Simple MangaFire Parser Written in JS --');
    console.log('------');
    mangas.forEach((m, i) => console.log(`${i + 1}) ${m.title}`));
    console.log('search) Search by name');
    console.log('exit) Exit this CLI');
    console.log('------');
    const line = (await question('> ')).trim();
    if (line === 'exit') {
      console.log('bye');
      rl.close();
      return;
    }
    if (line === 'search') {
      const q = (await question('query: ')).trim();
      if (!q) continue;
      try {
        const results = await client.Search(q, 10);
        console.log(`Results for '${q}':`);
        results.forEach((r, i) => console.log(`${i + 1}) ${r.title} -- ${r.url}`));
      } catch (e) {
        console.error('search error:', e.message || e);
      }
      await question('press Enter to continue...');
      continue;
    }
    const asn = parseInt(line, 10);
    if (!Number.isNaN(asn)) {
      if (asn >= 1 && asn <= mangas.length) {
        const m = mangas[asn - 1];
        console.log(`${m.title}\nURL: ${m.url}`);
        await question('press Enter to continue...');
        continue;
      }
      console.log('invalid number');
      continue;
    }
    console.log('unknown command');
  }
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
