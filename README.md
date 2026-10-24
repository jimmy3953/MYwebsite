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

## Supporting files
- `css/style.css` — shared responsive styling
- `css/database-admin.css` — workbook dashboard styling
- `js/script.js` — navigation, animation, slideshows, activity filtering and enquiry form
- `js/database-config.js` — deployed workbook API URL
- `js/database-admin.js` — browser CRUD client
- `database/worker/` — Cloudflare Worker API to read and update the workbook with a GitHub token kept as a server-side secret

## Database connection
The repository currently contains **`CDWS_Database.xlsx`** on the `main` branch. It does not contain a file named `CDWS_databse.xlsm`. The new CRUD dashboard targets the actual existing `.xlsx` file. Follow [database/README.md](database/README.md) for the one-time Cloudflare Worker deployment steps. Until the Worker is deployed, its URL is configured in `js/database-config.js`, and the GitHub token/admin key are configured as Cloudflare Worker secrets, the CRUD dashboard will not be connected.

**Privacy warning:** this repository is public, so the workbook and every committed update are publicly downloadable and visible in Git history. Use it only for non-sensitive website content. Do not store parent/guardian contact information, student information, private enquiries, passwords, or confidential data in this workbook. The Contact page is not redirected to this public workbook.

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
The Contact / Parent Enquiry page includes parent/guardian name, email, phone, student name, year/class, enquiry category, preferred contact method, information requested, enquiry message, JavaScript validation and submitted-data display. It currently posts to the existing Google Apps Script endpoint in `js/script.js`. Review that endpoint's access permissions and the destination spreadsheet before using real parent/student data.
