#!/usr/bin/env node

/**
 * MCP Server for Black Forest Lab FLUX image generation
 * Supports FLUX.2 (Pro, Max, Flex, Klein) and FLUX.1 (Fill, Expand)
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from 'dotenv';
import { generateImage, img2img, inpaint, outpaint } from './services/bflService.js';
import {
  GENERATE_IMAGE_TOOL,
  QUICK_IMAGE_TOOL,
  BATCH_GENERATE_IMAGES_TOOL,
  IMG2IMG_TOOL,
  INPAINT_TOOL,
  OUTPAINT_TOOL,
  type Flux2Model
} from './schemas.js';

// Load environment variables
dotenv.config();

// Retrieve the Black Forest Lab API key from environment variables
const BFL_API_KEY = process.env.BFL_API_KEY;
if (!BFL_API_KEY) {
  console.error("Error: BFL_API_KEY environment variable is required");
  process.exit(1);
}

// Initialize the server with tool metadata and capabilities
const server = new Server(
  {
    name: "flux-image-generator",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Registers a handler for listing available tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    GENERATE_IMAGE_TOOL,
    QUICK_IMAGE_TOOL,
    BATCH_GENERATE_IMAGES_TOOL,
    IMG2IMG_TOOL,
    INPAINT_TOOL,
    OUTPAINT_TOOL
  ],
}));

/**
 * Registers a handler for calling a specific tool.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("No arguments provided");
    }

    switch (name) {
      case "generateImage": {
        if (typeof args.prompt !== 'string') {
          throw new Error("Invalid prompt: must be a string");
        }

        const options = {
          model: (args.model as Flux2Model) || 'flux-2-pro',
          width: typeof args.width === 'number' ? args.width : 1024,
          height: typeof args.height === 'number' ? args.height : 1024,
          seed: typeof args.seed === 'number' ? args.seed : undefined,
          safetyTolerance: typeof args.safetyTolerance === 'number' ? args.safetyTolerance : 2,
          outputFormat: (args.outputFormat as 'jpeg' | 'png') || 'jpeg',
          promptUpsampling: typeof args.promptUpsampling === 'boolean' ? args.promptUpsampling : true,
          guidance: typeof args.guidance === 'number' ? args.guidance : undefined,
          steps: typeof args.steps === 'number' ? args.steps : undefined,
          saveImage: true,
          filename: `flux_${Date.now()}.${args.outputFormat || 'jpeg'}`,
          customPath: typeof args.customPath === 'string' ? args.customPath : undefined
        };

        const result = await generateImage(args.prompt, options);

        let textContent = `Image generated with ${options.model}\nLink: ${result.image_url}`;
        if (result.local_path) {
          textContent += `\nSaved to: ${result.local_path}`;
        }

        return {
          content: [{ type: "text", text: textContent }],
          isError: false,
        };
      }

      case "quickImage": {
        if (typeof args.prompt !== 'string') {
          throw new Error("Invalid prompt: must be a string");
        }

        const result = await generateImage(args.prompt, {
          saveImage: true,
          filename: `flux_quick_${Date.now()}.jpeg`,
          customPath: typeof args.customPath === 'string' ? args.customPath : undefined
        });

        let textContent = `Image generated\nLink: ${result.image_url}`;
        if (result.local_path) {
          textContent += `\nSaved to: ${result.local_path}`;
        }

        return {
          content: [{ type: "text", text: textContent }],
          isError: false,
        };
      }

      case "batchGenerateImages": {
        if (!Array.isArray(args.prompts)) {
          throw new Error("Invalid arguments: 'prompts' must be an array");
        }

        const model = (args.model as Flux2Model) || 'flux-2-pro';
        const results = [];
        let output = "";

        for (let i = 0; i < args.prompts.length; i++) {
          const prompt = args.prompts[i];
          if (typeof prompt !== 'string') {
            throw new Error(`Invalid prompt at index ${i}: must be a string`);
          }

          try {
            const result = await generateImage(prompt, {
              model,
              width: typeof args.width === 'number' ? args.width : 1024,
              height: typeof args.height === 'number' ? args.height : 1024,
              saveImage: true,
              filename: `flux_batch_${Date.now()}_${i}.jpeg`,
              customPath: typeof args.customPath === 'string'
                ? `${args.customPath}/flux_batch_${Date.now()}_${i}.jpeg`
                : undefined
            });

            output += `[${i + 1}/${args.prompts.length}] "${prompt}"\n`;
            output += `Link: ${result.image_url}\n`;
            if (result.local_path) {
              output += `Saved to: ${result.local_path}\n`;
            }
            output += `\n`;

            results.push({ prompt, success: true, ...result });
          } catch (error: any) {
            output += `[${i + 1}/${args.prompts.length}] "${prompt}" - FAILED: ${error.message}\n\n`;
            results.push({ prompt, success: false, error: error.message });
          }
        }

        const successful = results.filter(r => r.success).length;
        output = `Batch complete: ${successful}/${args.prompts.length} successful\n\n${output}`;

        return {
          content: [{ type: "text", text: output }],
          isError: false,
        };
      }

      case "img2img": {
        if (typeof args.prompt !== 'string') {
          throw new Error("Invalid prompt: must be a string");
        }
        if (typeof args.inputImage !== 'string') {
          throw new Error("Invalid inputImage: must be a string path");
        }

        const options = {
          model: (args.model as Flux2Model) || 'flux-2-pro',
          inputImages: Array.isArray(args.inputImages) ? args.inputImages : undefined,
          width: typeof args.width === 'number' ? args.width : undefined,
          height: typeof args.height === 'number' ? args.height : undefined,
          seed: typeof args.seed === 'number' ? args.seed : undefined,
          safetyTolerance: typeof args.safetyTolerance === 'number' ? args.safetyTolerance : 2,
          outputFormat: (args.outputFormat as 'jpeg' | 'png') || 'jpeg',
          saveImage: true,
          filename: `flux_img2img_${Date.now()}.${args.outputFormat || 'jpeg'}`,
          customPath: typeof args.customPath === 'string' ? args.customPath : undefined
        };

        const result = await img2img(args.prompt, args.inputImage, options);

        let textContent = `Image generated with img2img (${options.model})\nLink: ${result.image_url}`;
        if (result.local_path) {
          textContent += `\nSaved to: ${result.local_path}`;
        }

        return {
          content: [{ type: "text", text: textContent }],
          isError: false,
        };
      }

      case "inpaint": {
        if (typeof args.image !== 'string') {
          throw new Error("Invalid image: must be a string path");
        }
        if (typeof args.mask !== 'string') {
          throw new Error("Invalid mask: must be a string path");
        }
        if (typeof args.prompt !== 'string') {
          throw new Error("Invalid prompt: must be a string");
        }

        const options = {
          steps: typeof args.steps === 'number' ? args.steps : 50,
          guidance: typeof args.guidance === 'number' ? args.guidance : 60,
          seed: typeof args.seed === 'number' ? args.seed : undefined,
          outputFormat: (args.outputFormat as 'jpeg' | 'png') || 'jpeg',
          safetyTolerance: typeof args.safetyTolerance === 'number' ? args.safetyTolerance : 2,
          saveImage: true,
          filename: `flux_inpaint_${Date.now()}.${args.outputFormat || 'jpeg'}`,
          customPath: typeof args.customPath === 'string' ? args.customPath : undefined
        };

        const result = await inpaint(args.image, args.mask, args.prompt, options);

        let textContent = `Inpainting complete (FLUX.1 Fill)\nLink: ${result.image_url}`;
        if (result.local_path) {
          textContent += `\nSaved to: ${result.local_path}`;
        }

        return {
          content: [{ type: "text", text: textContent }],
          isError: false,
        };
      }

      case "outpaint": {
        if (typeof args.image !== 'string') {
          throw new Error("Invalid image: must be a string path");
        }

        const options = {
          top: typeof args.top === 'number' ? args.top : 0,
          bottom: typeof args.bottom === 'number' ? args.bottom : 0,
          left: typeof args.left === 'number' ? args.left : 0,
          right: typeof args.right === 'number' ? args.right : 0,
          steps: typeof args.steps === 'number' ? args.steps : 50,
          guidance: typeof args.guidance === 'number' ? args.guidance : 60,
          seed: typeof args.seed === 'number' ? args.seed : undefined,
          outputFormat: (args.outputFormat as 'jpeg' | 'png') || 'jpeg',
          safetyTolerance: typeof args.safetyTolerance === 'number' ? args.safetyTolerance : 2,
          saveImage: true,
          filename: `flux_outpaint_${Date.now()}.${args.outputFormat || 'jpeg'}`,
          customPath: typeof args.customPath === 'string' ? args.customPath : undefined
        };

        const result = await outpaint(args.image, options);

        let textContent = `Outpainting complete (FLUX.1 Expand)\n`;
        textContent += `Expanded: top=${options.top}, bottom=${options.bottom}, left=${options.left}, right=${options.right}\n`;
        textContent += `Link: ${result.image_url}`;
        if (result.local_path) {
          textContent += `\nSaved to: ${result.local_path}`;
        }

        return {
          content: [{ type: "text", text: textContent }],
          isError: false,
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Initializes and runs the server using standard I/O for communication.
 */
async function runServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("FLUX Image Generator MCP Server v2.0.0 running on stdio");
    console.error("Supported: FLUX.2 (Pro, Max, Flex, Klein) + FLUX.1 (Fill, Expand)");
  } catch (error) {
    console.error("Fatal error running server:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
