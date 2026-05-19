# LLM BBox Demo

## Concept & Vision

A sleek, interactive image annotation tool that combines drag-and-drop image upload with AI-powered object detection via natural language. Users drop an image, describe what they want to find using conversation, and watch as the AI returns bounding box coordinates that overlay directly on the image. The experience feels like having a computer vision expert on call.

## Design Language

**Aesthetic direction**: Dark, professional interface inspired by developer tools and AI platforms like Cursor and Replit. Emphasis on the image as the focal point with UI elements receding into darkness.

**Color palette**:
- Background: `#0c0c0c` (near black)
- Surface: `#1a1a1a` (elevated panels)
- Border: `#2a2a2a` (subtle dividers)
- Primary accent: `#3b82f6` (blue for actions)
- Text primary: `#fafafa`
- Text secondary: `#a1a1aa`
- Success: `#22c55e`
- Error: `#ef4444`
- Bounding box: `#ef4444` (red, 2px solid)

**Typography**:
- Font: `Geist Sans` (fallback: system-ui, sans-serif)
- Headings: 600 weight
- Body: 400 weight
- Monospace for coordinates: `Geist Mono`

**Spatial system**: 8px base unit. Generous padding (24px) in panels. 12px gap between elements.

**Motion philosophy**: Subtle, functional animations. Drop zone pulses gently on drag-over. Bounding box fades in (200ms ease-out). Messages slide in from bottom.

## Layout & Structure

**Two-column layout on desktop**:
- Left (60%): Image preview area with bounding box overlay
- Right (40%): Chat interface

**Mobile (< 768px)**: Stacked vertically, image on top, chat below.

**Visual pacing**: The image preview is the hero—large, centered, with breathing room. The chat panel feels secondary but accessible.

## Features & Interactions

### Image Drop Zone
- Accepts drag-and-drop or click-to-upload
- Supported formats: JPEG, PNG, WebP
- On drag-over: border becomes blue, background lightens slightly
- On drop: immediately show image preview, hide drop zone text
- Shows file name and dimensions after upload

### Image Preview
- Displays uploaded image scaled to fit container
- Overlays bounding boxes returned from LLM
- Each box: red (#ef4444), 2px solid stroke
- Box coordinates normalized (0-1 range)
- Hover on box: tooltip shows label and confidence

### Chat Interface
- Message history with user/assistant distinction
- User messages: right-aligned, blue background
- Assistant messages: left-aligned, dark background
- Input field at bottom with send button
- Enter to send, Shift+Enter for newline
- Thinking indicator while waiting for response

### LLM Integration
- POST to `/api/chat/completions`
- System prompt instructs model to return bounding boxes in JSON format
- Response parsing extracts bbox coordinates
- Draws boxes on image preview

### Bounding Box Format
```json
{
  "bboxes": [
    {
      "label": "person",
      "x": 0.15,
      "y": 0.20,
      "width": 0.10,
      "height": 0.35
    }
  ]
}
```

## Component Inventory

### DropZone
- Default: dashed border (#2a2a2a), upload icon, instructional text
- Hover: border color lightens
- Drag-over: border becomes blue, background #1a1a1a → #1f1f1f
- Has image: shows image preview

### ImagePreview
- Container with relative positioning for bbox overlay
- Image: `object-fit: contain`, max-height 100%
- BoundingBox: absolute positioned divs with red border

### ChatMessage
- User: aligned right, bg #3b82f6, text white, rounded corners
- Assistant: aligned left, bg #2a2a2a, text white, rounded corners
- Error state: red-tinted background

### ChatInput
- Dark input field (#1a1a1a background)
- Send button with arrow icon
- Disabled state while processing

### ThinkingIndicator
- Three animated dots
- Pulse animation

## Technical Approach

**Framework**: Next.js 14+ with App Router
**Styling**: CSS Modules or inline styles (no Tailwind)
**State**: React useState for image, messages, bboxes
**Image handling**: FileReader API for local preview, base64 encoding for API

**API Design**:
- `POST /api/chat/completions`
- Request: `{ messages: [{role, content}, ...], imageBase64?: string }`
- Response: `{ bboxes: [{label, x, y, width, height}, ...], text: string }`

**Prompt Strategy**: Include image (if provided) in the conversation so the model can "see" it, ask it to identify objects and return bounding boxes in specific JSON format.