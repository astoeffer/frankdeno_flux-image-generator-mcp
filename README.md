# FLUX Image Generator MCP Server

A Model Context Protocol (MCP) server for image generation using Black Forest Labs' FLUX models. Supports both **FLUX.2** (latest generation) and **FLUX.1** for comprehensive image creation and manipulation.

## Features

### FLUX.2 Models (Text-to-Image & Image-to-Image)
- **flux-2-pro** - Professional quality, up to 8 reference images
- **flux-2-max** - Maximum quality output
- **flux-2-flex** - Flexible with guidance and steps control
- **flux-2-klein-9b** - Fast generation (9B parameters)
- **flux-2-klein-4b** - Fastest generation (4B parameters, ~8GB VRAM)

### FLUX.1 Models (Editing)
- **Inpainting** (Fill) - Edit specific areas using masks
- **Outpainting** (Expand) - Extend images in any direction

## Available Tools

| Tool | Description | Model |
|------|-------------|-------|
| `generateImage` | Full-featured text-to-image generation | FLUX.2 |
| `quickImage` | Simple prompt-only generation | FLUX.2 Pro |
| `batchGenerateImages` | Generate multiple images (up to 10) | FLUX.2 |
| `img2img` | Image-to-image with reference images | FLUX.2 |
| `inpaint` | Edit areas using mask | FLUX.1 Fill |
| `outpaint` | Expand image boundaries | FLUX.1 Expand |
| `control` | Structural guidance (canny/depth/pose) | FLUX.1 Control |

## Prerequisites

- Node.js v18.0.0 or higher
- Black Forest Labs API key ([get one at api.bfl.ml](https://api.bfl.ml))

## Installation

### From Source

```bash
git clone https://github.com/astoeffer/frankdeno_flux-image-generator-mcp.git
cd frankdeno_flux-image-generator-mcp
npm install
```

Create a `.env` file:
```env
BFL_API_KEY=your_api_key_here
```

Build:
```bash
npm run build
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "flux-image-generator": {
      "command": "node",
      "args": ["/path/to/flux-image-generator-mcp/dist/index.js"],
      "env": {
        "BFL_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Tool Reference

### generateImage

Generate an image with full control over parameters.

**Parameters:**
- `prompt` (string, required): Text description of the image
- `model` (string): Model variant - `flux-2-pro`, `flux-2-max`, `flux-2-flex`, `flux-2-klein-9b`, `flux-2-klein-4b`
- `width` (number): Image width in pixels (default: 1024)
- `height` (number): Image height in pixels (default: 1024)
- `seed` (number): Random seed for reproducibility
- `safetyTolerance` (number): Content moderation 0-5 (default: 2)
- `outputFormat` (string): `jpeg` or `png`
- `guidance` (number): Guidance scale for FLEX model (1.5-10.0)
- `steps` (number): Inference steps for FLEX model (1-50)
- `promptUpsampling` (boolean): Enable for FLEX model
- `customPath` (string): Custom save path

**Example:**
```json
{
  "prompt": "A serene mountain landscape at sunset",
  "model": "flux-2-pro",
  "width": 1024,
  "height": 1024,
  "seed": 42
}
```

### quickImage

Simple generation with defaults.

**Parameters:**
- `prompt` (string, required): Text description
- `customPath` (string): Custom save path

### batchGenerateImages

Generate multiple images at once.

**Parameters:**
- `prompts` (array, required): List of text prompts (max 10)
- `model` (string): Model variant
- `width` (number): Width for all images
- `height` (number): Height for all images
- `customPath` (string): Directory to save images

### img2img

Generate using reference images (FLUX.2 multi-reference editing).

**Parameters:**
- `prompt` (string, required): Text description
- `inputImage` (string, required): Path to primary reference image
- `inputImages` (array): Additional reference images (Pro/Max: up to 7 more, Klein: up to 3 more)
- `model` (string): Model variant
- `width`, `height`, `seed`, `safetyTolerance`, `outputFormat`, `customPath`

**Example:**
```json
{
  "prompt": "Transform into a watercolor painting",
  "inputImage": "/path/to/reference.jpg",
  "inputImages": ["/path/to/style.jpg"],
  "model": "flux-2-pro"
}
```

### inpaint

Edit specific areas using a mask (FLUX.1 Fill).

**Parameters:**
- `image` (string, required): Path to image to edit
- `mask` (string, required): Path to mask image (white = regenerate, black = keep)
- `prompt` (string, required): Description of what to generate
- `steps` (number): Inference steps 15-50 (default: 50)
- `guidance` (number): Guidance scale 1.5-100 (default: 60)
- `seed`, `outputFormat`, `safetyTolerance`, `customPath`

**Example:**
```json
{
  "image": "/path/to/image.jpg",
  "mask": "/path/to/mask.png",
  "prompt": "Replace with a beautiful garden",
  "steps": 50,
  "guidance": 60
}
```

### outpaint

Expand image boundaries (FLUX.1 Expand).

**Parameters:**
- `image` (string, required): Path to image to expand
- `prompt` (string): Description for expanded areas
- `top`, `bottom`, `left`, `right` (number): Pixels to add (0-2048 each)
- `steps`, `guidance`, `seed`, `outputFormat`, `safetyTolerance`, `customPath`

**Example:**
```json
{
  "image": "/path/to/image.jpg",
  "prompt": "Continue the landscape",
  "top": 256,
  "left": 128,
  "right": 128
}
```

### control

Generate using structural guidance (FLUX.1 Control).

**Parameters:**
- `type` (string, required): Control type - `canny` (edges), `depth` (depth map), or `pose` (body skeleton)
- `image` (string, required): Path to control image
- `prompt` (string, required): Text description
- `steps` (number): Inference steps (default: 50)
- `guidance` (number): Guidance scale (defaults: canny=30, depth=15, pose=25)
- `seed`, `outputFormat`, `safetyTolerance`, `customPath`

**Example:**
```json
{
  "type": "canny",
  "image": "/path/to/edges.png",
  "prompt": "A futuristic city following these edges",
  "guidance": 30
}
```

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `/v1/flux-2-pro` | FLUX.2 Pro generation |
| `/v1/flux-2-max` | FLUX.2 Max generation |
| `/v1/flux-2-flex` | FLUX.2 Flex generation |
| `/v1/flux-2-klein-9b` | FLUX.2 Klein 9B |
| `/v1/flux-2-klein-4b` | FLUX.2 Klein 4B |
| `/v1/flux-pro-1.0-fill` | FLUX.1 Inpainting |
| `/v1/flux-pro-1.0-expand` | FLUX.1 Outpainting |
| `/v1/flux-pro-1.0-canny` | FLUX.1 Canny control |
| `/v1/flux-pro-1.0-depth` | FLUX.1 Depth control |
| `/v1/flux-pro-1.0-pose` | FLUX.1 Pose control |

Base URL: `https://api.bfl.ai`

## Development

```bash
npm run build    # Build TypeScript
npm run watch    # Watch mode
npm start        # Run server
```

## License

MIT
