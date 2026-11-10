# Asset prompts for the mobile app (2026-11-11)

These are the images the app still needs, or has only as a weak stand-in. Each one has a prompt you can paste as it is. `illustrations-needed.md` is a different list: the placeholders on the Figma boards.

**Why these images.** The app's current art is the 3D clay set in `assets/illustrations/redesign/`: glossy lavender and indigo objects with gold accents, no people, on a transparent background. Some screens still use an older flat-character style, as PNGs that also have a **solid white background** where it should be transparent, so on a lavender or grey surface they show as a white box. `system/not-found.png` even has **black corners**. Those are section B. Section A is places that have no art at all.

**How to generate**
- Model: GPT Image 2.6 at **high** quality. The clay set was made at medium, which is why it is 640 px.
- Size: the literal string given with each prompt (`1024x1024` or `1536x1024`).
- Background: **transparent**. Every prompt asks for it; if a result comes back on white, regenerate it rather than cutting it out by hand.
- Save each image as PNG under the file name given. I'll convert it to WebP, size it and wire it in, then delete the old PNG.

**The shared style.** It is already written into every prompt below; it is shown once here so you can see what makes the set consistent:

> 3D clay render with a soft, glossy plasticine look and rounded, bevelled edges, like a premium mobile app illustration. Palette: soft lavender (#EDEAFF to #C9C2FF), brand indigo (#4733F9) for the key shapes, white paper surfaces, and small warm gold (#F5B82E) accents only where named. Soft studio light from the top left, gentle ambient occlusion and a faint contact shadow under the object. Three to five small floating four-point sparkles and short spark lines in lavender and gold around it. No people, no faces on objects, no readable text, letters, numbers or logos; text lines on paper are plain rounded bars. One object group, centred, with about 12% empty margin on every side. Transparent background.

---

## A. Missing: these screens have no image today

### A1 · `no-chats.png` · Assistant, the empty Chats sheet
Shown about 120 pt square, above "No earlier chats yet". Today it is a small icon tile. Size `1024x1024`.
```
Two rounded 3D speech bubbles stacked and slightly overlapping: a larger white bubble behind with three plain lavender text bars, and a smaller glossy indigo bubble in front holding a single white four-point sparkle. A small round lavender clock badge with indigo hands sits on the lower right edge of the white bubble, suggesting past conversations. 3D clay render with a soft, glossy plasticine look and rounded, bevelled edges, like a premium mobile app illustration. Palette: soft lavender (#EDEAFF to #C9C2FF), brand indigo (#4733F9) for the key shapes, white paper surfaces, small warm gold (#F5B82E) accents only on two of the sparkles. Soft studio light from the top left, gentle ambient occlusion, faint contact shadow. Three to five small floating four-point sparkles and short spark lines. No people, no faces, no readable text, letters, numbers or logos. Centred with about 12% empty margin. Transparent background.
```

### A2 · `applied.png` · Tailor and Cover, the "Saved · apply on their site" sheet (IL-T1)
The board leaves a 150 × 112 slot above the title, and the code draws nothing there today. Size `1536x1024`.
```
A white 3D resume page (small round avatar circle and plain lavender text bars) gliding diagonally into a rounded browser window with a lavender top bar and three small dots. Inside the browser, a plain careers page made of indigo and lavender blocks with one big rounded indigo button shape. A small round indigo badge with a white "arrow pointing up and out of a box" symbol floats at the browser's top right corner, meaning "opens their site". Motion arcs behind the page. 3D clay render with a soft, glossy plasticine look and rounded, bevelled edges, like a premium mobile app illustration. Palette: soft lavender (#EDEAFF to #C9C2FF), brand indigo (#4733F9), white paper, small warm gold (#F5B82E) accents on two sparkles. Soft studio light from the top left, gentle ambient occlusion, faint contact shadow. Three to five small floating four-point sparkles and short spark lines. No people, no faces, no readable text, letters, numbers or logos. Centred with about 12% empty margin. Transparent background.
```

### A3 · `score-target.png` · Tailor review, "Answer to reach 10" (optional)
A small mark beside the section title, about 56 pt; today it is a line icon. Size `1024x1024`.
```
A round 3D archery target with concentric rings in white, lavender and indigo, standing slightly tilted, with a glossy indigo dart stuck exactly in the bullseye. A small gold star burst sits just above the dart's tail. 3D clay render with a soft, glossy plasticine look and rounded, bevelled edges, like a premium mobile app icon. Palette: soft lavender (#EDEAFF to #C9C2FF), brand indigo (#4733F9), white, warm gold (#F5B82E) only on the star. Soft studio light from the top left, gentle ambient occlusion, faint contact shadow. Two or three tiny four-point sparkles. No people, no faces, no readable text, letters, numbers or logos. Centred with about 12% empty margin. Transparent background.
```

---

## B. Replace: old style, opaque white background (24 images)

These all render through `FlowHero` (the hero at the top of a flow step) or a confirm sheet. Wide images go in a slot about 320 × 230 pt, small ones about 150 × 112 pt. Generate them all at `1536x1024`.

### Build a resume
**B1 · `build-job.png`** · Build 01, "Which job is it for?"
```
Two overlapping white 3D resume pages (small round avatar circle, plain lavender text bars) with a glossy indigo briefcase with a lavender clasp resting against their lower left corner. Short spark lines fan out from the briefcase. [STYLE]
```
**B2 · `build-choose.png`** · Build 02, "Choose a job"
```
Three rounded white 3D job cards fanned in a stack, each with a small lavender square logo block and two plain text bars, under a large glossy indigo magnifying glass whose lens slightly enlarges the top card. [STYLE]
```
**B3 · `build-add.png`** · Build 03, "Add the job"
```
A rounded 3D browser window with a lavender top bar and three small dots, showing a plain job page of lavender bars. A glossy indigo chain-link badge floats against its top right corner, as if a link were being dropped in. [STYLE]
```
**B4 · `build-read.png`** · Build 04, "We read the job"
```
A tall white 3D job posting page with plain text bars, three of them glowing indigo as if highlighted. A large glossy indigo magnifying glass is held over the highlighted lines. Small gold check ticks sit beside two of them. [STYLE]
```
**B5 · `build-writing.png`** · Build 05 "Building your resume", also Tailor 04
```
A white 3D resume page standing upright and filling with lines from top to bottom: the top bars solid indigo and lavender, the lower ones still faint, dashed outlines. A glossy indigo fountain pen with a gold nib hovers at the newest line, leaving a short trail of sparkles. [STYLE]
```
**B6 · `build-unreadable.png`** · Build 05b, "Couldn't read the job page"
```
A white 3D job posting page whose lines are blurred and scrambled, under a glossy indigo magnifying glass. A rounded amber warning triangle badge (#F5A524) with a white exclamation shape sits on the page's top right corner. Calm, not alarming. [STYLE]
```

### Tailor and the copied job link
**B7 · `tailor-writing.png`** · Tailor 04, "Tailoring your resume"
```
A white 3D resume page with a soft lavender tailor's tape measure (indigo tick marks) wrapped loosely around its middle, and a small glossy indigo pair of scissors beside it, suggesting a resume fitted to one job. A gold four-point sparkle on the page's corner. [STYLE]
```
**B8 · `copied-link.png`** · Home, the "copied job link" dialog
```
A rounded 3D smartphone with a lavender screen, standing slightly turned. A glossy indigo chain-link shape floats up out of the screen and is caught by a bright gold four-point sparkle above it. A faint dashed arc traces its path. [STYLE]
```

### Cover letter
**B9 · `cover-setup.png`** · Cover 01, "Set up"
```
A white 3D letter page with plain lavender text bars and a short indigo signature squiggle, leaning against an open lavender envelope with an indigo inner flap. Short spark lines above. [STYLE]
```
**B10 · `cover-writing.png`** · Cover 02, "Writing"
```
A white 3D letter page being written: the top paragraphs as solid lavender bars, the bottom still dashed outlines. A glossy indigo fountain pen with a gold nib writes the current line, trailing small sparkles. A closed lavender envelope rests behind the page. [STYLE]
```

### Resume from zero
**B11 · `zero-about.png`** · Zero 01, "Tell us about you"
```
A blank white 3D page with only a few dashed outline bars on it, and two small rounded lavender speech bubbles floating beside it, each holding a small indigo question-mark-shaped 3D object, suggesting a resume started from a few answers. A gold sparkle at the page corner. [STYLE]
```
**B12 · `zero-writing.png`** · Zero 02, "Writing your first draft"
```
A white 3D resume page half filled: some bars solid indigo and lavender, others left as dashed outline blanks, each blank marked by a tiny lavender question-mark-shaped 3D object. A glossy indigo pencil rests diagonally across the lower corner. [STYLE]
```

### ATS check
**B13 · `ats-upload.png`** · ATS 01, "Upload your resume"
```
A white 3D resume page sliding down into an open, glossy lavender folder with an indigo tab. Two curved motion lines above the page. [STYLE]
```
**B14 · `ats-paste.png`** · ATS 01b, "Pasted job description"
```
A rounded lavender 3D clipboard with an indigo clip, holding a white job description page of plain bars. A small glossy indigo magnifying glass leans against its lower right corner. [STYLE]
```
**B15 · `ats-checking.png`** · ATS 02, "Checking"
```
A white 3D resume page under a large glossy indigo magnifying glass. Beside it, a small rounded lavender score dial whose needle and arc are indigo, pointing high, with a gold sparkle at the needle tip. [STYLE]
```

### Interview prep and Assistant
**B16 · `interview-sets.png`** · Interview, the list of practice sets
```
Three rounded white 3D question cards fanned like a hand of cards, each with an indigo question-mark-shaped 3D object and two lavender bars, with a glossy lavender speech bubble rising behind them. [STYLE]
```
**B17 · `interview-new.png`** · Interview, "New practice set"
```
A glossy indigo 3D studio microphone on a short lavender stand, next to a white question card with an indigo question-mark-shaped 3D object. Two soft sound arcs come from the microphone. [STYLE]
```
**B18 · `assistant-first-run.png`** · Assistant, the first-run hero
```
A large glossy indigo 3D chat bubble with a white four-point sparkle inside, answering a smaller white chat bubble with three lavender text bars. A small white resume card rests at the bubbles' base. [STYLE]
```

### Account, billing and system
**B19 · `export-ready.png`** · Account, "Your data is ready"
```
An open glossy lavender 3D box with a white document page rising out of it, the page showing plain bars and a small curly-brace mark, with a round green check badge (#22C55E) on the page's corner. [STYLE]
```
**B20 · `checkout.png`** · Billing, the checkout confirm sheet
```
A rounded 3D laptop with a lavender screen showing a simple checkout page of blocks, with a large glossy indigo padlock floating in front of the screen and a small lavender shield beside it. [STYLE]
```
**B21 · `certifications-empty.png`** · Profile, empty Certifications list
```
A white 3D certificate in a rounded indigo frame, with plain lavender text bars and a large gold rosette seal with two indigo ribbon tails on its lower right corner. [STYLE]
```
**B22 · `sign-out.png`** · The "Sign out?" confirm
```
A glossy indigo 3D door standing half open in a lavender frame, warm light spilling from the gap, with a white rounded arrow pointing out through the opening. [STYLE]
```
**B23 · `discard.png`** · The "Discard changes?" confirm
```
A white 3D draft page with plain bars, a glossy indigo pencil lying across it, and a lavender curved "undo" arrow arcing over the page's top edge. [STYLE]
```
**B24 · `not-found.png`** · "Page not found". The current file has black corners.
```
A folded lavender 3D paper map with a dashed indigo path wandering across it and ending at an indigo map pin, with a small white paper plane looping above the map on a dotted trail. [STYLE]
```

`[STYLE]` above stands for this paragraph; paste it in place of the tag:
```
3D clay render with a soft, glossy plasticine look and rounded, bevelled edges, like a premium mobile app illustration. Palette: soft lavender (#EDEAFF to #C9C2FF), brand indigo (#4733F9) for the key shapes, white paper surfaces, small warm gold (#F5B82E) accents only where named. Soft studio light from the top left, gentle ambient occlusion, faint contact shadow under the object. Three to five small floating four-point sparkles and short spark lines in lavender and gold. No people, no faces on objects, no readable text, letters, numbers or logos; text lines on paper are plain rounded bars. One object group, centred, with about 12% empty margin on every side. Transparent background.
```

---

## C. Fine as they are
- **The 13 clay WebPs** (`redesign/`) are 640 px and shown at 150 pt or less, which is enough on a 3× phone. Only if one is ever shown above about 210 pt, upscale that one rather than regenerating it, so it stays the same picture.
- **The onboarding SVGs, job empty states, "caught up" and the Resumes first-run art** are vectors drawn from the boards, so they stay sharp at any size.
- **Company logos:** don't generate these. Google, Notion, Spotify and Adobe are real trademarks; real job listings show a letter tile or the logo the job feed provides.
- **App icon, splash and Android adaptive icons** are 1024 px, which is correct.
