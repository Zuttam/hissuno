---
title: "Troubleshooting"
description: "Solutions for common issues with integrations, the widget, knowledge analysis, and data syncing."
---

## Widget Not Loading

If the Hissuno widget is not appearing on your site or is failing to initialize, check the following:

1. **Verify your API key scope.** The API key used to initialize the widget must have project-level access. API keys scoped to a different project or with insufficient permissions will silently fail. You can check and regenerate API keys from **Settings > API Keys** in the dashboard.

2. **Check allowed origins.** The widget enforces origin restrictions. Go to **Settings > Integrations > Widget** and verify that your site's domain is listed in the allowed origins. Make sure to include the full origin with protocol (for example, `https://app.yourcompany.com`).

3. **Check your browser console for CORS errors.** If the widget script loads but cannot reach the API, you will see CORS-related errors in the browser console. These typically indicate that the allowed origins configuration does not match your deployment URL.

4. **Verify widget package version.** If you installed the widget via npm, make sure the `@hissuno/widget` package version is compatible with your Hissuno server version. Mismatched versions can cause initialization failures or missing features. Update with `npm install @hissuno/widget@latest`.

5. **Check for script conflicts.** Other scripts on your page may interfere with widget initialization. Try loading the widget on a minimal test page to rule out conflicts. Check for Content Security Policy (CSP) headers that might block the widget's scripts or API connections.

## Integration Authentication Failures

If an integration shows a disconnected or error state, or API calls to the integration are failing:

1. **Re-authenticate the integration.** OAuth tokens expire periodically. Go to **Settings > Integrations**, find the affected integration, and click **Reconnect** or **Re-authenticate**. This generates a fresh token.

2. **Check required permissions and scopes.** Each integration requires specific OAuth scopes. If you modified the permissions after the initial connection, the existing token may lack the necessary scopes. Disconnect and reconnect the integration to request the correct permissions.

3. **Verify the callback URL.** OAuth integrations require a redirect URI that matches your deployment URL exactly. If you changed your deployment domain or moved from HTTP to HTTPS, the callback URL configured with the OAuth provider will no longer match. Update the redirect URI in the provider's developer settings to match your current deployment URL (typically `https://your-domain.com/api/integrations/<provider>/callback`).

4. **Check for provider-side revocation.** The user who authorized the integration may have revoked access from the provider's side (for example, from GitHub's Authorized OAuth Apps settings). In this case, the token becomes invalid and you need to reconnect.

5. **Review server logs.** Authentication errors are logged with the integration name and error code. Check your server logs for entries containing the integration name and look for HTTP 401 or 403 responses from the provider API.

## Knowledge Analysis Not Completing

If a knowledge source shows a stuck or failed analysis status:

1. **Check supported formats.** Hissuno supports markdown, HTML, plain text, and PDF files for knowledge analysis. Other file types (such as images, spreadsheets, or binary formats) are not supported and will fail silently or be skipped.

2. **Account for large files.** Large documents take longer to process. Files over 100KB may take several minutes to complete analysis. The analysis status should update to "processing" - if it stays at "queued" for more than a few minutes, there may be an issue.

3. **Re-trigger analysis.** From the knowledge source detail view, you can re-trigger analysis for a specific source. Click the source in the Knowledge list, then use the **Re-analyze** action. This queues the source for fresh processing.

4. **Check for OpenAI API errors.** Knowledge analysis depends on the OpenAI API for embeddings and content processing. If the OpenAI API is down or your API key has hit rate limits, analysis will fail. Check your server logs for OpenAI-related errors and verify that your `OPENAI_API_KEY` environment variable is set and valid.

5. **Verify content is not empty.** Sources that contain no extractable text (such as a PDF that is entirely images with no OCR text) will complete analysis but produce no knowledge chunks. Check the source detail view to see if any chunks were created.

## Sessions Not Appearing

If feedback sessions are not showing up in the dashboard or API responses:

1. **Verify the project ID.** Sessions are scoped to a project. Make sure the `projectId` used when creating sessions matches the project you are viewing in the dashboard. You can find your project ID in **Settings > General**.

2. **Check API key permissions.** The API key used to create sessions needs project-level access. Keys with read-only scope can view but not create sessions. Verify the key's permissions from **Settings > API Keys**.

3. **Validate the session data.** Sessions created via the API require valid data. Check that required fields are present and correctly formatted. The API returns validation errors in the response body - check for 400-status responses in your integration code.

4. **Check dashboard filters.** The sessions list in the dashboard can be filtered by status, date range, tags, and other criteria. Make sure your filters are not hiding the sessions you expect to see. Try clearing all filters or expanding the date range.

5. **Check for processing delay.** Newly created sessions may take a moment to appear in the dashboard, especially if the PM Copilot is actively analyzing them. Refresh the page after a few seconds.

## Search Returning Poor Results

If the search functionality is not returning relevant results or is missing content you expect to find:

1. **Re-analyze affected sources.** Search relies on embeddings generated during knowledge analysis. If knowledge sources were updated after the initial analysis, the embeddings may be stale. Re-trigger analysis for the affected sources from the knowledge source detail view to regenerate embeddings.

2. **Improve content quality.** Search results are better when source content has descriptive titles, clear headings, and well-structured text. Vague or minimal content produces weak embeddings. Consider adding more descriptive titles and expanding thin content sections.

3. **Verify the content type exists in your project.** Search spans multiple content types - knowledge sources, sessions, issues, and customers. If you are searching for a specific type of content, make sure it actually exists in the project. For example, searching for an issue will return nothing if the PM Copilot has not yet analyzed any sessions.

4. **Check your search query.** Overly broad or very short queries may return too many irrelevant results. Try using more specific terms that match the language in your content. Conversely, very technical or abbreviated queries may miss results - try using the full term instead of acronyms.

5. **Verify embeddings are enabled.** Search depends on the embedding pipeline being active. If your `OPENAI_API_KEY` is not configured or has expired, new content will not be embedded and will not appear in search results.

## Slack Bot Not Responding

If the Hissuno Slack bot is not responding to messages or commands:

1. **Verify the bot is invited to the channel.** The Slack bot can only see messages in channels where it has been explicitly invited. In the Slack channel, type `/invite @Hissuno` (or whatever your bot is named) to add it.

2. **Check the Slack integration status.** Go to **Settings > Integrations** in the Hissuno dashboard and verify that the Slack integration shows a connected status. If it shows disconnected, click **Reconnect** to re-authorize.

3. **Verify required bot scopes.** The Slack bot requires the following OAuth scopes to function: `chat:write`, `channels:history`, `channels:read`, `groups:read`, `groups:history`, `im:history`, `im:read`, `users:read`, and `app_mentions:read`. If any scopes are missing, you need to reinstall the Slack app with the correct permissions.

4. **Check for workspace restrictions.** Some Slack workspaces have admin policies that restrict which apps can be installed or which channels apps can access. Contact your Slack workspace admin to verify that the Hissuno app is approved.

5. **Review event subscriptions.** The Slack bot relies on event subscriptions to receive messages. If the event subscription URL is incorrect or your server is unreachable from Slack's servers, the bot will not receive any events. Check your server logs for incoming Slack event payloads. If none are arriving, verify the Request URL in your Slack app's Event Subscriptions settings points to your deployment URL.

6. **Test with a direct message.** Send a direct message to the bot to test if it responds outside of a channel. If the bot responds in DMs but not in channels, the issue is likely related to channel permissions or event subscriptions for channel messages.
