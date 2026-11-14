import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve("public/images/stays");
const credits = JSON.parse(
  await readFile(resolve(root, "credits.json"), "utf8"),
);
const server = createServer(async (req, res) => {
  try {
    const filename = req.url.slice(1);
    if (!/^[a-zA-Z]+-640\.webp$/.test(filename)) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader("Content-Type", "image/webp");
    res.end(await readFile(resolve(root, filename)));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1200 },
  });
  await page.setContent(
    `<body style="font:14px Arial;background:#eee;display:grid;grid-template-columns:repeat(4,1fr);gap:15px;padding:15px">${credits.map((c) => `<div style="background:white;padding:8px"><img style="width:100%;height:160px;object-fit:cover" src="http://127.0.0.1:${server.address().port}/${c.asset}-640.webp"><p>${c.asset}</p></div>`).join("")}</body>`,
  );
  await page.evaluate(() =>
    Promise.all([...document.images].map((im) => im.decode())),
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/photo-contact-sheet.png",
    fullPage: true,
  });
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
