const { test, expect } = require("./extension.fixtures");

async function waitForVoices(page) {
  await page.waitForSelector("#voiceSelect option", { state: "attached" });
}

test.describe("Popup workflow (harness)", () => {
  test.beforeEach(async ({ page, harnessUrl }) => {
    await page.goto(harnessUrl);
    await waitForVoices(page);
    await page.evaluate(() => window.__popupTestHooks.reset());
    await expect(page.locator("#usageElevenValue")).not.toHaveText(/Cargando/i);
    await expect(page.locator("#usageGroqValue")).not.toHaveText(/Cargando/i);
  });

  test("genera audio desde texto personalizado y lo almacena en el historial", async ({ page }) => {
    await page.fill("#customText", "Hola equipo, esta es una prueba automatizada.");
    await page.click("#readCustom");

    const audioResult = page.locator("#audioResult");
    await expect(audioResult).toBeVisible({ timeout: 5000 });
    await expect(audioResult.locator("#audioPlayer")).toBeVisible();

    const historyItems = page.locator("#generatedAudios .audio-history-item");
    await expect(historyItems).toHaveCount(1);
    await expect(historyItems.first().locator("audio")).toBeVisible();
  });

  test("muestra mensaje de error cuando ElevenLabs responde con error", async ({ page }) => {
    await page.evaluate(() => window.__popupTestHooks.failNextSynthesis("Limite superado"));
    await page.fill("#customText", "Este texto debe fallar.");
    await page.click("#readCustom");

    const toast = page.locator("#toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Error al generar audio");
  });
});
