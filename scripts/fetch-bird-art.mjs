import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIR = path.join(ROOT, "assets", "birds");
const DATA_FILE = path.join(ROOT, "data", "bird-art.json");
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// Each work was checked against the species name or a documented historical synonym.
// Run this script only when intentionally refreshing the checked-in local copies.
const works = [
  {
    scientificName: "Prinia socialis",
    commonName: "Ashy Prinia",
    file: "File:Ashy Prinia.svg",
    artist: "Mahesh Iyer",
    date: "2010",
    collection: "Wikimedia Commons",
    historical: false,
    note: "Open field illustration. The British Library's 1798–1805 watercolor is catalogued but not digitized.",
  },
  { scientificName: "Eudynamys scolopaceus", commonName: "Asian Koel", file: "File:Eudynamys horonata - 1700-1880 - Print - Iconographia Zoologica - Special Collections University of Amsterdam - UBA01 IZ18800313.tif", artist: "François-Nicolas Martinet", date: "18th–19th century", collection: "Iconographia Zoologica, University of Amsterdam" },
  { scientificName: "Parus cinereus", commonName: "Asian Tit", file: "File:Parus cinereus 1838.jpg", artist: "Nicolas Huet / Jean-Gabriel Prêtre", date: "1838", collection: "Nouveau recueil de planches coloriées d'oiseaux" },
  { scientificName: "Riparia riparia", commonName: "Bank Swallow", file: "File:Coloured illustrations of British birds, and their eggs (Pl. 35) (7830893290).jpg", artist: "H. L. Meyer", date: "1842", collection: "Coloured Illustrations of British Birds" },
  { scientificName: "Hirundo rustica", commonName: "Barn Swallow", file: "File:Coloured illustrations of British birds, and their eggs (Pl. 33) (7830890952).jpg", artist: "H. L. Meyer", date: "1842", collection: "Coloured Illustrations of British Birds" },
  { scientificName: "Milvus migrans", commonName: "Black Kite", file: "File:Milvus Migrans.tif", artist: "John Gould", date: "1873", collection: "The Birds of Great Britain" },
  { scientificName: "Phoenicurus ochruros", commonName: "Black Redstart", file: "File:Phoenicurus ochruros gibraltariensis John Gould. The birds of Great Britain.jpg", artist: "John Gould", date: "1873", collection: "The Birds of Great Britain" },
  { scientificName: "Nycticorax nycticorax", commonName: "Black-crowned Night Heron", file: "File:Nycticorax nycticorax 1905.jpg", artist: "Unknown artist", date: "1905", collection: "Wikimedia Commons" },
  { scientificName: "Cuculus canorus", commonName: "Common Cuckoo", file: "File:Die Vögel Europas (Pl. 24) BHL47804297.jpg", artist: "Friedrich Arnold", date: "1897", collection: "Biodiversity Heritage Library" },
  { scientificName: "Upupa epops", commonName: "Common Hoopoe", file: "File:Dudek chocholatý (Upupa epops) – Necsey – Velký atlas ptáků – 1911.jpg", artist: "István Nécsey", date: "before 1902", collection: "Velký atlas ptáků" },
  { scientificName: "Actitis hypoleucos", commonName: "Common Sandpiper", file: "File:Common Sandpiper (Actitis hypoleucos).jpg", artist: "Unknown artist", date: "1900", collection: "Birds at Home" },
  { scientificName: "Gallinago gallinago", commonName: "Common Snipe", file: "File:British birds (1915) (20228641310).jpg", artist: "Archibald Thorburn", date: "1915", collection: "British Birds" },
  { scientificName: "Orthotomus sutorius", commonName: "Common Tailorbird", file: "File:Orthotomus sutorius edela 1838.jpg", artist: "Nicolas Huet / Jean-Gabriel Prêtre", date: "1838", collection: "Nouveau recueil de planches coloriées d'oiseaux" },
  { scientificName: "Tyto javanica", commonName: "Eastern Barn Owl", file: "File:StrixIndicaGould.jpg", artist: "John Gould / H. C. Richter", date: "1850–1883", collection: "The Birds of Asia" },
  { scientificName: "Cecropis daurica", commonName: "Eastern Red-rumped Swallow", file: "File:Cecropis daurica (rufula) Dresser - ro.jpg", artist: "H. E. Dresser", date: "1871–1881", collection: "A History of the Birds of Europe" },
  { scientificName: "Streptopelia decaocto", commonName: "Eurasian Collared-Dove", file: "File:Columba decaocto Frivaldski.jpg", artist: "Imre Frivaldszky", date: "1838", collection: "Wikimedia Commons" },
  { scientificName: "Fulica atra", commonName: "Eurasian Coot", file: "File:Nederlandsche vogelen (KB) - Fulica atra (062a).jpg", artist: "Cornelius Nozeman / Christiaan Sepp", date: "1770–1829", collection: "Nederlandsche Vogelen" },
  { scientificName: "Ptyonoprogne rupestris", commonName: "Eurasian Crag-Martin", file: "File:Ptyonoprogne rupestris 1894.jpg", artist: "Richard Bowdler Sharpe", date: "1894", collection: "Wikimedia Commons" },
  { scientificName: "Numenius arquata", commonName: "Eurasian Curlew", file: "File:Numenius arquata - 1800-1812 - Print - Iconographia Zoologica - Special Collections University of Amsterdam - UBA01 IZ17400041.tif", artist: "Unknown artist", date: "1800–1812", collection: "Iconographia Zoologica, University of Amsterdam" },
  { scientificName: "Ardea cinerea", commonName: "Gray Heron", file: "File:Naturalis Biodiversity Center - RMNH.ART.456 - Ardea cinerea - Yūshi Ishizaki - Cock Blomhoff Collection - pencil drawing - water colour.jpg", artist: "Ishizaki Yūshi", date: "1817–1823", collection: "Naturalis Biodiversity Center" },
  { scientificName: "Motacilla cinerea", commonName: "Gray Wagtail", file: "File:Nederlandsche vogelen (KB) - Motacilla cinerea (432b).jpg", artist: "Cornelius Nozeman / Christiaan Sepp", date: "1770–1829", collection: "Nederlandsche Vogelen" },
  { scientificName: "Passer domesticus", commonName: "House Sparrow", file: "File:British birds (1915) (20408015492).jpg", artist: "Archibald Thorburn", date: "1915", collection: "British Birds" },
  { scientificName: "Ocyceros birostris", commonName: "Indian Gray Hornbill", file: "File:A monograph of the Bucerotidæ, or family of the hornbills (Plate XLVIII) (6944168160).jpg", artist: "Daniel Giraud Elliot", date: "1882", collection: "A Monograph of the Hornbills" },
  { scientificName: "Zosterops palpebrosus", commonName: "Indian White-eye", file: "File:Zosterops palpebrosus 1838.jpg", artist: "Nicolas Huet / Jean-Gabriel Prêtre", date: "1838", collection: "Nouveau recueil de planches coloriées d'oiseaux" },
  { scientificName: "Tachybaptus ruficollis", commonName: "Little Grebe", file: "File:Nederlandsche vogelen (KB) - Tachybaptus ruficollis (231pl).jpg", artist: "Cornelius Nozeman / Christiaan Sepp", date: "1770–1829", collection: "Nederlandsche Vogelen" },
  { scientificName: "Pycnonotus cafer", commonName: "Red-vented Bulbul", file: "File:Pycnonotus cafer - 1700-1880 - Print - Iconographia Zoologica - Special Collections University of Amsterdam - UBA01 IZ16400013.tif", artist: "Unknown artist", date: "18th–19th century", collection: "Iconographia Zoologica, University of Amsterdam" },
  { scientificName: "Vanellus indicus", commonName: "Red-wattled Lapwing", file: "File:Redwattledlapwing gwillim.jpg", artist: "Elizabeth Gwillim", date: "1801", collection: "Gwillim natural-history drawings" },
  { scientificName: "Pycnonotus jocosus", commonName: "Red-whiskered Bulbul", file: "File:Pycnonotus jocosus - 1700-1880 - Print - Iconographia Zoologica - Special Collections University of Amsterdam - UBA01 IZ16400029.tif", artist: "Unknown artist", date: "18th–19th century", collection: "Iconographia Zoologica, University of Amsterdam" },
  { scientificName: "Psittacula krameri", commonName: "Rose-ringed Parakeet", file: "File:Levaillant Parrot 22.jpg", artist: "Jacques Barraband", date: "1801", collection: "Histoire naturelle des perroquets" },
  { scientificName: "Caprimulgus affinis", commonName: "Savanna Nightjar", file: "File:CaprimulgusGriseatusKeulemans.jpg", artist: "John Gerrard Keulemans", date: "1892", collection: "Wikimedia Commons" },
  { scientificName: "Muscicapa striata", commonName: "Spotted Flycatcher", file: "File:Natural History, Birds - Flycatcher.jpg", artist: "Philip Henry Gosse", date: "1849", collection: "Natural History: Birds" },
  { scientificName: "Anthus trivialis", commonName: "Tree Pipit", file: "File:GouldBirdsEuropeIITree Pipit.jpg", artist: "John Gould / Edward Lear", date: "1837", collection: "The Birds of Europe" },
  { scientificName: "Motacilla alba", commonName: "White Wagtail", file: "File:Selby's Illustrations of British ornithology Volume 1 Land birds Plate III.jpg", artist: "Prideaux John Selby", date: "1833", collection: "Illustrations of British Ornithology" },
  { scientificName: "Motacilla maderaspatensis", commonName: "White-browed Wagtail", file: "File:MotacillaMaderaspatensis.jpg", artist: "W. T. Blanford / E. W. Oates", date: "1890", collection: "The Fauna of British India" },
  { scientificName: "Cisticola juncidis", commonName: "Zitting Cisticola", file: "File:PriniaCursitansJerdon.jpg", artist: "C. V. Kistnarajoo", date: "1847", collection: "Illustrations of Indian Ornithology" },
  { scientificName: "Oriolus chinensis", commonName: "Black-naped Oriole", file: "File:OriolusSinensisJerdon.jpg", artist: "C. V. Kistnarajoo", date: "1847", collection: "Illustrations of Indian Ornithology" },
  { scientificName: "Ninox scutulata", commonName: "Brown Boobook", file: "File:Ninox scutulata 1838 (1).jpg", artist: "Nicolas Huet / Jean-Gabriel Prêtre", date: "1838", collection: "Nouveau recueil de planches coloriées d'oiseaux" },
  { scientificName: "Tringa nebularia", commonName: "Common Greenshank", file: "File:Nederlandsche vogelen (KB) - Tringa nebularia (318b).jpg", artist: "Cornelius Nozeman / Christiaan Sepp", date: "1770–1829", collection: "Nederlandsche Vogelen" },
  { scientificName: "Alcedo atthis", commonName: "Common Kingfisher", file: "File:Coloured illustrations of British birds, and their eggs (Pl. 39) (7830899678).jpg", artist: "H. L. Meyer", date: "1842", collection: "Coloured Illustrations of British Birds" },
  { scientificName: "Spilornis cheela", commonName: "Crested Serpent-Eagle", file: "File:Crestedserpenteagle Gwillim.jpg", artist: "Elizabeth Gwillim", date: "1801", collection: "Gwillim natural-history drawings" },
  { scientificName: "Falco subbuteo", commonName: "Eurasian Hobby", file: "File:Falco subbuteo Falco biarmicus Falco tinnunculus.jpg", artist: "Jacques Christophe Werner", date: "1824", collection: "Wikimedia Commons" },
  { scientificName: "Phoenicopterus roseus", commonName: "Greater Flamingo", file: "File:Mark Catesby, The Flamingo (Phoenicopterus ruber), published 1731-1743, NGA 73652.jpg", artist: "Mark Catesby", date: "1731–1743", collection: "National Gallery of Art" },
  { scientificName: "Terpsiphone paradisi", commonName: "Indian Paradise-Flycatcher", file: "File:TerpsiphoneParadisiJerdon.jpg", artist: "C. V. Kistnarajoo", date: "1847", collection: "Illustrations of Indian Ornithology" },
  { scientificName: "Anthus richardi", commonName: "Richard's Pipit", file: "File:Anthus richardi - 1825-1830 - Print - Iconographia Zoologica - Special Collections University of Amsterdam - UBA01 IZ16300153.tif", artist: "Polydore Roux", date: "1825–1830", collection: "Iconographia Zoologica, University of Amsterdam" },
  { scientificName: "Dendrocitta vagabunda", commonName: "Rufous Treepie", file: "File:Dendrocitta vagabunda Hardwicke.jpg", artist: "Thomas Hardwicke", date: "1830–1832", collection: "Hardwicke natural-history drawings" },
  { scientificName: "Lonchura punctulata", commonName: "Scaly-breasted Munia", file: "File:Lonchura punctulata nisoria 1838.jpg", artist: "Nicolas Huet / Jean-Gabriel Prêtre", date: "1838", collection: "Nouveau recueil de planches coloriées d'oiseaux" },
  { scientificName: "Ardea ibis", commonName: "Western Cattle-Egret", file: "File:British birds (1915) (20390434076).jpg", artist: "Archibald Thorburn", date: "1915", collection: "British Birds" },
  { scientificName: "Motacilla flava", commonName: "Western Yellow Wagtail", file: "File:Yellow Wagtail woodcut in Bewick British Birds 1797.jpg", artist: "Thomas Bewick", date: "1797", collection: "A History of British Birds" },
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extensionFor(contentType) {
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/webp")) return ".webp";
  return ".jpg";
}

async function retry(task, attempts = 7) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function commonsRecord(title) {
  const url = new URL(COMMONS_API);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
    titles: title,
    origin: "*",
  });
  const response = await retry(async () => {
    const result = await fetch(url, { headers: { "user-agent": "abhishekdoesstuff.com bird-art fetcher" } });
    if (!result.ok) throw new Error(`Commons returned ${result.status} for ${title}`);
    return result;
  });
  const payload = await response.json();
  const page = payload?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!page || page.missing || !info?.thumburl) throw new Error(`No image found for ${title}`);
  return {
    imageUrl: info.thumburl,
    pageUrl: info.descriptionurl,
    license: info.extmetadata?.LicenseShortName?.value || info.extmetadata?.UsageTerms?.value || "See source",
    licenseUrl: info.extmetadata?.LicenseUrl?.value || info.descriptionurl,
  };
}

await mkdir(ASSET_DIR, { recursive: true });
await mkdir(path.dirname(DATA_FILE), { recursive: true });

const manifest = [];
let existingByName = new Map();
try {
  const existing = JSON.parse(await readFile(DATA_FILE, "utf8"));
  existingByName = new Map(existing.map((entry) => [entry.scientific_name, entry]));
} catch {
  // First run: there is no checked-in manifest yet.
}

for (const [index, work] of works.entries()) {
  const existing = existingByName.get(work.scientificName);
  if (existing && process.env.BIRD_ART_REFRESH !== "1") {
    try {
      await access(path.join(ROOT, existing.image.replace(/^\//, "")));
      manifest.push(existing);
      process.stdout.write(`[${index + 1}/${works.length}] ${work.commonName} (cached)\n`);
      continue;
    } catch {
      // The manifest entry exists but its local file does not; fetch it again.
    }
  }
  const record = await commonsRecord(work.file);
  const response = await retry(async () => {
    const result = await fetch(record.imageUrl, { headers: { "user-agent": "abhishekdoesstuff.com bird-art fetcher" } });
    if (!result.ok) throw new Error(`Image returned ${result.status} for ${work.file}`);
    return result;
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const filename = `${slug(work.scientificName)}${extensionFor(response.headers.get("content-type") || "")}`;
  await writeFile(path.join(ASSET_DIR, filename), bytes);
  manifest.push({
    scientific_name: work.scientificName,
    common_name: work.commonName,
    image: `/assets/birds/${filename}`,
    artwork: {
      title: work.file.replace(/^File:/, "").replace(/\.[^.]+$/, ""),
      artist: work.artist,
      date: work.date,
      collection: work.collection,
      historical: work.historical !== false,
      note: work.note || undefined,
      source_url: record.pageUrl,
      license: record.license,
      license_url: record.licenseUrl,
    },
  });
  process.stdout.write(`[${index + 1}/${works.length}] ${work.commonName}\n`);
  await new Promise((resolve) => setTimeout(resolve, 1800));
}

await writeFile(DATA_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifest.length} artworks to ${path.relative(ROOT, DATA_FILE)}`);
