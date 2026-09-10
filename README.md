# Em's Nagels V5

Deze versie gebruikt Netlify Database en Netlify Functions.

Belangrijk:
1. Deploy deze map als bronproject (Git of Netlify CLI), niet als alleen een statische drag-and-drop map.
2. Stel in Netlify de environment variable `ADMIN_PASSWORD` in.
3. Optioneel: stel ook `ADMIN_SESSION_SECRET` in op een lange willekeurige waarde.
4. Bij de eerste production deploy maakt Netlify Database automatisch de database en voert de migratie uit.

Admin:
- URL: /admin of /admin.html
- gebruikersnaam: admin
- wachtwoord: de waarde van ADMIN_PASSWORD

Gegevens staan daarna centraal: klant en Emily gebruiken dezelfde agenda.
