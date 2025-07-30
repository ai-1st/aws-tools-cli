// src/chartUtils.ts

import fs from 'fs';
import * as path from 'path';
import { createCanvas } from 'canvas';

// Note: These imports are optional and only needed if chart generation is used
// They're not included in the main dependencies to keep the package lightweight
let vega: any = null;
let vegaLite: any = null;

/**
 * Dynamically imports Vega and Vega-Lite libraries
 * This allows the chart generation to be optional
 */
async function loadVegaLibraries(): Promise<void> {
  if (!vega || !vegaLite) {
    try {
      vega = await import('vega');
      vegaLite = await import('vega-lite');
    } catch (error) {
      throw new Error('Vega and Vega-Lite libraries are required for chart generation. Please install them: npm install vega vega-lite');
    }
  }
}

/**
 * Validates and sanitizes a Vega-Lite chart specification
 */
function sanitizeChartSpec(chartSpec: any): any {
  // Deep clone the spec to avoid modifying the original
  const spec = JSON.parse(JSON.stringify(chartSpec));
  
  // Remove any problematic formatting that might cause issues
  if (spec.encoding) {
    Object.keys(spec.encoding).forEach(key => {
      const encoding = spec.encoding[key];
      if (encoding && encoding.axis) {
        // Remove any problematic format strings
        if (encoding.axis.format) {
          delete encoding.axis.format;
        }
        if (encoding.axis.formatType) {
          delete encoding.axis.formatType;
        }
      }
    });
  }
  
  // Ensure basic required fields
  if (!spec.mark) {
    spec.mark = 'bar';
  }
  
  if (!spec.encoding) {
    spec.encoding = {};
  }
  
  return spec;
}

/**
 * Generates PNG and SVG files from a Vega-Lite chart specification
 * @param chartSpec - The Vega-Lite chart specification
 * @param filename - Base filename without extension
 * @param outputDir - Directory to save the files (default: current directory)
 * @returns Promise that resolves when files are generated
 */
export async function generateChartFiles(chartSpec: any, filename: string, outputDir: string = '.'): Promise<void> {
  await loadVegaLibraries();
  
  try {
    // Sanitize the chart specification
    const sanitizedSpec = sanitizeChartSpec(chartSpec);
    
    console.log('Original chart spec:', JSON.stringify(chartSpec, null, 2));
    console.log('Sanitized chart spec:', JSON.stringify(sanitizedSpec, null, 2));
    
    // Compile Vega-Lite to Vega specification
    const vegaSpec = vegaLite.compile(sanitizedSpec).spec;

    // Ensure output directories exist
    const svgDir = path.join(outputDir, 'svg');
    const pngDir = path.join(outputDir, 'png');
    
    if (!fs.existsSync(svgDir)) {
      fs.mkdirSync(svgDir, { recursive: true });
    }
    if (!fs.existsSync(pngDir)) {
      fs.mkdirSync(pngDir, { recursive: true });
    }

    // Generate SVG file
    const view = new vega.View(vega.parse(vegaSpec), { renderer: 'none' });
    const svg = await view.toSVG();
    fs.writeFileSync(path.join(svgDir, `${filename}.svg`), svg);
    console.log(`SVG file created successfully at ${path.join(svgDir, `${filename}.svg`)}`);

    // Generate PNG file using canvas
    const canvasView = new vega.View(vega.parse(vegaSpec), { renderer: 'none' });
    const canvas = await canvasView.toCanvas();
    const out = fs.createWriteStream(path.join(pngDir, `${filename}.png`));
    const stream = (canvas as any).createPNGStream();
    
    stream.pipe(out);
    
    return new Promise<void>((resolve, reject) => {
      out.on('finish', () => {
        console.log(`PNG file created successfully at ${path.join(pngDir, `${filename}.png`)}`);
        resolve();
      });
      out.on('error', reject);
    });
  } catch (error) {
    console.error('Error generating chart files:', error);
    console.log('Chart specification:', JSON.stringify(chartSpec, null, 2));
    throw error;
  }
}

/**
 * Generates only a PNG file from a Vega-Lite chart specification
 * @param chartSpec - The Vega-Lite chart specification
 * @param filename - Base filename without extension
 * @param outputDir - Directory to save the file (default: current directory)
 * @returns Promise that resolves when file is generated
 */
export async function generatePNGChart(chartSpec: any, filename: string, outputDir: string = '.'): Promise<void> {
  await loadVegaLibraries();
  
  try {
    // Sanitize the chart specification
    const sanitizedSpec = sanitizeChartSpec(chartSpec);
    
    console.log('Generating PNG chart with spec:', JSON.stringify(sanitizedSpec, null, 2));
    
    // Compile Vega-Lite to Vega specification
    const vegaSpec = vegaLite.compile(sanitizedSpec).spec;

    // Ensure output directory exists
    const pngDir = path.join(outputDir, 'png');
    if (!fs.existsSync(pngDir)) {
      fs.mkdirSync(pngDir, { recursive: true });
    }

    // Generate PNG file using canvas
    const canvasView = new vega.View(vega.parse(vegaSpec), { renderer: 'none' });
    const canvas = await canvasView.toCanvas();
    const out = fs.createWriteStream(path.join(pngDir, `${filename}.png`));
    const stream = (canvas as any).createPNGStream();
    
    stream.pipe(out);
    
    return new Promise<void>((resolve, reject) => {
      out.on('finish', () => {
        console.log(`PNG file created successfully at ${path.join(pngDir, `${filename}.png`)}`);
        resolve();
      });
      out.on('error', reject);
    });
  } catch (error) {
    console.error('Error generating PNG chart:', error);
    console.log('Chart specification:', JSON.stringify(chartSpec, null, 2));
    throw error;
  }
}

/**
 * Generates only an SVG file from a Vega-Lite chart specification
 * @param chartSpec - The Vega-Lite chart specification
 * @param filename - Base filename without extension
 * @param outputDir - Directory to save the file (default: current directory)
 * @returns Promise that resolves when file is generated
 */
export async function generateSVGChart(chartSpec: any, filename: string, outputDir: string = '.'): Promise<void> {
  await loadVegaLibraries();
  
  try {
    // Sanitize the chart specification
    const sanitizedSpec = sanitizeChartSpec(chartSpec);
    
    // Compile Vega-Lite to Vega specification
    const vegaSpec = vegaLite.compile(sanitizedSpec).spec;

    // Create a Vega view
    const view = new vega.View(vega.parse(vegaSpec), {
      renderer: 'canvas',
    });

    // Ensure output directory exists
    const svgDir = path.join(outputDir, 'svg');
    if (!fs.existsSync(svgDir)) {
      fs.mkdirSync(svgDir, { recursive: true });
    }

    // Generate SVG file
    const svg = await view.toSVG();
    fs.writeFileSync(path.join(svgDir, `${filename}.svg`), svg);
    console.log(`SVG file created successfully at ${path.join(svgDir, `${filename}.svg`)}`);
  } catch (error) {
    console.error('Error generating SVG chart:', error);
    console.log('Chart specification:', JSON.stringify(chartSpec, null, 2));
    throw error;
  }
} 