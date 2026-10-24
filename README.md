# Horizon International School — OUM Introduction to Web Programming — Task 1

## Pages
1. `index.html` — Home
2. `about.html` — About the School
3. `teachers.html` — About the Teachers
4. `activities.html` — Co-curricular Activities
5. `facilities.html` — Facilities & Student Support
6. `news.html` — News, Events & Achievements
7. `contact.html` — Contact / Parent Enquiry
8. `database-admin.html` — Authorized workbook CRUD dashboard
9. `content.html` — Website content entry form that inserts rows into the workbook

## Supporting files
- `css/style.css` — shared responsive styling
- `css/database-admin.css` — workbook dashboard styling
- `js/script.js` — navigation, animation, slideshows, activity filtering and enquiry form
- `js/database-config.js` — local workbook API URL
- `js/database-admin.js` — browser CRUD client
- `database/server.py` — local Python standard-library API that reads and updates the workbook file directly

## Database connection
The CRUD dashboard reads and writes **`CDWS_Database.xlsx`** on this computer. Run `python database/server.py`; it opens the admin page and connects automatically. See [database/README.md](database/README.md) for details. It uses only Python's standard library and requires no package installation.

**Privacy:** this repository and workbook are public. Contact form submissions are saved to the workbook's `Contact Enquiries` sheet. Use fictional assignment data only; do not enter real parent/guardian or student information.

## Existing project requirements
- One Home Page plus six additional pages
- Clear navigation linking all pages
- School background, vision, mission, objectives, location, operating hours and leadership
- Teacher names, profile images, subjects, qualifications, experience, roles and profiles
- Clubs, societies, sports, uniformed bodies, competitions and participation opportunities
- Classrooms, computer lab, library, science lab, sports facilities, canteen, counselling and health/safety support
- News, events, dates, achievements, awards and structured event table
- Contact details and parent enquiry form
- Semantic HTML5 structure, responsive CSS, accessible labels and interactive JavaScript features

The school, staff names, statistics and calendar entries are fictional website content created for the assignment prototype. Existing school page content is hard-coded in the HTML; the new dashboard manages workbook rows but does not yet re-render those static page sections from workbook records. The worksheet schema and page-to-sheet mapping should be defined before migrating page content.

## Task 2 — Online Parent Enquiry Form
The Contact / Parent Enquiry page validates submissions and saves them through the local Python API to the `Contact Enquiries` worksheet in `CDWS_Database.xlsx`. Keep the local server running while submitting enquiries. Use fictional data because workbook updates can be committed to a public repository.
