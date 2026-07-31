import { uploadCoverImage } from "@/services/yotoService";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Upload card icon (16x16) if available
 * @param {string} accessToken - Yoto API access token
 * @returns {Promise<string|null>} Media ID of uploaded icon (for yoto:#mediaId format), or null if no icon found
 */
export async function uploadCardIcon(accessToken) {
  try {
    // Try to find an icon in the card-images directory
    const publicDir = join(process.cwd(), 'public', 'assets', 'card-images');
    const possibleIcons = ['countdown-to-f1-icon.png', 'f1-icon.png'];
    
    for (const iconName of possibleIcons) {
      try {
        const iconPath = join(publicDir, iconName);
        const iconBuffer = readFileSync(iconPath);
        
        console.log(`Found icon: ${iconName}, uploading to Yoto...`);
        
        // Upload icon to Yoto with autoConvert to resize to 16x16
        const url = new URL('https://api.yotoplay.com/media/displayIcons/user/me/upload');
        url.searchParams.set('autoConvert', 'true');
        url.searchParams.set('filename', iconName.replace(/\.[^/.]+$/, '')); // Remove extension
        
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'image/png',
          },
          body: iconBuffer,
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          // Check if it's a permission error (very common - icon uploads are restricted)
          if (errorText.includes('not authorized') || errorText.includes('explicit deny')) {
            console.log('Note: Custom icon uploads require special API permissions. Continuing without icon.');
            return null;
          }
          throw new Error(`Icon upload failed: ${errorText}`);
        }
        
        const result = await response.json();
        const mediaId = result.displayIcon?.mediaId;
        
        if (!mediaId) {
          throw new Error('No mediaId in upload response');
        }
        
        console.log(`Icon uploaded successfully with mediaId: ${mediaId}`);
        return mediaId;
      } catch (err) {
        // File not found or upload failed, continue to next possibility
        console.log(`Could not process icon "${iconName}": ${err.message}`);
        continue;
      }
    }
    
    console.log('No icon found in public/assets/card-images/');
    return null;
  } catch (error) {
    console.error('Error uploading icon:', error);
    // Don't fail the entire request if icon upload fails
    return null;
  }
}

/**
 * Map an F1 constructor name to its car icon filename in
 * public/assets/card-images, if a team-specific icon exists.
 * @param {string} teamName - F1 constructor name (e.g. "Red Bull Racing")
 * @returns {string|null} Icon filename, or null if no team-specific icon exists
 */
export function getTeamCarIconFilename(teamName) {
  if (!teamName) return null;
  const normalized = teamName.toLowerCase();

  if (normalized.includes('ferrari')) return 'ferrari.png';
  if (normalized.includes('mclaren')) return 'mclaren.png';
  if (normalized.includes('mercedes')) return 'mercedes.png';
  if (normalized.includes('red bull')) return 'redbull.png';

  return null;
}

/**
 * Upload a team's car icon (16x16) if a matching icon file exists.
 * @param {string} teamName - F1 constructor name (e.g. "Red Bull Racing")
 * @param {string} accessToken - Yoto API access token
 * @returns {Promise<string|null>} Media ID of uploaded icon, or null if unavailable
 */
export async function uploadTeamCarIcon(teamName, accessToken) {
  const iconName = getTeamCarIconFilename(teamName);
  if (!iconName) {
    return null;
  }

  try {
    const publicDir = join(process.cwd(), 'public', 'assets', 'card-images');
    const iconPath = join(publicDir, iconName);
    const iconBuffer = readFileSync(iconPath);

    console.log(`Found team icon for "${teamName}": ${iconName}, uploading to Yoto...`);

    const url = new URL('https://api.yotoplay.com/media/displayIcons/user/me/upload');
    url.searchParams.set('autoConvert', 'true');
    url.searchParams.set('filename', iconName.replace(/\.[^/.]+$/, ''));

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'image/png',
      },
      body: iconBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes('not authorized') || errorText.includes('explicit deny')) {
        console.log('Note: Custom icon uploads require special API permissions. Continuing without team icon.');
        return null;
      }
      throw new Error(`Team icon upload failed: ${errorText}`);
    }

    const result = await response.json();
    const mediaId = result.displayIcon?.mediaId;

    if (!mediaId) {
      throw new Error('No mediaId in upload response');
    }

    console.log(`Team icon uploaded for "${teamName}" with mediaId: ${mediaId}`);
    return mediaId;
  } catch (error) {
    console.log(`Could not upload team icon for "${teamName}": ${error.message}`);
    return null;
  }
}

/**
 * Upload car icons for a set of teams, deduplicating by icon file so each
 * icon file is only uploaded once even when multiple drivers share a team.
 * @param {string[]} teamNames
 * @param {string} accessToken - Yoto API access token
 * @returns {Promise<Map<string, string>>} Map of team name -> media ID (only teams with a matching icon are included)
 */
export async function uploadTeamCarIcons(teamNames, accessToken) {
  const mediaIdsByIconFile = new Map();
  const mediaIdsByTeam = new Map();

  for (const teamName of new Set((teamNames || []).filter(Boolean))) {
    const iconName = getTeamCarIconFilename(teamName);
    if (!iconName) continue;

    if (!mediaIdsByIconFile.has(iconName)) {
      mediaIdsByIconFile.set(iconName, await uploadTeamCarIcon(teamName, accessToken));
    }

    const mediaId = mediaIdsByIconFile.get(iconName);
    if (mediaId) {
      mediaIdsByTeam.set(teamName, mediaId);
    }
  }

  return mediaIdsByTeam;
}

/**
 * Download and upload country flag as icon
 * @param {string} flagUrl - URL to the country flag image
 * @param {string} accessToken - Yoto API access token
 * @param {string} countryName - Name of the country (for filename)
 * @returns {Promise<string|null>} Media ID of uploaded icon, or null on error
 */
export async function uploadCountryFlagIcon(flagUrl, accessToken, countryName = 'country') {
  try {
    if (!flagUrl) {
      console.log('No country flag URL provided');
      return null;
    }

    console.log(`Downloading country flag from: ${flagUrl}`);
    
    // Download the flag image
    const flagResponse = await fetch(flagUrl, {
      signal: AbortSignal.timeout(5000)
    });

    if (!flagResponse.ok) {
      throw new Error(`Failed to download flag: ${flagResponse.status}`);
    }

    const flagBuffer = Buffer.from(await flagResponse.arrayBuffer());
    
    // Get content type from response headers, fallback to image/png
    const contentType = flagResponse.headers.get('content-type') || 'image/png';
    
    console.log(`Downloaded flag (${flagBuffer.length} bytes, ${contentType}), uploading to Yoto...`);
    
    // Upload flag as icon to Yoto with autoConvert to resize to 16x16
    const url = new URL('https://api.yotoplay.com/media/displayIcons/user/me/upload');
    url.searchParams.set('autoConvert', 'true');
    url.searchParams.set('filename', `${countryName.toLowerCase().replace(/\s+/g, '-')}-flag`);
    
    const uploadResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: flagBuffer,
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      // Check if it's a permission error (very common - icon uploads are restricted)
      if (errorText.includes('not authorized') || errorText.includes('explicit deny')) {
        console.log('Note: Custom icon uploads require special API permissions. Continuing without icon.');
        return null;
      }
      throw new Error(`Flag icon upload failed: ${errorText}`);
    }
    
    const result = await uploadResponse.json();
    const mediaId = result.displayIcon?.mediaId;
    
    if (!mediaId) {
      throw new Error('No mediaId in upload response');
    }
    
    console.log(`Country flag icon uploaded successfully with mediaId: ${mediaId}`);
    return mediaId;
  } catch (error) {
    // Check if it's a permission error and handle gracefully
    if (error.message?.includes('not authorized') || error.message?.includes('explicit deny')) {
      console.log('Note: Custom icon uploads require special API permissions. Continuing without icon.');
    } else {
      console.error('Error uploading country flag icon:', error);
    }
    return null;
  }
}

/**
 * Upload card cover image if available
 * @param {string} accessToken - Yoto API access token
 * @returns {Promise<string|null>} Media URL of uploaded image, or null if no image found
 */
export async function uploadCardCoverImage(accessToken) {
  try {
    // Try to find a cover image in the card-images directory
    const publicDir = join(process.cwd(), 'public', 'assets', 'card-images');
    const possibleImages = [
      'f1-card-cover.jpg',
      'f1-card-cover.jpeg', 
      'f1-card-cover.png',
      'countdown-to-f1-card.png'
    ];
    
    for (const imageName of possibleImages) {
      try {
        const imagePath = join(publicDir, imageName);
        const imageBuffer = readFileSync(imagePath);
        
        // Determine content type from file extension
        const ext = imageName.split('.').pop().toLowerCase();
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
        
        console.log(`Found cover image: ${imageName}, uploading to Yoto...`);
        const mediaUrl = await uploadCoverImage(imageBuffer, accessToken, contentType);
        
        if (mediaUrl) {
          console.log(`Cover image uploaded successfully: ${mediaUrl}`);
          return mediaUrl;
        } else {
          console.log('Cover image upload skipped due to permissions');
          return null;
        }
      } catch (err) {
        // File not found, continue to next possibility
        console.error(`Error processing cover image "${imageName}":`, err);
        continue;
      }
    }
    
    console.log('No cover image found in public/assets/card-images/');
    return null;
  } catch (error) {
    console.error('Error uploading cover image:', error);
    // Don't fail the entire request if cover upload fails
    return null;
  }
}
