# Frame Images

This directory contains static images used for Farcaster frames.

## Required Images

### Transfer Frame Images
- `frame-transfer-default.png` - Default transfer frame image
- `frame-transfer-success.png` - Successful transfer completion
- `frame-transfer-error.png` - Transfer error state

### STRAPT Drop Frame Images
- `frame-drop-create.png` - Create drop interface
- `frame-drop-claim.png` - Claim drop interface
- `frame-drop-success.png` - Drop created successfully
- `frame-drop-claimed.png` - Drop claimed successfully

### General Frame Images
- `frame-welcome.png` - Welcome/landing frame
- `frame-loading.png` - Loading state
- `frame-error.png` - General error state

## Image Specifications

- **Aspect Ratio**: 1.91:1 (recommended) or 1:1
- **Dimensions**: 764x400px (1.91:1) or 400x400px (1:1)
- **Format**: PNG or JPEG
- **File Size**: < 1MB for optimal loading

## Dynamic Image Generation

For dynamic content, use the `FrameImageGenerator` component or `generateDynamicFrameImage` utility function to create images programmatically with:

- Custom titles and descriptions
- Token amounts and symbols
- Status indicators
- STRAPT branding

## Usage

Images are referenced in frame metadata and can be accessed via:
```
https://your-domain.com/assets/frame-transfer-default.png
```

For development, you can use placeholder images or generate them dynamically using the Canvas API utilities provided in the codebase.
