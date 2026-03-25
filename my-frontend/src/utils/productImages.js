import { API_BASE_URL } from "../services/api";

const ABSOLUTE_URL = /^https?:\/\//i;
const DATA_URL = /^data:/i;
const LEGACY_PLACEHOLDER_HOSTS = ["via.placeholder.com", "placehold.co", "dummyimage.com"];

const encodeSvg = (svg) =>
  `data:image/svg+xml,${encodeURIComponent(svg).replace(/%0A/g, "").replace(/%20/g, " ")}`;

export const buildProductFallbackImage = (name = "Product", category = "General") => {
  const safeName = String(name || "Product").slice(0, 30);
  const safeCategory = String(category || "General").slice(0, 20);
  const initials = safeName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='900' height='600' viewBox='0 0 900 600'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#1d4ed8'/>
      <stop offset='100%' stop-color='#0ea5e9'/>
    </linearGradient>
  </defs>
  <rect width='900' height='600' fill='url(#g)'/>
  <circle cx='450' cy='260' r='110' fill='rgba(255,255,255,0.16)'/>
  <text x='450' y='275' text-anchor='middle' fill='white' font-size='84' font-family='Segoe UI, Arial' font-weight='700'>${initials || "P"}</text>
  <text x='450' y='420' text-anchor='middle' fill='white' font-size='42' font-family='Segoe UI, Arial' font-weight='700'>${safeName}</text>
  <text x='450' y='470' text-anchor='middle' fill='rgba(255,255,255,0.92)' font-size='28' font-family='Segoe UI, Arial'>${safeCategory}</text>
</svg>`;
  return encodeSvg(svg);
};

export const normalizeProductImageUrl = (rawImage) => {
  if (!rawImage) return "";
  const candidate = String(rawImage).split(",")[0].trim();
  if (!candidate) return "";
  if (DATA_URL.test(candidate) || ABSOLUTE_URL.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (LEGACY_PLACEHOLDER_HOSTS.includes(url.hostname.toLowerCase())) {
        return "";
      }
    } catch (error) {
      // keep candidate for invalid but absolute-like values
    }
    return candidate;
  }
  if (candidate.startsWith("/")) {
    return `${API_BASE_URL}${candidate}`;
  }
  return `${API_BASE_URL}/${candidate}`;
};

export const resolveProductImage = (item) => {
  const url = normalizeProductImageUrl(item?.image || item?.images);
  return url || "";
};
