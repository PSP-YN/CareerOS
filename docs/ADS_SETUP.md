# Advertising setup

CareerOS intentionally does not serve ads until the site is approved by Google AdSense and the publisher has configured consent and privacy requirements.

After approval:
1. Create ad units for the public home page and career guide.
2. Add Vercel Production environment variables:
   - ADSENSE_CLIENT_ID = ca-pub-xxxxxxxxxxxxxxxx
   - ADSENSE_HOME_SLOT_ID = numeric ad slot ID
   - ADSENSE_GUIDE_SLOT_ID = numeric ad slot ID
3. Add the exact publisher record Google provides to the root ads.txt file. Do not guess the publisher ID or certification value.
4. Configure Google Privacy & Messaging / an appropriate certified CMP for regions where consent is required.
5. Update the Privacy Policy with the final ad vendors, cookies, personalization and opt-out details.
6. Verify ad rendering and policy compliance. Do not put ad placements in the signed-in workspace, near critical controls, or on pages without meaningful content.

The current ads.js only activates public-page slots when all corresponding publisher and slot configuration is present. Missing configuration means no ad request is sent.
