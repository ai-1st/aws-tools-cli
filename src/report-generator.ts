import fs from 'fs-extra';
import * as path from 'path';
import { AnalysisResult, ReportConfig } from './types.js';

export class ReportGenerator {
  private outputDir: string;

  constructor(outputDir: string = './output') {
    this.outputDir = outputDir;
  }

  /**
   * Generate markdown report from analysis results
   */
  async generateReport(results: AnalysisResult[], config: ReportConfig): Promise<string> {
    const reportPath = path.resolve(config.outputPath);
    
    // Generate the markdown content
    const markdown = this.generateMarkdownContent(results, config);
    
    // Write the report to file
    await fs.writeFile(reportPath, markdown, 'utf8');
    
    console.log(`Report generated: ${reportPath}`);
    return reportPath;
  }

  /**
   * Generate the markdown content for the report
   */
  private generateMarkdownContent(results: AnalysisResult[], config: ReportConfig): string {
    const totalCost = results.reduce((sum, result) => sum + result.serviceRegion.cost, 0);
    const timestamp = new Date().toISOString();

    let markdown = `# AWS Cost Analysis Report

Generated on: ${new Date(timestamp).toLocaleString()}

## Executive Summary

This report analyzes ${results.length} AWS service-region combinations using AI-powered analysis with automated tool selection.

- **Total Cost Analyzed**: $${totalCost.toFixed(2)}
- **Analysis Steps**: ${results.length}
- **Services Analyzed**: ${new Set(results.map(r => r.serviceRegion.service)).size}
- **Regions Analyzed**: ${new Set(results.map(r => r.serviceRegion.region)).size}

## Analysis Overview

| Rank | Step Title | Service | Region | Cost | Tools Used |
|------|-------------|---------|--------|------|------------|
`;

    // Add analysis overview table
    results.forEach((result, index) => {
      const { service, region, cost } = result.serviceRegion;
      const toolsUsed = result.step?.useTools?.join(', ') || 'N/A';
      markdown += `| ${index + 1} | ${result.step?.title || 'Analysis Step'} | ${service} | ${region} | $${cost.toFixed(2)} | ${toolsUsed} |\n`;
    });

    markdown += '\n## Detailed Analysis\n\n';

    // Add detailed analysis for each step
    results.forEach((result, index) => {
      const { service, region, cost } = result.serviceRegion;
      
      markdown += `### ${index + 1}. ${result.step?.title || `Analysis of ${service} in ${region}`}\n\n`;
      markdown += `**Service**: ${service}\n`;
      markdown += `**Region**: ${region}\n`;
      markdown += `**Cost**: $${cost.toFixed(2)}\n`;
      markdown += `**Tools Used**: ${result.step?.useTools?.join(', ') || 'N/A'}\n\n`;
      
      // Add LLM analysis summary
      if (result.summary) {
        markdown += `#### AI Analysis Summary\n\n${result.summary}\n\n`;
      }
      
      // Add tool results
      if (result.toolResults && result.toolResults.length > 0) {
        markdown += `#### Tool Results\n\n`;
        result.toolResults.forEach((toolResult, toolIndex) => {
          markdown += `**Tool ${toolIndex + 1}**: ${toolResult.summary}\n\n`;
          
          if (toolResult.datapointsPath) {
            const relativePath = path.relative(path.dirname(config.outputPath), toolResult.datapointsPath);
            markdown += `- Data stored at: \`${relativePath}\`\n`;
          }
          
          if (toolResult.chartPath) {
            const chartRelativePath = path.relative(path.dirname(config.outputPath), toolResult.chartPath);
            markdown += `- Chart: ![Chart](${chartRelativePath})\n`;
          }
          
          if (toolResult.chartAnalysis) {
            markdown += `- Chart Analysis: ${toolResult.chartAnalysis}\n`;
          }
          
          markdown += '\n';
        });
      }
      
      // Add chart if available
      if (result.chartPath && config.includeCharts) {
        const chartRelativePath = path.relative(path.dirname(config.outputPath), result.chartPath);
        markdown += `#### Cost Visualization\n\n![${service} ${region} Cost Chart](${chartRelativePath})\n\n`;
      }
      
      // Add chart analysis if available
      if (result.chartAnalysis) {
        markdown += `#### Chart Analysis\n\n${result.chartAnalysis}\n\n`;
      }
      
      markdown += '---\n\n';
    });

    // Add appendix
    markdown += this.generateAppendix(results);

    return markdown;
  }

  /**
   * Generate appendix with additional information
   */
  private generateAppendix(results: AnalysisResult[]): string {
    let appendix = `## Appendix

### Methodology

This report was generated using the following process:

1. **Data Collection**: AWS cost and usage data was retrieved using AWS Cost Explorer APIs
2. **Service Ranking**: Services were ranked by total cost in descending order
3. **Planning Phase**: AI analyzed the service-region combinations and created a structured analysis plan
4. **Tool Selection**: For each step, appropriate AWS tools were selected based on the service type
5. **AI Analysis**: Each step was analyzed using Amazon Bedrock Claude 3.7 Sonnet with selected tools
6. **Chart Generation**: Cost visualizations were created using Vega-Lite specifications when available
7. **Visual Analysis**: Charts were analyzed by AI for additional insights and recommendations

### Data Sources

- **AWS Cost Explorer**: Primary source for cost and usage data
- **@ddegtyarev/aws-tools**: AWS API integration tools
- **Amazon Bedrock**: AI analysis and recommendations
- **Vega-Lite**: Chart specifications and visualizations

### Report Statistics

- **Total Steps**: ${results.length}
- **Successful Analyses**: ${results.filter(r => r.summary && !r.summary.includes('Step failed')).length}
- **Charts Generated**: ${results.filter(r => r.chartPath).length}
- **Chart Analyses**: ${results.filter(r => r.chartAnalysis).length}
- **Tools Used**: ${new Set(results.flatMap(r => r.step?.useTools || [])).size}

### Tool Usage Summary

${this.generateToolUsageSummary(results)}

### Recommendations Summary

Based on the analysis across all services, common optimization opportunities include:

1. **Right-sizing**: Review instance types and storage configurations
2. **Reserved Instances**: Consider reserved capacity for stable workloads  
3. **Auto-scaling**: Implement dynamic scaling based on demand
4. **Resource Cleanup**: Remove unused or idle resources
5. **Cost Monitoring**: Set up alerts and regular cost reviews
6. **Tool-Specific Optimizations**: Follow recommendations from individual tool analyses

### Support

For questions about this report or to request additional analysis, please contact your cloud architecture team.

---

*Report generated by AWS Cost Analyzer CLI*
`;

    return appendix;
  }

  /**
   * Generate tool usage summary
   */
  private generateToolUsageSummary(results: AnalysisResult[]): string {
    const toolUsage = new Map<string, number>();
    
    results.forEach(result => {
      result.step?.useTools?.forEach(tool => {
        toolUsage.set(tool, (toolUsage.get(tool) || 0) + 1);
      });
    });
    
    if (toolUsage.size === 0) {
      return 'No tools were used in this analysis.';
    }
    
    const sortedTools = Array.from(toolUsage.entries())
      .sort((a, b) => b[1] - a[1]);
    
    return sortedTools.map(([tool, count]) => 
      `- **${tool}**: Used in ${count} analysis step${count > 1 ? 's' : ''}`
    ).join('\n');
  }

  /**
   * Generate a summary report with just the key metrics
   */
  async generateSummaryReport(results: AnalysisResult[], outputPath: string): Promise<string> {
    const totalCost = results.reduce((sum, result) => sum + result.serviceRegion.cost, 0);
    const topStep = results[0];

    const summary = `# AWS Cost Analysis Summary

**Total Cost**: $${totalCost.toFixed(2)}
**Analysis Steps**: ${results.length}
**Top Analysis**: ${topStep?.step?.title || 'Unknown'} (${topStep?.serviceRegion?.service} in ${topStep?.serviceRegion?.region})

## Quick Wins
${results.slice(0, 3).map((result, index) => 
  `${index + 1}. **${result.step?.title || 'Analysis Step'}** - ${result.serviceRegion.service} ($${result.serviceRegion.cost.toFixed(2)})`
).join('\n')}

## Tools Used
${this.generateToolUsageSummary(results)}

For detailed analysis, see the full report.
`;

    await fs.writeFile(outputPath, summary, 'utf8');
    console.log(`Summary report generated: ${outputPath}`);
    return outputPath;
  }

  /**
   * Generate a report for a single analysis step
   */
  async generateStepReport(results: AnalysisResult[], outputPath: string): Promise<string> {
    const reportPath = path.resolve(outputPath);
    
    // Generate the markdown content
    const markdown = this.generateStepMarkdownContent(results);
    
    // Write the report to file
    await fs.writeFile(reportPath, markdown, 'utf8');
    
    console.log(`Step report generated: ${reportPath}`);
    return reportPath;
  }

  /**
   * Generate the markdown content for a single step report
   */
  private generateStepMarkdownContent(results: AnalysisResult[]): string {
    if (results.length === 0) {
      return '# No Analysis Results\n\nNo analysis data available.';
    }

    const result = results[0];
    const { service, region, cost } = result.serviceRegion;
    const timestamp = new Date().toISOString();

    let markdown = `# AWS Step Analysis Report

Generated on: ${new Date(timestamp).toLocaleString()}

## Analysis Overview

- **Service**: ${service}
- **Region**: ${region}
- **Cost**: $${cost.toFixed(2)}
- **Step Title**: ${result.step?.title || 'Analysis Step'}
- **Tools Used**: ${result.step?.useTools?.join(', ') || 'N/A'}

## Analysis Results

### AI Analysis Summary

${result.summary || 'No analysis summary available.'}

`;

    // Add tool results
    if (result.toolResults && result.toolResults.length > 0) {
      markdown += `### Tool Results\n\n`;
      result.toolResults.forEach((toolResult, toolIndex) => {
        markdown += `**Tool ${toolIndex + 1}**: ${toolResult.summary}\n\n`;
        
        if (toolResult.datapointsPath) {
          markdown += `- Data stored at: \`${toolResult.datapointsPath}\`\n`;
        }
        
        if (toolResult.chartPath) {
          markdown += `- Chart: ![Chart](${toolResult.chartPath})\n`;
        }
        
        if (toolResult.chartAnalysis) {
          markdown += `- Chart Analysis: ${toolResult.chartAnalysis}\n`;
        }
        
        markdown += '\n';
      });
    }

    // Add chart if available
    if (result.chartPath) {
      markdown += `### Cost Visualization\n\n![${service} ${region} Cost Chart](${result.chartPath})\n\n`;
    }
    
    // Add chart analysis if available
    if (result.chartAnalysis) {
      markdown += `### Chart Analysis\n\n${result.chartAnalysis}\n\n`;
    }

    markdown += `---

*Report generated by AWS Cost Analyzer CLI*`;

    return markdown;
  }
} 