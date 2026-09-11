# Em's Nagels V7 – grote update

Nieuw:
- Werkmaand in Emily's adminportaal: per dag van iedere maand open/dicht + eigen tijden.
- Gmail bevestiging naar klant en Emily bij nieuwe boeking.
- Automatische reminder ongeveer 24 uur vooraf.
- Klantenportaal /mijn-afspraken.html met eenmalige e-mailcode.
- Klant kan tot 24 uur vooraf zelf annuleren.

Na upload naar dezelfde GitHub repository:
1. Netlify deployt automatisch.
2. Voeg in Netlify Environment variables toe:
   - GMAIL_USER = het Gmail-adres van Em's Nagels
   - GMAIL_APP_PASSWORD = Google App Password (16 tekens, zonder spaties)
   - EMILY_EMAIL = adres waar Emily nieuwe afspraken/annuleringen wil ontvangen
3. ADMIN_PASSWORD, ADMIN_SESSION_SECRET en SECRETS_SCAN_OMIT_KEYS blijven staan zoals ze al staan.
4. Trigger een nieuwe deploy nadat de Gmail-variabelen zijn toegevoegd.
5. Open daarna één keer opnieuw:
   https://emsnagels.netlify.app/api/bootstrap?key=JOUW_ADMIN_WACHTWOORD
   Je hoort 'Database V7 klaar.' te zien.

Voor Gmail App Password is 2-stapsverificatie op het Google-account nodig.
