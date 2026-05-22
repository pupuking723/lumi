import { expect, test } from "@playwright/test";

test("home, chat, and looks paths render in mobile shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Lumi home" })).toBeVisible();
  await expect(page.getByText("What are we making iconic today?")).toBeVisible();

  await page.getByRole("link", { name: /Chat/i }).first().click();
  await expect(page.getByPlaceholder("Ask Mochi about the look...")).toBeVisible();
  await page.getByPlaceholder("Ask Mochi about the look...").click();
  await page.keyboard.type("Color help?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/Lilac with emerald/i)).toBeVisible();

  await page.goto("/looks");
  await expect(page.getByRole("heading", { name: "Saved looks" })).toBeVisible();
  await expect(page.getByText(/Soft Icon/i)).toBeVisible();
});
