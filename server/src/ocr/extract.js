// OCR for scanned patient charts (Tesseract, runs locally — no external service).
// Every page is normalised to an A4 portrait sheet at 300 dpi before recognition.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { createWorker, OEM, PSM } from 'tesseract.js';
import { pdf } from 'pdf-to-img';
import { config } from '../config.js';
import { badRequest } from '../http.js';
import { parseChart } from './parseChart.js';

const require = createRequire(import.meta.url);
const LANG_PATH = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
const CACHE_PATH = path.join(config.storageDir, 'ocr-cache');
fs.mkdirSync(CACHE_PATH, { recursive: true });

// A4 portrait at 300 dpi
export const A4 = { width: 2480, height: 3508 };
const MAX_PAGES = 8;

// One long-lived worker; jobs run one at a time.
let workerPromise = null;
let queue = Promise.resolve();

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', OEM.LSTM_ONLY, {
      langPath: LANG_PATH,
      cachePath: CACHE_PATH,
      gzip: true,
    }).then(async (w) => {
      await w.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1', user_defined_dpi: '300' });
      return w;
    }).catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

const runExclusive = (fn) => {
  const job = queue.then(fn, fn);
  queue = job.catch(() => {});
  return job;
};

// Fit a page onto a white A4 portrait sheet; greyscale + contrast stretch + light sharpen help Tesseract.
async function toA4(buffer, { rotate = 0 } = {}) {
  let img = sharp(buffer, { failOn: 'none' }).rotate(); // honour EXIF orientation from phone photos
  if (rotate) img = sharp(await img.toBuffer()).rotate(rotate);
  return img
    .flatten({ background: '#ffffff' })
    .resize(A4.width, A4.height, { fit: 'contain', background: '#ffffff', withoutEnlargement: false })
    .grayscale()
    .normalise()
    .sharpen({ sigma: 0.8 })
    .png()
    .toBuffer();
}

async function isLandscape(buffer) {
  const meta = await sharp(buffer, { failOn: 'none' }).rotate().metadata();
  const w = meta.autoOrient?.width ?? meta.width;
  const h = meta.autoOrient?.height ?? meta.height;
  return w && h && w > h * 1.15;
}

async function recognise(png) {
  const worker = await getWorker();
  const { data } = await worker.recognize(png);
  return { text: data.text || '', confidence: Number(data.confidence) || 0 };
}

// OCR one page image. A sideways (landscape) scan of an A4 sheet is tried both ways round.
async function ocrPage(buffer) {
  if (await isLandscape(buffer)) {
    const a = await recognise(await toA4(buffer, { rotate: 90 }));
    const b = await recognise(await toA4(buffer, { rotate: 270 }));
    return a.confidence >= b.confidence ? a : b;
  }
  return recognise(await toA4(buffer));
}

async function pageImages(filePath, mime) {
  const buf = await fsp.readFile(filePath);
  if (mime !== 'application/pdf') return [buf];
  const doc = await pdf(buf, { scale: 3 }); // ~216 dpi; resized to A4 300 dpi afterwards
  try {
    if (doc.length > MAX_PAGES) throw badRequest(`PDF has ${doc.length} pages; upload at most ${MAX_PAGES} pages at a time.`);
    const pages = [];
    for await (const page of doc) pages.push(page);
    return pages;
  } finally {
    await doc.destroy().catch(() => {});
  }
}

export function extractChart(file) {
  return runExclusive(async () => {
    const pages = await pageImages(file.path, file.mime_type);
    const results = [];
    for (const page of pages) results.push(await ocrPage(page));
    const text = results
      .map((r, i) => (results.length > 1 ? `--- page ${i + 1} ---\n${r.text.trim()}` : r.text.trim()))
      .join('\n\n');
    const confidence = results.length
      ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length)
      : 0;
    return { extraction: parseChart(text), text, confidence, pages: results.length };
  });
}

export async function shutdownOcr() {
  if (workerPromise) {
    const w = await workerPromise.catch(() => null);
    workerPromise = null;
    await w?.terminate();
  }
}
