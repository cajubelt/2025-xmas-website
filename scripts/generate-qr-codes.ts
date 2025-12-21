#!/usr/bin/env node
/**
 * Script to generate QR codes for the Christmas website
 * 
 * Usage:
 *   npm run generate-qr                         # Generate all configured QR codes
 *   npm run generate-qr -- <url>                # Generate QR code for URL (auto-named)
 *   npm run generate-qr -- <url> <filename>     # Generate QR code with custom filename
 */

import QRCode from 'qrcode';
import { join } from 'path';

interface QRCodeConfig {
  name: string;
  url: string;
  filename: string;
}

// Configuration for the website's QR codes
const QR_CODES: QRCodeConfig[] = [
  {
    name: 'Emily',
    url: 'https://xmas.bellsare.cool/emily',
    filename: 'emily-qr.png'
  },
  {
    name: 'Richard',
    url: 'https://xmas.bellsare.cool/richard',
    filename: 'richard-qr.png'
  },
  {
    name: 'Tammy',
    url: 'https://xmas.bellsare.cool/tammy',
    filename: 'tammy-qr.png'
  }
];

// QR Code generation options
const QR_OPTIONS: QRCode.QRCodeToFileOptions = {
  errorCorrectionLevel: 'M',
  margin: 2,
  width: 512,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
};

/**
 * Generate a single QR code
 */
async function generateQRCode(url: string, outputPath: string, name?: string): Promise<void> {
  try {
    await QRCode.toFile(outputPath, url, QR_OPTIONS);
    console.log(`✓ Generated QR code${name ? ` for ${name}` : ''}: ${outputPath}`);
  } catch (error) {
    console.error(`✗ Failed to generate QR code${name ? ` for ${name}` : ''}:`, error);
    throw error;
  }
}

/**
 * Generate all configured QR codes
 */
async function generateAllQRCodes(): Promise<void> {
  const publicDir = join(process.cwd(), 'public');
  
  console.log('Generating QR codes...\n');
  
  for (const config of QR_CODES) {
    const outputPath = join(publicDir, config.filename);
    await generateQRCode(config.url, outputPath, config.name);
  }
  
  console.log('\n✓ All QR codes generated successfully!');
}

/**
 * Generate filename from URL
 */
function generateFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace(/^\//, '').replace(/\//g, '-') || 'qr';
    return `${path}-qr.png`;
  } catch {
    // If URL parsing fails, use timestamp
    return `qr-${Date.now()}.png`;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const publicDir = join(process.cwd(), 'public');
  
  if (args.length === 0) {
    // Generate all configured QR codes
    await generateAllQRCodes();
  } else if (args.length >= 1) {
    // Generate a single QR code from command line arguments
    const url = args[0];
    const filename = args.length >= 2 ? args[1] : generateFilenameFromUrl(url);
    const outputPath = join(publicDir, filename);
    
    console.log(`Generating QR code for: ${url}`);
    console.log(`Output file: ${filename}\n`);
    await generateQRCode(url, outputPath);
    console.log('\n✓ QR code generated successfully!');
  }
}

// Run the script
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
