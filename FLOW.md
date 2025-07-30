# AWS Cost Analyzer CLI - Process Flow

This document describes the complete process flow of the AWS Cost Analyzer CLI tool, from initialization to report generation.

## Overview

The AWS Cost Analyzer CLI is an AI-powered tool that analyzes AWS account costs and generates detailed markdown reports with charts and insights. The process involves multiple stages of data collection, AI analysis, chart generation, and report creation.

## Architecture Components

### Core Services
- **CLI Interface** (`cli.ts`): Command-line interface and user interaction
- **Cost Analyzer** (`analyzer.ts`): Main orchestration and analysis logic
- **AWS Service** (`aws-service.ts`): AWS API integration and data retrieval
- **LLM Service** (`llm.ts`): AI analysis using Amazon Bedrock
- **Report Generator** (`report-generator.ts`): Markdown report creation
- **Configuration** (`config.ts`): Credentials and settings management
- **Chart Utils** (`chartUtils.ts`): Chart generation using Vega-Lite

## Process Flow

### 1. Initialization Phase

```
User Command → CLI Interface → Configuration Loading
```

**Steps:**
1. **Command Parsing**: CLI parses user arguments and options
2. **Credential Loading**: Loads AWS credentials from `.aws-creds.json`
3. **Configuration Setup**: Initializes output directories and settings
4. **Service Initialization**: Creates instances of AWS, LLM, and Analyzer services

**Key Files:**
- `cli.ts`: Command handling and user interface
- `config.ts`: Credential management and configuration

### 2. Big Picture Data Collection Phase

```
AWS Service → Cost Explorer API → Service-Region Combinations
```

**Steps:**
1. **AWS Credentials Setup**: Configures AWS SDK with loaded credentials
2. **Cost Data Retrieval**: Calls `awsGetCostAndUsage` tool via `@ddegtyarev/aws-tools`
3. **Data Parsing**: Transforms raw cost data into `ServiceRegionCombo` objects
4. **Ranking**: Sorts combinations by cost in descending order
5. **Top N Selection**: Selects top N service-region combinations for analysis

**Key Files:**
- `aws-service.ts`: AWS API integration and data parsing
- `types.ts`: Data structure definitions

**Data Flow:**
```
AWS Cost Explorer → Raw Cost Data → ServiceRegionCombo[] → Top N Combinations
```

### 3. Planning Phase

Invoke LLM passing the top N service-region combinations and all tool descriptions from @ddegtyarev/aws-tools. Use generateObject call to produce structured output. The goal of the LLM would be to determine the steps needed to complete the analysis. The LLM returns an array of steps. Each step is an object:

```json
{
    "title": "Step title",
    "service": "AWS Service to analyse",
    "region": "AWS Region to analyse",
    "useTools": "List of tools to use; make sure to enable only the relevant tools for this service"
}
```


### 4. Analysis Phase

```
For each service-region combination:
  Configure Tools -> Invoke LLM with Tools → Tool Calling and Chart Analysis → Store Chart Images for the Report Phase
```

**Steps for each service-region combination:**

#### 4.1 Configure Tools
Wrap the tools from @ddegtyarev/aws-tools into AI SDK tool objects.
- Only tools chosen at the Planning Phase
- Set the region to make sure the tools scan only the given region
- Set credentials
- If the tools returns a vega-lite chart specification in the "chart" property:
  - render a PNG image and store it in a local output/charts/png folder
  - make an extra LLM call to analyse the chart a produce a text description.
- If the tool returns "datapoints" property - just store it in a local output/data/ folder
- return the tool summary property, path to datapoints, path to chart .png file, and text description of the chart

#### 4.2 Invoke LLM with Tools
- Creates analysis prompt with service, region, cost, context. 
- Sends request to Amazon Bedrock with tools enabled
- Stores the LLM response in memory to use during report building

#### 4.3 Tool Calling and Chart Analysis
LLM calls AI SDK tools, they call @ddegtyarev/aws-tools, and then render the charts and analyse them, returning a comprehensive text result to the llm while also storing raw data and images in the local folder.

**Key Files:**
- `analyzer.ts`: Main analysis orchestration
- `llm.ts`: AI analysis and chart analysis
- `chartUtils.ts`: Chart generation utilities

### 4. Report Generation Phase

```
Analysis Results → Report Generator → Markdown Report + Summary
```

**Steps:**
1. **Content Assembly**: Combines all analysis results into structured content
2. **Executive Summary**: Creates high-level cost overview and statistics
3. **Detailed Analysis**: Formats each service-region analysis with charts
4. **Appendix Creation**: Adds methodology, data sources, and recommendations
5. **File Writing**: Generates main report and summary report files

**Report Structure:**
```
# Executive Summary
- Total cost analyzed
- Services and regions count
- High-level insights

# Cost Overview Table
- Ranked list of service-region combinations

# Detailed Analysis
- Individual analysis for each service-region
- AI-generated insights and recommendations
- Cost visualization charts
- Chart analysis and insights

# Appendix
- Methodology
- Data sources
- Statistics
- Recommendations summary
```

**Key Files:**
- `report-generator.ts`: Report generation and formatting

## Data Flow Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Input    │───▶│   CLI Interface │───▶│  Configuration  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  AWS Service    │◀───│  Cost Analyzer  │◀───│  Credentials    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Cost Explorer   │    │   LLM Service   │
│     API         │    │                 │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Service-Region  │    │  AI Analysis    │
│ Combinations    │    │                 │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Chart Utils     │    │ Chart Analysis  │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ PNG Charts      │    │ Visual Insights │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
            ┌─────────────────┐
            │Report Generator │
            └─────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ Markdown Report │
            └─────────────────┘
```

## Error Handling and Resilience

### Error Recovery Strategies
1. **Credential Errors**: Graceful fallback with clear error messages
2. **AWS API Failures**: Retry logic and detailed error reporting
3. **LLM Failures**: Continue analysis with other service-region combinations
4. **Chart Generation Failures**: Skip chart generation but continue analysis
5. **File System Errors**: Ensure directories exist before writing files

### Logging and Debugging
- **Progress Indicators**: Spinner animations for long-running operations
- **Detailed Logging**: Console output for each major step
- **Error Context**: Comprehensive error messages with context
- **Debug Mode**: Environment variable for detailed logging

## Performance Considerations

### Optimization Strategies
1. **Parallel Processing**: Each service-region analysis is independent
2. **Caching**: Credentials and configuration are cached
3. **Resource Management**: Proper cleanup of AWS SDK resources
4. **Memory Management**: Streaming chart generation to avoid memory issues

### Scalability
- **Configurable Top N**: User can specify number of combinations to analyze
- **Modular Design**: Services can be extended or replaced independently
- **Output Flexibility**: Multiple output formats and locations supported

## Security Considerations

### Credential Management
- **File-based Storage**: Credentials stored in local JSON file
- **No Hardcoding**: No credentials in source code
- **Session Token Support**: Handles temporary STS credentials
- **Region Configuration**: Flexible region selection

### AWS Permissions
- **Minimal Permissions**: Only Cost Explorer permissions required
- **Bedrock Access**: Separate credentials for AI analysis
- **Error Handling**: Graceful handling of permission errors

## Configuration Options

### CLI Options
- `--credentials`: Path to AWS credentials file
- `--output`: Output path for reports
- `--top`: Number of top service-region combinations
- `--no-charts`: Disable chart generation
- `--summary-only`: Generate only summary report

### Environment Variables
- `DEBUG`: Enable detailed logging
- AWS credential environment variables (fallback)

## Output Structure

```
output/
├── aws-cost-report.md          # Main detailed report
├── aws-cost-report-summary.md  # Executive summary
└── charts/
    ├── png/
    │   ├── service1-region1-0.png
    │   └── service2-region2-1.png
    └── svg/
        ├── service1-region1-0.svg
        └── service2-region2-1.svg
```

## Integration Points

### External Dependencies
- **@ddegtyarev/aws-tools**: AWS API integration
- **@ai-sdk/amazon-bedrock**: AI analysis
- **vega/vega-lite**: Chart generation
- **canvas**: PNG chart rendering

### Internal Dependencies
- **commander**: CLI argument parsing
- **chalk**: Terminal color output
- **ora**: Progress spinners
- **fs-extra**: File system operations

## Future Enhancements

### Potential Improvements
1. **Caching**: Cache AWS cost data to reduce API calls
2. **Scheduling**: Automated periodic analysis
3. **Alerts**: Cost threshold notifications
4. **Export Formats**: PDF, HTML, or other report formats
5. **Historical Analysis**: Trend analysis over time
6. **Cost Forecasting**: Predictive cost analysis
7. **Integration**: Webhook notifications or API endpoints

This flow ensures a robust, scalable, and user-friendly AWS cost analysis experience with comprehensive error handling and detailed reporting capabilities. 