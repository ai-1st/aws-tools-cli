export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}

export interface AWSCredentialsFile {
  Credentials: {
    AccessKeyId: string;
    SecretAccessKey: string;
    SessionToken?: string;
    Expiration?: string;
  };
  region?: string;
}

export interface ServiceRegionCombo {
  service: string;
  region: string;
  cost: number;
  currency: string;
  period: string;
}

export interface AnalysisStep {
  title: string;
  service: string;
  region: string;
  useTools: string[];
}

export interface ToolResult {
  summary: string;
  datapointsPath?: string;
  chartPath?: string;
  chartAnalysis?: string;
}

export interface AnalysisResult {
  serviceRegion: ServiceRegionCombo;
  step: AnalysisStep;
  toolResults: ToolResult[];
  summary: string;
  chartPath?: string;
  chartAnalysis?: string;
  executionId: string;
}

export interface ReportConfig {
  outputPath: string;
  includeCharts: boolean;
  topN: number;
}

export interface LLMAnalysisRequest {
  service: string;
  region: string;
  cost: number;
  context: string;
}

export interface ChartAnalysisResult {
  analysis: string;
  insights: string[];
  recommendations: string[];
}

export interface PlanningRequest {
  serviceRegionCombos: ServiceRegionCombo[];
  availableTools: string[];
}

export interface PlanningResponse {
  steps: AnalysisStep[];
} 