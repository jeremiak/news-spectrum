import fs from "fs/promises";

import _ from "lodash";
import puppeteer from "puppeteer";
import Queue from "p-queue";
import sites from "./sites.mjs";

const browser = await puppeteer.launch();
const queue = new Queue({ concurrency: 1 });

function wait(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

async function screenshot(site) {
  console.log("📸", site.name);
  const page = await browser.newPage();
  await page.setViewport({
    width: 390,
    height: 844,
  });
  await page.setJavaScriptEnabled(false);
  try {
    await page.goto(site.url, {
      waitUntil: ["domcontentloaded"],
    });
    await wait(2000);
    await page.screenshot({
      path: `screenshots/${_.snakeCase(site.name)}.png`,
    });
    await page.close();
  } catch (e) {
    await page.close();
    throw e;
  }
}

function enqueue(site) {
  queue.add(async () => {
    try {
      await screenshot(site);
    } catch (e) {
      console.error(e, site.name);
      enqueue(site);
    }
  });
}

console.log(`Attempting to take screenshots of ${sites.length} news sites`);

const categories = {};

sites.forEach((site) => {
  const { category } = site;
  if (categories[category]) {
    categories[category].push(site);
  } else {
    categories[category] = [site];
  }
  enqueue(site);
});

await queue.onIdle();
await browser.close();

function formatSiteHtml(site) {
  const { name } = site;
  return `<div class="news-site"><div class="news-site-name">${name}</div><div class="news-site-screenshot"><a href="${site.url}"><img src="./screenshots/${
    _.snakeCase(name)
  }.png"></a></div></div>`;
}

const categoriesHtml = Object.keys(categories).map((category) => {
  const s = categories[category].map((site) => {
    return formatSiteHtml(site);
  }).join("");
  const html =
    `<div class="category ${category.toLowerCase()}"><strong>${category}</strong><div class="category-sites">${s}</a></div></div>`;
  return html;
}).join("");

const html =
  `<html><head><title>Headlines from across the US political spectrum</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css"></head><body><header><div class="title">Headlines from across the US political spectrum</div><div class="date">Last updated on <time datetime="${
    (new Date()).toISOString()
  }">${
    (new Date()).toGMTString()
  }</time></div></header><main><div class="categories">${categoriesHtml}</div></main><footer>Made by @jeremiak, <i>heavily</i> inspired by <a href="https://newsdivide.bradoyler.com/">the News Divide</a> by Brad Oyler</footer></body></html>`;

await fs.writeFile("index.html", html);

console.log(`🏁 Done`);
