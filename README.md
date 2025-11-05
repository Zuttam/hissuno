##About the project 
Title: Customize AI 
Subtitle: End-User influenced software 

## Brief 
Customize taps into the emerging market of vibe coded software, where non-technical people can build software and embeds it into each users favorite platform. Essentially It lets the end user to create their own pages and components in their favorite platforms. 


## How it works
**platform developer side (admin):** 

1.⁠ ⁠customize.ai connects to the platform frontend code repository -> it analyzes it and extract the platform design system components and apis 
2.⁠ ⁠⁠customize present the user with the extracted information via a dedicated page that shows the design system and components and available actions 
3.⁠ ⁠⁠⁠⁠the developer reviews the extracted information and can prompt the agent for any issues 
4.⁠ ⁠⁠the developer gets a code snippet they can embed in their frontend which communicates with customize’s server to pull the user generated asset

**end-user side:⁠**

1.⁠ ⁠once customize component is integrated into the platform, the user gets a new interface where they can prompt the agent to build a new page (lovable style)
2.⁠ ⁠⁠customize agent asks any clarification questions and generates preliminary code which is displayed to the user
3.⁠ ⁠⁠the user prompt for changes or accepts the new page and save it. 
4.⁠ ⁠⁠the user can navigate to the new page based on the way the developer uses customize’s user asset list api


---

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: Vercel AI SDK with OpenAI
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # AI chat API endpoint
│   └── page.tsx                   # Main page
├── components/
│   └── chat.tsx                   # Chat interface component
├── lib/
│   └── supabase/
│       ├── client.ts              # Client-side Supabase client
│       ├── server.ts              # Server-side Supabase client
│       └── middleware.ts          # Supabase middleware utilities
├── types/
│   └── supabase.ts                # Database type definitions
└── middleware.ts                  # Next.js middleware
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Update `.env.local` with your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
```

**Get Supabase credentials:**
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > API
4. Copy the Project URL and anon/public key

**Get OpenAI API key:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key

### 3. Generate Database Types (Optional)

If you have tables in your Supabase database:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

## Features

### ✅ Implemented

- **AI Chat Interface**: Real-time streaming chat with OpenAI
- **Supabase Integration**: Ready for authentication and database operations
- **TypeScript**: Full type safety across frontend and backend
- **Modern UI**: Responsive chat interface with Tailwind CSS
- **Middleware**: Session management with Supabase

### 🚀 Ready to Implement

- User authentication (sign up, login, logout)
- Chat history persistence in Supabase
- User-specific chat sessions
- Repository analysis for design system extraction
- Component and API extraction
- User-generated page management

## API Routes

### POST /api/chat

Stream AI responses for chat messages.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

**Response:** Streaming text response

## Supabase Setup

### Authentication

The project includes Supabase Auth middleware. To enable authentication:

1. Uncomment the route protection in `src/lib/supabase/middleware.ts`
2. Create login/signup pages in `src/app/(auth)/`

### Database Schema Example

Example tables for the Customize AI platform:

```sql
-- Projects (platforms)
create table projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  repository_url text,
  developer_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Extracted components
create table components (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects not null,
  name text not null,
  code text not null,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User-generated pages
create table user_pages (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects not null,
  user_id uuid references auth.users not null,
  page_code text not null,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Chat history
create table chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  role text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

## Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs)

## Deployment

Deploy to Vercel:

```bash
npx vercel
```

Don't forget to add your environment variables in the Vercel dashboard!
