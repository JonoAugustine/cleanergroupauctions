#!/usr/bin/env node
// Turns a saved MGA page into a committable test fixture.
// Usage: node scripts/scrub-fixture.mjs tests/fixtures/raw/home.html tests/fixtures/home.html
//
// Removes: scripts, stylesheets, ViewState and EventValidation values, the logged in name, emails.
// Rewrites: "Save Page As" resource paths back to the shapes MGA serves, so parsers see live markup.
// Image ids in the saved pages are lost, so imagehandler sources get synthetic ids from 900001 up.
import { readFileSync, writeFileSync } from 'node:fs';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error('usage: scrub-fixture.mjs <raw.html> <out.html>');
  process.exit(1);
}

let html = readFileSync(src, 'utf8');
let imageId = 900000;

html = html
  .replace(/<!--\s*saved from url=[^>]*-->\s*/gi, '')
  // Pages saved while CGA (or another extension) was running carry their injected markup.
  .replace(/<cga-app[^>]*>[\s\S]*?<\/cga-app>/gi, '')
  .replace(/\s(?:class="cga-takeover"|data-darkreader-[a-z-]+="[^"]*")/gi, '')
  .replace(/<meta name="darkreader"[^>]*>/gi, '')
  .replace(/\s*--darkreader-[\w-]+:\s*var\([^)]*\);?/g, '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<link\b[^>]*>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/(name="(?:__VIEWSTATE|__EVENTVALIDATION)"[^>]*?value=")[^"]*"/g, '$1SCRUBBED"')
  .replace(/(id="ctl00_UsernameLbl"[^>]*>)[^<]*/g, '$1Test Member')
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'member@example.com')
  .replace(/src="[^"]*_files\/imagehandler[^"]*"/g, () => `src="system/services/imagehandler.ashx?type=item&amp;id= ${++imageId}"`)
  .replace(/(src|href)="[^"]*_files\/([^"]+?)(?:_[A-Za-z0-9]{3,4})?(\.[a-z]+)"/g, '$1="images/$2$3"')
  .replace(/(href|action)="https?:\/\/(?:www\.)?mygroupauctions\.com\/([^"]*)"/gi, '$1="$2"')
  .replace(/[ \t]+$/gm, '');

const leaks = [/Augustine/i, /\bJonathan\b/i, /Capital Exotic/i, /_files\//];
for (const re of leaks) if (re.test(html)) throw new Error(`${src}: still contains ${re}`);

writeFileSync(dest, html);
console.log(`${dest}: ${html.length} bytes, ${imageId - 900000} image ids`);
