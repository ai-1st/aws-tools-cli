import fs from 'fs-extra';
import * as path from 'path';
import { AnalysisResult } from './types.js';

/**
 * Utility function to generate standardized paths for analysis outputs
 */
export function generateAnalysisPaths(baseOutputPath: string, executionId: string, serviceRegion: string) {
  const reportDir = path.join(baseOutputPath, executionId);
  const reportPath = path.join(reportDir, `${serviceRegion}-analysis.md`);
  
  return {
    reportDir,
    reportPath,
    executionId,
    serviceRegion
  };
}

/**
 * Generate a step report with relative image paths
 */
export async function generateStepReport(
  analysisContent: AnalysisResult, 
  baseOutputPath: string, 
  executionId: string, 
  serviceRegion: string
): Promise<string> {
  const paths = generateAnalysisPaths(baseOutputPath, executionId, serviceRegion);
  
  // Ensure the directory exists
  await fs.ensureDir(paths.reportDir);

  const regex = /\".*\/([^\/]+\/[^\/]+\/[^\/]+\.png)\"/gm;
  const contentWithRelativeUrls = analysisContent.replace(regex, '"./$1"');

  // Write the report to file
  await fs.writeFile(paths.reportPath, contentWithRelativeUrls, 'utf8');
  
  console.log(`Step report generated: ${paths.reportPath}`);
  return paths.reportPath;
}

/**
 * Generate a basic report from analysis content
 */
export async function generateReport(
  analysisContent: AnalysisResult, 
  baseOutputPath: string, 
  executionId: string, 
  serviceRegion: string
): Promise<string> {
  const paths = generateAnalysisPaths(baseOutputPath, executionId, serviceRegion);
  
  // Ensure the directory exists
  await fs.ensureDir(paths.reportDir);
  
  // Write the report to file
  await fs.writeFile(paths.reportPath, analysisContent, 'utf8');
  
  console.log(`Report generated: ${paths.reportPath}`);
  return paths.reportPath;
}

/**
 * Generate a summary report from analysis content
 */
export async function generateSummaryReport(
  analysisContent: AnalysisResult, 
  baseOutputPath: string, 
  executionId: string, 
  serviceRegion: string
): Promise<string> {
  const paths = generateAnalysisPaths(baseOutputPath, executionId, serviceRegion);
  const summaryPath = paths.reportPath.replace('.md', '-summary.md');
  
  // Ensure the directory exists
  await fs.ensureDir(paths.reportDir);
  
  // For summary, we'll just take the first few lines or create a basic summary
  const lines = analysisContent.split('\n');
  const title = lines.find(line => line.startsWith('#')) || '# AWS Cost Analysis Summary';
  const summary = lines.slice(0, 20).join('\n') + '\n\n*This is a summary report. See the full report for complete analysis.*';
  
  // Write the summary to file
  await fs.writeFile(summaryPath, summary, 'utf8');
  
  console.log(`Summary report generated: ${summaryPath}`);
  return summaryPath;
}