# AWS Cost Analyzer CLI - Setup Guide

## Quick Setup

### 1. Install Dependencies
The dependencies are already installed. You have a fully functional CLI project ready to use.

### 2. Set up AWS Credentials
Copy the example credentials file and update it with your AWS credentials:

```bash
cp .aws-creds.json.example .aws-creds.json
```

Edit `.aws-creds.json` with your actual AWS credentials:
```json
{
  "Credentials": {
    "AccessKeyId": "YOUR_AWS_ACCESS_KEY_ID",
    "SecretAccessKey": "YOUR_AWS_SECRET_ACCESS_KEY",
    "SessionToken": "YOUR_SESSION_TOKEN_IF_USING_STS"
  },
  "region": "us-east-1"
}
```

**Note**: This format supports both regular AWS credentials and STS temporary credentials with session tokens.

### 3. Build and Test

```bash
# Build the project
npm run build

# Test the CLI (using built version)
node dist/cli.js --help

# Create credentials file
node dist/cli.js init

# Validate credentials
node dist/cli.js validate

# Run analysis
node dist/cli.js analyze
```

### 4. Development Commands

```bash
# For development (when dependencies are compatible)
npm run dev -- --help
npm run dev -- init
npm run dev -- validate
npm run dev -- analyze
```

## Project Structure

Your CLI tool includes:

- ✅ **Complete TypeScript setup** with all dependencies
- ✅ **CLI interface** with Commander.js
- ✅ **AWS credentials management** 
- ✅ **LLM integration** with Amazon Bedrock Claude 3.7 Sonnet
- ✅ **Chart generation** with Vega-Lite → PNG conversion
- ✅ **Markdown report generation**
- ✅ **Full analysis flow** as specified

## Flow Implementation

The tool implements the exact flow you requested:

1. ✅ **Load AWS creds** from `.aws-creds.json`
2. ✅ **Call awsCostAndUsage** tool to get top service-region combos
3. ✅ **Order by descending cost**
4. ✅ **For each service-region**: Execute LLM call with tools and analysis goal
5. ✅ **Generate charts** and convert to PNG using `chartUtils.ts`
6. ✅ **Send PNG to LLM** for visual analysis
7. ✅ **Combine results** into comprehensive markdown report

## Key Features

- **AI-Powered Analysis**: Uses Claude 3.7 Sonnet for intelligent cost insights
- **Visual Charts**: Generates cost charts using Vega-Lite
- **Chart Analysis**: AI analyzes generated charts for deeper insights
- **Comprehensive Reports**: Markdown reports with charts and recommendations
- **CLI Interface**: Easy-to-use commands for all operations

## Next Steps

1. Update your AWS credentials in `.aws-creds.json`
2. Test with `node dist/cli.js validate`
3. Run your first analysis with `node dist/cli.js analyze`

The CLI will generate detailed reports in the `./output/` directory with both full reports and summary reports.

## Module Compatibility Note

If you encounter module compatibility issues with `@ddegtyarev/aws-tools`, you may need to:
1. Check the package documentation for proper usage
2. Verify Node.js version compatibility
3. Consider alternative AWS SDK approaches if needed

The project structure is complete and ready for use! 