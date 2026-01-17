import { useState, useEffect } from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface OllamaSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OllamaSettingsDialog({ open, onOpenChange }: OllamaSettingsDialogProps) {
  const [endpoint, setEndpoint] = useState('http://localhost:11434')
  const [savedEndpoint, setSavedEndpoint] = useState('http://localhost:11434')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null)

  // Load current endpoint when dialog opens
  useEffect(() => {
    if (open) {
      loadEndpoint()
    }
  }, [open])

  async function loadEndpoint() {
    try {
      const currentEndpoint = await window.api.models.getOllamaLocalEndpoint()
      setEndpoint(currentEndpoint)
      setSavedEndpoint(currentEndpoint)

      // Test connection
      const isConnected = await window.api.models.testOllamaLocal(currentEndpoint)
      setConnectionStatus(isConnected)
    } catch (e) {
      console.error('Failed to load Ollama endpoint:', e)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const isConnected = await window.api.models.testOllamaLocal(endpoint)
      setConnectionStatus(isConnected)
    } catch (e) {
      console.error('Failed to test Ollama connection:', e)
      setConnectionStatus(false)
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!endpoint.trim()) return

    setSaving(true)
    try {
      await window.api.models.setOllamaLocalEndpoint(endpoint.trim())
      setSavedEndpoint(endpoint.trim())

      // Re-test connection after saving
      await handleTest()

      onOpenChange(false)
    } catch (e) {
      console.error('Failed to save Ollama endpoint:', e)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = endpoint !== savedEndpoint

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Ollama Settings</DialogTitle>
          <DialogDescription>
            Configure the base URL for your local Ollama installation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL</label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || !endpoint.trim()}
              >
                {testing ? <Loader2 className="size-4 animate-spin" /> : 'Test'}
              </Button>
            </div>

            {/* Connection Status */}
            {connectionStatus !== null && (
              <div className="flex items-center gap-2 text-xs">
                {connectionStatus ? (
                  <>
                    <Check className="size-3 text-status-nominal" />
                    <span className="text-status-nominal">Connected successfully</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-3 text-status-error" />
                    <span className="text-status-error">
                      Cannot connect. Make sure Ollama is running.
                    </span>
                  </>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              If Ollama is not running, start it with{' '}
              <code className="text-foreground">ollama serve</code>
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!endpoint.trim() || saving || !hasChanges}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
