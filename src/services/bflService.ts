/**
 * Black Forest Lab API service for image generation
 * Supports FLUX.2 (Pro, Max, Flex, Klein) and FLUX.1 (Fill, Expand)
 */
import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import type { Flux2Model, ControlType } from '../schemas.js';

// API Base URL
const BFL_API_BASE = 'https://api.bfl.ai';

// FLUX.2 model endpoints
const FLUX2_ENDPOINTS: Record<Flux2Model, string> = {
  'flux-2-pro': '/v1/flux-2-pro',
  'flux-2-max': '/v1/flux-2-max',
  'flux-2-flex': '/v1/flux-2-flex',
  'flux-2-klein-9b': '/v1/flux-2-klein-9b',
  'flux-2-klein-4b': '/v1/flux-2-klein-4b'
};

// FLUX.1 endpoints for inpainting/outpainting
const FLUX1_FILL_ENDPOINT = '/v1/flux-pro-1.0-fill';
const FLUX1_EXPAND_ENDPOINT = '/v1/flux-pro-1.0-expand';

// FLUX.1 control endpoints
const FLUX1_CONTROL_ENDPOINTS: Record<ControlType, string> = {
  'canny': '/v1/flux-pro-1.0-canny',
  'depth': '/v1/flux-pro-1.0-depth',
  'pose': '/v1/flux-pro-1.0-pose'
};

// Default guidance values per control type
const CONTROL_DEFAULT_GUIDANCE: Record<ControlType, number> = {
  'canny': 30,
  'depth': 15,
  'pose': 25
};

/**
 * Options for FLUX.2 image generation
 */
export interface ImageGenerationOptions {
  model?: Flux2Model;
  width?: number;
  height?: number;
  seed?: number;
  safetyTolerance?: number;
  outputFormat?: 'jpeg' | 'png';
  // FLEX model specific
  promptUpsampling?: boolean;
  guidance?: number;
  steps?: number;
  // Save options
  saveImage?: boolean;
  filename?: string;
  outputDir?: string;
  customPath?: string;
  maxPollingAttempts?: number;
  pollingInterval?: number;
}

/**
 * Options for FLUX.2 img2img generation
 */
export interface Img2ImgOptions extends ImageGenerationOptions {
  inputImages?: string[]; // Additional reference images
}

/**
 * Options for FLUX.1 inpainting
 */
export interface InpaintOptions {
  steps?: number;
  guidance?: number;
  seed?: number;
  outputFormat?: 'jpeg' | 'png';
  safetyTolerance?: number;
  saveImage?: boolean;
  filename?: string;
  outputDir?: string;
  customPath?: string;
  maxPollingAttempts?: number;
  pollingInterval?: number;
}

/**
 * Options for FLUX.1 outpainting/expand
 */
export interface OutpaintOptions extends InpaintOptions {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/**
 * Options for FLUX.1 control generation
 */
export interface ControlOptions {
  steps?: number;
  guidance?: number;
  seed?: number;
  outputFormat?: 'jpeg' | 'png';
  safetyTolerance?: number;
  saveImage?: boolean;
  filename?: string;
  outputDir?: string;
  customPath?: string;
  maxPollingAttempts?: number;
  pollingInterval?: number;
}

/**
 * Result from image generation
 */
export interface ImageGenerationResult {
  image_url: string;
  local_path: string | null;
}

/**
 * Encode an image file to base64
 */
async function encodeImageToBase64(imagePath: string): Promise<string> {
  const imageBuffer = await fs.readFile(imagePath);
  return imageBuffer.toString('base64');
}

/**
 * Get API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) {
    throw new Error('API key is required. Set BFL_API_KEY environment variable.');
  }
  return apiKey;
}

/**
 * Polls for the result of an image generation request
 */
async function pollForResults(
  pollingUrl: string,
  apiKey: string,
  maxAttempts: number = 30,
  interval: number = 2000
): Promise<any> {
  console.error(`[INFO] Polling ${pollingUrl} for results...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.error(`[INFO] Polling attempt ${attempt}/${maxAttempts}...`);

      const response = await axios.get(pollingUrl, {
        headers: { 'X-Key': apiKey }
      });

      // Check if we have a result with a sample URL
      if (response.data.result && response.data.result.sample) {
        console.error(`[INFO] Image ready!`);
        response.data.image_url = response.data.result.sample;
        return response.data;
      } else if (response.data.status === 'completed' || response.data.status === 'Ready') {
        console.error(`[INFO] Generation completed`);
        return response.data;
      } else if (response.data.status === 'failed') {
        throw new Error(`Generation failed: ${response.data.error || 'Unknown error'}`);
      }

      console.error(`[INFO] Status: ${response.data.status}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Task not ready yet, continue polling
        await new Promise(resolve => setTimeout(resolve, interval));
        continue;
      }
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      console.error(`[ERROR] Error polling: ${errorMsg}`);
      throw new Error(`Failed to poll for results: ${errorMsg}`);
    }
  }

  throw new Error(`Timed out after ${maxAttempts} polling attempts`);
}

/**
 * Downloads an image from a URL and saves it locally
 */
export async function downloadImage(
  url: string,
  filename: string,
  outputDir: string = './output',
  customPath?: string
): Promise<string> {
  try {
    console.error(`[INFO] Downloading image from ${url}`);

    const response = await axios.get(url, { responseType: 'arraybuffer' });

    if (!response.data) {
      throw new Error('Failed to download image: Empty response');
    }

    let filePath: string;
    let targetDir: string;

    if (customPath) {
      filePath = customPath;
      targetDir = path.dirname(customPath);
    } else {
      filePath = path.join(outputDir, filename);
      targetDir = outputDir;
    }

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(filePath, Buffer.from(response.data));
    console.error(`[INFO] Image saved to ${filePath}`);

    return filePath;
  } catch (error: any) {
    console.error(`[ERROR] Error downloading image: ${error.message}`);
    throw new Error(`Failed to save image: ${error.message}`);
  }
}

/**
 * Make API request and handle polling
 */
async function makeApiRequest(
  endpoint: string,
  payload: Record<string, any>,
  options: { maxPollingAttempts?: number; pollingInterval?: number } = {}
): Promise<string> {
  const apiKey = getApiKey();
  const url = `${BFL_API_BASE}${endpoint}`;

  console.error(`[INFO] Sending request to ${url}`);

  const response = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Key': apiKey
    }
  });

  // Check if we need to poll
  if (response.data.polling_url) {
    const pollResult = await pollForResults(
      response.data.polling_url,
      apiKey,
      options.maxPollingAttempts || 30,
      options.pollingInterval || 2000
    );

    if (!pollResult.image_url && pollResult.result?.sample) {
      pollResult.image_url = pollResult.result.sample;
    }

    if (!pollResult.image_url) {
      throw new Error('No image URL in result');
    }

    return pollResult.image_url;
  } else if (response.data.image_url) {
    return response.data.image_url;
  } else if (response.data.result?.sample) {
    return response.data.result.sample;
  }

  throw new Error('Invalid API response: No polling URL or image URL');
}

/**
 * Generate an image using FLUX.2
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> {
  const model = options.model || 'flux-2-pro';
  const endpoint = FLUX2_ENDPOINTS[model];

  if (!endpoint) {
    throw new Error(`Unknown model: ${model}`);
  }

  // Build payload based on model type
  const payload: Record<string, any> = {
    prompt,
    width: options.width || 1024,
    height: options.height || 1024,
    safety_tolerance: options.safetyTolerance ?? 2,
    output_format: options.outputFormat || 'jpeg'
  };

  if (options.seed !== undefined) {
    payload.seed = options.seed;
  }

  // FLEX model specific parameters
  if (model === 'flux-2-flex') {
    payload.prompt_upsampling = options.promptUpsampling ?? true;
    if (options.guidance !== undefined) {
      payload.guidance = options.guidance;
    }
    if (options.steps !== undefined) {
      payload.steps = options.steps;
    }
  }

  console.error(`[INFO] Generating image with ${model}: "${prompt}"`);

  const imageUrl = await makeApiRequest(endpoint, payload, options);

  const result: ImageGenerationResult = {
    image_url: imageUrl,
    local_path: null
  };

  // Save image if requested
  if (options.saveImage !== false) {
    try {
      const filename = options.filename || `flux_${Date.now()}.${options.outputFormat || 'jpeg'}`;
      const savePath = await downloadImage(
        imageUrl,
        filename,
        options.outputDir || process.env.OUTPUT_DIR || './output',
        options.customPath
      );
      result.local_path = savePath;
    } catch (downloadError: any) {
      console.error(`[ERROR] Error saving image: ${downloadError.message}`);
    }
  }

  return result;
}

/**
 * Generate an image using reference images (img2img) with FLUX.2
 */
export async function img2img(
  prompt: string,
  inputImagePath: string,
  options: Img2ImgOptions = {}
): Promise<ImageGenerationResult> {
  const model = options.model || 'flux-2-pro';
  const endpoint = FLUX2_ENDPOINTS[model];

  if (!endpoint) {
    throw new Error(`Unknown model: ${model}`);
  }

  // Check image limit based on model
  const isKlein = model.includes('klein');
  const maxImages = isKlein ? 4 : 8;
  const additionalImages = options.inputImages || [];

  if (additionalImages.length + 1 > maxImages) {
    throw new Error(`${model} supports max ${maxImages} images, got ${additionalImages.length + 1}`);
  }

  // Build payload
  const payload: Record<string, any> = {
    prompt,
    input_image: await encodeImageToBase64(inputImagePath),
    safety_tolerance: options.safetyTolerance ?? 2,
    output_format: options.outputFormat || 'jpeg'
  };

  if (options.width) payload.width = options.width;
  if (options.height) payload.height = options.height;
  if (options.seed !== undefined) payload.seed = options.seed;

  // Add additional reference images
  for (let i = 0; i < additionalImages.length; i++) {
    payload[`input_image_${i + 2}`] = await encodeImageToBase64(additionalImages[i]);
  }

  console.error(`[INFO] Generating img2img with ${model}: "${prompt}" (${additionalImages.length + 1} images)`);

  const imageUrl = await makeApiRequest(endpoint, payload, options);

  const result: ImageGenerationResult = {
    image_url: imageUrl,
    local_path: null
  };

  if (options.saveImage !== false) {
    try {
      const filename = options.filename || `flux_img2img_${Date.now()}.${options.outputFormat || 'jpeg'}`;
      const savePath = await downloadImage(
        imageUrl,
        filename,
        options.outputDir || process.env.OUTPUT_DIR || './output',
        options.customPath
      );
      result.local_path = savePath;
    } catch (downloadError: any) {
      console.error(`[ERROR] Error saving image: ${downloadError.message}`);
    }
  }

  return result;
}

/**
 * Inpaint an image using a mask with FLUX.1 Fill
 */
export async function inpaint(
  imagePath: string,
  maskPath: string,
  prompt: string,
  options: InpaintOptions = {}
): Promise<ImageGenerationResult> {
  const payload: Record<string, any> = {
    image: await encodeImageToBase64(imagePath),
    mask: await encodeImageToBase64(maskPath),
    prompt,
    steps: options.steps ?? 50,
    guidance: options.guidance ?? 60,
    safety_tolerance: options.safetyTolerance ?? 2,
    output_format: options.outputFormat || 'jpeg'
  };

  if (options.seed !== undefined) {
    payload.seed = options.seed;
  }

  console.error(`[INFO] Inpainting image: "${prompt}"`);

  const imageUrl = await makeApiRequest(FLUX1_FILL_ENDPOINT, payload, options);

  const result: ImageGenerationResult = {
    image_url: imageUrl,
    local_path: null
  };

  if (options.saveImage !== false) {
    try {
      const filename = options.filename || `flux_inpaint_${Date.now()}.${options.outputFormat || 'jpeg'}`;
      const savePath = await downloadImage(
        imageUrl,
        filename,
        options.outputDir || process.env.OUTPUT_DIR || './output',
        options.customPath
      );
      result.local_path = savePath;
    } catch (downloadError: any) {
      console.error(`[ERROR] Error saving image: ${downloadError.message}`);
    }
  }

  return result;
}

/**
 * Expand/outpaint an image using FLUX.1 Expand
 */
export async function outpaint(
  imagePath: string,
  options: OutpaintOptions = {}
): Promise<ImageGenerationResult> {
  const payload: Record<string, any> = {
    image: await encodeImageToBase64(imagePath),
    top: options.top ?? 0,
    bottom: options.bottom ?? 0,
    left: options.left ?? 0,
    right: options.right ?? 0,
    steps: options.steps ?? 50,
    guidance: options.guidance ?? 60,
    safety_tolerance: options.safetyTolerance ?? 2,
    output_format: options.outputFormat || 'jpeg'
  };

  if (options.seed !== undefined) {
    payload.seed = options.seed;
  }

  // Validate at least one direction is specified
  if (payload.top === 0 && payload.bottom === 0 && payload.left === 0 && payload.right === 0) {
    throw new Error('At least one of top, bottom, left, or right must be greater than 0');
  }

  console.error(`[INFO] Expanding image: top=${payload.top}, bottom=${payload.bottom}, left=${payload.left}, right=${payload.right}`);

  const imageUrl = await makeApiRequest(FLUX1_EXPAND_ENDPOINT, payload, options);

  const result: ImageGenerationResult = {
    image_url: imageUrl,
    local_path: null
  };

  if (options.saveImage !== false) {
    try {
      const filename = options.filename || `flux_outpaint_${Date.now()}.${options.outputFormat || 'jpeg'}`;
      const savePath = await downloadImage(
        imageUrl,
        filename,
        options.outputDir || process.env.OUTPUT_DIR || './output',
        options.customPath
      );
      result.local_path = savePath;
    } catch (downloadError: any) {
      console.error(`[ERROR] Error saving image: ${downloadError.message}`);
    }
  }

  return result;
}

/**
 * Generate an image using structural control (canny/depth/pose) with FLUX.1
 */
export async function control(
  controlType: ControlType,
  controlImagePath: string,
  prompt: string,
  options: ControlOptions = {}
): Promise<ImageGenerationResult> {
  const endpoint = FLUX1_CONTROL_ENDPOINTS[controlType];

  if (!endpoint) {
    throw new Error(`Unknown control type: ${controlType}`);
  }

  const defaultGuidance = CONTROL_DEFAULT_GUIDANCE[controlType];

  const payload: Record<string, any> = {
    control_image: await encodeImageToBase64(controlImagePath),
    prompt,
    steps: options.steps ?? 50,
    guidance: options.guidance ?? defaultGuidance,
    safety_tolerance: options.safetyTolerance ?? 2,
    output_format: options.outputFormat || 'jpeg'
  };

  if (options.seed !== undefined) {
    payload.seed = options.seed;
  }

  console.error(`[INFO] Generating with ${controlType} control: "${prompt}"`);

  const imageUrl = await makeApiRequest(endpoint, payload, options);

  const result: ImageGenerationResult = {
    image_url: imageUrl,
    local_path: null
  };

  if (options.saveImage !== false) {
    try {
      const filename = options.filename || `flux_${controlType}_${Date.now()}.${options.outputFormat || 'jpeg'}`;
      const savePath = await downloadImage(
        imageUrl,
        filename,
        options.outputDir || process.env.OUTPUT_DIR || './output',
        options.customPath
      );
      result.local_path = savePath;
    } catch (downloadError: any) {
      console.error(`[ERROR] Error saving image: ${downloadError.message}`);
    }
  }

  return result;
}
