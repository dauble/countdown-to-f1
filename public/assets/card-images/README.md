# Card Images Directory

This directory stores card cover images that will be uploaded to Yoto and displayed as card artwork.

## Usage

1. Place your custom card image in this directory as `countdown-to-f1-card.png`
2. The image will be automatically uploaded to Yoto when creating/updating your card
3. Yoto will automatically resize and optimize your image with the `autoconvert` parameter

## Image Guidelines

- **Format**: PNG format (required)
- **Size**: Any size (Yoto will automatically resize)
- **Recommended**: Square images work best for card covers
- **File name**: Must be named `countdown-to-f1-card.png`

## Current Images

- `countdown-to-f1-card.png` - Default F1 card cover (replace with your own image using this filename)
- `countdown-to-f1-icon.png` - Generic 16x16 icon used for race weekend and session chapters
- `ferrari.png`, `mclaren.png`, `mercedes.png`, `redbull.png` - Team car icons used on the Top 5 Drivers and Top 5 Constructors chapter tracks (see `src/utils/imageUtils.js#getTeamCarIconFilename`). Teams without a matching file fall back to the generic icon.

## API Reference

For more information about cover image uploads, see:
https://yoto.dev/myo/uploading-cover-images/
