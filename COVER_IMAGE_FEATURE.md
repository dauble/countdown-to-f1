# Card Cover Image Upload Feature

## Overview

Your Yoto F1 app now automatically uploads custom cover images to display as card artwork! This feature follows the official Yoto API guidelines for uploading custom cover images.

## How It Works

1. **Automatic Detection**: When you generate or update an F1 card, the app automatically looks for a cover image in the `public/assets/card-images/` directory
2. **Smart Upload**: If an image is found, it's uploaded to Yoto's API with the `autoconvert=true` parameter, which automatically resizes and optimizes your image
3. **Card Integration**: The uploaded image URL is included in your card's metadata and displayed as the card artwork in the Yoto app

## Adding Your Cover Image

### Step 1: Add Your Image

Place your cover image in the `public/assets/card-images/` directory with this name:

- `countdown-to-f1-card.png` (required filename)

### Step 2: Generate Your Card

Run your app and authenticate with Yoto (required). Then generate an F1 card as usual. The app will:

1. Find your image
2. Upload it to Yoto
3. Create/update your card with the custom cover art

### Step 3: View in Yoto App

Your custom cover image will appear as the card artwork in the Yoto app and on compatible players!

## Image Guidelines

- **Format**: JPEG or PNG
- **Size**: Any size (Yoto automatically resizes)
- **Recommended**: Square images (e.g., 500x500 or 1000x1000) work best
- **Content**: Choose an F1-related image that represents your card

## Technical Details

### Code Changes

The implementation includes:

1. **`uploadCoverImage()` function** in [src/services/yotoService.js](../src/services/yotoService.js)

   - Uploads image buffer to Yoto API
   - Returns media URL for use in card metadata
   - Uses `autoconvert=true` for automatic optimization

2. **`createTextToSpeechPlaylist()` enhancement** in [src/services/yotoService.js](../src/services/yotoService.js)

   - Now accepts optional `coverImageUrl` parameter
   - Includes cover image in `metadata.cover.imageL` field

3. **`uploadCardCoverImage()` helper** in [src/app/api/generate-card/route.js](../src/app/api/generate-card/route.js)
   - Searches for cover images in the designated directory
   - Automatically detects image type (JPEG/PNG)
   - Handles upload gracefully (won't fail if no image found)

### API Flow

```
1. App starts card generation
2. Checks for image in public/assets/card-images/
3. If found: Uploads to Yoto API → Receives mediaUrl
4. Creates card with mediaUrl in metadata.cover.imageL
5. Card displays with custom artwork!
```

## Example Cover Image Sources

You can find F1 images from:

- Official F1 website (respect copyright)
- Free stock photo sites (Unsplash, Pexels)
- Your own F1-themed designs
- AI-generated F1 artwork

## Troubleshooting

**Image not appearing?**

- Check the file name matches one of the supported names
- Ensure the image is in the correct directory: `public/assets/card-images/`
- Check server logs for upload errors
- Verify the image file isn't corrupted

**Upload failing?**

- Check your Yoto authentication is valid
- Ensure the image file size isn't too large (< 10MB recommended)
- Verify network connectivity to Yoto API

## API Reference

For more information about Yoto's cover image API, visit:
https://yoto.dev/myo/uploading-cover-images/

## Example

To test the feature:

1. Download an F1 logo or race image
2. Save it as `public/assets/card-images/f1-card-cover.jpg`
3. Run the app and generate a card
4. Check your Yoto library - the card should have your custom image!
