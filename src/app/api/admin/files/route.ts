// src/app/api/admin/files/route.ts
import { NextResponse } from 'next/server';
import {
  getAuthenticatedOctokitWithPAT,
  GITHUB_REPO_OWNER,
  GITHUB_REPO_NAME,
  GITHUB_BRANCH_NAME,
} from '@/lib/github-admin';

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  url: string;
  type: 'file' | 'dir';
  size: number;
  download_url: string | null;
}


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || ''; // Get path from query parameter, default to root

    if (!path) {
      return NextResponse.json(
        { error: 'Path parameter is required.' },
        { status: 400 }
      );
    }

    // Get authenticated Octokit instance with PAT
    const octokit = await getAuthenticatedOctokitWithPAT();

    // Fetch file/folder content from GitHub repo
    const response = await octokit.rest.repos.getContent({
      owner: GITHUB_REPO_OWNER!,
      repo: GITHUB_REPO_NAME!,
      path: path,
      ref: GITHUB_BRANCH_NAME!,
    });

    // Fetch GitHub API rate limit info
    const rateLimitResponse = await octokit.rest.rateLimit.get();
    const { limit, remaining, reset } = rateLimitResponse.data.rate;

    let files: GitHubFile[];

    if (Array.isArray(response.data)) {
      // Directory - map each item to desired shape
      files = response.data.map((item: any) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        url: item.url,
        type: item.type,
        size: item.size,
        download_url: item.download_url,
      }));
    } else if (response.data && response.data.type === 'file') {
      // Single file wrapped in array for consistency
      files = [
        {
          name: response.data.name,
          path: response.data.path,
          sha: response.data.sha,
          url: response.data.url,
          type: response.data.type,
          size: response.data.size,
          download_url: response.data.download_url,
        },
      ];
    } else {
      files = [];
    }

    return NextResponse.json({
      files,
      rateLimit: {
        limit,
        remaining,
        reset, // UNIX timestamp - convert on frontend if needed
      },
    });
  } catch (error: any) {
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Content path not found in repository.' },
        { status: 404 }
      );
    }
    console.error('Error fetching files from GitHub:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files from GitHub', details: error.message },
      { status: 500 }
    );
  }
}
