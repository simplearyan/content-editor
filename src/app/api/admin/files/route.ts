// src/app/api/admin/files/route.ts
import { NextResponse } from 'next/server';
import { octokit, getAuthenticatedOctokitWithPAT, GITHUB_REPO_OWNER, GITHUB_REPO_NAME, GITHUB_CONTENT_PATH, GitHubFile, GITHUB_BRANCH_NAME } from '@/lib/github-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || ''; // Get path from query parameter, default to root

    if (!path) {
      return NextResponse.json({ error: "Path parameter is required." }, { status: 400 });
    }

    const response = await octokit.rest.repos.getContent({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      path: path, // Use the dynamic path
      ref: GITHUB_BRANCH_NAME,
    });

    if (Array.isArray(response.data)) {
      // Filter out only files and directories within the specified path
      const files = response.data.map((item: any) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        url: item.url,
        type: item.type,
        size: item.size,
        download_url: item.download_url,
      }));
      return NextResponse.json(files);
    } else if (response.data && response.data.type === 'file') {
        // If the path pointed directly to a file, return it in an array
        return NextResponse.json([{
            name: response.data.name,
            path: response.data.path,
            sha: response.data.sha,
            url: response.data.url,
            type: response.data.type,
            size: response.data.size,
            download_url: response.data.download_url,
        }]);
    } else {
        // Handle case where path is valid but not a directory or file (e.g., empty directory)
        return NextResponse.json([]);
    }

  } catch (error: any) {
    if (error.status === 404) {
        return NextResponse.json({ error: "Content path not found in repository." }, { status: 404 });
    }
    console.error('Error fetching files from GitHub:', error);
    return NextResponse.json({ error: 'Failed to fetch files from GitHub', details: error.message }, { status: 500 });
  }
}