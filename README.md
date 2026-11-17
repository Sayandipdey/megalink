# GATE ECE Notes: Google Sheet + Apps Script version (no auth)

Files: index.html, app.js, config.js, Code.gs, plus YOUR data.json next to index.html.

1. Create a new Google Sheet. Extensions > Apps Script. Delete the sample code, paste Code.gs, Save.
2. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone. Deploy.
3. Authorize when asked (Advanced > Go to project (unsafe) > Allow). This is your own script.
4. Copy the Web app URL (ends with /exec) into config.js.
5. Run locally (python -m http.server) or host on GitHub Pages / Netlify / Vercel.
6. Open the site > Admin Mode > "Upload data.json to Sheet" once.

If you edit Code.gs later: Deploy > Manage deployments > pencil > Version: New version > Deploy.
Devices refresh about every 8 seconds, and immediately when you switch back to the tab.
