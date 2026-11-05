# Flowers & Moonlight

A personal four-scene story told through blooming ASCII flowers, a moonlit ocean, a floating-lantern wish, and a handwritten letter.

Open `index.html` in a browser. It has no dependencies or build step. You can also serve the folder with any static server, for example `npx serve` or VS Code Live Server.

## The bloom

It follows a florist's bouquet opening over a few days, sped up to about 15 seconds:

1. Tall stems rise from a gathered bunch and lance-shaped leaves unfurl along them. Arching sprigs of ruscus fan out around them, with glossy leaves alternating up each sprig.
2. Each stem ends in a compact flower bud on a short side stalk.
3. The buds swell among the green foliage.
4. All the pink tulips lift their pointed, cupped petals together.
5. A few buds stay green or only blush, like a real bunch.

After that it keeps swaying gently.

## The journey

1. The pink tulip bouquet grows and blooms.
2. A couple watches the moon beside the ocean while music and waves play together.
3. The couple releases a wish beneath floating lanterns.
4. An envelope opens into a personal letter.

## Controls

- **Click, Space or `R`**: replay the bloom
- **Right/left arrow keys**: move between scenes
- **Scene dots**: jump directly to any scene
- **Back arrow or `Escape`**: return to the previous scene
- **Sound button**: mute or restore all music and ambience
- **Lantern scene**: tap the scene to release the wish

## URL options

- `?t=8` starts 8 seconds into the bloom

## How it works

Each frame draws the bouquet with ordinary canvas shapes onto a tiny offscreen canvas, one pixel per character cell. Each pixel is then redrawn as a crisp glyph from ` .,:;i1tfLCG08@`, picked by brightness and coloured with the pixel's colour. The tulips use pointed, overlapping petals to form a distinct cup silhouette.
