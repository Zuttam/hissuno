---
title: "Knowledge Sources"
description: "Add and manage the data sources that power the Hissuno Agent's understanding of your product."
---

## Overview

Knowledge sources are the raw inputs that Hissuno analyzes to build the Hissuno Agent's understanding of your product. By connecting your codebase, documentation, and other materials, you give the agent the context it needs to answer customer questions accurately.

Each source is analyzed by AI agents that extract business, product, and technical information. The results are compiled into knowledge packages that the Hissuno Agent references during conversations.

## Source Types

### Codebase

Connect a GitHub repository to let Hissuno analyze your source code directly. The Codebase Analyzer agent uses filesystem tools to explore your project structure, read configuration files, examine API routes, inspect data models, and understand your architecture.

- Requires a GitHub App installation with repository access
- Supports branch selection so you can analyze your production or main branch
- Optionally scope analysis to a subdirectory for monorepo setups using the **analysis scope** field (e.g., `packages/api`)
- The repository is cloned to an ephemeral local directory during analysis and cleaned up afterward

### Website

Provide a single URL for Hissuno to fetch and analyze. This is suited for marketing pages, landing pages, or individual articles that describe your product.

- The page is fetched server-side and its HTML is converted to text
- A web scraper agent extracts structured information including product overview, features, pricing, and support resources

### Documentation Portal

Provide a root URL and Hissuno will crawl your entire documentation site. The crawler follows internal links to index up to 50 pages per portal.

- Best suited for docs sites built with tools like Docusaurus, GitBook, ReadMe, or Nextra
- Each page is fetched with rate limiting (500ms between requests) to avoid overloading your server
- The combined content is analyzed to extract getting-started guides, API references, FAQs, and best practices

### Uploaded Document

Upload files directly from your computer. Supported formats include PDF, plain text, Markdown, and Word documents (.doc/.docx).

- Maximum file size is 10 MB
- Files are validated using extension checks, MIME type verification, and magic byte (file signature) inspection to prevent malicious uploads
- Documents are stored securely in a private Supabase Storage bucket

### Raw Text

Paste text content directly into the source editor. This is useful for internal knowledge that does not exist in a file or URL, such as support runbooks, internal policies, or product notes.

- No size limit enforced at the UI level, though very large text blocks are truncated to 50,000 characters during analysis
- Content is stored in the database rather than in file storage

## Adding a Knowledge Source

1. Navigate to the **Agents** page from the sidebar. Click on a knowledge package to open the Knowledge Detail dialog, then manage sources from there.
2. Click **Add Source** and select the source type
3. Fill in the required fields:
   - **Codebase**: Select the GitHub repository and branch; optionally set an analysis scope path
   - **Website**: Enter the full URL (e.g., `https://example.com/features`)
   - **Documentation Portal**: Enter the root URL of your docs site
   - **Uploaded Document**: Select a file from your computer
   - **Raw Text**: Paste or type the content directly
4. The source is created with a **Pending** status

## Managing Sources

### Enable and Disable

Each source has an **enabled** toggle. Disabled sources are skipped during analysis but remain saved so you can re-enable them later without re-entering configuration.

### Source Status

Sources move through the following statuses:

| Status | Meaning |
|--------|---------|
| Pending | Source has been added but not yet analyzed |
| Processing | Analysis is currently running |
| Completed | Analysis finished successfully |
| Failed | Analysis encountered an error |

When a source fails, the error message is stored and displayed in the settings panel. Common failures include unreachable URLs, invalid file formats, or GitHub authentication issues.

### Deleting a Source

You can delete a source from the settings panel. For uploaded documents, the file is also removed from storage. Deleting a source does not immediately remove its contribution from existing knowledge packages; you need to re-run analysis to regenerate packages without the deleted source.

## How Sources Are Analyzed

When you trigger a knowledge analysis, each enabled source is processed according to its type:

1. **Codebase sources** are analyzed by the Codebase Analyzer agent, which uses filesystem tools to explore the cloned repository and extract product and technical knowledge
2. **Website and documentation portal sources** are fetched and parsed, then optionally analyzed by a Web Scraper agent for structured extraction
3. **Uploaded documents and raw text** are read directly from storage or the database

All source analyses run sequentially within the analysis workflow. After all sources are processed, the results are passed to the compilation step where they are combined into categorized knowledge packages.

## Named Packages

Sources can be grouped into named packages. A named package is a labeled collection of sources that produces its own set of knowledge categories. This is useful if you have multiple products or distinct documentation sets within a single project.

- Each named package has a name, optional description, and optional guidelines that influence how the AI compiles knowledge
- When analysis runs, packages are generated per named package, and the Hissuno Agent can reference the appropriate package based on context

## Best Practices

- **Start with your codebase and docs site** for the most comprehensive coverage
- **Use analysis scope** for monorepos to avoid analyzing unrelated code
- **Add your marketing site** as a website source to capture positioning and pricing language
- **Re-run analysis** after significant product changes to keep the Hissuno Agent current
- **Review knowledge packages** after analysis to verify accuracy before relying on them in customer conversations
