// src/app/api/admin/file/route.ts
import { NextResponse } from 'next/server';
import { getGitHubFileContent } from '@/lib/github-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: "File path is required." }, { status: 400 });
    }

    const fileData = await getGitHubFileContent(filePath); // Returns { content, sha }
    return NextResponse.json(fileData);
  } catch (error: any) {
    console.error(`Error fetching file content for API:`, error);
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.includes("not authenticated") || error.message.includes("access token is missing")) {
      return NextResponse.json({ error: "Authentication required to fetch file content." }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Failed to fetch file content." }, { status: 500 });
  }
}