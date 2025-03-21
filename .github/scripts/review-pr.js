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

  try {
    // Get AI review from your local model
    const aiResponse = await callAIModel(prompt);
    console.log(aiResponse);
    
    // Use the improved parsing function
    const review = sanitizeAndParseJSON(aiResponse);
    
    console.log(review);
    console.log(`Found ${review.issues.length} issues in the review`);
    
    // Rest of your code continues as before...
  } catch (error) {
    console.error(`Error reviewing ${file.filename}:`, error);
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

// Add this improved JSON parsing function to your review-pr.js file

function sanitizeAndParseJSON(jsonString) {
    console.log("Attempting to sanitize and parse AI response...");
    
    // First attempt: Try to parse directly
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.log("Direct parsing failed, attempting to fix common JSON syntax errors");
    }
    
    // Second attempt: Fix missing commas between properties
    try {
      // This regex looks for a string or number followed by a quote that starts a new property
      // without a comma in between
      const fixedJson = jsonString.replace(/(["\d])\s*\n\s*"/g, '$1,\n"');
      return JSON.parse(fixedJson);
    } catch (e) {
      console.log("Fixed comma parsing failed, trying more aggressive approaches");
    }
    
    // Third attempt: Try to extract valid JSON objects and rebuild
    try {
      // Extract all valid looking JSON objects using regex
      const issueMatches = jsonString.match(/\{\s*"line"[\s\S]*?(?:\}\s*,|\}(?!\s*,))/g);
      
      if (issueMatches && issueMatches.length > 0) {
        // Try to fix and parse each issue object
        const issues = [];
        
        for (const issueStr of issueMatches) {
          try {
            // Fix trailing commas after the last property
            const fixedIssueStr = issueStr.replace(/,\s*\}$/, '}');
            // Add missing commas between properties
            const sanitizedIssueStr = fixedIssueStr.replace(/(["\d])\s*\n\s*"/g, '$1,\n"');
            
            const issue = JSON.parse(sanitizedIssueStr);
            
            // Ensure all required fields exist
            if (!issue.severity) issue.severity = "medium";
            if (!issue.suggestion) issue.suggestion = "No suggestion provided";
            
            issues.push(issue);
          } catch (issueErr) {
            console.log(`Failed to parse individual issue: ${issueStr}`);
          }
        }
        
        // Extract summary if available
        let summary = "Code review completed with limited parsing";
        const summaryMatch = jsonString.match(/"summary"\s*:\s*"([^"]+)"/);
        if (summaryMatch && summaryMatch[1]) {
          summary = summaryMatch[1];
        }
        
        return {
          issues: issues,
          summary: summary
        };
      }
    } catch (e) {
      console.log("Object extraction failed:", e);
    }
    
    // Final fallback: manual parsing
    console.log("All JSON parsing attempts failed, falling back to manual parsing");
    const lines = jsonString.split('\n');
    const issues = [];
    let currentIssue = null;
    let summary = "Code review completed with parsing issues";
    
    for (const line of lines) {
      const lineContent = line.trim();
      
      // Try to extract line numbers
      if (lineContent.includes('"line"') || lineContent.toLowerCase().includes('line:')) {
        // Start a new issue
        if (currentIssue) issues.push(currentIssue);
        
        const lineMatch = lineContent.match(/(\d+)/);
        currentIssue = { 
          line: lineMatch ? parseInt(lineMatch[1]) : null,
          issue: "",
          suggestion: "",
          severity: "medium"
        };
      } 
      // Extract issue description
      else if (currentIssue && (lineContent.includes('"issue"') || lineContent.includes('issue:'))) {
        const match = lineContent.match(/"issue"\s*:\s*"([^"]+)"|issue:\s*(.+)/);
        if (match) {
          currentIssue.issue = match[1] || match[2] || "";
        }
      } 
      // Extract suggestion
      else if (currentIssue && (lineContent.includes('"suggestion"') || lineContent.includes('suggestion:'))) {
        const match = lineContent.match(/"suggestion"\s*:\s*"([^"]+)"|suggestion:\s*(.+)/);
        if (match) {
          currentIssue.suggestion = match[1] || match[2] || "";
        }
      }
      // Extract severity
      else if (currentIssue && (lineContent.includes('"severity"') || lineContent.includes('severity:'))) {
        const match = lineContent.match(/"severity"\s*:\s*"([^"]+)"|severity:\s*(.+)/);
        if (match) {
          currentIssue.severity = (match[1] || match[2] || "").replace(/"/g, '');
        }
      }
      // Extract summary
      else if (lineContent.includes('"summary"') || lineContent.includes('summary:')) {
        const match = lineContent.match(/"summary"\s*:\s*"([^"]+)"|summary:\s*(.+)/);
        if (match) {
          summary = match[1] || match[2] || summary;
        }
      }
    }
    
    // Add the last issue if there is one
    if (currentIssue) issues.push(currentIssue);
    
    return {
      issues: issues,
      summary: summary
    };
  }
  
  