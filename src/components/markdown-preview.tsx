// src/components/markdown-preview.tsx
'use client';

import type * as React from "react";
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex'; // This is a rehype plugin that outputs KaTeX-ready HTML
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Choose a style, e.g., dracula
import type { ExtraProps } from 'react-markdown';

// IMPORTANT: Ensure you have your mdx-components defined for general markdown elements
// If you want custom rendering for standard elements (h1, p, a, etc.), define them here
// This is important because react-markdown's default components are basic HTML
import mdxComponents from '@/components/mdx-components'; // Re-use your general MDX components

interface MarkdownPreviewProps {
  markdown: string;
}

interface CodeComponentProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

// Minimal interface for the Code component's props from react-markdown
interface MarkdownCodeProps {
  node?: any;                // mdast node, usually you can keep as any
  inline?: boolean;          // whether code is inline or block
  className?: string;
  children: ReactNode;       // children nodes
  [key: string]: any;        // allow other props (e.g., style, onClick, etc)
}

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <ReactMarkdown
        // Use remark-math for parsing LaTeX syntax
        remarkPlugins={[remarkMath]}
        // Use rehype-katex for converting math nodes to KaTeX-compatible HTML
        rehypePlugins={[rehypeKatex]}
        // This is crucial: customize how ReactMarkdown renders specific elements
        components={{
          // Use your general MDX components for standard elements like h1, p, ul, a etc.
          ...mdxComponents,

          // Override the default 'code' component for code highlighting
          code(props: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & ExtraProps) {
            const { node, inline, className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text'; // Default to 'text' if no language specified

            return !inline && match ? (
              <SyntaxHighlighter
                style={dracula} // Apply the chosen code highlight style
                language={language}
                PreTag="div" // Use a div instead of pre for highlighting component
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              // For inline code or code without language, render as plain code
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // You might need to add specific components for 'math' and 'inlineMath' if rehypeKatex isn't enough
          // However, rehypeKatex typically transforms these into <span className="katex"> or <div className="katex">
          // and they should render correctly if KaTeX CSS is loaded.
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}