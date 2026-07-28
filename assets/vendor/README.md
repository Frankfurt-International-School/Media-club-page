# Vendored browser dependencies

## Supabase JavaScript

- File: `supabase-js-2.110.9.min.js`
- Package: `@supabase/supabase-js@2.110.9`
- Source: <https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/dist/umd/supabase.min.js>
- License: MIT, retained in `SUPABASE-JS-LICENSE` and available at <https://github.com/supabase/supabase-js/blob/v2.110.9/LICENSE>
- SHA-256: `599da9b3f125447ed0a4ac8a32916ac8e8500f13dd616852b50f1ba7445a7b3e`

The application loads this fixed local copy so a future floating CDN release cannot change production behavior without a reviewed repository update.

To update it, choose an explicit package version, replace the file from the matching jsDelivr URL, update the filename and script reference in `index.html`, recalculate the SHA-256 checksum, and run the browser regression checks before deploying.
