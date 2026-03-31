const BASE_URL = "https://pro-api.solscan.io/v2.0";

function buildUrl(path, params = {}) {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === "") continue;
        url.searchParams.append(`${key}[]`, String(item));
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function solscanGet(path, params = {}) {
  const apiKey = process.env.SOLSCAN_API_KEY;
  if (!apiKey) {
    throw new Error("SOLSCAN_API_KEY が未設定です");
  }

  const url = buildUrl(path, params);
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      token: apiKey,
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Solscan の応答を JSON として読めませんでした: ${text.slice(0, 200)}`
    );
  }

  if (!res.ok || json?.success === false) {
    const msg =
      json?.errors?.message ||
      json?.message ||
      `Solscan API error (${res.status})`;
    throw new Error(msg);
  }

  return json;
}

export async function getAccountBalanceChanges({
  address,
  token,
  page = 1,
  pageSize = 100,
  flow,
  sortOrder = "desc",
}) {
  const params = {
    address,
    token,
    page,
    page_size: pageSize,
    sort_by: "block_time",
    sort_order: sortOrder,
  };
  if (flow) params.flow = flow;
  const json = await solscanGet("/account/balance_change", params);
  return Array.isArray(json?.data) ? json.data : [];
}

export async function fetchAllBalanceChanges({
  address,
  token,
  maxItems = 1000,
  flow,
}) {
  const out = [];
  const pageSize = 100;
  let page = 1;

  while (out.length < maxItems) {
    const rows = await getAccountBalanceChanges({
      address,
      token,
      page,
      pageSize,
      flow,
    });
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
    page += 1;
  }

  return out.slice(0, maxItems);
}
