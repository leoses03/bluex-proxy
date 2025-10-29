// server.js
import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/track", async (req, res) => {
  const { tracking, token } = req.query;

  if (token !== "bluexpress123") {
    return res.status(403).json({ error: "Token inválido" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
    });

    const page = await browser.newPage();
    await page.goto(`https://www.blue.cl/enviar/seguimiento?n_seguimiento=${tracking}`, {
      waitUntil: "networkidle2",
