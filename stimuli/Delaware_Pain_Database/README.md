---
created-at: 2026-10-22
categories: "[[Project Notes]]"
project: "[[Memory Bias of Pain]]"
tags:
  - stimuli
---

# Delaware Pain Database: Access and Inventory

## Download and access

> [!success] Download complete — 2026-10-22
> All 1,080 selected files verified against official sizes: 986,397,537 bytes (986.4 MB).


- Official sources: [lab stimuli page](https://www.mendesiedleckilab.com/stimuli), [OSF database](https://osf.io/2x8r5/), [database article](https://pmc.ncbi.nlm.nih.gov/articles/PMC7587421/).
- Local destination: [Open dataset folder](file:///Users/cyrusyang/Development/Memory-Bias-Pain/stimuli/Delaware_Pain_Database/).
- Download scope: 1,080 files (~986 MB in decimal units): standardized photographs, FaceGen materials, norming data/codebooks, and current documentation. Unedited duplicates and older document versions are excluded. This is not a complete archive of every OSF file.
- Public files can be downloaded without an account or institutional application. The [README](https://osf.io/download/svt3c/) permits free **non-commercial research**, subject to each model's restrictions.
- **Publication or redistribution requires written lab consent.** Keep images outside public Git repositories. Before deploying an online experiment, ask the lab whether participant-facing hosting and derived morphs are covered, and confirm any required written permission. Contact: mendesiedlecki.lab@gmail.com. No message has been sent.
- The README also prohibits attempts to identify/contact models, including identification through facial-recognition software, and requires acknowledgment in publications.
- The codebook's `Consent` field lists **permissions refused**, not permissions granted. `full` indicates no listed individual restrictions; it does not override the lab's general terms. Participant-study IRB approval is separate from database download access.

## What is available?

- The official overview describes **240 identities: 127 female and 113 male**.
- File inventory: **244 standardized neutral files**, **16 neutral-only files**, and **652 standardized expression files**. Variants mean file counts are not identity counts. Neutral files cover 240 identity IDs; expression files cover 225.
- Computer-rendered materials are a separate collection: **160 files**, including FaceGen models and rendered images. Do not count these as additional photographed identities.
- Expressions are **posed**, not recordings of induced pain. Models were prompted at pain levels 2, 5, and 8, but the released expressions were selected primarily from level-8 poses. These are not calibrated 2/5/8 levels or ready-made 61-frame continua. Filename prompt codes are not morph intensities.
- The norming workbook includes pain and other-emotion ratings, pain specificity, believability, posedness, neutral-face ratings, and OpenFace AU estimates. Select endpoints using their actual ratings; a pain prompt does not guarantee that pain was the strongest perceived emotion.
- `Race` and `Gender` are **self-reported** according to the codebook. `Age_Average` is **perceived age**, not the model's actual age. Preserve the supplied demographic labels; do not infer demographics from appearance or collapse biracial categories silently.

## Conservative candidate inventory

Audit rule: match expression filename to one unique codebook row (case-insensitive); require a standardized neutral image with the same identity ID; retain `Consent = full`; require `Expession_Highest = pain`. This is a transparent preliminary filter, not a validated selection criterion for the experiment.

| Self-reported race/ethnicity | Female identities | Male identities |
| --- | ---: | ---: |
| Asian | 6 | 11 |
| Black | 9 | 19 |
| Hispanic | 7 | 9 |
| White | 18 | 38 |

Three additional qualifying identities retain their separately documented biracial labels in the CSV. Total: **120 candidate identities / 227 expression images**. Without the pain-highest filter, the full-consent paired pool is 213 identities / 614 expression images.

- Reproducible audit: `inventory_dpd.py` (requires Python + openpyxl).
- [Paired image inventory](file:///Users/cyrusyang/Development/Memory-Bias-Pain/stimuli/Delaware_Pain_Database/paired-stimulus-inventory.csv): demographic labels, consent restrictions, pain ratings, highest-rated emotion, and neutral/expression paths. This CSV includes all uniquely matched expressions; apply the filters above to obtain the conservative subset.
- `inventory-summary.json` contains counts; `inventory-issues.json` records nine expression files without a unique codebook match and one expression identity without a standardized neutral match. Two case-only filename differences were resolved; other discrepancies were not guessed. The LM14 p4c codebook entry is duplicated with different emotion ratings and is excluded.
- `official-file-inventory.json` records the source listings; `download-manifest.json` records local file sizes and SHA-256 hashes after download. Hashes document the local snapshot; they are not a comparison against official published checksums.

## Implications for the pain task

- **Black/White × female/male** is a feasible candidate design. Equal sampling is initially limited to **at most nine identities per cell**, before image-quality and pain-intensity matching. This is an inventory ceiling, not a power-based recommendation.
- A Black/White male-only pilot has a larger initial pool (19 vs. 38); it would not support conclusions about gender differences. The codebook documents gender, so do not relabel this as measured biological sex.
- A broader four-group × gender design is more constrained: the Asian-female cell has six candidates before further screening. Avoid adding demographic conditions merely because files exist.
- Next: visually inspect neutral/expression pairs and variants; match endpoint pain ratings, competing emotions, perceived age, and image quality across groups; then build each identity's neutral→pain 61-frame continuum. Validate perceived pain along that continuum rather than assuming equal pixel-morph steps produce equal perceived pain steps.
- Resolve filename/codebook ambiguities with the lab if those stimuli are needed. Review neutral-image variants before choosing one; sharing an identity ID does not establish that every edited variant is interchangeable.
- Confirm hosting/derived-image permission before adding these files to the deployed experiment. No database images have been added to the `pain` repository by this access task.

## Proposed permission inquiry — not sent

> We are planning a non-commercial university study of memory for painful facial expressions. We would like to select consent-eligible neutral/pain pairs, generate within-identity morph continua, and present them in an online experiment. Could you confirm whether participant-facing hosting and these derived stimuli are permitted, and provide any required written permission? We would not place images in a public repository. Please also advise on permissions for illustrative figures in publications.

Related: [[2026-10-26-1718 Individual Meeting#9. Check Delaware Pain Database Access]] · [[Expt 1 - Memory for Painful Facial Expressions]].
