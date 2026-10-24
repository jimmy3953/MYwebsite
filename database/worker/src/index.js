import ExcelJS from "exceljs";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowList = String(env.ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
  const allowed = allowList.includes(origin) ? origin : (allowList.length ? "" : "*");
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function response(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request, env) }
  });
}

function authorized(request, env) {
  const configured = String(env.ADMIN_API_KEY || "");
  const incoming = request.headers.get("Authorization") || "";
  return configured.length >= 24 && incoming === `Bearer ${configured}`;
}

function githubHeaders(env, extra = {}) {
  return {
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "CDWS-Workbook-CRUD",
    ...extra
  };
}

function contentsUrl(env) {
  const path = String(env.WORKBOOK_PATH || "CDWS_Database.xlsx")
    .split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
}

function decodeBase64(value) {
  const binary = atob(String(value).replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadWorkbook(env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || !env.WORKBOOK_PATH) {
    throw new Error("Worker configuration is incomplete. Check the GitHub secrets and variables.");
  }
  const res = await fetch(contentsUrl(env), { headers: githubHeaders(env) });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub workbook read failed (${res.status}): ${result.message || "Unknown error"}`);
  if (result.encoding !== "base64" || !result.content) {
    throw new Error("GitHub did not return a base64 workbook. Check file size and WORKBOOK_PATH.");
  }
  if (String(env.WORKBOOK_PATH).toLowerCase().endsWith(".xlsm")) {
    throw new Error("This Worker uses ExcelJS and is configured for .xlsx files. Do not use it on .xlsm files because VBA macros may not be preserved.");
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(decodeBase64(result.content));
  return { workbook, sha: result.sha };
}

function headersFor(worksheet) {
  const headerRow = worksheet.getRow(1);
  const max = Math.min(Math.max(worksheet.columnCount, headerRow.cellCount, 1), 200);
  const used = new Set();
  const fields = [];
  for (let column = 1; column <= max; column++) {
    const cell = headerRow.getCell(column);
    const label = String(cell.text || cell.value || "").trim();
    if (!label) continue;
    let key = label;
    let suffix = 2;
    while (used.has(key)) key = `${label} (${suffix++})`;
    used.add(key);
    fields.push({ column, label, key });
  }
  return fields;
}

function cellToText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map(p => p.text || "").join("");
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
    if (value.hyperlink) return String(value.text || value.hyperlink);
    return "";
  }
  return String(value);
}

function rowsFor(worksheet, fields) {
  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const record = {};
    let populated = false;
    for (const field of fields) {
      const value = cellToText(row.getCell(field.column).value);
      record[field.key] = value;
      if (value !== "") populated = true;
    }
    if (populated) rows.push({ rowNumber, record });
  }
  return rows;
}

function findWorksheet(workbook, name) {
  const worksheet = workbook.getWorksheet(name);
  if (!worksheet) throw new Error(`Worksheet "${name}" was not found in the workbook.`);
  return worksheet;
}

function checkConfig(env) {
  return env.GITHUB_TOKEN && env.ADMIN_API_KEY && String(env.ADMIN_API_KEY).length >= 24;
}

async function saveWorkbook(env, workbook, sha, message) {
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const body = {
    message: String(message || "Update CDWS workbook through CRUD admin").slice(0, 120),
    content: encodeBase64(bytes),
    sha,
    branch: env.GITHUB_BRANCH || "main"
  };
  const res = await fetch(contentsUrl(env), {
    method: "PUT",
    headers: githubHeaders(env, { "Content-Type": "application/json" }),
    body: JSON.stringify(body)
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 409 || res.status === 422) {
      throw new Error("The workbook changed while this operation was running. Refresh the records and retry.");
    }
    throw new Error(`GitHub workbook save failed (${res.status}): ${result.message || "Unknown error"}`);
  }
  return result;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") {
      return response(request, env, { ok: true, service: "CDWS workbook CRUD API" });
    }

    if (!checkConfig(env)) {
      return response(request, env, { ok: false, error: "Worker secrets are not configured. Set GITHUB_TOKEN and ADMIN_API_KEY (minimum 24 characters)." }, 500);
    }

    if (!authorized(request, env)) {
      return response(request, env, { ok: false, error: "Unauthorized. Enter the admin API key configured in Cloudflare Worker secrets." }, 401);
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/tables") {
        const { workbook } = await loadWorkbook(env);
        return response(request, env, {
          ok: true,
          tables: workbook.worksheets.map(ws => ({
            name: ws.name,
            headers: headersFor(ws).map(field => field.key),
            rowCount: rowsFor(ws, headersFor(ws)).length
          }))
        });
      }

      if (request.method === "GET" && url.pathname === "/api/records") {
        const sheetName = url.searchParams.get("sheet") || "";
        if (!sheetName) return response(request, env, { ok: false, error: "Choose a worksheet." }, 400);
        const { workbook } = await loadWorkbook(env);
        const worksheet = findWorksheet(workbook, sheetName);
        const fields = headersFor(worksheet);
        return response(request, env, {
          ok: true,
          sheet: sheetName,
          headers: fields.map(field => field.key),
          rows: rowsFor(worksheet, fields)
        });
      }

      if (request.method === "POST" && url.pathname === "/api/records") {
        const body = await request.json();
        const action = String(body.action || "").toLowerCase();
        const sheetName = String(body.sheet || "");
        if (!sheetName) return response(request, env, { ok: false, error: "Choose a worksheet." }, 400);

        const { workbook, sha } = await loadWorkbook(env);
        const worksheet = findWorksheet(workbook, sheetName);
        const fields = headersFor(worksheet);

        if (!fields.length) {
          return response(request, env, { ok: false, error: "The worksheet needs column headers in row 1 before CRUD can be used." }, 400);
        }

        if (action === "create") {
          const nextRow = worksheet.getRow(Math.max(worksheet.rowCount + 1, 2));
          for (const field of fields) {
            const value = body.record && Object.prototype.hasOwnProperty.call(body.record, field.key)
              ? body.record[field.key]
              : "";
            nextRow.getCell(field.column).value = value == null ? "" : String(value);
          }
          nextRow.commit();
        } else {
          const rowNumber = Number(body.rowNumber);
          if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > worksheet.rowCount) {
            return response(request, env, { ok: false, error: "Invalid row number. Refresh the list and select a row again." }, 400);
          }

          if (action === "update") {
            const row = worksheet.getRow(rowNumber);
            const record = body.record || {};
            for (const field of fields) {
              if (Object.prototype.hasOwnProperty.call(record, field.key)) {
                row.getCell(field.column).value = record[field.key] == null ? "" : String(record[field.key]);
              }
            }
            row.commit();
          } else if (action === "delete") {
            worksheet.spliceRows(rowNumber, 1);
          } else {
            return response(request, env, { ok: false, error: "Unsupported action. Use create, update, or delete." }, 400);
          }
        }

        const saved = await saveWorkbook(env, workbook, sha, `CDWS workbook: ${action} record in ${sheetName}`);
        return response(request, env, { ok: true, action, commit: saved.commit && saved.commit.sha ? saved.commit.sha : null });
      }

      return response(request, env, { ok: false, error: "Route not found." }, 404);
    } catch (error) {
      return response(request, env, { ok: false, error: String(error && error.message || error) }, 500);
    }
  }
};
