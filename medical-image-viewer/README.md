# Medical Image Viewer and Basic Segmentation Tool

Browser-based 2D/stack viewer with filters, intensity segmentation and PNG/JSON export. Everything runs client-side; nothing is uploaded. **Educational use only. Not a diagnostic device.**

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest algorithm tests
npm run build    # static site in dist/
```
## Deploy (free)
`vite.config.js` uses `base: './'`, so `dist/` works on GitHub Pages, Netlify or Cloudflare Pages. Example: `npx gh-pages -d dist`.

## Usage
Load sample, or open PNG/JPEG, or select all slices of an **uncompressed** DICOM series together. Scroll = zoom, drag = pan. Filters stack until Reset; "Hold to compare" shows the original. Segmentation thresholds the original slice values (HU for CT) and overlays a coloured mask.

## Structure
`src/services/`: `loaders.js` (PNG/JPEG, DICOM via dicom-parser, sample phantom), `imageProcessor.js` (threshold, Gaussian, median, Canny, histogram), `segmentationEngine.js` (add region growing here). `src/App.jsx` holds the UI. `tests/` has Vitest tests.

## Known limitations
- DICOM: uncompressed, RLE, baseline 8-bit JPEG (browser decoder) and JPEG Lossless (jpeg-lossless-decoder-js) are supported, single-frame and single-channel only. JPEG 2000, JPEG-LS, 12-bit JPEG and multi-frame compressed files are not. Cornerstone3D is not used.
- NIfTI (.nii/.nii.gz) loads via nifti-reader-js; orientation matrix is ignored and only the first volume of 4D files is used.
- 3D editing assumes isotropic voxels for the brush sphere; the voxel total recomputes on each edit, so it is slow on very large volumes. Volume in mm³ is not computed (slice thickness is not read). Mask volume export is a raw 8-bit file (width x height x slices, slice order as loaded).
- Filters run in a Web Worker using OpenCV.js (@techstark/opencv-js), with automatic fallback to plain JavaScript if OpenCV fails to load. First use downloads/initialises the OpenCV WASM bundle (several MB).
- Histogram is drawn on a canvas (no Chart.js). Segmentation is 2D per slice.
- Exports are PNG/JSON; DICOM metadata and the 3D volume are not preserved.
- Sample is a synthetic phantom, not patient data. Public datasets: https://www.cancerimagingarchive.net/ (check licences).

## Tools
Distance and rectangular ROI (mean, SD, min, max, area; mm when pixel spacing exists), region growing (click a seed, tolerance slider), brush and eraser, undo/redo, arrow-key slice navigation.

Also: angle tool (3 clicks, vertex second), 3D region growing and 3D brush/eraser (tick the 3D box), raw mask-volume export.
