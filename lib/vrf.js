// Port of the Go vrf generator used by go-mfire.
// Implements rc4-based transforms and a small LRU cache.
import { LRUCache } from 'lru-cache';

const rc4Keys = {
  l: 'u8cBwTi1CM4XE3BkwG5Ble3AxWgnhKiXD9Cr279yNW0=',
  g: 't00NOJ/Fl3wZtez1xU6/YvcWDoXzjrDHJLL2r/IWgcY=',
  B: 'S7I+968ZY4Fo3sLVNH/ExCNq7gjuOHjSRgSqh6SsPJc=',
  m: '7D4Q8i8dApRj6UWxXbIBEa1UqvjI+8W0UvPH9talJK8=',
  F: '0JsmfWZA1kwZeWLk5gfV5g41lwLL72wHbam5ZPfnOVE='
};

const seeds32 = {
  A: 'pGjzSCtS4izckNAOhrY5unJnO2E1VbrU+tXRYG24vTo=',
  V: 'dFcKX9Qpu7mt/AD6mb1QF4w+KqHTKmdiqp7penubAKI=',
  N: 'owp1QIY/kBiRWrRn9TLN2CdZsLeejzHhfJwdiQMjg3w=',
  P: 'H1XbRvXOvZAhyyPaO68vgIUgdAHn68Y6mrwkpIpEue8=',
  k: '2Nmobf/mpQ7+Dxq1/olPSDj3xV8PZkPbKaucJvVckL0='
};

const prefixKeys = {
  O: 'Rowe+rg/0g==',
  v: '8cULcnOMJVY8AA==',
  L: 'n2+Og2Gth8Hh',
  p: 'aRpvzH+yoA==',
  W: 'ZB4oBi0='
};

function atob(s) {
  return Buffer.from(s, 'base64');
}

function btoa(buf) {
  let s = Buffer.from(buf).toString('base64');
  s = s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return s;
}

function rc4(keyBuf, inputBuf) {
  const key = Array.from(keyBuf);
  const input = Array.from(inputBuf);
  const s = new Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + (key[i % key.length] & 0xff)) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = new Uint8Array(input.length);
  let i = 0;
  j = 0;
  for (let y = 0; y < input.length; y++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
    const k = s[(s[i] + s[j]) & 0xff];
    out[y] = (input[y] ^ k) & 0xff;
  }
  return out;
}

function makeScheduleC() {
  return [
    (c) => (c - 48 + 256) & 0xff,
    (c) => (c - 19 + 256) & 0xff,
    (c) => (c ^ 241) & 0xff,
    (c) => (c - 19 + 256) & 0xff,
    (c) => (c + 223) & 0xff,
    (c) => (c - 19 + 256) & 0xff,
    (c) => (c - 170 + 256) & 0xff,
    (c) => (c - 19 + 256) & 0xff,
    (c) => (c - 48 + 256) & 0xff,
    (c) => (c ^ 8) & 0xff
  ];
}

function makeScheduleY() {
  return [
    (c) => ((c << 4) | (c >> 4)) & 0xff,
    (c) => (c + 223) & 0xff,
    (c) => ((c << 4) | (c >> 4)) & 0xff,
    (c) => (c ^ 163) & 0xff,
    (c) => (c - 48 + 256) & 0xff,
    (c) => (c + 82) & 0xff,
    (c) => (c + 223) & 0xff,
    (c) => (c - 48 + 256) & 0xff,
    (c) => (c ^ 83) & 0xff,
    (c) => ((c << 4) | (c >> 4)) & 0xff
  ];
}

function makeScheduleB() {
  return [
    (c) => (c - 19 + 256) & 0xff,
    (c) => (c + 82) & 0xff,
    (c) => (c - 48 + 256) & 0xff,
    (c) => (c - 170 + 256) & 0xff,
    (c) => ((c << 4) | (c >> 4)) & 0xff,
    (c) => (c - 48 + 256) & 0xff,
    (c) => (c - 170 + 256) & 0xff,
    (c) => (c ^ 8) & 0xff,
    (c) => (c + 82) & 0xff,
    (c) => (c ^ 163) & 0xff
  ];
}

function makeScheduleJ() {
  return [
    (c) => (c + 223) & 0xff,
    (c) => ((c << 4) | (c >> 4)) & 0xff,
    (c) => (c + 223) & 0xff,
    (c) => (c ^ 83) & 0xff,
    (c) => (c - 19 + 256) & 0xff,
    (c) => (c + 223) & 0xff,
    (c) => (c - 170 + 256) & 0xff,
    (c) => (c + 223) & 0xff,
    (c) => (c - 170 + 256) & 0xff,
    (c) => (c ^ 83) & 0xff
  ];
}

function makeScheduleE() {
  return [
    (c) => (c + 82) & 0xff,
    (c) => (c ^ 83) & 0xff,
    (c) => (c ^ 163) & 0xff,
    (c) => (c + 82) & 0xff,
    (c) => (c - 170 + 256) & 0xff,
    (c) => (c ^ 8) & 0xff,
    (c) => (c ^ 241) & 0xff,
    (c) => (c + 82) & 0xff,
    (c) => (c + 176) & 0xff,
    (c) => ((c << 4) | (c >> 4)) & 0xff
  ];
}

function transform(inputBuf, initSeedBytes, prefixKeyBytes, prefixLen, schedule) {
  const input = Array.from(inputBuf);
  const init = Array.from(initSeedBytes);
  const pref = Array.from(prefixKeyBytes);
  const out = [];
  for (let i = 0; i < input.length; i++) {
    if (i < prefixLen) out.push(pref[i]);
    const transformed = schedule[i % 10](((input[i] ^ init[i % 32]) & 0xff)) & 0xff;
    out.push(transformed);
  }
  return Uint8Array.from(out);
}

function generateNoCache(input) {
  let bytes = Buffer.from(input, 'utf8');

  // rc4 1
  const k1 = atob(rc4Keys.l);
  bytes = Buffer.from(rc4(k1, bytes));

  // step C1
  const seedA = atob(seeds32.A);
  const prefO = atob(prefixKeys.O);
  bytes = Buffer.from(transform(bytes, seedA, prefO, 7, makeScheduleC()));

  // rc4 2
  const k2 = atob(rc4Keys.g);
  bytes = Buffer.from(rc4(k2, bytes));

  // step Y
  const seedV = atob(seeds32.V);
  const prefV = atob(prefixKeys.v);
  bytes = Buffer.from(transform(bytes, seedV, prefV, 10, makeScheduleY()));

  // rc4 3
  const k3 = atob(rc4Keys.B);
  bytes = Buffer.from(rc4(k3, bytes));

  // step B
  const seedN = atob(seeds32.N);
  const prefL = atob(prefixKeys.L);
  bytes = Buffer.from(transform(bytes, seedN, prefL, 9, makeScheduleB()));

  // rc4 4
  const k4 = atob(rc4Keys.m);
  bytes = Buffer.from(rc4(k4, bytes));

  // step J
  const seedP = atob(seeds32.P);
  const prefP = atob(prefixKeys.p);
  bytes = Buffer.from(transform(bytes, seedP, prefP, 7, makeScheduleJ()));

  // rc4 5
  const k5 = atob(rc4Keys.F);
  bytes = Buffer.from(rc4(k5, bytes));

  // step E
  const seedK = atob(seeds32.k);
  const prefW = atob(prefixKeys.W);
  bytes = Buffer.from(transform(bytes, seedK, prefW, 5, makeScheduleE()));

  return btoa(bytes);
}

// LRU cache for VRF tokens (replaceable so we can change capacity)
let defaultVrfCache = new LRUCache({ max: 1024 });

export function GenerateVrf(input) {
  const existing = defaultVrfCache.get(input);
  if (existing) return existing;
  const v = generateNoCache(input);
  defaultVrfCache.set(input, v);
  return v;
}

export function SetVrfCacheSize(size) {
  if (!size || size <= 0) return;
  defaultVrfCache = new LRUCache({ max: size });
}

export function GetVrfCacheSize() {
  return defaultVrfCache.max;
}
