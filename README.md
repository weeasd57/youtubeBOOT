# YouTube Boot

An application to manage and automate YouTube content uploads from Google Drive.

## New Feature: Drive Changes Sync

The application now properly tracks changes in your Google Drive, including when files are deleted. This ensures that your "Manage Content" section stays in sync with your actual Drive contents.

### How to Use

1. If videos still appear in the app but are deleted from Drive, click the "Sync with Drive Changes" button in the Manage Content section.
2. The app will now automatically sync with your Drive and remove any files that no longer exist.

### Setup Instructions

To enable the Drive changes tracking feature, you need to run a database migration:

```bash
# Install dependencies if needed
npm install

# Run the database migration script
node scripts/migrate-database.js
```

## Requirements

- Node.js 14+
- Google account with Drive and YouTube access
- Supabase account for database

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## Environment Variables

Create a `.env.local` file with:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

## Table of Contents
- [Features](#features)
- [Complete Workflow Cycle](#complete-workflow-cycle)
- [Authentication System](#authentication-system)
- [Dashboard](#dashboard)
- [YouTube Connection](#youtube-connection)
- [TikTok Downloader](#tiktok-downloader)
- [TikTok Videos](#tiktok-videos)
- [Upload Management](#upload-management)
- [Scheduled Uploads](#scheduled-uploads)
- [Tech Stack](#tech-stack)
- [Setup and Installation](#setup-and-installation)

## Complete Workflow Cycle

Our application provides a seamless end-to-end solution for content creators:

1. **TikTok Data Collection**:
   - Use [Apify.com](https://apify.com) to scrape TikTok "posts" data in JSON format
   - Easily import this data into our application

2. **Automated TikTok Video Download**:
    
   - Upload the JSON file to our TikTok Downloader
   - Automatically download all videos in a batch process
   - Keep all original metadata intact (titles, descriptions, etc.)

3. **Google Drive Integration**:
   - Videos are saved directly to your Google Drive
   - Organize content into custom folders
   - Automatic metadata association for future use

4. **Smart Scheduling System**:
   - Plan your content calendar with our intuitive scheduling interface
   - Set up automated posting schedules spanning days, weeks, or months
   - Configure rules for posting frequency (daily, twice weekly, etc.)
   - Optimize posting times based on your audience

5. **YouTube Shorts Publishing**:
   - Videos are automatically uploaded as YouTube Shorts
   - Custom titles and descriptions can be applied
   - Category and visibility options configurable
   - Automatic metadata tagging for discoverability

This complete cycle allows content creators to automate their entire TikTok-to-YouTube workflow with minimal manual intervention, saving hours of work while maximizing content reach.

## Features

### Authentication System
- **Google OAuth Integration**: Securely authenticate with your Google account
- **Token Management**: Automatic refresh of authentication tokens
- **Session Persistence**: Stay logged in across browser sessions
- **Refresh Auth Button**: Manually refresh authentication when needed
- **Error Handling**: Clear error messages for authentication issues

### Dashboard
- **Overview of Content**: Quick view of your Drive videos and YouTube stats
- **Recent Videos**: See recently uploaded videos
- **YouTube Channel Stats**: View subscriber count, video count, and views
- **Quick Actions**: Access to common tasks like uploading and scheduling
- **Responsive Design**: Works on desktop and mobile devices

### YouTube Connection
- **Channel Information**: Display channel name, ID, and statistics
- **Connection Status**: Real-time status of YouTube connection
- **Video Management**: View and manage your YouTube videos
- **Channel Analytics**: Basic statistics about your YouTube channel

### TikTok Downloader
- **Multiple Download Methods**:
  - Direct URL input
  - Batch download with JSON file
  - Clipboard detection
- **No Watermark Downloads**:
  - Uses ssstiktok.io service to remove TikTok watermarks
  - Downloads videos in HD quality
  - Preserves original video quality
- **Google Drive Integration**:
  - Save videos directly to Google Drive
  - Create new folders or use existing ones
  - Organize content with custom folder names
- **Download Features**:
  - Background downloading
  - Progress tracking
  - Error handling and retry options
  - File renaming options
- **Metadata Preservation**: Keeps original TikTok titles and descriptions

### TikTok Download Services
The application uses several third-party services for downloading TikTok videos without watermarks, implementing a fallback strategy to ensure reliability:

1. **Primary Service: [SSSTikTok.io](https://ssstiktok.io)**
   - High quality, watermark-free TikTok videos
   - HD resolution downloads
   - Fast processing with direct MP4 downloads
   - Most reliable service with consistent results

2. **Secondary Services (Fallbacks)**
   - **SaveTik.net**: Used if SSSTikTok encounters an issue
   - **tikwm.com**: Final fallback option for maximum reliability

These services are integrated into our backend via API endpoints that:
- Automatically attempt each service in sequence if failures occur
- Filter for "no watermark" or "HD" versions of videos
- Handle timeouts and network errors gracefully
- Return direct download links for clean, watermark-free videos

All downloaded videos maintain original quality while removing the TikTok watermark, making them perfect for YouTube Shorts.

### TikTok Videos
- **Video Management**: Browse, search, and filter downloaded TikTok videos
- **Metadata Viewing**: See original titles, descriptions, and URLs
- **Direct Links**: Quick access to videos in Google Drive
- **Sorting Options**: Organize by date, title, or status
- **Upload Preparation**: Select videos for YouTube upload

### Upload Management
- **Drive to YouTube Upload**:
  - Select videos from your Drive
  - Add titles, descriptions, and tags
  - Set privacy settings (public, private, unlisted)
  - Add to playlists
  - Schedule uploads for later
- **Batch Uploads**: Upload multiple videos at once
- **Custom Thumbnails**: Set custom thumbnails for your videos
- **Progress Tracking**: Monitor upload progress in real-time
- **Error Handling**: Detailed error messages for failed uploads

### Scheduled Uploads
- **Upload Calendar**: Visual calendar of scheduled uploads
- **Time Management**: Set specific dates and times for uploads
- **Scheduling Rules**: Set rules for automatic uploads (e.g., one per day)
- **Edit Scheduled Uploads**: Modify details before upload time
- **Notifications**: Optional alerts for successful or failed uploads

## Tech Stack
- **Frontend**: React with Next.js
- **Authentication**: NextAuth.js with Google OAuth
- **Database**: Supabase
- **Storage**: Google Drive API
- **Video Platform**: YouTube API
- **Styling**: Tailwind CSS
- **Icons**: React Icons
- **State Management**: React Context API
- **API Integration**: Google APIs, TikTok data fetching

## Authentication Details
The application uses a sophisticated token management system:
- **Access Tokens**: Short-lived tokens for API access (1-2 hours)
- **Refresh Tokens**: Long-lived tokens to get new access tokens
- **Token Storage**: Secure storage in database with encryption
- **Token Refresh**: Automatic and manual refresh options
- **Error Handling**: Graceful handling of expired tokens

## Error Handling
- **Network Issues**: Fallback to cached data when network problems occur
- **Authentication Errors**: Clear guidance on how to resolve auth issues
- **API Limitations**: Handling of rate limits and quotas
- **Validation Errors**: Immediate feedback on invalid inputs
- **Timeout Management**: Increased timeouts for slower connections

## User Experience Features
- **Dark/Light Mode**: Theme toggle for user preference
- **Responsive Design**: Works on all device sizes
- **Loading States**: Clear indication when operations are in progress
- **Success/Error Messages**: Informative feedback on actions
- **Consistent UI**: Uniform design language across the application
- **Accessibility**: Support for keyboard navigation and screen readers

## Getting Started
1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables for Google OAuth and Supabase
4. Run the development server with `npm run dev`
5. Visit `http://localhost:3000` to use the application

## Environment Variables
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
