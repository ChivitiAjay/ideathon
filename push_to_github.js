/**
 * GitHub Uploader Utility (Zero-Git-Dependency)
 * Allows pushing the entire project directly to GitHub using your GitHub Personal Access Token or credentials via GitHub REST API.
 * 
 * Usage:
 *   node push_to_github.js <GITHUB_USERNAME> <GITHUB_TOKEN_OR_PASSWORD> [REPO_NAME]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const args = process.argv.slice(2);
const username = args[0];
const token = args[1];
const repoName = args[2] || 'personal-gemini-journal';

if (!username || !token) {
  console.log(`
======================================================================
  Personal Gemini Journal - GitHub Repository Uploader
======================================================================
  Usage:
    node push_to_github.js <GITHUB_USERNAME> <GITHUB_TOKEN> [REPO_NAME]

  Example:
    node push_to_github.js myusername ghp_xxxxxxxxxxxxxxxxxxxx personal-gemini-journal

  Tip: To generate a Personal Access Token:
  1. Go to GitHub -> Settings -> Developer Settings -> Personal Access Tokens -> Tokens (classic)
  2. Generate new token with 'repo' scope checked.
======================================================================
`);
  process.exit(0);
}

function githubRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const authHeader = 'Basic ' + Buffer.from(`${username}:${token}`).toString('base64');
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: method,
      headers: {
        'User-Agent': 'Personal-Gemini-Journal-Uploader',
        'Authorization': authHeader,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            resolve({ error: true, status: res.statusCode, data: parsed });
          }
        } catch (e) {
          resolve({ error: true, status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  const IGNORED = [
    'node_modules',
    '.git',
    '.env',
    '.DS_Store',
    'scratch'
  ];

  files.forEach(file => {
    if (IGNORED.includes(file)) return;
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function uploadProject() {
  console.log(`\nChecking repository '${username}/${repoName}' on GitHub...`);
  
  // 1. Check if repo exists, if not create it
  let repo = await githubRequest(`/repos/${username}/${repoName}`);
  if (repo.error && repo.status === 404) {
    console.log(`Repository does not exist. Creating new public repository '${repoName}'...`);
    repo = await githubRequest('/user/repos', 'POST', {
      name: repoName,
      description: 'Secure, authenticated Personal Gemini Journal built with Firebase Auth, Cloud Firestore, and deployed on Google Cloud Run #AccelerateAIwithCloudRun',
      private: false,
      auto_init: true
    });

    if (repo.error) {
      console.error('Failed to create repository:', repo.data);
      return;
    }
    console.log(`Created repository: ${repo.html_url}`);
    // Wait 2 seconds for GitHub to initialize branch
    await new Promise(r => setTimeout(r, 2000));
  } else if (repo.error) {
    console.error('GitHub authentication error:', repo.data?.message || repo);
    return;
  } else {
    console.log(`Repository found: ${repo.html_url}`);
  }

  // 2. Scan project files
  const rootDir = path.resolve(__dirname);
  const files = getAllFiles(rootDir);
  console.log(`Found ${files.length} project files to upload.\n`);

  for (const filePath of files) {
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath);
    const base64Content = content.toString('base64');

    // Check if file exists to get SHA for update
    const existingFile = await githubRequest(`/repos/${username}/${repoName}/contents/${relPath}`);
    const sha = (!existingFile.error && existingFile.sha) ? existingFile.sha : undefined;

    console.log(`Uploading: ${relPath}...`);
    const uploadRes = await githubRequest(`/repos/${username}/${repoName}/contents/${relPath}`, 'PUT', {
      message: `feat: add ${relPath}`,
      content: base64Content,
      sha: sha
    });

    if (uploadRes.error) {
      console.warn(`  Warning on ${relPath}:`, uploadRes.data?.message || 'Upload error');
    }
  }

  console.log(`\n======================================================================`);
  console.log(`  🎉 Project Successfully Uploaded to GitHub!`);
  console.log(`  Repository URL: https://github.com/${username}/${repoName}`);
  console.log(`======================================================================\n`);
}

uploadProject().catch(console.error);
