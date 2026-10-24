/* CDWS workbook CRUD client. The GitHub token is never used in this browser. */
document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector) => document.querySelector(selector);
  const apiInput = $("#apiUrl");
  const keyInput = $("#adminKey");
  const connectButton = $("#connectButton");
  const disconnectButton = $("#disconnectButton");
  const refreshButton = $("#refreshButton");
  const newButton = $("#newButton");
  const sheetSelect = $("#sheetSelect");
  const statusBox = $("#dbStatus");
  const table = $("#recordsTable");
  const summary = $("#recordsSummary");
  const recordForm = $("#recordForm");
  const recordFields = $("#recordFields");
  const saveButton = $("#saveButton");
  const clearButton = $("#clearButton");
  const deleteButton = $("#deleteButton");
  const editorTitle = $("#editorTitle");
  const selectedRecordLabel = $("#selectedRecordLabel");

  let apiBase = "";
  let adminKey = "";
  let currentSheet = "";
  let headers = [];
  let rows = [];
  let selectedRowNumber = null;

  if (window.CDWS_DATABASE_API) apiInput.value = window.CDWS_DATABASE_API;
  const year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  function setStatus(message, kind = "") {
    statusBox.textContent = message;
    statusBox.className = "db-status" + (kind ? " " + kind : "");
  }

  function escapeText(value) {
    return String(value == null ? "" : value);
  }

  async function api(path, options = {}) {
    if (!apiBase || !adminKey) throw new Error("Connect to the API first.");
    const response = await fetch(apiBase + path, {
      ...options,
      headers: {
        "Authorization": "Bearer " + adminKey,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || "Database request failed (" + response.status + ").");
    }
    return payload;
  }

  function setConnected(connected) {
    refreshButton.disabled = !connected;
    newButton.disabled = !connected;
    sheetSelect.disabled = !connected;
    if (!connected) {
      saveButton.disabled = true;
      clearButton.disabled = true;
      deleteButton.disabled = true;
    }
  }

  async function connect() {
    const rawUrl = apiInput.value.trim().replace(/\/+$/, "");
    const key = keyInput.value;
    if (!rawUrl || !/^https:\/\//i.test(rawUrl)) {
      setStatus("Enter the deployed HTTPS Cloudflare Worker URL.", "error");
      return;
    }
    if (!key) {
      setStatus("Enter the admin API key you configured in Cloudflare.", "error");
      return;
    }
    apiBase = rawUrl;
    adminKey = key;
    connectButton.disabled = true;
    setStatus("Connecting and loading worksheet names…");
    try {
      const data = await api("/api/tables");
      sheetSelect.replaceChildren();
      if (!data.tables || data.tables.length === 0) {
        throw new Error("The workbook contains no worksheets.");
      }
      data.tables.forEach(item => {
        const option = document.createElement("option");
        option.value = item.name;
        option.textContent = item.name + " (" + item.rowCount + ")";
        sheetSelect.appendChild(option);
      });
      setConnected(true);
      currentSheet = sheetSelect.value;
      await loadRecords();
      setStatus("Connected. Changes are committed to CDWS_Database.xlsx on GitHub.", "success");
    } catch (error) {
      apiBase = "";
      adminKey = "";
      setConnected(false);
      setStatus(error.message, "error");
    } finally {
      connectButton.disabled = false;
    }
  }

  async function loadRecords() {
    if (!apiBase || !adminKey) return;
    currentSheet = sheetSelect.value;
    if (!currentSheet) return;
    setStatus("Loading records from " + currentSheet + "…");
    try {
      const data = await api("/api/records?sheet=" + encodeURIComponent(currentSheet));
      headers = data.headers || [];
      rows = data.rows || [];
      selectedRowNumber = null;
      renderTable();
      renderFields(null);
      setStatus("Loaded " + rows.length + " record(s) from " + currentSheet + ".", "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  function renderTable() {
    table.replaceChildren();
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headers.forEach(header => {
      const th = document.createElement("th");
      th.textContent = header;
      headRow.appendChild(th);
    });
    const actionHead = document.createElement("th");
    actionHead.textContent = "Action";
    headRow.appendChild(actionHead);
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    if (!headers.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 1;
      td.textContent = "This worksheet has no headers in row 1. Add column headers to the workbook first.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = headers.length + 1;
      td.textContent = "No records yet. Use “New record” to create the first row.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      rows.forEach(item => {
        const tr = document.createElement("tr");
        if (item.rowNumber === selectedRowNumber) tr.classList.add("db-row-selected");
        headers.forEach(header => {
          const td = document.createElement("td");
          td.textContent = escapeText(item.record[header]);
          tr.appendChild(td);
        });
        const actionTd = document.createElement("td");
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Edit";
        edit.addEventListener("click", () => {
          selectedRowNumber = item.rowNumber;
          renderTable();
          renderFields(item);
          $("#editorSection").scrollIntoView({ behavior: "smooth", block: "start" });
        });
        actionTd.appendChild(edit);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    summary.textContent = currentSheet
      ? currentSheet + " · " + rows.length + " record(s) · " + headers.length + " column(s)"
      : "No worksheet loaded.";
  }

  function renderFields(item) {
    recordFields.replaceChildren();
    const isEditing = Boolean(item);
    editorTitle.textContent = isEditing ? "Edit record" : "Create new record";
    selectedRecordLabel.textContent = isEditing ? "Row " + item.rowNumber + " selected" : "No row selected";
    saveButton.textContent = isEditing ? "Save changes" : "Create record";
    saveButton.disabled = !apiBase || !adminKey || !headers.length;
    clearButton.disabled = !apiBase || !headers.length;
    deleteButton.disabled = !isEditing;
    if (!headers.length) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = "This worksheet needs column headers in row 1 before records can be edited.";
      recordFields.appendChild(note);
      saveButton.disabled = true;
      clearButton.disabled = true;
      return;
    }

    headers.forEach(header => {
      const wrapper = document.createElement("div");
      wrapper.className = "field";
      if (headers.length === 1) wrapper.classList.add("full");
      const label = document.createElement("label");
      label.textContent = header;
      const longText = /message|description|content|notes|summary|details|address/i.test(header);
      const input = document.createElement(longText ? "textarea" : "input");
      if (!longText) input.type = "text";
      input.name = header;
      input.dataset.fieldKey = header;
      input.value = isEditing ? escapeText(item.record[header]) : "";
      label.htmlFor = "db-field-" + headers.indexOf(header);
      input.id = label.htmlFor;
      wrapper.append(label, input);
      recordFields.appendChild(wrapper);
    });
  }

  function readForm() {
    const record = {};
    recordFields.querySelectorAll("[data-field-key]").forEach(input => {
      record[input.dataset.fieldKey] = input.value;
    });
    return record;
  }

  function resetEditor() {
    selectedRowNumber = null;
    renderTable();
    renderFields(null);
  }

  connectButton.addEventListener("click", connect);
  disconnectButton.addEventListener("click", () => {
    apiBase = "";
    adminKey = "";
    keyInput.value = "";
    setConnected(false);
    sheetSelect.replaceChildren(new Option("Connect first", ""));
    currentSheet = "";
    headers = [];
    rows = [];
    selectedRowNumber = null;
    renderTable();
    renderFields(null);
    setStatus("Disconnected. The admin key has been cleared from this page.", "");
  });
  refreshButton.addEventListener("click", loadRecords);
  sheetSelect.addEventListener("change", loadRecords);
  newButton.addEventListener("click", () => {
    resetEditor();
    $("#editorSection").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  clearButton.addEventListener("click", resetEditor);

  recordForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentSheet || !headers.length) return;
    const action = selectedRowNumber == null ? "create" : "update";
    const body = { action, sheet: currentSheet, record: readForm() };
    if (action === "update") body.rowNumber = selectedRowNumber;
    saveButton.disabled = true;
    setStatus(action === "create" ? "Creating record…" : "Saving changes…");
    try {
      await api("/api/records", { method: "POST", body: JSON.stringify(body) });
      await loadRecords();
      setStatus(action === "create" ? "Record created and workbook committed to GitHub." : "Record updated and workbook committed to GitHub.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      saveButton.disabled = false;
    }
  });

  deleteButton.addEventListener("click", async () => {
    if (selectedRowNumber == null || !currentSheet) return;
    if (!window.confirm("Delete the selected row from " + currentSheet + "? This change will be committed to GitHub.")) return;
    deleteButton.disabled = true;
    setStatus("Deleting record…");
    try {
      await api("/api/records", {
        method: "POST",
        body: JSON.stringify({ action: "delete", sheet: currentSheet, rowNumber: selectedRowNumber })
      });
      await loadRecords();
      setStatus("Record deleted and workbook committed to GitHub.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      deleteButton.disabled = selectedRowNumber == null;
    }
  });

  setConnected(false);
  renderTable();
  renderFields(null);
});
