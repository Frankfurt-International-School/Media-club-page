# Self-hosted fonts

This directory contains the Latin and Latin Extended WOFF2 subsets used by the site:

- Bebas Neue 400, downloaded from the Google Fonts distribution (`v16`)
- Space Grotesk variable 300–600, downloaded from the Google Fonts distribution (`v22`)
- Barlow Condensed 600, downloaded from the Google Fonts distribution (`v13`), for the optional SAC Sport interface

The corresponding SIL Open Font License 1.1 files are included beside the font files. Source projects:

- https://github.com/dharmatype/bebas-neue
- https://github.com/floriankarsten/space-grotesk
- https://github.com/jpt/barlow

The site should not reference `fonts.googleapis.com` or `fonts.gstatic.com` at runtime. Update `fonts.css`, the local files, licenses, and regression checks together when changing fonts.
