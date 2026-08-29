# DingProof

**Two minutes now. Evidence forever.**

DingProof is a free web page that helps you document the condition of a rental car,
so you can defend yourself if a rental company later charges you for damage you did not cause.

Live site: **https://uri-cyber.github.io/DingProof/**

## The problem

You pick up a car at an airport at midnight. It is dark, you are tired, the queue behind you is long.
Two weeks later an invoice arrives for a scratch you never saw. You have nothing to prove it was
already there.

DingProof fixes that. In about two minutes it walks you around the car, takes 8 photos in a fixed
order, lets you mark existing damage on a diagram, and produces a single timestamped PDF you can
email to yourself and send to the rental company.

## What it does

1. **Trip details** — rental company, licence plate, make and model, odometer, fuel level (as
   quick buttons), and whether this is a pickup or a return.
2. **8 guided photos** — front, front right corner, right side, rear right corner, rear, rear left
   corner, left side, and a final shot for the roof, glass, interior and odometer. Your phone camera
   opens straight from the page. Each photo gets a quick brightness/sharpness check, so a shot taken
   in the dark or badly blurred is flagged for a retake before it ends up in the report.
   An optional 30-second walk-around **video** can be attached too — it is saved as its own file
   next to the PDF, since video can't live inside a PDF page.
3. **Damage diagram** — tap a top-down car outline anywhere you see a problem, pick the type
   (scratch, dent, wheel scuff, chip or crack, missing part, stain or tear, other) and add a note.
   Each mark becomes a numbered red pin plus a numbered row in a list. You can also attach a
   **close-up photo** to any mark, either while adding it or later from the list.
4. **Return vs. pickup comparison** — at pickup, save a small pickup file alongside the PDF. At
   return, load that file back in: its old damage marks show as grey pins (P1, P2, …) on the
   diagram, so only new damage from this inspection needs explaining.
5. **PDF report** — a summary page, the diagram with its pins, one page per damage close-up, then
   one page per walk-around photo. Every photo page is landscape, with the picture large on the
   left and a panel beside it giving the photo's title and its details: position, what the shot
   should show (or the damage type and your note), the plate, whether it was pickup or return,
   and the time it was taken. Every timestamp is recorded in both your local time and ISO 8601
   UTC. The file is named `DingProof_PLATE_YYYY-MM-DD.pdf`. The PDF itself is always written in
   English, so any rental company can read it, even if you used the app in another language.
6. **Dispute email text** — one button copies a ready-to-paste English email to your clipboard,
   naming the report, the dates, and what it includes, so you have a starting point for a dispute.
7. **Five languages** — English, Hebrew (right-to-left), German, French and Spanish, switched with
   one tap in the header.
8. **Works like an app** — Add DingProof to your phone's home screen (a banner offers this
   automatically where supported) and it opens instantly next time, even with no signal, because
   the page and its styles are cached on first visit.

## Privacy

- Everything runs in your browser. **Nothing you capture ever leaves your device.**
- No backend, no accounts, no database, no cookies, no analytics, no tracking.
- Nothing is written to `localStorage` or `sessionStorage`. Close the tab and the data is gone,
  so download your PDF before you leave.
- The only external file is the jsPDF library from cdnjs, used to build the PDF.

## Honest disclaimer

The report is **your own documentation**. It is not an official document and it is not automatically
binding on any rental company. It is evidence you created yourself, with photos and timestamps, to
support your side if there is a dispute.

## How to run it

Download or clone this repository and double-click `index.html`. That is all — there is no build
step, no `npm install`, and no server needed.

```
git clone https://github.com/Uri-cyber/DingProof.git
```

Once the page has loaded, it keeps working even if the signal drops at the rental counter.

## How it is deployed

The site is hosted on **GitHub Pages** straight from the `main` branch, root folder.
`.nojekyll` in the repository root tells GitHub Pages to serve the files as they are, without
running Jekyll over them.

To enable it: repository **Settings → Pages → Build and deployment → Source: Deploy from a branch →
Branch: `main` / `/ (root)` → Save.** After a minute or two the site is live at
`https://uri-cyber.github.io/DingProof/`.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole page: four steps, the car diagram, the damage dialog |
| `styles.css` | Dark, high-contrast styling built for bright sun and dim garages |
| `app.js` | All the logic: photo resizing, diagram pins, PDF export, translations |
| `manifest.webmanifest` | Lets the browser offer "Add to home screen" |
| `sw.js` | Service worker: caches the app shell for instant, offline loading |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Home screen icons |
| `.nojekyll` | Makes GitHub Pages serve the files unprocessed |
| `LICENSE` | MIT |

## Browser support

Any modern mobile or desktop browser: iOS Safari, Chrome on Android, Chrome, Edge, Firefox, Safari.
Vanilla JavaScript only — no framework, no build tools.

## Licence

MIT. See [LICENSE](LICENSE).
