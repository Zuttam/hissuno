import { Alert } from '@/components/ui'

export function GitHubIntegrationPlaceholder() {
  return (
    <Alert variant="info" className="border-dashed">
      GitHub integration will let you link repos directly. Until then, upload a folder to continue.
    </Alert>
  )
}

