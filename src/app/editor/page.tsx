// app/editor/page.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import SimpleMdeReact from "react-simplemde-editor";
import "easymde/dist/easymde.min.css"; // Styles for SimpleMDE

// Re-use your markdown processing pipeline from the blog app
// For simplicity, we'll put it directly here, but ideally you'd share it.
import { remark } from 'remark';
import rehypeReact from 'rehype-react';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

// Placeholder for custom components if you have them (e.g., Callout)
const customRehypeReactOptions = {
  createElement: React.createElement,
  Fragment: React.Fragment,
  jsx: React.Children.toArray,
  jsxs: React.Children.toArray, // These might need adjustment based on your react version
  // Add your custom components here if they exist in your blog's setup
  // 'div': ({ className, children, ...props }) => {
  //   if (className && className.startsWith('callout-')) {
  //     const type = className.split('-')[1] as 'info' | 'warning' | 'error';
  //     return <Callout type={type} {...props}>{children}</Callout>;
  //   }
  //   return React.createElement('div', props, children);
  // },
};

async function processMarkdownToReact(markdownContent: string): Promise<React.ReactNode> {
  if (!markdownContent) return null;
  try {
    const processedContent = await remark()
      .use(remarkMath)
      .use(remarkGfm)
      .use(rehypeKatex)
      .use(rehypePrettyCode, {
        theme: 'github-dark', // Match your blog's theme
      })
      .use(rehypeReact, customRehypeReactOptions)
      .process(markdownContent);
    return processedContent.result as React.ReactNode;
  } catch (error) {
    console.error("Error processing markdown for preview:", error);
    return <p className="text-red-500">Error rendering preview.</p>;
  }
}


// Main Editor Component
export default function EditorPage() {
  const { data: session, status } = useSession();
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [previewContent, setPreviewContent] = useState<React.ReactNode>(null);
  const [fileList, setFileList] = useState<{ name: string; path: string; sha: string; url: string }[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSha, setSelectedFileSha] = useState<string>(''); // For updates/deletes
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = session?.user?.isAdmin;

  // Fetch file list on load
  const fetchFileList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/files');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setFileList(data);
    } catch (err: any) {
      setError(`Failed to load file list: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      fetchFileList();
    }
  }, [status, isAdmin, fetchFileList]);

  // Load selected file content
  const loadFileContent = useCallback(async (file: { name: string; path: string; sha: string }) => {
    setLoading(true);
    setError(null);
    setSelectedFileName(file.name);
    setSelectedFileSha(file.sha);
    try {
      const response = await fetch(`/api/admin/files?path=${file.path}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setMarkdownContent(data.content);
    } catch (err: any) {
      setError(`Failed to load file content: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update preview on markdown content change
  useEffect(() => {
    const renderPreview = async () => {
      setPreviewContent(await processMarkdownToReact(markdownContent));
    };
    renderPreview();
  }, [markdownContent]);


  const handleSave = async () => {
    if (!selectedFileName || !markdownContent) {
      setError("Cannot save: No file selected or content is empty.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: selectedFileName,
          content: markdownContent,
          sha: selectedFileSha, // Pass SHA for updates
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Save failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      setSelectedFileSha(result.result.content.sha); // Update SHA after successful save
      await fetchFileList(); // Refresh file list to show any changes
      alert('File saved successfully!');
    } catch (err: any) {
      setError(`Error saving file: ${err.message}`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFileName || !selectedFileSha) {
      setError("Cannot delete: No file selected or missing SHA.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${selectedFileName}"? This action cannot be undone.`)) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: selectedFileName,
          sha: selectedFileSha, // SHA is required for deletes
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Delete failed: ${errorData.error || response.statusText}`);
      }

      await response.json();
      setMarkdownContent('');
      setSelectedFileName('');
      setSelectedFileSha('');
      await fetchFileList(); // Refresh file list
      alert('File deleted successfully!');
    } catch (err: any) {
      setError(`Error deleting file: ${err.message}`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleNewFile = () => {
    let newFileName = prompt("Enter new markdown filename (e.g., my-new-post.md):");
    if (newFileName && !newFileName.endsWith('.md') && !newFileName.endsWith('.mdx')) {
      newFileName += '.md'; // Default to .md if no extension provided
    }
    if (newFileName) {
      setMarkdownContent('---\ntitle: New Post\ndescription: A new post\ndate: ' + new Date().toISOString().split('T')[0] + '\nauthor: Your Name\ntags: [new]\n---\n\n# New Blog Post\n\nStart writing your Markdown content here.');
      setSelectedFileName(newFileName);
      setSelectedFileSha(''); // No SHA for new file
    }
  };


  const simpleMdeOptions = useMemo(() => {
    return {
      spellChecker: false,
      autofocus: true,
      // Add custom EasyMDE toolbar buttons if needed
      // toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "guide"],
    } as SimpleMdeReact.Options;
  }, []);


  if (status === "loading") {
    return <div className="flex justify-center items-center min-h-screen text-gray-800 dark:text-gray-200">Loading authentication...</div>;
  }

  if (status === "unauthenticated" || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
        <p className="text-gray-700 dark:text-gray-300 mb-6">You are not authorized to view this page. Please sign in with an admin GitHub account.</p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar for file selection */}
      <aside className="w-64 bg-gray-200 dark:bg-gray-800 p-4 flex flex-col">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Files</h2>
        <button
          onClick={handleNewFile}
          className="w-full mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200"
        >
          + New File
        </button>
        {loading && <p className="text-gray-600 dark:text-gray-400">Loading files...</p>}
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <ul className="flex-grow overflow-y-auto">
          {fileList.length === 0 && !loading && <p className="text-gray-600 dark:text-gray-400 text-sm">No files found.</p>}
          {fileList.map((file) => (
            <li key={file.path} className="mb-2">
              <button
                onClick={() => loadFileContent(file)}
                className={`w-full text-left p-2 rounded hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors duration-200 ${
                  selectedFileName === file.name ? 'bg-blue-300 dark:bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                }`}
              >
                {file.name}
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
        >
          Sign Out
        </button>
      </aside>

      {/* Main editor and preview area */}
      <main className="flex-grow flex flex-col p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
          Editing: {selectedFileName || "Select or Create a File"}
        </h1>

        <div className="flex space-x-4 mb-4">
          <button
            onClick={handleSave}
            disabled={!selectedFileName || saving}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleDelete}
            disabled={!selectedFileName || saving || !selectedFileSha}
            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
          >
            {saving ? 'Deleting...' : 'Delete'}
          </button>
          {error && <p className="text-red-500 text-sm self-center ml-auto">{error}</p>}
        </div>

        <div className="flex-grow grid grid-cols-2 gap-4">
          {/* Markdown Editor */}
          <div className="flex flex-col bg-white dark:bg-gray-800 rounded shadow overflow-hidden">
            <SimpleMdeReact
              value={markdownContent}
              onChange={setMarkdownContent}
              options={simpleMdeOptions}
            />
          </div>

          {/* Markdown Preview */}
          <div className="flex flex-col bg-white dark:bg-gray-800 rounded shadow overflow-y-auto p-4">
            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Preview</h3>
            <div className="prose dark:prose-invert max-w-none">
              {previewContent}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}