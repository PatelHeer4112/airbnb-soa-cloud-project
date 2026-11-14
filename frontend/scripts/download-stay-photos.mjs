// Reproduce the bundled, illustrative sample photography. No API keys required.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const photoSources = {
  loft: "1600210492486-724fe5c67fb0",
  familyHouse: "1564013799919-ab600027ffc6",
  studio: "1522708323590-d24dbb6b0267",
  cityApartment: "1502672260266-1c1ef2d93688",
  forestCabin: "1449158743715-0a90ebb6d2d8",
  modernApartment: "1560448204-e02f11c3d0e2",
  cottage: "1449844908441-8829872d2607",
  parisApartment: "1536376072261-38c75010e6c9",
  designerLoft: "1600607687920-4e2a09cf159d",
  terraceHome: "1600566753086-00f18fb6b3ea",
  poolVilla: "1613490493576-7fde63acd811",
  guestRoom: "1616486338812-3dadae4b4ace",
  warmBedroom: "1615874959474-d609969a20ed",
  sunnyRoom: "1598928506311-c55ded91a20c",
  tropicalVilla: "1582268611958-ebfd161ef9cf",
  coastalApartment: "1600047509807-ba8f99d2cdde",
  courtyardHotel: "1566073771259-6a8506099945",
  brownstoneInterior: "1600607687939-ce8a6c25118c",
  mountainCabin: "1510798831971-661eb04b3739",
  beachHouse: "1512917774080-9991f1c4c750",
};

const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public/images/stays",
);
await mkdir(root, { recursive: true });
const tasks = Object.entries(photoSources).flatMap(([name, id]) =>
  [640, 1920].map((width) => ({ name, id, width })),
);
const credits = Object.entries(photoSources).map(([name, id]) => ({
  asset: name,
  source: `https://images.unsplash.com/photo-${id}`,
  license: "https://unsplash.com/license",
  usage:
    "Illustrative photography for sample listings, not verified photographs of the named property.",
}));
let index = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (index < tasks.length) {
      const { name, id, width } = tasks[index++];
      const url = `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=${width === 640 ? 76 : 85}&fm=webp`;
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/")
      )
        throw Error(`${name} ${width}: HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      await writeFile(resolve(root, `${name}-${width}.webp`), bytes);
      console.log(
        `${name}-${width}.webp ${Math.round(bytes.length / 1024)} KB`,
      );
    }
  }),
);
await writeFile(
  resolve(root, "credits.json"),
  JSON.stringify(credits, null, 2) + "\n",
);
