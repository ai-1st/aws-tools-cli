declare module '@ddegtyarev/aws-tools' {
  export function invoke(toolName: string, input: any, config: {
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
    region: string;
  }): Promise<any>;
  export const tools: any[];
  export function generateChartFiles(chartSpec: any, filename: string, outputDir?: string): Promise<void>;
  export function generatePNGChart(chartSpec: any, filename: string, outputDir?: string): Promise<void>;
  export function generateSVGChart(chartSpec: any, filename: string, outputDir?: string): Promise<void>;
} 