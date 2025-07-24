// app/api/admin/files/route.ts
import { NextResponse } from 'next/server';
import { listMarkdownFiles, getMarkdownFileContent } from '@/lib/github-admin';

// GET /api/admin/files - Lists all markdown files
// GET /api/admin/files?path=<filePath> - Gets content of a specific file
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (filePath) {
      // Get single file content
      const content = await getMarkdownFileContent(filePath);
      return NextResponse.json({ content });
    } else {
      // List all files
      const files = await listMarkdownFiles();
      return NextResponse.json(files);
    }
  } catch (error: any) {
    console.error("API Error (GET /api/admin/files):", error);
    if (error.cause === 404) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to fetch file(s)." }, { status: 500 });
  }
}