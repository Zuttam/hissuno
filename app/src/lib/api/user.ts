import { fetchApi, fetchApiRaw } from './fetch'

const paths = {
  profile: '/api/user/profile',
  notificationPreferences: '/api/user/notification-preferences',
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function fetchProfile<T = unknown>(): Promise<T> {
  return fetchApi<T>(paths.profile, {
    errorMessage: 'Failed to fetch profile.',
  })
}

export function saveProfile(body: Record<string, unknown>): Promise<Response> {
  return fetchApiRaw(paths.profile, {
    method: 'POST',
    body,
  })
}

// ---------------------------------------------------------------------------
// Notification Preferences
// ---------------------------------------------------------------------------

export function fetchNotificationPreferences<T = unknown>(): Promise<T> {
  return fetchApi<T>(paths.notificationPreferences, {
    errorMessage: 'Failed to fetch notification preferences.',
  })
}

export function saveNotificationPreferences(body: Record<string, unknown>): Promise<Response> {
  return fetchApiRaw(paths.notificationPreferences, {
    method: 'POST',
    body,
  })
}
