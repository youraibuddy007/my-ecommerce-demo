// .github/scripts/review-pr.js
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Get environment variables
const owner = process.env.REPO_OWNER;
const repo = process.env.REPO_NAME;
const pull_number = process.env.PR_NUMBER;
const baseUrl = process.env.AI_API_BASEURL || 'http://your-company-api-url';

async function callAIModel(prompt) {
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-v2:16b',
        prompt: prompt,
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.response || data.output || data.generated_text;
  } catch (error) {
    console.error('Error calling AI model:', error);
    throw error;
  }
}

async function main() {
  console.log(`Starting AI review for PR #${pull_number}`);
  
  // Get the PR diff
  const { data: pullRequest } = await octokit.pulls.get({
    owner,
    repo,
    pull_number
  });
  
  // Get the files changed in this PR
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number
  });
  
  console.log(`Found ${files.length} changed files`);
  
  // Filter to just code files
  const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb', '.php', '.c', '.cpp', '.cs'];
  const codeFiles = files.filter(file => {
    const ext = path.extname(file.filename).toLowerCase();
    return codeExtensions.includes(ext);
  });
  
  console.log(`Found ${codeFiles.length} code files to review`);
  
  // Initialize review summary
  let overallIssues = [];
  let overallSuggestions = [];
  
  // Review each file
  for (const file of codeFiles) {
    // Skip files that are too large
    if (file.changes > 500) {
      console.log(`Skipping large file: ${file.filename} (${file.changes} changes)`);
      continue;
    }
    
    console.log(`Reviewing: ${file.filename}`);
    
    try {
      // Get the file content at the head commit
      const { data: contentData } = await octokit.repos.getContent({
        owner,
        repo,
        path: file.filename,
        ref: pullRequest.head.ref
      });
      
      // Decode the content if it exists
      let content = '';
      if (contentData.content) {
        content = Buffer.from(contentData.content, 'base64').toString();
      }
      
      // Skip empty files
      if (!content.trim()) {
        console.log(`Skipping empty file: ${file.filename}`);
        continue;
      }
      
      // Get the file extension to determine language
      const extension = path.extname(file.filename).substring(1);
      
      // Create prompt for AI
      const prompt = `
You are an expert code reviewer. Review the following ${extension} code:

\`\`\`${extension}
${content}
\`\`\`

Please provide a detailed code review that identifies:
1. Bugs or potential issues
2. Security vulnerabilities
3. Performance problems
4. Style and best practice violations
5. Specific suggestions for improvement

For each issue, provide:
- The line number (if applicable)
- A description of the issue
- A suggested fix

Format your response as JSON:
{
  "issues": [
    {
      "line": <line_number>,
      "issue": "<description>",
      "suggestion": "<suggested_fix>",
      "severity": "<high|medium|low>"
    }
  ],
  "summary": "<overall_assessment>"
}
`;

      // Get AI review from your local model
      const aiResponse = await callAIModel(prompt);
      
      let review;
      try {
        // Try to parse the AI response as JSON
        // First, see if the response contains a JSON array of issues
        let jsonString = aiResponse;
        
        // Look for JSON in code blocks (the model might wrap JSON in ```json blocks)
        const codeBlockMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonString = codeBlockMatch[1];
        }
        
        // Try to extract a valid JSON object
        console.log("Attempting to parse AI response...");
        console.log("Raw response first 1000 chars:", jsonString.substring(0, 1000));
        
        // Try different parsing approaches
        try {
          // First try direct parsing
          review = JSON.parse(jsonString);
        } catch (directError) {
          console.log("Direct parsing failed, trying alternative approaches");
          
          // If that fails, try to build a valid response from the content
          // This handles cases where the model returns an array of issues instead of the expected format
          if (jsonString.trim().startsWith('[')) {
            try {
              const issues = JSON.parse(jsonString);
              review = {
                issues: issues,
                summary: "Issues found in code review"
              };
            } catch (arrayError) {
              console.log("Array parsing failed:", arrayError);
              throw arrayError;
            }
          } else {
            // If all else fails, try to extract any JSON object
            const objectMatch = jsonString.match(/\{[\s\S]*\}/);
            if (objectMatch) {
              review = JSON.parse(objectMatch[0]);
            } else {
              throw new Error("No valid JSON found in response");
            }
          }
        }
      } catch (e) {
        console.error("Error parsing AI response:", e);
        console.log("Full raw response:", aiResponse);
        
        // Create a manual review object by parsing text
        const lines = aiResponse.split('\n');
        const issues = [];
        let currentIssue = null;
        let summary = "Code review completed with parsing issues";
        
        // Try to extract information from text format
        for (const line of lines) {
          if (line.includes('line:') || line.includes('Line:') || line.toLowerCase().startsWith('line ')) {
            // Start a new issue
            if (currentIssue) issues.push(currentIssue);
            currentIssue = { 
              line: parseInt(line.replace(/[^0-9]/g, '')) || null,
              issue: "",
              suggestion: "",
              severity: "medium"
            };
          } else if (currentIssue && (line.includes('issue:') || line.includes('Issue:') || line.includes('problem:'))) {
            currentIssue.issue = line.split(':')[1]?.trim() || line;
          } else if (currentIssue && (line.includes('suggest') || line.includes('fix') || line.includes('solution'))) {
            currentIssue.suggestion = line.split(':')[1]?.trim() || line;
          } else if (line.includes('summary') || line.includes('Summary')) {
            summary = line.split(':')[1]?.trim() || summary;
          }
        }
        
        // Add the last issue if there is one
        if (currentIssue) issues.push(currentIssue);
        
        // Fallback: create a review object from the extracted information
        review = {
          issues: issues.length > 0 ? issues : [],
          summary: summary
        };
        
        console.log("Created fallback review object:", JSON.stringify(review, null, 2));
      }
      
      // Add file-specific issues to overall list
      if (review.issues && review.issues.length > 0) {
        overallIssues.push(...review.issues.map(issue => ({
          ...issue,
          file: file.filename
        })));
        
        // Comment on specific lines
        for (const issue of review.issues) {
          if (issue.line) {
            await octokit.pulls.createReviewComment({
              owner,
              repo,
              pull_number,
              body: `**${issue.severity.toUpperCase()}**: ${issue.issue}\n\nSuggestion: ${issue.suggestion}`,
              commit_id: pullRequest.head.sha,
              path: file.filename,
              line: issue.line
            });
            console.log(`Posted comment on ${file.filename}:${issue.line}`);
          }
        }
      }
      
      // Post a file-level summary comment
      if (review.summary) {
        overallSuggestions.push(`**${file.filename}**: ${review.summary}`);
      }
      
    } catch (error) {
      console.error(`Error reviewing ${file.filename}:`, error);
    }
  }
  
  // Create a PR review with a summary
  if (overallIssues.length > 0 || overallSuggestions.length > 0) {
    // Create summary comment
    console.log(overallIssues);
    const summaryBody = `# ReviewRanger: Code Review Summary

${overallIssues.length > 0 ? `## Issues Found (${overallIssues.length})
${overallIssues.map(issue => `- **${issue.severity.toUpperCase()}** [${issue.file}${issue.line ? `:${issue.line}` : ''}]: ${issue.issue}`).join('\n')}` : ''}

${overallSuggestions.length > 0 ? `## Summary by File
${overallSuggestions.join('\n\n')}` : ''}

---
*This review was performed automatically by ReviewRanger* 🤠
`;

    // Post the review
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number,
      body: summaryBody,
      event: 'COMMENT'  // Can be 'APPROVE', 'REQUEST_CHANGES', or 'COMMENT'
    });
    
    console.log('Posted PR review summary');
  } else {
    console.log('No issues found, not posting a review');
  }
}

main().catch(error => {
  console.error('Error in review process:', error);
  process.exit(1);
});