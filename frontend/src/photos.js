// Replace only Member 1's known random Picsum seed images. Host photos are preserved.
const albums = {
  "shoreditch-loft": ["loft", "warmBedroom"],
  "greenwich-house": ["familyHouse", "designerLoft"],
  "kings-cross-studio": ["studio", "sunnyRoom"],
  "edinburgh-old-town": ["cityApartment", "warmBedroom"],
  "loch-cabin": ["forestCabin", "sunnyRoom"],
  "manchester-nq": ["modernApartment", "guestRoom"],
  "lake-cottage": ["cottage", "sunnyRoom"],
  montmartre: ["parisApartment", "warmBedroom"],
  "marais-loft": ["designerLoft", "loft"],
  "gothic-quarter": ["terraceHome", "parisApartment"],
  "sitges-villa": ["poolVilla", "designerLoft"],
  jordaan: ["guestRoom", "sunnyRoom"],
  trastevere: ["warmBedroom", "cityApartment"],
  alfama: ["sunnyRoom", "studio"],
  "goa-villa": ["tropicalVilla", "poolVilla"],
  bandra: ["coastalApartment", "modernApartment"],
  "jaipur-haveli": ["courtyardHotel", "guestRoom"],
  brooklyn: ["brownstoneInterior", "loft"],
  "banff-cabin": ["mountainCabin", "sunnyRoom"],
  "bondi-house": ["beachHouse", "coastalApartment"],
};

export function samplePhoto(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== "picsum.photos") return null;
    const match = url.pathname.match(/^\/seed\/(.+)-(\d+)\//);
    const album = match && albums[match[1]];
    if (!album) return null;
    const photo = album[(Number(match[2]) - 1) % album.length];
    return `/images/stays/${photo}-1920.webp`;
  } catch {
    return null;
  }
}

export function withPhotoAssets(value) {
  if (Array.isArray(value)) return value.map(withPhotoAssets);
  if (!value || typeof value !== "object") return value;
  const result = { ...value };
  if (Array.isArray(result.imageUrls)) {
    const mapped = result.imageUrls.map((url) => samplePhoto(url));
    if (mapped.some(Boolean)) {
      result.imageUrls = result.imageUrls.map(
        (url, index) => mapped[index] || url,
      );
      result.illustrativePhotos = true;
    }
  }
  if (result.listing) result.listing = withPhotoAssets(result.listing);
  return result;
}

export function photoAttributes(
  url,
  sizes = "(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw",
) {
  if (!/^\/images\/stays\/[a-zA-Z]+-1920\.webp$/.test(url || ""))
    return 'decoding="async"';
  return `decoding="async" srcset="${url.replace("-1920.webp", "-640.webp")} 640w, ${url} 1920w" sizes="${sizes}"`;
}
