import express from "express";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = "bluexpress123";

app.get("/track", async (req, res) => {
  const { tracking, token } = req.query;
  if (!tracking) return res.status(400).json({ error: "Falta el número de seguimiento" });
  if (ACCESS_TOKEN && token !== ACCESS_TOKEN)
    return res.status(403).json({ error: "Token inválido" });

  const url = `https://www.blue.cl/enviar/seguimiento?n_seguimiento=${tracking}`;
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const html = await page.content();
    await browser.close();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("❌ Error al renderizar:", err.message);
    res.status(500).json({ error: "Error al obtener HTML", detalle: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Proxy BlueExpress activo en puerto ${PORT}`));
