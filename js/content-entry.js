document.addEventListener("DOMContentLoaded", () => {
  const apiBase = String(window.CDWS_DATABASE_API || "").replace(/\/+$/, "");
  const connectSection = document.querySelector("#contentConnectSection");
  const entrySection = document.querySelector("#contentEntrySection");
  const contentForm = document.querySelector("#contentForm");
  const saveButton = document.querySelector("#contentSaveButton");
  const statusBox = document.querySelector("#contentStatusMessage");
  let adminKey = "";
  const year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  function setStatus(message, kind = "") {
    statusBox.textContent = message;
    statusBox.className = "db-status" + (kind ? " " + kind : "");
  }

  async function api(path, options = {}) {
    const response = await fetch(apiBase + path, {
      ...options,
      headers: {
        "Authorization": "Bearer " + adminKey,
        ...(options.body ? { "Content-Type": "application/json" } : {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || "Database request failed (" + response.status + ").");
    }
    return payload;
  }

  async function connect() {
    if (!apiBase || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(apiBase)) {
      throw new Error("Open this page from the local server at http://127.0.0.1:3000.");
    }
    const sessionResponse = await fetch(apiBase + "/api/session", { cache: "no-store" });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok || !session.adminKey) {
      throw new Error(session.error || "The local server could not create an admin session.");
    }
    adminKey = session.adminKey;
    const data = await api("/api/tables");
    const sheet = (data.tables || []).find(table => table.name === "Website Content");
    if (!sheet) throw new Error('The workbook does not contain a "Website Content" worksheet.');
    const requiredHeaders = ["Page", "Section", "Title", "Content", "Category", "Display Order", "Status"];
    const missing = requiredHeaders.filter(header => !sheet.headers.includes(header));
    if (missing.length) throw new Error("Missing worksheet columns: " + missing.join(", ") + ".");
    connectSection.hidden = true;
    entrySection.hidden = false;
    setStatus("Connected. New records will be saved to the local workbook.", "success");
  }

  connect().catch(error => {
    connectSection.hidden = false;
    entrySection.hidden = true;
    setStatus(error.message + " Start the Python server and reload this page.", "error");
  });

  contentForm.addEventListener("submit", async event => {
    event.preventDefault();
    const record = Object.fromEntries(new FormData(contentForm).entries());
    saveButton.disabled = true;
    setStatus("Saving content to the workbook...");
    try {
      await api("/api/records", {
        method: "POST",
        body: JSON.stringify({ action: "create", sheet: "Website Content", record })
      });
      contentForm.reset();
      document.querySelector("#contentOrder").value = "0";
      setStatus("Content saved as a new record in CDWS_Database.xlsx.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      saveButton.disabled = false;
    }
  });

  document.querySelector("#contentDisconnectButton").addEventListener("click", () => {
    adminKey = "";
    entrySection.hidden = true;
    connectSection.hidden = false;
    setStatus("Disconnected. Reload this page to connect automatically.");
  });
});
