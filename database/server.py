"""Local CDWS workbook CRUD server. Uses only Python's standard library."""

import json
import os
import posixpath
import re
import secrets
import tempfile
import threading
import webbrowser
import zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
WORKBOOK = ROOT / "CDWS_Database.xlsx"
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "3000"))
ADMIN_KEY = os.environ.get("CDWS_ADMIN_KEY") or secrets.token_hex(32)
MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
ET.register_namespace("", MAIN_NS)
ET.register_namespace("r", DOC_REL_NS)
ET.register_namespace("mc", "http://schemas.openxmlformats.org/markup-compatibility/2006")
ET.register_namespace("x14ac", "http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac")
ET.register_namespace("x15", "http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac")
ET.register_namespace("xr", "http://schemas.microsoft.com/office/spreadsheetml/2014/revision")
ET.register_namespace("xr2", "http://schemas.microsoft.com/office/spreadsheetml/2015/revision2")
ET.register_namespace("xr3", "http://schemas.microsoft.com/office/spreadsheetml/2016/revision3")
ET.register_namespace("xr6", "http://schemas.microsoft.com/office/spreadsheetml/2016/revision6")
ET.register_namespace("xr10", "http://schemas.microsoft.com/office/spreadsheetml/2016/revision10")
WRITE_LOCK = threading.Lock()
CONTACT_SHEET = "Contact Enquiries"
CONTACT_HEADERS = (
    "Parent / Guardian Name",
    "Email",
    "Phone",
    "Student Name",
    "Student Year / Class",
    "Enquiry Category",
    "Information Requested",
    "Preferred Contact Method",
    "Enquiry Message",
)
STUDENT_CLASSES = {"Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "Form 1", "Form 2", "Form 3", "Form 4", "Form 5"}
ENQUIRY_CATEGORIES = {"Academic Matters", "Teachers", "School Activities", "Student Support", "Admissions", "General Enquiry"}
CONTACT_METHODS = {"Email", "Phone"}


def tag(name):
    return f"{{{MAIN_NS}}}{name}"


def column_number(reference):
    number = 0
    for char in reference:
        if not char.isalpha():
            break
        number = number * 26 + ord(char.upper()) - ord("A") + 1
    return number


def column_name(number):
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result


def workbook_parts(archive):
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relations = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {item.attrib["Id"]: item.attrib["Target"] for item in relations.findall(f"{{{PKG_REL_NS}}}Relationship")}
    sheets = []
    for sheet in workbook.findall(f".//{tag('sheet')}"):
        target = targets[sheet.attrib[f"{{{DOC_REL_NS}}}id"]]
        sheet_path = posixpath.normpath(target.lstrip("/") if target.startswith("/") else posixpath.join("xl", target))
        sheets.append((sheet.attrib["name"], sheet_path))
    shared = []
    if "xl/sharedStrings.xml" in archive.namelist():
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        for item in root.findall(tag("si")):
            shared.append("".join(part.text or "" for part in item.iter(tag("t"))))
    return sheets, shared


def cell_text(cell, shared_strings):
    kind = cell.attrib.get("t", "")
    if kind == "inlineStr":
        return "".join(part.text or "" for part in cell.iter(tag("t")))
    value = cell.find(tag("v"))
    if value is None or value.text is None:
        return ""
    if kind == "s":
        try:
            return shared_strings[int(value.text)]
        except (ValueError, IndexError):
            return ""
    return value.text


def sheet_records(sheet_root, shared_strings):
    sheet_data = sheet_root.find(tag("sheetData"))
    if sheet_data is None:
        return [], []
    rows = list(sheet_data.findall(tag("row")))
    header = next((row for row in rows if row.attrib.get("r") == "1"), None)
    if header is None:
        return [], []
    fields = []
    used = set()
    for cell in header.findall(tag("c")):
        label = cell_text(cell, shared_strings).strip()
        if not label:
            continue
        key = label
        suffix = 2
        while key in used:
            key = f"{label} ({suffix})"
            suffix += 1
        used.add(key)
        fields.append((column_number(cell.attrib["r"]), key))
    records = []
    for row in rows:
        row_number = int(row.attrib.get("r", "0"))
        if row_number < 2:
            continue
        cells = {column_number(cell.attrib.get("r", "A0")): cell for cell in row.findall(tag("c"))}
        record = {key: cell_text(cells[column], shared_strings) if column in cells else "" for column, key in fields}
        if any(value != "" for value in record.values()):
            records.append({"rowNumber": row_number, "record": record})
    return fields, records


def worksheet_path(sheets, name):
    for sheet_name, sheet_path in sheets:
        if sheet_name == name:
            return sheet_path
    raise LookupError(f'Worksheet "{name}" was not found.')


def validate_contact_record(record):
    if not isinstance(record, dict):
        return None, "The enquiry data must be an object."
    cleaned = {header: str(record.get(header, "")).strip() for header in CONTACT_HEADERS}
    required = ("Parent / Guardian Name", "Email", "Phone", "Student Name", "Student Year / Class", "Enquiry Category", "Preferred Contact Method", "Enquiry Message")
    missing = [header for header in required if not cleaned[header]]
    if missing:
        return None, "Please complete all required enquiry fields."
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", cleaned["Email"]):
        return None, "Enter a valid email address."
    phone_digits = re.sub(r"\D", "", cleaned["Phone"])
    if not re.fullmatch(r"(?:01\d{8,9}|601\d{8,9})", phone_digits):
        return None, "Enter a valid Malaysian phone number."
    if cleaned["Student Year / Class"] not in STUDENT_CLASSES:
        return None, "Choose a valid student year or class."
    if cleaned["Enquiry Category"] not in ENQUIRY_CATEGORIES:
        return None, "Choose a valid enquiry category."
    if cleaned["Preferred Contact Method"] not in CONTACT_METHODS:
        return None, "Choose Email or Phone as the preferred contact method."
    if any(len(value) > 5000 for value in cleaned.values()):
        return None, "One or more enquiry fields are too long."
    return cleaned, None


def inline_cell(reference, value):
    cell = ET.Element(tag("c"), {"r": reference, "t": "inlineStr"})
    inline = ET.SubElement(cell, tag("is"))
    text = ET.SubElement(inline, tag("t"))
    text.text = "" if value is None else str(value)
    if text.text and (text.text != text.text.strip() or "\n" in text.text):
        text.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    return cell


def write_cell(cell, value):
    for child in list(cell):
        cell.remove(child)
    cell.attrib["t"] = "inlineStr"
    inline = ET.SubElement(cell, tag("is"))
    text = ET.SubElement(inline, tag("t"))
    text.text = "" if value is None else str(value)
    if text.text and (text.text != text.text.strip() or "\n" in text.text):
        text.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def save_archive(original_items, replacements):
    handle, temp_name = tempfile.mkstemp(prefix="cdws-", suffix=".xlsx", dir=WORKBOOK.parent)
    os.close(handle)
    try:
        with zipfile.ZipFile(temp_name, "w", zipfile.ZIP_DEFLATED) as output:
            for info, data in original_items:
                output.writestr(info, replacements.get(info.filename, data))
        os.replace(temp_name, WORKBOOK)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


class Handler(BaseHTTPRequestHandler):
    server_version = "CDWSLocal/1.0"

    def send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def authorized(self):
        return secrets.compare_digest(self.headers.get("Authorization", ""), f"Bearer {ADMIN_KEY}")

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path.startswith("/api/"):
                return self.get_api(parsed)
            return self.static_file(unquote(parsed.path or "/"))
        except (LookupError, FileNotFoundError) as error:
            self.send_json(404, {"ok": False, "error": str(error)})
        except Exception as error:
            self.send_json(500, {"ok": False, "error": f"Local server error: {error}"})

    def get_api(self, parsed):
        if parsed.path == "/api/health":
            return self.send_json(200, {"ok": True, "service": "Local CDWS workbook CRUD API"})
        if parsed.path == "/api/session":
            return self.send_json(200, {"ok": True, "adminKey": ADMIN_KEY})
        if not self.authorized():
            return self.send_json(401, {"ok": False, "error": "Local admin session is unavailable. Restart the server and reload this page."})
        with zipfile.ZipFile(WORKBOOK, "r") as archive:
            sheets, shared = workbook_parts(archive)
            if parsed.path == "/api/tables":
                tables = []
                for name, sheet_path in sheets:
                    root = ET.fromstring(archive.read(sheet_path))
                    fields, records = sheet_records(root, shared)
                    tables.append({"name": name, "headers": [key for _, key in fields], "rowCount": len(records)})
                return self.send_json(200, {"ok": True, "tables": tables})
            if parsed.path == "/api/records":
                sheet_name = parse_qs(parsed.query).get("sheet", [""])[0]
                if not sheet_name:
                    return self.send_json(400, {"ok": False, "error": "Choose a worksheet."})
                root = ET.fromstring(archive.read(worksheet_path(sheets, sheet_name)))
                fields, records = sheet_records(root, shared)
                return self.send_json(200, {"ok": True, "sheet": sheet_name, "headers": [key for _, key in fields], "rows": records})
        self.send_json(404, {"ok": False, "error": "Route not found."})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/enquiries":
            return self.save_enquiry()
        if parsed.path != "/api/records":
            return self.send_json(404, {"ok": False, "error": "Route not found."})
        if not self.authorized():
            return self.send_json(401, {"ok": False, "error": "Unauthorized. Reload the page to create a local admin session."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 1_000_000:
                return self.send_json(413, {"ok": False, "error": "Request body is too large."})
            body = json.loads(self.rfile.read(length) or b"{}")
            return self.write_record(body)
        except LookupError as error:
            self.send_json(404, {"ok": False, "error": str(error)})
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"ok": False, "error": f"Invalid request: {error}"})
        except PermissionError:
            self.send_json(423, {"ok": False, "error": "Could not replace the workbook. Close it in Excel and retry."})
        except Exception as error:
            self.send_json(500, {"ok": False, "error": f"Could not save the workbook: {error}"})

    def save_enquiry(self):
        origin = urlparse(self.headers.get("Origin", ""))
        if self.headers.get("Origin") and (origin.netloc != self.headers.get("Host") or origin.scheme != "http"):
            return self.send_json(403, {"ok": False, "error": "Enquiries can only be submitted from this local website."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 100_000:
                return self.send_json(413, {"ok": False, "error": "Enquiry is too large."})
            body = json.loads(self.rfile.read(length) or b"{}")
            required = ("parentName", "email", "phone", "studentName", "studentClass", "category", "contactMethod", "message")
            enquiry = {key: str(body.get(key, "")).strip() for key in required}
            enquiry["informationRequested"] = str(body.get("informationRequested", "")).strip()
            missing = [key for key in required if not enquiry[key]]
            if missing:
                return self.send_json(400, {"ok": False, "error": "Please complete all required enquiry fields."})
            if any(len(value) > 5000 for value in enquiry.values()):
                return self.send_json(400, {"ok": False, "error": "One or more enquiry fields are too long."})

            record = {
                "Parent / Guardian Name": enquiry["parentName"],
                "Email": enquiry["email"],
                "Phone": enquiry["phone"],
                "Student Name": enquiry["studentName"],
                "Student Year / Class": enquiry["studentClass"],
                "Enquiry Category": enquiry["category"],
                "Information Requested": enquiry["informationRequested"],
                "Preferred Contact Method": enquiry["contactMethod"],
                "Enquiry Message": enquiry["message"],
            }
            return self.write_record({"action": "create", "sheet": CONTACT_SHEET, "record": record})
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"ok": False, "error": f"Invalid enquiry: {error}"})
        except Exception as error:
            self.send_json(500, {"ok": False, "error": f"Could not save enquiry: {error}"})

    def write_record(self, body):
        action = str(body.get("action", "")).lower()
        sheet_name = str(body.get("sheet", ""))
        if action not in ("create", "update", "delete"):
            return self.send_json(400, {"ok": False, "error": "Unsupported action. Use create, update, or delete."})
        if not sheet_name:
            return self.send_json(400, {"ok": False, "error": "Choose a worksheet."})

        with WRITE_LOCK:
            with zipfile.ZipFile(WORKBOOK, "r") as archive:
                sheets, shared = workbook_parts(archive)
                sheet_file = worksheet_path(sheets, sheet_name)
                root = ET.fromstring(archive.read(sheet_file))
                original_items = [(info, archive.read(info.filename)) for info in archive.infolist()]
            fields, _ = sheet_records(root, shared)
            if not fields:
                return self.send_json(400, {"ok": False, "error": "The worksheet needs column headers in row 1 before CRUD can be used."})
            record = body.get("record") or {}
            if sheet_name == CONTACT_SHEET and action in ("create", "update"):
                record, validation_error = validate_contact_record(record)
                if validation_error:
                    return self.send_json(400, {"ok": False, "error": validation_error})
            sheet_data = root.find(tag("sheetData"))
            if sheet_data is None:
                sheet_data = ET.SubElement(root, tag("sheetData"))

            if action == "create":
                row_number = max([int(row.attrib.get("r", "0")) for row in sheet_data.findall(tag("row"))] + [1]) + 1
                row = ET.SubElement(sheet_data, tag("row"), {"r": str(row_number)})
                for column, key in fields:
                    row.append(inline_cell(f"{column_name(column)}{row_number}", record.get(key, "")))
            else:
                try:
                    row_number = int(body.get("rowNumber", 0))
                except (ValueError, TypeError):
                    row_number = 0
                target = next((row for row in sheet_data.findall(tag("row")) if row.attrib.get("r") == str(row_number)), None)
                if row_number < 2 or target is None:
                    return self.send_json(400, {"ok": False, "error": "Invalid row number. Refresh the list and select a row again."})
                if action == "delete":
                    sheet_data.remove(target)
                    for row in sheet_data.findall(tag("row")):
                        old_number = int(row.attrib.get("r", "0"))
                        if old_number > row_number:
                            new_number = old_number - 1
                            row.set("r", str(new_number))
                            for cell in row.findall(tag("c")):
                                cell.set("r", f"{column_name(column_number(cell.attrib['r']))}{new_number}")
                else:
                    cells = {column_number(cell.attrib["r"]): cell for cell in target.findall(tag("c"))}
                    for column, key in fields:
                        if key in record:
                            cell = cells.get(column)
                            if cell is None:
                                cell = inline_cell(f"{column_name(column)}{row_number}", "")
                                target.append(cell)
                            write_cell(cell, record[key])

            all_rows = sheet_data.findall(tag("row"))
            max_row = max([int(row.attrib.get("r", "0")) for row in all_rows] + [1])
            max_column = max([column for column, _ in fields] + [1])
            dimension = root.find(tag("dimension"))
            if dimension is not None:
                dimension.set("ref", f"A1:{column_name(max_column)}{max_row}")

            replacements = {sheet_file: ET.tostring(root, encoding="utf-8", xml_declaration=True)}
            save_archive(original_items, replacements)
        return self.send_json(200, {"ok": True, "action": action})

    def static_file(self, requested):
        if requested == "/":
            requested = "/index.html"
        allowed = (requested.endswith(".html") and "/" not in requested[1:]) or requested.startswith(("/css/", "/js/")) or requested == "/school - achievement.jpg"
        if not allowed or ".." in Path(requested).parts:
            self.send_error(403, "Forbidden")
            return
        file_path = (ROOT / requested.lstrip("/")).resolve()
        if ROOT not in file_path.parents:
            self.send_error(403, "Forbidden")
            return
        data = file_path.read_bytes()
        content_type = {".css": "text/css", ".html": "text/html", ".jpg": "image/jpeg", ".js": "text/javascript"}.get(file_path.suffix.lower(), "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith("text/") else content_type)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format_string, *args):
        print(f"[{self.log_date_time_string()}] {format_string % args}")


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), Handler)
    admin_url = f"http://{HOST}:{PORT}/database-admin.html"
    print(f"CDWS admin page: {admin_url}")
    print("The admin page connects automatically; no key copy/paste is needed.")
    print("This server listens only on your computer. Keep this terminal open while using the dashboard.")
    webbrowser.open_new_tab(admin_url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()
