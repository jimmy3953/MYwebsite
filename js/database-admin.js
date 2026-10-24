/* CDWS workbook CRUD client for the local Python API. */
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
    if (!rawUrl || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawUrl)) {
      setStatus("Open this dashboard from the local server at http://127.0.0.1:3000.", "error");
      return;
    }
    apiBase = rawUrl;
    connectButton.disabled = true;
    setStatus("Connecting to the local workbook...");
    try {
      const sessionResponse = await fetch(apiBase + "/api/session", { cache: "no-store" });
      const session = await sessionResponse.json().catch(() => ({}));
      if (!sessionResponse.ok || !session.adminKey) {
        throw new Error(session.error || "The local server could not create an admin session.");
      }
      adminKey = session.adminKey;
      keyInput.value = adminKey;
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
      setStatus("Connected. Changes are saved to CDWS_Database.xlsx on this computer.", "success");
    } catch (error) {
      apiBase = "";
      adminKey = "";
      keyInput.value = "";
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

  const contactHeaders = [
    "Parent / Guardian Name",
    "Email",
    "Phone",
    "Student Name",
    "Student Year / Class",
    "Enquiry Category",
    "Information Requested",
    "Preferred Contact Method",
    "Enquiry Message"
  ];
  const studentClasses = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "Form 1", "Form 2", "Form 3", "Form 4", "Form 5"];
  const enquiryCategories = ["Academic Matters", "Teachers", "School Activities", "Student Support", "Admissions", "General Enquiry"];
  const informationOptions = ["Academic Information", "School Activities", "Student Support"];

  function isContactEnquirySchema() {
    return headers.length === contactHeaders.length && headers.every((header, index) => header === contactHeaders[index]);
  }

  function addContactField(labelText, control, full = false) {
    const wrapper = document.createElement("div");
    wrapper.className = "field" + (full ? " full" : "");
    const label = document.createElement("label");
    label.textContent = labelText;
    label.htmlFor = control.id;
    wrapper.append(label, control);
    recordFields.appendChild(wrapper);
  }

  function addSelectOptions(select, values) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Please select";
    select.appendChild(placeholder);
    values.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function renderContactEnquiryFields(item) {
    const record = item ? item.record : {};
    const textField = (header, label, type, full = false) => {
      const input = document.createElement("input");
      input.type = type;
      input.id = "db-" + header.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      input.name = header;
      input.dataset.fieldKey = header;
      input.value = escapeText(record[header]);
      input.required = true;
      if (header === "Phone") {
        input.inputMode = "tel";
        input.placeholder = "0123456789";
      }
      addContactField(label + " *", input, full);
    };

    textField("Parent / Guardian Name", "Parent / Guardian Name", "text", true);
    textField("Email", "Email Address", "email");
    textField("Phone", "Phone Number", "tel");
    textField("Student Name", "Student Name", "text");

    const classSelect = document.createElement("select");
    classSelect.id = "db-student-class";
    classSelect.name = "Student Year / Class";
    classSelect.dataset.fieldKey = "Student Year / Class";
    classSelect.required = true;
    addSelectOptions(classSelect, studentClasses);
    classSelect.value = escapeText(record["Student Year / Class"]);
    addContactField("Student Year / Class *", classSelect);

    const categorySelect = document.createElement("select");
    categorySelect.id = "db-enquiry-category";
    categorySelect.name = "Enquiry Category";
    categorySelect.dataset.fieldKey = "Enquiry Category";
    categorySelect.required = true;
    addSelectOptions(categorySelect, enquiryCategories);
    categorySelect.value = escapeText(record["Enquiry Category"]);
    addContactField("Enquiry Category *", categorySelect, true);

    const preferredFieldset = document.createElement("fieldset");
    preferredFieldset.className = "field full";
    preferredFieldset.style.cssText = "border:0;padding:0;margin:0 0 16px";
    const preferredLegend = document.createElement("legend");
    preferredLegend.textContent = "Preferred Contact Method *";
    preferredLegend.style.cssText = "font-weight:800;color:var(--navy);margin-bottom:8px";
    preferredFieldset.appendChild(preferredLegend);
    const preferredChoices = document.createElement("div");
    preferredChoices.style.cssText = "display:flex;gap:20px;flex-wrap:wrap";
    ["Email", "Phone"].forEach((method, index) => {
      const label = document.createElement("label");
      label.style.cssText = "font-weight:600;color:var(--ink);margin:0";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "adminContactMethod";
      input.value = method;
      input.checked = escapeText(record["Preferred Contact Method"]) === method;
      input.required = index === 0;
      input.style.cssText = "width:auto;margin-right:6px";
      label.append(input, document.createTextNode(" " + method));
      preferredChoices.appendChild(label);
    });
    preferredFieldset.appendChild(preferredChoices);
    recordFields.appendChild(preferredFieldset);

    const infoFieldset = document.createElement("fieldset");
    infoFieldset.className = "field full";
    infoFieldset.style.cssText = "border:0;padding:0;margin:0 0 16px";
    const infoLegend = document.createElement("legend");
    infoLegend.textContent = "Information Requested";
    infoLegend.style.cssText = "font-weight:800;color:var(--navy);margin-bottom:8px";
    infoFieldset.appendChild(infoLegend);
    const infoChoices = document.createElement("div");
    infoChoices.style.cssText = "display:flex;gap:20px;flex-wrap:wrap";
    const selectedInformation = escapeText(record["Information Requested"]).split(",").map(value => value.trim());
    informationOptions.forEach(option => {
      const label = document.createElement("label");
      label.style.cssText = "font-weight:600;color:var(--ink);margin:0";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "adminInformationRequested";
      input.value = option;
      input.checked = selectedInformation.includes(option);
      input.style.cssText = "width:auto;margin-right:6px";
      label.append(input, document.createTextNode(" " + option));
      infoChoices.appendChild(label);
    });
    infoFieldset.appendChild(infoChoices);
    recordFields.appendChild(infoFieldset);

    const message = document.createElement("textarea");
    message.id = "db-enquiry-message";
    message.name = "Enquiry Message";
    message.dataset.fieldKey = "Enquiry Message";
    message.value = escapeText(record["Enquiry Message"]);
    message.required = true;
    message.placeholder = "Please provide details about the enquiry.";
    addContactField("Enquiry Message *", message, true);
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

    if (isContactEnquirySchema()) {
      renderContactEnquiryFields(item);
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
    if (isContactEnquirySchema()) {
      const contactMethod = recordFields.querySelector("input[name='adminContactMethod']:checked");
      const informationRequested = [...recordFields.querySelectorAll("input[name='adminInformationRequested']:checked")].map(input => input.value);
      record["Preferred Contact Method"] = contactMethod ? contactMethod.value : "";
      record["Information Requested"] = informationRequested.join(", ");
    }
    return record;
  }

  function validateContactRecord(record) {
    if (!isContactEnquirySchema()) return "";
    const required = ["Parent / Guardian Name", "Email", "Phone", "Student Name", "Student Year / Class", "Enquiry Category", "Preferred Contact Method", "Enquiry Message"];
    if (required.some(header => !String(record[header] || "").trim())) return "Please complete all required enquiry fields.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.Email)) return "Enter a valid email address.";
    const phoneDigits = String(record.Phone).replace(/\D/g, "");
    if (!/^(?:01\d{8,9}|601\d{8,9})$/.test(phoneDigits)) return "Enter a valid Malaysian phone number.";
    return "";
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
    setStatus("Disconnected from the local workbook.", "");
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
    const validationError = validateContactRecord(body.record);
    if (validationError) {
      setStatus(validationError, "error");
      window.alert("Error: " + validationError);
      return;
    }
    if (action === "update") body.rowNumber = selectedRowNumber;
    saveButton.disabled = true;
    setStatus(action === "create" ? "Creating record…" : "Saving changes…");
    try {
      await api("/api/records", { method: "POST", body: JSON.stringify(body) });
      await loadRecords();
      const message = action === "create" ? "Enquiry created and saved to the local workbook." : "Enquiry updated and saved to the local workbook.";
      setStatus(message, "success");
      window.alert("Success: " + message);
    } catch (error) {
      setStatus(error.message, "error");
      window.alert("Error: " + error.message);
    } finally {
      saveButton.disabled = false;
    }
  });

  deleteButton.addEventListener("click", async () => {
    if (selectedRowNumber == null || !currentSheet) return;
    if (!window.confirm("Delete the selected row from " + currentSheet + "? This change will be saved to the local workbook.")) return;
    deleteButton.disabled = true;
    setStatus("Deleting record…");
    try {
      await api("/api/records", {
        method: "POST",
        body: JSON.stringify({ action: "delete", sheet: currentSheet, rowNumber: selectedRowNumber })
      });
      await loadRecords();
      setStatus("Enquiry deleted from the local workbook.", "success");
      window.alert("Success: Enquiry deleted from the local workbook.");
    } catch (error) {
      setStatus(error.message, "error");
      window.alert("Error: " + error.message);
    } finally {
      deleteButton.disabled = selectedRowNumber == null;
    }
  });

  setConnected(false);
  renderTable();
  renderFields(null);
  if (window.CDWS_DATABASE_API) connect();
});
