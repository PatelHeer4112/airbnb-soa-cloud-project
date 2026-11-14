import { test } from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  samplePhoto,
  withPhotoAssets,
  photoAttributes,
} from "../src/photos.js";
import { imageUrl } from "../src/validation.js";

test("all twenty sample albums resolve to bundled HD and responsive assets", async () => {
  const seeds = [
    "shoreditch-loft",
    "greenwich-house",
    "kings-cross-studio",
    "edinburgh-old-town",
    "loch-cabin",
    "manchester-nq",
    "lake-cottage",
    "montmartre",
    "marais-loft",
    "gothic-quarter",
    "sitges-villa",
    "jordaan",
    "trastevere",
    "alfama",
    "goa-villa",
    "bandra",
    "jaipur-haveli",
    "brooklyn",
    "banff-cabin",
    "bondi-house",
  ];
  const covers = new Set();
  for (const seed of seeds)
    for (const index of [1, 2]) {
      const asset = samplePhoto(
        `https://picsum.photos/seed/${seed}-${index}/800/600`,
      );
      assert.match(asset, /-1920\.webp$/);
      await access(
        fileURLToPath(new URL(`../public${asset}`, import.meta.url)),
      );
      await access(
        fileURLToPath(
          new URL(
            `../public${asset.replace("-1920.webp", "-640.webp")}`,
            import.meta.url,
          ),
        ),
      );
      if (index === 1) covers.add(asset);
    }
  assert.equal(covers.size, 20);
});
test("sample mapping preserves host photos, unknown images and the original API object", () => {
  const original = {
    imageUrls: [
      "https://picsum.photos/seed/goa-villa-1/800/600",
      "https://example.com/actual-villa.jpg",
    ],
  };
  const mapped = withPhotoAssets(original);
  assert.equal(mapped.illustrativePhotos, true);
  assert.equal(mapped.imageUrls[1], original.imageUrls[1]);
  assert.match(original.imageUrls[0], /^https:/);
  assert.deepEqual(
    withPhotoAssets({ imageUrls: ["https://example.com/actual-villa.jpg"] }),
    { imageUrls: ["https://example.com/actual-villa.jpg"] },
  );
  assert.equal(
    samplePhoto("https://picsum.photos/seed/unknown-1/800/600"),
    null,
  );
  assert.equal(
    samplePhoto("https://evil.example/seed/goa-villa-1/800/600"),
    null,
  );
});
test("booking summaries use the same imagery and safe local paths are accepted", () => {
  const result = withPhotoAssets({
    listing: {
      imageUrls: ["https://picsum.photos/seed/banff-cabin-1/800/600"],
    },
  });
  assert.equal(
    result.listing.imageUrls[0],
    "/images/stays/mountainCabin-1920.webp",
  );
  assert.match(photoAttributes(result.listing.imageUrls[0]), /640w/);
  assert.equal(
    imageUrl(result.listing.imageUrls[0]),
    result.listing.imageUrls[0],
  );
  for (const unsafe of [
    "//evil.example/test",
    "/images/../secret",
    "javascript:alert(1)",
  ])
    assert.equal(imageUrl(unsafe), "");
});
