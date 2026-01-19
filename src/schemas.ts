/**
 * Schema definitions for FLUX Image Generator MCP Server
 * Supports FLUX.2 (Pro, Max, Flex, Klein) and FLUX.1 (Fill, Expand)
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Available FLUX.2 models
 */
export const FLUX2_MODELS = [
  'flux-2-pro',
  'flux-2-max',
  'flux-2-flex',
  'flux-2-klein-9b',
  'flux-2-klein-4b'
] as const;

export type Flux2Model = typeof FLUX2_MODELS[number];

/**
 * Tool definition for Generate Image (FLUX.2)
 */
export const GENERATE_IMAGE_TOOL: Tool = {
  name: "generateImage",
  description: "Generate an image using FLUX.2 models based on a text prompt. Supports multiple model variants.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Text description of the image to generate"
      },
      model: {
        type: "string",
        enum: FLUX2_MODELS,
        description: "FLUX.2 model variant to use",
        default: "flux-2-pro"
      },
      width: {
        type: "number",
        description: "Width of the image in pixels (min 64)",
        default: 1024
      },
      height: {
        type: "number",
        description: "Height of the image in pixels (min 64)",
        default: 1024
      },
      seed: {
        type: "number",
        description: "Random seed for reproducible results"
      },
      safetyTolerance: {
        type: "number",
        description: "Content moderation tolerance (0-5, default 2)",
        default: 2
      },
      outputFormat: {
        type: "string",
        enum: ["jpeg", "png"],
        description: "Output image format",
        default: "jpeg"
      },
      // FLEX model specific
      guidance: {
        type: "number",
        description: "Guidance scale for FLEX model (1.5-10.0, default 5.0)"
      },
      steps: {
        type: "number",
        description: "Number of inference steps for FLEX model (1-50, default 50)"
      },
      promptUpsampling: {
        type: "boolean",
        description: "Enable prompt upsampling for FLEX model",
        default: true
      },
      customPath: {
        type: "string",
        description: "Custom path to save the generated image"
      }
    },
    required: ["prompt"]
  }
};

/**
 * Tool definition for Quick Image
 */
export const QUICK_IMAGE_TOOL: Tool = {
  name: "quickImage",
  description: "Quickly generate an image based on a text prompt with default settings (FLUX.2 Pro)",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Text description of the image to generate"
      },
      customPath: {
        type: "string",
        description: "Custom path to save the generated image"
      }
    },
    required: ["prompt"]
  }
};

/**
 * Tool definition for Batch Generate Images
 */
export const BATCH_GENERATE_IMAGES_TOOL: Tool = {
  name: "batchGenerateImages",
  description: "Generate multiple images from a list of prompts using FLUX.2",
  inputSchema: {
    type: "object",
    properties: {
      prompts: {
        type: "array",
        items: {
          type: "string"
        },
        description: "List of text prompts (max 10)"
      },
      model: {
        type: "string",
        enum: FLUX2_MODELS,
        description: "FLUX.2 model variant to use",
        default: "flux-2-pro"
      },
      width: {
        type: "number",
        description: "Width of the images",
        default: 1024
      },
      height: {
        type: "number",
        description: "Height of the images",
        default: 1024
      },
      customPath: {
        type: "string",
        description: "Custom directory to save the generated images"
      }
    },
    required: ["prompts"]
  }
};

/**
 * Tool definition for Image-to-Image (FLUX.2)
 */
export const IMG2IMG_TOOL: Tool = {
  name: "img2img",
  description: "Generate an image using one or more reference images with FLUX.2. Supports up to 8 reference images for Pro/Max, 4 for Klein models.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Text description guiding the generation"
      },
      inputImage: {
        type: "string",
        description: "Path to the primary input/reference image"
      },
      inputImages: {
        type: "array",
        items: { type: "string" },
        description: "Additional reference images (paths). Pro/Max: up to 7 more, Klein: up to 3 more"
      },
      model: {
        type: "string",
        enum: FLUX2_MODELS,
        description: "FLUX.2 model variant to use",
        default: "flux-2-pro"
      },
      width: {
        type: "number",
        description: "Output width in pixels"
      },
      height: {
        type: "number",
        description: "Output height in pixels"
      },
      seed: {
        type: "number",
        description: "Random seed for reproducibility"
      },
      safetyTolerance: {
        type: "number",
        description: "Content moderation tolerance (0-5)",
        default: 2
      },
      outputFormat: {
        type: "string",
        enum: ["jpeg", "png"],
        default: "jpeg"
      },
      customPath: {
        type: "string",
        description: "Custom path to save the output image"
      }
    },
    required: ["prompt", "inputImage"]
  }
};

/**
 * Tool definition for Inpainting (FLUX.1 Fill)
 */
export const INPAINT_TOOL: Tool = {
  name: "inpaint",
  description: "Inpaint/edit specific areas of an image using a mask with FLUX.1 Fill. White areas in mask will be regenerated.",
  inputSchema: {
    type: "object",
    properties: {
      image: {
        type: "string",
        description: "Path to the image to edit"
      },
      mask: {
        type: "string",
        description: "Path to the mask image (white = areas to regenerate, black = keep)"
      },
      prompt: {
        type: "string",
        description: "Text description of what to generate in the masked area"
      },
      steps: {
        type: "number",
        description: "Number of inference steps (15-50, default 50)",
        default: 50
      },
      guidance: {
        type: "number",
        description: "Guidance scale (1.5-100, default 60)",
        default: 60
      },
      seed: {
        type: "number",
        description: "Random seed for reproducibility"
      },
      outputFormat: {
        type: "string",
        enum: ["jpeg", "png"],
        default: "jpeg"
      },
      safetyTolerance: {
        type: "number",
        description: "Content moderation tolerance (0-6, default 2)",
        default: 2
      },
      customPath: {
        type: "string",
        description: "Custom path to save the output image"
      }
    },
    required: ["image", "mask", "prompt"]
  }
};

/**
 * Tool definition for Outpainting/Expand (FLUX.1 Expand)
 */
export const OUTPAINT_TOOL: Tool = {
  name: "outpaint",
  description: "Expand an image by adding pixels on any side using FLUX.1 Expand (outpainting).",
  inputSchema: {
    type: "object",
    properties: {
      image: {
        type: "string",
        description: "Path to the image to expand"
      },
      prompt: {
        type: "string",
        description: "Text description of what to generate in the expanded areas"
      },
      top: {
        type: "number",
        description: "Pixels to add at the top (0-2048)",
        default: 0
      },
      bottom: {
        type: "number",
        description: "Pixels to add at the bottom (0-2048)",
        default: 0
      },
      left: {
        type: "number",
        description: "Pixels to add on the left (0-2048)",
        default: 0
      },
      right: {
        type: "number",
        description: "Pixels to add on the right (0-2048)",
        default: 0
      },
      steps: {
        type: "number",
        description: "Number of inference steps (15-50, default 50)",
        default: 50
      },
      guidance: {
        type: "number",
        description: "Guidance scale (1.5-100, default 60)",
        default: 60
      },
      seed: {
        type: "number",
        description: "Random seed for reproducibility"
      },
      outputFormat: {
        type: "string",
        enum: ["jpeg", "png"],
        default: "jpeg"
      },
      safetyTolerance: {
        type: "number",
        description: "Content moderation tolerance (0-6, default 2)",
        default: 2
      },
      customPath: {
        type: "string",
        description: "Custom path to save the output image"
      }
    },
    required: ["image"]
  }
};
