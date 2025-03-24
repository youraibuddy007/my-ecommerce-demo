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

// Gets related files based on imports and dependencies
async function getRelatedFiles(filename, content, pullRequest) {
  const relatedFiles = new Set();
  const importRegex = /(?:import|require|from|@import)\s+['"](\.\/|\.\.\/|\/)?([^'"]+)['"]/g;
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    let importPath = match[2];
    
    // Handle relative paths
    if (match[1]) {
      importPath = path.join(path.dirname(filename), match[1] + importPath);
    }
    
    // Add common extensions if missing
    if (!path.extname(importPath)) {
      for (const ext of ['.js', '.jsx', '.ts', '.tsx', '.scss', '.css']) {
        const fullPath = `${importPath}${ext}`;
        relatedFiles.add(fullPath);
        
        // Also try index files in directories
        if (!fullPath.endsWith('/index' + ext)) {
          relatedFiles.add(path.join(importPath, 'index' + ext));
        }
      }
    } else {
      relatedFiles.add(importPath);
    }
  }
  
  // Fetch content of related files
  const relatedContents = {};
  for (const relatedFile of relatedFiles) {
    try {
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: relatedFile,
        ref: pullRequest.head.ref
      });
      
      if (fileData.content) {
        const fileContent = Buffer.from(fileData.content, 'base64').toString();
        // Only include if file is not too large
        if (fileContent.length < 10000) {
          relatedContents[relatedFile] = fileContent;
        }
      }
    } catch (error) {
      // File might not exist, that's okay
      console.log(`Could not fetch related file: ${relatedFile}`);
    }
  }
  
  return relatedContents;
}

// Fetch the original version of the file (before PR changes)
async function getOriginalFile(filename, pullRequest) {
  try {
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path: filename,
      ref: pullRequest.base.ref  // Base branch (typically main/master)
    });
    
    if (fileData.content) {
      return Buffer.from(fileData.content, 'base64').toString();
    }
    return null;  // File doesn't exist in base branch (new file)
  } catch (error) {
    return null;  // File doesn't exist in base branch (new file)
  }
}

async function main() {
  console.log(`Starting AI review for PR #${pull_number}`);
  
  // Get the PR details
  const { data: pullRequest } = await octokit.pulls.get({
    owner,
    repo,
    pull_number
  });
  
  // Get the PR description for additional context
  const prDescription = pullRequest.body || '';
  
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
      // Get the file content at the head commit (modified version)
      const { data: contentData } = await octokit.repos.getContent({
        owner,
        repo,
        path: file.filename,
        ref: pullRequest.head.ref
      });
      
      // Decode the content if it exists
      let modifiedContent = '';
      if (contentData.content) {
        modifiedContent = Buffer.from(contentData.content, 'base64').toString();
      }
      
      // Skip empty files
      if (!modifiedContent.trim()) {
        console.log(`Skipping empty file: ${file.filename}`);
        continue;
      }
      
      // Get the original file content (before PR changes)
      const originalContent = await getOriginalFile(file.filename, pullRequest) || '';
      
      // Get related files based on imports
      const relatedFiles = await getRelatedFiles(file.filename, modifiedContent, pullRequest);
      
      // Get the file extension to determine language
      const extension = path.extname(file.filename).substring(1);
      
      // Create context about the file and PR
      const fileContext = `
This file is part of PR #${pull_number}: "${pullRequest.title}"
PR Description: ${prDescription}
Branch: ${pullRequest.head.ref}
This file ${originalContent ? 'was modified' : 'is new'} in this PR.
      `.trim();
      
      // Create prompt for AI
      const prompt = `
You are an expert code reviewer. Review the following changes in a ${extension} file:

${originalContent ? `ORIGINAL CODE (BEFORE CHANGES):
\`\`\`${extension}
${originalContent}
\`\`\`` : "This is a new file added in this PR."}

MODIFIED CODE (AFTER CHANGES):
\`\`\`${extension}
${modifiedContent}
\`\`\`

FILE CONTEXT:
${fileContext}

${Object.keys(relatedFiles).length > 0 ? `RELATED FILES:
${Object.entries(relatedFiles).map(([filename, content]) => 
  `${filename}:\n\`\`\`\n${content.substring(0, 1000)}${content.length > 1000 ? '...(truncated)' : ''}\n\`\`\``).join('\n\n')}` : ''}

Please focus your review on the changes made in this PR. Provide a detailed code review that identifies:
1. Bugs or potential issues
2. Security vulnerabilities
3. Performance problems
4. Style and best practice violations
5. Specific suggestions for improvement

For each issue, provide:
- The line number in the MODIFIED CODE (if applicable)
- A description of the issue
- A suggested fix
- Severity level (high/medium/low)

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
      let review;

      try {
        // Get AI review from your local model
        const aiResponse = await callAIModel(prompt);
        console.log(aiResponse);
        
        // Use the improved parsing function
        review = sanitizeAndParseJSON(aiResponse);
        
        console.log(review);
        console.log(`Found ${review.issues.length} issues in the review`);
        
      } catch (error) {
        console.error(`Error reviewing ${file.filename}:`, error);
        continue;
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

// JSON parsing function
function sanitizeAndParseJSON(jsonString) {
    console.log("Attempting to sanitize and parse AI response...");
    
    // Strip code block markers if present (```json and ```)
    let cleanedJson = jsonString.trim();
    if (cleanedJson.startsWith("```json")) {
      cleanedJson = cleanedJson.substring(7);
    } else if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.substring(3);
    }
    
    if (cleanedJson.endsWith("```")) {
      cleanedJson = cleanedJson.substring(0, cleanedJson.length - 3);
    }
    
    cleanedJson = cleanedJson.trim();
    
    // First attempt: Try to parse directly
    try {
      return JSON.parse(cleanedJson);
    } catch (e) {
      console.log("Direct parsing failed, attempting to fix common JSON syntax errors");
    }
    
    // Second attempt: Fix missing commas between properties
    try {
      // This regex specifically targets the pattern in your example where a property
      // ends with a quote-value-quote and the next line starts with a quote (property name)
      // but there's no comma in between
      const fixedJson = cleanedJson.replace(/("(?:suggestion|issue|severity)":\s*"[^"]*")\s*\n\s*("(?:suggestion|issue|severity)")/g, '$1,\n  $2');
      return JSON.parse(fixedJson);
    } catch (e) {
      console.log("Fixed comma parsing failed, trying object extraction approach");
    }
    
    // Third attempt: Extract and fix individual issue objects
    try {
      // For each issue object, extract and fix it
      const issueObjectRegex = /{[^{]*"line":[^}]*"severity":[^}]*}/g;
      const issueMatches = cleanedJson.match(issueObjectRegex);
      
      if (issueMatches && issueMatches.length > 0) {
        const issues = [];
        
        for (const issueStr of issueMatches) {
          try {
            // Fix the missing commas in each individual issue object
            const fixedIssueStr = issueStr
              .replace(/("suggestion":\s*"[^"]*")\s*\n\s*("severity")/g, '$1,\n    $2')
              .replace(/("issue":\s*"[^"]*")\s*\n\s*("suggestion")/g, '$1,\n    $2');
              
            const issue = JSON.parse(fixedIssueStr);
            issues.push(issue);
          } catch (issueErr) {
            console.log(`Failed to parse individual issue: ${issueStr}`);
            
            // Extract fields manually if JSON parsing fails
            const lineMatch = issueStr.match(/"line":\s*(\d+)/);
            const issueMatch = issueStr.match(/"issue":\s*"([^"]*)"/);
            const suggestionMatch = issueStr.match(/"suggestion":\s*"([^"]*)"/);
            const severityMatch = issueStr.match(/"severity":\s*"([^"]*)"/);
            
            if (lineMatch) {
              issues.push({
                line: parseInt(lineMatch[1]),
                issue: issueMatch ? issueMatch[1] : "Unknown issue",
                suggestion: suggestionMatch ? suggestionMatch[1] : "No suggestion provided",
                severity: severityMatch ? severityMatch[1] : "medium"
              });
            }
          }
        }
        
        // Extract summary
        let summary = "Code review completed";
        const summaryMatch = cleanedJson.match(/"summary":\s*"([^"]*)"/);
        if (summaryMatch && summaryMatch[1]) {
          summary = summaryMatch[1];
        }
        
        return {
          issues: issues,
          summary: summary
        };
      }
    } catch (e) {
      console.log("Issue extraction failed:", e);
    }
    
    // Final fallback: Try a line-by-line parsing approach
    console.log("All JSON parsing attempts failed, falling back to line-by-line parsing");
    
    const lines = cleanedJson.split('\n');
    const issues = [];
    let currentIssue = null;
    let summary = "Code review completed with parsing issues";
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes('"line":')) {
        // Start of a new issue
        if (currentIssue) {
          issues.push(currentIssue);
        }
        
        const lineNumberMatch = trimmedLine.match(/"line":\s*(\d+)/);
        const lineNumber = lineNumberMatch ? parseInt(lineNumberMatch[1]) : null;
        
        currentIssue = {
          line: lineNumber,
          issue: "",
          suggestion: "",
          severity: "medium"
        };
      } else if (currentIssue && trimmedLine.includes('"issue":')) {
        const match = trimmedLine.match(/"issue":\s*"([^"]*)"/);
        if (match) {
          currentIssue.issue = match[1];
        }
      } else if (currentIssue && trimmedLine.includes('"suggestion":')) {
        const match = trimmedLine.match(/"suggestion":\s*"([^"]*)"/);
        if (match) {
          currentIssue.suggestion = match[1];
        }
      } else if (currentIssue && trimmedLine.includes('"severity":')) {
        const match = trimmedLine.match(/"severity":\s*"([^"]*)"/);
        if (match) {
          currentIssue.severity = match[1];
        }
      } else if (trimmedLine.includes('"summary":')) {
        const match = trimmedLine.match(/"summary":\s*"([^"]*)"/);
        if (match) {
          summary = match[1];
        }
      }
    }
    
    // Add the last issue if there is one
    if (currentIssue) {
      issues.push(currentIssue);
    }
    
    return {
      issues: issues,
      summary: summary
    };
  }