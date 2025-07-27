// src/components/mdx-components.tsx
import * as React from "react";
import Image from "next/image";
import Link from "next/link"; // For internal links

// Import your shadcn/ui components (or similar components from your design system)
import { cn } from "@/lib/utils"; // A utility for conditionally joining classNames
import { Separator } from "@/components/ui/separator"; // For hr
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table"; // For tables

// Define custom components for MDX rendering
const components = {
  // Headings
  h1: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className={cn(
        "mt-2 scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
        className
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className={cn(
        "mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className={cn(
        "mt-8 scroll-m-20 text-2xl font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      className={cn(
        "mt-8 scroll-m-20 text-xl font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h5
      className={cn(
        "mt-8 scroll-m-20 text-lg font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h6
      className={cn(
        "mt-8 scroll-m-20 text-base font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  ),

  // Paragraphs
  p: ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p
      className={cn("leading-7 [&not(:first-child)]:mt-6", className)}
      {...props}
    />
  ),

  // Links
  a: ({ className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    // Check if the link is external or internal
    const isExternal = props.href?.startsWith("http://") || props.href?.startsWith("https://");

    if (isExternal) {
      return (
        <a
          className={cn("font-medium underline underline-offset-4", className)}
          target="_blank" // Open external links in a new tab
          rel="noopener noreferrer" // Security best practice for target="_blank"
          {...props}
        />
      );
    } else {
      // Use Next.js Link component for internal navigation
      return (
        <Link
          className={cn("font-medium underline underline-offset-4", className)}
          href={props.href || "#"} // Provide a fallback href
          {...props}
        >
          {props.children}
        </Link>
      );
    }
  },

  // Lists
  ul: ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)} {...props} />
  ),
  ol: ({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className={cn("my-6 ml-6 list-decimal [&>li]:mt-2", className)} {...props} />
  ),
  li: ({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className={cn("mt-2", className)} {...props} />
  ),

  // Blockquote
  blockquote: ({ className, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className={cn("mt-6 border-l-2 pl-6 italic", className)}
      {...props}
    />
  ),

  // Tables
  table: ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 w-full overflow-y-auto">
      <Table className={cn("w-full", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <TableHeader className={cn("[&_tr]:border-b", className)} {...props} />
  ),
  tbody: ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <TableBody className={cn("[&_tr]:border-b", className)} {...props} />
  ),
  tr: ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <TableRow
      className={cn("m-0 border-t p-0 even:bg-muted", className)}
      {...props}
    />
  ),
  th: ({ className, ...props }: React.HTMLAttributes<HTMLTableHeaderCellElement>) => (
    <TableHead
      className={cn(
        "border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: React.HTMLAttributes<HTMLTableDataCellElement>) => (
    <TableCell
      className={cn(
        "border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right",
        className
      )}
      {...props}
    />
  ),

  // Images
  // img: ({ className, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
  //   // Use Next.js Image component for optimization
  //   <Image
  //     className={cn("rounded-md border", className)}
  //     alt={alt || ""} // Provide alt text, even if empty string
  //     loading="lazy"
  //     fill
  //     {...(props as React.ComponentProps<typeof Image>)} // Cast props for Image component
  //   />
  // ),

  //   img: ({ className, alt, src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  //     const imgSrc = src as string;
  //   if (!imgSrc) {
  //     // Handle case where src might be missing (though unlikely for img)
  //     console.warn("Image component received no src.");
  //     return null; // Or render a fallback element
  //   }

  //   const useFill = true; // Or you could make this conditional based on your needs

  //   // If 'fill' is true, do not pass 'width' and 'height'
  //   // If 'fill' is false, you WOULD need to pass valid 'width' and 'height'
  //   // For simplicity, assuming 'fill' is always true here as per your original code.
  //      // Filter out width and height from 'props' if 'fill' is true.
  //   // This creates a new object 'remainingProps' that explicitly does NOT have 'width' or 'height'.
  //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //   const { width: _width, height: _height, ...remainingProps } = props;


  //   return (
  //     <Image
  //       className={cn("rounded-md border", className)}
  //       src={imgSrc}
  //       alt={alt || ""}
  //       loading="lazy"
  //       fill // Explicitly set fill to true
  //       {...(remainingProps as Omit<React.ComponentPropsWithoutRef<typeof Image>, 'width' | 'height' | 'src' | 'alt' | 'fill' | 'loading'>)}
  //     />
  //   );
  // },

  // Horizontal Rule
  hr: ({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) => (
    <Separator className={cn("my-8", className)} {...props} />
  ),

  // Inline Code (Fenced code blocks are handled separately by rehype-pretty-code or react-syntax-highlighter)
  code: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code
      className={cn(
        "relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm",
        className
      )}
      {...props}
    />
  ),

  // Strong and Emphasis (default styling is usually fine or via prose classes)
  strong: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className={cn("font-semibold", className)} {...props} />
  ),
  em: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em className={cn("italic", className)} {...props} />
  ),

  // Super/Subscript
  sup: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <sup className={cn("top-[0.2em] text-[0.6em]", className)} {...props} />
  ),
  sub: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <sub className={cn("bottom-[0.2em] text-[0.6em]", className)} {...props} />
  ),

  // You can add more custom components here, e.g., for custom MDX components
  // MyCustomComponent: () => <MyCustomComponent />,
};

export default components;