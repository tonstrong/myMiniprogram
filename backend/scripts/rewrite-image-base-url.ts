import { closePool, withClient } from "../src/app/db";
import { loadConfig } from "../src/app/config";

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function run(): Promise<void> {
  const config = loadConfig();
  const newBaseUrl = normalizeBaseUrl(config.publicBaseUrl);
  const oldBaseUrls = (process.env.OLD_PUBLIC_BASE_URLS || "")
    .split(",")
    .map((entry) => normalizeBaseUrl(entry))
    .filter(Boolean)
    .filter((entry) => entry !== newBaseUrl);

  if (!newBaseUrl) {
    throw new Error("PUBLIC_BASE_URL is required.");
  }

  if (oldBaseUrls.length === 0) {
    throw new Error("OLD_PUBLIC_BASE_URLS is required for rewrite:image-base-url.");
  }

  const oldPattern = oldBaseUrls.map(escapeRegExp).join("|");

  await withClient(async (client) => {
    const [result] = await client.query(
      `
        UPDATE clothing_items
        SET image_original_url = REGEXP_REPLACE(
          image_original_url,
          ?,
          ?
        )
        WHERE image_original_url REGEXP ?
      `,
      [`^(${oldPattern})`, newBaseUrl, `^(${oldPattern})`]
    );

    const affectedRows =
      typeof (result as { affectedRows?: number }).affectedRows === "number"
        ? (result as { affectedRows: number }).affectedRows
        : 0;

    // eslint-disable-next-line no-console
    console.log(
      `[rewrite:image-base-url] updated ${affectedRows} clothing_items.image_original_url rows`
    );
  });
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[rewrite:image-base-url] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
