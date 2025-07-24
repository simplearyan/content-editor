// src/app/api/admin/delete/route.ts
import { NextResponse } from 'next/server';
import { deleteGitHubFile, getGitHubFileContent } from '@/lib/github-admin';

export async function DELETE(request: Request) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: "File path is required." }, { status: 400 });
    }

    // Must get SHA before deleting for optimistic locking
    let existingSha: string;
    try {
      const existingFile = await getGitHubFileContent(filePath);
      existingSha = existingFile.sha;
    } catch (error: any) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: `File to delete not found: ${filePath}` }, { status: 404 });
      }
      console.error(`Error getting SHA for deletion of ${filePath}:`, error);
      return NextResponse.json({ error: `Failed to get file SHA for deletion: ${error.message || error.status}` }, { status: 500 });
    }

    const commitMessage = `Delete: ${filePath}`;
    const result = await deleteGitHubFile(filePath, commitMessage, existingSha);

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: any) {
    console.error(`Error deleting file via API:`, error);
    if (error.message.includes("not authenticated") || error.message.includes("access token is missing")) {
      return NextResponse.json({ error: "Authentication required to delete files." }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Failed to delete file." }, { status: 500 });
  }
}