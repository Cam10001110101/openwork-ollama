import { IpcMain, dialog, app } from 'electron'
import Store from 'electron-store'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { ModelConfig, Provider } from '../types'
import { startWatching, stopWatching } from '../services/workspace-watcher'
import {
  getOpenworkDir,
  getApiKey,
  setApiKey,
  deleteApiKey,
  hasApiKey,
  getOllamaLocalEndpoint,
  setOllamaLocalEndpoint,
  testOllamaLocalConnection
} from '../storage'

// Cache for Ollama Cloud models
let ollamaModelsCache: ModelConfig[] = []
let ollamaModelsCacheTime = 0

// Cache for Ollama Local models
let ollamaLocalModelsCache: ModelConfig[] = []
let ollamaLocalModelsCacheTime = 0

const OLLAMA_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Store for non-sensitive settings only (no encryption needed)
const store = new Store({
  name: 'settings',
  cwd: getOpenworkDir()
})

// Provider configurations
const PROVIDERS: Omit<Provider, 'hasApiKey'>[] = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'google', name: 'Google' },
  { id: 'ollama-local', name: 'Ollama Local' },
  { id: 'ollama-cloud', name: 'Ollama Cloud' }
]

// Available models configuration (updated Jan 2026)
const AVAILABLE_MODELS: ModelConfig[] = [
  // Anthropic Claude 4.5 series (latest as of Jan 2026)
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    model: 'claude-opus-4-5-20251101',
    description: 'Premium model with maximum intelligence',
    available: true
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    description: 'Best balance of intelligence, speed, and cost for agents',
    available: true
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    description: 'Fastest model with near-frontier intelligence',
    available: true
  },
  // Anthropic Claude legacy models
  {
    id: 'claude-opus-4-1-20250805',
    name: 'Claude Opus 4.1',
    provider: 'anthropic',
    model: 'claude-opus-4-1-20250805',
    description: 'Previous generation premium model with extended thinking',
    available: true
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    description: 'Fast and capable previous generation model',
    available: true
  },
  // OpenAI GPT-5 series (latest as of Jan 2026)
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    model: 'gpt-5.2',
    description: 'Latest flagship with enhanced coding and agentic capabilities',
    available: true
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    provider: 'openai',
    model: 'gpt-5.1',
    description: 'Advanced reasoning and robust performance',
    available: true
  },
  // OpenAI o-series reasoning models
  {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    model: 'o3',
    description: 'Advanced reasoning for complex problem-solving',
    available: true
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini',
    provider: 'openai',
    model: 'o3-mini',
    description: 'Cost-effective reasoning with faster response times',
    available: true
  },
  {
    id: 'o4-mini',
    name: 'o4 Mini',
    provider: 'openai',
    model: 'o4-mini',
    description: 'Fast, efficient reasoning model succeeding o3',
    available: true
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    model: 'o1',
    description: 'Premium reasoning for research, coding, math and science',
    available: true
  },
  // OpenAI GPT-4 series
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    model: 'gpt-4.1',
    description: 'Strong instruction-following with 1M context window',
    available: true
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    description: 'Faster, smaller version balancing performance and efficiency',
    available: true
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    model: 'gpt-4.1-nano',
    description: 'Most cost-efficient for lighter tasks',
    available: true
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    model: 'gpt-4o',
    description: 'Versatile model for text generation and comprehension',
    available: true
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    description: 'Cost-efficient variant with faster response times',
    available: true
  },
  // Google Gemini models
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    provider: 'google',
    model: 'gemini-3-pro-preview',
    description: 'State-of-the-art reasoning and multimodal understanding',
    available: true
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    model: 'gemini-2.5-pro',
    description: 'High-capability model for complex reasoning and coding',
    available: true
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    model: 'gemini-2.5-flash',
    description: 'Lightning-fast with balance of intelligence and latency',
    available: true
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    model: 'gemini-2.5-flash-lite',
    description: 'Fast, low-cost, high-performance model',
    available: true
  },
  // Ollama Cloud models
  {
    id: 'gpt-oss:120b-cloud',
    name: 'GPT-OSS 120B Cloud',
    provider: 'ollama-cloud',
    model: 'gpt-oss:120b-cloud',
    description: 'Open-source GPT model with 120B parameters on cloud',
    available: true,
    ollamaMode: 'cloud'
  },
  {
    id: 'gpt-oss:20b-cloud',
    name: 'GPT-OSS 20B Cloud',
    provider: 'ollama-cloud',
    model: 'gpt-oss:20b-cloud',
    description: 'Open-source GPT model with 20B parameters on cloud',
    available: true,
    ollamaMode: 'cloud'
  },
  {
    id: 'qwen3-coder:480b-cloud',
    name: 'Qwen3 Coder 480B Cloud',
    provider: 'ollama-cloud',
    model: 'qwen3-coder:480b-cloud',
    description: 'Specialized coding model with 480B parameters on cloud',
    available: true,
    ollamaMode: 'cloud'
  },
  {
    id: 'deepseek-v3.1:671b-cloud',
    name: 'DeepSeek v3.1 671B Cloud',
    provider: 'ollama-cloud',
    model: 'deepseek-v3.1:671b-cloud',
    description: 'Advanced model with 671B parameters on cloud',
    available: true,
    ollamaMode: 'cloud'
  },
  {
    id: 'qwen3-vl:235b-cloud',
    name: 'Qwen3 VL 235B Cloud',
    provider: 'ollama-cloud',
    model: 'qwen3-vl:235b-cloud',
    description: 'Vision-language model with 235B parameters on cloud',
    available: true,
    ollamaMode: 'cloud'
  }
]

/**
 * Fetch available models from Ollama Cloud API
 * Tries both /v1/models and /api/tags endpoints
 */
async function fetchOllamaCloudModels(): Promise<ModelConfig[]> {
  const apiKey = getApiKey('ollama-cloud')
  if (!apiKey) {
    console.log('[Models] No Ollama Cloud API key configured, skipping cloud model discovery')
    return []
  }

  const now = Date.now()
  // Return cached models if still fresh
  if (ollamaModelsCache.length > 0 && now - ollamaModelsCacheTime < OLLAMA_CACHE_TTL) {
    console.log('[Models] Using cached Ollama Cloud models')
    return ollamaModelsCache
  }

  try {
    console.log('[Models] Fetching Ollama Cloud models from API...')

    // Try /v1/models endpoint first (standard OpenAI-compatible endpoint)
    let response = await fetch('https://ollama.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    // If that fails, try /api/tags (Ollama's native endpoint)
    if (!response.ok) {
      console.log('[Models] /v1/models failed, trying /api/tags')
      response = await fetch('https://ollama.com/api/tags', {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      })
    }

    if (!response.ok) {
      console.error('[Models] Failed to fetch Ollama models:', response.status, response.statusText)
      return []
    }

    const data = await response.json()
    console.log('[Models] Received Ollama API response:', data)

    // Handle different response formats
    let models: any[] = []
    if (data.data) {
      // OpenAI-compatible format: { data: [...] }
      models = data.data
    } else if (data.models) {
      // Ollama native format: { models: [...] }
      models = data.models
    } else if (Array.isArray(data)) {
      // Direct array
      models = data
    }

    // Transform to our ModelConfig format
    const ollamaModels: ModelConfig[] = models.map((model: any) => {
      const modelId = model.id || model.name || model.model
      const modelName = model.name || model.id || modelId

      return {
        id: modelId,
        name: formatModelName(modelName),
        provider: 'ollama-cloud' as const,
        model: modelId,
        description: model.description || `Ollama Cloud model: ${modelName}`,
        available: true,
        ollamaMode: 'cloud' as const
      }
    })

    // Cache the results
    ollamaModelsCache = ollamaModels
    ollamaModelsCacheTime = now

    console.log(`[Models] Successfully fetched ${ollamaModels.length} Ollama Cloud models`)
    return ollamaModels
  } catch (error) {
    console.error('[Models] Error fetching Ollama Cloud models:', error)
    return []
  }
}

/**
 * Format model name to be more human-readable
 */
function formatModelName(name: string): string {
  // Remove :cloud suffix for display
  const withoutSuffix = name.replace(/:cloud$/, '')

  // Convert kebab-case or snake_case to Title Case
  return withoutSuffix
    .split(/[-_:]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format local Ollama model name to be more human-readable
 * Examples: llama3.2:3b -> Llama 3.2 (3B), codellama:latest -> CodeLlama (Latest)
 */
function formatLocalModelName(name: string): string {
  const parts = name.split(':')
  const modelName = parts[0] || name
  const tag = parts[1] || ''

  // Convert model name to Title Case
  const formattedName = modelName
    .split(/[-_.]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Format tag if present
  if (tag) {
    const formattedTag = tag.toUpperCase()
    return `${formattedName} (${formattedTag})`
  }

  return formattedName
}

/**
 * Check if a local Ollama model supports tool calling
 * Based on official list from ollama.com/search?c=tools
 */
function supportsToolCalling(modelName: string): boolean {
  // Extract base model name (before colon)
  const baseName = modelName.split(':')[0].toLowerCase()

  // Llama Series
  if (
    baseName.startsWith('llama3.1') ||
    baseName.startsWith('llama3.2') ||
    baseName.startsWith('llama3.3')
  ) {
    return true
  }

  // Qwen Series
  if (
    baseName.startsWith('qwen3') ||
    baseName.startsWith('qwen2.5') ||
    baseName.startsWith('qwen2') ||
    baseName.startsWith('qwq')
  ) {
    return true
  }

  // Mistral Series
  if (
    baseName === 'mistral' ||
    baseName.startsWith('mistral-small') ||
    baseName.startsWith('mistral-nemo') ||
    baseName.startsWith('ministral-3')
  ) {
    return true
  }

  // DeepSeek Series
  if (baseName.startsWith('deepseek-r1')) {
    return true
  }

  // Gemma Series (ONLY functiongemma, not regular gemma)
  if (baseName === 'functiongemma') {
    return true
  }

  // OpenAI Series
  if (baseName.startsWith('gpt-oss')) {
    return true
  }

  // Devstral Series
  if (baseName.startsWith('devstral-small-2') || baseName.startsWith('devstral-2')) {
    return true
  }

  // Smollm Series
  if (baseName.startsWith('smollm2')) {
    return true
  }

  return false
}

/**
 * Fetch available models from local Ollama installation
 */
async function fetchOllamaLocalModels(): Promise<ModelConfig[]> {
  const now = Date.now()

  // Return cached models if still fresh
  if (
    ollamaLocalModelsCache.length > 0 &&
    now - ollamaLocalModelsCacheTime < OLLAMA_CACHE_TTL
  ) {
    console.log('[Models] Using cached local Ollama models')
    return ollamaLocalModelsCache
  }

  try {
    const endpoint = getOllamaLocalEndpoint()
    console.log(`[Models] Fetching local Ollama models from ${endpoint}...`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    const response = await fetch(`${endpoint}/api/tags`, {
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('[Models] Failed to fetch local Ollama models:', response.status)
      return []
    }

    const data = await response.json()
    console.log('[Models] Received local Ollama response:', data)

    // Ollama local format: { models: [{ name: "llama3.2:3b", ... }] }
    const models = data.models || []

    // Transform to our ModelConfig format
    // Exclude models with :cloud suffix (those belong to Ollama Cloud)
    const allModels: ModelConfig[] = models
      .filter((model: any) => !model.name.endsWith(':cloud'))
      .map((model: any) => {
        const modelId = model.name
        return {
          id: modelId,
          name: formatLocalModelName(modelId),
          provider: 'ollama-local' as const,
          model: modelId,
          description: `Local Ollama model: ${formatLocalModelName(modelId)}`,
          available: true,
          ollamaMode: 'local' as const
        }
      })

    // Filter to only include models that support tool calling
    const localModels = allModels.filter((model) => supportsToolCalling(model.id))

    // Log filtering results
    const filteredCount = allModels.length - localModels.length
    if (filteredCount > 0) {
      console.log(
        `[Models] Filtered out ${filteredCount} local models that don't support tool calling`
      )
      console.log(
        '[Models] Compatible models:',
        localModels.map((m) => m.id).join(', ')
      )
    }

    // Cache the results
    ollamaLocalModelsCache = localModels
    ollamaLocalModelsCacheTime = now

    console.log(
      `[Models] Successfully fetched ${localModels.length} tool-compatible local Ollama models`
    )
    return localModels
  } catch (error) {
    console.log('[Models] Could not fetch local Ollama models (Ollama may not be running):', error)
    return []
  }
}

export function registerModelHandlers(ipcMain: IpcMain): void {
  // List available models
  ipcMain.handle('models:list', async () => {
    // Fetch both local and cloud Ollama models in parallel
    const [cloudResult, localResult] = await Promise.allSettled([
      fetchOllamaCloudModels(),
      fetchOllamaLocalModels()
    ])

    const ollamaCloudModels = cloudResult.status === 'fulfilled' ? cloudResult.value : []
    const ollamaLocalModels = localResult.status === 'fulfilled' ? localResult.value : []

    // Filter out static Ollama models if we have dynamic ones
    const staticModels =
      ollamaCloudModels.length > 0 || ollamaLocalModels.length > 0
        ? AVAILABLE_MODELS.filter(
            (m) => m.provider !== 'ollama-local' && m.provider !== 'ollama-cloud'
          )
        : AVAILABLE_MODELS

    // Merge static models with dynamically fetched Ollama models
    const allModels = [...staticModels, ...ollamaCloudModels, ...ollamaLocalModels]

    // Check which models have API keys configured (or are local Ollama models)
    return allModels.map((model) => ({
      ...model,
      available: model.ollamaMode === 'local' ? true : hasApiKey(model.provider)
    }))
  })

  // Get default model
  ipcMain.handle('models:getDefault', async () => {
    return store.get('defaultModel', 'claude-sonnet-4-5-20250929') as string
  })

  // Set default model
  ipcMain.handle('models:setDefault', async (_event, modelId: string) => {
    store.set('defaultModel', modelId)
  })

  // Set API key for a provider (stored in ~/.openwork/.env)
  ipcMain.handle(
    'models:setApiKey',
    async (_event, { provider, apiKey }: { provider: string; apiKey: string }) => {
      setApiKey(provider, apiKey)
    }
  )

  // Get API key for a provider (from ~/.openwork/.env or process.env)
  ipcMain.handle('models:getApiKey', async (_event, provider: string) => {
    return getApiKey(provider) ?? null
  })

  // Delete API key for a provider
  ipcMain.handle('models:deleteApiKey', async (_event, provider: string) => {
    deleteApiKey(provider)
  })

  // List providers with their API key status
  ipcMain.handle('models:listProviders', async () => {
    return PROVIDERS.map((provider) => ({
      ...provider,
      hasApiKey: hasApiKey(provider.id)
    }))
  })

  // Refresh Ollama Cloud models (force cache invalidation)
  ipcMain.handle('models:refreshOllama', async () => {
    console.log('[Models] Force refreshing Ollama Cloud models...')
    ollamaModelsCacheTime = 0 // Invalidate cache
    const models = await fetchOllamaCloudModels()
    return models.length
  })

  // Test local Ollama connection
  ipcMain.handle('models:testOllamaLocal', async (_event, endpoint?: string) => {
    return await testOllamaLocalConnection(endpoint)
  })

  // Get local Ollama endpoint
  ipcMain.handle('models:getOllamaLocalEndpoint', async () => {
    return getOllamaLocalEndpoint()
  })

  // Set local Ollama endpoint
  ipcMain.handle('models:setOllamaLocalEndpoint', async (_event, endpoint: string) => {
    setOllamaLocalEndpoint(endpoint)
  })

  // Refresh local Ollama models (force cache invalidation)
  ipcMain.handle('models:refreshOllamaLocal', async () => {
    console.log('[Models] Force refreshing local Ollama models...')
    ollamaLocalModelsCacheTime = 0 // Invalidate cache
    const models = await fetchOllamaLocalModels()
    return models.length
  })

  // Sync version info
  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion()
  })

  // Get workspace path for a thread (from thread metadata)
  ipcMain.handle('workspace:get', async (_event, threadId?: string) => {
    if (!threadId) {
      // Fallback to global setting for backwards compatibility
      return store.get('workspacePath', null) as string | null
    }

    // Get from thread metadata via threads:get
    const { getThread } = await import('../db')
    const thread = getThread(threadId)
    if (!thread?.metadata) return null

    const metadata = JSON.parse(thread.metadata)
    return metadata.workspacePath || null
  })

  // Set workspace path for a thread (stores in thread metadata)
  ipcMain.handle(
    'workspace:set',
    async (_event, { threadId, path: newPath }: { threadId?: string; path: string | null }) => {
      if (!threadId) {
        // Fallback to global setting
        if (newPath) {
          store.set('workspacePath', newPath)
        } else {
          store.delete('workspacePath')
        }
        return newPath
      }

      const { getThread, updateThread } = await import('../db')
      const thread = getThread(threadId)
      if (!thread) return null

      const metadata = thread.metadata ? JSON.parse(thread.metadata) : {}
      metadata.workspacePath = newPath
      updateThread(threadId, { metadata: JSON.stringify(metadata) })

      // Update file watcher
      if (newPath) {
        startWatching(threadId, newPath)
      } else {
        stopWatching(threadId)
      }

      return newPath
    }
  )

  // Select workspace folder via dialog (for a specific thread)
  ipcMain.handle('workspace:select', async (_event, threadId?: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Workspace Folder',
      message: 'Choose a folder for the agent to work in'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const selectedPath = result.filePaths[0]

    if (threadId) {
      const { getThread, updateThread } = await import('../db')
      const thread = getThread(threadId)
      if (thread) {
        const metadata = thread.metadata ? JSON.parse(thread.metadata) : {}
        metadata.workspacePath = selectedPath
        updateThread(threadId, { metadata: JSON.stringify(metadata) })

        // Start watching the new workspace
        startWatching(threadId, selectedPath)
      }
    } else {
      // Fallback to global
      store.set('workspacePath', selectedPath)
    }

    return selectedPath
  })

  // Load files from disk into the workspace view
  ipcMain.handle('workspace:loadFromDisk', async (_event, { threadId }: { threadId: string }) => {
    const { getThread } = await import('../db')

    // Get workspace path from thread metadata
    const thread = getThread(threadId)
    const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
    const workspacePath = metadata.workspacePath as string | null

    if (!workspacePath) {
      return { success: false, error: 'No workspace folder linked', files: [] }
    }

    try {
      const files: Array<{
        path: string
        is_dir: boolean
        size?: number
        modified_at?: string
      }> = []

      // Recursively read directory
      async function readDir(dirPath: string, relativePath: string = ''): Promise<void> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          // Skip hidden files and common non-project files
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue
          }

          const fullPath = path.join(dirPath, entry.name)
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

          if (entry.isDirectory()) {
            files.push({
              path: '/' + relPath,
              is_dir: true
            })
            await readDir(fullPath, relPath)
          } else {
            const stat = await fs.stat(fullPath)
            files.push({
              path: '/' + relPath,
              is_dir: false,
              size: stat.size,
              modified_at: stat.mtime.toISOString()
            })
          }
        }
      }

      await readDir(workspacePath)

      // Don't start watching here - causes infinite loop with workspace:files-changed listener
      // Watching is already started when workspace is selected/set

      return {
        success: true,
        files,
        workspacePath
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        files: []
      }
    }
  })

  // Read a single file's contents from disk
  ipcMain.handle(
    'workspace:readFile',
    async (_event, { threadId, filePath }: { threadId: string; filePath: string }) => {
      const { getThread } = await import('../db')

      // Get workspace path from thread metadata
      const thread = getThread(threadId)
      const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
      const workspacePath = metadata.workspacePath as string | null

      if (!workspacePath) {
        return {
          success: false,
          error: 'No workspace folder linked'
        }
      }

      try {
        // Convert virtual path to full disk path
        const relativePath = filePath.startsWith('/') ? filePath.slice(1) : filePath
        const fullPath = path.join(workspacePath, relativePath)

        // Security check: ensure the resolved path is within the workspace
        const resolvedPath = path.resolve(fullPath)
        const resolvedWorkspace = path.resolve(workspacePath)
        if (!resolvedPath.startsWith(resolvedWorkspace)) {
          return { success: false, error: 'Access denied: path outside workspace' }
        }

        // Check if file exists
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          return { success: false, error: 'Cannot read directory as file' }
        }

        // Read file contents
        const content = await fs.readFile(fullPath, 'utf-8')

        return {
          success: true,
          content,
          size: stat.size,
          modified_at: stat.mtime.toISOString()
        }
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error'
        }
      }
    }
  )

  // Read a binary file (images, PDFs, etc.) and return as base64
  ipcMain.handle(
    'workspace:readBinaryFile',
    async (_event, { threadId, filePath }: { threadId: string; filePath: string }) => {
      const { getThread } = await import('../db')

      // Get workspace path from thread metadata
      const thread = getThread(threadId)
      const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
      const workspacePath = metadata.workspacePath as string | null

      if (!workspacePath) {
        return {
          success: false,
          error: 'No workspace folder linked'
        }
      }

      try {
        // Convert virtual path to full disk path
        const relativePath = filePath.startsWith('/') ? filePath.slice(1) : filePath
        const fullPath = path.join(workspacePath, relativePath)

        // Security check: ensure the resolved path is within the workspace
        const resolvedPath = path.resolve(fullPath)
        const resolvedWorkspace = path.resolve(workspacePath)
        if (!resolvedPath.startsWith(resolvedWorkspace)) {
          return { success: false, error: 'Access denied: path outside workspace' }
        }

        // Check if file exists
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          return { success: false, error: 'Cannot read directory as file' }
        }

        // Read file as binary and convert to base64
        const buffer = await fs.readFile(fullPath)
        const base64 = buffer.toString('base64')

        return {
          success: true,
          content: base64,
          size: stat.size,
          modified_at: stat.mtime.toISOString()
        }
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error'
        }
      }
    }
  )
}

// Re-export getApiKey from storage for use in agent runtime
export { getApiKey } from '../storage'

export function getDefaultModel(): string {
  return store.get('defaultModel', 'claude-sonnet-4-5-20250929') as string
}

/**
 * Check if a model ID is an Ollama Cloud model
 * Uses cached model list from API or fallback patterns
 */
export function isOllamaCloudModel(modelId: string): boolean {
  // Check cache first
  if (ollamaModelsCache.length > 0) {
    return ollamaModelsCache.some((m) => m.id === modelId || m.model === modelId)
  }

  // Fallback to pattern matching for known Ollama Cloud model prefixes
  const ollamaModelPrefixes = [
    'qwen',
    'deepseek',
    'gpt-oss',
    'glm',
    'kimi',
    'cogito',
    'minimax',
    'ministral',
    'mistral-large',
    'devstral',
    'nemotron',
    'rnj',
    'gemma' // Gemma models on Ollama Cloud
  ]

  return (
    modelId.includes(':cloud') ||
    ollamaModelPrefixes.some((prefix) => modelId.startsWith(prefix)) ||
    // Gemini models on Ollama Cloud (gemini-3-pro-preview, gemini-3-flash-preview)
    // Note: These are different from Google's native gemini-2.5-pro, gemini-2.5-flash
    (modelId.startsWith('gemini-3') && modelId.includes('preview'))
  )
}

/**
 * Check if a model ID is a local Ollama model
 * Uses cached model list from local Ollama installation
 */
export function isOllamaLocalModel(modelId: string): boolean {
  // Check cache
  if (ollamaLocalModelsCache.length > 0) {
    return ollamaLocalModelsCache.some((m) => m.id === modelId || m.model === modelId)
  }

  return false
}

/**
 * Check if a model ID is an Ollama model (either cloud or local)
 * Kept for backward compatibility
 */
export function isOllamaModel(modelId: string): boolean {
  return isOllamaCloudModel(modelId) || isOllamaLocalModel(modelId)
}
