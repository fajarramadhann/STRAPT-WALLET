# Farcaster Frames Integration

This document describes the Farcaster frames integration for the STRAPT project, allowing users to interact with STRAPT functionality directly within Farcaster clients like Warpcast.

## Overview

STRAPT now supports Farcaster frames, enabling users to:
- Send secure transfers with password protection
- Create and claim STRAPT drops
- View transaction status and balances
- Access core STRAPT features without leaving Farcaster

## Frame URLs

### Transfer Frame
- **Create Transfer**: `/frames/transfer`
- **Transfer with params**: `/frames/transfer?recipient=username&amount=100&token=IDRX`

### STRAPT Drop Frame
- **Create Drop**: `/frames/drop?mode=create`
- **Claim Drop**: `/frames/drop/{dropId}`
- **View Drop**: `/frames/drop/{dropId}?mode=view`

### General Frame
- **Frame Index**: `/frames` - Shows available frame options

## Architecture

### Components

#### Frame Layout Components (`/src/components/frames/FrameLayout.tsx`)
- `FrameLayout`: Main container with proper aspect ratio
- `FrameHeader`: Header with title and icon
- `FrameContent`: Scrollable content area
- `FrameActions`: Button container at bottom
- `FrameButton`: Styled button for frame actions
- `FrameInput`: Input field for user data
- `FrameStatus`: Status messages and alerts

#### Frame-Specific Components
- `TransferFrame`: Complete transfer flow in frame format
- `StraptDropFrame`: Drop creation and claiming interface

#### Frame Pages
- `TransferFramePage`: Entry point for transfer frames
- `StraptDropFramePage`: Entry point for drop frames
- `FrameRouter`: Handles frame-specific routing

### Context and State Management

#### Farcaster Context (`/src/contexts/FarcasterContext.tsx`)
- Manages Farcaster user authentication
- Handles frame detection and context
- Provides signing capabilities for frame actions

#### Frame Hooks (`/src/hooks/use-frame.ts`)
- `useFrame`: Main hook for frame state management
- `useFrameWallet`: Wallet integration for frames
- `useFrameUrls`: URL generation utilities

### API Integration (`/src/api/frames.ts`)
- Frame request/response handling
- Metadata generation for social sharing
- Frame validation utilities

## Frame Metadata

Each frame generates proper metadata for social sharing:

```html
<meta property="fc:frame" content="vNext" />
<meta property="fc:frame:image" content="https://your-domain.com/frame-image.png" />
<meta property="fc:frame:button:1" content="Send Transfer" />
<meta property="fc:frame:button:1:action" content="post" />
<meta property="fc:frame:post_url" content="https://your-domain.com/api/frames/transfer" />
```

## Image Generation

### Static Images
Place frame images in `/public/assets/`:
- `frame-transfer-default.png`
- `frame-transfer-success.png`
- `frame-drop-create.png`
- `frame-drop-claim.png`

### Dynamic Images
Use the `FrameImageGenerator` component or `useFrameImageGenerator` hook to create dynamic images with:
- Custom titles and subtitles
- Token amounts and symbols
- Status indicators
- STRAPT branding

## Usage Examples

### Basic Transfer Frame
```tsx
import { TransferFrame } from '@/components/frames/TransferFrame';

function MyTransferFrame() {
  return (
    <TransferFrame
      onTransferComplete={(txHash) => {
        console.log('Transfer completed:', txHash);
      }}
    />
  );
}
```

### Custom Frame Layout
```tsx
import { FrameLayout, FrameHeader, FrameContent, FrameActions, FrameButton } from '@/components/frames/FrameLayout';

function CustomFrame() {
  return (
    <FrameLayout>
      <FrameHeader title="Custom Frame" icon={<Icon />} />
      <FrameContent>
        <p>Your content here</p>
      </FrameContent>
      <FrameActions>
        <FrameButton onClick={handleAction}>Action</FrameButton>
      </FrameActions>
    </FrameLayout>
  );
}
```

### Using Frame Hooks
```tsx
import { useFrame, useFrameWallet } from '@/hooks/use-frame';

function FrameComponent() {
  const { frameState, actions } = useFrame({
    homeFrameUrl: '/frames/transfer',
    onFrameAction: (result) => console.log(result),
  });

  const { address, isConnected } = useFrameWallet();

  return (
    <div>
      {isConnected ? (
        <p>Connected: {address}</p>
      ) : (
        <button onClick={() => actions.handleButtonPress(1)}>
          Connect
        </button>
      )}
    </div>
  );
}
```

## Deployment Considerations

### Frame Validation
- Ensure all frame URLs are publicly accessible
- Test frame metadata with Farcaster frame validators
- Verify images load correctly and have proper dimensions

### Performance
- Optimize frame images for fast loading
- Use appropriate caching headers
- Minimize frame response times

### Security
- Validate all frame inputs
- Implement proper authentication
- Use HTTPS for all frame endpoints

## Testing

### Local Testing
1. Start the development server: `bun dev`
2. Access frames at `http://localhost:8080/frames/transfer`
3. Use browser dev tools to inspect frame metadata

### Frame Validators
- Use Farcaster frame debugging tools
- Test in Warpcast or other Farcaster clients
- Validate frame metadata with online tools

## Integration with Existing App

The frame integration is designed to work alongside the existing STRAPT app:

- Frame routes are accessible without wallet connection
- Frames can redirect to the main app for complex operations
- Shared components and hooks maintain consistency
- Frame state can be synchronized with app state

## Future Enhancements

- Add more frame types (streams, savings, etc.)
- Implement frame analytics and tracking
- Add support for frame transactions
- Integrate with Farcaster social features
- Add frame-specific notifications

## Troubleshooting

### Common Issues

1. **Frame not loading**: Check URL accessibility and metadata
2. **Images not displaying**: Verify image URLs and dimensions
3. **Actions not working**: Check frame validation and signing
4. **Wallet connection issues**: Verify Farcaster context setup

### Debug Mode
Enable debug logging by setting `localStorage.setItem('frame-debug', 'true')` in browser console.

## Resources

- [Farcaster Frames Documentation](https://docs.farcaster.xyz/learn/what-is-farcaster/frames)
- [frames.js Documentation](https://framesjs.org/)
- [Warpcast Frame Testing](https://warpcast.com/~/developers/frames)
